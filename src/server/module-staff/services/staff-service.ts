/**
 * Staff service - handles staff-specific operations
 * Re-exports chat service functions and adds staff-specific helpers
 */

export {
  getSession,
  listSessions,
  getMessages,
  sendMessage,
  markAsRead,
} from '@server/module-chat/services/chat-service';

import { getSession as getSessionBase, listSessions as listSessionsBase } from '@server/module-chat/services/chat-service';
import { getDb } from '@server/shared/db';
import type { Session, SessionStatus, TaskStatus } from '@shared/types';

interface MessagePreviewRow {
  session_id: string;
  content: string;
  content_type: string;
  created_at: number;
}

interface UnreadCountRow {
  total: number | null;
}

/**
 * Update session topic
 */
export async function updateSessionTopic(sessionId: string, topic: string): Promise<Session | null> {
  const db = getDb();
  const now = Date.now();

  await db.run(
    'UPDATE sessions SET topic = ?, updated_at = ? WHERE id = ?',
    [topic, now, sessionId]
  );

  return getSessionBase(sessionId);
}

/**
 * Update session task status
 */
export async function updateTaskStatus(sessionId: string, taskStatus: TaskStatus): Promise<Session | null> {
  const db = getDb();
  const now = Date.now();

  await db.run(
    'UPDATE sessions SET task_status = ?, task_status_updated_at = ?, updated_at = ? WHERE id = ?',
    [taskStatus, now, now, sessionId]
  );

  return getSessionBase(sessionId);
}

/**
 * Get session with message preview
 */
export async function getSessionWithPreview(sessionId: string): Promise<{
  session: Session | null;
  lastMessage?: {
    content: string;
    contentType: string;
    createdAt: Date;
  };
}> {
  const session = await getSessionBase(sessionId);
  if (!session) {
    return { session: null };
  }

  // Get last message
  const db = getDb();
  const row = await db.get<MessagePreviewRow>(
    `SELECT session_id, content, content_type, created_at
     FROM messages
     WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId]
  );

  if (row) {
    return {
      session,
      lastMessage: {
        content: row.content,
        contentType: row.content_type,
        createdAt: new Date(row.created_at),
      },
    };
  }

  return { session };
}

/**
 * List sessions with last message preview
 */
export async function listSessionsWithPreview(status?: SessionStatus): Promise<
  (Session & {
    lastMessage?: {
      content: string;
      contentType: string;
      createdAt: Date;
    };
  })[]
> {
  const sessions = await listSessionsBase(status);

  if (sessions.length === 0) {
    return [];
  }

  // Get last messages for all sessions
  const db = getDb();
  const sessionIds = sessions.map((s) => s.id);
  const placeholders = sessionIds.map(() => '?').join(',');

  const rows = await db.all<MessagePreviewRow>(
    `SELECT session_id, content, content_type, created_at
     FROM messages
     WHERE session_id IN (${placeholders})
     AND id IN (
       SELECT MAX(id) FROM messages WHERE session_id IN (${placeholders}) GROUP BY session_id
     )`,
    [...sessionIds, ...sessionIds]
  );

  const lastMessages = new Map<
    string,
    { content: string; contentType: string; createdAt: Date }
  >();

  for (const row of rows) {
    lastMessages.set(row.session_id, {
      content: row.content,
      contentType: row.content_type,
      createdAt: new Date(row.created_at),
    });
  }

  return sessions.map((session) => ({
    ...session,
    lastMessage: lastMessages.get(session.id),
  }));
}

/**
 * Get total unread count across all sessions
 */
export async function getTotalUnreadCount(): Promise<number> {
  const db = getDb();
  const row = await db.get<UnreadCountRow>(
    "SELECT SUM(unread_by_staff) as total FROM sessions WHERE status = 'active'"
  );
  return row?.total || 0;
}
