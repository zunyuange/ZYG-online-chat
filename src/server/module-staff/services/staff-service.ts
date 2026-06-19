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
} from '@server/module-chat/services/chat-service'

import {
  getSession as getSessionBase,
  listSessions as listSessionsBase,
} from '@server/module-chat/services/chat-service'
import { getDb } from '@server/shared/db'
import { hashPassword } from '@server/shared/crypto'
import type { Session, SessionStatus, TaskStatus } from '@shared/types'

interface MessagePreviewRow {
  session_id: string
  content: string
  content_type: string
  created_at: number
}

interface UnreadCountRow {
  total: number | null
}

/**
 * Update session topic
 */
export async function updateSessionTopic(
  sessionId: string,
  topic: string,
  businessId?: number
): Promise<Session | null> {
  const db = getDb()
  const now = Date.now()

  if (businessId && businessId !== 0) {
    const session = await db.get<{ id: string }>(
      'SELECT id FROM sessions WHERE id = ? AND business_id = ?',
      [sessionId, businessId]
    )
    if (!session) return null

    await db.run(
      'UPDATE sessions SET topic = ?, updated_at = ? WHERE id = ? AND business_id = ?',
      [topic, now, sessionId, businessId]
    )
  } else {
    await db.run('UPDATE sessions SET topic = ?, updated_at = ? WHERE id = ?', [
      topic,
      now,
      sessionId,
    ])
  }

  return getSessionBase(sessionId)
}

/**
 * Update session task status
 */
export async function updateTaskStatus(
  sessionId: string,
  taskStatus: TaskStatus,
  businessId?: number
): Promise<Session | null> {
  const db = getDb()
  const now = Date.now()

  if (businessId && businessId !== 0) {
    const session = await db.get<{ id: string }>(
      'SELECT id FROM sessions WHERE id = ? AND business_id = ?',
      [sessionId, businessId]
    )
    if (!session) return null

    await db.run(
      'UPDATE sessions SET task_status = ?, task_status_updated_at = ?, updated_at = ? WHERE id = ? AND business_id = ?',
      [taskStatus, now, now, sessionId, businessId]
    )
  } else {
    await db.run(
      'UPDATE sessions SET task_status = ?, task_status_updated_at = ?, updated_at = ? WHERE id = ?',
      [taskStatus, now, now, sessionId]
    )
  }

  return getSessionBase(sessionId)
}

/**
 * End a session (close it) and delete related messages
 */
export async function endSession(sessionId: string, businessId?: number): Promise<Session | null> {
  const db = getDb()
  const now = Date.now()

  if (businessId && businessId !== 0) {
    const session = await db.get<{ id: string }>(
      'SELECT id FROM sessions WHERE id = ? AND business_id = ?',
      [sessionId, businessId]
    )
    if (!session) return null
  }

  console.log(`[StaffService] Ending session ${sessionId}`)

  // Delete all messages for this session (前置校验已确保 session 归属，直接按 session_id 删除)
  const deleteResult = await db.run('DELETE FROM messages WHERE session_id = ?', [sessionId])
  console.log(`[StaffService] Deleted ${deleteResult.changes} messages for session ${sessionId}`)

  // Update session status to closed (多租户隔离)
  if (businessId && businessId !== 0) {
    await db.run(
      'UPDATE sessions SET status = ?, updated_at = ? WHERE id = ? AND business_id = ?',
      ['closed', now, sessionId, businessId]
    )
  } else {
    await db.run('UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?', [
      'closed',
      now,
      sessionId,
    ])
  }
  console.log(`[StaffService] Session ${sessionId} status set to closed`)

  const updatedSession = await getSessionBase(sessionId)
  console.log(
    `[StaffService] Session ${sessionId} ended successfully, status: ${updatedSession?.status}`
  )
  return updatedSession
}

/**
 * Get session with message preview
 */
export async function getSessionWithPreview(
  sessionId: string,
  businessId?: number,
  isSuperAdmin?: boolean
): Promise<{
  session: Session | null
  lastMessage?: {
    content: string
    contentType: string
    createdAt: Date
  }
}> {
  const session = await getSessionBase(sessionId)
  if (!session) {
    return { session: null }
  }

  if (!isSuperAdmin && businessId && businessId !== 0 && session.businessId !== businessId) {
    return { session: null }
  }

  // Get last message
  const db = getDb()
  const row = await db.get<MessagePreviewRow>(
    `SELECT session_id, content, content_type, created_at
     FROM messages
     WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId]
  )

  if (row) {
    return {
      session,
      lastMessage: {
        content: row.content,
        contentType: row.content_type,
        createdAt: new Date(row.created_at),
      },
    }
  }

  return { session }
}

/**
 * List sessions with last message preview (filtered by business and permission)
 *
 * 多租户隔离：businessId=0 表示超级管理员不过滤，其他值按 business_id 过滤。
 * isSuperAdmin 由路由层统一判断后传入，service 层不再重复计算。
 */
export async function listSessionsWithPreview(
  status?: SessionStatus,
  businessId?: number,
  staffId?: number,
  role?: string,
  businessSlug?: string
): Promise<
  (Session & {
    lastMessage?: {
      content: string
      contentType: string
      createdAt: Date
    }
  })[]
> {
  // 使用路由层传入的 businessId 判断是否过滤
  // businessId = 0 表示超级管理员（不过滤），businessId > 0 表示特定商家（过滤）
  // 如果 businessId 是 undefined，说明上下文缺失，不应该返回任何数据
  const isSuperAdmin = businessId === 0
  if (businessId === undefined) {
    console.error('[StaffService] listSessionsWithPreview: businessId is undefined, no sessions returned')
    return []
  }
  let sessions = await listSessionsBase(status, isSuperAdmin ? undefined : businessId)

  if (sessions.length === 0) {
    return []
  }

  // Filter sessions by permission:
  // - Admin can see all sessions within their business
  // - Regular staff can see unassigned sessions + sessions assigned to them
  if (role !== 'admin' && staffId) {
    sessions = sessions.filter(
      session => !session.assignedStaffId || session.assignedStaffId === staffId
    )
  }

  // Get last messages for all sessions
  const db = getDb()
  const sessionIds = sessions.map(s => s.id)
  const placeholders = sessionIds.map(() => '?').join(',')

  const rows = await db.all<MessagePreviewRow>(
    `SELECT session_id, content, content_type, created_at
     FROM messages
     WHERE session_id IN (${placeholders})
     AND id IN (
       SELECT MAX(id) FROM messages WHERE session_id IN (${placeholders}) GROUP BY session_id
     )`,
    [...sessionIds, ...sessionIds]
  )

  const lastMessages = new Map<string, { content: string; contentType: string; createdAt: Date }>()

  for (const row of rows) {
    lastMessages.set(row.session_id, {
      content: row.content,
      contentType: row.content_type,
      createdAt: new Date(row.created_at),
    })
  }

  return sessions.map(session => ({
    ...session,
    lastMessage: lastMessages.get(session.id),
  }))
}

/**
 * Get total unread count across all sessions (filtered by business)
 */
export async function getTotalUnreadCount(businessId?: number): Promise<number> {
  const db = getDb()
  let query = "SELECT SUM(unread_by_staff) as total FROM sessions WHERE status = 'active'"
  const params: unknown[] = []

  if (businessId && businessId !== 0) {
    query += ' AND business_id = ?'
    params.push(businessId)
  }

  const row = await db.get<UnreadCountRow>(query, params)
  return row?.total || 0
}

/**
 * Delete all messages for a session
 */
export async function deleteSessionMessages(
  sessionId: string,
  businessId?: number
): Promise<{ success: boolean; error?: string }> {
  const db = getDb()

  try {
    const session = await getSessionBase(sessionId)
    if (!session) {
      return { success: false, error: 'Session not found' }
    }

    if (businessId && businessId !== 0 && session.businessId !== businessId) {
      return { success: false, error: 'Access denied' }
    }

    await db.run('DELETE FROM messages WHERE session_id = ?', [sessionId])

    // 多租户隔离：UPDATE 带 business_id 条件防御
    if (businessId && businessId !== 0) {
      await db.run(
        'UPDATE sessions SET unread_by_visitor = 0, unread_by_staff = 0, updated_at = ? WHERE id = ? AND business_id = ?',
        [Date.now(), sessionId, businessId]
      )
    } else {
      await db.run(
        'UPDATE sessions SET unread_by_visitor = 0, unread_by_staff = 0, updated_at = ? WHERE id = ?',
        [Date.now(), sessionId]
      )
    }

    return { success: true }
  } catch (error) {
    console.error('[StaffService] Delete messages error:', error)
    return { success: false, error: 'Failed to delete messages' }
  }
}

// ==========================================
// Statistics Functions (统计数据)
// ==========================================

interface StaffStatistics {
  total_sessions: number
  active_sessions: number
  today_sessions: number
  total_visitors: number
  online_visitors: number
  waiting_count: number
  talking_count: number
  today_messages: number
  avg_response_time: number
}

export async function getStaffStatistics(businessId?: number): Promise<StaffStatistics> {
  const db = getDb()
  const todayStart = new Date().setHours(0, 0, 0, 0)

  const hasBusiness = businessId && businessId !== 0
  const sessionFilter = hasBusiness ? 'WHERE business_id = ?' : ''
  const sessionFilterVal = hasBusiness ? [businessId] : []

  let messageFilter = ''
  const messageParams: unknown[] = [todayStart]

  if (hasBusiness) {
    messageFilter = ' AND s.business_id = ?'
    messageParams.push(businessId)
  }

  const totalSessions = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM sessions ${sessionFilter}`,
    sessionFilterVal
  )
  const activeSessions = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM sessions WHERE status = 'active'${hasBusiness ? ' AND business_id = ?' : ''}`,
    hasBusiness ? [businessId] : []
  )
  const todaySessions = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM sessions WHERE created_at >= ? ${hasBusiness ? 'AND business_id = ?' : ''}`,
    hasBusiness ? [todayStart, businessId] : [todayStart]
  )
  const totalVisitors = await db.get<{ count: number }>(
    `SELECT COUNT(DISTINCT visitor_id) as count FROM sessions ${sessionFilter}`,
    sessionFilterVal
  )

  const waitingCount = await db.get<{ count: number }>(
    hasBusiness
      ? "SELECT COUNT(*) as count FROM queue WHERE state = 'waiting' AND business_id = ?"
      : "SELECT COUNT(*) as count FROM queue WHERE state = 'waiting'",
    hasBusiness ? [businessId] : []
  )
  const talkingCount = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM sessions WHERE status = 'active' AND service_id > 0 ${hasBusiness ? 'AND business_id = ?' : ''}`,
    hasBusiness ? [businessId] : []
  )

  const todayMessages = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM messages m JOIN sessions s ON m.session_id = s.id WHERE m.created_at >= ?${messageFilter}`,
    messageParams
  )

  return {
    total_sessions: totalSessions?.count || 0,
    active_sessions: activeSessions?.count || 0,
    today_sessions: todaySessions?.count || 0,
    total_visitors: totalVisitors?.count || 0,
    online_visitors: activeSessions?.count || 0,
    waiting_count: waitingCount?.count || 0,
    talking_count: talkingCount?.count || 0,
    today_messages: todayMessages?.count || 0,
    avg_response_time: 0,
  }
}

// ==========================================
// Visitor List Functions (访客列表)
// ==========================================

interface VisitorInfo {
  visitor_id: string
  visitor_name: string
  avatar: string
  ip: string
  from_url: string
  device: string
  lang: string
  state: string
  service_name: string
  group_name: string
  last_message_at: number
  created_at: number
}

export async function getVisitorList(
  state?: string,
  groupid?: string,
  businessId?: number
): Promise<VisitorInfo[]> {
  const db = getDb()

  let query = `
    SELECT DISTINCT s.visitor_id, s.visitor_name, s.avatar, s.ip, s.from_url, 
           s.device, s.lang, s.state, s.last_message_at, s.created_at,
           ss.name as service_name,
           sg.name as group_name
    FROM sessions s
    LEFT JOIN staff_users ss ON s.service_id = ss.id
    LEFT JOIN staff_groups sg ON s.groupid = sg.id
    WHERE 1=1
  `

  const params: unknown[] = []

  if (businessId) {
    query += ' AND s.business_id = ?'
    params.push(businessId)
  }

  if (state) {
    query += ' AND s.state = ?'
    params.push(state)
  }

  if (groupid) {
    query += ' AND s.groupid = ?'
    params.push(parseInt(groupid, 10))
  }

  query += ' ORDER BY s.last_message_at DESC'

  const rows = await db.all<VisitorInfo>(query, params)
  return rows
}

// ==========================================
// Quick Replies (Sentence) Functions (常用语)
// ==========================================

interface Sentence {
  id: number
  content: string
  staff_id: number
  business_id: number
  tag: string
  state: string
  lang: string
  created_at: number
}

export async function getSentences(businessId?: number): Promise<Sentence[]> {
  const db = getDb()
  let query = "SELECT * FROM sentences WHERE state = 'using'"
  const params: unknown[] = []

  if (businessId) {
    query += ' AND business_id = ?'
    params.push(businessId)
  }

  query += ' ORDER BY created_at DESC'

  const sentences = await db.all<Sentence>(query, params)
  return sentences
}

export async function addSentence(data: {
  content: string
  tag?: string
  lang?: string
  staffId?: number
  businessId?: number
}): Promise<Sentence> {
  const db = getDb()
  const now = Date.now()

  const result = await db.run(
    'INSERT INTO sentences (content, tag, lang, staff_id, business_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [
      data.content,
      data.tag || '',
      data.lang || 'zh-CN',
      data.staffId || 0,
      data.businessId || 1,
      now,
    ]
  )

  const sentence = await db.get<Sentence>('SELECT * FROM sentences WHERE id = ?', [
    result.lastInsertRowid,
  ])

  return sentence!
}

export async function updateSentence(
  id: number,
  data: { content?: string; tag?: string; state?: string; businessId?: number }
): Promise<Sentence | null> {
  const db = getDb()

  const updates: string[] = []
  const params: unknown[] = []

  if (data.content !== undefined) {
    updates.push('content = ?')
    params.push(data.content)
  }
  if (data.tag !== undefined) {
    updates.push('tag = ?')
    params.push(data.tag)
  }
  if (data.state !== undefined) {
    updates.push('state = ?')
    params.push(data.state)
  }

  if (updates.length === 0) {
    return db.get<Sentence>('SELECT * FROM sentences WHERE id = ?', [id])
  }

  // Filter by business if provided
  let whereClause = 'WHERE id = ?'
  if (data.businessId) {
    whereClause += ' AND business_id = ?'
    params.push(data.businessId)
  }

  params.push(id)
  await db.run(`UPDATE sentences SET ${updates.join(', ')} ${whereClause}`, params)

  return db.get<Sentence>('SELECT * FROM sentences WHERE id = ?', [id])
}

export async function deleteSentence(id: number, businessId?: number): Promise<boolean> {
  const db = getDb()
  let query = 'DELETE FROM sentences WHERE id = ?'
  const params: unknown[] = [id]

  if (businessId) {
    query += ' AND business_id = ?'
    params.push(businessId)
  }

  const result = await db.run(query, params)
  return result.changes > 0
}

// ==========================================
// Offline Messages Functions (留言管理)
// ==========================================

interface OfflineMessage {
  id: number
  visitor_id: string
  name: string
  mobile: string
  email: string
  content: string
  ip: string
  from_url: string
  status: string
  created_at: number
}

export async function getOfflineMessages(businessId?: number): Promise<OfflineMessage[]> {
  const db = getDb()
  let query = 'SELECT * FROM offline_messages'
  const params: unknown[] = []

  if (businessId) {
    query += ' WHERE business_id = ?'
    params.push(businessId)
  }

  query += ' ORDER BY created_at DESC'

  const messages = await db.all<OfflineMessage>(query, params)
  return messages
}

export async function updateOfflineMessageStatus(
  id: number,
  status: string,
  businessId?: number
): Promise<OfflineMessage | null> {
  const db = getDb()
  if (businessId && businessId !== 0) {
    await db.run('UPDATE offline_messages SET status = ? WHERE id = ? AND business_id = ?', [
      status,
      id,
      businessId,
    ])
  } else {
    await db.run('UPDATE offline_messages SET status = ? WHERE id = ?', [status, id])
  }
  return db.get<OfflineMessage>('SELECT * FROM offline_messages WHERE id = ?', [id])
}

// ==========================================
// Blacklist Functions (黑名单管理)
// ==========================================

interface BlacklistEntry {
  id: number
  visitor_id: string
  reason: string
  created_at: number
}

export async function addToBlacklist(
  visitorId: string,
  businessId: number,
  reason?: string
): Promise<BlacklistEntry> {
  const db = getDb()
  const now = Date.now()

  await db.run(
    'INSERT OR REPLACE INTO visitor_blacklist (visitor_id, business_id, reason, created_at) VALUES (?, ?, ?, ?)',
    [visitorId, businessId, reason || '', now]
  )

  const entry = await db.get<BlacklistEntry>(
    'SELECT * FROM visitor_blacklist WHERE visitor_id = ? AND business_id = ?',
    [visitorId, businessId]
  )

  return entry!
}

export async function removeFromBlacklist(visitorId: string, businessId: number): Promise<boolean> {
  const db = getDb()
  const result = await db.run(
    'DELETE FROM visitor_blacklist WHERE visitor_id = ? AND business_id = ?',
    [visitorId, businessId]
  )
  return result.changes > 0
}

export async function getBlacklist(businessId: number): Promise<BlacklistEntry[]> {
  const db = getDb()
  const entries = await db.all<BlacklistEntry>(
    'SELECT * FROM visitor_blacklist WHERE business_id = ? ORDER BY created_at DESC',
    [businessId]
  )
  return entries
}

// ==========================================
// Transfer Session Functions (转接客服)
// ==========================================

interface StaffInfo {
  id: number
  username: string
  name: string
  avatar: string
  status: string
}

export async function getAvailableStaffForTransfer(
  excludeStaffId?: string,
  businessId?: number
): Promise<StaffInfo[]> {
  const db = getDb()

  let query = 'SELECT id, username, name, avatar, status FROM staff_users WHERE status = ?'
  const params: unknown[] = ['active']

  if (businessId) {
    query += ' AND business_id = ?'
    params.push(businessId)
  }

  if (excludeStaffId) {
    query += ' AND id != ?'
    params.push(parseInt(excludeStaffId, 10))
  }

  query += ' ORDER BY name ASC'

  const staff = await db.all<StaffInfo>(query, params)
  return staff
}

export async function transferSession(
  sessionId: string,
  targetStaffId: number,
  reason?: string,
  businessId?: number
): Promise<{ success: boolean; error?: string }> {
  const db = getDb()
  const now = Date.now()

  try {
    if (businessId && businessId !== 0) {
      const session = await db.get<{ business_id: number }>(
        'SELECT business_id FROM sessions WHERE id = ?',
        [sessionId]
      )
      if (!session) {
        return { success: false, error: 'Session not found' }
      }
      if (session.business_id !== businessId) {
        return { success: false, error: 'Access denied' }
      }

      const targetStaff = await db.get<{ business_id: number }>(
        'SELECT business_id FROM staff_users WHERE id = ?',
        [targetStaffId]
      )
      if (!targetStaff || targetStaff.business_id !== businessId) {
        return { success: false, error: 'Target staff does not belong to this business' }
      }
    }

    // Update session with new staff (多租户隔离：带 business_id 条件)
    if (businessId && businessId !== 0) {
      await db.run(
        'UPDATE sessions SET service_id = ?, updated_at = ? WHERE id = ? AND business_id = ?',
        [targetStaffId, now, sessionId, businessId]
      )
    } else {
      await db.run('UPDATE sessions SET service_id = ?, updated_at = ? WHERE id = ?', [
        targetStaffId,
        now,
        sessionId,
      ])
    }

    // Log the transfer
    console.log(
      `[StaffService] Session ${sessionId} transferred to staff ${targetStaffId}. Reason: ${reason || 'N/A'}`
    )

    return { success: true }
  } catch (error) {
    console.error('[StaffService] Transfer session error:', error)
    return { success: false, error: 'Failed to transfer session' }
  }
}

// ==========================================
// Evaluation Settings Functions (评价设置)
// ==========================================

interface EvaluationSetting {
  id: number
  business_id: number
  title: string
  questions: string
  word_switch: string
  word_title: string
}

export async function getEvaluationSettings(
  businessId?: number
): Promise<EvaluationSetting | null> {
  const db = getDb()
  if (businessId && businessId !== 0) {
    return db.get<EvaluationSetting>(
      'SELECT * FROM evaluation_setting WHERE business_id = ? LIMIT 1',
      [businessId]
    )
  }
  const setting = await db.get<EvaluationSetting>('SELECT * FROM evaluation_setting LIMIT 1')
  return setting
}

export async function updateEvaluationSettings(
  data: {
    title?: string
    questions?: string
    word_switch?: string
    word_title?: string
  },
  businessId?: number
): Promise<EvaluationSetting> {
  const db = getDb()
  const now = Date.now()

  const existing = await getEvaluationSettings(businessId)

  if (existing) {
    const updates: string[] = ['updated_at = ?']
    const params: unknown[] = [now]

    if (data.title !== undefined) {
      updates.push('title = ?')
      params.push(data.title)
    }
    if (data.questions !== undefined) {
      updates.push('questions = ?')
      params.push(data.questions)
    }
    if (data.word_switch !== undefined) {
      updates.push('word_switch = ?')
      params.push(data.word_switch)
    }
    if (data.word_title !== undefined) {
      updates.push('word_title = ?')
      params.push(data.word_title)
    }

    if (businessId && businessId !== 0) {
      params.push(existing.id)
      params.push(businessId)
      await db.run(
        `UPDATE evaluation_setting SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`,
        params
      )
    } else {
      params.push(existing.id)
      await db.run(`UPDATE evaluation_setting SET ${updates.join(', ')} WHERE id = ?`, params)
    }
  } else {
    await db.run(
      'INSERT INTO evaluation_setting (business_id, title, questions, word_switch, word_title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        businessId || 1,
        data.title || '',
        data.questions || '[]',
        data.word_switch || 'close',
        data.word_title || '',
        now,
        now,
      ]
    )
  }

  return (await getEvaluationSettings(businessId))!
}

// Staff user management
export interface CreateStaffUserParams {
  username: string
  password: string
  name?: string
  email?: string
  role?: string
  businessId?: number
}

export interface StaffUser {
  id: number
  business_id: number
  business_slug: string | null
  business_name: string | null
  username: string
  email: string | null
  name: string | null
  role: string
  status: string
  created_at: number
  updated_at: number
}

/**
 * Create a new staff user (sub-account)
 */
export async function createStaffUser(
  params: CreateStaffUserParams
): Promise<{ success: boolean; data?: StaffUser; error?: string }> {
  const db = getDb()
  const { username, password, name, email, role = 'staff', businessId = 1 } = params

  try {
    // Check if username already exists
    const existing = await db.get<{ id: number }>('SELECT id FROM staff_users WHERE username = ?', [
      username,
    ])
    if (existing) {
      return { success: false, error: '用户名已存在' }
    }

    // Hash the password
    const passwordHash = await hashPassword(password)

    // Insert the new staff user
    const result = await db.run(
      'INSERT INTO staff_users (business_id, username, password_hash, name, email, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [businessId, username, passwordHash, name || '', email || '', role, 'active']
    )

    // Fetch the created user
    const user = await db.get<StaffUser>(
      'SELECT id, business_id, username, email, name, role, status, created_at, updated_at FROM staff_users WHERE id = ?',
      [result.lastInsertRowid]
    )

    return { success: true, data: user! }
  } catch (error) {
    console.error('[StaffService] Create staff user error:', error)
    return { success: false, error: error instanceof Error ? error.message : '创建失败' }
  }
}

/**
 * List all staff users for a business
 */
export async function listStaffUsers(
  businessId: number = 1,
  currentUserId?: number
): Promise<StaffUser[]> {
  const db = getDb()

  console.log('[StaffService] listStaffUsers called with businessId:', businessId, 'currentUserId:', currentUserId)

  // 如果当前用户是主体商家（business_id=0），返回该商家自己和其下级客服
  // 注意：商家主账号登录后 token 中的 businessId 已被设置为 userId，不会进入此分支
  if (businessId === 0 && currentUserId) {
    console.log('[StaffService] listStaffUsers: super admin mode, returning self + subordinates')
    return await db.all<StaffUser>(
      'SELECT id, business_id, username, email, name, role, status, created_at, updated_at FROM staff_users WHERE id = ? OR business_id = ? ORDER BY created_at DESC',
      [currentUserId, currentUserId]
    )
  }

  // 商家主账号登录后 businessId = userId（如 4），通过 business_id 字段过滤
  // 同时也要查出商家主账号自己（business_id=0 但 id=businessId 的那条记录）
  console.log('[StaffService] listStaffUsers: filtering by business_id =', businessId, 'or id =', businessId, '(owner)')
  return await db.all<StaffUser>(
    'SELECT id, business_id, username, email, name, role, status, created_at, updated_at FROM staff_users WHERE business_id = ? OR (id = ? AND business_id = 0) ORDER BY created_at DESC',
    [businessId, businessId]
  )
}

/**
 * Delete a staff user
 */
export async function updateStaffUser(
  id: number,
  businessId: number,
  params: Partial<CreateStaffUserParams>
): Promise<{ success: boolean; data?: StaffUser; error?: string }> {
  const db = getDb()
  const { username, password, name, email, role } = params

  try {
    const user = await db.get<{ business_id: number }>(
      'SELECT business_id FROM staff_users WHERE id = ?',
      [id]
    )
    if (!user) {
      return { success: false, error: '用户不存在' }
    }
    if (user.business_id !== businessId && user.business_id !== 0) {
      return { success: false, error: '无权编辑其他商家的用户' }
    }

    const updates: string[] = []
    const updateParams: unknown[] = []

    if (username !== undefined) {
      updates.push('username = ?')
      updateParams.push(username)
    }
    if (password !== undefined && password !== '') {
      const passwordHash = await hashPassword(password)
      updates.push('password_hash = ?')
      updateParams.push(passwordHash)
    }
    if (name !== undefined) {
      updates.push('name = ?')
      updateParams.push(name || '')
    }
    if (email !== undefined) {
      updates.push('email = ?')
      updateParams.push(email || null)
    }
    if (role !== undefined) {
      updates.push('role = ?')
      updateParams.push(role)
    }

    if (updates.length === 0) {
      return { success: false, error: '没有需要更新的字段' }
    }

    await db.run(`UPDATE staff_users SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`, [
      ...updateParams,
      Date.now(),
      id,
    ])

    const updatedUser = await db.get<StaffUser>(
      'SELECT id, business_id, username, email, name, role, status, created_at, updated_at FROM staff_users WHERE id = ?',
      [id]
    )

    return { success: true, data: updatedUser! }
  } catch (error) {
    console.error('[StaffService] Update staff user error:', error)
    return { success: false, error: error instanceof Error ? error.message : '更新失败' }
  }
}

export async function deleteStaffUser(
  id: number,
  businessId: number
): Promise<{ success: boolean; error?: string }> {
  const db = getDb()
  try {
    const user = await db.get<{ business_id: number }>(
      'SELECT business_id FROM staff_users WHERE id = ?',
      [id]
    )
    if (!user) {
      return { success: false, error: '用户不存在' }
    }
    if (user.business_id !== businessId) {
      return { success: false, error: '无权删除其他商家的用户' }
    }
    await db.run('DELETE FROM staff_users WHERE id = ?', [id])
    return { success: true }
  } catch (error) {
    console.error('[StaffService] Delete staff user error:', error)
    return { success: false, error: error instanceof Error ? error.message : '删除失败' }
  }
}

export async function updateOwnProfile(
  id: number,
  params: { name?: string; password?: string }
): Promise<{ success: boolean; data?: StaffUser; error?: string }> {
  const db = getDb()
  const { name, password } = params

  try {
    const user = await db.get<StaffUser>('SELECT * FROM staff_users WHERE id = ?', [id])
    if (!user) {
      return { success: false, error: '用户不存在' }
    }

    const updates: string[] = []
    const updateParams: unknown[] = []

    if (name !== undefined && name !== '') {
      updates.push('name = ?')
      updateParams.push(name)
    }
    if (password !== undefined && password !== '') {
      const passwordHash = await hashPassword(password)
      updates.push('password_hash = ?')
      updateParams.push(passwordHash)
    }

    if (updates.length === 0) {
      return { success: false, error: '没有需要更新的字段' }
    }

    await db.run(`UPDATE staff_users SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`, [
      ...updateParams,
      Date.now(),
      id,
    ])

    const updatedUser = await db.get<StaffUser>(
      'SELECT id, business_id, username, email, name, role, status, created_at, updated_at FROM staff_users WHERE id = ?',
      [id]
    )

    return { success: true, data: updatedUser! }
  } catch (error) {
    console.error('[StaffService] Update own profile error:', error)
    return { success: false, error: error instanceof Error ? error.message : '更新失败' }
  }
}
