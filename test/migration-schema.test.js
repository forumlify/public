const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 这些测试锁定迁移文件与 server.js 之间的契约，不需要数据库连接。
//
// 背景：migrations/ 与 schema.sql 曾各自维护 table 定义，001_initial.sql
// 漏掉了 users.token_version 和 event_logs 的审计字段，导致登录之后所有
// 需要鉴权的接口 500。当时的测试只覆盖未认证路径，因此完全没有察觉。
// 这里直接在 SQL 文本层面断言这些列存在，让同样的漂移在 CI 里立刻失败。

const migrationsDir = path.join(__dirname, '..', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort();
const migrationSQL = migrationFiles
  .map(file => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
  .join('\n');

// server.js 直接引用、缺失即导致运行时 500 的列。
const REQUIRED_COLUMNS = [
  { table: 'users', column: 'token_version' },
  { table: 'event_logs', column: 'method' },
  { table: 'event_logs', column: 'path' },
  { table: 'event_logs', column: 'user_agent' },
  { table: 'event_logs', column: 'metadata' },
];

function migrationDefinesColumn(table, column) {
  // 命中 CREATE TABLE 内的列定义，或后续的 ALTER TABLE ... ADD COLUMN。
  const createTable = new RegExp(`CREATE TABLE[^;]*?\\b${table}\\b[^;]*?;`, 'is');
  const createBlock = migrationSQL.match(createTable);
  if (createBlock && new RegExp(`\\b${column}\\b`, 'i').test(createBlock[0])) return true;

  const alterColumn = new RegExp(
    `ALTER TABLE\\s+${table}\\s+ADD COLUMN(?:\\s+IF NOT EXISTS)?\\s+${column}\\b`,
    'i'
  );
  return alterColumn.test(migrationSQL);
}

test('migrations define every column the server queries', () => {
  for (const { table, column } of REQUIRED_COLUMNS) {
    assert.ok(
      migrationDefinesColumn(table, column),
      `migrations/ 未定义 ${table}.${column}；server.js 依赖该列，缺失会导致登录后接口 500`
    );
  }
});

test('schema.sql and migrations stay in sync on required columns', () => {
  const schemaSQL = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  for (const { table, column } of REQUIRED_COLUMNS) {
    const inSchema = new RegExp(`\\b${column}\\b`, 'i').test(schemaSQL);
    assert.ok(inSchema, `schema.sql 缺少 ${table}.${column}，两套定义发生漂移`);
  }
});

test('migration files are named so the runner applies them in order', () => {
  assert.ok(migrationFiles.length > 0, 'migrations/ 目录为空');
  for (const file of migrationFiles) {
    assert.match(file, /^\d+.*\.sql$/, `迁移文件名 ${file} 不匹配 runner 的 /^\\d+.*\\.sql$/ 过滤规则`);
  }
});

test('migration statements are idempotent for already-deployed databases', () => {
  // 001 已被记录进 schema_migrations，修复只能靠新增迁移；新增的
  // ALTER TABLE 必须带 IF NOT EXISTS，否则对全新库会重复执行报错。
  const alterStatements = migrationSQL.match(/ALTER TABLE\s+\w+\s+ADD COLUMN[^;]*/gi) || [];
  assert.ok(alterStatements.length > 0, '未找到任何 ADD COLUMN 语句');
  for (const statement of alterStatements) {
    assert.match(
      statement,
      /ADD COLUMN IF NOT EXISTS/i,
      `非幂等语句会导致重复执行失败：${statement.trim()}`
    );
  }
});
