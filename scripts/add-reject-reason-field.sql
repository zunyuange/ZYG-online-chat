-- 为 transfer_requests 表添加 reject_reason 字段（如果不存在）
ALTER TABLE transfer_requests ADD COLUMN reject_reason TEXT;
