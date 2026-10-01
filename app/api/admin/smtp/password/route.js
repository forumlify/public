import pool from '@/lib/db';
import { getUser, requireAdmin } from '@/lib/auth';

export async function DELETE(req) {
  const forbidden = await requireAdmin(getUser(req));
  if (forbidden) return forbidden;
  try {
    await pool.query(`INSERT INTO settings (key, value) VALUES ('smtp_password', '')
      ON CONFLICT (key) DO UPDATE SET value = '', updated_at = now()`);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: '清除失败，请稍后重试' }, { status: 500 });
  }
}
