-- ==========================================
-- D1 数据库手动迁移 SQL — 访客自定义字段 + 缺失字段补齐
-- 数据库 ID: 91fad6d8-e535-4bc0-95fc-2b69c32c7d22
-- 在 D1 Studio 中按顺序执行以下 SQL
-- ==========================================

-- ===== 第1步：诊断 — 检查 visitor_custom_fields 表是否已存在 =====
SELECT name FROM sqlite_master WHERE type='table' AND name='visitor_custom_fields';

-- ===== 第2步：创建 visitor_custom_fields 表（访客自定义字段定义） =====
CREATE TABLE IF NOT EXISTS visitor_custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL DEFAULT 0,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  remark TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ===== 第3步：创建 visitor_custom_fields 索引 =====
CREATE INDEX IF NOT EXISTS visitor_custom_fields_business_id_idx ON visitor_custom_fields(business_id);
CREATE INDEX IF NOT EXISTS visitor_custom_fields_field_key_idx ON visitor_custom_fields(business_id, field_key);

-- ===== 第4步：诊断 — 检查 sessions 表缺失字段 =====
-- sessions 表中需要有以下访客信息字段：
-- email, phone, pid, params, referer, user_agent
PRAGMA table_info(sessions);

-- ===== 第5步：sessions 表补齐访客信息字段（如果不存在则添加） =====
-- 注意：D1 不支持 IF NOT EXISTS 的 ALTER TABLE ADD COLUMN，如果字段已存在会报错
-- 请先执行第4步诊断，确认哪些字段缺失后，再选择性执行以下语句

ALTER TABLE sessions ADD COLUMN email TEXT;
ALTER TABLE sessions ADD COLUMN phone TEXT;
ALTER TABLE sessions ADD COLUMN pid TEXT;
ALTER TABLE sessions ADD COLUMN params TEXT;
ALTER TABLE sessions ADD COLUMN referer TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;

-- ===== 第6步：诊断 — 检查 transfer_requests 表结构 =====
PRAGMA table_info(transfer_requests);

-- ===== 第7步：transfer_requests 表添加 reject_reason 字段 =====
ALTER TABLE transfer_requests ADD COLUMN reject_reason TEXT;

-- ===== 第8步：诊断 — 检查 sessions 表是否有 business_id =====
-- （如果已有则跳过）
PRAGMA table_info(sessions);

-- ===== 第9步：sessions 表添加 business_id（如果缺失） =====
-- ALTER TABLE sessions ADD COLUMN business_id INTEGER NOT NULL DEFAULT 1;
-- CREATE INDEX IF NOT EXISTS sessions_business_id_idx ON sessions(business_id);

-- ===== 第10步：验证所有表结构 =====
SELECT 'visitor_custom_fields' as table_name, COUNT(*) as row_count FROM visitor_custom_fields
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'transfer_requests', COUNT(*) FROM transfer_requests;

-- ===== 第11步：最终验证 — 列出所有表 =====
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
