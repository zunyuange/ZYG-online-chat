-- 创建会话转申请表（如果不存在）
CREATE TABLE IF NOT EXISTS transfer_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  from_staff_id INTEGER NOT NULL,
  to_staff_id INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS transfer_requests_session_id_idx ON transfer_requests(session_id);
CREATE INDEX IF NOT EXISTS transfer_requests_to_staff_id_idx ON transfer_requests(to_staff_id);
