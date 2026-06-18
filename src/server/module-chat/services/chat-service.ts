/**
 * Chat service - handles sessions and messages
 * Using database abstraction layer
 */

import { randomUUID } from 'node:crypto';
import { getDb } from '@server/shared/db';
import type {
  Session,
  Message,
  CreateSessionInput,
  SendMessageInput,
  SenderType,
  TaskStatus,
  SessionStatus,
  ContentType,
} from '@shared/types';

// ==========================================
// Session Services
// ==========================================

/**
 * Generate a random visitor name
 */
function generateVisitorName(): string {
  const adjectives = ['Happy', 'Clever', 'Swift', 'Bright', 'Calm', 'Eager', 'Gentle', 'Kind'];
  const nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Fox', 'Owl', 'Bear', 'Wolf'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

interface SessionRow {
  id: string;
  visiter_id: string;
  visitor_name: string;
  business_id: number;
  status: string;
  last_message_at: number | null;
  unread_by_visitor: number;
  unread_by_staff: number;
  topic: string | null;
  task_status: string;
  task_status_updated_at: number | null;
  queue_position: number | null;
  estimated_wait_minutes: number | null;
  created_at: number;
  updated_at: number;
}

interface BusinessRow {
  id: number;
  name: string;
  slug: string;
  theme: string;
  state: string;
  lang: string;
}

interface MessageRow {
  id: number;
  session_id: string;
  sender_type: string;
  content_type: string;
  content: string;
  thumbnail_url: string | null;
  file_name: string | null;
  file_size: number | null;
  is_read: number;
  created_at: number;
}

function mapRowToSession(row: SessionRow, business?: BusinessRow): Session {
  return {
    id: row.id,
    visitorName: row.visitor_name,
    businessId: row.business_id,
    businessSlug: business?.slug,
    businessName: business?.name,
    status: row.status as SessionStatus,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : undefined,
    unreadByVisitor: row.unread_by_visitor || 0,
    unreadByStaff: row.unread_by_staff || 0,
    topic: row.topic || undefined,
    taskStatus: (row.task_status as TaskStatus) || 'requirement_discussion',
    taskStatusUpdatedAt: row.task_status_updated_at ? new Date(row.task_status_updated_at) : undefined,
    queuePosition: row.queue_position || undefined,
    estimatedWaitMinutes: row.estimated_wait_minutes || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    senderType: row.sender_type as SenderType,
    contentType: row.content_type as ContentType,
    content: row.content,
    thumbnailUrl: row.thumbnail_url || undefined,
    fileName: row.file_name || undefined,
    fileSize: row.file_size || undefined,
    isRead: Boolean(row.is_read),
    createdAt: new Date(row.created_at),
  };
}

/**
 * Get business by slug or id
 * Now using staff_users table where business_id = 0 indicates a business owner account
 */
async function getBusinessBySlug(slug?: string): Promise<BusinessRow | null> {
  const db = getDb();
  
  if (!slug) {
    // Return default business - find by business_slug = 'default' or business_id = 0
    const business = await db.get<BusinessRow>(
      'SELECT id, business_slug as slug, business_name as name FROM staff_users WHERE business_slug = ? OR (business_id = 0 AND role = ?)',
      ['default', 'admin']
    );
    return business || null;
  }
  
  // Try to find by business_slug first (商家使用 business_slug 标识)
  const business = await db.get<BusinessRow>(
    'SELECT id, business_slug as slug, business_name as name FROM staff_users WHERE business_slug = ? AND role = ?',
    [slug, 'admin']
  );
  
  if (business) {
    return business;
  }
  
  // Try by id (numeric slug)
  const id = parseInt(slug, 10);
  if (!isNaN(id)) {
    // Find business by id where business_id = 0 (商家主账号)
    return db.get<BusinessRow>(
      'SELECT id, business_slug as slug, business_name as name FROM staff_users WHERE id = ? AND business_id = 0',
      [id]
    );
  }
  
  return null;
}

/**
 * Create a new session or get existing one
 */
export async function createOrGetSession(input: CreateSessionInput = {}): Promise<Session> {
  const db = getDb();

  // Get business info based on slug or id
  const business = await getBusinessBySlug(input.business);
  const businessId = business?.id || 1;

  // Generate visitor_id for the session
  const visitorId = input.sessionId || randomUUID();

  // If sessionId provided, try to get existing session
  if (input.sessionId) {
    const row = await db.get<SessionRow>('SELECT * FROM sessions WHERE id = ?', [input.sessionId]);
    if (row) {
      console.log(`[ChatService] Found existing session ${input.sessionId} with status: ${row.status}`);
      return mapRowToSession(row, business || undefined);
    }
  }

  // Create new session
  const sessionId = input.sessionId || randomUUID();
  const visitorName = input.visitorName || generateVisitorName();
  const now = Date.now();

  await db.run(
    `INSERT INTO sessions (id, visiter_id, visitor_name, business_id, status, task_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', 'requirement_discussion', ?, ?)`,
    [sessionId, visitorId, visitorName, businessId, now, now]
  );

  const row = await db.get<SessionRow>('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  if (row) {
    return mapRowToSession(row, business || undefined);
  }

  return {
    id: sessionId,
    visitorName,
    businessId,
    businessSlug: business?.slug,
    businessName: business?.name,
    status: 'active',
    taskStatus: 'requirement_discussion',
    unreadByVisitor: 0,
    unreadByStaff: 0,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const db = getDb();
  const row = await db.get<SessionRow>('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  if (!row) return null;
  
  // Get business info
  const business = await db.get<BusinessRow>('SELECT id, business_slug as slug, business_name as name FROM staff_users WHERE id = ?', [row.business_id]);
  return mapRowToSession(row, business || undefined);
}

/**
 * List all sessions (optionally filtered by business)
 */
export async function listSessions(status?: 'active' | 'closed', businessId?: number): Promise<Session[]> {
  const db = getDb();
  let sql = 'SELECT * FROM sessions';
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  if (businessId) {
    conditions.push('business_id = ?');
    params.push(businessId);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY last_message_at DESC NULLS LAST, created_at DESC';

  const rows = await db.all<SessionRow>(sql, params);
  
  // Get all business info for sessions
  const businessMap = new Map<number, BusinessRow>();
  const businessIds = [...new Set(rows.map(r => r.business_id))];
  for (const bid of businessIds) {
    const business = await db.get<BusinessRow>('SELECT id, business_slug as slug, business_name as name FROM staff_users WHERE id = ?', [bid]);
    if (business) {
      businessMap.set(bid, business);
    }
  }
  
  return rows.map(row => mapRowToSession(row, businessMap.get(row.business_id)));
}

/**
 * Update session's last message time
 */
export async function updateSessionLastMessage(sessionId: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.run(
    'UPDATE sessions SET last_message_at = ?, updated_at = ? WHERE id = ?',
    [now, now, sessionId]
  );
}

// ==========================================
// Message Services
// ==========================================

/**
 * Send a message
 */
export async function sendMessage(input: SendMessageInput): Promise<Message> {
  const db = getDb();
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO messages (session_id, sender_type, content_type, content, thumbnail_url, file_name, file_size, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      input.sessionId,
      input.senderType,
      input.contentType,
      input.content,
      input.thumbnailUrl || null,
      input.fileName || null,
      input.fileSize || null,
      now,
    ]
  );

  // Update session
  await updateSessionLastMessage(input.sessionId);

  // Increment unread counter
  if (input.senderType === 'visitor') {
    await db.run(
      'UPDATE sessions SET unread_by_staff = unread_by_staff + 1, updated_at = ? WHERE id = ?',
      [now, input.sessionId]
    );
  } else {
    await db.run(
      'UPDATE sessions SET unread_by_visitor = unread_by_visitor + 1, updated_at = ? WHERE id = ?',
      [now, input.sessionId]
    );
  }

  return {
    id: result.lastInsertRowid,
    sessionId: input.sessionId,
    senderType: input.senderType,
    contentType: input.contentType,
    content: input.content,
    thumbnailUrl: input.thumbnailUrl,
    fileName: input.fileName,
    fileSize: input.fileSize,
    isRead: false,
    createdAt: new Date(now),
  };
}

/**
 * Get messages for a session with pagination
 */
export async function getMessages(
  sessionId: string,
  before?: number,
  limit: number = 20
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const db = getDb();
  let sql = 'SELECT * FROM messages WHERE session_id = ?';
  const params: (string | number)[] = [sessionId];

  if (before) {
    sql += ' AND id < ?';
    params.push(before);
  }

  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit + 1);

  const rows = await db.all<MessageRow>(sql, params);

  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).map(mapRowToMessage).reverse();

  return { messages, hasMore };
}

/**
 * Mark messages as read
 */
export async function markAsRead(sessionId: string, readerType: SenderType): Promise<void> {
  const db = getDb();
  const now = Date.now();

  // Mark messages from the other party as read
  const senderType = readerType === 'visitor' ? 'staff' : 'visitor';

  await db.run(
    'UPDATE messages SET is_read = 1 WHERE session_id = ? AND sender_type = ? AND is_read = 0',
    [sessionId, senderType]
  );

  // Reset unread counter
  const counterField = readerType === 'visitor' ? 'unread_by_visitor' : 'unread_by_staff';
  await db.run(
    `UPDATE sessions SET ${counterField} = 0, updated_at = ? WHERE id = ?`,
    [now, sessionId]
  );
}
