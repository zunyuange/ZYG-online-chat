/**
 * Staff API routes - Customer service endpoints
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import * as staffService from '../services/staff-service'
import {
  createStaffUser,
  listStaffUsers,
  deleteStaffUser,
  updateStaffUser,
  updateOwnProfile,
} from '../services/staff-service'
import * as chatService from '@server/module-chat/services/chat-service'
import * as uploadService from '@server/module-chat/services/upload-service'
import * as sseService from '@server/module-chat/services/sse-service'
import * as queueService from '@server/module-chat/services/queue-service'
import { translateText, isTranslationUseful, getTranslationSettings, detectSourceLanguage } from '@server/services/translate-service'
import { verifyToken } from '@server/module-auth/services/auth-service'
import { getDb } from '@server/shared/db'
import { updateStaffLastActive } from '@server/module-admin/services/admin-service'
import { visitorFieldRoutes } from './visitor-field-routes'

export const staffRoutes = new Hono()

// 注册访客自定义字段子路由
staffRoutes.route('/visitor-fields', visitorFieldRoutes)

async function requireAuth(c: any, next: any) {
  // Support both Authorization header AND ?token= query parameter (for EventSource SSE)
  let token: string | null = null

  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  // Fallback: query parameter token (for SSE/EventSource which can't set headers)
  if (!token) {
    token = c.req.query('token') || null
  }

  if (!token) {
    return c.json({ success: false, error: '未提供认证令牌' }, 401)
  }

  const result = await verifyToken(token)

  if (!result.valid) {
    return c.json({ success: false, error: result.error || 'Token 无效' }, 401)
  }

  // Attach businessId, businessSlug, userId and role to context for downstream use
  // 注意：businessId 可能是 0（超级管理员），需要用 !== undefined 判断
  if (result.businessId !== undefined) {
    c.set('businessId', result.businessId)
  }
  if (result.businessSlug) {
    c.set('businessSlug', result.businessSlug)
  }
  if (result.userId !== undefined) {
    c.set('userId', result.userId)
  }
  if (result.role) {
    c.set('role', result.role)
  }

  await next()
}

staffRoutes.use('*', requireAuth)

// Helper to safely read numeric values from context (c.get returns unknown)
function getCtxNumber(c: any, key: string, defaultVal?: number): number | undefined {
  const v = c.get(key)
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : defaultVal
  }
  return defaultVal
}

function getCtxString(c: any, key: string, defaultVal = ''): string {
  const v = c.get(key)
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return defaultVal
}

// Ensure that a valid business context exists for staff routes.
// Returns { businessId, isSuperAdmin } or sends a 403 response and returns null.
//
// 多租户隔离核心逻辑：
// - default 商家 admin (role=admin, businessSlug='default'): 超级管理员，可查看所有商家数据
//   但 businessId 仍返回自己的实际值（即 userId），用于自身商家的数据操作
// - 其他商家管理员 (role=admin, businessSlug!=default): 只能查看自己商家的数据
// - 普通客服 (role=staff): 只能查看自己商家的数据
// 注：isSuperAdmin 用于判断是否有跨商家权限（如查看所有商家会话、管理所有商家等）
function requireBusiness(c: any): { businessId: number; isSuperAdmin: boolean } | null {
  const businessId = getCtxNumber(c, 'businessId')
  const role = getCtxString(c, 'role')
  const businessSlug = getCtxString(c, 'businessSlug')
  // 超级管理员：role=admin 且 businessSlug=default
  const isSuperAdmin = role === 'admin' && businessSlug === 'default'

  // 非超级管理员必须有 businessId
  if (!isSuperAdmin && (businessId === undefined || businessId === 0)) {
    c.status(403)
    c.json({ success: false, error: '缺失商家上下文或无权限' })
    return null
  }

  // 返回实际的 businessId 用于数据过滤；isSuperAdmin 用于额外权限判断
  return { businessId: businessId!, isSuperAdmin }
}

// ==========================================
// Session Routes
// ==========================================

// List all sessions (with permission filtering)
// 多租户隔离：businessId=0 表示超级管理员可查看所有商家会话
staffRoutes.get('/sessions', async c => {
  try {
    const status = c.req.query('status') as 'active' | 'closed' | undefined
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const staffId = getCtxNumber(c, 'userId') || undefined
    const role = getCtxString(c, 'role')

    const sessions = await staffService.listSessionsWithPreview(
      status,
      bizCtx.businessId,
      staffId,
      role,
      getCtxString(c, 'businessSlug')
    )
    return c.json({ success: true, data: sessions })
  } catch (error) {
    console.error('List sessions error:', error)
    return c.json({ success: false, error: 'Failed to list sessions' }, 500)
  }
})

// Get single session
staffRoutes.get('/sessions/:sessionId', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const result = await staffService.getSessionWithPreview(
      sessionId,
      bizCtx.businessId
    )
    if (!result.session) {
      return c.json({ success: false, error: 'Session not found' }, 404)
    }
    return c.json({ success: true, data: result })
  } catch (error) {
    console.error('Get session error:', error)
    return c.json({ success: false, error: 'Failed to get session' }, 500)
  }
})

// Get total unread count
staffRoutes.get('/unread', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const count = await staffService.getTotalUnreadCount(bizCtx.businessId)
    return c.json({ success: true, data: { count } })
  } catch (error) {
    console.error('Get unread count error:', error)
    return c.json({ success: false, error: 'Failed to get unread count' }, 500)
  }
})

// ==========================================
// Message Routes
// ==========================================

// Get messages for a session
// 多租户隔离：验证 session 归属后再返回消息
staffRoutes.get('/messages', async c => {
  try {
    const sessionId = c.req.query('sessionId')
    if (!sessionId) {
      return c.json({ success: false, error: 'Session ID is required' }, 400)
    }

    const before = c.req.query('before') ? parseInt(c.req.query('before')!) : undefined
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    const result = await staffService.getMessages(sessionId, before, limit, bizCtx.businessId)
    return c.json({ success: true, data: result.messages, hasMore: result.hasMore })
  } catch (error) {
    console.error('Get messages error:', error)
    return c.json({ success: false, error: 'Failed to get messages' }, 500)
  }
})

// Send message (staff reply)
staffRoutes.post('/messages', async c => {
  try {
    const body = await c.req.json()
    const { sessionId, contentType, content, thumbnailUrl, fileName, fileSize } = body

    if (!sessionId || !contentType || !content) {
      return c.json({ success: false, error: 'Missing required fields' }, 400)
    }

    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    // 获取 session（不带 businessId 过滤，因为 sessions.business_id 存的是主体商家管理员ID）
    // 翻译和消息发送都需要 session 信息
    const session = await chatService.getSession(sessionId);
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404)
    }

    // 自动翻译：客服消息翻译为访客的语言
    // 注意：不使用 session.lang 与 staff.lang 比较来跳过翻译，因为界面语言 ≠ 内容语言
    // 例如：客服用中文界面上打英文 → 访客界面也是中文 → 英文内容仍需翻译
    // 实际的"内容已是目标语言"检测由 translateText() 内部的 isLikelyAlreadyInTargetLang() 完成
    // ⚠️ 关键：使用 session.businessId（主体商家管理员ID）而非 bizCtx.businessId（当前客服ID）
    // 下级客服可能自己没有配置翻译，但上级商家已全局启用 → 需查询上级设置
    let translatedContent: string | undefined;
    let translateEngine: string | undefined;
    if (contentType === 'text') {
      const txBusinessId = session?.businessId || bizCtx.businessId;
      const txSettings = await getTranslationSettings(txBusinessId, getCtxString(c, 'businessSlug'));

      // ★ 翻译目标语言：优先 session.lang（访客浏览器语言）
      // ★ 修复：当 session.lang 为空时，不 fallback 到 txSettings.defaultLang
      //   因为 txSettings.defaultLang 是商家/客服的语言，不是访客的语言
      //   如客服设 defaultLang='zh-TW'，访客 lang 为空时若翻译到 zh-TW，访客会认为翻译错了
      const visitorLang = session?.lang;
      const targetLang = visitorLang || 'zh-CN';
      const targetLangSource = visitorLang ? 'session.lang' : 'zh-CN (visitor lang unknown, default)';

      console.log('[StaffRoutes] 🔍 Translation check',
        '| staffId:', bizCtx.businessId,
        '| queriedBusinessId:', txBusinessId,
        '| txSettings:', txSettings ? `enabled=${txSettings.enabled} defaultLang=${txSettings.defaultLang}` : 'NULL',
        '| session.lang:', session?.lang || 'NULL',
        '| targetLang:', targetLang, '(source:', targetLangSource + ')',
        '| session.businessId:', session?.businessId);

      if (txSettings?.enabled && targetLang) {
        const staffDetectedLang = detectSourceLanguage(content as string);
        console.log('[StaffRoutes] 🈂️ Auto-translating staff message to visitor lang:', targetLang,
          '| langSource:', targetLangSource,
          '| detectedContentLang:', staffDetectedLang,
          '| staffId:', bizCtx.businessId);
        const translateResult = await translateText({
          text: content,
          to: targetLang,
          businessId: txBusinessId,
          _settings: txSettings as any,
        } as any);
        if (translateResult.engine === 'same_language') {
          translatedContent = undefined;
          console.log('[StaffRoutes] ⏭️ Auto-translate skipped: content already in target language',
            '| detected:', staffDetectedLang, '| target:', targetLang);
        } else if (!translateResult.success || !isTranslationUseful(content, translateResult.text)) {
          translatedContent = undefined;
          console.log('[StaffRoutes] ❌ Translation failed or not useful',
            '| engine:', translateResult.engine || 'none',
            '| success:', translateResult.success,
            '| detected:', staffDetectedLang,
            '| targetLang:', targetLang,
            '| textLen:', translateResult.text?.length || 0,
            '| contentLen:', content.length);
        } else {
          translatedContent = translateResult.text;
          translateEngine = translateResult.engine;
          console.log(`[StaffRoutes] ✅ Translation stored via ${translateResult.engine}, length:`, translatedContent.length);
        }
      } else if (!txSettings?.enabled) {
        console.warn('[StaffRoutes] ⚠️ Translation DISABLED',
          '| queriedBusinessId:', txBusinessId,
          '| staffId:', bizCtx.businessId,
          '| txSettings:', txSettings ? `enabled=${txSettings.enabled} defaultLang=${txSettings.defaultLang}` : 'NULL');
        console.warn('[StaffRoutes] 💡 Enable auto_translate in Staff Settings');
      } else {
        console.log('[StaffRoutes] Translation skipped: no target language available (session.lang is null, no defaultLang)');
      }
    }

    // 使用 session 的实际 businessId（主体商家管理员ID），而非当前客服自己的 staff_users.id
    const message = await staffService.sendMessage(
      {
        sessionId,
        senderType: 'staff',
        contentType,
        content,
        translatedContent,
        translateEngine,
        thumbnailUrl,
        fileName,
        fileSize,
      },
      session.businessId
    )

    // Broadcast to SSE clients
    await sseService.broadcastMessage(message)

    // Broadcast session update to staff
    await sseService.broadcastSessionUpdate(session)

    // ★ 更新 last_active：客服发送消息时标记为活跃
    const staffUserId = getCtxNumber(c, 'userId')
    if (staffUserId) {
      updateStaffLastActive(staffUserId).catch(err =>
        console.error('[StaffRoutes] Update last_active on message send error:', err)
      )
    }

    return c.json({ success: true, data: message })
  } catch (error) {
    console.error('Send message error:', error)
    return c.json({ success: false, error: 'Failed to send message' }, 500)
  }
})

// ==========================================
// Ping Route — 保持客服在线状态（用于无 SSE 场景，如管理后台）
// ==========================================

staffRoutes.post('/ping', async c => {
  try {
    const userId = getCtxNumber(c, 'userId')
    if (userId) {
      await updateStaffLastActive(userId)
    }
    return c.json({ success: true })
  } catch (error) {
    console.error('Ping error:', error)
    return c.json({ success: false, error: 'Ping failed' }, 500)
  }
})

// ==========================================
// File Upload Route
// ==========================================

staffRoutes.post('/upload', async c => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const sessionId = formData.get('sessionId') as string

    if (!file || !sessionId) {
      return c.json({ success: false, error: 'File and sessionId are required' }, 400)
    }

    // Validate file and auto-detect content type
    const validation = uploadService.validateFile({
      type: file.type,
      size: file.size,
      name: file.name,
    })

    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400)
    }

    const contentType = validation.detectedType!

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadResult = await uploadService.saveFileBuffer(buffer, file.name, file.type)

    // Create message
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const message = await staffService.sendMessage(
      {
        sessionId,
        senderType: 'staff',
        contentType,
        content: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
      },
      bizCtx.businessId
    )

    // Broadcast to SSE clients
    await sseService.broadcastMessage(message)

    return c.json({ success: true, data: message })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ success: false, error: 'Failed to upload file' }, 500)
  }
})

// ==========================================
// SSE Route (Staff receives all messages)
// ==========================================

staffRoutes.get('/sse', async c => {
  const bizCtx = requireBusiness(c)
  if (!bizCtx) return

  const userId = getCtxNumber(c, 'userId')

  return streamSSE(c, async stream => {
    // Add staff client to connection pool with business isolation
    // businessId=0 for super admin (receives all), others receive only their own
    sseService.addStaffClient(stream, bizCtx.businessId)

    // Send connected event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ type: 'connected' }),
    })

    // Keep connection alive with periodic heartbeats
    let isConnected = true

    const cleanup = () => {
      isConnected = false
      sseService.removeStaffClient(stream, bizCtx.businessId)
    }

    // Send periodic heartbeats
    // ★ 同时更新 last_active，确保只要客服的 SSE 连接存活就一直标记为在线
    while (isConnected) {
      await new Promise(resolve => setTimeout(resolve, 30000))
      try {
        // ★ 核心修复：每个 heartbeat 周期更新 last_active
        //   旧逻辑只发送 SSE heartbeat，不更新数据库 last_active
        //   导致登录超过 5 分钟后就显示"客服已下线"
        if (userId) {
          updateStaffLastActive(userId).catch(err =>
            console.error('[StaffRoutes] Update last_active error:', err)
          )
        }
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
        })
      } catch {
        isConnected = false
        cleanup()
      }
    }
  })
})

// ==========================================
// Mark as Read Route
// ==========================================

staffRoutes.put('/read/:sessionId', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const messageIds = await staffService.markAsRead(sessionId, 'staff', bizCtx.businessId)

    // Broadcast message read status to visitor
    if (messageIds.length > 0) {
      await sseService.broadcastMessageRead(sessionId, messageIds)
    }

    // Broadcast session update (ensure session belongs to this business)
    const session = await chatService.getSession(sessionId, bizCtx.businessId)
    if (session) {
      await sseService.broadcastSessionUpdate(session)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Mark as read error:', error)
    return c.json({ success: false, error: 'Failed to mark as read' }, 500)
  }
})

// ==========================================
// Topic & Task Status Routes
// ==========================================

// Update session topic
staffRoutes.put('/sessions/:sessionId/topic', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const body = await c.req.json()
    const { topic } = body
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    if (typeof topic !== 'string') {
      return c.json({ success: false, error: 'Topic must be a string' }, 400)
    }

    const session = await staffService.updateSessionTopic(sessionId, topic, bizCtx.businessId)
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404)
    }

    // Broadcast session update to both staff and visitor
    await sseService.broadcastSessionUpdate(session)

    return c.json({ success: true, data: session })
  } catch (error) {
    console.error('Update topic error:', error)
    return c.json({ success: false, error: 'Failed to update topic' }, 500)
  }
})

// Update task status
staffRoutes.put('/sessions/:sessionId/status', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const body = await c.req.json()
    const { taskStatus } = body
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    const validStatuses = [
      'requirement_discussion',
      'requirement_confirmed',
      'in_progress',
      'delivered',
      'reviewed',
    ]
    if (!validStatuses.includes(taskStatus)) {
      return c.json({ success: false, error: 'Invalid task status' }, 400)
    }

    const session = await staffService.updateTaskStatus(sessionId, taskStatus, bizCtx.businessId)
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404)
    }

    // Broadcast session update to both staff and visitor
    await sseService.broadcastSessionUpdate(session)

    return c.json({ success: true, data: session })
  } catch (error) {
    console.error('Update status error:', error)
    return c.json({ success: false, error: 'Failed to update status' }, 500)
  }
})

// ==========================================
// Message Management Routes
// ==========================================

// Delete all messages for a session
staffRoutes.delete('/messages/:sessionId', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    const result = await staffService.deleteSessionMessages(sessionId, bizCtx.businessId)

    if (result.success) {
      return c.json({ success: true, message: 'Messages deleted successfully' })
    } else {
      return c.json({ success: false, error: result.error }, 400)
    }
  } catch (error) {
    console.error('Delete messages error:', error)
    return c.json({ success: false, error: 'Failed to delete messages' }, 500)
  }
})

// End a session
staffRoutes.post('/sessions/:sessionId/end', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    const session = await staffService.endSession(sessionId, bizCtx.businessId)
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404)
    }

    console.log(`[StaffRoutes] Broadcasting session end for ${sessionId}`)

    // Broadcast session update to both staff and visitor clients
    await sseService.broadcastSessionUpdate(session)

    return c.json({ success: true, data: session })
  } catch (error) {
    console.error('End session error:', error)
    return c.json({ success: false, error: 'Failed to end session' }, 500)
  }
})

// ==========================================
// Queue Routes (Staff view)
// ==========================================

// Get queue list (all waiting sessions)
staffRoutes.get('/queue', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const queueList = await queueService.getQueueList(bizCtx.businessId)
    return c.json({ success: true, data: queueList })
  } catch (error) {
    console.error('Get queue list error:', error)
    return c.json({ success: false, error: 'Failed to get queue list' }, 500)
  }
})

// Get current staff's queue (their sessions + pending transfer requests)
// 多租户隔离：通过 staffId 查询，该 staffId 已在 JWT 中绑定 business_id
staffRoutes.get('/queue/my', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const staffId = getCtxNumber(c, 'userId')
    if (!staffId) return c.json({ success: false, error: 'Missing user id' }, 401)
    const staffQueue = await queueService.getStaffQueueList(staffId)
    return c.json({ success: true, data: staffQueue })
  } catch (error) {
    console.error('Get staff queue list error:', error)
    return c.json({ success: false, error: 'Failed to get staff queue list' }, 500)
  }
})

// ==========================================
// Statistics Routes (统计数据)
// ==========================================

// Get staff dashboard statistics
staffRoutes.get('/statistics', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const stats = await staffService.getStaffStatistics(bizCtx.businessId)
    return c.json({ success: true, data: stats })
  } catch (error) {
    console.error('Get statistics error:', error)
    return c.json({ success: false, error: 'Failed to get statistics' }, 500)
  }
})

// Get visitor list
staffRoutes.get('/visitors', async c => {
  try {
    const state = c.req.query('state') as string | undefined
    const groupid = c.req.query('groupid') as string | undefined
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const visitors = await staffService.getVisitorList(state, groupid, bizCtx.businessId)
    return c.json({ success: true, data: visitors })
  } catch (error) {
    console.error('Get visitor list error:', error)
    return c.json({ success: false, error: 'Failed to get visitor list' }, 500)
  }
})

// ==========================================
// Quick Replies Routes (常用语管理)
// ==========================================

// Get quick replies (sentences)
staffRoutes.get('/sentences', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const sentences = await staffService.getSentences(bizCtx.businessId)
    return c.json({ success: true, data: sentences })
  } catch (error) {
    console.error('Get sentences error:', error)
    return c.json({ success: false, error: 'Failed to get sentences' }, 500)
  }
})

// Add a new sentence
staffRoutes.post('/sentences', async c => {
  try {
    const body = await c.req.json()
    const { content, tag, lang } = body

    if (!content) {
      return c.json({ success: false, error: 'Content is required' }, 400)
    }

    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const staffId = getCtxNumber(c, 'userId') || undefined

    const sentence = await staffService.addSentence({ content, tag, lang, staffId, businessId: bizCtx.businessId })
    return c.json({ success: true, data: sentence })
  } catch (error) {
    console.error('Add sentence error:', error)
    return c.json({ success: false, error: 'Failed to add sentence' }, 500)
  }
})

// Update a sentence
staffRoutes.put('/sentences/:id', async c => {
  try {
    const id = parseInt(c.req.param('id'), 10)
    const body = await c.req.json()
    const { content, tag, state } = body
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    const sentence = await staffService.updateSentence(id, { content, tag, state, businessId: bizCtx.businessId })
    if (!sentence) {
      return c.json({ success: false, error: 'Sentence not found' }, 404)
    }

    return c.json({ success: true, data: sentence })
  } catch (error) {
    console.error('Update sentence error:', error)
    return c.json({ success: false, error: 'Failed to update sentence' }, 500)
  }
})

// Delete a sentence
staffRoutes.delete('/sentences/:id', async c => {
  try {
    const id = parseInt(c.req.param('id'), 10)
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const result = await staffService.deleteSentence(id, bizCtx.businessId)

    if (!result) {
      return c.json({ success: false, error: 'Sentence not found' }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete sentence error:', error)
    return c.json({ success: false, error: 'Failed to delete sentence' }, 500)
  }
})

// ==========================================
// Offline Messages Routes (留言管理)
// ==========================================

// Get offline messages
staffRoutes.get('/offline-messages', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const messages = await staffService.getOfflineMessages(bizCtx.businessId)
    return c.json({ success: true, data: messages })
  } catch (error) {
    console.error('Get offline messages error:', error)
    return c.json({ success: false, error: 'Failed to get offline messages' }, 500)
  }
})

// Update offline message status
staffRoutes.put('/offline-messages/:id', async c => {
  try {
    const id = parseInt(c.req.param('id'), 10)
    const body = await c.req.json()
    const { status } = body
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    const message = await staffService.updateOfflineMessageStatus(id, status, bizCtx.businessId)
    if (!message) {
      return c.json({ success: false, error: 'Message not found' }, 404)
    }

    return c.json({ success: true, data: message })
  } catch (error) {
    console.error('Update offline message error:', error)
    return c.json({ success: false, error: 'Failed to update offline message' }, 500)
  }
})

// ==========================================
// Visitor Blacklist Routes (黑名单管理)
// ==========================================

// Add visitor to blacklist
staffRoutes.post('/blacklist', async c => {
  try {
    const body = await c.req.json()
    const { visitorId, reason } = body

    if (!visitorId) {
      return c.json({ success: false, error: 'Visitor ID is required' }, 400)
    }

    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    const result = await staffService.addToBlacklist(visitorId, bizCtx.businessId, reason)
    return c.json({ success: true, data: result })
  } catch (error) {
    console.error('Add to blacklist error:', error)
    return c.json({ success: false, error: 'Failed to add to blacklist' }, 500)
  }
})

// Remove visitor from blacklist
staffRoutes.delete('/blacklist/:visitorId', async c => {
  try {
    const visitorId = c.req.param('visitorId')
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const result = await staffService.removeFromBlacklist(visitorId, bizCtx.businessId)

    if (!result) {
      return c.json({ success: false, error: 'Visitor not found in blacklist' }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Remove from blacklist error:', error)
    return c.json({ success: false, error: 'Failed to remove from blacklist' }, 500)
  }
})

// Get blacklist
staffRoutes.get('/blacklist', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const blacklist = await staffService.getBlacklist(bizCtx.businessId)
    return c.json({ success: true, data: blacklist })
  } catch (error) {
    console.error('Get blacklist error:', error)
    return c.json({ success: false, error: 'Failed to get blacklist' }, 500)
  }
})

// ==========================================
// Transfer Session Routes (转接客服)
// ==========================================

// Get available staff for transfer
staffRoutes.get('/transfer/staff', async c => {
  try {
    const currentStaffId = c.req.query('excludeStaffId')
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const staff = await staffService.getAvailableStaffForTransfer(currentStaffId, bizCtx.businessId)
    return c.json({ success: true, data: staff })
  } catch (error) {
    console.error('Get available staff error:', error)
    return c.json({ success: false, error: 'Failed to get available staff' }, 500)
  }
})

// Transfer session to another staff
staffRoutes.post('/transfer/:sessionId', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const body = await c.req.json()
    const { targetStaffId, reason } = body
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    if (!targetStaffId) {
      return c.json({ success: false, error: 'Target staff ID is required' }, 400)
    }

    const result = await staffService.transferSession(
      sessionId,
      parseInt(targetStaffId, 10),
      reason,
      bizCtx.businessId
    )
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400)
    }

    return c.json({ success: true, message: 'Transfer successful' })
  } catch (error) {
    console.error('Transfer session error:', error)
    return c.json({ success: false, error: 'Failed to transfer session' }, 500)
  }
})

// ==========================================
// Evaluation Routes (评价管理)
// ==========================================

// Get evaluation settings
staffRoutes.get('/evaluation-settings', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const settings = await staffService.getEvaluationSettings(bizCtx.businessId)
    return c.json({ success: true, data: settings })
  } catch (error) {
    console.error('Get evaluation settings error:', error)
    return c.json({ success: false, error: 'Failed to get evaluation settings' }, 500)
  }
})

// Update evaluation settings
staffRoutes.put('/evaluation-settings', async c => {
  try {
    const body = await c.req.json()
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const settings = await staffService.updateEvaluationSettings(body, bizCtx.businessId)
    return c.json({ success: true, data: settings })
  } catch (error) {
    console.error('Update evaluation settings error:', error)
    return c.json({ success: false, error: 'Failed to update evaluation settings' }, 500)
  }
})

// ==========================================
// Staff User Management (Sub-accounts)
// ==========================================

// Create a new staff sub-account
staffRoutes.post('/users', async c => {
  try {
    const body = await c.req.json()
    const { username, password, name, email, role } = body

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码不能为空' }, 400)
    }

    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const userId = getCtxNumber(c, 'userId') || undefined

    // 如果当前用户是超级管理员（businessId=0），使用用户自己的ID作为businessId
    // 这样创建的客服账号会关联到这个商家
    const effectiveBusinessId = bizCtx.businessId === 0 ? userId : bizCtx.businessId

    const result = await createStaffUser({
      username,
      password,
      name,
      email,
      role,
      businessId: effectiveBusinessId,
    })

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400)
    }

    return c.json({ success: true, data: result.data })
  } catch (error) {
    console.error('Create staff user error:', error)
    return c.json({ success: false, error: 'Failed to create staff user' }, 500)
  }
})

// List all staff users for current business
staffRoutes.get('/users', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    const userId = getCtxNumber(c, 'userId') || undefined
    const users = await listStaffUsers(bizCtx.businessId, userId)
    return c.json({ success: true, data: users })
  } catch (error) {
    console.error('List staff users error:', error)
    return c.json({ success: false, error: 'Failed to list staff users' }, 500)
  }
})

// Update a staff user
staffRoutes.put('/users', async c => {
  try {
    const body = await c.req.json()
    const { id, username, password, name, email, role } = body

    if (!id) {
      return c.json({ success: false, error: '用户ID不能为空' }, 400)
    }

    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    const result = await updateStaffUser(parseInt(id, 10), bizCtx.businessId, {
      username,
      password,
      name,
      email,
      role,
    })

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400)
    }

    return c.json({ success: true, data: result.data })
  } catch (error) {
    console.error('Update staff user error:', error)
    return c.json({ success: false, error: 'Failed to update staff user' }, 500)
  }
})

// Delete a staff user
staffRoutes.delete('/users/:id', async c => {
  try {
    const id = parseInt(c.req.param('id'), 10)
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return

    if (!id) {
      return c.json({ success: false, error: 'Invalid user ID' }, 400)
    }

    const result = await deleteStaffUser(id, bizCtx.businessId)
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete staff user error:', error)
    return c.json({ success: false, error: 'Failed to delete staff user' }, 500)
  }
})

// Update own profile
staffRoutes.put('/profile', async c => {
  try {
    const body = await c.req.json()
    const { name, password } = body
    const userId = getCtxNumber(c, 'userId')
    if (!userId) return c.json({ success: false, error: 'Missing user id' }, 401)

    const result = await updateOwnProfile(userId, { name, password })

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400)
    }

    return c.json({ success: true, data: result.data })
  } catch (error) {
    console.error('Update profile error:', error)
    return c.json({ success: false, error: 'Failed to update profile' }, 500)
  }
})

// Update own language preference (下级客服切换语言)
staffRoutes.put('/language', async c => {
  try {
    const body = await c.req.json()
    const { lang } = body
    if (!lang) {
      return c.json({ success: false, error: '缺少语言参数' }, 400)
    }
    const userId = getCtxNumber(c, 'userId')
    if (!userId) return c.json({ success: false, error: 'Missing user id' }, 401)

    const db = getDb()
    await db.run(
      'UPDATE staff_users SET default_lang = ?, updated_at = ? WHERE id = ?',
      [lang, Date.now(), userId]
    )
    return c.json({ success: true, data: { default_lang: lang } })
  } catch (error) {
    console.error('Update language error:', error)
    return c.json({ success: false, error: 'Failed to update language' }, 500)
  }
})

// Get own language preference
staffRoutes.get('/language', async c => {
  try {
    const userId = getCtxNumber(c, 'userId')
    if (!userId) return c.json({ success: false, error: 'Missing user id' }, 401)

    const db = getDb()
    const row = await db.get<{ default_lang: string }>(
      'SELECT default_lang FROM staff_users WHERE id = ?',
      [userId]
    )
    return c.json({ success: true, data: { default_lang: row?.default_lang || 'zh-CN' } })
  } catch (error) {
    console.error('Get language error:', error)
    return c.json({ success: false, error: 'Failed to get language' }, 500)
  }
})

// Get translation configuration status (for staff settings page)
staffRoutes.get('/translation-status', async c => {
  try {
    const bizCtx = requireBusiness(c)
    if (!bizCtx) return
    
    const txSettings = await getTranslationSettings(bizCtx.businessId, getCtxString(c, 'businessSlug'))
    
    let diagnoseMessage = '';
    let diagnoseAction = '';
    if (!txSettings) {
      diagnoseMessage = '未找到翻译设置（商家账号可能不存在）';
      diagnoseAction = '请确认 staff_users 表中存在该商家';
    } else if (!txSettings.enabled) {
      diagnoseMessage = '翻译功能未启用（enable_auto_trans = 0）';
      diagnoseAction = '请在后台「系统设置」中打开自动翻译开关';
    } else {
      diagnoseMessage = '翻译已启用（使用 SimplyTranslate + Google + MyMemory 免费翻译）';
      diagnoseAction = '';
    }
    
    return c.json({
      success: true,
      data: {
        businessId: bizCtx.businessId,
        enabled: txSettings?.enabled ?? false,
        defaultLang: txSettings?.defaultLang ?? 'unknown',
        canTranslate: !!(txSettings?.enabled && txSettings?.defaultLang),  // 移除appid/secret要求
        diagnoseMessage,
        diagnoseAction,
      }
    })
  } catch (error) {
    console.error('Staff translation status error:', error)
    return c.json({ success: false, error: 'Failed to get translation status' }, 500)
  }
})

