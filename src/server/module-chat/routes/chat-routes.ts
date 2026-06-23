/**
 * Chat API routes - User/Visitor endpoints
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import * as chatService from '../services/chat-service'
import * as uploadService from '../services/upload-service'
import * as sseService from '../services/sse-service'
import * as queueService from '../services/queue-service'
import * as transferService from '../services/transfer-service'
import * as barkService from '@server/services/bark-service'
import { translateText, translateWithEngine, isTranslationUseful, getTranslationSettings, detectSourceLanguage } from '@server/services/translate-service'
import { searchKnowledge } from '@server/module-robot/services/robot-service'
import { verifyToken } from '@server/module-auth/services/auth-service'
import { getDb } from '@server/shared/db'

export const chatRoutes = new Hono()

async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未提供认证令牌' }, 401)
  }

  const token = authHeader.substring(7)
  const result = await verifyToken(token)

  if (!result.valid) {
    return c.json({ success: false, error: result.error || 'Token 无效' }, 401)
  }

  if (result.businessId) {
    c.set('businessId', result.businessId)
  }
  if (result.businessSlug) {
    c.set('businessSlug', result.businessSlug)
  }
  if (result.userId) {
    c.set('userId', result.userId)
  }
  if (result.role) {
    c.set('role', result.role)
  }

  await next()
}

function getCtxNumber(c: any, key: string, defaultVal?: number): number | undefined {
  const v = c.get(key)
  if (v === undefined || v === null) return defaultVal
  if (typeof v === 'number') return v
  const n = parseInt(String(v), 10)
  return Number.isNaN(n) ? defaultVal : n
}

function getCtxString(c: any, key: string): string | null {
  const v = c.get(key)
  if (v === undefined || v === null) return null
  return String(v)
}

// ==========================================
// Session Routes
// ==========================================

// Create or get session
chatRoutes.post('/session', async c => {
  try {
    const body = await c.req.json().catch(() => ({}))
    // 从请求头获取访客信息
    const forwardedIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP')
    const userAgent = c.req.header('User-Agent')
    const referer = c.req.header('Referer')
    
    // 服务端从 User-Agent 自动检测设备类型（兜底）
    const detectDevice = (ua: string): string => {
      if (/Mobile|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mobile';
      if (/iPad|Tablet/i.test(ua)) return 'Tablet';
      return 'Desktop';
    };

    const input = {
      visitorName: body.visitorName,
      sessionId: body.sessionId,
      business: body.business, // 商家标识(slug)
      // 访客自定义字段
      email: body.email,
      phone: body.phone,
      pid: body.pid,
      params: body.params,
      fromUrl: body.fromUrl,
      referer: referer || body.referer,
      ip: forwardedIp || body.ip,
      userAgent: userAgent || body.userAgent,
      device: body.device || (userAgent ? detectDevice(userAgent) : undefined),
      lang: body.lang,
      avatar: body.avatar,
    }

    const session = await chatService.createOrGetSession(input)
    return c.json({ success: true, data: session })
  } catch (error) {
    console.error('Create session error:', error)
    const detail = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error('Create session stack:', stack)
    return c.json({ success: false, error: 'Failed to create session', detail, stack }, 500)
  }
})

// Update session language (访客切换界面语言时同步更新 session.lang)
chatRoutes.put('/session/lang', async c => {
  try {
    const body = await c.req.json()
    const { sessionId, lang } = body
    if (!sessionId || !lang) {
      return c.json({ success: false, error: 'Missing sessionId or lang' }, 400)
    }
    const db = getDb()
    await db.run(
      'UPDATE sessions SET lang = ?, updated_at = ? WHERE id = ?',
      [lang, Date.now(), sessionId]
    )
    console.log('[ChatRoutes] Updated session lang:', sessionId, '→', lang)
    return c.json({ success: true, data: { lang } })
  } catch (error) {
    console.error('Update session lang error:', error)
    return c.json({ success: false, error: 'Failed to update session lang' }, 500)
  }
})

// ==========================================
// Translation Status Route (调试用)
// ==========================================

// Get translation configuration status for a session's business
chatRoutes.get('/translation-status', async c => {
  try {
    const sessionId = c.req.query('sessionId')
    if (!sessionId) {
      return c.json({ success: false, error: 'sessionId is required' }, 400)
    }
    const session = await chatService.getSession(sessionId)
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404)
    }
    const txSettings = await getTranslationSettings(session.businessId)
    
    // 详细诊断：告诉调用方具体缺少什么
    let diagnoseMessage = '';
    let diagnoseAction = '';
    let translationProvider = '';
    if (!txSettings) {
      diagnoseMessage = '未找到翻译设置（商家账号可能不存在）';
      diagnoseAction = '请确认 staff_users 表中存在该商家';
    } else if (!txSettings.enabled) {
      diagnoseMessage = '翻译功能未启用（enable_auto_trans = 0）';
      diagnoseAction = '请在后台「系统设置」中打开自动翻译开关';
    } else if (!txSettings.defaultLang) {
      diagnoseMessage = '未设置默认语言（default_lang 为空）';
      diagnoseAction = '请在后台「系统设置」中设置默认语言';
    } else {
      diagnoseMessage = '翻译已启用（使用 SimplyTranslate + Google + MyMemory 免费翻译）';
      diagnoseAction = '';
      translationProvider = 'simplytranslate+google+mymemory';
    }
    
    return c.json({
      success: true,
      data: {
        businessId: session.businessId,
        enabled: txSettings?.enabled ?? false,
        defaultLang: txSettings?.defaultLang ?? 'unknown',
        sessionLang: session.lang || 'not set',
        canTranslate: !!(txSettings?.enabled && txSettings?.defaultLang),
        translationProvider: translationProvider || 'none',
        diagnoseMessage,
        diagnoseAction,
      }
    })
  } catch (error) {
    console.error('Translation status error:', error)
    return c.json({ success: false, error: 'Failed to get translation status' }, 500)
  }
})

// Test translation API (calls free Google + MyMemory translation with a test phrase)
chatRoutes.get('/translation-test', async c => {
  try {
    const sessionId = c.req.query('sessionId')
    if (!sessionId) {
      return c.json({ success: false, error: 'sessionId is required' }, 400)
    }
    const session = await chatService.getSession(sessionId)
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404)
    }

    const txSettings = await getTranslationSettings(session.businessId)
    if (!txSettings) {
      return c.json({ success: false, error: 'No translation settings found', details: '请确认该商家在 staff_users 表中存在' }, 400)
    }
    if (!txSettings.enabled) {
      return c.json({ success: false, error: 'Translation is DISABLED', details: '请在商家设置中将 enable_auto_trans 设为 1' }, 400)
    }

    // Test: translate "Hello" → Chinese, "你好" → English
    // translateText() uses SimplyTranslate AI → Google → MyMemory (free fallback chain)
    const testText = 'Hello'
    const targetLang = txSettings.defaultLang || 'zh-CN'
    const startTime = Date.now()

    console.log('[TranslationTest] Testing translation with:', testText, '→', targetLang)
    const translateResult = await translateText({
      text: testText,
      to: targetLang,
      businessId: session.businessId,
      _settings: txSettings as any,
    } as any)

    const elapsed = Date.now() - startTime
    const translated = translateResult.text
    const success = translateResult.success && translated !== testText

    // Also test reverse direction
    let revTranslated: string | undefined
    let revSuccess = false
    if (success) {
      const revResult = await translateText({
        text: '你好',
        to: 'en-US',
        businessId: session.businessId,
        _settings: txSettings as any,
      } as any)
      revTranslated = revResult.text
      revSuccess = revResult.success && revTranslated !== '你好'
    }

    return c.json({
      success,
      data: {
        businessId: session.businessId,
        defaultLang: txSettings.defaultLang,
        sessionLang: session.lang || 'unknown',
        engine: translateResult.engine || 'none',
        apiTest: {
          request: `"${testText}" → ${targetLang}`,
          result: translated,
          success,
          elapsedMs: elapsed,
        },
        reverseTest: success ? {
          request: '"你好" → en-US',
          result: revTranslated || '',
          success: revSuccess,
        } : null,
        diagnostics: success
          ? `✅ 翻译功能正常 (引擎: ${translateResult.engine})`
          : '❌ 翻译失败: 所有翻译引擎均无法完成翻译，请检查网络连接',
      }
    })
  } catch (error) {
    console.error('Translation test error:', error)
    return c.json({ success: false, error: String(error) }, 500)
  }
})

// ==========================================
// Message Routes
// ==========================================

// Get messages (paginated)
chatRoutes.get('/messages', async c => {
  try {
    const sessionId = c.req.query('sessionId')
    if (!sessionId) {
      return c.json({ success: false, error: 'Session ID is required' }, 400)
    }

    const before = c.req.query('before') ? parseInt(c.req.query('before')!) : undefined
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20

    const result = await chatService.getMessages(sessionId, before, limit)
    return c.json({ success: true, data: result.messages, hasMore: result.hasMore })
  } catch (error) {
    console.error('Get messages error:', error)
    return c.json({ success: false, error: 'Failed to get messages' }, 500)
  }
})

// Send message
chatRoutes.post('/messages', async c => {
  try {
    const body = await c.req.json()
    const { sessionId, contentType, content, thumbnailUrl, fileName, fileSize } = body

    if (!sessionId || !contentType || !content) {
      return c.json({ success: false, error: 'Missing required fields' }, 400)
    }

    // ★ 自动翻译：访客消息翻译为客服语言（与 staff-routes 保持完全一致的逻辑）
    // 注意：不使用 session.lang 判断是否跳过翻译，因为访客界面语言 ≠ 消息内容语言
    // 例如：访客浏览器是中文但打出了韩文 → 仍需翻译为客服语言
    // 实际的"内容已是目标语言"检测由 translateText() 内部的 isLikelyAlreadyInTargetLang() 完成
    let translatedContent: string | undefined;
    let translateEngine: string | undefined;
    if (contentType === 'text') {
      const session = await chatService.getSession(sessionId);
      if (session) {
        // ⚠️ 与 staff-routes 对齐：使用 session.businessId 查询，传入 businessSlug 作为 fallback
        // 下级客服可能自己没有配置翻译，但上级商家已全局启用 → 需查询上级设置
        const txBusinessId = session.businessId || 1;
        const txSettings = await getTranslationSettings(txBusinessId, session.businessSlug);
        console.log('[ChatRoutes] 🔍 Translation check (visitor→staff)',
          '| txBusinessId:', txBusinessId,
          '| businessSlug:', session.businessSlug,
          '| txSettings:', txSettings ? `enabled=${txSettings.enabled} defaultLang=${txSettings.defaultLang}` : 'NULL',
          '| session.lang:', session.lang || 'NULL',
          '| assignedStaffId:', session.assignedStaffId || 'none');
        if (txSettings?.enabled) {
          // 翻译目标：优先使用分配客服的个人语言 → 商家默认语言 → 'zh-CN'
          let targetLang = txSettings.defaultLang || 'zh-CN';
          let staffName = '主体商家默认';
          const assignedStaffId = session.assignedStaffId;
          if (assignedStaffId && assignedStaffId > 0) {
            try {
              const db = getDb();
              const staffRow = await db.get<{ name: string; default_lang: string }>(
                'SELECT name, default_lang FROM staff_users WHERE id = ?',
                [assignedStaffId]
              );
              if (staffRow?.default_lang) {
                targetLang = staffRow.default_lang;
                staffName = staffRow.name || `ID:${assignedStaffId}`;
              }
            } catch (e) {
              console.warn('[ChatRoutes] Failed to get staff language, using default', e);
            }
          }
          // 记录翻译上下文（方便排查问题）
          const visitorDetectedLang = detectSourceLanguage(content as string);
          console.log('[ChatRoutes] 🈂️ Auto-translating visitor→staff',
            '| content:', (content as string).substring(0, 30),
            '| detectedLang:', visitorDetectedLang,
            '| visitorBrowserLang:', session.lang || '(empty)',
            '| staff:', staffName,
            '| targetLang:', targetLang,
            '| assignedStaffId:', assignedStaffId,
            '| txBusinessId:', txBusinessId);
          const translateResult = await translateText({
            text: content,
            to: targetLang,
            businessId: txBusinessId,
            _settings: txSettings as any,
          } as any);
          if (translateResult.engine === 'same_language') {
            console.log('[ChatRoutes] ⏭️ Auto-translate skipped: content already in target language',
              '| detected:', visitorDetectedLang, '| target:', targetLang);
          } else if (!translateResult.success || !isTranslationUseful(content, translateResult.text)) {
            console.log('[ChatRoutes] ❌ Translation not useful (all engines failed or returned same text)',
              '| engine:', translateResult.engine || 'none',
              '| detected:', visitorDetectedLang,
              '| targetLang:', targetLang,
              '| contentLen:', content.length);
          } else {
            translatedContent = translateResult.text;
            translateEngine = translateResult.engine;
            console.log(`[ChatRoutes] ✅ Visitor→${staffName} translated via ${translateResult.engine}:`, translatedContent.substring(0, 60));
          }
        } else {
          console.warn('[ChatRoutes] ⚠️ Translation DISABLED for txBusinessId:', txBusinessId,
            '| txSettings:', txSettings ? `enabled=${txSettings.enabled}` : 'NULL',
            '| businessSlug:', session.businessSlug);
          if (!txSettings) {
            console.warn('[ChatRoutes] 💡 No settings found - check staff_users table for businessId:', txBusinessId);
          }
        }
      } else {
        console.warn('[ChatRoutes] ⚠️ Session not found for auto-translate, sessionId:', sessionId);
      }
    }

    const message = await chatService.sendMessage({
      sessionId,
      senderType: 'visitor',
      contentType,
      content,
      translatedContent,
      translateEngine,
      thumbnailUrl,
      fileName,
      fileSize,
    })

    // Broadcast to SSE clients
    await sseService.broadcastMessage(message)

    // ==========================================
    // 机器人自动回复：搜索知识库匹配关键词
    // ==========================================
    const session = await chatService.getSession(sessionId)
    let autoReplyMessage: any = null;

    if (contentType === 'text' && session) {
      const visitorLang = session.lang || 'zh-CN';
      console.log('[ChatRoutes] 🤖 Searching robot knowledge for:', content.substring(0, 50),
        'lang:', visitorLang, 'businessId:', session.businessId);

      // 先用精确语言匹配，失败则用基础语言降级（en-US → en）
      let knowledge = await searchKnowledge(content, visitorLang);
      if (!knowledge) {
        const baseLang = (visitorLang || '').split('-')[0];
        if (baseLang && baseLang !== visitorLang) {
          console.log('[ChatRoutes] 🤖 Fallback search with base lang:', baseLang);
          knowledge = await searchKnowledge(content, baseLang);
        }
      }
      if (knowledge) {
        console.log('[ChatRoutes] ✅ Robot matched! keyword:', knowledge.keyword,
          '| answer:', knowledge.answer.substring(0, 60));

        // 翻译自动回复：智能选择目标语言
        // - 如果答案语言 = 访客语言：翻译到客服默认语言（客服需要看翻译版本）
        // - 如果答案语言 ≠ 访客语言：翻译到访客语言（访客需要理解回复内容）
        let staffTranslated: string | undefined;
        const robotTxBusinessId = session.businessId || 1;
        const txSettings = await getTranslationSettings(robotTxBusinessId, session.businessSlug);
        if (txSettings?.enabled) {
          // 规范化语言比较：提取基础语言码（en-US → en）
          const baseLang = (lang: string) => (lang || 'en').split('-')[0].toLowerCase();
          const knowledgeBaseLang = baseLang(knowledge.lang);
          const visitorBaseLang = baseLang(visitorLang);
          
          const targetLang = knowledgeBaseLang === visitorBaseLang
            ? txSettings.defaultLang    // 答案已是访客语言 → 翻译到客服默认语言
            : visitorLang;              // 答案不是访客语言 → 翻译到访客语言
          
          // 只有当目标基础语言和答案基础语言不同时才翻译
          if (targetLang && baseLang(targetLang) !== knowledgeBaseLang) {
            console.log('[ChatRoutes] 🤖 Translating robot reply:', knowledge.answer.substring(0, 40),
              'from', knowledgeBaseLang, '→', baseLang(targetLang), '(target:', targetLang, ')');
            const robotTranslateResult = await translateText({
              text: knowledge.answer,
              to: targetLang,
              businessId: robotTxBusinessId,
              _settings: txSettings as any,
            } as any);
            if (robotTranslateResult.engine === 'same_language') {
              staffTranslated = undefined;
              console.log('[ChatRoutes] ⏭️ Robot reply translation skipped: already in target language');
            } else if (!robotTranslateResult.success || !isTranslationUseful(knowledge.answer, robotTranslateResult.text)) {
              staffTranslated = undefined;
              console.log('[ChatRoutes] Robot reply translation not useful (same as original), engine:', robotTranslateResult.engine || 'none');
            } else {
              staffTranslated = robotTranslateResult.text;
              console.log(`[ChatRoutes] ✅ Robot reply translated via ${robotTranslateResult.engine}:`, staffTranslated?.substring(0, 40));
            }
          } else {
            console.log('[ChatRoutes] 🤖 Skipping translation: already in target language (base:', knowledgeBaseLang, ')');
          }
        }

        autoReplyMessage = await chatService.sendMessage({
          sessionId,
          senderType: 'staff',
          contentType: 'text',
          content: knowledge.answer,
          translatedContent: staffTranslated,
        }, session.businessId);

        // Broadcast robot reply
        await sseService.broadcastMessage(autoReplyMessage);
        await sseService.broadcastSessionUpdate(session);
      } else {
        console.log('[ChatRoutes] 🤖 No robot knowledge match for:', content.substring(0, 30));
      }
    }

    // 发送 Bark 通知（获取会话信息用于显示访客名）
    if (session) {
      console.log('[ChatRoutes] Calling barkService.notifyVisitorMessage for session:', sessionId)
      await barkService.notifyVisitorMessage(sessionId, session.visitorName, content, contentType)
    }

    return c.json({
      success: true,
      data: { message, autoReply: autoReplyMessage }
    })
  } catch (error) {
    console.error('Send message error:', error)
    return c.json({ success: false, error: 'Failed to send message' }, 500)
  }
})

// ==========================================
// File Upload Route
// ==========================================

chatRoutes.post('/upload', async c => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const sessionId = formData.get('sessionId') as string

    console.log('[Upload] Received request:', {
      file: file?.name,
      type: file?.type,
      size: file?.size,
      sessionId,
    })

    if (!file || !sessionId) {
      return c.json({ success: false, error: 'File and sessionId are required' }, 400)
    }

    // Validate file and auto-detect content type
    const validation = uploadService.validateFile({
      type: file.type,
      size: file.size,
      name: file.name,
    })

    console.log('[Upload] Validation result:', JSON.stringify(validation))

    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400)
    }

    const contentType = validation.detectedType!

    // Save file - use Uint8Array instead of Buffer for Workers compatibility
    console.log('[Upload] Creating array buffer...')
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    console.log('[Upload] Buffer created, size:', uint8Array.byteLength)

    console.log('[Upload] Calling saveFileBuffer...')
    const uploadResult = await uploadService.saveFileBuffer(uint8Array, file.name, file.type)
    console.log('[Upload] Upload result:', JSON.stringify(uploadResult))

    // Create message
    const message = await chatService.sendMessage({
      sessionId,
      senderType: 'visitor',
      contentType,
      content: uploadResult.url,
      thumbnailUrl: uploadResult.thumbnailUrl,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
    })

    // Broadcast to SSE clients
    await sseService.broadcastMessage(message)

    // 发送 Bark 通知
    const session = await chatService.getSession(sessionId)
    if (session) {
      barkService.notifyVisitorMessage(
        sessionId,
        session.visitorName,
        uploadResult.url,
        contentType
      )
    }

    return c.json({ success: true, data: message })
  } catch (error) {
    console.error('Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file'
    return c.json({ success: false, error: errorMessage }, 500)
  }
})

// ==========================================
// SSE Route
// ==========================================

chatRoutes.get('/sse/:sessionId', async c => {
  const sessionId = c.req.param('sessionId')

  return streamSSE(c, async stream => {
    // Add client to connection pool
    sseService.addSessionClient(sessionId, stream)

    // Send connected event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ type: 'connected', sessionId }),
    })

    // Keep connection alive with periodic heartbeats
    let isConnected = true

    // Setup cleanup on abort
    const cleanup = () => {
      isConnected = false
      sseService.removeSessionClient(sessionId, stream)
    }

    // Note: stream.onAbort might not be available in all Hono versions
    // So we rely on the connection closing naturally

    // Send periodic heartbeats to keep connection alive
    while (isConnected) {
      await new Promise(resolve => setTimeout(resolve, 30000))
      try {
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

chatRoutes.put('/read/:sessionId', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    await chatService.markAsRead(sessionId, 'visitor')
    return c.json({ success: true })
  } catch (error) {
    console.error('Mark as read error:', error)
    return c.json({ success: false, error: 'Failed to mark as read' }, 500)
  }
})

// ==========================================
// Queue Route (User queries their position)
// ==========================================

chatRoutes.get('/queue/:sessionId', async c => {
  try {
    const sessionId = c.req.param('sessionId')
    const queueInfo = await queueService.getQueueInfo(sessionId)
    return c.json({ success: true, data: queueInfo })
  } catch (error) {
    console.error('Get queue info error:', error)
    return c.json({ success: false, error: 'Failed to get queue info' }, 500)
  }
})

// ==========================================
// Accept Session Route (客服接收会话)
// 多租户隔离：必须验证 session 的 business_id 归属
// ==========================================

chatRoutes.post('/sessions/:id/accept', requireAuth, async c => {
  try {
    const sessionId = c.req.param('id')
    const businessId = getCtxNumber(c, 'businessId')
    const staffId = getCtxNumber(c, 'userId')

    if (!staffId) {
      return c.json({ success: false, error: '未授权' }, 401)
    }

    const db = getDb()

    // 多租户隔离：只允许操作本商家的会话（businessId=0 为超管，可操作所有）
    let session
    if (businessId === 0) {
      session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId])
    } else {
      session = await db.get('SELECT * FROM sessions WHERE id = ? AND business_id = ?', [
        sessionId,
        businessId,
      ])
    }
    if (!session) {
      return c.json({ success: false, error: '会话不存在' }, 404)
    }

    if (session.assigned_staff_id !== null && session.assigned_staff_id !== staffId) {
      return c.json({ success: false, error: '会话已被其他客服接收' }, 400)
    }

    // 多租户隔离：UPDATE 带 business_id 条件防御
    // 同时更新 assigned_staff_id 和 service_id，确保转接等操作能正确识别当前客服
    if (businessId === 0) {
      await db.run('UPDATE sessions SET assigned_staff_id = ?, service_id = ?, updated_at = ? WHERE id = ?', [
        staffId,
        staffId,
        Date.now(),
        sessionId,
      ])
    } else {
      await db.run(
        'UPDATE sessions SET assigned_staff_id = ?, service_id = ?, updated_at = ? WHERE id = ? AND business_id = ?',
        [staffId, staffId, Date.now(), sessionId, businessId]
      )
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Accept session error:', error)
    return c.json({ success: false, error: 'Failed to accept session' }, 500)
  }
})

// ==========================================
// Transfer Session Route
// ==========================================

chatRoutes.post('/sessions/:id/transfer', requireAuth, async c => {
  try {
    const sessionId = c.req.param('id')
    const body = await c.req.json()
    const { targetStaffId, reason } = body
    const businessId = getCtxNumber(c, 'businessId')

    const db = getDb()

    // 多租户隔离：只允许操作本商家的会话
    let session
    if (businessId === 0) {
      session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId])
    } else {
      session = await db.get('SELECT * FROM sessions WHERE id = ? AND business_id = ?', [
        sessionId,
        businessId,
      ])
    }
    if (!session) {
      return c.json({ success: false, error: '会话不存在' }, 404)
    }

    // 多租户隔离：目标客服必须属于同一商家（或为超管）
    let targetStaff
    if (businessId === 0) {
      targetStaff = await db.get(
        'SELECT id, username, name FROM staff_users WHERE id = ? AND status = "active"',
        [targetStaffId]
      )
    } else {
      targetStaff = await db.get(
        'SELECT id, username, name FROM staff_users WHERE id = ? AND status = "active" AND (business_id = ? OR id = ?)',
        [targetStaffId, businessId, businessId]
      )
    }
    if (!targetStaff) {
      return c.json({ success: false, error: '目标客服不存在、未激活或不属于同一商家' }, 400)
    }

    // 多租户隔离：UPDATE 带 business_id 条件防御
    // 同时更新 assigned_staff_id 和 service_id
    if (businessId === 0) {
      await db.run('UPDATE sessions SET assigned_staff_id = ?, service_id = ?, updated_at = ? WHERE id = ?', [
        targetStaffId,
        targetStaffId,
        Date.now(),
        sessionId,
      ])
    } else {
      await db.run(
        'UPDATE sessions SET assigned_staff_id = ?, service_id = ?, updated_at = ? WHERE id = ? AND business_id = ?',
        [targetStaffId, targetStaffId, Date.now(), sessionId, businessId]
      )
    }

    const transferRecord = {
      timestamp: Date.now(),
      fromStaffId: session.assigned_staff_id,
      toStaffId: targetStaffId,
      reason: reason || '主动转接',
    }

    // 多租户隔离：transfer_history 更新也带 business_id 条件
    if (businessId === 0) {
      await db.run('UPDATE sessions SET transfer_history = ? WHERE id = ?', [
        JSON.stringify(transferRecord),
        sessionId,
      ])
    } else {
      await db.run(
        'UPDATE sessions SET transfer_history = ? WHERE id = ? AND business_id = ?',
        [JSON.stringify(transferRecord), sessionId, businessId]
      )
    }

    return c.json({
      success: true,
      data: {
        staff: { id: targetStaff.id, username: targetStaff.username, name: targetStaff.name },
      },
    })
  } catch (error) {
    console.error('Transfer session error:', error)
    return c.json({ success: false, error: '转接失败' }, 500)
  }
})

// ==========================================
// Delete Message Route
// ==========================================

chatRoutes.post('/messages/:id/delete', requireAuth, async c => {
  try {
    const messageId = parseInt(c.req.param('id'), 10)
    const body = await c.req.json()
    const { sessionId } = body
    const businessId = getCtxNumber(c, 'businessId')

    const db = getDb()

    const message = await db.get('SELECT * FROM messages WHERE id = ?', [messageId])
    if (!message) {
      return c.json({ success: false, error: '消息不存在' }, 404)
    }

    // 多租户隔离：非超管只能操作自己商家的消息
    if (businessId !== 0) {
      const session = await db.get('SELECT business_id FROM sessions WHERE id = ?', [sessionId])
      if (!session || session.business_id !== businessId) {
        return c.json({ success: false, error: '无权操作此消息' }, 403)
      }
    }

    const now = Date.now()
    const timeLimit = 5 * 60 * 1000
    if (now - message.created_at > timeLimit) {
      return c.json({ success: false, error: '超过撤回时间限制（5分钟）' }, 400)
    }

    await db.run('UPDATE messages SET is_deleted = 1, deleted_at = ? WHERE id = ?', [
      now,
      messageId,
    ])

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete message error:', error)
    return c.json({ success: false, error: '撤回失败' }, 500)
  }
})

// ==========================================
// Manual Translate Message Route (手动翻译单条消息)
// 用法: POST /api/chat/messages/:id/translate  body: { to: 'en-US', engine?: 'google'|'pearapi'|... }
// engine 可选，指定后仅使用该引擎翻译（用于客服手动切换翻译渠道）
// ==========================================

chatRoutes.post('/messages/:id/translate', async c => {
  try {
    const messageId = parseInt(c.req.param('id'), 10)
    const body = await c.req.json()
    const { to, engine } = body as { to?: string; engine?: string }

    if (!to) {
      return c.json({ success: false, error: 'Target language (to) is required' }, 400)
    }

    // 1. 从 DB 获取消息
    const db = getDb()
    const row = await db.get(
      'SELECT m.*, s.business_id FROM messages m JOIN sessions s ON m.session_id = s.id WHERE m.id = ?',
      [messageId]
    ) as any

    if (!row) {
      return c.json({ success: false, error: '消息不存在' }, 404)
    }

    // 2. 只翻译文本消息
    if (row.content_type !== 'text') {
      return c.json({ success: false, error: '仅文本消息支持翻译' }, 400)
    }

    // 3. 获取翻译设置
    const txSettings = await getTranslationSettings(row.business_id)

    if (!txSettings?.enabled) {
      return c.json({
        success: false,
        error: '翻译功能未启用，请在客服设置中开启自动翻译开关',
      }, 400)
    }

    // 4. 检测源语言（仅用于日志）
    const detectedSource = detectSourceLanguage(row.content)

    // 5. 执行翻译 - 如果指定了 engine，则仅使用该引擎；否则走默认优先级链
    const engineKey = engine?.toLowerCase() || '';
    const validEngines = ['cloudflare', 'pearapi', 'simplytranslate', 'google', 'mymemory'];
    
    let translateResult: any;
    
    if (engineKey && validEngines.includes(engineKey)) {
      console.log('[ChatRoutes] 🈂️ Manual translate (specific engine) | messageId:', messageId,
        '| engine:', engineKey,
        '| content:', (row.content as string).substring(0, 40),
        '| to:', to);
      
      translateResult = await translateWithEngine(row.content, to, engineKey as any);
    } else {
      console.log('[ChatRoutes] 🈂️ Manual translate | messageId:', messageId,
        '| content:', (row.content as string).substring(0, 40),
        '| detected:', detectedSource,
        '| to:', to,
        '| businessId:', row.business_id);
      
      translateResult = await translateText({
        text: row.content,
        to,
        businessId: row.business_id,
        _settings: txSettings as any,
      } as any);
    }

    // 6. 检查翻译是否有意义（翻译结果与原文不同才算成功）
    if (!translateResult.success || !isTranslationUseful(row.content, translateResult.text)) {
      console.log('[ChatRoutes] Manual translation not useful',
        '| targetLang:', to,
        '| detected:', detectedSource,
        '| engine:', translateResult.engine || 'none',
        '| businessId:', row.business_id);
      
      // 如果是因为文本已经是目标语言（same_language），给友好提示
      if (translateResult.engine === 'same_language') {
        return c.json({
          success: true,
          data: {
            id: messageId,
            translatedContent: row.content,
            translateEngine: 'same_language',
          },
          info: '文本已经是目标语言，无需翻译',
        }, 200)
      }
      
      return c.json({
        success: false,
        error: `翻译引擎 ${translateResult.engine || '无'} 未能转换，可能文本已是目标语言，或免费接口暂时无法访问`,
      }, 200)
    }

    // 7. 更新 DB 中的 translated_content + translate_engine
    const now = Date.now()
    await db.run(
      'UPDATE messages SET translated_content = ?, translate_engine = ?, translated_at = ? WHERE id = ?',
      [translateResult.text, translateResult.engine, now, messageId]
    )

    console.log(`[ChatRoutes] ✅ Manual translate stored via ${translateResult.engine}:`, translateResult.text.substring(0, 60))

    return c.json({
      success: true,
      data: {
        id: messageId,
        translatedContent: translateResult.text,
        translateEngine: translateResult.engine,
      },
    })
  } catch (error) {
    console.error('[ChatRoutes] Manual translate error:', error)
    const errorMessage = error instanceof Error ? error.message : '翻译失败'
    return c.json({ success: false, error: errorMessage }, 500)
  }
})

// ==========================================
// Statistics Route
// ==========================================

chatRoutes.get('/stats', requireAuth, async c => {
  try {
    const businessId = getCtxNumber(c, 'businessId')
    const db = getDb()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayTimestamp = todayStart.getTime()

    const todaySessions = await db.get(
      'SELECT COUNT(*) as count FROM sessions WHERE business_id = ? AND created_at >= ?',
      [businessId, todayTimestamp]
    )

    const activeSessions = await db.get(
      'SELECT COUNT(*) as count FROM sessions WHERE business_id = ? AND status = "active"',
      [businessId]
    )

    const queueCount = await db.get('SELECT COUNT(*) as count FROM queue WHERE business_id = ?', [
      businessId,
    ])

    const avgResponse = await db.get(
      'SELECT AVG(response_time) as avg FROM sessions WHERE business_id = ? AND response_time IS NOT NULL',
      [businessId]
    )

    const satisfaction = await db.get(
      'SELECT AVG(score) as avg, COUNT(*) as total FROM evaluations WHERE session_id IN (SELECT id FROM sessions WHERE business_id = ?)',
      [businessId]
    )

    const todayMessages = await db.get(
      'SELECT COUNT(*) as count FROM messages m JOIN sessions s ON m.session_id = s.id WHERE m.created_at >= ? AND s.business_id = ?',
      [todayTimestamp, businessId]
    )

    return c.json({
      success: true,
      data: {
        todaySessions: Number(todaySessions.count) || 0,
        activeSessions: Number(activeSessions.count) || 0,
        queueCount: Number(queueCount.count) || 0,
        avgResponseTime: avgResponse.avg ? Math.round(Number(avgResponse.avg)) : 0,
        satisfactionRate: satisfaction.avg ? Math.round(Number(satisfaction.avg) * 20) : 0,
        evaluationCount: Number(satisfaction.total) || 0,
        todayMessages: Number(todayMessages.count) || 0,
      },
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return c.json({ success: false, error: '获取统计数据失败' }, 500)
  }
})

// ==========================================
// Blacklist Routes
// ==========================================

chatRoutes.post('/blacklist/add', requireAuth, async c => {
  try {
    const body = await c.req.json()
    const { visitorId, ip, reason, days } = body
    const businessId = getCtxNumber(c, 'businessId')

    const db = getDb()

    const existing = await db.get(
      'SELECT id FROM visitor_blacklist WHERE business_id = ? AND visitor_id = ?',
      [businessId, visitorId]
    )

    if (existing) {
      return c.json({ success: false, error: '该访客已在黑名单中' }, 400)
    }

    const expiresAt = days ? Date.now() + days * 24 * 60 * 60 * 1000 : null

    await db.run(
      'INSERT INTO visitor_blacklist (business_id, visitor_id, ip, reason, expires_at) VALUES (?, ?, ?, ?, ?)',
      [businessId, visitorId, ip, reason, expiresAt]
    )

    return c.json({ success: true })
  } catch (error) {
    console.error('Add blacklist error:', error)
    return c.json({ success: false, error: '添加黑名单失败' }, 500)
  }
})

chatRoutes.post('/blacklist/remove', requireAuth, async c => {
  try {
    const body = await c.req.json()
    const { visitorId } = body
    const businessId = getCtxNumber(c, 'businessId')

    const db = getDb()

    await db.run('DELETE FROM visitor_blacklist WHERE business_id = ? AND visitor_id = ?', [
      businessId,
      visitorId,
    ])

    return c.json({ success: true })
  } catch (error) {
    console.error('Remove blacklist error:', error)
    return c.json({ success: false, error: '移除黑名单失败' }, 500)
  }
})

chatRoutes.get('/blacklist', requireAuth, async c => {
  try {
    const businessId = getCtxNumber(c, 'businessId')
    const db = getDb()

    const blacklist = await db.all(
      'SELECT * FROM visitor_blacklist WHERE business_id = ? ORDER BY created_at DESC',
      [businessId]
    )

    return c.json({ success: true, data: blacklist })
  } catch (error) {
    console.error('Get blacklist error:', error)
    return c.json({ success: false, error: '获取黑名单失败' }, 500)
  }
})

// ==========================================
// Banword Check Route
// ==========================================

chatRoutes.post('/banword/check', async c => {
  try {
    const body = await c.req.json()
    const { content } = body

    const db = getDb()
    const banwords = await db.all('SELECT keyword, level FROM banwords WHERE status = 1')

    for (const banword of banwords) {
      if (content.includes(banword.keyword)) {
        if (banword.level >= 2) {
          return c.json({ blocked: true, message: '内容包含违禁词' })
        }
      }
    }

    return c.json({ blocked: false })
  } catch (error) {
    console.error('Check banword error:', error)
    return c.json({ blocked: false })
  }
})

// ==========================================
// Staff Online Status Route
// ==========================================

chatRoutes.get('/staff/online', async c => {
  try {
    const businessSlug = c.req.query('business')
    const staffIdParam = c.req.query('staffId')
    const db = getDb()
    const now = Date.now()
    const onlineThreshold = 5 * 60 * 1000

    // 如果传入了 staffId，检查特定客服是否在线
    if (staffIdParam) {
      const staffId = parseInt(staffIdParam, 10)
      if (isNaN(staffId) || staffId <= 0) {
        return c.json({ success: false, error: '无效的客服ID' }, 400)
      }

      const staff = await db.get<{ id: number; name: string; last_active: number | null; status: string }>(
        `SELECT id, name, last_active, status
         FROM staff_users
         WHERE id = ?`,
        [staffId]
      )

      if (!staff) {
        return c.json({
          success: true,
          data: { onlineCount: 0, isOnline: false, staffId, staffName: null, isAssignedStaffOnline: false },
        })
      }

      const isOnline = staff.status === 'active'
        && staff.last_active !== null
        && staff.last_active > (now - onlineThreshold)

      return c.json({
        success: true,
        data: {
          onlineCount: isOnline ? 1 : 0,
          isOnline: isOnline,
          staffId: staff.id,
          staffName: staff.name,
          isAssignedStaffOnline: isOnline,
        },
      })
    }

    // 原有逻辑：检查商家下是否有任意在线客服
    let query = `
      SELECT COUNT(*) as count 
      FROM staff_users 
      WHERE (role = 'staff' OR role = 'admin') AND status = 'active' 
      AND last_active IS NOT NULL AND last_active > ?
    `

    const params: unknown[] = [now - onlineThreshold]

    if (businessSlug) {
      query += ' AND business_slug = ?'
      params.push(businessSlug)
    }

    const result = await db.get<{ count: number }>(query, params)

    return c.json({
      success: true,
      data: {
        onlineCount: result?.count || 0,
        isOnline: (result?.count || 0) > 0,
      },
    })
  } catch (error) {
    console.error('Get staff online status error:', error)
    return c.json({ success: false, error: '获取客服在线状态失败' }, 500)
  }
})

chatRoutes.post('/transfer/request', requireAuth, async c => {
  try {
    const body = await c.req.json()
    const { sessionId, toStaffId, reason } = body

    if (!sessionId || !toStaffId) {
      return c.json({ success: false, error: '会话ID和目标客服ID不能为空' }, 400)
    }

    const staffIdVal = getCtxNumber(c, 'userId')
    const staffId = staffIdVal ?? 0
    const businessId = getCtxNumber(c, 'businessId')

    const result = await transferService.createTransferRequest({
      sessionId,
      fromStaffId: staffId,
      toStaffId: parseInt(toStaffId, 10),
      reason: reason || '',
      businessId,
    })

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400)
    }

    // Broadcast the transfer request via SSE to notify target staff
    await sseService.broadcastTransferRequest(result.data)

    return c.json({ success: true, data: result.data })
  } catch (error) {
    console.error('Create transfer request error:', error)
    return c.json({ success: false, error: '创建转接请求失败' }, 500)
  }
})

chatRoutes.post('/transfer/:requestId/respond', requireAuth, async c => {
  try {
    const { requestId } = c.req.param()
    const body = await c.req.json()
    const { action, reason } = body

    if (!action || (action !== 'accept' && action !== 'reject')) {
      return c.json({ success: false, error: '无效的操作类型' }, 400)
    }

    // Validate reject reason
    if (action === 'reject' && !reason?.trim()) {
      return c.json({ success: false, error: '拒绝时必须填写原因' }, 400)
    }

    const staffId = getCtxNumber(c, 'userId')
    const businessId = getCtxNumber(c, 'businessId')

    const result = await transferService.respondToTransferRequest(
      parseInt(requestId, 10),
      staffId,
      action as 'accept' | 'reject',
      reason,
      businessId
    )

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Respond to transfer request error:', error)
    return c.json({ success: false, error: '处理转接请求失败' }, 500)
  }
})

chatRoutes.get('/transfer/pending', requireAuth, async c => {
  try {
    const staffId = getCtxNumber(c, 'userId')
    const requests = await transferService.getPendingTransferRequests(staffId)
    return c.json({ success: true, data: requests })
  } catch (error) {
    console.error('Get pending transfer requests error:', error)
    return c.json({ success: false, error: '获取待处理转接请求失败' }, 500)
  }
})

// Get my transfer requests history (for the requester to view rejected requests)
chatRoutes.get('/transfer/my', requireAuth, async c => {
  try {
    const staffId = getCtxNumber(c, 'userId')
    const sessionId = c.req.query('sessionId')
    const requests = await transferService.getMyTransferRequests(staffId, sessionId)
    return c.json({ success: true, data: requests })
  } catch (error) {
    console.error('Get my transfer requests error:', error)
    return c.json({ success: false, error: '获取我的转接请求历史失败' }, 500)
  }
})

chatRoutes.delete('/transfer/:requestId', requireAuth, async c => {
  try {
    const { requestId } = c.req.param()
    const staffId = getCtxNumber(c, 'userId')

    const result = await transferService.deleteTransferRequest(parseInt(requestId, 10), staffId)

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete transfer request error:', error)
    return c.json({ success: false, error: '删除转接请求失败' }, 500)
  }
})
