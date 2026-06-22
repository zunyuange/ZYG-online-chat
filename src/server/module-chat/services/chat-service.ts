/**
 * Chat service - handles sessions and messages
 * Using database abstraction layer
 */

import { randomUUID } from 'node:crypto'
import { getDb } from '@server/shared/db'
import type {
  Session,
  Message,
  CreateSessionInput,
  SendMessageInput,
  SenderType,
  TaskStatus,
  SessionStatus,
  ContentType,
} from '@shared/types'

// ==========================================
// Session Services
// ==========================================

/**
 * Generate a random visitor name
 */
function generateVisitorName(): string {
  const adjectives = ['Happy', 'Clever', 'Swift', 'Bright', 'Calm', 'Eager', 'Gentle', 'Kind']
  const nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Fox', 'Owl', 'Bear', 'Wolf']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj}${noun}${num}`
}

interface SessionRow {
  id: string
  visiter_id: string
  visitor_name: string
  business_id: number
  service_id: number | null
  assigned_staff_id: number | null
  groupid: number | null
  status: string
  state: string
  last_message_at: number | null
  unread_by_visitor: number
  unread_by_staff: number
  topic: string | null
  task_status: string
  task_status_updated_at: number | null
  queue_position: number | null
  estimated_wait_minutes: number | null
  ip: string | null
  from_url: string | null
  avatar: string | null
  device: string | null
  lang: string | null
  transfer_history: string | null
  response_time: number | null
  last_visitor_activity_at: number | null
  email: string | null
  phone: string | null
  pid: string | null
  params: string | null
  referer: string | null
  user_agent: string | null
  created_at: number
  updated_at: number
}

interface BusinessRow {
  id: number
  business_slug: string | null
  business_name: string | null
}

interface MessageRow {
  id: number
  session_id: string
  sender_type: string
  content_type: string
  content: string
  translated_content: string | null
  translate_engine: string | null
  translated_at: number | null
  thumbnail_url: string | null
  file_name: string | null
  file_size: number | null
  is_read: number
  created_at: number
}

function mapRowToSession(row: SessionRow, business?: BusinessRow, staffName?: string): Session {
  return {
    id: row.id,
    visitorName: row.visitor_name,
    businessId: row.business_id,
    businessSlug: business?.business_slug || undefined,
    businessName: business?.business_name || undefined,
    status: row.status as SessionStatus,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : undefined,
    unreadByVisitor: row.unread_by_visitor || 0,
    unreadByStaff: row.unread_by_staff || 0,
    assignedStaffId: row.assigned_staff_id || undefined,
    assignedStaffName: staffName || undefined,
    topic: row.topic || undefined,
    taskStatus: (row.task_status as TaskStatus) || 'requirement_discussion',
    taskStatusUpdatedAt: row.task_status_updated_at
      ? new Date(row.task_status_updated_at)
      : undefined,
    queuePosition: row.queue_position || undefined,
    estimatedWaitMinutes: row.estimated_wait_minutes || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    // 访客自定义字段
    email: row.email || undefined,
    phone: row.phone || undefined,
    pid: row.pid || undefined,
    params: row.params ? JSON.parse(row.params) : undefined,
    ip: row.ip || undefined,
    fromUrl: row.from_url || undefined,
    referer: row.referer || undefined,
    userAgent: row.user_agent || undefined,
    device: row.device || undefined,
    lang: row.lang || undefined,
    avatar: row.avatar || undefined,
    lastVisitorActivityAt: row.last_visitor_activity_at
      ? new Date(row.last_visitor_activity_at)
      : undefined,
  }
}

function mapRowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    senderType: row.sender_type as SenderType,
    contentType: row.content_type as ContentType,
    content: row.content,
    translatedContent: row.translated_content || undefined,
    translateEngine: row.translate_engine || undefined,
    translatedAt: row.translated_at || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    fileName: row.file_name || undefined,
    fileSize: row.file_size || undefined,
    isRead: Boolean(row.is_read),
    createdAt: new Date(row.created_at),
  }
}

/**
 * Get business by slug, id, or name
 * Now using staff_users table where business_id = 0 indicates a business owner account
 *
 * 查找优先级:
 * 1. 按 business_slug 匹配 (字符串标识)
 * 2. 按 id 匹配 (数字标识，business_id=0 的商家主账号)
 * 3. 按 business_id 字段匹配 (非0的客服账号所属商家)
 * 4. 都找不到返回 null
 */
async function getBusinessBySlug(slug?: string): Promise<BusinessRow | null> {
  const db = getDb()

  console.log('[ChatService] getBusinessBySlug called with slug:', slug)

  if (!slug) {
    // Return default business - find by business_slug = 'default' and business_id = 0
    const business = await db.get<BusinessRow>(
      'SELECT id, business_slug, business_name FROM staff_users WHERE business_slug = ? AND business_id = 0 AND role = ?',
      ['default', 'admin']
    )
    console.log(
      '[ChatService] getBusinessBySlug: no slug provided, returning default business:',
      business
    )
    return business || null
  }

  // Try to find by business_slug first (商家使用 business_slug 标识)
  // 只需要 business_slug 和 business_id = 0，不限制 role
  const business = await db.get<BusinessRow>(
    'SELECT id, business_slug, business_name FROM staff_users WHERE business_slug = ? AND business_id = 0',
    [slug]
  )

  if (business) {
    console.log('[ChatService] getBusinessBySlug: found business by slug:', business)
    return business
  }

  // Try by id (numeric slug) — 商家主账号 (business_id=0)
  const id = parseInt(slug, 10)
  if (!isNaN(id)) {
    const businessById = await db.get<BusinessRow>(
      'SELECT id, business_slug, business_name FROM staff_users WHERE id = ? AND business_id = 0',
      [id]
    )
    if (businessById) {
      console.log('[ChatService] getBusinessBySlug: found business by id (owner):', businessById)
      return businessById
    }

    // Try by business_id — 客服账号所属的商家 (business_id 指向商家主账号)
    const businessByBid = await db.get<BusinessRow>(
      `SELECT u2.id, u2.business_slug, u2.business_name 
       FROM staff_users u1 
       JOIN staff_users u2 ON u1.business_id = u2.id 
       WHERE u1.id = ? AND u2.business_id = 0`,
      [id]
    )
    if (businessByBid) {
      console.log('[ChatService] getBusinessBySlug: found business by staff business_id:', businessByBid)
      return businessByBid
    }
  }

  console.log('[ChatService] getBusinessBySlug: no business found for slug:', slug)
  return null
}

/**
 * Create a new session or get existing one
 */
export async function createOrGetSession(input: CreateSessionInput = {}): Promise<Session> {
  const db = getDb()

  // Get business info based on slug or id
  const business = await getBusinessBySlug(input.business)
  // 如果没找到匹配的商家，使用默认商家作为兜底
  // 如果连默认商家都没有，使用 id=1 作为最后的兜底
  const businessId = business?.id || 1
  const businessName = business?.business_name || '默认商家'
  const businessSlug = business?.business_slug || 'default'

  console.log(
    '[ChatService] createOrGetSession: input.business =',
    input.business,
    '-> businessId =',
    businessId
  )

  // Generate visitor_id for the session
  const visitorId = input.sessionId || randomUUID()

  // If sessionId provided, try to get existing session
  // 多租户隔离：校验已有 session 的 business_id 与当前商家一致，防止跨商家 session 复用
  if (input.sessionId) {
    const row = await db.get<SessionRow>(
      'SELECT * FROM sessions WHERE id = ? AND business_id = ?',
      [input.sessionId, businessId]
    )
    if (row) {
      console.log(
        `[ChatService] Found existing session ${input.sessionId} with status: ${row.status}`
      )
      // 更新已有的访客自定义字段（如果数据库中为空且本次传入了值）
      const updates: string[] = []
      const updateVals: unknown[] = []
      if (!row.device && input.device) { updates.push('device = ?'); updateVals.push(input.device) }
      if (!row.lang && input.lang) { updates.push('lang = ?'); updateVals.push(input.lang) }
      if (!row.avatar && input.avatar) { updates.push('avatar = ?'); updateVals.push(input.avatar) }
      if (!row.email && input.email) { updates.push('email = ?'); updateVals.push(input.email) }
      if (!row.phone && input.phone) { updates.push('phone = ?'); updateVals.push(input.phone) }
      if (!row.pid && input.pid) { updates.push('pid = ?'); updateVals.push(input.pid) }
      if (!row.from_url && input.fromUrl) { updates.push('from_url = ?'); updateVals.push(input.fromUrl) }
      if (!row.referer && input.referer) { updates.push('referer = ?'); updateVals.push(input.referer) }
      // params: 合并新旧参数（新值覆盖旧值，新增键保留）
      if (input.params && Object.keys(input.params).length > 0) {
        const existingParams = row.params ? JSON.parse(row.params) : {}
        const mergedParams = { ...existingParams, ...input.params }
        updates.push('params = ?')
        updateVals.push(JSON.stringify(mergedParams))
      }
      if (updates.length > 0) {
        updates.push('updated_at = ?')
        updateVals.push(Date.now())
        updateVals.push(input.sessionId)
        await db.run(
          `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`,
          updateVals
        )
        // 重新查询更新后的记录
        const updatedRow = await db.get<SessionRow>(
          'SELECT * FROM sessions WHERE id = ?',
          [input.sessionId]
        )
        if (updatedRow) {
          let staffName: string | undefined
          if (updatedRow.assigned_staff_id) {
            const staff = await db.get<{ name: string }>(
              'SELECT name FROM staff_users WHERE id = ?',
              [updatedRow.assigned_staff_id]
            )
            staffName = staff?.name
          }
          return mapRowToSession(updatedRow, business || undefined, staffName)
        }
      }
      let staffName: string | undefined
      if (row.assigned_staff_id) {
        const staff = await db.get<{ name: string }>(
          'SELECT name FROM staff_users WHERE id = ?',
          [row.assigned_staff_id]
        )
        staffName = staff?.name
      }
      return mapRowToSession(row, business || undefined, staffName)
    }
  }

  // Create new session
  const sessionId = input.sessionId || randomUUID()
  const visitorName = input.visitorName || generateVisitorName()
  const now = Date.now()

  // Build dynamic INSERT with all available fields
  const fields = ['id', 'visiter_id', 'visitor_name', 'business_id', 'status', 'task_status', 'created_at', 'updated_at']
  const values: (string | number)[] = [sessionId, visitorId, visitorName, businessId, now, now]
  const placeholders = ['?', '?', '?', '?', "'active'", "'requirement_discussion'", '?', '?']

  // 访客自定义字段：如果传入了就写入
  if (input.email) { fields.push('email'); values.push(input.email); placeholders.push('?') }
  if (input.phone) { fields.push('phone'); values.push(input.phone); placeholders.push('?') }
  if (input.pid) { fields.push('pid'); values.push(input.pid); placeholders.push('?') }
  if (input.params) { fields.push('params'); values.push(JSON.stringify(input.params)); placeholders.push('?') }
  if (input.fromUrl) { fields.push('from_url'); values.push(input.fromUrl); placeholders.push('?') }
  if (input.referer) { fields.push('referer'); values.push(input.referer); placeholders.push('?') }
  if (input.ip) { fields.push('ip'); values.push(input.ip); placeholders.push('?') }
  if (input.userAgent) { fields.push('user_agent'); values.push(input.userAgent); placeholders.push('?') }
  if (input.device) { fields.push('device'); values.push(input.device); placeholders.push('?') }
  if (input.lang) { fields.push('lang'); values.push(input.lang); placeholders.push('?') }
  if (input.avatar) { fields.push('avatar'); values.push(input.avatar); placeholders.push('?') }

  const sql = `INSERT OR IGNORE INTO sessions (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`
  await db.run(sql, values)

  const row = await db.get<SessionRow>('SELECT * FROM sessions WHERE id = ? AND business_id = ?', [sessionId, businessId])
  if (row) {
    return mapRowToSession(row, business || undefined)
  }

  return {
    id: sessionId,
    visitorName,
    businessId,
    businessSlug: business?.business_slug || 'default',
    businessName: business?.business_name || '默认商家',
    status: 'active',
    taskStatus: 'requirement_discussion',
    unreadByVisitor: 0,
    unreadByStaff: 0,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }
}

/**
 * Get session by ID, optionally validating business ownership
 */
export async function getSession(sessionId: string, businessId?: number): Promise<Session | null> {
  const db = getDb()
  let row: SessionRow | null

  if (businessId && businessId !== 0) {
    row = await db.get<SessionRow>('SELECT * FROM sessions WHERE id = ? AND business_id = ?', [
      sessionId,
      businessId,
    ])
  } else {
    row = await db.get<SessionRow>('SELECT * FROM sessions WHERE id = ?', [sessionId])
  }

  if (!row) return null

  // Get business info
  const business = await db.get<BusinessRow>(
    'SELECT id, business_slug, business_name FROM staff_users WHERE id = ?',
    [row.business_id]
  )
  // Get assigned staff name
  let staffName: string | undefined
  if (row.assigned_staff_id) {
    const staff = await db.get<{ name: string }>(
      'SELECT name FROM staff_users WHERE id = ?',
      [row.assigned_staff_id]
    )
    staffName = staff?.name
  }
  return mapRowToSession(row, business || undefined, staffName)
}

/**
 * List all sessions (optionally filtered by business)
 */
export async function listSessions(
  status?: 'active' | 'closed',
  businessId?: number
): Promise<Session[]> {
  const db = getDb()
  let sql = 'SELECT * FROM sessions'
  const params: (string | number)[] = []
  const conditions: string[] = []

  console.log('[ChatService] listSessions called with status:', status, 'businessId:', businessId)

  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }

  // 多租户隔离：
  // - businessId > 0：过滤特定商家会话
  // - businessId === 0：超级管理员，不过滤，查看所有商家会话
  // - businessId === undefined：无上下文，不返回任何会话（安全策略）
  if (businessId !== undefined && businessId > 0) {
    conditions.push('business_id = ?')
    params.push(businessId)
    console.log('[ChatService] Filtering sessions by business_id =', businessId)
  } else if (businessId === undefined) {
    console.log('[ChatService] No businessId provided, returning empty list')
    return []
  } else {
    console.log('[ChatService] businessId=0 (super admin), no business filter applied')
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY last_message_at DESC NULLS LAST, created_at DESC'

  const rows = await db.all<SessionRow>(sql, params)

  // Get all business info for sessions
  const businessMap = new Map<number, BusinessRow>()
  const businessIds = [...new Set(rows.map(r => r.business_id))]
  for (const bid of businessIds) {
    const business = await db.get<BusinessRow>(
      'SELECT id, business_slug, business_name FROM staff_users WHERE id = ?',
      [bid]
    )
    if (business) {
      businessMap.set(bid, business)
    }
  }

  // Get staff names for assigned sessions
  const staffNameMap = new Map<number, string>()
  const assignedStaffIds = [...new Set(rows.map(r => r.assigned_staff_id).filter(Boolean))] as number[]
  for (const sid of assignedStaffIds) {
    const staff = await db.get<{ name: string }>(
      'SELECT name FROM staff_users WHERE id = ?',
      [sid]
    )
    if (staff) {
      staffNameMap.set(sid, staff.name)
    }
  }

  return rows.map(row => mapRowToSession(row, businessMap.get(row.business_id), row.assigned_staff_id ? staffNameMap.get(row.assigned_staff_id) : undefined))
}

/**
 * Update session's last message time
 * 多租户隔离：如果传入 businessId，校验 session 归属；不传则仅按 id 更新（兼容 visitor 端无上下文场景）
 */
export async function updateSessionLastMessage(
  sessionId: string,
  businessId?: number
): Promise<void> {
  const db = getDb()
  const now = Date.now()
  if (businessId && businessId !== 0) {
    await db.run(
      'UPDATE sessions SET last_message_at = ?, updated_at = ? WHERE id = ? AND business_id = ?',
      [now, now, sessionId, businessId]
    )
  } else {
    await db.run('UPDATE sessions SET last_message_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      sessionId,
    ])
  }
}

// ==========================================
// Message Services
// ==========================================

/**
 * Send a message, optionally validating business ownership
 */
export async function sendMessage(input: SendMessageInput, businessId?: number): Promise<Message> {
  const db = getDb()
  const now = Date.now()

  // Verify session belongs to this business before allowing message insertion
  if (businessId && businessId !== 0) {
    const session = await db.get<{ id: string }>(
      'SELECT id FROM sessions WHERE id = ? AND business_id = ?',
      [input.sessionId, businessId]
    )
    if (!session) {
      throw new Error('Session not found or access denied')
    }
  }

  const result = await db.run(
    `INSERT INTO messages (session_id, sender_type, content_type, content, translated_content, translate_engine, translated_at, thumbnail_url, file_name, file_size, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      input.sessionId,
      input.senderType,
      input.contentType,
      input.content,
      input.translatedContent || null,
      input.translateEngine || null,
      input.translatedContent ? now : null,
      input.thumbnailUrl || null,
      input.fileName || null,
      input.fileSize || null,
      now,
    ]
  )

  // Update session (多租户隔离：传入 businessId 防止跨商家更新)
  await updateSessionLastMessage(input.sessionId, businessId)

  // Increment unread counter (带 business_id 条件防御)
  if (input.senderType === 'visitor') {
    if (businessId && businessId !== 0) {
      await db.run(
        'UPDATE sessions SET unread_by_staff = unread_by_staff + 1, last_visitor_activity_at = ?, updated_at = ? WHERE id = ? AND business_id = ?',
        [now, now, input.sessionId, businessId]
      )
    } else {
      await db.run(
        'UPDATE sessions SET unread_by_staff = unread_by_staff + 1, last_visitor_activity_at = ?, updated_at = ? WHERE id = ?',
        [now, now, input.sessionId]
      )
    }
  } else {
    if (businessId && businessId !== 0) {
      await db.run(
        'UPDATE sessions SET unread_by_visitor = unread_by_visitor + 1, updated_at = ? WHERE id = ? AND business_id = ?',
        [now, input.sessionId, businessId]
      )
    } else {
      await db.run(
        'UPDATE sessions SET unread_by_visitor = unread_by_visitor + 1, updated_at = ? WHERE id = ?',
        [now, input.sessionId]
      )
    }
  }

  return {
    id: result.lastInsertRowid,
    sessionId: input.sessionId,
    senderType: input.senderType,
    contentType: input.contentType,
    content: input.content,
    translatedContent: input.translatedContent,
    translateEngine: input.translateEngine,
    translatedAt: input.translatedContent ? now : undefined,
    thumbnailUrl: input.thumbnailUrl,
    fileName: input.fileName,
    fileSize: input.fileSize,
    isRead: false,
    createdAt: new Date(now),
  }
}

/**
 * Get messages for a session with pagination, optionally validating business ownership
 */
export async function getMessages(
  sessionId: string,
  before?: number,
  limit: number = 20,
  businessId?: number
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const db = getDb()

  // Verify session belongs to this business before returning messages
  if (businessId && businessId !== 0) {
    const session = await db.get<{ id: string }>(
      'SELECT id FROM sessions WHERE id = ? AND business_id = ?',
      [sessionId, businessId]
    )
    if (!session) {
      return { messages: [], hasMore: false }
    }
  }

  let sql = 'SELECT * FROM messages WHERE session_id = ?'
  const params: (string | number)[] = [sessionId]

  if (before) {
    sql += ' AND id < ?'
    params.push(before)
  }

  sql += ' ORDER BY id DESC LIMIT ?'
  params.push(limit + 1)

  const rows = await db.all<MessageRow>(sql, params)

  const hasMore = rows.length > limit
  const messages = rows.slice(0, limit).map(mapRowToMessage).reverse()

  return { messages, hasMore }
}

/**
 * Mark messages as read, optionally validating business ownership
 */
export async function markAsRead(
  sessionId: string,
  readerType: SenderType,
  businessId?: number
): Promise<number[]> {
  const db = getDb()
  const now = Date.now()

  // Verify session belongs to this business before marking as read
  if (businessId && businessId !== 0) {
    const session = await db.get<{ id: string }>(
      'SELECT id FROM sessions WHERE id = ? AND business_id = ?',
      [sessionId, businessId]
    )
    if (!session) {
      return []
    }
  }

  // Mark messages from the other party as read
  const senderType = readerType === 'visitor' ? 'staff' : 'visitor'
  console.log(
    `[ChatService] Marking messages as read for session ${sessionId}, readerType: ${readerType}, senderType to mark: ${senderType}`
  )

  // First get the IDs of messages that will be updated
  const rows = await db.all<{ id: number }>(
    'SELECT id FROM messages WHERE session_id = ? AND sender_type = ? AND is_read = 0',
    [sessionId, senderType]
  )
  const messageIds = rows.map(row => row.id)
  console.log(`[ChatService] Found ${messageIds.length} messages to mark as read: ${messageIds}`)

  if (messageIds.length > 0) {
    // Update messages
    const result = await db.run(
      'UPDATE messages SET is_read = 1 WHERE session_id = ? AND sender_type = ? AND is_read = 0',
      [sessionId, senderType]
    )
    console.log(`[ChatService] Updated ${result.changes} messages as read`)

    // Reset unread counter (多租户隔离：带 business_id 条件防御)
    const counterField = readerType === 'visitor' ? 'unread_by_visitor' : 'unread_by_staff'
    if (businessId && businessId !== 0) {
      await db.run(
        `UPDATE sessions SET ${counterField} = 0, updated_at = ? WHERE id = ? AND business_id = ?`,
        [now, sessionId, businessId]
      )
    } else {
      await db.run(`UPDATE sessions SET ${counterField} = 0, updated_at = ? WHERE id = ?`, [
        now,
        sessionId,
      ])
    }
    console.log(`[ChatService] Reset ${counterField} counter for session ${sessionId}`)
  }

  return messageIds
}
