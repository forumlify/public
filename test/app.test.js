const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const multerPackage = require('multer/package.json');
const projectPackage = require('../package.json');
const { app, pool } = require('../server');

test.after(async () => {
  await pool.end();
});

test('serves the frontend with hardened response headers', async () => {
  const response = await request(app).get('/').expect(200);
  assert.match(response.headers['content-type'], /^text\/html/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'SAMEORIGIN');
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('does not serve backend source and deployment files', async () => {
  for (const path of ['/server.js', '/schema.sql', '/package.json', '/docker-compose.yml']) {
    await request(app).get(path).expect(404);
  }
});

test('unknown API route returns JSON 404 instead of hanging', async () => {
  const response = await request(app)
    .get('/api/definitely-unknown')
    .timeout({ response: 1000, deadline: 2000 })
    .expect(404);
  assert.deepEqual(response.body, { error: '接口不存在' });
  assert.ok(response.headers.ratelimit);
});

test('request body limit returns a structured 413 response', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'user@example.test', password: 'x'.repeat(110000) })
    .expect(413);
  assert.equal(response.body.error, '请求内容过大');
});

test('registration and login validate required fields before database access', async () => {
  let response = await request(app)
    .post('/api/auth/register')
    .send({ email: '', password: '', username: '' })
    .expect(400);
  assert.equal(response.body.error, '请填写完整信息');

  response = await request(app)
    .post('/api/auth/login')
    .send({ email: '', password: '' })
    .expect(400);
  assert.equal(response.body.error, '请填写邮箱和密码');
});

test('protected routes reject unauthenticated requests', async () => {
  const response = await request(app)
    .post('/api/posts')
    .send({ title: 'test', content: 'test' })
    .expect(401);
  assert.equal(response.body.error, '请先登录');
});

test('bcryptjs hashes passwords without native install scripts', async () => {
  const hash = await bcrypt.hash('correct horse battery staple', 4);
  assert.equal(await bcrypt.compare('correct horse battery staple', hash), true);
  assert.equal(await bcrypt.compare('wrong password', hash), false);
});

test('security-sensitive dependencies are on patched release lines', () => {
  // multer 2.2.0 及更早版本存在多个 DoS 与上传限制绕过漏洞
  // （GHSA-wc9g-mqfw-jrwm 等），2.3.0 起修复。
  // 这里断言「不低于已修复的版本」，而不是锁死某个小版本，
  // 否则后续的安全升级反而会让测试失败。
  const [major, minor] = multerPackage.version.split('.').map(Number);
  const multerPatched = major > 2 || (major === 2 && minor >= 3);
  assert.ok(
    multerPatched,
    `multer ${multerPackage.version} 低于已修复漏洞的 2.3.0`
  );

  assert.equal(projectPackage.dependencies['express-rate-limit'], '8.6.2');
  assert.ok(
    projectPackage.dependencies.nodemailer,
    'nodemailer 是邮件功能的必需依赖'
  );
});
