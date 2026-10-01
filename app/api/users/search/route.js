import pool from '@/lib/db';
import { getUser } from '@/lib/auth';
import { ensureUserBlocksSchema } from '@/lib/user-blocks';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const keyword = (url.searchParams.get('q') || '').trim();
  if (!keyword) return Response.json({ error: '请输入搜索关键词' }, { status: 400 });
  if (keyword.length > 50) return Response.json({ error: '搜索关键词过长（最多 50 字）' }, { status: 400 });

  const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 10));
  const user = getUser(req);
  try {
    const values = [`%${keyword.replace(/[\\%_]/g, (character) => `\\${character}`)}%`,
      `${keyword.replace(/[\\%_]/g, (character) => `\\${character}`)}%`];
    let filter = '';
    if (user) {
      await ensureUserBlocksSchema();
      values.push(user.id);
      filter = ` AND u.id <> $3 AND NOT EXISTS (
        SELECT 1 FROM user_blocks b WHERE b.blocker_id = $3 AND b.blocked_id = u.id
      )`;
    }
    values.push(limit);
    const result = await pool.query(`
      SELECT u.id, u.username, u.avatar_url, u.role, u.signature
      FROM users u WHERE u.username ILIKE $1${filter}
      ORDER BY CASE WHEN u.username ILIKE $2 THEN 0 ELSE 1 END,
        LENGTH(u.username), u.username
      LIMIT $${values.length}
    `, values);
    return Response.json({ data: result.rows, query: keyword }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}
