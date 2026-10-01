// GET /api/posts/[id], DELETE /api/posts/[id]
import pool from '@/lib/db';
import { getUser } from '@/lib/auth';
import { jsonWithEtag } from '@/lib/http-cache';
import { resolvePostReference } from '@/lib/post-reference';
import { ensureUserBlocksSchema } from '@/lib/user-blocks';

function invalidId() {
  return Response.json({ error: '帖子不存在' }, { status: 404 });
}

export async function GET(req, { params }) {
  try {
    const viewer = getUser(req);
    const reference = await resolvePostReference((await params).id);
    if (!reference) return invalidId();
    if (viewer) await ensureUserBlocksSchema();
    const r = await pool.query(
      `SELECT p.*, u.username, u.avatar_url, u.signature
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1${viewer ? ` AND NOT EXISTS (
         SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = p.user_id
       )` : ''}`,
      viewer ? [reference.id, viewer.id] : [reference.id]
    );
    if (r.rows.length === 0) {
      return invalidId();
    }
    return viewer
      ? Response.json(r.rows[0], { headers: { 'Cache-Control': 'private, no-store' } })
      : jsonWithEtag(req, r.rows[0]);
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const user = getUser(req);
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 });
  }
  const { title, content, images } = await req.json();
  if (!content || content.trim().length === 0) {
    return Response.json({ error: '请填写内容' }, { status: 400 });
  }
  try {
    const reference = await resolvePostReference((await params).id);
    if (!reference) return invalidId();
    const post = await pool.query('SELECT user_id, images FROM posts WHERE id = $1', [reference.id]);
    if (post.rows.length === 0) return invalidId();
    if (post.rows[0].user_id !== user.id) {
      return Response.json({ error: '无权限编辑此帖子' }, { status: 403 });
    }
    // images: 可选，传入完整图片 URL 数组（编辑时替换全部图片）；不传则保留原图
    const r = await pool.query(
      `UPDATE posts SET title = $1, content = $2, images = $3, edited_at = NOW() WHERE id = $4 RETURNING *`,
      [title || '无标题', content, Array.isArray(images) ? images : post.rows[0].images || [], reference.id]
    );
    return Response.json(r.rows[0]);
  } catch {
    return Response.json({ error: '编辑失败，请稍后重试' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const user = getUser(req);
  if (!user) {
    return Response.json({ error: '请先登录' }, { status: 401 });
  }
  try {
    const reference = await resolvePostReference((await params).id);
    if (!reference) return invalidId();
    const post = await pool.query('SELECT user_id FROM posts WHERE id = $1', [reference.id]);
    if (post.rows.length === 0) {
      return invalidId();
    }
    const u = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
    if (post.rows[0].user_id !== user.id && u.rows[0]?.role !== 'admin') {
      return Response.json({ error: '无权限删除此帖子' }, { status: 403 });
    }
    await pool.query('DELETE FROM posts WHERE id = $1', [reference.id]);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: '删除失败，请稍后重试' }, { status: 500 });
  }
}
