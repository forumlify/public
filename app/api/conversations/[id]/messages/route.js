// GET /api/conversations/[id]/messages, POST /api/conversations/[id]/messages
import pool from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ensureUserBlocksSchema } from '@/lib/user-blocks';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req, { params }) {
  const user = getUser(req);
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 });
  }
  if (!UUID_RE.test((await params).id)) {
    return Response.json({ error: '无权限访问此会话' }, { status: 403 });
  }
  try {
    const check = await pool.query(`
      SELECT id FROM conversations
      WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)
    `, [(await params).id, user.id]);
    if (check.rows.length === 0) {
      return Response.json({ error: '无权限访问此会话' }, { status: 403 });
    }
    const r = await pool.query(`
      SELECT
        m.*,
        u.username as sender_username,
        u.avatar_url as sender_avatar_url
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [(await params).id]);
    await pool.query(`
      UPDATE messages SET is_read = true
      WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
    `, [(await params).id, user.id]);
    return Response.json(r.rows);
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const user = getUser(req);
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 });
  }
  if (!UUID_RE.test((await params).id)) {
    return Response.json({ error: '无权限访问此会话' }, { status: 403 });
  }
  const { content } = await req.json();
  if (typeof content !== 'string' || !content.trim() || content.length > 10000) {
    return Response.json({ error: '消息长度应为1到10000个字符' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    await ensureUserBlocksSchema();
    await client.query('BEGIN');
    const check = await client.query(`
      SELECT id, user1_id, user2_id FROM conversations
      WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)
      FOR UPDATE
    `, [(await params).id, user.id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return Response.json({ error: '无权限访问此会话' }, { status: 403 });
    }
    const conversation = check.rows[0];
    const otherId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;
    const blocked = await client.query(`
      SELECT 1 FROM user_blocks
      WHERE (blocker_id = $1 AND blocked_id = $2)
         OR (blocker_id = $2 AND blocked_id = $1)
      LIMIT 1
    `, [otherId, user.id]);
    if (blocked.rowCount) {
      await client.query('ROLLBACK');
      return Response.json({ error: '无法向该用户发送消息' }, { status: 403 });
    }
    const stats = await client.query(`
      SELECT COUNT(*) FILTER (WHERE sender_id = $2) AS mine,
             COUNT(*) FILTER (WHERE sender_id = $3) AS theirs
      FROM messages WHERE conversation_id = $1
    `, [(await params).id, user.id, otherId]);
    if (Number(stats.rows[0].theirs) === 0 && Number(stats.rows[0].mine) >= 3) {
      await client.query('ROLLBACK');
      return Response.json({ error: '对方回复前最多发送 3 条消息，请等待对方回复', limit_reached: true, limit: 3 }, { status: 429 });
    }
    const r = await client.query(`
      INSERT INTO messages (conversation_id, sender_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [(await params).id, user.id, content.trim()]);
    await client.query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [(await params).id]);
    const userInfo = await client.query('SELECT username, avatar_url FROM users WHERE id = $1', [user.id]);
    await client.query('COMMIT');
    return Response.json({
      ...r.rows[0],
      sender_username: userInfo.rows[0].username,
      sender_avatar_url: userInfo.rows[0].avatar_url,
    });
  } catch {
    await client.query('ROLLBACK').catch(() => {});
    return Response.json({ error: '发送失败，请稍后重试' }, { status: 500 });
  } finally {
    client.release();
  }
}
