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

  const rows = await db.all<QueueListRow>(
    `SELECT
      id as sessionId,
      visitor_name as visitorName,
      topic,
      task_status as taskStatus,
      created_at as createdAt
    FROM sessions
    WHERE status = 'active'
    AND task_status IN ('requirement_discussion', 'requirement_confirmed', 'in_progress')
    ORDER BY
      CASE task_status
        WHEN 'in_progress' THEN 1
        WHEN 'requirement_confirmed' THEN 2
        WHEN 'requirement_discussion' THEN 3
      END,
      created_at ASC`
  );

  // Calculate position and wait time for each
  let discussionPosition = 0;

  return rows.map((row) => {
    let position = 1;
    let waitMinutes = 0;

    if (row.taskStatus === 'requirement_discussion' || row.taskStatus === 'requirement_confirmed') {
      discussionPosition++;
      position = discussionPosition;
      waitMinutes = (position - 1) * AVG_HANDLE_TIME_MINUTES;
    } else if (row.taskStatus === 'in_progress') {
      position = 0; // Currently being handled
      waitMinutes = 0;
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
