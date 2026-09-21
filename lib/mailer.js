// ============================================================
//  邮件发送
// ------------------------------------------------------------
//  SMTP 配置存在 settings 表中（key 前缀 smtp_），由管理员在后台
//  填写，因此无需重启服务即可生效。这里按需构建 transporter 并做
//  短时缓存，避免每次发信都重新握手。
//
//  安全约定：
//  - 密码只写不读，任何接口都不会回显明文
//  - 配置校验失败时给出可读的错误，而不是抛出底层异常
// ============================================================

const nodemailer = require('nodemailer');

// 缓存 transporter：配置变更时通过 invalidateTransport() 失效
let cachedTransport = null;
let cachedSignature = null;

const SMTP_KEYS = [
  'smtp_enabled',
  'smtp_host',
  'smtp_port',
  'smtp_secure',
  'smtp_user',
  'smtp_password',
  'smtp_from_name',
  'smtp_from_email',
];

function invalidateTransport() {
  if (cachedTransport && typeof cachedTransport.close === 'function') {
    try { cachedTransport.close(); } catch { /* 忽略关闭异常 */ }
  }
  cachedTransport = null;
  cachedSignature = null;
}

// 从 settings 表读取 SMTP 配置并整理成对象
async function loadSmtpConfig(pool) {
  const r = await pool.query(
    'SELECT key, value FROM settings WHERE key = ANY($1::text[])',
    [SMTP_KEYS]
  );
  const raw = {};
  r.rows.forEach(row => { raw[row.key] = row.value; });

  return {
    enabled: raw.smtp_enabled === 'true',
    host: raw.smtp_host || '',
    port: Number(raw.smtp_port || 587),
    // secure=true 指 465 端口的隐式 TLS；587 用 STARTTLS
    secure: raw.smtp_secure === 'true',
    user: raw.smtp_user || '',
    password: raw.smtp_password || '',
    fromName: raw.smtp_from_name || '',
    fromEmail: raw.smtp_from_email || '',
  };
}

// 判断配置是否足以发信
function isConfigComplete(config) {
  return Boolean(
    config.enabled &&
    config.host &&
    config.port > 0 && config.port <= 65535 &&
    config.fromEmail
  );
}

function buildTransport(config) {
  const options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    // 自签证书在小型部署中常见，这里不做严格校验以免误伤；
    // 如需强制校验可在此处改为 false 并配置 ca。
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  };

  if (config.user) {
    options.auth = {
      user: config.user,
      // 部分服务商（如 QQ 邮箱、Gmail）要求使用授权码而非登录密码
      pass: config.password,
    };
  }

  return nodemailer.createTransport(options);
}

function getTransport(config) {
  // 以 host/port/secure/user/password 作为缓存签名
  const signature = [config.host, config.port, config.secure, config.user, config.password].join('|');
  if (cachedTransport && cachedSignature === signature) return cachedTransport;

  invalidateTransport();
  cachedTransport = buildTransport(config);
  cachedSignature = signature;
  return cachedTransport;
}

function formatFrom(config) {
  return config.fromName
    ? `"${config.fromName.replace(/"/g, '')}" <${config.fromEmail}>`
    : config.fromEmail;
}

// 发送一封邮件。调用方需先把配置读出来传入。
async function sendMail(config, { to, subject, text, html }) {
  if (!isConfigComplete(config)) {
    const error = new Error('SMTP 尚未配置完成');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const transport = getTransport(config);
  return transport.sendMail({
    from: formatFrom(config),
    to,
    subject,
    text,
    html,
  });
}

// 校验连通性：用于后台「发送测试邮件」按钮
async function verifyConnection(config) {
  if (!isConfigComplete(config)) {
    const error = new Error('SMTP 尚未配置完成');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  const transport = getTransport(config);
  await transport.verify();
  return true;
}

// 把底层异常转成便于管理员理解的中文提示
function describeSmtpError(error) {
  const code = error && error.code;
  const map = {
    EAUTH: '认证失败：请检查用户名与密码（部分邮箱需使用授权码而非登录密码）',
    ECONNECTION: '无法连接到邮件服务器：请检查主机地址与端口',
    ETIMEDOUT: '连接邮件服务器超时：请检查端口是否被防火墙拦截',
    ESOCKET: '套接字错误：多数情况下是端口或加密方式不匹配（465 需开启 SSL，587 用 STARTTLS）',
    EENVELOPE: '发件人或收件人地址被服务器拒绝',
    EDNS: '域名解析失败：请检查 SMTP 主机地址',
  };
  if (code && map[code]) return map[code];
  return (error && error.message) || '发送失败';
}

module.exports = {
  SMTP_KEYS,
  loadSmtpConfig,
  isConfigComplete,
  sendMail,
  verifyConnection,
  invalidateTransport,
  describeSmtpError,
};
