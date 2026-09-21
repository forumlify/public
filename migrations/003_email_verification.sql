-- ============================================================
--  邮箱验证支持
-- ------------------------------------------------------------
--  注册流程改为「先验证邮箱再建号」，因此需要一张表暂存验证码。
--  验证码只存哈希，不存明文，避免库被读取后可直接冒用。
--
--  同时新增 SMTP 配置项到 settings 表（key-value 结构，无需建表），
--  由管理员在后台填写。
-- ============================================================

-- 邮箱验证码：用于注册时的邮箱归属校验
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  -- 验证码的 sha256 摘要；与用户输入做定时安全比较
  code_hash VARCHAR(64) NOT NULL,
  -- 用途区分：register（注册）/ reset（找回密码）
  purpose VARCHAR(20) NOT NULL DEFAULT 'register',
  -- 尝试次数，超过阈值即作废，防止暴力枚举 6 位数字
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 同一邮箱同一用途下只保留一条有效记录，靠下面的唯一索引约束
CREATE INDEX IF NOT EXISTS idx_email_verifications_lookup
  ON email_verifications (LOWER(email), purpose, created_at DESC);

-- 清理过期记录时使用
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires
  ON email_verifications (expires_at);

-- 每个邮箱+用途同时只允许一条未消费的记录，避免重复发送堆积
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verifications_active
  ON email_verifications (LOWER(email), purpose)
  WHERE consumed_at IS NULL;

-- ============================================================
--  SMTP 默认配置项
-- ------------------------------------------------------------
--  默认关闭。管理员在后台填写后才生效，因此现有部署升级后行为不变。
-- ============================================================

INSERT INTO settings (key, value) VALUES
  ('smtp_enabled',    'false'),
  ('smtp_host',       ''),
  ('smtp_port',       '587'),
  ('smtp_secure',     'false'),
  ('smtp_user',       ''),
  ('smtp_password',   ''),
  ('smtp_from_name',  ''),
  ('smtp_from_email', ''),
  ('email_verify_required', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
--  用户邮箱验证标记
-- ------------------------------------------------------------
--  记录该账号注册时是否通过了邮箱验证，便于后续审计与运营。
--  存量用户默认为 true：他们是在开启邮箱验证之前注册的，
--  不应因为新功能而被标记为「未验证」。
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;
