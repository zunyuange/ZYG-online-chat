-- 创建 visitor_custom_fields 表（访客自定义字段定义表）
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

-- 索引
CREATE INDEX IF NOT EXISTS visitor_custom_fields_business_id_idx ON visitor_custom_fields(business_id);
CREATE INDEX IF NOT EXISTS visitor_custom_fields_field_key_idx ON visitor_custom_fields(business_id, field_key);

-- sessions 表补齐访客信息字段
ALTER TABLE sessions ADD COLUMN email TEXT;
ALTER TABLE sessions ADD COLUMN phone TEXT;
ALTER TABLE sessions ADD COLUMN pid TEXT;
ALTER TABLE sessions ADD COLUMN params TEXT;
ALTER TABLE sessions ADD COLUMN referer TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;

-- transfer_requests 表补齐拒绝原因字段
ALTER TABLE transfer_requests ADD COLUMN reject_reason TEXT;
