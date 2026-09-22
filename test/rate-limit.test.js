process.env.TRUST_PROXY = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app, pool } = require('../server');

test.after(async () => {
  await pool.end();
});

let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `10.0.0.${ipCounter}`;
}

test('repeated failed attempts for one account trip the account limiter even from different IPs', async () => {
  const email = 'account-limit-test@example.test';
  for (let i = 0; i < 5; i += 1) {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({ email, password: 'wrong-password' });
    assert.notEqual(res.status, 429);
  }
  const blocked = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', nextIp())
    .send({ email, password: 'wrong-password' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, '尝试次数过多，请稍后重试');
});

test('repeated failed attempts across many accounts from one IP trip the IP limiter', async () => {
  const ip = nextIp();
  for (let i = 0; i < 5; i += 1) {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email: `rotating-${i}@example.test`, password: 'wrong-password' });
    assert.notEqual(res.status, 429);
  }
  const blocked = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .send({ email: 'rotating-final@example.test', password: 'wrong-password' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, '尝试次数过多，请稍后重试');
});

test('successful logins are not counted against the auth limiters', async (t) => {
  const email = 'success-test@example.test';
  const password = 'correct horse battery staple';
  const hash = await bcrypt.hash(password, 4);

  t.mock.method(pool, 'query', async () => ({
    rows: [{
      id: 1,
      email,
      password_hash: hash,
      username: 'tester',
      avatar_url: '',
      bio: '',
      role: 'user',
      signature: '',
    }],
  }));

  const ip = nextIp();
  for (let i = 0; i < 8; i += 1) {
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password });
    assert.equal(res.status, 200);
  }
});

test('missing body fields fall back to the IP-only bucket without crashing', async () => {
  const ip = nextIp();
  const res = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .send({});
  assert.equal(res.status, 400);
});

test('malformed JSON bodies are rejected without crashing the server', async () => {
  const ip = nextIp();
  const res = await request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', ip)
    .set('Content-Type', 'application/json')
    .send('{not valid json');
  assert.ok(res.status >= 400);
  assert.ok(res.body.error);
});
