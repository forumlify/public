// POST /api/auth/register
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { verifyCaptcha } from '@/lib/captcha';
import { logAudit } from '@/lib/audit';
import { normalizeEmail, isEmailVerificationRequired, withEmailCode, CODE_ERRORS, ensureEmailVerificationSchema } from '@/lib/email-verification';

export async function POST(req) {
  const { email, password, username, email_code, captcha_id, captcha_answer, captcha_sig } = await req.json();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password || !username) {
    return Response.json({ error: '请填写完整信息' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 128 ||
      typeof username !== 'string' || !username.trim() || username.length > 50) {
    return Response.json({ error: '用户名或密码长度无效' }, { status: 400 });
  }
  // 服务端验证码校验（ENABLE_CAPTCHA 关闭时跳过）
  if (process.env.ENABLE_CAPTCHA !== 'false' && !verifyCaptcha(captcha_id, captcha_answer, captcha_sig)) {
    return Response.json({ error: '验证码错误，请重新计算' }, { status: 400 });
  }
  try {
    const verificationRequired = await isEmailVerificationRequired();
    if (verificationRequired && !/^\d{6}$/.test(email_code || '')) {
      return Response.json({ error: '请输入邮箱验证码' }, { status: 400 });
    }
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const isFirstUser = parseInt(countResult.rows[0].count) === 0;

    const hash = await bcrypt.hash(password, 10);
    const avatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(username) + '&background=6366f1&color=fff&size=64';
    const role = isFirstUser ? 'admin' : 'user';

    const insert = (client) => client.query(
      `INSERT INTO users (email, password_hash, username, avatar_url, role, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, avatar_url, role, created_at`,
      [normalizedEmail, hash, username.trim(), avatar, role, verificationRequired]
    );
    let r;
    if (verificationRequired) {
      const result = await withEmailCode(normalizedEmail, 'register', email_code, insert);
      if (result.failure) return Response.json({ error: CODE_ERRORS[result.failure] }, { status: 400 });
      r = result.value;
    } else {
      await ensureEmailVerificationSchema();
      r = await insert(pool);
    }

    // 服务端审计：注册成功
    await logAudit(req, 'register', r.rows[0].id);
    return Response.json({
      user: r.rows[0],
      message: isFirstUser ? '你是第一个用户，已自动设为管理员！' : '注册成功',
    });
  } catch (err) {
    if (err.code === '23505') {
      return Response.json({ error: '邮箱或用户名已被注册' }, { status: 400 });
    }
    return Response.json({ error: '注册失败，请稍后重试' }, { status: 500 });
  }
}
