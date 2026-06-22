-- 添加 last_visitor_activity_at 字段到 sessions 表
-- 用于判断访客是否真正在线（最近5分钟内有活动才算在线）

-- 检查字段是否已存在（D1 不支持 IF NOT EXISTS 用于 ALTER TABLE ADD COLUMN，先尝试）
ALTER TABLE sessions ADD COLUMN last_visitor_activity_at INTEGER;

-- 创建索引以优化活跃会话查询
CREATE INDEX IF NOT EXISTS idx_sessions_last_visitor_activity ON sessions(last_visitor_activity_at);

-- 为现有活跃会话设置初始值（使用 last_message_at 作为初始值）
UPDATE sessions 
SET last_visitor_activity_at = last_message_at 
WHERE last_visitor_activity_at IS NULL AND last_message_at IS NOT NULL;
