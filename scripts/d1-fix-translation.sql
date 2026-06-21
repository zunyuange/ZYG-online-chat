-- ==========================================
-- D1 数据库翻译功能诊断与修复 SQL
-- 数据库 ID: 91fad6d8-e535-4bc0-95fc-2b69c32c7d22
-- 在 D1 Studio 中按顺序执行所有语句
-- 
-- 🆕 v2: 已内置 MyMemory 免费翻译后备方案
--     无需百度翻译 API 凭据也能自动翻译！
--     只需执行第1步+第4步启用翻译开关即可
-- ==========================================

-- ===== 第1步：修复 — 添加翻译相关列（如缺失，忽略报错） =====
ALTER TABLE messages ADD COLUMN translated_content TEXT;
ALTER TABLE messages ADD COLUMN translate_engine TEXT;
ALTER TABLE messages ADD COLUMN translated_at INTEGER;

-- ===== 第2步：诊断 — 检查 messages 表结构 =====
PRAGMA table_info(messages);

-- ===== 第3步：诊断 — 检查翻译配置 =====
-- 查看所有商家的翻译设置
SELECT 
  id,
  username,
  business_name,
  role,
  enable_auto_trans,
  CASE WHEN bd_trans_appid IS NOT NULL AND bd_trans_appid != '' THEN '✅ Baidu' ELSE '❌ 未配置' END AS baidu_appid,
  CASE WHEN bd_trans_secret IS NOT NULL AND bd_trans_secret != '' THEN '✅ Baidu' ELSE '❌ 未配置' END AS baidu_secret,
  default_lang,
  CASE WHEN enable_auto_trans = 1 THEN 
    CASE WHEN bd_trans_appid IS NOT NULL AND bd_trans_appid != '' AND bd_trans_secret IS NOT NULL AND bd_trans_secret != '' 
      THEN '🔵 百度翻译' 
      ELSE '🟢 MyMemory 免费'
    END
    ELSE '⭕ 翻译已关闭'
  END AS translate_provider
FROM staff_users
ORDER BY id;

-- ===== 第4步：修复 — 启用所有商家的翻译开关（enable_auto_trans = 1） =====
-- 启用后即默认使用 MyMemory 免费翻译，无需额外配置
UPDATE staff_users 
SET enable_auto_trans = 1,
    updated_at = unixepoch() * 1000
WHERE enable_auto_trans = 0;

-- ===== 第4.1步（可选）：配置百度翻译 API 凭据以获得更高质量的翻译 =====
-- 注册地址: https://fanyi-api.baidu.com/
-- UPDATE staff_users 
-- SET bd_trans_appid = 'YOUR_APPID', 
--     bd_trans_secret = 'YOUR_SECRET',
--     updated_at = unixepoch() * 1000
-- WHERE id = 1;

-- ===== 第5步：诊断 — 检查近期消息的翻译内容 =====
SELECT 
  id,
  session_id,
  sender_type,
  content_type,
  CASE WHEN length(content) > 30 THEN substr(content, 1, 30) || '…' ELSE content END AS content,
  CASE WHEN length(translated_content) > 30 THEN substr(translated_content, 1, 30) || '…' WHEN translated_content IS NOT NULL THEN translated_content ELSE NULL END AS translated,
  translate_engine,
  CASE 
    WHEN translated_content IS NOT NULL AND translated_content != '' THEN '✅ 有翻译 (' || COALESCE(translate_engine, 'unknown') || ')'
    WHEN content_type = 'text' THEN '⚠️ 无翻译（需要发新消息触发）'
    ELSE '-'
  END AS translation_status,
  datetime(created_at / 1000, 'unixepoch') AS created_time
FROM messages
WHERE content_type = 'text'
ORDER BY id DESC
LIMIT 10;

-- ===== 第6步：诊断 — 检查活跃会话语言设置 =====
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
SELECT '✅ 翻译功能修复完成' AS result,
  CASE 
    WHEN (SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'translated_content') > 0 
    THEN '数据库列 ✅'
    ELSE '数据库列 ❌（请重新执行第1步）'
  END AS db_column,
  CASE 
    WHEN (SELECT COUNT(*) FROM staff_users WHERE enable_auto_trans = 1) > 0 
    THEN '翻译开关 ✅'
    ELSE '翻译开关 ❌（请重新执行第4步）' 
  END AS trans_switch,
  CASE 
    WHEN (SELECT COUNT(*) FROM staff_users WHERE bd_trans_appid IS NOT NULL AND bd_trans_appid != '' AND bd_trans_secret IS NOT NULL AND bd_trans_secret != '') > 0 
    THEN '🔵 百度翻译已配置'
    ELSE '🟢 MyMemory 免费翻译（无需凭据）'
  END AS provider;
