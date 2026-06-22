-- 创建商家/客服表
CREATE TABLE IF NOT EXISTS staff_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL DEFAULT 0,
  business_slug TEXT UNIQUE,
  business_name TEXT,
  enable_auto_trans INTEGER NOT NULL DEFAULT 0,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT "staff",
  status TEXT NOT NULL DEFAULT "active",
  avatar TEXT,
  lang TEXT DEFAULT "zh-CN",
  default_lang TEXT DEFAULT "zh-CN",
  work_status TEXT NOT NULL DEFAULT "online",
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- 创建会话表
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  visiter_id TEXT NOT NULL,
  visitor_name TEXT NOT NULL,
  business_id INTEGER NOT NULL DEFAULT 1,
  service_id INTEGER DEFAULT 0,
  assigned_staff_id INTEGER,
  groupid INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT "active",
  state TEXT NOT NULL DEFAULT "normal",
  last_message_at INTEGER,
  unread_by_visitor INTEGER DEFAULT 0,
  unread_by_staff INTEGER DEFAULT 0,
  topic TEXT,
  task_status TEXT NOT NULL DEFAULT "requirement_discussion",
  task_status_updated_at INTEGER,
  queue_position INTEGER,
  estimated_wait_minutes INTEGER,
  ip TEXT,
  from_url TEXT,
  avatar TEXT,
  device TEXT,
  lang TEXT DEFAULT "cn",
  transfer_history TEXT,
  response_time INTEGER,
  last_visitor_activity_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- 创建消息表
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  is_read INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  deleted_by TEXT,
  deleted_at INTEGER,
  product_id INTEGER,
  product_name TEXT,
  product_price TEXT,
  product_image TEXT,
  product_url TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 创建评价表
CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  comment TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 创建会话转申请表
CREATE TABLE IF NOT EXISTS transfer_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  from_staff_id INTEGER NOT NULL,
  to_staff_id INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT "pending",
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 插入默认管理员账号
INSERT OR IGNORE INTO staff_users (id, business_id, business_slug, business_name, username, password_hash, name, role, status, default_lang) VALUES (1, 0, "default", "默认商家", "admin", "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", "系统管理员", "admin", "active", "zh-CN");

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sessions_business_id ON sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_session_id ON transfer_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_to_staff_id ON transfer_requests(to_staff_id);
