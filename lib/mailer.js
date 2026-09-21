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
  'smtp_allow_self_signed',
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
    allowSelfSigned: raw.smtp_allow_self_signed === 'true',
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
    // 默认严格校验服务器证书。Resend、QQ、Gmail 等正规服务商都使用
    // 可信证书，关掉校验只会削弱安全性、让中间人有机可乘。
    // 自建 SMTP 若用自签证书，可在后台把「允许自签证书」打开。
    tls: { rejectUnauthorized: !config.allowSelfSigned },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  };

  if (config.user) {
    options.auth = {
      user: config.user,
      // 部分服务商要求使用授权码或 API Key 而非登录密码：
      // QQ/163 用授权码，Resend 用 re_ 开头的 API Key
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

// 把底层异常转成便于管理员理解的中文提示。
// 这里的每一条都对应实际会遇到的配置错误，措辞尽量指明「该去改哪里」，
// 而不是笼统地说「发送失败」。
function describeSmtpError(error) {
  const code = error && error.code;
  const message = (error && error.message) || '';

  // 连接超时既可能是防火墙，也可能是端口与加密方式不匹配：
  // 例如 465 只接受隐式 SSL，若按 STARTTLS 去连，服务器不会回应握手。
  // 两种原因都给出来，避免排查方向被带偏。
  if (code === 'ETIMEDOUT' || /timeout/i.test(message)) {
    return '连接超时：请检查端口是否被防火墙拦截，并确认加密方式与端口匹配（465 用 SSL/TLS，587 用 STARTTLS）';
  }

  const map = {
    EAUTH: '认证失败：请检查用户名与密码。QQ、163 等邮箱需填写「授权码」；Resend 的用户名固定为 resend、密码填写 re_ 开头的 API Key',
    ECONNECTION: '无法连接到邮件服务器：请检查服务器地址与端口是否正确',
    ESOCKET: '套接字错误：端口与加密方式不匹配（465 需选 SSL/TLS，587 选 STARTTLS），也可能是证书校验未通过',
    EENVELOPE: '发件人或收件人地址被拒绝：请确认发件人邮箱属于已在邮件服务商处验证过的域名',
    EDNS: '域名解析失败：请检查 SMTP 服务器地址是否拼写正确',
    DEPTH_ZERO_SELF_SIGNED_CERT: '证书校验失败：服务器使用了自签证书。若这是你自己的邮件服务器，可打开「允许自签证书」',
    SELF_SIGNED_CERT_IN_CHAIN: '证书校验失败：服务器使用了自签证书。若这是你自己的邮件服务器，可打开「允许自签证书」',
  };
  if (code && map[code]) return map[code];

  // 部分证书错误不带 code，只体现在 message 里
  if (/self.signed certificate/i.test(message)) {
    return '证书校验失败：服务器使用了自签证书。若这是你自己的邮件服务器，可打开「允许自签证书」';
  }

  return message || '发送失败';
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
