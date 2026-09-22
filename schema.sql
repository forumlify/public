-- ============================================================
--  Forumlify 数据库表结构
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(20) UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Keep case-insensitive lookups index-backed for legacy mixed-case emails.
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 回复表
CREATE TABLE IF NOT EXISTS replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 友情链接表
CREATE TABLE IF NOT EXISTS friendly_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- 举报表
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  handled_at TIMESTAMPTZ,
  handler_id UUID REFERENCES users(id) ON DELETE SET NULL,
  handler_note TEXT
);

-- Preserve moderation history when a reported post is deleted. This also
-- upgrades databases created with the previous ON DELETE CASCADE constraint.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute attr ON attr.attrelid = rel.oid AND attr.attnum = ANY(con.conkey)
  WHERE rel.relname = 'reports'
    AND con.contype = 'f'
    AND attr.attname = 'post_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE reports DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE reports ALTER COLUMN post_id DROP NOT NULL;
  ALTER TABLE reports
    ADD CONSTRAINT reports_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL;
END $$;

-- 事件日志表
CREATE TABLE IF NOT EXISTS event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  ip VARCHAR(45),
  method VARCHAR(10),
  path TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS method VARCHAR(10);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS path TEXT;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_user_id ON event_logs(user_id);

-- ============================================================
--  论坛设置表
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO settings (key, value) VALUES ('forum_name', 'Forumlify')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
--  私信系统
-- ============================================================

-- 私信会话表
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (user1_id < user2_id),
  UNIQUE(user1_id, user2_id)
);

-- 私信消息表
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user1_id ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_id ON conversations(user2_id);

-- ============================================================
--  自定义页面表
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_pages_name ON custom_pages(name);

-- ============================================================
--  通知系统
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================================
--  自动更新 updated_at 的触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- ============================================================
--  恢复码表（密码重置用）
-- ============================================================
CREATE TABLE IF NOT EXISTS recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);

-- 帖子表添加置顶字段
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_posts_is_pinned ON posts(is_pinned);

ALTER TABLE users ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Canonicalize conversation pairs and merge any pre-existing reverse/duplicate
-- conversations before enforcing one row per unordered user pair.
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user1_id_user2_id_key;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_canonical_pair;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id)
      ORDER BY created_at, id
    ) AS keep_id
  FROM conversations
)
UPDATE messages AS m
SET conversation_id = ranked.keep_id
FROM ranked
WHERE m.conversation_id = ranked.id
  AND ranked.id <> ranked.keep_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id)
      ORDER BY created_at, id
    ) AS row_number
  FROM conversations
)
DELETE FROM conversations AS c
USING ranked
WHERE c.id = ranked.id AND ranked.row_number > 1;

UPDATE conversations
SET user1_id = LEAST(user1_id, user2_id),
    user2_id = GREATEST(user1_id, user2_id);

ALTER TABLE conversations
  ADD CONSTRAINT conversations_canonical_pair CHECK (user1_id < user2_id);
ALTER TABLE conversations
  ADD CONSTRAINT conversations_user1_id_user2_id_key UNIQUE (user1_id, user2_id);

-- Keep one pending report per reporter/post at the database layer. Historical
-- duplicates are rejected before creating the partial unique index.
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY post_id, reporter_id
    ORDER BY created_at, id
  ) AS row_number
  FROM reports
  WHERE status = 'pending' AND post_id IS NOT NULL
)
UPDATE reports AS r
SET status = 'rejected',
    handled_at = COALESCE(r.handled_at, NOW()),
    handler_note = COALESCE(r.handler_note, '重复举报已自动合并')
FROM duplicates
WHERE r.id = duplicates.id AND duplicates.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_pending
  ON reports(post_id, reporter_id)
  WHERE status = 'pending' AND post_id IS NOT NULL;

-- ============================================================
--  论坛默认设置
-- ============================================================
INSERT INTO settings (key, value) VALUES ('forum_name', 'Forumlify')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
--  邮箱验证（对应 migrations/003_email_verification.sql）
-- ============================================================

-- 邮箱验证码：用于注册时的邮箱归属校验，以及通过邮箱找回密码
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  -- 验证码的 sha256 摘要，不存明文
  code_hash VARCHAR(64) NOT NULL,
  purpose VARCHAR(20) NOT NULL DEFAULT 'register',
  -- 尝试次数，超过阈值即作废，防止暴力枚举 6 位数字
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_lookup
  ON email_verifications (LOWER(email), purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_verifications_expires
  ON email_verifications (expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verifications_active
  ON email_verifications (LOWER(email), purpose)
  WHERE consumed_at IS NULL;

-- 用户邮箱验证标记。存量用户默认为 true：他们是在开启邮箱验证之前
-- 注册的，不应因为新功能而被标记为「未验证」。
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;

-- SMTP 配置项（默认关闭，管理员在后台填写后生效）
INSERT INTO settings (key, value) VALUES
  ('smtp_enabled',    'false'),
  ('smtp_host',       ''),
  ('smtp_port',       '587'),
  ('smtp_secure',     'false'),
  ('smtp_user',       ''),
  ('smtp_password',   ''),
  ('smtp_from_name',  ''),
  ('smtp_from_email', ''),
  ('smtp_allow_self_signed', 'false'),
  ('email_verify_required', 'false')
ON CONFLICT (key) DO NOTHING;
