// GET /api/conversations, POST /api/conversations
import pool from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ensureUserBlocksSchema, hasBlocked, UUID_RE } from '@/lib/user-blocks';

// 避免 GET 被静态优化导致写方法 405（动态接口，不能缓存）
export const dynamic = 'force-dynamic';


export async function GET(req) {
  const user = getUser(req);
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 });
  }
  try {
    const r = await pool.query(`
      SELECT
        c.id,
        c.user1_id,
        c.user2_id,
        c.last_message_at,
        c.created_at,
        u.id as other_user_id,
        u.username as other_username,
        u.avatar_url as other_avatar_url,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND is_read = false) as unread_count,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      JOIN users u ON (u.id = c.user1_id OR u.id = c.user2_id) AND u.id != $1
      WHERE c.user1_id = $1 OR c.user2_id = $1
      ORDER BY c.last_message_at DESC
    `, [user.id]);
    return Response.json(r.rows);
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(req) {
  const user = getUser(req);
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 });
  }
  const { other_user_id } = await req.json();
  if (!UUID_RE.test(other_user_id || '')) {
    return Response.json({ error: '对方用户ID无效' }, { status: 400 });
  }
  if (other_user_id === user.id) {
    return Response.json({ error: '不能与自己私信' }, { status: 400 });
  }
  try {
    await ensureUserBlocksSchema();
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [other_user_id]);
    if (userCheck.rows.length === 0) {
      return Response.json({ error: '用户不存在' }, { status: 404 });
    }
    if (await hasBlocked(other_user_id, user.id) || await hasBlocked(user.id, other_user_id)) {
      return Response.json({ error: '无法向该用户发起私信' }, { status: 403 });
    }
    const existing = await pool.query(`
      SELECT id FROM conversations
      WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
    `, [user.id, other_user_id]);
    if (existing.rows.length > 0) {
      return Response.json({ id: existing.rows[0].id });
    }
    const r = await pool.query(`
      INSERT INTO conversations (user1_id, user2_id)
      VALUES (LEAST($1::uuid, $2::uuid), GREATEST($1::uuid, $2::uuid))
      ON CONFLICT (user1_id, user2_id)
      DO UPDATE SET user1_id = EXCLUDED.user1_id
      RETURNING id
    `, [user.id, other_user_id]);
    return Response.json({ id: r.rows[0].id });
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}
