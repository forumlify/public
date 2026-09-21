// ============================================================
//  Forumlify 后端服务
//  一个文件搞定所有 API + 文件服务
// ============================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mailer = require('./lib/mailer');

const app = express();

// 服务端配置（config.js，浏览器端加载同名文件但不影响服务端）
const CONFIG = require('./config');

// 监听端口：环境变量 PORT 优先，其次 config.js 的 SERVER_PORT，最后默认 3000
const PORT = process.env.PORT || CONFIG.SERVER_PORT || 3000;
const DEFAULT_JWT_SECRET = 'forumlify-secret-key-change-me-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

if (process.env.NODE_ENV === 'production') {
  if (JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error('JWT_SECRET must be set to a unique value in production');
  }
  if (JWT_SECRET.length < 32) {
    console.warn('Warning: JWT_SECRET should contain at least 32 characters; rotate it during a planned session reset.');
  }
  if (!process.env.DATABASE_URL && !process.env.PGHOST) {
    throw new Error('DATABASE_URL or PGHOST must be configured in production');
  }
}

// ============================================================
//  数据库
// ============================================================
const pool = new Pool(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'forumlify',
      password: process.env.PGPASSWORD || '123456',
      database: process.env.PGDATABASE || 'forumlify',
    });

// ============================================================
//  中间件
// ============================================================
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

// The existing UI relies on inline styles/scripts and a CDN-hosted Markdown
// parser, so CSP is left for a dedicated frontend migration.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
if (allowedOrigins.length > 0) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'));
    },
  }));
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: '请求过于频繁，请稍后重试' }),
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: '尝试次数过多，请稍后重试' }),
});

// 发送邮件的接口单独限流：这类接口会真实发出邮件，若被滥用既会
// 骚扰收件人，也可能导致发信账号被服务商封禁。
const mailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: '请求过于频繁，请稍后再试' }),
});

app.use('/api', apiLimiter);
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/reset-password'], authLimiter);
app.use(['/api/auth/send-code', '/api/auth/forgot-password'], mailLimiter);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));


const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parsePagination(query, { defaultLimit = 20, maxLimit = 100, maxPage = 10000 } = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || page > maxPage ||
      !Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    return null;
  }
  return { page, limit, offset: (page - 1) * limit };
}

function isText(value, { min = 0, max }) {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 255 && EMAIL_PATTERN.test(email) ? email : null;
}

function normalizeLegacyEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  return email && email.length <= 255 ? email : null;
}

async function findUserByEmail(client, value, columns = '*') {
  const email = normalizeLegacyEmail(value);
  if (!email) return null;

  const exact = await client.query(`SELECT ${columns} FROM users WHERE email = $1`, [email]);
  if (exact.rows.length === 1) return exact.rows[0];

  const insensitive = await client.query(
    `SELECT ${columns} FROM users WHERE LOWER(email) = LOWER($1) LIMIT 2`,
    [email]
  );
  return insensitive.rows.length === 1 ? insensitive.rows[0] : null;
}

function normalizeHttpUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function normalizeUploadPath(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/uploads/')) return null;
  const encodedName = value.slice('/uploads/'.length);
  try {
    const name = decodeURIComponent(encodedName);
    const segments = name.split('/');
    if (!name || name.length > 1024 || segments.some(segment => !segment || segment === '.' || segment === '..') ||
        /[\\\0-\x1f\x7f]/.test(name) || /[?#]/.test(encodedName)) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function validateUuidId(req, res, next) {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json({ error: '无效的ID' });
  return next();
}

const AUDIT_ACTIONS = new Map([
  ['POST /api/auth/register', 'register'],
  ['POST /api/auth/login', 'login'],
  ['PUT /api/settings', 'update_settings'],
  ['PUT /api/users/:id/role', 'update_user_role'],
  ['PUT /api/users/:id', 'update_profile'],
  ['PUT /api/users/:id/avatar', 'update_avatar'],
  ['PUT /api/users/:id/password', 'change_password'],
  ['PUT /api/users/:id/email', 'change_email'],
  ['POST /api/posts', 'create_post'],
  ['PUT /api/posts/:id', 'update_post'],
  ['DELETE /api/posts/:id', 'delete_post'],
  ['PUT /api/posts/:id/pin', 'toggle_post_pin'],
  ['POST /api/posts/:id/replies', 'create_reply'],
  ['DELETE /api/replies/:id', 'delete_reply'],
  ['POST /api/reports', 'create_report'],
  ['PUT /api/reports/:id', 'handle_report'],
  ['POST /api/links', 'create_link'],
  ['DELETE /api/links/:id', 'delete_link'],
  ['POST /api/upload', 'upload_image'],
  ['POST /api/admin/custom-css', 'upload_custom_css'],
  ['DELETE /api/admin/custom-css', 'delete_custom_css'],
  ['POST /api/conversations', 'create_conversation'],
  ['POST /api/conversations/:id/messages', 'send_message'],
  ['POST /api/admin/custom-pages', 'create_custom_page'],
  ['PUT /api/admin/custom-pages/:id', 'update_custom_page'],
  ['DELETE /api/admin/custom-pages/:id', 'delete_custom_page'],
  ['POST /api/auth/recovery-codes/generate', 'rotate_recovery_codes'],
  ['POST /api/auth/reset-password', 'reset_password'],
]);

function auditMetadata(req) {
  const metadata = {};
  for (const [key, value] of Object.entries(req.params || {})) {
    if (typeof value === 'string' && value.length <= 100) metadata[key] = value;
  }
  for (const key of ['post_id', 'other_user_id', 'role', 'status']) {
    const value = req.body?.[key];
    if (typeof value === 'string' && value.length <= 100) metadata[key] = value;
  }
  return { ...metadata, ...(req.auditMetadata || {}) };
}

app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !req.route?.path) return;
    const routePath = Array.isArray(req.route.path) ? req.route.path[0] : req.route.path;
    const action = AUDIT_ACTIONS.get(`${req.method} ${routePath}`);
    if (!action) return;

    const userId = req.auditUserId || req.user?.id || null;
    const ip = String(req.ip || req.socket?.remoteAddress || '').slice(0, 45);
    const userAgent = String(req.get('user-agent') || '').slice(0, 1000);
    pool.query(
      `INSERT INTO event_logs (user_id, action, ip, method, path, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [userId, action, ip, req.method, req.originalUrl.slice(0, 2000), userAgent, JSON.stringify(auditMetadata(req))]
    ).catch(error => console.error('Failed to write audit log:', error));
  });
  next();
});


// 确保上传目录存在
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
}));

// ============================================================
//  认证中间件
// ============================================================
const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '请先登录' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }

  try {
    const current = await pool.query(
      'SELECT token_version FROM users WHERE id = $1',
      [decoded.id]
    );
    const tokenVersion = decoded.token_version ?? 0;
    if (!current.rows[0] || tokenVersion !== current.rows[0].token_version) {
      return res.status(401).json({ error: '登录已失效，请重新登录' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(500).json({ error: '服务器错误' });
  }
};

const admin = async (req, res, next) => {
  try {
    const r = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (r.rows[0]?.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
};

// ============================================================
//  创建通知（内部函数）
// ============================================================
async function createNotification(userId, type, title, content, link = null) {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, content, link) VALUES ($1, $2, $3, $4, $5)',
      [userId, type, title, content, link]
    );
  } catch (err) {
    // 静默失败，不影响主流程
  }
}

// ============================================================
//  论坛设置接口
// ============================================================

// 获取论坛设置（公开）
app.get('/api/settings', async (req, res) => {
  try {
    const r = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    r.rows.forEach(row => { settings[row.key] = row.value; });

    // 仅在「部署者配置了引导令牌」且「尚未存在管理员」时，前端才需要
    // 展示管理员初始化入口。两者任一不满足，注册框就完全是普通注册。
    // 这里只返回布尔值，不泄露令牌本身或其长度。
    const bootstrapConfigured = Boolean(process.env.ADMIN_BOOTSTRAP_TOKEN);
    let adminExists = true;
    if (bootstrapConfigured) {
      const adminResult = await pool.query("SELECT EXISTS(SELECT 1 FROM users WHERE role = 'admin') AS exists");
      adminExists = adminResult.rows[0].exists;
    }
    settings.bootstrap_required = bootstrapConfigured && !adminExists;

    // 告知前端注册时是否需要邮箱验证码，决定是否显示验证码输入框。
    // 同时暴露 SMTP 是否可用，避免在未配置邮件时引导用户去点「获取验证码」。
    const smtpConfig = await mailer.loadSmtpConfig(pool);
    const smtpReady = mailer.isConfigComplete(smtpConfig);
    settings.email_verify_required = settings.email_verify_required === 'true' && smtpReady;
    settings.smtp_ready = smtpReady;

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新论坛设置（管理员）
app.put('/api/settings', auth, admin, async (req, res) => {
  const { forum_name } = req.body;
  if (!isText(forum_name, { min: 1, max: 100 })) {
    return res.status(400).json({ error: '论坛名称长度应为1到100个字符' });
  }
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['forum_name', forum_name.trim()]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '更新失败，请稍后重试' });
  }
});

// ============================================================
//  SMTP 配置（管理员）
// ============================================================

// 读取 SMTP 配置。密码永不回显，只返回是否已设置。
app.get('/api/admin/smtp', auth, admin, async (req, res) => {
  try {
    const config = await mailer.loadSmtpConfig(pool);
    res.json({
      enabled: config.enabled,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      from_name: config.fromName,
      from_email: config.fromEmail,
      // 只告诉前端「有没有设置过」，不返回明文
      password_set: Boolean(config.password),
      configured: mailer.isConfigComplete(config),
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 保存 SMTP 配置
app.put('/api/admin/smtp', auth, admin, async (req, res) => {
  const { enabled, host, port, secure, user, password, from_name, from_email } = req.body;

  if (typeof enabled !== 'boolean' || typeof secure !== 'boolean') {
    return res.status(400).json({ error: '启用状态与加密方式必须为布尔值' });
  }

  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    return res.status(400).json({ error: '端口应为 1 到 65535 之间的整数' });
  }

  // 允许留空（表示不启用），但填写时必须合法
  const hostValue = typeof host === 'string' ? host.trim() : '';
  if (hostValue.length > 255) {
    return res.status(400).json({ error: 'SMTP 主机地址过长' });
  }
  const userValue = typeof user === 'string' ? user.trim() : '';
  if (userValue.length > 255) {
    return res.status(400).json({ error: 'SMTP 用户名过长' });
  }
  if (typeof from_name === 'string' && from_name.length > 100) {
    return res.status(400).json({ error: '发件人名称过长' });
  }

  const fromEmailValue = typeof from_email === 'string' ? from_email.trim() : '';
  if (fromEmailValue && !normalizeEmail(fromEmailValue)) {
    return res.status(400).json({ error: '发件人邮箱格式无效' });
  }

  // 启用时必须把关键字段填全，否则直接存进去会让发信静默失败
  if (enabled) {
    if (!hostValue) return res.status(400).json({ error: '启用 SMTP 时需填写服务器地址' });
    if (!fromEmailValue) return res.status(400).json({ error: '启用 SMTP 时需填写发件人邮箱' });
  }

  try {
    const entries = [
      ['smtp_enabled', String(enabled)],
      ['smtp_host', hostValue],
      ['smtp_port', String(portNumber)],
      ['smtp_secure', String(secure)],
      ['smtp_user', userValue],
      ['smtp_from_name', typeof from_name === 'string' ? from_name.trim() : ''],
      ['smtp_from_email', fromEmailValue],
    ];

    // 密码留空表示「保持原值」，避免管理员只改端口却把密码清掉。
    // 传空字符串则显式清除。
    if (typeof password === 'string' && password.length > 0) {
      if (password.length > 255) {
        return res.status(400).json({ error: 'SMTP 密码过长' });
      }
      entries.push(['smtp_password', password]);
    }

    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }

    // 配置变了，让缓存的连接失效
    mailer.invalidateTransport();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '保存失败，请稍后重试' });
  }
});

// 发送测试邮件，验证配置是否可用。可指定收件人，默认发给当前管理员。
app.post('/api/admin/smtp/test', auth, admin, async (req, res) => {
  try {
    const config = await mailer.loadSmtpConfig(pool);
    if (!mailer.isConfigComplete(config)) {
      return res.status(400).json({ error: 'SMTP 尚未配置完成，请先填写并启用' });
    }

    const requested = req.body && req.body.to;
    const to = requested ? normalizeEmail(requested) : null;
    if (requested && !to) {
      return res.status(400).json({ error: '收件人邮箱格式无效' });
    }

    // 未指定则发给自己，省去管理员手填
    let target = to;
    if (!target) {
      const me = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      target = me.rows[0] && me.rows[0].email;
      if (!target) return res.status(400).json({ error: '请指定收件人邮箱' });
    }

    await mailer.sendMail(config, {
      to: target,
      subject: 'Forumlify SMTP 测试邮件',
      text: `这是一封来自 Forumlify 的测试邮件。\n\n如果你收到它，说明 SMTP 配置正确。\n\n发信时间：${new Date().toISOString()}`,
      html: `<p>这是一封来自 <strong>Forumlify</strong> 的测试邮件。</p>
             <p>如果你收到它，说明 SMTP 配置正确。</p>
             <p style="color:#888;font-size:13px;">发信时间：${new Date().toISOString()}</p>`,
    });

    res.json({ success: true, to: target });
  } catch (err) {
    // 把底层 SMTP 异常转成可读提示，便于管理员自行排查
    res.status(400).json({ error: mailer.describeSmtpError(err) });
  }
});

// 清除已保存的 SMTP 密码
app.delete('/api/admin/smtp/password', auth, admin, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('smtp_password', '')
       ON CONFLICT (key) DO UPDATE SET value = '', updated_at = NOW()`
    );
    mailer.invalidateTransport();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '清除失败，请稍后重试' });
  }
});

// 开关注册邮箱验证。仅在 SMTP 可用时才允许开启，避免开启后
// 谁都注册不了。
app.put('/api/admin/email-verify', auth, admin, async (req, res) => {
  const { required } = req.body;
  if (typeof required !== 'boolean') {
    return res.status(400).json({ error: '参数无效' });
  }

  try {
    if (required) {
      const config = await mailer.loadSmtpConfig(pool);
      if (!mailer.isConfigComplete(config)) {
        return res.status(400).json({ error: '请先完成 SMTP 配置并发送测试邮件确认可用' });
      }
    }

    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('email_verify_required', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [String(required)]
    );
    res.json({ success: true, email_verify_required: required });
  } catch (err) {
    res.status(500).json({ error: '保存失败，请稍后重试' });
  }
});

// ============================================================
//  认证接口
// ============================================================

function secureTokenMatch(provided, expected) {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(String(provided));
  const expectedBuffer = Buffer.from(String(expected));
  return providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

// 签发访问令牌。改密码/改邮箱会递增 token_version 使旧令牌失效，
// 因此这些接口需要用更新后的 token_version 重新签发，避免用户在
// 敏感操作成功后被强制登出。
function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, token_version: user.token_version },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ============================================================
//  邮箱验证码
// ============================================================
// 注册需要邮箱验证时，先发一个 6 位数字码；校验通过后才允许建号。
// 验证码只存 sha256 摘要，并限制尝试次数与有效期。

const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;   // 10 分钟有效
const EMAIL_CODE_MAX_ATTEMPTS = 5;          // 超过即作废

// 生成 6 位数字验证码，使用 crypto 随机源
function generateEmailCode() {
  // randomInt 上界不含，故取 1000000 得到 000000-999999
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashEmailCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

// 论坛设置里是否需要邮箱验证。默认关闭，升级后行为不变。
async function isEmailVerifyRequired() {
  const r = await pool.query("SELECT value FROM settings WHERE key = 'email_verify_required'");
  return r.rows[0]?.value === 'true';
}

// 写入一条验证码记录（同邮箱同用途只保留一条有效记录）
async function createEmailVerification(email, purpose) {
  const code = generateEmailCode();
  await pool.query(
    `INSERT INTO email_verifications (email, code_hash, purpose, expires_at, attempts, consumed_at)
     VALUES ($1, $2, $3, $4, 0, NULL)
     ON CONFLICT (LOWER(email), purpose) WHERE consumed_at IS NULL
     DO UPDATE SET code_hash = EXCLUDED.code_hash,
                   expires_at = EXCLUDED.expires_at,
                   attempts = 0,
                   created_at = now()`,
    [email, hashEmailCode(code), purpose, new Date(Date.now() + EMAIL_CODE_TTL_MS)]
  );
  return code;
}

// 校验验证码。成功时消费掉该记录并返回 true。
// 失败返回原因字符串，便于接口给出更具体的提示。
async function consumeEmailVerification(email, purpose, code) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT id, code_hash, attempts, expires_at
       FROM email_verifications
       WHERE LOWER(email) = LOWER($1) AND purpose = $2 AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [email, purpose]
    );

    if (r.rows.length === 0) {
      await client.query('ROLLBACK');
      return 'missing';
    }

    const row = r.rows[0];

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await client.query('ROLLBACK');
      return 'expired';
    }
    if (row.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
      await client.query('ROLLBACK');
      return 'too_many';
    }

    // 定时安全比较，避免通过响应时间推断验证码
    const provided = Buffer.from(hashEmailCode(code));
    const expected = Buffer.from(row.code_hash);
    const matched = provided.length === expected.length &&
      crypto.timingSafeEqual(provided, expected);

    if (!matched) {
      await client.query(
        'UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1',
        [row.id]
      );
      await client.query('COMMIT');
      return 'mismatch';
    }

    await client.query(
      'UPDATE email_verifications SET consumed_at = now() WHERE id = $1',
      [row.id]
    );
    await client.query('COMMIT');
    return null;   // null 表示通过
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// 把 consumeEmailVerification 的失败原因转成用户可读文案
const EMAIL_CODE_ERRORS = {
  missing: '请先获取验证码',
  expired: '验证码已过期，请重新获取',
  too_many: '尝试次数过多，请重新获取验证码',
  mismatch: '验证码错误',
};

// 校验邮件配置是否可用于发信，返回配置对象或抛出带 code 的错误
async function requireMailConfig() {
  const config = await mailer.loadSmtpConfig(pool);
  if (!mailer.isConfigComplete(config)) {
    const error = new Error('站点尚未配置邮件服务，请联系管理员');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  return config;
}

// 发送邮箱验证码（注册用）。独立的限流在注册路由处配置。
app.post('/api/auth/send-code', async (req, res) => {
  const { email } = req.body;
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return res.status(400).json({ error: '请输入有效邮箱' });
  }

  try {
    if (!(await isEmailVerifyRequired())) {
      return res.status(400).json({ error: '本站未开启邮箱验证' });
    }

    // 已注册过的邮箱直接拦下，避免泄露之外还白发一封
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalized]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }

    const config = await requireMailConfig();
    const code = await createEmailVerification(normalized, 'register');

    await mailer.sendMail(config, {
      to: normalized,
      subject: '注册验证码',
      text: `你的注册验证码是：${code}\n\n有效期 10 分钟，请勿转发给他人。\n如果这不是你本人的操作，请忽略本邮件。`,
      html: `<p>你的注册验证码是：</p>
             <p style="font-size:26px;font-weight:700;letter-spacing:4px;margin:12px 0;">${code}</p>
             <p style="color:#888;font-size:13px;">有效期 10 分钟，请勿转发给他人。<br>如果这不是你本人的操作，请忽略本邮件。</p>`,
    });

    res.json({ success: true, message: '验证码已发送，请查收邮件' });
  } catch (err) {
    if (err.code === 'SMTP_NOT_CONFIGURED') {
      return res.status(503).json({ error: err.message });
    }
    console.error('发送注册验证码失败:', err);
    res.status(400).json({ error: mailer.describeSmtpError(err) });
  }
});

// 注册；管理员只能使用部署时配置的一次性引导令牌创建
app.post('/api/auth/register', async (req, res) => {
  const { email, password, username, bootstrap_token, email_code } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !isText(username, { min: 1, max: 20 })) {
    return res.status(400).json({ error: '请输入有效邮箱和1到20个字符的用户名' });
  }
  if (!isText(password, { min: 6, max: 128 })) {
    return res.status(400).json({ error: '密码长度应为6到128个字符' });
  }

  // 邮箱验证码校验放在所有格式校验之后，避免用户因格式错误白白消耗
  // 一次验证码（校验失败会计入尝试次数）。
  let emailVerified = false;
  try {
    if (await isEmailVerifyRequired()) {
      if (!isText(email_code, { min: 4, max: 10 })) {
        return res.status(400).json({ error: '请输入邮箱验证码' });
      }
      const failure = await consumeEmailVerification(normalizedEmail, 'register', email_code.trim());
      if (failure) {
        return res.status(400).json({ error: EMAIL_CODE_ERRORS[failure] || '验证码校验失败' });
      }
      emailVerified = true;
    }
  } catch (err) {
    console.error('校验邮箱验证码失败:', err);
    return res.status(500).json({ error: '服务器错误' });
  }

  const hash = await bcrypt.hash(password, 10);
  const avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username) + '&background=6366f1&color=fff&size=64';
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('forumlify-admin-bootstrap'))");
    const adminResult = await client.query("SELECT EXISTS(SELECT 1 FROM users WHERE role = 'admin') AS exists");
    const hasAdmin = adminResult.rows[0].exists;
    const requestedBootstrap = Boolean(bootstrap_token);
    const validBootstrap = secureTokenMatch(bootstrap_token, process.env.ADMIN_BOOTSTRAP_TOKEN);

    if (requestedBootstrap && !validBootstrap) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: '管理员初始化令牌无效' });
    }
    if (validBootstrap && hasAdmin) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: '管理员已初始化' });
    }

    const role = validBootstrap && !hasAdmin ? 'admin' : 'user';
    const r = await client.query(
      `INSERT INTO users (email, password_hash, username, avatar_url, role, signature, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, avatar_url, role, signature, created_at`,
      [normalizedEmail, hash, username.trim(), avatar, role, '', emailVerified]
    );
    await client.query('COMMIT');

    req.auditUserId = r.rows[0].id;
    req.auditMetadata = { role: r.rows[0].role };

    res.json({
      user: r.rows[0],
      message: role === 'admin' ? '管理员初始化成功' : '注册成功'
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      res.status(400).json({ error: '邮箱或用户名已被注册' });
    } else {
      res.status(500).json({ error: '注册失败，请稍后重试' });
    }
  } finally {
    if (client) client.release();
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!normalizeLegacyEmail(email) || !isText(password, { min: 1, max: 100000 })) {
    return res.status(400).json({ error: '请填写邮箱和密码' });
  }

  try {
    const user = await findUserByEmail(pool, email);

    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    req.auditUserId = user.id;

    const token = issueToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        role: user.role,
        signature: user.signature || '',
      }
    });
  } catch (err) {
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, username, avatar_url, bio, role, signature, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
//  用户管理（支持分页和搜索）
// ============================================================

// 获取用户列表（支持分页和按用户名搜索）- 管理员专用
app.get('/api/users', auth, admin, async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ error: '分页参数无效' });
    const { page, limit, offset } = pagination;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 100) return res.status(400).json({ error: '搜索关键词过长' });

    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (search.trim()) {
      whereClause = ' WHERE username ILIKE $' + paramIndex;
      params.push('%' + search.trim() + '%');
      paramIndex++;
    }

    // 查询总数
    const countQuery = 'SELECT COUNT(*) FROM users' + whereClause;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT id, username, avatar_url, bio, role, signature, created_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const r = await pool.query(query, params);

    res.json({
      data: r.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
//  用户公开接口（无需登录）- 用于用户主页
// ============================================================

// 获取单个用户公开信息（无需登录）
app.get('/api/users/profile/:username', async (req, res) => {
  if (!isText(req.params.username, { min: 1, max: 20 })) {
    return res.status(400).json({ error: '用户名无效' });
  }
  try {
    const r = await pool.query(
      'SELECT id, username, avatar_url, bio, role, signature, created_at FROM users WHERE username = $1',
      [req.params.username]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改用户角色（管理员）
app.put('/api/users/:id/role', validateUuidId, auth, admin, async (req, res) => {
  const { role } = req.body;
  const userId = req.params.id;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: '无效的角色' });
  }

  try {
    if (userId === req.user.id) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }

    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新用户资料（含签名）
app.put('/api/users/:id', validateUuidId, auth, async (req, res) => {
  const { username, bio, signature } = req.body;
  const userId = req.params.id;

  if (userId !== req.user.id) {
    return res.status(403).json({ error: '无权限修改他人资料' });
  }
  if (!isText(username, { min: 1, max: 20 }) ||
      (bio !== undefined && bio !== null && !isText(bio, { max: 1000 })) ||
      (signature !== undefined && signature !== null && !isText(signature, { max: 500 }))) {
    return res.status(400).json({ error: '资料字段长度无效' });
  }

  try {
    await pool.query(
      'UPDATE users SET username = $1, bio = $2, signature = $3 WHERE id = $4',
      [username, bio || '', signature || '', userId]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: '用户名已被占用' });
    } else {
      res.status(500).json({ error: '服务器错误' });
    }
  }
});

// 更新用户头像
app.put('/api/users/:id/avatar', validateUuidId, auth, async (req, res) => {
  const { avatar_url } = req.body;
  const userId = req.params.id;

  if (userId !== req.user.id) {
    return res.status(403).json({ error: '无权限修改他人头像' });
  }

  const normalizedAvatar = normalizeUploadPath(avatar_url) || normalizeHttpUrl(avatar_url);
  if (!normalizedAvatar) {
    return res.status(400).json({ error: '请提供有效头像地址' });
  }

  try {
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [normalizedAvatar, userId]);
    res.json({ success: true, avatar_url: normalizedAvatar });
  } catch (err) {
    res.status(500).json({ error: '更新失败，请稍后重试' });
  }
});

// ============================================================
//  修改密码和邮箱
// ============================================================

// 修改密码
app.put('/api/users/:id/password', validateUuidId, auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.params.id;

  if (userId !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  if (!isText(oldPassword, { min: 1, max: 100000 }) || !isText(newPassword, { min: 6, max: 128 })) {
    return res.status(400).json({ error: '密码长度无效' });
  }

  try {
    const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const valid = await bcrypt.compare(oldPassword, user.rows[0].password_hash);
    if (!valid) {
      return res.status(400).json({ error: '当前密码错误' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const updated = await pool.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1
       WHERE id = $2
       RETURNING id, email, role, token_version`,
      [hash, userId]
    );

    // 旧令牌因 token_version 递增而失效，这里补发一个，让本次会话保持登录。
    res.json({ success: true, token: issueToken(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: '修改失败，请稍后重试' });
  }
});

// 修改邮箱
app.put('/api/users/:id/email', validateUuidId, auth, async (req, res) => {
  const { password, newEmail } = req.body;
  const userId = req.params.id;

  if (userId !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  const normalizedEmail = normalizeEmail(newEmail);
  if (!isText(password, { min: 1, max: 100000 }) || !normalizedEmail) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  try {
    const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const valid = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!valid) {
      return res.status(400).json({ error: '密码错误' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2', [normalizedEmail, userId]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: '邮箱已被占用' });
    }

    const updated = await pool.query(
      `UPDATE users SET email = $1, token_version = token_version + 1
       WHERE id = $2
       RETURNING id, email, role, token_version`,
      [normalizedEmail, userId]
    );

    // 同上：补发令牌，避免用户改完邮箱就被登出。
    res.json({ success: true, token: issueToken(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ error: '修改失败，请稍后重试' });
  }
});

// ============================================================
//  帖子接口（含分页和置顶）
// ============================================================

// 获取帖子列表（支持分页和用户筛选，置顶优先）
app.get('/api/posts', async (req, res) => {
  const sort = req.query.sort === 'hot' ? 'updated_at' : 'created_at';
  const pagination = parsePagination(req.query);
  if (!pagination) return res.status(400).json({ error: '分页参数无效' });
  const { page, limit, offset } = pagination;
  if (req.query.user_id && !UUID_PATTERN.test(req.query.user_id)) {
    return res.status(400).json({ error: '用户ID无效' });
  }

  try {
    let query = `
      SELECT
        p.*,
        u.username,
        u.avatar_url,
        u.signature,
        (SELECT COUNT(*) FROM replies WHERE post_id = p.id) as reply_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
    `;
    const params = [];

    if (req.query.user_id) {
      query += ' WHERE p.user_id = $1';
      params.push(req.query.user_id);
    }

    let countQuery = `
      SELECT COUNT(*) as total FROM posts p
    `;
    if (req.query.user_id) {
      countQuery += ' WHERE p.user_id = $1';
    }
    const countResult = await pool.query(countQuery, req.query.user_id ? [req.query.user_id] : []);
    const total = parseInt(countResult.rows[0]?.total || 0);

    query += ` ORDER BY p.is_pinned DESC, p.pinned_at DESC NULLS LAST, ${sort} DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const r = await pool.query(query, params);
    res.json({
      data: r.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个帖子
app.get('/api/posts/:id', validateUuidId, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.*, u.username, u.avatar_url, u.signature
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建帖子
app.post('/api/posts', auth, async (req, res) => {
  const { title, content, images } = req.body;

  if (!isText(content, { min: 1, max: 50000 }) ||
      (title !== undefined && !isText(title, { max: 200 })) ||
      (images !== undefined && (!Array.isArray(images) || images.length > 6 ||
        images.some(image => typeof image !== 'string' || image.length > 2048)))) {
    return res.status(400).json({ error: '帖子字段长度或图片数量无效' });
  }

  const imagePaths = images || [];
  const uploadPathPattern = /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|gif|webp)$/i;
  if (!Array.isArray(imagePaths) || imagePaths.length > 6 || imagePaths.some(image => !uploadPathPattern.test(image))) {
    return res.status(400).json({ error: '图片地址无效或数量超过限制' });
  }

  try {
    const r = await pool.query(
      `INSERT INTO posts (user_id, title, content, images)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, title?.trim() || '无标题', content.trim(), imagePaths]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '发布失败，请稍后重试' });
  }
});

// 编辑帖子
app.put('/api/posts/:id', validateUuidId, auth, async (req, res) => {
  const { title, content } = req.body;
  const postId = req.params.id;

  if (!isText(content, { min: 1, max: 50000 }) ||
      (title !== undefined && !isText(title, { max: 200 }))) {
    return res.status(400).json({ error: '帖子字段长度无效' });
  }

  try {
    const post = await pool.query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    if (post.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '无权限编辑此帖子' });
    }

    const r = await pool.query(
      `UPDATE posts SET title = $1, content = $2, edited_at = NOW() WHERE id = $3 RETURNING *`,
      [title?.trim() || '无标题', content.trim(), postId]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '编辑失败，请稍后重试' });
  }
});

// 删除帖子
app.delete('/api/posts/:id', validateUuidId, auth, async (req, res) => {
  try {
    const post = await pool.query('SELECT user_id FROM posts WHERE id = $1', [req.params.id]);
    if (post.rows.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }

    const user = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const isAdmin = user.rows[0]?.role === 'admin';
    const isAuthor = post.rows[0].user_id === req.user.id;

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: '无权限删除此帖子' });
    }

    if (!isAuthor && isAdmin) {
      await createNotification(
        post.rows[0].user_id,
        'post_deleted',
        '你的帖子已被删除',
        '管理员删除了你的帖子'
      );
    }

    await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败，请稍后重试' });
  }
});

// 置顶/取消置顶帖子（管理员）
app.put('/api/posts/:id/pin', validateUuidId, auth, admin, async (req, res) => {
  const postId = req.params.id;

  try {
    const post = await pool.query('SELECT id, user_id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) {
      return res.status(404).json({ error: '帖子不存在' });
    }

    const check = await pool.query('SELECT is_pinned FROM posts WHERE id = $1', [postId]);
    const isPinned = check.rows[0].is_pinned;

    const r = await pool.query(
      `UPDATE posts SET is_pinned = $1, pinned_at = $2 WHERE id = $3 RETURNING *`,
      [!isPinned, !isPinned ? new Date().toISOString() : null, postId]
    );

    await createNotification(
      post.rows[0].user_id,
      'system',
      isPinned ? '你的帖子已被取消置顶' : '你的帖子已被置顶',
      isPinned ? '管理员取消了你的帖子置顶' : '管理员把你的帖子置顶了',
      '/?post=' + postId
    );

    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '操作失败，请稍后重试' });
  }
});

// ============================================================
//  回复接口
// ============================================================

// 获取帖子回复列表
app.get('/api/posts/:id/replies', validateUuidId, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT r.*, u.username, u.avatar_url
       FROM replies r
       JOIN users u ON r.user_id = u.id
       WHERE r.post_id = $1
       ORDER BY r.created_at ASC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建回复
app.post('/api/posts/:id/replies', validateUuidId, auth, async (req, res) => {
  const { content } = req.body;

  if (!isText(content, { min: 1, max: 10000 })) {
    return res.status(400).json({ error: '回复内容长度应为1到10000个字符' });
  }

  try {
    const r = await pool.query(
      `INSERT INTO replies (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.id, req.user.id, content.trim()]
    );
    await pool.query('UPDATE posts SET updated_at = NOW() WHERE id = $1', [req.params.id]);

    const postAuthor = await pool.query('SELECT user_id FROM posts WHERE id = $1', [req.params.id]);
    if (postAuthor.rows[0] && postAuthor.rows[0].user_id !== req.user.id) {
      await createNotification(
        postAuthor.rows[0].user_id,
        'reply',
        '有人回复了你的帖子',
        (content || '').substring(0, 100),
        '/?post=' + req.params.id
      );
    }

    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '回复失败，请稍后重试' });
  }
});

// 删除回复
app.delete('/api/replies/:id', validateUuidId, auth, async (req, res) => {
  try {
    const reply = await pool.query('SELECT user_id FROM replies WHERE id = $1', [req.params.id]);
    if (reply.rows.length === 0) {
      return res.status(404).json({ error: '回复不存在' });
    }

    const user = await pool.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (reply.rows[0].user_id !== req.user.id && user.rows[0]?.role !== 'admin') {
      return res.status(403).json({ error: '无权限删除此回复' });
    }

    await pool.query('DELETE FROM replies WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败，请稍后重试' });
  }
});

// ============================================================
//  举报接口
// ============================================================

// 获取举报列表（管理员）
app.get('/api/reports', auth, admin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        r.*,
        reporter.username as reporter_name,
        handler.username as handler_name,
        p.title as post_title,
        p.content as post_content
      FROM reports r
      JOIN users reporter ON r.reporter_id = reporter.id
      LEFT JOIN users handler ON r.handler_id = handler.id
      LEFT JOIN posts p ON r.post_id = p.id
      ORDER BY r.created_at DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 提交举报
app.post('/api/reports', auth, async (req, res) => {
  const { post_id, reason } = req.body;

  if (!UUID_PATTERN.test(post_id || '') || !isText(reason, { min: 1, max: 100 })) {
    return res.status(400).json({ error: '帖子ID或举报原因无效' });
  }

  try {
    await pool.query(
      `INSERT INTO reports (post_id, reporter_id, reason)
       VALUES ($1, $2, $3)`,
      [post_id, req.user.id, reason.trim()]
    );
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: '你已经举报过此帖子，请等待处理' });
    }
    res.status(500).json({ error: '举报失败，请稍后重试' });
  }
});

// 处理举报（管理员）
app.put('/api/reports/:id', validateUuidId, auth, admin, async (req, res) => {
  const { status, note } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '无效的状态' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const report = await client.query(
      'SELECT reporter_id, post_id, status FROM reports WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (report.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '举报不存在' });
    }
    if (report.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: '该举报已处理' });
    }

    await client.query(
      `UPDATE reports
       SET status = $1, handled_at = NOW(), handler_id = $2, handler_note = $3
       WHERE id = $4`,
      [status, req.user.id, note || '', req.params.id]
    );

    if (status === 'approved' && report.rows[0].post_id) {
      await client.query('DELETE FROM posts WHERE id = $1', [report.rows[0].post_id]);
    }

    const statusText = status === 'approved' ? '已删除' : '已驳回';
    await client.query(
      `INSERT INTO notifications (user_id, type, title, content, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        report.rows[0].reporter_id,
        'report_handled',
        '你的举报已被处理',
        `你举报的帖子已被管理员${statusText}`,
        status === 'rejected' && report.rows[0].post_id ? '/?post=' + report.rows[0].post_id : null,
      ]
    );

    await client.query('COMMIT');
    res.json({ success: true, post_deleted: status === 'approved' });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('回滚举报处理事务失败:', rollbackError);
      }
    }
    res.status(500).json({ error: '操作失败，请稍后重试' });
  } finally {
    if (client) client.release();
  }
});

// ============================================================
//  友情链接
// ============================================================

// 获取友情链接
app.get('/api/links', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM friendly_links ORDER BY sort_order');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 添加友情链接（管理员）
app.post('/api/links', auth, admin, async (req, res) => {
  const { title, url } = req.body;
  const normalizedUrl = normalizeHttpUrl(url);

  if (!isText(title, { min: 1, max: 100 }) || !normalizedUrl) {
    return res.status(400).json({ error: '链接名称或地址无效' });
  }

  try {
    const r = await pool.query(
      `INSERT INTO friendly_links (title, url)
       VALUES ($1, $2)
       RETURNING *`,
      [title.trim(), normalizedUrl]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '添加失败，请稍后重试' });
  }
});

// 删除友情链接（管理员）
app.delete('/api/links/:id', validateUuidId, auth, admin, async (req, res) => {
  try {
    await pool.query('DELETE FROM friendly_links WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败，请稍后重试' });
  }
});

// ============================================================
//  统计数据
// ============================================================

app.get('/api/stats', async (req, res) => {
  try {
    const [postsRes, usersRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM posts'),
      pool.query('SELECT COUNT(*) FROM users'),
    ]);
    res.json({
      posts: parseInt(postsRes.rows[0].count) || 0,
      users: parseInt(usersRes.rows[0].count) || 0,
      topics: parseInt(postsRes.rows[0].count) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
//  事件日志（支持分页）
// ============================================================

// 获取事件日志（管理员）—— 支持分页
app.get('/api/event-logs', auth, admin, async (req, res) => {
  try {
    const pagination = parsePagination(req.query);
    if (!pagination) return res.status(400).json({ error: '分页参数无效' });
    const { page, limit, offset } = pagination;

    // 查询总数
    const countResult = await pool.query('SELECT COUNT(*) FROM event_logs');
    const total = parseInt(countResult.rows[0].count);

    const r = await pool.query(
      `SELECT el.*, u.username
       FROM event_logs el
       LEFT JOIN users u ON el.user_id = u.id
       ORDER BY el.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      data: r.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});



// ============================================================
//  图片上传
// ============================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: '.jpg', mime: 'image/jpeg' };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: '.png', mime: 'image/png' };
  }
  const header = buffer.subarray(0, 6).toString('ascii');
  if (header === 'GIF87a' || header === 'GIF89a') {
    return { extension: '.gif', mime: 'image/gif' };
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { extension: '.webp', mime: 'image/webp' };
  }
  return null;
}

app.post('/api/upload', auth, upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择图片' });
  }

  const imageType = detectImageType(req.file.buffer);
  if (!imageType) {
    return res.status(400).json({ error: '仅支持有效的 JPG、PNG、GIF 或 WebP 图片' });
  }

  const filename = crypto.randomUUID() + imageType.extension;
  try {
    await fs.promises.writeFile(path.join(__dirname, 'uploads', filename), req.file.buffer, { flag: 'wx' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(201).json({
      url: '/uploads/' + filename,
      mime: imageType.mime,
      size: req.file.size,
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================================
//  自定义 CSS
// ============================================================

const CUSTOM_CSS_DIR = path.join(__dirname, 'uploads/custom');

// 确保目录存在
if (!fs.existsSync(CUSTOM_CSS_DIR)) fs.mkdirSync(CUSTOM_CSS_DIR, { recursive: true });

// 保存自定义 CSS（管理员）
const cssUpload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 256 * 1024, files: 1 },
});
app.post('/api/admin/custom-css', auth, admin, cssUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择文件' });
  }

  if (req.file.originalname !== 'style.css') {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: '文件名必须是 style.css' });
  }

  // 移动到最终位置
  const targetPath = path.join(CUSTOM_CSS_DIR, 'style.css');
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  fs.renameSync(req.file.path, targetPath);

  // 记录到设置表
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    ['custom_css_enabled', 'true']
  );

  res.json({ success: true });
});

// 获取自定义 CSS（公开）
app.get('/api/custom-css', async (req, res) => {
  const cssPath = path.join(CUSTOM_CSS_DIR, 'style.css');
  if (fs.existsSync(cssPath)) {
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(cssPath);
  } else {
    res.status(404).send('');
  }
});

// 删除自定义 CSS（管理员）
app.delete('/api/admin/custom-css', auth, admin, async (req, res) => {
  const cssPath = path.join(CUSTOM_CSS_DIR, 'style.css');
  if (fs.existsSync(cssPath)) {
    fs.unlinkSync(cssPath);
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['custom_css_enabled', 'false']
    );
  }
  res.json({ success: true });
});

// ============================================================
//  私信系统
// ============================================================

// 获取会话列表
app.get('/api/conversations', auth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        c.id,
        c.user1_id,
        c.user2_id,
        c.last_message_at,
        c.created_at,
        u.id as other_user_id,
        u.username as other_username,
        u.avatar_url as other_avatar_url,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_read = false) as unread_count,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      JOIN users u ON (u.id = c.user1_id OR u.id = c.user2_id) AND u.id != $1
      WHERE c.user1_id = $1 OR c.user2_id = $1
      ORDER BY c.last_message_at DESC
    `, [req.user.id]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取或创建会话
app.post('/api/conversations', auth, async (req, res) => {
  const { other_user_id } = req.body;
  if (!UUID_PATTERN.test(other_user_id || '')) {
    return res.status(400).json({ error: '对方用户ID无效' });
  }
  if (String(other_user_id).toLowerCase() === String(req.user.id).toLowerCase()) {
    return res.status(400).json({ error: '不能与自己私信' });
  }

  try {
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [other_user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const r = await pool.query(`
      INSERT INTO conversations (user1_id, user2_id)
      SELECT LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid)
      ON CONFLICT (user1_id, user2_id)
      DO UPDATE SET user1_id = EXCLUDED.user1_id
      RETURNING id
    `, [req.user.id, other_user_id]);

    res.json({ id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取会话消息
app.get('/api/conversations/:id/messages', validateUuidId, auth, async (req, res) => {
  const conversationId = req.params.id;

  try {
    const check = await pool.query(`
      SELECT id FROM conversations
      WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)
    `, [conversationId, req.user.id]);

    if (check.rows.length === 0) {
      return res.status(403).json({ error: '无权限访问此会话' });
    }

    const r = await pool.query(`
      SELECT
        m.*,
        u.username as sender_username,
        u.avatar_url as sender_avatar_url
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [conversationId]);

    await pool.query(`
      UPDATE messages SET is_read = true
      WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
    `, [conversationId, req.user.id]);

    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 发送消息
app.post('/api/conversations/:id/messages', validateUuidId, auth, async (req, res) => {
  const conversationId = req.params.id;
  const { content } = req.body;

  if (!isText(content, { min: 1, max: 10000 })) {
    return res.status(400).json({ error: '消息长度应为1到10000个字符' });
  }

  try {
    const check = await pool.query(`
      SELECT id FROM conversations
      WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)
    `, [conversationId, req.user.id]);

    if (check.rows.length === 0) {
      return res.status(403).json({ error: '无权限访问此会话' });
    }

    const r = await pool.query(`
      INSERT INTO messages (conversation_id, sender_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [conversationId, req.user.id, content.trim()]);

    await pool.query(`
      UPDATE conversations SET last_message_at = NOW()
      WHERE id = $1
    `, [conversationId]);

    const userInfo = await pool.query(`
      SELECT username, avatar_url FROM users WHERE id = $1
    `, [req.user.id]);

    res.json({
      ...r.rows[0],
      sender_username: userInfo.rows[0].username,
      sender_avatar_url: userInfo.rows[0].avatar_url
    });
  } catch (err) {
    res.status(500).json({ error: '发送失败，请稍后重试' });
  }
});

// 标记消息已读
app.put('/api/messages/:id/read', validateUuidId, auth, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE messages AS m SET is_read = true
      FROM conversations AS c
      WHERE m.id = $1
        AND m.sender_id != $2
        AND c.id = m.conversation_id
        AND (c.user1_id = $2 OR c.user2_id = $2)
      RETURNING m.id
    `, [req.params.id, req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '消息不存在或无权限' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
//  自定义页面
// ============================================================

// 获取所有自定义页面（公开，只返回启用且排序的）
app.get('/api/custom-pages', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, name, title FROM custom_pages WHERE enabled = true ORDER BY created_at'
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个自定义页面（公开）
app.get('/api/custom-pages/:name', async (req, res) => {
  if (!/^[a-zA-Z0-9\-_]{1,50}$/.test(req.params.name)) {
    return res.status(400).json({ error: '页面名称无效' });
  }
  try {
    const r = await pool.query(
      'SELECT id, name, title, content FROM custom_pages WHERE name = $1 AND enabled = true',
      [req.params.name]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: '页面不存在' });
    }
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取所有自定义页面（管理员，含禁用）
app.get('/api/admin/custom-pages', auth, admin, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, name, title, content, enabled, created_at, updated_at FROM custom_pages ORDER BY created_at'
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建自定义页面（管理员）
app.post('/api/admin/custom-pages', auth, admin, async (req, res) => {
  const { name, title, content } = req.body;
  if (!/^[a-zA-Z0-9\-_]{1,50}$/.test(name || '') ||
      !isText(title, { min: 1, max: 100 }) ||
      !isText(content, { min: 1, max: 100000 })) {
    return res.status(400).json({ error: '页面名称、标题或内容长度无效' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO custom_pages (name, title, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, title.trim(), content]
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: '页面名称已存在' });
    } else {
      res.status(500).json({ error: '创建失败，请稍后重试' });
    }
  }
});

// 更新自定义页面（管理员）
app.put('/api/admin/custom-pages/:id', validateUuidId, auth, admin, async (req, res) => {
  const { title, content, enabled } = req.body;
  const id = req.params.id;
  if (!isText(title, { min: 1, max: 100 }) ||
      !isText(content, { min: 1, max: 100000 }) ||
      typeof enabled !== 'boolean') {
    return res.status(400).json({ error: '页面标题、内容或状态无效' });
  }
  try {
    const r = await pool.query(
      `UPDATE custom_pages
       SET title = $1, content = $2, enabled = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [title.trim(), content, enabled, id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: '页面不存在' });
    }
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: '更新失败，请稍后重试' });
  }
});

// 删除自定义页面（管理员）
app.delete('/api/admin/custom-pages/:id', validateUuidId, auth, admin, async (req, res) => {
  try {
    await pool.query('DELETE FROM custom_pages WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '删除失败，请稍后重试' });
  }
});

// ============================================================
//  通知系统
// ============================================================

// 获取我的通知列表
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, type, title, content, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 标记通知已读
app.put('/api/notifications/:id/read', validateUuidId, auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 标记所有通知已读
app.put('/api/notifications/read-all', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// ============================================================
//  恢复码系统（密码重置）
// ============================================================

// 生成随机恢复码
function generateRecoveryCode() {
  return crypto.randomBytes(12)
    .toString('hex')
    .toUpperCase()
    .match(/.{1,6}/g)
    .join('-');
}

// 生成 10 个恢复码
app.post('/api/auth/recovery-codes/generate', auth, async (req, res) => {
  let client;
  try {
    const codes = Array.from({ length: 10 }, generateRecoveryCode);
    const codeHashes = await Promise.all(codes.map(code => bcrypt.hash(code, 10)));

    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM recovery_codes WHERE user_id = $1', [req.user.id]);
    await client.query(
      `INSERT INTO recovery_codes (user_id, code_hash)
       SELECT $1, code_hash FROM unnest($2::text[]) AS generated(code_hash)`,
      [req.user.id, codeHashes]
    );
    await client.query('COMMIT');

    res.json({ codes });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: '生成恢复码失败' });
  } finally {
    if (client) client.release();
  }
});

// 获取当前可用的恢复码数量
app.get('/api/auth/recovery-codes/count', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT COUNT(*) FROM recovery_codes WHERE user_id = $1 AND is_used = false',
      [req.user.id]
    );
    res.json({ count: parseInt(r.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 重置密码（使用恢复码）
// 通过邮箱发送密码重置码。与恢复码机制并行，管理员可按需启用。
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return res.status(400).json({ error: '请输入有效邮箱' });
  }

  try {
    const user = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalized]);

    // 无论邮箱是否存在都返回同样的成功响应，避免被用来枚举注册用户。
    if (user.rows.length === 0) {
      return res.json({ success: true, message: '如果该邮箱已注册，重置码已发送' });
    }

    const config = await requireMailConfig();
    const code = await createEmailVerification(normalized, 'reset');

    await mailer.sendMail(config, {
      to: normalized,
      subject: '密码重置验证码',
      text: `你的密码重置验证码是：${code}\n\n有效期 10 分钟。如果这不是你本人的操作，请忽略本邮件，你的密码不会发生变化。`,
      html: `<p>你的密码重置验证码是：</p>
             <p style="font-size:26px;font-weight:700;letter-spacing:4px;margin:12px 0;">${code}</p>
             <p style="color:#888;font-size:13px;">有效期 10 分钟。如果这不是你本人的操作，请忽略本邮件，你的密码不会发生变化。</p>`,
    });

    res.json({ success: true, message: '如果该邮箱已注册，重置码已发送' });
  } catch (err) {
    if (err.code === 'SMTP_NOT_CONFIGURED') {
      return res.status(503).json({ error: err.message });
    }
    console.error('发送密码重置码失败:', err);
    res.status(400).json({ error: mailer.describeSmtpError(err) });
  }
});

// 使用邮箱验证码重置密码
app.post('/api/auth/reset-password-by-email', async (req, res) => {
  const { email, code, newPassword } = req.body;
  const normalized = normalizeEmail(email);

  if (!normalized || !isText(code, { min: 4, max: 10 }) || !isText(newPassword, { min: 6, max: 128 })) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  try {
    const failure = await consumeEmailVerification(normalized, 'reset', code.trim());
    if (failure) {
      return res.status(400).json({ error: EMAIL_CODE_ERRORS[failure] || '验证码校验失败' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    // 递增 token_version 让所有已签发的登录令牌立即失效
    const updated = await pool.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1
       WHERE LOWER(email) = LOWER($2)
       RETURNING id`,
      [hash, normalized]
    );

    if (updated.rows.length === 0) {
      return res.status(400).json({ error: '账号不存在' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('通过邮箱重置密码失败:', err);
    res.status(500).json({ error: '重置失败，请稍后重试' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, recoveryCode, newPassword } = req.body;

  if (!normalizeLegacyEmail(email) || !isText(recoveryCode, { min: 1, max: 64 }) ||
      !isText(newPassword, { min: 6, max: 128 })) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const user = await findUserByEmail(client, email, 'id');
    if (!user) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '恢复码无效或已使用' });
    }

    const codes = await client.query(
      'SELECT id, code_hash FROM recovery_codes WHERE user_id = $1 AND is_used = false FOR UPDATE',
      [user.id]
    );
    if (codes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '恢复码无效或已使用' });
    }

    let matched = false;
    let matchedId = null;

    for (const row of codes.rows) {
      const valid = await bcrypt.compare(recoveryCode, row.code_hash);
      if (valid) {
        matched = true;
        matchedId = row.id;
        break;
      }
    }

    if (!matched) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '恢复码无效或已使用' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await client.query(
      'UPDATE recovery_codes SET is_used = true WHERE id = $1 AND is_used = false',
      [matchedId]
    );
    await client.query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2',
      [hash, user.id]
    );
    await client.query('COMMIT');

    res.json({ success: true });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: '重置失败，请稍后重试' });
  } finally {
    if (client) client.release();
  }
});

// ============================================================
//  托管公开前端文件
// ============================================================

app.get('/health/live', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not_ready' });
  }
});

app.use('/js', express.static(path.join(__dirname, 'js'), {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
}));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/config.js', (req, res) => res.sendFile(path.join(__dirname, 'config.js')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: '接口不存在' });
  }
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  return res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: '上传文件超过限制或格式无效' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: '请求内容过大' });
  }
  if (err.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ error: '不允许的跨域来源' });
  }
  console.error(err);
  return res.status(500).json({ error: '服务器错误' });
});

// ============================================================
//  启动服务器
// ============================================================


let server = null;
let shuttingDown = false;

function startServer() {
  if (server) return server;

  server = app.listen(PORT, '0.0.0.0', () => {

    console.log('========================================');
    console.log('  🌊 Forumlify 已启动');
    console.log('  📡 http://localhost:' + PORT);
    console.log('  📡 API: http://localhost:' + PORT + '/api');
    console.log('========================================');
  });

  return server;
}

function shutdown(signal, { exitProcess = true } = {}) {
  if (shuttingDown) return Promise.resolve();
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully`);

  return new Promise((resolve, reject) => {
    const forceExit = exitProcess
      ? setTimeout(() => process.exit(1), 10000)
      : null;
    if (forceExit) forceExit.unref();

    const finish = async error => {
      try {
        await pool.end();
        if (error) throw error;
        resolve();
      } catch (shutdownError) {
        reject(shutdownError);
      } finally {
        if (forceExit) clearTimeout(forceExit);
        server = null;
        shuttingDown = false;
      }
    };

    if (server) server.close(finish);
    else finish();
  }).finally(() => {
    if (exitProcess) process.exitCode = 0;
  });
}

if (require.main === module) {
  startServer();
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch(error => {
      console.error('Graceful shutdown failed:', error);
      process.exitCode = 1;
    });
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT').catch(error => {
      console.error('Graceful shutdown failed:', error);
      process.exitCode = 1;
    });
  });
}

module.exports = { app, pool, startServer, shutdown };
