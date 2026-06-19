-- ==========================================
-- D1 数据库手动迁移 SQL — 多租户数据修正
-- 数据库 ID: 91fad6d8-e535-4bc0-95fc-2b69c32c7d22
-- 在 D1 Studio 中按顺序执行以下 SQL
-- ==========================================

-- ===== 第1步：诊断 — 查看 staff_users 完整数据 =====
-- 关键字段：
--   business_id=0 + business_slug 非空 → 商家主账号
--   business_id>0 → 客服子账号，business_id 指向商家主账号 id
SELECT id, username, business_id, business_slug, business_name, role 
FROM staff_users 
ORDER BY id;

-- ===== 第2步：诊断 — 检查客服账号归属是否正确 =====
-- 列出所有客服账号及其所属商家
SELECT 
  s.id AS staff_id,
  s.username,
  s.business_id AS belongs_to_business_id,
  o.business_slug AS owner_business_slug,
  o.business_name AS owner_business_name
FROM staff_users s
LEFT JOIN staff_users o ON s.business_id = o.id
WHERE s.role = 'staff'
ORDER BY s.id;

-- ===== 第3步：诊断 — sessions 表结构 =====
PRAGMA table_info(sessions);

-- ===== 第4步：诊断 — sessions business_id 分布 =====
SELECT 
  s.business_id, 
  u.business_slug, 
  u.business_name, 
  COUNT(*) as session_count
FROM sessions s
LEFT JOIN staff_users u ON s.business_id = u.id
GROUP BY s.business_id
ORDER BY session_count DESC;

-- ===== 第5步：修复 — 添加缺失的列 =====
ALTER TABLE sessions ADD COLUMN business_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS sessions_business_id_idx ON sessions(business_id);

-- ===== 第6步：修复 — 修正客服账号归属 =====
-- 示例：将 cs110(id=2) 和 cs111(id=3) 归属到 htcs110 商家(id=4)
-- 根据实际诊断结果修改以下 SQL：
-- UPDATE staff_users SET business_id = 4 WHERE id IN (2, 3);

-- ===== 第7步：修复 — 修正 sessions 旧数据的 business_id =====
-- 示例：将属于 htcs110 商家的旧会话 business_id 从 1 改为 4
-- UPDATE sessions SET business_id = 4 WHERE business_id = 1 AND ...;

-- ===== 第8步：验证 =====
SELECT 
  s.id AS staff_id,
  s.username,
  s.business_id,
  o.business_slug,
  o.business_name
FROM staff_users s
LEFT JOIN staff_users o ON s.business_id = o.id
ORDER BY s.id;
