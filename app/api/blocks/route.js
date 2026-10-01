import pool from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ensureUserBlocksSchema } from '@/lib/user-blocks';

export async function GET(req) {
  const user = getUser(req);
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  try {
    await ensureUserBlocksSchema();
    const result = await pool.query(`
      SELECT u.id, u.username, u.avatar_url, b.created_at
      FROM user_blocks b JOIN users u ON u.id = b.blocked_id
      WHERE b.blocker_id = $1 ORDER BY b.created_at DESC
    `, [user.id]);
    return Response.json({ data: result.rows }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}
