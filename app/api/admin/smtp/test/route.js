import pool from '@/lib/db';
import { getUser, requireAdmin } from '@/lib/auth';
import { loadSmtpConfig, isConfigComplete, sendMail, describeSmtpError } from '@/lib/mailer';
import { normalizeEmail } from '@/lib/email-verification';

export async function POST(req) {
  const user = getUser(req);
  const forbidden = await requireAdmin(user);
  if (forbidden) return forbidden;
  const body = await req.json().catch(() => ({}));
  if (body.to && !normalizeEmail(body.to)) return Response.json({ error: '收件人邮箱格式无效' }, { status: 400 });
  try {
    const config = await loadSmtpConfig();
    if (!isConfigComplete(config)) return Response.json({ error: 'SMTP 尚未配置完成' }, { status: 400 });
    const me = await pool.query('SELECT email FROM users WHERE id = $1', [user.id]);
    const to = body.to ? normalizeEmail(body.to) : me.rows[0]?.email;
    if (!to) return Response.json({ error: '请指定收件人邮箱' }, { status: 400 });
    await sendMail(config, {
      to,
      subject: 'Forumlify SMTP 测试邮件',
      text: `这是一封来自 Forumlify 的测试邮件。\n\n发送时间：${new Date().toISOString()}`,
    });
    return Response.json({ success: true, to });
  } catch (error) {
    return Response.json({ error: describeSmtpError(error) }, { status: 400 });
  }
}
