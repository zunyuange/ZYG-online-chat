-- Drop all tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS evaluations;
DROP TABLE IF EXISTS visitor_blacklist;
DROP TABLE IF EXISTS queue;
DROP TABLE IF EXISTS staff_group_members;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS visitors;
DROP TABLE IF EXISTS sentences;
DROP TABLE IF EXISTS offline_messages;
DROP TABLE IF EXISTS chat_stats;
DROP TABLE IF EXISTS staff_users;
DROP TABLE IF EXISTS staff_groups;
DROP TABLE IF EXISTS robot_knowledge;
DROP TABLE IF EXISTS faq;
DROP TABLE IF EXISTS banwords;
DROP TABLE IF EXISTS evaluation_setting;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS admin_config;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS todos;
DROP TABLE IF EXISTS visitor_custom_fields;
DROP TABLE IF EXISTS transfer_requests;

-- Reset auto-increment counters
DELETE FROM sqlite_sequence;

-- Create todos table
CREATE TABLE IF NOT EXISTS todos (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
title TEXT NOT NULL, 
description TEXT, 
status TEXT NOT NULL DEFAULT 'pending', 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), 
updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
id TEXT PRIMARY KEY, 
visiter_id TEXT NOT NULL, 
visitor_name TEXT NOT NULL, 
business_id INTEGER NOT NULL DEFAULT 1, 
service_id INTEGER DEFAULT 0, 
assigned_staff_id INTEGER, 
groupid INTEGER DEFAULT 0, 
status TEXT NOT NULL DEFAULT 'active', 
state TEXT NOT NULL DEFAULT 'normal', 
last_message_at INTEGER, 
unread_by_visitor INTEGER DEFAULT 0, 
unread_by_staff INTEGER DEFAULT 0, 
topic TEXT, 
task_status TEXT NOT NULL DEFAULT 'requirement_discussion', 
task_status_updated_at INTEGER, 
queue_position INTEGER, 
estimated_wait_minutes INTEGER, 
ip TEXT, 
from_url TEXT, 
avatar TEXT, 
device TEXT, 
lang TEXT DEFAULT 'cn', 
transfer_history TEXT, 
response_time INTEGER, 
-- 访客自定义字段
email TEXT, 
phone TEXT, 
pid TEXT, 
params TEXT, 
referer TEXT, 
user_agent TEXT, 
last_visitor_activity_at INTEGER, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), 
updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
session_id TEXT NOT NULL, 
sender_type TEXT NOT NULL, 
content_type TEXT NOT NULL, 
content TEXT NOT NULL, 
translated_content TEXT, 
translate_engine TEXT, 
translated_at INTEGER, 
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
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create staff_users table for multi-user authentication (商家/客服表)
CREATE TABLE IF NOT EXISTS staff_users (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
business_id INTEGER NOT NULL DEFAULT 0, 
business_slug TEXT UNIQUE, 
business_name TEXT, 
enable_auto_trans INTEGER NOT NULL DEFAULT 0, 
default_lang TEXT NOT NULL DEFAULT 'zh-CN', 
username TEXT NOT NULL UNIQUE, 
password_hash TEXT NOT NULL, 
email TEXT, 
name TEXT, 
role TEXT NOT NULL DEFAULT 'staff', 
status TEXT NOT NULL DEFAULT 'active', 
last_active INTEGER, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), 
updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create visitors table for visitor management (访客表)
CREATE TABLE IF NOT EXISTS visitors (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
business_id INTEGER NOT NULL DEFAULT 1, 
visitor_id TEXT NOT NULL, 
visitor_name TEXT NOT NULL, 
avatar TEXT, 
ip TEXT, 
from_url TEXT, 
device TEXT, 
lang TEXT NOT NULL DEFAULT 'cn', 
status TEXT NOT NULL DEFAULT 'offline', 
last_visit_at INTEGER, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create robot_knowledge table for AI auto-reply
CREATE TABLE IF NOT EXISTS robot_knowledge (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
keyword TEXT NOT NULL, 
question TEXT NOT NULL, 
answer TEXT NOT NULL, 
sort INTEGER NOT NULL DEFAULT 0, 
status INTEGER NOT NULL DEFAULT 1, 
lang TEXT NOT NULL DEFAULT 'zh-CN', 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create faq table for frequently asked questions
CREATE TABLE IF NOT EXISTS faq (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
question TEXT NOT NULL, 
answer TEXT NOT NULL, 
sort INTEGER NOT NULL DEFAULT 0, 
status INTEGER NOT NULL DEFAULT 1, 
lang TEXT NOT NULL DEFAULT 'zh-CN', 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create evaluations table for visitor feedback
CREATE TABLE IF NOT EXISTS evaluations (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
session_id TEXT NOT NULL, 
visitor_name TEXT, 
score INTEGER NOT NULL DEFAULT 5, 
comment TEXT, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create banwords table for prohibited words
CREATE TABLE IF NOT EXISTS banwords (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
keyword TEXT NOT NULL UNIQUE, 
level INTEGER NOT NULL DEFAULT 1, 
replace_with TEXT, 
status INTEGER NOT NULL DEFAULT 1, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create visitor_blacklist table for blocked visitors
CREATE TABLE IF NOT EXISTS visitor_blacklist (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
business_id INTEGER NOT NULL, 
visitor_id TEXT NOT NULL, 
ip TEXT, 
reason TEXT, 
expires_at INTEGER, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create chat_stats table for statistics
CREATE TABLE IF NOT EXISTS chat_stats (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
business_id INTEGER NOT NULL, 
date TEXT NOT NULL, 
total_sessions INTEGER DEFAULT 0, 
active_sessions INTEGER DEFAULT 0, 
total_messages INTEGER DEFAULT 0, 
avg_response_time INTEGER DEFAULT 0, 
satisfaction_rate REAL DEFAULT 0, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create staff_groups table for staff grouping
CREATE TABLE IF NOT EXISTS staff_groups (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
name TEXT NOT NULL UNIQUE, 
description TEXT, 
sort INTEGER NOT NULL DEFAULT 0, 
status INTEGER NOT NULL DEFAULT 1, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create staff_group_members table for staff-group relationships
CREATE TABLE IF NOT EXISTS staff_group_members (
group_id INTEGER NOT NULL, 
staff_id INTEGER NOT NULL, 
PRIMARY KEY (group_id, staff_id));

-- Create sentences table for quick replies (常用语)
CREATE TABLE IF NOT EXISTS sentences (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
content TEXT NOT NULL, 
staff_id INTEGER NOT NULL, 
tag TEXT, 
state TEXT NOT NULL DEFAULT 'using', 
lang TEXT NOT NULL DEFAULT 'zh-CN', 
business_id INTEGER NOT NULL DEFAULT 0, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create offline_messages table for offline visitor messages (留言)
CREATE TABLE IF NOT EXISTS offline_messages (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
visiter_id TEXT, 
name TEXT NOT NULL, 
mobile TEXT, 
email TEXT, 
content TEXT NOT NULL, 
business_id INTEGER DEFAULT 0, 
ip TEXT, 
from_url TEXT, 
status TEXT NOT NULL DEFAULT 'pending', 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create queue table for waiting visitors (排队表)
CREATE TABLE IF NOT EXISTS queue (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
visiter_id TEXT NOT NULL, 
service_id INTEGER DEFAULT 0, 
groupid INTEGER DEFAULT 0, 
business_id INTEGER DEFAULT 0, 
state TEXT NOT NULL DEFAULT 'waiting', 
position INTEGER DEFAULT 0, 
remind_sent INTEGER DEFAULT 0, 
evaluation_sent INTEGER DEFAULT 0, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create evaluation_setting table for visitor feedback settings
CREATE TABLE IF NOT EXISTS evaluation_setting (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
business_id INTEGER DEFAULT 0, 
title TEXT NOT NULL DEFAULT '满意度评价', 
questions TEXT NOT NULL DEFAULT '[]', 
word_switch TEXT NOT NULL DEFAULT 'close', 
word_title TEXT NOT NULL DEFAULT '', 
status TEXT NOT NULL DEFAULT 'open', 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), 
updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create admin_users table for admin panel
CREATE TABLE IF NOT EXISTS admin_users (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
username TEXT NOT NULL UNIQUE, 
password_hash TEXT NOT NULL, 
email TEXT, 
name TEXT, 
status TEXT NOT NULL DEFAULT 'active', 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), 
updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create admin_config table for system settings
CREATE TABLE IF NOT EXISTS admin_config (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
key TEXT NOT NULL UNIQUE, 
value TEXT NOT NULL, 
description TEXT, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), 
updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create roles table for role-based access control
CREATE TABLE IF NOT EXISTS roles (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
name TEXT NOT NULL UNIQUE, 
description TEXT, 
permissions TEXT NOT NULL DEFAULT '[]', 
is_system INTEGER NOT NULL DEFAULT 0, 
status TEXT NOT NULL DEFAULT 'active', 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), 
updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create transfer_requests table for session transfer management (会话转申请表)
CREATE TABLE IF NOT EXISTS transfer_requests (
id INTEGER PRIMARY KEY AUTOINCREMENT, 
session_id TEXT NOT NULL, 
from_staff_id INTEGER NOT NULL, 
to_staff_id INTEGER NOT NULL, 
reason TEXT, 
status TEXT NOT NULL DEFAULT 'pending', 
reject_reason TEXT, 
created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), 
updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000));

-- Create indexes
CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages(session_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
CREATE INDEX IF NOT EXISTS staff_users_username_idx ON staff_users(username);
CREATE INDEX IF NOT EXISTS staff_users_business_id_idx ON staff_users(business_id);
CREATE INDEX IF NOT EXISTS robot_knowledge_keyword_idx ON robot_knowledge(keyword);
CREATE INDEX IF NOT EXISTS evaluations_session_id_idx ON evaluations(session_id);
CREATE INDEX IF NOT EXISTS sessions_visiter_id_idx ON sessions(visiter_id);
CREATE INDEX IF NOT EXISTS sessions_business_id_idx ON sessions(business_id);
CREATE INDEX IF NOT EXISTS sentences_staff_id_idx ON sentences(staff_id);
CREATE INDEX IF NOT EXISTS offline_messages_created_at_idx ON offline_messages(created_at);
CREATE INDEX IF NOT EXISTS queue_visiter_id_idx ON queue(visiter_id);
CREATE INDEX IF NOT EXISTS queue_business_id_idx ON queue(business_id);
CREATE INDEX IF NOT EXISTS staff_users_business_slug_idx ON staff_users(business_slug);
CREATE INDEX IF NOT EXISTS visitors_business_id_idx ON visitors(business_id);
CREATE INDEX IF NOT EXISTS visitors_visitor_id_idx ON visitors(visitor_id);
CREATE INDEX IF NOT EXISTS admin_users_username_idx ON admin_users(username);
CREATE INDEX IF NOT EXISTS roles_name_idx ON roles(name);
CREATE INDEX IF NOT EXISTS transfer_requests_session_id_idx ON transfer_requests(session_id);
CREATE INDEX IF NOT EXISTS transfer_requests_to_staff_id_idx ON transfer_requests(to_staff_id);
CREATE INDEX IF NOT EXISTS transfer_requests_from_staff_id_idx ON transfer_requests(from_staff_id);
CREATE INDEX IF NOT EXISTS visitor_custom_fields_business_id_idx ON visitor_custom_fields(business_id);
CREATE INDEX IF NOT EXISTS visitor_custom_fields_field_key_idx ON visitor_custom_fields(business_id, field_key);

-- Initialize default admin user (username: admin, password: 123456)
-- Password hash for '123456' using SHA-256: 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
INSERT OR REPLACE INTO admin_users (username, password_hash, email, name, status) VALUES ('admin', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin@example.com', '系统管理员', 'active');

-- Initialize default staff user (business admin)
-- enable_auto_trans=1 → 默认开启自动翻译（Google + MyMemory 免费引擎）
INSERT OR REPLACE INTO staff_users (username, password_hash, email, name, role, status, enable_auto_trans, default_lang, business_id, business_slug, business_name) VALUES ('admin', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin@example.com', '系统管理员', 'admin', 'active', 1, 'zh-CN', 0, 'default', '默认商家');

-- Initialize default super admin role
INSERT OR REPLACE INTO roles (name, description, permissions, is_system, status) VALUES ('超级管理员', '系统默认超级管理员，拥有所有权限', '["admin_view","admin_edit","staff_view","staff_edit","role_view","role_edit","settings"]', 1, 'active');

-- Initialize default settings
INSERT OR REPLACE INTO admin_config (key, value, description) VALUES ('siteName', 'CF智能多语言在线客服系统', '网站名称');
INSERT OR REPLACE INTO admin_config (key, value, description) VALUES ('defaultLanguage', 'zh-CN', '默认语言');
INSERT OR REPLACE INTO admin_config (key, value, description) VALUES ('enableAuth', 'true', '启用认证');

-- Create visitor_custom_fields table for custom visitor field definitions
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
CREATE INDEX IF NOT EXISTS visitor_custom_fields_business_id_idx ON visitor_custom_fields(business_id);
CREATE INDEX IF NOT EXISTS visitor_custom_fields_field_key_idx ON visitor_custom_fields(business_id, field_key);