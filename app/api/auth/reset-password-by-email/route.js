import bcrypt from 'bcryptjs';
import { normalizeEmail, withEmailCode, CODE_ERRORS } from '@/lib/email-verification';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email || !/^\d{6}$/.test(body.code || '') ||
      typeof body.newPassword !== 'string' || body.newPassword.length < 6 || body.newPassword.length > 128) {
    return Response.json({ error: '请填写有效的邮箱、验证码和新密码' }, { status: 400 });
  }
  try {
    const hash = await bcrypt.hash(body.newPassword, 10);
    const result = await withEmailCode(email, 'reset', body.code, async (client) => {
      const updated = await client.query('UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2 RETURNING id', [hash, email]);
      if (!updated.rowCount) throw new Error('账号不存在');
      return updated.rows[0];
    });
    if (result.failure) return Response.json({ error: CODE_ERRORS[result.failure] }, { status: 400 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: '重置失败，请稍后重试' }, { status: 500 });
  }
}
