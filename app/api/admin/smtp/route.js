import pool from '@/lib/db';
import { getUser, requireAdmin } from '@/lib/auth';
import { loadSmtpConfig, isConfigComplete } from '@/lib/mailer';
import { normalizeEmail } from '@/lib/email-verification';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const forbidden = await requireAdmin(getUser(req));
  if (forbidden) return forbidden;
  try {
    const config = await loadSmtpConfig();
    return Response.json({
      enabled: config.enabled,
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      from_name: config.fromName,
      from_email: config.fromEmail,
      allow_self_signed: config.allowSelfSigned,
      password_set: Boolean(config.password),
      configured: isConfigComplete(config),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(req) {
  const forbidden = await requireAdmin(getUser(req));
  if (forbidden) return forbidden;
  const body = await req.json().catch(() => ({}));
  const port = Number(body.port);
  const host = typeof body.host === 'string' ? body.host.trim() : '';
  const user = typeof body.user === 'string' ? body.user.trim() : '';
  const fromName = typeof body.from_name === 'string' ? body.from_name.trim() : '';
  const fromEmail = typeof body.from_email === 'string' ? body.from_email.trim() : '';
  if (typeof body.enabled !== 'boolean' || typeof body.secure !== 'boolean' ||
      !Number.isInteger(port) || port < 1 || port > 65535 ||
      host.length > 255 || user.length > 255 || fromName.length > 100 ||
      (fromEmail && !normalizeEmail(fromEmail)) ||
      (body.password !== undefined && (typeof body.password !== 'string' || body.password.length > 255))) {
    return Response.json({ error: 'SMTP 配置无效' }, { status: 400 });
  }
  const previous = await loadSmtpConfig();
  if (body.enabled && (!host || !fromEmail || (user && !body.password && !previous.password))) {
    return Response.json({ error: '启用 SMTP 前请填写服务器、发件邮箱和认证信息' }, { status: 400 });
  }
  const entries = [
    ['smtp_enabled', String(body.enabled)], ['smtp_host', host], ['smtp_port', String(port)],
    ['smtp_secure', String(body.secure)], ['smtp_user', user], ['smtp_from_name', fromName],
    ['smtp_from_email', fromEmail], ['smtp_allow_self_signed', String(body.allow_self_signed === true)],
  ];
  if (body.password) entries.push(['smtp_password', body.password]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of entries) {
      await client.query(`INSERT INTO settings (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key, value]);
    }
    if (!body.enabled) {
      await client.query(`INSERT INTO settings (key, value) VALUES ('email_verify_required', 'false')
        ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = now()`);
    }
    await client.query('COMMIT');
    return Response.json({ success: true });
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    return Response.json({ error: '保存失败，请稍后重试' }, { status: 500 });
  } finally {
    client.release();
  }
}
