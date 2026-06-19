-- ==========================================
-- D1 数据库手动迁移 SQL — sessions 多租户隔离
-- 数据库 ID: 91fad6d8-e535-4bc0-95fc-2b69c32c7d22
-- 在 D1 Studio 中按顺序执行以下 SQL
-- ==========================================

-- ===== 第1步：诊断 — 查看当前表结构 =====
PRAGMA table_info(sessions);

-- ===== 第2步：诊断 — 查看各商家数据 =====
-- 商家列表（staff_users 中 business_id=0 的是商家主账号）
SELECT id, business_slug, business_name, role, business_id 
FROM staff_users 
ORDER BY id;

-- ===== 第3步：诊断 — 查看 sessions 当前 business_id 分布 =====
SELECT business_id, COUNT(*) as count 
FROM sessions 
GROUP BY business_id 
ORDER BY count DESC;

-- ===== 第4步：如果 sessions 表缺少 business_id 列，执行添加 =====
ALTER TABLE sessions ADD COLUMN business_id INTEGER NOT NULL DEFAULT 1;

-- ===== 第5步：创建索引 =====
CREATE INDEX IF NOT EXISTS sessions_business_id_idx ON sessions(business_id);

-- ===== 第6步：数据修正 — 如果所有旧数据 business_id 都是 1 =====
-- 但实际有多个商家（如 default、shop2 等），需要根据实际情况手动修正：
-- 示例：假设商家 "shop2" 的 staff_users.id = 2，其历史会话需要归到它名下
-- UPDATE sessions SET business_id = 2 WHERE business_id = 1 AND ... (按条件筛选)

-- ===== 第7步：验证结果 =====
SELECT 
  s.business_id, 
  u.business_slug, 
  u.business_name, 
  COUNT(*) as session_count
FROM sessions s
LEFT JOIN staff_users u ON s.business_id = u.id
GROUP BY s.business_id
ORDER BY session_count DESC;
