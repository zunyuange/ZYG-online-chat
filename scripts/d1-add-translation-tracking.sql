-- ==========================================
-- D1 数据库迁移：添加翻译追踪字段
-- 数据库 ID: 91fad6d8-e535-4bc0-95fc-2b69c32c7d22
-- 在 D1 Studio → Console 中按顺序执行
--
-- 新增字段:
--   messages.translate_engine  TEXT    — 翻译引擎名称 (baidu/google/mymemory)
--   messages.translated_at     INTEGER — 翻译时间戳 (毫秒)
-- ==========================================

-- ===== 第1步：诊断 — 检查 messages 表当前结构 =====
PRAGMA table_info(messages);

-- ===== 第2步：添加 translate_engine 列 =====
-- 记录翻译引擎名称，方便排查翻译问题
ALTER TABLE messages ADD COLUMN translate_engine TEXT;

-- ===== 第3步：添加 translated_at 列 =====
-- 记录翻译时间，用于显示翻译时效
ALTER TABLE messages ADD COLUMN translated_at INTEGER;

-- ===== 第4步（可选）：回填已有翻译数据的引擎 =====
-- 将已有 translated_content 的消息标记为 mymemory 引擎
-- （因为 mymemory 是最早的免费后备引擎）
UPDATE messages 
SET translate_engine = 'mymemory',
    translated_at = created_at
WHERE translated_content IS NOT NULL 
  AND translated_content != '' 
  AND translate_engine IS NULL;

-- ===== 第5步：验证 =====
SELECT '=== 迁移验证 ===' AS check;

SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ translate_engine 列存在' 
    ELSE '❌ translate_engine 列缺失！请重新执行第2步'
  END AS check_engine
FROM pragma_table_info('messages') 
WHERE name = 'translate_engine';

SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ translated_at 列存在' 
    ELSE '❌ translated_at 列缺失！请重新执行第3步'
  END AS check_trans_at
FROM pragma_table_info('messages') 
WHERE name = 'translated_at';

-- 查看最近翻译消息的引擎分布
SELECT 
  translate_engine,
  COUNT(*) as count,
  '条消息' as unit
FROM messages 
WHERE translate_engine IS NOT NULL
GROUP BY translate_engine
ORDER BY count DESC;

-- 查看最近5条翻译消息详情
SELECT 
  id,
  content_type,
  sender_type,
  CASE WHEN length(content) > 30 THEN substr(content, 1, 30) || '…' ELSE content END AS content_preview,
  CASE WHEN length(translated_content) > 30 THEN substr(translated_content, 1, 30) || '…' ELSE translated_content END AS translation_preview,
  translate_engine,
  translated_at
FROM messages
WHERE translated_content IS NOT NULL AND translated_content != ''
ORDER BY id DESC
LIMIT 5;
