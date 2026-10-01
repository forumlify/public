import nodemailer from 'nodemailer';
import pool from './db';

const KEYS = [
  'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user',
  'smtp_password', 'smtp_from_name', 'smtp_from_email', 'smtp_allow_self_signed',
];

export async function loadSmtpConfig() {
  const result = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1::text[])', [KEYS]);
  const raw = Object.fromEntries(result.rows.map(({ key, value }) => [key, value]));
  return {
    enabled: raw.smtp_enabled === 'true',
    host: raw.smtp_host || '',
    port: Number(raw.smtp_port || 587),
    secure: raw.smtp_secure === 'true',
    user: raw.smtp_user || '',
    password: raw.smtp_password || '',
    fromName: raw.smtp_from_name || '',
    fromEmail: raw.smtp_from_email || '',
    allowSelfSigned: raw.smtp_allow_self_signed === 'true',
  };
}

export function isConfigComplete(config) {
  return Boolean(config.enabled && config.host && config.port >= 1 && config.port <= 65535 &&
    config.fromEmail && (!config.user || config.password));
}

export async function sendMail(config, { to, subject, text }) {
  if (!isConfigComplete(config)) throw new Error('站点尚未配置邮件服务，请联系管理员');
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    tls: { rejectUnauthorized: !config.allowSelfSigned },
    ...(config.user ? { auth: { user: config.user, pass: config.password } } : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  try {
    return await transport.sendMail({
      from: config.fromName
        ? `"${config.fromName.replace(/["\r\n]/g, '')}" <${config.fromEmail}>`
        : config.fromEmail,
      to,
      subject,
      text,
    });
  } finally {
    transport.close();
  }
}

export function describeSmtpError(error) {
  if (error?.code === 'EAUTH') return '认证失败，请检查 SMTP 用户名、授权码或 API Key';
  if (error?.code === 'ETIMEDOUT') return '连接超时，请检查 SMTP 地址、端口及防火墙';
  if (error?.code === 'ESOCKET') return '连接失败，请检查端口与 TLS 设置';
  if (/self.signed certificate/i.test(error?.message || '')) return '证书校验失败；自建邮件服务器可在后台允许自签证书';
  return error?.message || '邮件发送失败';
}
