-- ==========================================
-- D1 数据库完整同步脚本
-- 数据库 ID: 91fad6d8-e535-4bc0-95fc-2b69c32c7d22
-- 
-- 使用方式:
--   1. 打开 https://dash.cloudflare.com/ → D1 → zyg-online-chat-db → Console
--   2. 将本文件内容粘贴到 Console 中
--   3. 点击 "Run" 执行（所有语句使用 IF NOT EXISTS，可安全重复执行）
-- ==========================================

-- ============================================================
-- 第1部分: 创建 3 张新表（business_domains, business_ai_config, domain_operation_logs）
-- ============================================================

CREATE TABLE IF NOT EXISTS business_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    staff_user_id INTEGER NOT NULL,
    domain_type TEXT NOT NULL DEFAULT 'auto_subdomain',
    domain TEXT NOT NULL UNIQUE,
    subdomain TEXT,
    domain_platform TEXT DEFAULT 'cloudflare',
    cf_zone_id TEXT,
    cf_zone_name TEXT,
    cf_account_id TEXT,
    cf_api_token_encrypted TEXT,
    cf_dns_record_id TEXT,
    cf_worker_route_id TEXT,
    verification_status TEXT DEFAULT 'pending',
    ssl_status TEXT DEFAULT 'pending',
    is_primary INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    error_message TEXT,
    verified_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES staff_users(id),
    FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
);

CREATE TABLE IF NOT EXISTS business_ai_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL UNIQUE,
    ai_mode TEXT DEFAULT 'platform',
    cf_account_id TEXT,
    cf_ai_token_encrypted TEXT,
    ai_gateway_url TEXT,
    monthly_translate_count INTEGER DEFAULT 0,
    monthly_translate_limit INTEGER DEFAULT 10000,
    total_translate_count INTEGER DEFAULT 0,
    reset_day INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (business_id) REFERENCES staff_users(id)
);

CREATE TABLE IF NOT EXISTS domain_operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    domain_id INTEGER,
    operation TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'success',
    ip_address TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);

-- ============================================================
-- 第2部分: 创建新表索引
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_business_domains_domain ON business_domains(domain);
CREATE INDEX IF NOT EXISTS idx_business_domains_business_id ON business_domains(business_id);
CREATE INDEX IF NOT EXISTS idx_business_domains_type_status ON business_domains(domain_type, status);
CREATE INDEX IF NOT EXISTS idx_business_ai_config_business_id ON business_ai_config(business_id);
CREATE INDEX IF NOT EXISTS idx_domain_logs_business_id ON domain_operation_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_domain_logs_created_at ON domain_operation_logs(created_at);

-- ============================================================
-- 第3部分: 为已有表添加缺失字段
-- ============================================================

-- 3.1 staff_users 表缺失字段
--    这些字段对于多租户隔离、翻译功能至关重要
ALTER TABLE staff_users ADD COLUMN business_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE staff_users ADD COLUMN business_slug TEXT;
ALTER TABLE staff_users ADD COLUMN business_name TEXT;
ALTER TABLE staff_users ADD COLUMN enable_auto_trans INTEGER NOT NULL DEFAULT 0;
ALTER TABLE staff_users ADD COLUMN default_lang TEXT NOT NULL DEFAULT 'zh-CN';
ALTER TABLE staff_users ADD COLUMN last_active INTEGER;

-- 3.2 sessions 表缺失字段
ALTER TABLE sessions ADD COLUMN business_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN email TEXT;
ALTER TABLE sessions ADD COLUMN phone TEXT;
ALTER TABLE sessions ADD COLUMN pid TEXT;
ALTER TABLE sessions ADD COLUMN params TEXT;
ALTER TABLE sessions ADD COLUMN referer TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;

-- 3.3 messages 表缺失字段（翻译功能）
ALTER TABLE messages ADD COLUMN translated_content TEXT;
ALTER TABLE messages ADD COLUMN translate_engine TEXT;
ALTER TABLE messages ADD COLUMN translated_at INTEGER;

-- 3.4 transfer_requests 表缺失字段
ALTER TABLE transfer_requests ADD COLUMN reject_reason TEXT;

-- 3.5 sentences 表缺失字段
ALTER TABLE sentences ADD COLUMN business_id INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 第4部分: 确保所有核心表存在（CREATE TABLE IF NOT EXISTS）
-- ============================================================

CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

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
    email TEXT,
    phone TEXT,
    pid TEXT,
    params TEXT,
    referer TEXT,
    user_agent TEXT,
    last_visitor_activity_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

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
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

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
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

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
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS robot_knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    lang TEXT NOT NULL DEFAULT 'zh-CN',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS faq (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    lang TEXT NOT NULL DEFAULT 'zh-CN',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    visitor_name TEXT,
    score INTEGER NOT NULL DEFAULT 5,
    comment TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS banwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    level INTEGER NOT NULL DEFAULT 1,
    replace_with TEXT,
    status INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS visitor_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    visitor_id TEXT NOT NULL,
    ip TEXT,
    reason TEXT,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS chat_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    active_sessions INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    satisfaction_rate REAL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS staff_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    sort INTEGER NOT NULL DEFAULT 0,
    status INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS staff_group_members (
    group_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    PRIMARY KEY (group_id, staff_id)
);

CREATE TABLE IF NOT EXISTS sentences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    staff_id INTEGER NOT NULL,
    tag TEXT,
    state TEXT NOT NULL DEFAULT 'using',
    lang TEXT NOT NULL DEFAULT 'zh-CN',
    business_id INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

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
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

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
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS evaluation_setting (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER DEFAULT 0,
    title TEXT NOT NULL DEFAULT '满意度评价',
    questions TEXT NOT NULL DEFAULT '[]',
    word_switch TEXT NOT NULL DEFAULT 'close',
    word_title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email TEXT,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS admin_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT NOT NULL DEFAULT '[]',
    is_system INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS transfer_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    from_staff_id INTEGER NOT NULL,
    to_staff_id INTEGER NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

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

-- ============================================================
-- 第5部分: 创建所有缺失索引
-- ============================================================

CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages(session_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
CREATE INDEX IF NOT EXISTS staff_users_username_idx ON staff_users(username);
CREATE INDEX IF NOT EXISTS staff_users_business_id_idx ON staff_users(business_id);
CREATE INDEX IF NOT EXISTS staff_users_business_slug_idx ON staff_users(business_slug);
CREATE INDEX IF NOT EXISTS robot_knowledge_keyword_idx ON robot_knowledge(keyword);
CREATE INDEX IF NOT EXISTS evaluations_session_id_idx ON evaluations(session_id);
CREATE INDEX IF NOT EXISTS sessions_visiter_id_idx ON sessions(visiter_id);
CREATE INDEX IF NOT EXISTS sessions_business_id_idx ON sessions(business_id);
CREATE INDEX IF NOT EXISTS sentences_staff_id_idx ON sentences(staff_id);
CREATE INDEX IF NOT EXISTS offline_messages_created_at_idx ON offline_messages(created_at);
CREATE INDEX IF NOT EXISTS queue_visiter_id_idx ON queue(visiter_id);
CREATE INDEX IF NOT EXISTS queue_business_id_idx ON queue(business_id);
CREATE INDEX IF NOT EXISTS admin_users_username_idx ON admin_users(username);
CREATE INDEX IF NOT EXISTS roles_name_idx ON roles(name);
CREATE INDEX IF NOT EXISTS transfer_requests_session_id_idx ON transfer_requests(session_id);
CREATE INDEX IF NOT EXISTS transfer_requests_to_staff_id_idx ON transfer_requests(to_staff_id);
CREATE INDEX IF NOT EXISTS transfer_requests_from_staff_id_idx ON transfer_requests(from_staff_id);
CREATE INDEX IF NOT EXISTS visitor_custom_fields_business_id_idx ON visitor_custom_fields(business_id);
CREATE INDEX IF NOT EXISTS visitor_custom_fields_field_key_idx ON visitor_custom_fields(business_id, field_key);
CREATE INDEX IF NOT EXISTS visitors_business_id_idx ON visitors(business_id);
CREATE INDEX IF NOT EXISTS visitors_visitor_id_idx ON visitors(visitor_id);

-- ============================================================
-- 第6部分: 初始化默认数据
-- ============================================================

-- 默认管理员（admin / 123456）
INSERT OR IGNORE INTO admin_users (username, password_hash, email, name, status)
VALUES ('admin', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin@example.com', '系统管理员', 'active');

-- 默认商家主账号（admin / 123456）
INSERT OR IGNORE INTO staff_users (username, password_hash, email, name, role, status, enable_auto_trans, default_lang, business_id, business_slug, business_name)
VALUES ('admin', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin@example.com', '系统管理员', 'admin', 'active', 1, 'zh-CN', 0, 'default', '默认商家');

-- 修复已有 admin 用户数据
UPDATE staff_users
SET
  business_id = COALESCE(business_id, 0),
  business_slug = COALESCE(NULLIF(business_slug, ''), 'default'),
  business_name = COALESCE(NULLIF(business_name, ''), '默认商家'),
  role = 'admin',
  enable_auto_trans = COALESCE(enable_auto_trans, 1),
  default_lang = COALESCE(NULLIF(default_lang, ''), 'zh-CN'),
  updated_at = unixepoch() * 1000
WHERE username = 'admin';

-- 默认角色
INSERT OR IGNORE INTO roles (name, description, permissions, is_system, status)
VALUES ('超级管理员', '系统默认超级管理员，拥有所有权限', '["admin_view","admin_edit","staff_view","staff_edit","role_view","role_edit","settings"]', 1, 'active');

-- 默认系统配置
INSERT OR IGNORE INTO admin_config (key, value, description) VALUES ('siteName', 'CF智能多语言在线客服系统', '网站名称');
INSERT OR IGNORE INTO admin_config (key, value, description) VALUES ('defaultLanguage', 'zh-CN', '默认语言');
INSERT OR IGNORE INTO admin_config (key, value, description) VALUES ('enableAuth', 'true', '启用认证');

-- 修正旧 sessions 的 business_id（将 business_id=1 改为 0，指向 admin 商家）
UPDATE sessions SET business_id = 0 WHERE business_id = 1
  AND EXISTS (SELECT 1 FROM staff_users WHERE id = 0 AND username = 'admin');

-- ============================================================
-- 第7部分: 最终验证
-- ============================================================

SELECT '========== 表清单 ==========' AS check;

SELECT name AS table_name FROM sqlite_master WHERE type='table' ORDER BY name;

SELECT '========== 新表检查 ==========' AS check;

SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ business_domains 已存在'
  ELSE '❌ business_domains 缺失！' END AS check_new_tables
FROM sqlite_master WHERE type='table' AND name='business_domains'
UNION ALL
SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ business_ai_config 已存在'
  ELSE '❌ business_ai_config 缺失！' END
FROM sqlite_master WHERE type='table' AND name='business_ai_config'
UNION ALL
SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ domain_operation_logs 已存在'
  ELSE '❌ domain_operation_logs 缺失！' END
FROM sqlite_master WHERE type='table' AND name='domain_operation_logs';

SELECT '========== 关键字段检查 ==========' AS check;

SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ staff_users.business_id 已存在'
  ELSE '❌ staff_users.business_id 缺失！' END AS check_critical_columns
FROM pragma_table_info('staff_users') WHERE name='business_id'
UNION ALL
SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ staff_users.enable_auto_trans 已存在'
  ELSE '❌ staff_users.enable_auto_trans 缺失！' END
FROM pragma_table_info('staff_users') WHERE name='enable_auto_trans'
UNION ALL
SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ staff_users.default_lang 已存在'
  ELSE '❌ staff_users.default_lang 缺失！' END
FROM pragma_table_info('staff_users') WHERE name='default_lang'
UNION ALL
SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ sessions.business_id 已存在'
  ELSE '❌ sessions.business_id 缺失！' END
FROM pragma_table_info('sessions') WHERE name='business_id'
UNION ALL
SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ messages.translated_content 已存在'
  ELSE '❌ messages.translated_content 缺失！' END
FROM pragma_table_info('messages') WHERE name='translated_content'
UNION ALL
SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ transfer_requests.reject_reason 已存在'
  ELSE '❌ transfer_requests.reject_reason 缺失！' END
FROM pragma_table_info('transfer_requests') WHERE name='reject_reason'
UNION ALL
SELECT
  CASE WHEN COUNT(*) > 0 THEN '✅ sentences.business_id 已存在'
  ELSE '❌ sentences.business_id 缺失！' END
FROM pragma_table_info('sentences') WHERE name='business_id';

SELECT '========== admin 用户检查 ==========' AS check;

SELECT
  id, username, business_id, business_slug, role, enable_auto_trans, default_lang,
  CASE
    WHEN role = 'admin' AND business_id = 0 THEN '✅ 配置正确'
    ELSE '⚠️ 需修复'
  END AS status
FROM staff_users WHERE username = 'admin';

SELECT '========== 同步完成！如有 ❌ 标记请往上滚动查看具体错误 ==========' AS done;
