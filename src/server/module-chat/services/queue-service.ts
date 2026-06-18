/**
 * Queue Service - Handles queue position and wait time calculations
 */

import { getDb } from '@server/shared/db';
import type { QueueInfo, QueueItem, TaskStatus } from '@shared/types';

// Average handling time in minutes (configurable)
const AVG_HANDLE_TIME_MINUTES = 5;

interface SessionQueueRow {
  id: string;
  created_at: number;
}

interface CountRow {
  count: number;
}

interface QueueListRow {
  sessionId: string;
  visitorName: string;
  topic: string | null;
  taskStatus: string;
  createdAt: number;
}

/**
 * Calculate queue position for a session
 * Position is based on creation time among sessions in discussion/confirmed status
 */
export async function calculateQueuePosition(sessionId: string): Promise<number> {
  const db = getDb();

  const rows = await db.all<SessionQueueRow>(
    `SELECT id, created_at
     FROM sessions
     WHERE status = 'active'
     AND task_status IN ('requirement_discussion', 'requirement_confirmed')
     ORDER BY created_at ASC`
  );

  const position = rows.findIndex((row) => row.id === sessionId) + 1;
  return position > 0 ? position : 0;
}

/**
 * Estimate wait time for a session (in minutes)
 * Based on queue position and average handling time
 */
export async function estimateWaitTime(sessionId: string): Promise<number> {
  const position = await calculateQueuePosition(sessionId);

  if (position <= 1) {
    return 0;
  }

  // Wait time = (position - 1) * average handle time
  return (position - 1) * AVG_HANDLE_TIME_MINUTES;
}

/**
 * Get queue info for a specific session
 */
export async function getQueueInfo(sessionId: string): Promise<QueueInfo> {
  const db = getDb();
  const [position, estimatedWaitMinutes] = await Promise.all([
    calculateQueuePosition(sessionId),
    estimateWaitTime(sessionId),
  ]);

  // Get total in queue
  const row = await db.get<CountRow>(
    `SELECT COUNT(*) as count
     FROM sessions
     WHERE status = 'active'
     AND task_status IN ('requirement_discussion', 'requirement_confirmed')`
  );
  const totalInQueue = row?.count || 0;

  return {
    position,
    estimatedWaitMinutes,
    totalInQueue,
  };
}

/**
 * Get all items in the queue (for staff view)
 */
export async function getQueueList(): Promise<QueueItem[]> {
  const db = getDb();

  // 只查询等待中的会话，不包括进行中的会话
  const rows = await db.all<QueueListRow>(
    `SELECT
      id as sessionId,
      visitor_name as visitorName,
      topic,
      task_status as taskStatus,
      created_at as createdAt
    FROM sessions
    WHERE status = 'active'
    AND task_status IN ('requirement_discussion', 'requirement_confirmed')
    ORDER BY
      CASE task_status
        WHEN 'requirement_confirmed' THEN 1
        WHEN 'requirement_discussion' THEN 2
      END,
      created_at ASC`
  );

  // Calculate position and wait time for each
  let confirmedPosition = 0;
  let discussionPosition = 0;

  return rows.map((row) => {
    let position = 1;
    let waitMinutes = 0;

    if (row.taskStatus === 'requirement_confirmed') {
      confirmedPosition++;
      position = confirmedPosition;
      waitMinutes = (position - 1) * AVG_HANDLE_TIME_MINUTES;
    } else if (row.taskStatus === 'requirement_discussion') {
      discussionPosition++;
      position = confirmedPosition + discussionPosition;
      waitMinutes = (position - 1) * AVG_HANDLE_TIME_MINUTES;
    }

    return {
      sessionId: row.sessionId,
      visitorName: row.visitorName,
      topic: row.topic || undefined,
      taskStatus: row.taskStatus as TaskStatus,
      position,
      waitMinutes,
      createdAt: new Date(row.createdAt),
    };
  });
}

/**
 * Get queue items for current staff member (their own sessions + pending transfer requests)
 */
export async function getStaffQueueList(staffId: number): Promise<{
  sessions: QueueItem[];
  transferRequests: any[];
}> {
  const db = getDb();

  // Get sessions assigned to this staff that are waiting
  const sessionRows = await db.all<QueueListRow>(
    `SELECT
      s.id as sessionId,
      s.visitor_name as visitorName,
      s.topic,
      s.task_status as taskStatus,
      s.created_at as createdAt
    FROM sessions s
    WHERE s.status = 'active'
    AND s.assigned_staff_id = ?
    AND s.task_status IN ('requirement_discussion', 'requirement_confirmed')
    ORDER BY
      CASE s.task_status
        WHEN 'requirement_confirmed' THEN 1
        WHEN 'requirement_discussion' THEN 2
      END,
      s.created_at ASC`,
    [staffId]
  );

  // Get pending transfer requests where this staff is the target
  const transferRows = await db.all(
    `SELECT
      tr.id,
      tr.session_id as sessionId,
      tr.from_staff_id as fromStaffId,
      tr.to_staff_id as toStaffId,
      tr.reason,
      tr.created_at as createdAt,
      s.visitor_name as visitorName,
      s.topic,
      u.username as fromStaffUsername,
      u.name as fromStaffName
    FROM transfer_requests tr
    JOIN sessions s ON tr.session_id = s.id
    JOIN staff_users u ON tr.from_staff_id = u.id
    WHERE tr.to_staff_id = ?
    AND tr.status = 'pending'
    ORDER BY tr.created_at DESC`,
    [staffId]
  );

  // Calculate positions for sessions
  let confirmedPosition = 0;
  let discussionPosition = 0;

  const sessions = sessionRows.map((row) => {
    let position = 1;
    let waitMinutes = 0;

    if (row.taskStatus === 'requirement_confirmed') {
      confirmedPosition++;
      position = confirmedPosition;
      waitMinutes = (position - 1) * AVG_HANDLE_TIME_MINUTES;
    } else if (row.taskStatus === 'requirement_discussion') {
      discussionPosition++;
      position = confirmedPosition + discussionPosition;
      waitMinutes = (position - 1) * AVG_HANDLE_TIME_MINUTES;
    }

    return {
      sessionId: row.sessionId,
      visitorName: row.visitorName,
      topic: row.topic || undefined,
      taskStatus: row.taskStatus as TaskStatus,
      position,
      waitMinutes,
      createdAt: new Date(row.createdAt),
    };
  });

  // Enrich transfer requests with staff names
  const transferRequests = transferRows.map((row: any) => ({
    ...row,
    fromStaffName: row.fromStaffName || row.fromStaffUsername,
  }));

  return {
    sessions,
    transferRequests,
  };
}

/**
 * Update queue position and estimated wait time for a session
 */
export async function updateSessionQueueInfo(sessionId: string): Promise<void> {
  const db = getDb();
  const position = await calculateQueuePosition(sessionId);
  const estimatedWaitMinutes = await estimateWaitTime(sessionId);

  await db.run(
    `UPDATE sessions
     SET queue_position = ?, estimated_wait_minutes = ?, updated_at = ?
     WHERE id = ?`,
    [
      position > 0 ? position : null,
      estimatedWaitMinutes > 0 ? estimatedWaitMinutes : null,
      Date.now(),
      sessionId,
    ]
  );
}

/**
 * Recalculate queue info for all active sessions
 * Call this when a session status changes or a session is closed
 */
export async function recalculateAllQueueInfo(): Promise<void> {
  const db = getDb();

  const rows = await db.all<{ id: string }>(
    `SELECT id FROM sessions
     WHERE status = 'active'
     AND task_status IN ('requirement_discussion', 'requirement_confirmed')`
  );

  for (const row of rows) {
    await updateSessionQueueInfo(row.id);
  }
}
