import pool from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ensureUserBlocksSchema, UUID_RE } from '@/lib/user-blocks';

export async function GET(req, { params }) {
  const user = getUser(req);
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  const targetId = (await params).id;
  if (!UUID_RE.test(targetId)) return Response.json({ error: '用户不存在' }, { status: 404 });
  if (targetId === user.id) return Response.json({ blocked_by_me: false, blocked_me: false, self: true });
  try {
    await ensureUserBlocksSchema();
    const result = await pool.query(`
      SELECT
        EXISTS(SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2) AS blocked_by_me,
        EXISTS(SELECT 1 FROM user_blocks WHERE blocker_id = $2 AND blocked_id = $1) AS blocked_me
    `, [user.id, targetId]);
    return Response.json(result.rows[0], { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}
