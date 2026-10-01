import pool from '@/lib/db';
import { loadSmtpConfig, isConfigComplete, sendMail, describeSmtpError } from '@/lib/mailer';
import { normalizeEmail, isEmailVerificationRequired, saveEmailCode, invalidateEmailCode } from '@/lib/email-verification';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: '请输入有效邮箱' }, { status: 400 });
  try {
    if (!await isEmailVerificationRequired()) {
      return Response.json({ error: '本站未开启邮箱验证' }, { status: 400 });
    }
    const config = await loadSmtpConfig();
    if (!isConfigComplete(config)) return Response.json({ error: '站点尚未配置邮件服务' }, { status: 503 });
    const existing = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.rowCount) return Response.json({ error: '该邮箱已被注册' }, { status: 409 });
    const code = await saveEmailCode(email, 'register');
    if (!code) return Response.json({ error: '请 60 秒后再获取验证码' }, { status: 429 });
    try {
      await sendMail(config, {
        to: email,
        subject: 'Forumlify 注册验证码',
        text: `你的注册验证码是：${code}\n\n有效期 10 分钟，请勿转发给他人。`,
      });
    } catch (error) {
      await invalidateEmailCode(email, 'register');
      throw error;
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: describeSmtpError(error) }, { status: 400 });
  }
}
