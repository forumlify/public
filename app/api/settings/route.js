// GET /api/settings, PUT /api/settings
import pool from '@/lib/db';
import { getUser, requireAdmin } from '@/lib/auth';
import { jsonWithEtag } from '@/lib/http-cache';
import { loadSmtpConfig, isConfigComplete } from '@/lib/mailer';

const VERSION_COMMIT = (process.env.FORUMLIFY_COMMIT || 'unknown').slice(0, 7);

// 避免 GET 被静态优化导致 PUT 405（动态接口，不能缓存）
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    // 确保 forum_name 始终存在（未设置过则初始化默认值），前端拿到后显示
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('forum_name', 'Forumlify')
       ON CONFLICT (key) DO NOTHING`
    );
    const r = await pool.query(`SELECT key, value FROM settings
      WHERE key = ANY($1::text[]) ORDER BY key`,
      [['forum_name', 'favicon_url', 'favicon_version', 'custom_css_enabled', 'email_verify_required']]);
    const settings = {};
    r.rows.forEach((row) => { settings[row.key] = row.value; });
    const config = await loadSmtpConfig();
    settings.smtp_ready = isConfigComplete(config);
    settings.email_verify_required = settings.email_verify_required === 'true' && settings.smtp_ready;
    // 兜底：即使插入失败也保证返回 forum_name
    if (!settings.forum_name) settings.forum_name = 'Forumlify';
    settings.version_commit = VERSION_COMMIT;
    return jsonWithEtag(req, settings);
  } catch {
    return Response.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(req) {
  const user = getUser(req);
  const forbidden = await requireAdmin(user);
  if (forbidden) return forbidden;

  const { forum_name } = await req.json();
  if (!forum_name || forum_name.trim().length === 0) {
    return Response.json({ error: '论坛名称不能为空' }, { status: 400 });
  }
  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      ['forum_name', forum_name.trim()]
    );
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: '更新失败，请稍后重试' }, { status: 500 });
  }
}
