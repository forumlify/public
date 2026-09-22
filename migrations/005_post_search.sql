-- ============================================================
--  帖子搜索
-- ------------------------------------------------------------
--  搜索用 ILIKE 做子串匹配（见 server.js 的 /api/posts/search）。
--  之所以不用 PostgreSQL 的全文检索（tsvector）：它依赖分词，而
--  中文分词需要额外安装 zhparser 等扩展，多数部署环境没有；ILIKE
--  无需任何扩展即可正确匹配中文子串。
--
--  索引用 pg_trgm 的 GIN 索引，实测效果分两种情况：
--    - 英文关键词（如 postgresql）：走 Bitmap Index Scan，0.2ms，
--      相比全表扫描快约 47 倍
--    - 中文关键词：pg_trgm 对中文难以切出有效 trigram，优化器仍选
--      全表扫描。3000 条数据下约 7~9ms，可接受
--  即索引对英文有效、对中文无效。许多技术论坛中英混排，保留仍有
--  价值。
--
--  注意：创建扩展需要相应权限。部分托管数据库不开放该权限，因此
--  失败时仅提示，不影响后续迁移与功能——搜索本身不依赖扩展。
-- ============================================================

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm 扩展创建失败（%）。搜索仍可正常使用，但英文关键词将无法走索引加速。', SQLERRM;
END $$;

-- 仅在扩展可用时才建索引
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS idx_posts_title_trgm
      ON posts USING gin (title gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_posts_content_trgm
      ON posts USING gin (content gin_trgm_ops);
  ELSE
    RAISE NOTICE '跳过 trigram 索引创建：pg_trgm 不可用。';
  END IF;
END $$;
