-- ==========================================
-- D1 数据库翻译功能诊断与修复 SQL
-- 数据库 ID: 91fad6d8-e535-4bc0-95fc-2b69c32c7d22
-- 在 D1 Studio 中按顺序执行
-- ==========================================

-- ===== 第1步：诊断 — 检查 messages 表是否有 translated_content 列 =====
-- 如果结果中没有 translated_content，说明缺少该列
PRAGMA table_info(messages);

-- ===== 第2步：修复 — 添加 translated_content 列（如果缺失） =====
-- 注意：如果第1步已显示有该列，跳过此步
ALTER TABLE messages ADD COLUMN translated_content TEXT;

-- ===== 第3步：诊断 — 检查翻译配置 =====
-- 查看所有商家的翻译设置
SELECT 
  id,
  username,
  business_name,
  business_slug,
  role,
  enable_auto_trans,
  CASE WHEN bd_trans_appid IS NOT NULL AND bd_trans_appid != '' THEN '✅ 已配置' ELSE '❌ 未配置' END AS appid_status,
  CASE WHEN bd_trans_secret IS NOT NULL AND bd_trans_secret != '' THEN '✅ 已配置' ELSE '❌ 未配置' END AS secret_status,
  default_lang,
  business_id
FROM staff_users
ORDER BY id;

-- ===== 第4步：修复 — 为默认商家启用翻译开关 =====
-- 此 SQL 将 enable_auto_trans 设为 1（打开翻译开关）
-- ⚠️ 还需要在后台「系统设置」页面填入真实的百度翻译 API 凭据才能生效
UPDATE staff_users 
SET enable_auto_trans = 1,
    updated_at = unixepoch() * 1000
WHERE id = 1 AND enable_auto_trans = 0;

-- ===== 第4.1步：如果已有百度翻译 API 凭据，执行以下 SQL 填入 =====
-- (将 YOUR_APPID 和 YOUR_SECRET 替换为真实值)
-- 在 https://fanyi-api.baidu.com/ 注册获取
-- UPDATE staff_users 
-- SET bd_trans_appid = 'YOUR_APPID', 
--     bd_trans_secret = 'YOUR_SECRET',
--     updated_at = unixepoch() * 1000
-- WHERE id = 1;

-- ===== 第5步：诊断 — 检查近期消息的翻译内容 =====
-- 查看最近10条文本消息的原文和翻译
SELECT 
  id,
  session_id,
  sender_type,
  content,
  translated_content,
  CASE 
    WHEN translated_content IS NOT NULL AND translated_content != '' THEN '✅ 有翻译'
    WHEN content_type = 'text' THEN '⚠️ 无翻译'
    ELSE '-'
  END AS translation_status,
  datetime(created_at / 1000, 'unixepoch') AS created_time
FROM messages
WHERE content_type = 'text'
ORDER BY id DESC
LIMIT 10;

-- ===== 第6步：诊断 — 检查会话语言设置 =====
-- 查看活跃会话的语言设置
SELECT 
  id,
  visitor_name,
  lang,
  business_id,
  status
FROM sessions
WHERE status = 'active'
ORDER BY last_message_at DESC
LIMIT 5;

-- ===== 第7步：最终验证 =====
-- 确认所有表结构正确
SELECT 'messages translated_content' AS check_item,
  COUNT(*) AS column_exists
FROM pragma_table_info('messages')
WHERE name = 'translated_content';
