-- ==========================================
-- D1 数据库迁移脚本 — 添加缺失字段
-- 适用于已存在的数据库修复
-- ==========================================

-- ===== 第1步：检查 sessions 表缺失的字段 =====
-- 添加 last_visitor_activity_at 字段（访客最后活动时间）
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_visitor_activity_at INTEGER;

-- ===== 第2步：检查 transfer_requests 表缺失的字段 =====
-- 添加 reject_reason 字段（转接拒绝原因）
ALTER TABLE transfer_requests ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- ===== 第3步：检查 staff_users 表缺失的字段 =====
-- 添加 last_active 字段（客服最后活跃时间）
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS last_active INTEGER;

-- ===== 第4步：检查 sentences 表缺失的字段 =====
-- 添加 business_id 字段（多租户隔离）
ALTER TABLE sentences ADD COLUMN IF NOT EXISTS business_id INTEGER NOT NULL DEFAULT 0;

-- ===== 第5步：添加缺失的索引 =====
-- transfer_requests 表的 from_staff_id 索引
CREATE INDEX IF NOT EXISTS transfer_requests_from_staff_id_idx ON transfer_requests(from_staff_id);

-- sentences 表的 business_id 索引
CREATE INDEX IF NOT EXISTS sentences_business_id_idx ON sentences(business_id);

-- ===== 第6步：验证修复结果 =====
SELECT '=== 迁移完成验证 ===' AS check;

-- 检查 sessions 表
SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ sessions.last_visitor_activity_at 字段存在' 
    ELSE '❌ sessions 缺少 last_visitor_activity_at 字段'
  END AS check_sessions_lva
FROM pragma_table_info('sessions') 
WHERE name = 'last_visitor_activity_at';

-- 检查 transfer_requests 表
SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ transfer_requests.reject_reason 字段存在' 
    ELSE '❌ transfer_requests 缺少 reject_reason 字段'
  END AS check_transfer_reject
FROM pragma_table_info('transfer_requests') 
WHERE name = 'reject_reason';

-- 检查 staff_users 表
SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ staff_users.last_active 字段存在' 
    ELSE '❌ staff_users 缺少 last_active 字段'
  END AS check_staff_last_active
FROM pragma_table_info('staff_users') 
WHERE name = 'last_active';

-- 检查 sentences 表
SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ sentences.business_id 字段存在' 
    ELSE '❌ sentences 缺少 business_id 字段'
  END AS check_sentences_bid
FROM pragma_table_info('sentences') 
WHERE name = 'business_id';

-- 检查索引
SELECT 
  CASE WHEN COUNT(*) > 0 
    THEN '✅ transfer_requests_from_staff_id_idx 索引存在' 
    ELSE '❌ 缺少 transfer_requests_from_staff_id_idx 索引'
  END AS check_idx_from_staff
FROM pragma_index_list('transfer_requests') 
WHERE name = 'transfer_requests_from_staff_id_idx';

SELECT '=== 迁移脚本执行完成 ===' AS result;