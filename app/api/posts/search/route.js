import pool from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ensurePostNumberSchema } from '@/lib/post-reference';
import { ensureUserBlocksSchema } from '@/lib/user-blocks';

export const dynamic = 'force-dynamic';

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function GET(req) {
  const url = new URL(req.url);
  const keyword = (url.searchParams.get('q') || '').trim();
  if (!keyword) return Response.json({ error: '请输入搜索关键词' }, { status: 400 });
  if (keyword.length > 100) return Response.json({ error: '搜索关键词过长（最多 100 字）' }, { status: 400 });

  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 20));
  const page = Math.min(10000, Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1));
  const user = getUser(req);
  const values = [`%${escapeLike(keyword)}%`];
  let where = '(p.title ILIKE $1 OR p.content ILIKE $1)';

  try {
    if (user) {
      await ensureUserBlocksSchema();
      values.push(user.id);
      where += ` AND NOT EXISTS (
        SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = p.user_id
      )`;
    }
    await ensurePostNumberSchema();
    const count = await pool.query(`SELECT COUNT(*) AS total FROM posts p WHERE ${where}`, values);
    const total = Number(count.rows[0].total);
    const rows = await pool.query(`
      SELECT p.*, u.username, u.avatar_url, u.signature,
        (SELECT COUNT(*) FROM replies WHERE post_id = p.id) AS reply_count
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `, [...values, limit, (page - 1) * limit]);
    return Response.json({
      data: rows.rows,
      query: keyword,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}
