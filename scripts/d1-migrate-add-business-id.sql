-- ==========================================
-- D1 数据库手动迁移 SQL
-- 目标：为 sessions 表添加 business_id 字段
-- 数据库 ID: 91fad6d8-e535-4bc0-95fc-2b69c32c7d22
-- ==========================================

-- Step 1: 检查 sessions 表是否已有 business_id 列
-- PRAGMA table_info(sessions);

-- Step 2: 如果 sessions 表缺少 business_id 列，执行以下语句添加
ALTER TABLE sessions ADD COLUMN business_id INTEGER NOT NULL DEFAULT 1;

-- Step 3: 如果已有 business_id 但默认值不对，可更新现有数据
-- 将所有没有 business_id 或 business_id 为 0 的会话，默认归属到商家 1（默认商家）
-- UPDATE sessions SET business_id = 1 WHERE business_id IS NULL OR business_id = 0;

-- Step 4: 为 business_id 创建索引，提升查询性能
CREATE INDEX IF NOT EXISTS sessions_business_id_idx ON sessions(business_id);

-- Step 5: 验证结果
-- SELECT business_id, COUNT(*) as count FROM sessions GROUP BY business_id ORDER BY count DESC;
