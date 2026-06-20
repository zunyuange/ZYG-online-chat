-- ==========================================
-- D1 数据库紧急修复 SQL — 添加关键缺失列
-- 数据库 ID: 91fad6d8-e535-4bc0-95fc-2b69c32c7d22
-- 
-- 使用方式: 在 Cloudflare Dashboard → D1 → zyg-online-chat-db → Console 中
-- 按顺序执行所有语句（或选择需要的步骤执行）
-- 
-- 问题症状: 
--   - 访客页面显示 "Failed to create session"
--   - 切换语言后页面崩溃
--   
-- 根本原因: staff_users 和 sessions 表缺少关键列
--   staff_users: business_id, enable_auto_trans, bd_trans_appid, default_lang
--   sessions: business_id
-- ==========================================

-- ===== 第1步：诊断 — 查看 staff_users 表结构 =====
PRAGMA table_info(staff_users);

-- ===== 第2步：修复 staff_users 表 — 添加缺失的关键列 =====
-- 2.1 添加 business_id（多租户隔离核心列，getBusinessBySlug 依赖）
--     注意：如果列已存在会报错，请先执行第1步确认
ALTER TABLE staff_users ADD COLUMN business_id INTEGER NOT NULL DEFAULT 0;

-- 2.2 添加 enable_auto_trans（翻译开关）
ALTER TABLE staff_users ADD COLUMN enable_auto_trans INTEGER NOT NULL DEFAULT 0;

-- 2.3 添加 bd_trans_appid（百度翻译 AppID，可选）
ALTER TABLE staff_users ADD COLUMN bd_trans_appid TEXT;

-- 2.4 添加 bd_trans_secret（百度翻译密钥，可选）
ALTER TABLE staff_users ADD COLUMN bd_trans_secret TEXT;

-- 2.5 添加 bd_trans_token（旧版翻译密钥，兼容）
ALTER TABLE staff_users ADD COLUMN bd_trans_token TEXT;

-- 2.6 添加 default_lang（默认语言，翻译方向依赖）
ALTER TABLE staff_users ADD COLUMN default_lang TEXT NOT NULL DEFAULT 'zh-CN';

-- 2.7 添加 last_active（客服最后活跃时间，可选）
ALTER TABLE staff_users ADD COLUMN last_active INTEGER;

-- 2.8 添加 business_slug（如果缺失）
ALTER TABLE staff_users ADD COLUMN business_slug TEXT;

-- 2.9 添加 business_name（如果缺失）
ALTER TABLE staff_users ADD COLUMN business_name TEXT;

-- ===== 第3步：诊断 — 查看 sessions 表结构 =====
PRAGMA table_info(sessions);

-- ===== 第4步：修复 sessions 表 — 添加缺失的列 =====
-- 4.1 添加 business_id（多租户隔离）
ALTER TABLE sessions ADD COLUMN business_id INTEGER NOT NULL DEFAULT 1;

-- 4.2 添加访客自定义字段列
ALTER TABLE sessions ADD COLUMN email TEXT;
ALTER TABLE sessions ADD COLUMN phone TEXT;
ALTER TABLE sessions ADD COLUMN pid TEXT;
ALTER TABLE sessions ADD COLUMN params TEXT;
ALTER TABLE sessions ADD COLUMN referer TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;

-- ===== 第5步：修复 staff_users 数据 — 确保 admin 用户正确 =====
-- 先查看当前 admin 用户状态
SELECT id, username, business_id, business_slug, business_name, role, enable_auto_trans, default_lang 
FROM staff_users WHERE username = 'admin';

-- 5.1 如果 admin 用户不存在则创建
INSERT OR IGNORE INTO staff_users (username, password_hash, email, name, role, status, enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang, business_id, business_slug, business_name)
VALUES ('admin', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin@example.com', '系统管理员', 'admin', 'active', 1, '', '', 'zh-CN', 0, 'default', '默认商家');

-- 5.2 如果 admin 用户存在但数据不完整，修复之
UPDATE staff_users 
SET 
  business_id = CASE WHEN business_id IS NULL THEN 0 ELSE business_id END,
  business_slug = COALESCE(NULLIF(business_slug, ''), 'default'),
  business_name = COALESCE(NULLIF(business_name, ''), '默认商家'),
  role = 'admin',
  enable_auto_trans = COALESCE(enable_auto_trans, 1),
  default_lang = COALESCE(NULLIF(default_lang, ''), 'zh-CN'),
  updated_at = unixepoch() * 1000
WHERE username = 'admin';

-- ===== 第6步：修复 — 修正旧 sessions 数据的 business_id =====
-- 将 business_id = 1 的旧会话修正为 0（指向默认商家 admin 用户）
UPDATE sessions SET business_id = 0 WHERE business_id = 1 
  AND EXISTS (SELECT 1 FROM staff_users WHERE id = 0 AND username = 'admin');

-- ===== 第7步：创建缺失的索引 =====
CREATE INDEX IF NOT EXISTS sessions_business_id_idx ON sessions(business_id);
CREATE INDEX IF NOT EXISTS staff_users_business_id_idx ON staff_users(business_id);
CREATE INDEX IF NOT EXISTS staff_users_business_slug_idx ON staff_users(business_slug);

-- ===== 第8步：修复 messages 表 — 添加 translated_content 列 =====
ALTER TABLE messages ADD COLUMN translated_content TEXT;

-- ===== 第9步：最终验证 =====
SELECT '=== final verification ===' AS check;

SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ staff_users business_id 列存在' 
    ELSE '❌ staff_users 缺少 business_id 列！请重新执行第2.1步'
  END AS check_staff_bid
FROM pragma_table_info('staff_users') 
WHERE name = 'business_id';

SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ sessions business_id 列存在' 
    ELSE '❌ sessions 缺少 business_id 列！请重新执行第4.1步'
  END AS check_sessions_bid
FROM pragma_table_info('sessions') 
WHERE name = 'business_id';

SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ messages translated_content 列存在' 
    ELSE '⚠️ messages 缺少 translated_content 列'
  END AS check_msg_trans
FROM pragma_table_info('messages') 
WHERE name = 'translated_content';

-- 验证 admin 用户
SELECT 
  id, username, business_id, business_slug, role, enable_auto_trans, default_lang,
  CASE 
    WHEN role = 'admin' AND (business_id = 0 OR business_id IS NULL) THEN '✅ 配置正确'
    ELSE '❌ 配置有误！请重新执行第5步'
  END AS status
FROM staff_users WHERE username = 'admin';
