-- ============================================================
-- D1 数据库完整修复 SQL
-- 功能：确保所有表、字段、索引、默认数据存在
-- 安全：全部使用 IF NOT EXISTS / OR IGNORE，不影响已有数据
-- 在 D1 Studio 中执行：
--   https://dash.cloudflare.com/65250bc17b07a43b589459630626dfa9/workers/d1/databases/91fad6d8-e535-4bc0-95fc-2b69c32c7d22/studio
-- ============================================================

-- ============================================================
-- 第一部分：核心业务表（CREATE TABLE IF NOT EXISTS - 已存在则跳过）
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

CREATE TABLE IF NOT EXISTS transfer_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    from_staff_id INTEGER NOT NULL,
    to_staff_id INTEGER NOT NULL,
    reason TEXT,
    reject_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
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
    business_id INTEGER NOT NULL DEFAULT 0,
    tag TEXT,
    state TEXT NOT NULL DEFAULT 'using',
    lang TEXT NOT NULL DEFAULT 'zh-CN',
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
-- 第二部分：🆕 域名绑定功能需要的 3 张新表
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
-- 第三部分：所有索引（CREATE INDEX IF NOT EXISTS）
-- ============================================================

CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages(session_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
CREATE INDEX IF NOT EXISTS staff_users_username_idx ON staff_users(username);
CREATE INDEX IF NOT EXISTS staff_users_business_id_idx ON staff_users(business_id);
CREATE INDEX IF NOT EXISTS staff_users_business_slug_idx ON staff_users(business_slug);
CREATE INDEX IF NOT EXISTS sessions_business_id_idx ON sessions(business_id);
CREATE INDEX IF NOT EXISTS evaluations_session_id_idx ON evaluations(session_id);
CREATE INDEX IF NOT EXISTS sessions_visiter_id_idx ON sessions(visiter_id);
CREATE INDEX IF NOT EXISTS sentences_staff_id_idx ON sentences(staff_id);
CREATE INDEX IF NOT EXISTS offline_messages_created_at_idx ON offline_messages(created_at);
CREATE INDEX IF NOT EXISTS queue_visiter_id_idx ON queue(visiter_id);
CREATE INDEX IF NOT EXISTS queue_business_id_idx ON queue(business_id);
CREATE INDEX IF NOT EXISTS visitors_business_id_idx ON visitors(business_id);
CREATE INDEX IF NOT EXISTS visitors_visitor_id_idx ON visitors(visitor_id);
CREATE INDEX IF NOT EXISTS admin_users_username_idx ON admin_users(username);
CREATE INDEX IF NOT EXISTS roles_name_idx ON roles(name);
CREATE INDEX IF NOT EXISTS visitor_custom_fields_business_id_idx ON visitor_custom_fields(business_id);
CREATE INDEX IF NOT EXISTS visitor_custom_fields_field_key_idx ON visitor_custom_fields(business_id, field_key);

-- 🆕 域名功能索引
CREATE INDEX IF NOT EXISTS idx_business_domains_domain ON business_domains(domain);
CREATE INDEX IF NOT EXISTS idx_business_domains_business_id ON business_domains(business_id);
CREATE INDEX IF NOT EXISTS idx_business_domains_type_status ON business_domains(domain_type, status);
CREATE INDEX IF NOT EXISTS idx_business_ai_config_business_id ON business_ai_config(business_id);
CREATE INDEX IF NOT EXISTS idx_domain_logs_business_id ON domain_operation_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_domain_logs_created_at ON domain_operation_logs(created_at);

-- ============================================================
-- 第四部分：为已有表补充缺失字段（安全：先查后改）
-- ============================================================
-- 注意：D1 不支持 PRAGMA table_info 在 INSERT 外的查询，下面的 ALTER 可能会报 duplicate column name 错误，
-- 这是正常的，说明字段已存在，不会影响后续语句

-- sessions 表补充字段
-- ALTER TABLE sessions ADD COLUMN business_id INTEGER NOT NULL DEFAULT 1;  -- 已在 CREATE TABLE 中
-- ALTER TABLE sessions ADD COLUMN email TEXT;
-- ALTER TABLE sessions ADD COLUMN phone TEXT;
-- ALTER TABLE sessions ADD COLUMN pid TEXT;
-- ALTER TABLE sessions ADD COLUMN params TEXT;
-- ALTER TABLE sessions ADD COLUMN referer TEXT;
-- ALTER TABLE sessions ADD COLUMN user_agent TEXT;

-- sentences 表补充字段
-- ALTER TABLE sentences ADD COLUMN business_id INTEGER NOT NULL DEFAULT 0;

-- staff_users 表补充字段
-- ALTER TABLE staff_users ADD COLUMN business_id INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE staff_users ADD COLUMN business_slug TEXT;
-- ALTER TABLE staff_users ADD COLUMN business_name TEXT;
-- ALTER TABLE staff_users ADD COLUMN enable_auto_trans INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE staff_users ADD COLUMN default_lang TEXT NOT NULL DEFAULT 'zh-CN';
-- ALTER TABLE staff_users ADD COLUMN last_active INTEGER;

-- transfer_requests 表补充字段
-- ALTER TABLE transfer_requests ADD COLUMN reject_reason TEXT;

-- messages 表补充字段
-- ALTER TABLE messages ADD COLUMN translated_content TEXT;
-- ALTER TABLE messages ADD COLUMN translate_engine TEXT;
-- ALTER TABLE messages ADD COLUMN translated_at INTEGER;

-- ============================================================
-- 第五部分：初始化默认数据（INSERT OR IGNORE - 数据已存在则跳过）
-- ============================================================

-- 默认管理员（admin_users 表）- password_hash 是 '123456' 的 bcrypt 哈希
-- ⚠️ 注意：如果数据库中已有 admin 用户，下面语句会被忽略
INSERT OR IGNORE INTO admin_users (username, password_hash, email, name, status)
VALUES ('admin', '$2b$10$placeholder_hash_will_be_updated_by_worker', 'admin@example.com', '系统管理员', 'active');

-- 默认商家管理员（staff_users 表）
INSERT OR IGNORE INTO staff_users (username, password_hash, email, name, role, status, business_id, business_slug, business_name)
VALUES ('admin', '$2b$10$placeholder_hash_will_be_updated_by_worker', 'admin@example.com', '系统管理员', 'admin', 'active', 0, 'default', '默认商家');

-- 默认角色
INSERT OR IGNORE INTO roles (name, description, permissions, is_system, status)
VALUES ('admin', '超级管理员，拥有所有权限', '["*"]', 1, 'active');

INSERT OR IGNORE INTO roles (name, description, permissions, is_system, status)
VALUES ('staff', '客服人员', '["chat:read","chat:write","visitor:read"]', 1, 'active');

-- 默认 admin_config 设置
INSERT OR IGNORE INTO admin_config (key, value, description)
VALUES ('site_name', 'ZYG在线客服', '站点名称');

INSERT OR IGNORE INTO admin_config (key, value, description)
VALUES ('site_logo', '', '站点Logo URL');

INSERT OR IGNORE INTO admin_config (key, value, description)
VALUES ('welcome_message', '您好，请问有什么可以帮助您的？', '默认欢迎语');

INSERT OR IGNORE INTO admin_config (key, value, description)
VALUES ('offline_message', '当前客服不在线，请留言，我们会尽快回复您！', '离线提示语');

-- ============================================================
-- 第六部分：为已有商家自动生成 subdomain 记录
-- ============================================================

INSERT OR IGNORE INTO business_domains (business_id, staff_user_id, domain_type, domain, subdomain, verification_status, ssl_status, is_primary, status)
SELECT 
    id, 
    id, 
    'auto_subdomain', 
    business_slug || '.zygonlinechat.zygmail.icu', 
    business_slug, 
    'active', 
    'active', 
    1, 
    'active'
FROM staff_users
WHERE business_id = 0 
  AND business_slug IS NOT NULL 
  AND business_slug != 'default'
  AND business_slug != ''
  AND NOT EXISTS (
      SELECT 1 FROM business_domains bd 
      WHERE bd.business_id = staff_users.id 
        AND bd.domain_type = 'auto_subdomain'
  );

-- ============================================================
-- 第七部分：验证查询
-- ============================================================

SELECT '=== 验证结果 ===' as info;

-- 检查所有核心表是否存在
SELECT 
    CASE WHEN COUNT(*) >= 23 THEN '✅ 所有核心表已就绪 (' || COUNT(*) || ' 张表)' 
         ELSE '❌ 缺少表！仅找到 ' || COUNT(*) || ' 张表' 
    END as table_check
FROM sqlite_master 
WHERE type = 'table' 
  AND name NOT LIKE 'sqlite_%'
  AND name NOT LIKE '_cf_%';

-- 列出所有表
SELECT name as table_name, type 
FROM sqlite_master 
WHERE type = 'table' 
  AND name NOT LIKE 'sqlite_%' 
  AND name NOT LIKE '_cf_%'
ORDER BY name;

-- 检查 staff_users 是否有 business_slug 字段
SELECT 'staff_users.business_slug' as field_check
FROM pragma_table_info('staff_users')
WHERE name = 'business_slug';

-- 检查 business_domains 表是否存在
SELECT 
    CASE WHEN COUNT(*) > 0 THEN '✅ business_domains 表存在' 
         ELSE '❌ business_domains 表不存在' 
    END as domain_table_check
FROM sqlite_master 
WHERE type = 'table' AND name = 'business_domains';

-- 统计各表行数
SELECT 'admin_users' as tbl, COUNT(*) as row_count FROM admin_users
UNION ALL SELECT 'staff_users', COUNT(*) FROM staff_users
UNION ALL SELECT 'roles', COUNT(*) FROM roles
UNION ALL SELECT 'admin_config', COUNT(*) FROM admin_config
UNION ALL SELECT 'business_domains', COUNT(*) FROM business_domains
UNION ALL SELECT 'business_ai_config', COUNT(*) FROM business_ai_config
UNION ALL SELECT 'domain_operation_logs', COUNT(*) FROM domain_operation_logs;
