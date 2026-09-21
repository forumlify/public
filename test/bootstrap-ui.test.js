const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 管理员初始化令牌（ADMIN_BOOTSTRAP_TOKEN）属于部署期的一次性机制，
// 不应暴露给普通注册用户。历史上它的输入框固定显示在注册模态框里，
// 每个来注册的人都会看到一个「管理员初始化令牌」字段，既困惑又等于
// 对外宣告存在提权入口。
//
// 现在的约定：输入框默认隐藏，只有 /api/settings 返回
// bootstrap_required === true 时才显示，该标志仅在「部署者配置了引导
// 令牌」且「系统尚无管理员」时为真。
//
// 以下断言不依赖数据库，直接在文本层面锁住这些约定。

const root = path.join(__dirname, '..');
const indexHTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const authJS = fs.readFileSync(path.join(root, 'js', 'auth.js'), 'utf8');
const serverJS = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('bootstrap token field is hidden by default in the markup', () => {
  const field = indexHTML.match(/<input[^>]*id="regBootstrapToken"[^>]*>/i);
  assert.ok(field, '注册模态框中找不到 regBootstrapToken 输入框');
  assert.match(
    field[0],
    /style\s*=\s*"[^"]*display\s*:\s*none/i,
    'regBootstrapToken 必须默认隐藏，仅在首次部署且已配置引导令牌时由脚本显示'
  );
});

test('/api/settings only exposes a boolean, never the token itself', () => {
  const route = serverJS.match(/app\.get\('\/api\/settings'[\s\S]*?\n\}\);/);
  assert.ok(route, '找不到 GET /api/settings 路由');
  const body = route[0];

  assert.match(
    body,
    /bootstrap_required/,
    '接口需要返回 bootstrap_required 供前端判断是否显示初始化入口'
  );
  assert.match(
    body,
    /process\.env\.ADMIN_BOOTSTRAP_TOKEN/,
    'bootstrap_required 必须依据是否配置了引导令牌来判断'
  );
  assert.match(
    body,
    /role\s*=\s*'admin'/,
    'bootstrap_required 还必须检查是否已存在管理员'
  );

  // 不得把令牌明文或其长度写进响应。
  assert.doesNotMatch(
    body,
    /settings\.\w*token\w*\s*=\s*process\.env\.ADMIN_BOOTSTRAP_TOKEN/i,
    '不得把引导令牌本身放进响应'
  );
  assert.doesNotMatch(
    body,
    /ADMIN_BOOTSTRAP_TOKEN\s*\)\s*\.\s*length|ADMIN_BOOTSTRAP_TOKEN\s*\.\s*length/,
    '不得返回引导令牌的长度，避免泄露部署配置细节'
  );
});

test('registration ignores the hidden field instead of submitting an empty token', () => {
  // 字段隐藏时必须按「未提供」处理，否则会传空串进入后端的令牌校验
  // 分支，让普通注册收到 403。
  assert.match(
    authJS,
    /style\.display\s*!==\s*'none'/,
    '读取 regBootstrapToken 前必须判断其是否可见'
  );
  assert.match(
    authJS,
    /bootstrap_required/,
    'auth.js 需要依据 bootstrap_required 决定是否显示该字段'
  );
});

test('registration form still works without the bootstrap field', () => {
  // 普通注册路径不得依赖该字段存在。
  assert.match(
    authJS,
    /if\s*\(\s*bootstrapField\s*\)/,
    '清理表单时必须对可能不存在的 bootstrap 字段做空值保护'
  );
});
