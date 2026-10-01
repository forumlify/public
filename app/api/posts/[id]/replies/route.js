// GET /api/posts/[id]/replies, POST /api/posts/[id]/replies
import pool from '@/lib/db';
import { getUser } from '@/lib/auth';
import { jsonWithEtag } from '@/lib/http-cache';
import { verifyCaptcha } from '@/lib/captcha';
import { logAudit } from '@/lib/audit';
import { getReplySchemaCapabilities } from '@/lib/reply-schema';
import { resolvePostReference } from '@/lib/post-reference';
import { ensureUserBlocksSchema } from '@/lib/user-blocks';

function repliesSelectSql(capabilities, viewer) {
  const visible = viewer ? ` AND NOT EXISTS (
    SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = r.user_id
  )` : '';
  if (capabilities.replyToId) {
    return `SELECT r.id, r.post_id, r.user_id, r.content, r.created_at,
                   r.reply_to_id, u.username, u.avatar_url,
                   ru.username AS reply_to_username
            FROM replies r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN replies rt ON r.reply_to_id = rt.id
            LEFT JOIN users ru ON rt.user_id = ru.id
            WHERE r.post_id = $1${visible}
            ORDER BY r.created_at ASC`;
  }

  if (capabilities.replyToUsername) {
    return `SELECT r.id, r.post_id, r.user_id, r.content, r.created_at,
                   NULL::uuid AS reply_to_id,
                   u.username, u.avatar_url,
                   r.reply_to_username
            FROM replies r
            JOIN users u ON r.user_id = u.id
            WHERE r.post_id = $1${visible}
            ORDER BY r.created_at ASC`;
  }

  return `SELECT r.id, r.post_id, r.user_id, r.content, r.created_at,
                 NULL::uuid AS reply_to_id,
                 NULL::varchar AS reply_to_username,
                 u.username, u.avatar_url
          FROM replies r
          JOIN users u ON r.user_id = u.id
          WHERE r.post_id = $1${visible}
          ORDER BY r.created_at ASC`;
}

export async function GET(req, { params }) {
  try {
    const reference = await resolvePostReference((await params).id);
    if (!reference) return Response.json({ error: '帖子不存在' }, { status: 404 });
    const viewer = getUser(req);
    if (viewer) await ensureUserBlocksSchema();
    const capabilities = await getReplySchemaCapabilities();
    const r = await pool.query(repliesSelectSql(capabilities, viewer), viewer ? [reference.id, viewer.id] : [reference.id]);
    return viewer
      ? Response.json(r.rows, { headers: { 'Cache-Control': 'private, no-store' } })
      : jsonWithEtag(req, r.rows);
  } catch (error) {
    console.error('[replies] list failed:', error?.code || error?.message);
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const user = getUser(req);
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 });
  }
  const { content, captcha_id, captcha_answer, captcha_sig, reply_to_id, reply_to_username } = await req.json();
  if (!content || content.trim().length === 0) {
    return Response.json({ error: '请填写回复内容' }, { status: 400 });
  }
  // 服务端验证码校验（ENABLE_CAPTCHA 关闭时跳过）
  if (process.env.ENABLE_CAPTCHA !== 'false' && !verifyCaptcha(captcha_id, captcha_answer, captcha_sig)) {
    return Response.json({ error: '验证码错误，请重新计算' }, { status: 400 });
  }
  try {
    const reference = await resolvePostReference((await params).id);
    if (!reference) return Response.json({ error: '帖子不存在' }, { status: 404 });
    const postId = reference.id;
    const capabilities = await getReplySchemaCapabilities();
    let replyTargetUsername = null;

    if (reply_to_id) {
      const target = await pool.query(
        `SELECT u.username
         FROM replies r
         JOIN users u ON u.id = r.user_id
         WHERE r.id = $1 AND r.post_id = $2`,
        [reply_to_id, postId]
      );
      if (!target.rows[0]) {
        return Response.json({ error: '回复目标不存在' }, { status: 400 });
      }
      replyTargetUsername = target.rows[0].username;
    } else if (reply_to_username && capabilities.replyToUsername) {
      const target = await pool.query(
        `SELECT u.username
         FROM replies r
         JOIN users u ON u.id = r.user_id
         WHERE r.post_id = $1 AND u.username = $2
         LIMIT 1`,
        [postId, reply_to_username]
      );
      if (!target.rows[0]) {
        return Response.json({ error: '回复目标不存在' }, { status: 400 });
      }
      replyTargetUsername = target.rows[0].username;
    }

    let r;
    if (capabilities.replyToId) {
      r = await pool.query(
        `INSERT INTO replies (post_id, user_id, content, reply_to_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [postId, user.id, content.trim(), reply_to_id || null]
      );
    } else if (capabilities.replyToUsername) {
      r = await pool.query(
        `INSERT INTO replies (post_id, user_id, content, reply_to_username)
         VALUES ($1, $2, $3, $4)
         RETURNING *, NULL::uuid AS reply_to_id`,
        [postId, user.id, content.trim(), replyTargetUsername]
      );
    } else {
      r = await pool.query(
        `INSERT INTO replies (post_id, user_id, content)
         VALUES ($1, $2, $3)
         RETURNING *, NULL::uuid AS reply_to_id, NULL::varchar AS reply_to_username`,
        [postId, user.id, content.trim()]
      );
    }
    await logAudit(req, 'create_reply', user.id);
    await pool.query('UPDATE posts SET updated_at = NOW() WHERE id = $1', [postId]);
    return Response.json(r.rows[0]);
  } catch (error) {
    console.error('[replies] create failed:', error?.code || error?.message);
    return Response.json({ error: '回复失败，请稍后重试' }, { status: 500 });
  }
}
