import pool from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ensureUserBlocksSchema, UUID_RE } from '@/lib/user-blocks';

export async function POST(req, { params }) {
  const user = getUser(req);
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  const targetId = (await params).id;
  if (!UUID_RE.test(targetId) || targetId === user.id) {
    return Response.json({ error: '不能屏蔽该用户' }, { status: 400 });
  }
  try {
    await ensureUserBlocksSchema();
    const result = await pool.query(`
      INSERT INTO user_blocks (blocker_id, blocked_id)
      SELECT $1, id FROM users WHERE id = $2
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING RETURNING id
    `, [user.id, targetId]);
    if (!result.rowCount) {
      const target = await pool.query('SELECT id FROM users WHERE id = $1', [targetId]);
      if (!target.rowCount) return Response.json({ error: '用户不存在' }, { status: 404 });
    }
    return Response.json({ success: true, blocked: true });
  } catch {
    return Response.json({ error: '操作失败，请稍后重试' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const user = getUser(req);
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  const targetId = (await params).id;
  if (!UUID_RE.test(targetId)) return Response.json({ error: '用户不存在' }, { status: 404 });
  try {
    await ensureUserBlocksSchema();
    await pool.query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [user.id, targetId]);
    return Response.json({ success: true, blocked: false });
  } catch {
    return Response.json({ error: '操作失败，请稍后重试' }, { status: 500 });
  }
}
