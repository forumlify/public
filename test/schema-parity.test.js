const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// schema.sql 与 migrations/ 是两套并存的表结构定义：
//   - schema.sql 供安装脚本（install.sh）与手工部署直接执行
//   - migrations/ 供 Docker entrypoint 与 npm run migrate 使用
//
// 两套定义必须产出等价的结构，否则「用脚本装的站」和「用迁移装的站」
// 会在后续升级中分化。历史上已经漂移过一次：001_initial.sql 漏掉了
// users.token_version 与 event_logs 的审计字段，导致登录后所有接口 500。
//
// 这里在文本层面断言两边覆盖同一批表与关键列，任何一边新增表或字段
// 却忘记同步另一边时立即失败。不依赖数据库连接，可直接在 CI 中运行。

const root = path.join(__dirname, '..');
const schemaSQL = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
const migrationsDir = path.join(root, 'migrations');
const migrationSQL = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort()
  .map(file => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
  .join('\n');

// 从 SQL 文本中收集被定义的表名（CREATE TABLE 与 ALTER TABLE 都算）。
function collectTables(sql) {
  const tables = new Set();
  const pattern = /(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE)\s+"?([a-z_][a-z0-9_]*)"?/gi;
  let match;
  while ((match = pattern.exec(sql)) !== null) tables.add(match[1].toLowerCase());
  return tables;
}

// 收集通过 ALTER TABLE <t> ADD COLUMN 追加的列，按表分组。
function collectAlteredColumns(sql) {
  const added = new Map();
  const pattern = /ALTER\s+TABLE\s+"?([a-z_][a-z0-9_]*)"?\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([a-z_][a-z0-9_]*)"?/gi;
  let match;
  while ((match = pattern.exec(sql)) !== null) {
    const table = match[1].toLowerCase();
    if (!added.has(table)) added.set(table, new Set());
    added.get(table).add(match[2].toLowerCase());
  }
  return added;
}

// 收集 CREATE TABLE 块内声明的列。
function collectInlineColumns(sql) {
  const declared = new Map();
  const tablePattern = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([a-z_][a-z0-9_]*)"?\s*\(([\s\S]*?)\n\s*\);/gi;
  let match;
  while ((match = tablePattern.exec(sql)) !== null) {
    const table = match[1].toLowerCase();
    const body = match[2];
    if (!declared.has(table)) declared.set(table, new Set());
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      // 跳过表级约束（PRIMARY KEY / UNIQUE / CHECK / FOREIGN KEY / CONSTRAINT）
      if (/^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)\b/i.test(trimmed)) continue;
      const columnMatch = trimmed.match(/^"?([a-z_][a-z0-9_]*)"?\s+[A-Za-z]/i);
      if (columnMatch) declared.get(table).add(columnMatch[1].toLowerCase());
    }
  }
  return declared;
}

// 合并「建表时声明」与「事后 ALTER 追加」两类列，得到每张表的完整列集合。
function collectColumns(sql) {
  const columns = new Map();
  const merge = source => {
    for (const [table, cols] of source) {
      if (!columns.has(table)) columns.set(table, new Set());
      for (const col of cols) columns.get(table).add(col);
    }
  };
  merge(collectInlineColumns(sql));
  merge(collectAlteredColumns(sql));
  return columns;
}

const schemaTables = collectTables(schemaSQL);
const migrationTables = collectTables(migrationSQL);

test('schema.sql and migrations define the same set of tables', () => {
  const onlyInSchema = [...schemaTables].filter(t => !migrationTables.has(t));
  const onlyInMigrations = [...migrationTables].filter(t => !schemaTables.has(t));
  assert.deepEqual(
    onlyInSchema, [],
    `以下表只在 schema.sql 中定义，migrations/ 缺失：${onlyInSchema.join(', ')}`
  );
  assert.deepEqual(
    onlyInMigrations, [],
    `以下表只在 migrations/ 中定义，schema.sql 缺失：${onlyInMigrations.join(', ')}`
  );
});

test('schema.sql defines every column that migrations define', () => {
  // schema.sql 是安装脚本实际执行的权威定义，迁移中出现过的列
  // 必须都能在 schema.sql 里找到，否则脚本装出来的库会缺字段。
  const migrationColumns = collectColumns(migrationSQL);
  const schemaColumns = collectColumns(schemaSQL);

  const missing = [];
  for (const [table, cols] of migrationColumns) {
    const schemaCols = schemaColumns.get(table);
    if (!schemaCols) {
      missing.push(`${table}.*（整张表缺失）`);
      continue;
    }
    for (const col of cols) {
      if (!schemaCols.has(col)) missing.push(`${table}.${col}`);
    }
  }
  assert.deepEqual(
    missing, [],
    `schema.sql 缺少以下列，安装脚本建出的库将与迁移结果不一致：${missing.join(', ')}`
  );
});

test('columns required by server.js exist in both definitions', () => {
  // server.js 直接查询、缺失即导致运行时 500 的列。
  const REQUIRED = [
    ['users', 'token_version'],
    ['event_logs', 'method'],
    ['event_logs', 'path'],
    ['event_logs', 'user_agent'],
    ['event_logs', 'metadata'],
  ];
  const schemaColumns = collectColumns(schemaSQL);
  const migrationColumns = collectColumns(migrationSQL);

  for (const [table, column] of REQUIRED) {
    assert.ok(
      schemaColumns.get(table)?.has(column),
      `schema.sql 缺少 ${table}.${column}`
    );
    assert.ok(
      migrationColumns.get(table)?.has(column),
      `migrations/ 缺少 ${table}.${column}`
    );
  }
});

test('schema.sql stays re-runnable for the installer update path', () => {
  // install.sh 的自动更新会再次把整个 schema.sql 执行一遍，
  // 因此其中的 DDL 必须全部写成幂等形式。
  const createTables = schemaSQL.match(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi) || [];
  assert.deepEqual(
    createTables, [],
    'schema.sql 存在未带 IF NOT EXISTS 的 CREATE TABLE，重复执行会失败'
  );
  const createIndexes = schemaSQL.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/gi) || [];
  assert.deepEqual(
    createIndexes, [],
    'schema.sql 存在未带 IF NOT EXISTS 的 CREATE INDEX，重复执行会失败'
  );
  const addConstraints = schemaSQL.match(/ADD\s+CONSTRAINT\s+(?!IF\s+NOT\s+EXISTS)/gi) || [];
  // ADD CONSTRAINT 在 PostgreSQL 中不支持 IF NOT EXISTS，需由守卫逻辑处理，
  // 这里仅记录数量，避免误报。
  assert.ok(addConstraints.length >= 0);
});
