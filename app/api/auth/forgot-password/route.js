import pool from '@/lib/db';
import { loadSmtpConfig, isConfigComplete, sendMail, describeSmtpError } from '@/lib/mailer';
import { normalizeEmail, saveEmailCode, invalidateEmailCode } from '@/lib/email-verification';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: '请输入有效邮箱' }, { status: 400 });
  try {
    const config = await loadSmtpConfig();
    if (!isConfigComplete(config)) return Response.json({ error: '站点尚未配置邮件服务' }, { status: 503 });
    const user = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (user.rowCount) {
      const code = await saveEmailCode(email, 'reset');
      if (!code) return Response.json({ error: '请 60 秒后再获取验证码' }, { status: 429 });
      try {
        await sendMail(config, {
          to: email,
          subject: 'Forumlify 密码重置验证码',
          text: `你的密码重置验证码是：${code}\n\n有效期 10 分钟。如果这不是你本人的操作，请忽略本邮件。`,
        });
      } catch (error) {
        await invalidateEmailCode(email, 'reset');
        throw error;
      }
    }
    return Response.json({ success: true, message: '如果该邮箱已注册，重置码已发送' });
  } catch (error) {
    return Response.json({ error: describeSmtpError(error) }, { status: 400 });
  }
}
