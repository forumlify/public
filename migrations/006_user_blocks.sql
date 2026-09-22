-- ============================================================
--  用户屏蔽
-- ------------------------------------------------------------
--  单向关系：blocker 屏蔽 blocked 之后
--    - blocked 不能再给 blocker 发私信（已有的会话也发不了）
--    - blocker 在帖子列表、详情与回复中不再看到 blocked 的内容
--    - blocked 仍可正常浏览 blocker 的公开内容（不通知、不暴露）
--
--  之所以是单向而非互斥：屏蔽应当是「我选择不看某人的内容、也不让
--  对方打扰我」，而不是让双方互相消失。被屏蔽方不会收到任何提示。
-- ============================================================

CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 发起屏蔽的人
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 被屏蔽的人
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 同一对关系只能有一条
  UNIQUE (blocker_id, blocked_id),
  -- 不允许屏蔽自己
  CHECK (blocker_id <> blocked_id)
);

-- 主查询方向：某人屏蔽了谁（用于过滤内容）
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);

-- 反向查询：某人被谁屏蔽（用于判断能否发私信）
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);
