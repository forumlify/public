import pool from '@/lib/db';
import { getUser, requireAdmin } from '@/lib/auth';
import { loadSmtpConfig, isConfigComplete } from '@/lib/mailer';

export async function PUT(req) {
  const forbidden = await requireAdmin(getUser(req));
  if (forbidden) return forbidden;
  const body = await req.json().catch(() => ({}));
  if (typeof body.required !== 'boolean') return Response.json({ error: '参数无效' }, { status: 400 });
  try {
    if (body.required && !isConfigComplete(await loadSmtpConfig())) {
      return Response.json({ error: '请先完成 SMTP 配置' }, { status: 400 });
    }
    await pool.query(`INSERT INTO settings (key, value) VALUES ('email_verify_required', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [String(body.required)]);
    return Response.json({ success: true, email_verify_required: body.required });
  } catch {
    return Response.json({ error: '保存失败，请稍后重试' }, { status: 500 });
  }
}
