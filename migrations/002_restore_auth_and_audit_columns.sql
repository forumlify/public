-- ============================================================
--  恢复认证与审计日志所需的缺失列
-- ============================================================
--
-- 背景：001_initial.sql 创建了 users / event_logs 表，但遗漏了
-- server.js 强依赖的若干列。schema.sql 里一直有这些列，两套定义
-- 因此产生漂移，导致 npm run migrate / Docker 部署出来的库在
-- 登录之后所有需要鉴权的接口全部返回 500：
--
--   users.token_version            认证中间件每个请求都会查询它
--   event_logs.method              审计日志写入
--   event_logs.path                审计日志写入
--   event_logs.user_agent          审计日志写入
--   event_logs.metadata            审计日志写入
--
-- 001_initial.sql 已经被记录进 schema_migrations，无法重跑，
-- 因此这里单独追加一版让已部署的库获得同样的修复。
-- 全部语句都是幂等的，对全新库同样安全。

-- token_version：用于在改密码/改邮箱后使旧 JWT 立即失效。
-- NOT NULL DEFAULT 0 会让存量用户的现有令牌保持有效（值为 0），
-- 不会强制所有人重新登录。
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- 事件日志的扩展字段，与 schema.sql 第 100-105 行保持一致。
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS method VARCHAR(10);
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS path TEXT;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 管理员事件日志按时间倒序分页，另有按用户检索的需求。
CREATE INDEX IF NOT EXISTS idx_event_logs_created_at ON event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_logs_user_id ON event_logs(user_id);

-- 兼容混合大小写的历史邮箱，让 LOWER(email) 查询走索引。
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
