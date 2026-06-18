/**
 * Chat API routes - User/Visitor endpoints
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import * as chatService from '../services/chat-service';
import * as uploadService from '../services/upload-service';
import * as sseService from '../services/sse-service';
import * as queueService from '../services/queue-service';
import * as transferService from '../services/transfer-service';
import * as barkService from '@server/services/bark-service';
import { verifyToken } from '@server/module-auth/services/auth-service';
import { getDb } from '@server/shared/db';

export const chatRoutes = new Hono();

async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未提供认证令牌' }, 401);
  }

  const token = authHeader.substring(7);
  const result = await verifyToken(token);

  if (!result.valid) {
    return c.json({ success: false, error: result.error || 'Token 无效' }, 401);
  }

  if (result.businessId) {
    c.set('businessId', result.businessId);
  }
  if (result.businessSlug) {
    c.set('businessSlug', result.businessSlug);
  }

  await next();
}

// ==========================================
// Session Routes
// ==========================================

// Create or get session
chatRoutes.post('/session', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const input = {
      visitorName: body.visitorName,
      sessionId: body.sessionId,
      business: body.business, // 商家标识(slug)
    };

    const session = await chatService.createOrGetSession(input);
    return c.json({ success: true, data: session });
  } catch (error) {
    console.error('Create session error:', error);
    return c.json({ success: false, error: 'Failed to create session' }, 500);
  }
});

// ==========================================
// Message Routes
// ==========================================

// Get messages (paginated)
chatRoutes.get('/messages', async (c) => {
  try {
    const sessionId = c.req.query('sessionId');
    if (!sessionId) {
      return c.json({ success: false, error: 'Session ID is required' }, 400);
    }

    const before = c.req.query('before') ? parseInt(c.req.query('before')!) : undefined;
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;

    const result = await chatService.getMessages(sessionId, before, limit);
    return c.json({ success: true, data: result.messages, hasMore: result.hasMore });
  } catch (error) {
    console.error('Get messages error:', error);
    return c.json({ success: false, error: 'Failed to get messages' }, 500);
  }
});

// Send message
chatRoutes.post('/messages', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, contentType, content, thumbnailUrl, fileName, fileSize } = body;

    if (!sessionId || !contentType || !content) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    const message = await chatService.sendMessage({
      sessionId,
      senderType: 'visitor',
      contentType,
      content,
      thumbnailUrl,
      fileName,
      fileSize,
    });

    // Broadcast to SSE clients
    await sseService.broadcastMessage(message);

    // 发送 Bark 通知（获取会话信息用于显示访客名）
    const session = await chatService.getSession(sessionId);
    if (session) {
      console.log('[ChatRoutes] Calling barkService.notifyVisitorMessage for session:', sessionId);
      await barkService.notifyVisitorMessage(
        sessionId,
        session.visitorName,
        content,
        contentType
      );
    }

    return c.json({ success: true, data: message });
  } catch (error) {
    console.error('Send message error:', error);
    return c.json({ success: false, error: 'Failed to send message' }, 500);
  }
});

// ==========================================
// File Upload Route
// ==========================================

chatRoutes.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;

    console.log('[Upload] Received request:', { file: file?.name, type: file?.type, size: file?.size, sessionId });

    if (!file || !sessionId) {
      return c.json({ success: false, error: 'File and sessionId are required' }, 400);
    }

    // Validate file and auto-detect content type
    const validation = uploadService.validateFile({
      type: file.type,
      size: file.size,
      name: file.name,
    });

    console.log('[Upload] Validation result:', JSON.stringify(validation));

    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    const contentType = validation.detectedType!;

    // Save file - use Uint8Array instead of Buffer for Workers compatibility
    console.log('[Upload] Creating array buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    console.log('[Upload] Buffer created, size:', uint8Array.byteLength);

    console.log('[Upload] Calling saveFileBuffer...');
    const uploadResult = await uploadService.saveFileBuffer(uint8Array, file.name, file.type);
    console.log('[Upload] Upload result:', JSON.stringify(uploadResult));

    // Create message
    const message = await chatService.sendMessage({
      sessionId,
      senderType: 'visitor',
      contentType,
      content: uploadResult.url,
      thumbnailUrl: uploadResult.thumbnailUrl,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
    });

    // Broadcast to SSE clients
    await sseService.broadcastMessage(message);

    // 发送 Bark 通知
    const session = await chatService.getSession(sessionId);
    if (session) {
      barkService.notifyVisitorMessage(
        sessionId,
        session.visitorName,
        uploadResult.url,
        contentType
      );
    }

    return c.json({ success: true, data: message });
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
    return c.json({ success: false, error: errorMessage }, 500);
  }
});

// ==========================================
// SSE Route
// ==========================================

chatRoutes.get('/sse/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  return streamSSE(c, async (stream) => {
    // Add client to connection pool
    sseService.addSessionClient(sessionId, stream);

    // Send connected event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ type: 'connected', sessionId }),
    });

    // Keep connection alive with periodic heartbeats
    let isConnected = true;

    // Setup cleanup on abort
    const cleanup = () => {
      isConnected = false;
      sseService.removeSessionClient(sessionId, stream);
    };

    // Note: stream.onAbort might not be available in all Hono versions
    // So we rely on the connection closing naturally

    // Send periodic heartbeats to keep connection alive
    while (isConnected) {
      await new Promise((resolve) => setTimeout(resolve, 30000));
      try {
        await stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }),
        });
      } catch {
        isConnected = false;
        cleanup();
      }
    }
  });
});

// ==========================================
// Mark as Read Route
// ==========================================

chatRoutes.put('/read/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    await chatService.markAsRead(sessionId, 'visitor');
    return c.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    return c.json({ success: false, error: 'Failed to mark as read' }, 500);
  }
});

// ==========================================
// Queue Route (User queries their position)
// ==========================================

chatRoutes.get('/queue/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const queueInfo = await queueService.getQueueInfo(sessionId);
    return c.json({ success: true, data: queueInfo });
  } catch (error) {
    console.error('Get queue info error:', error);
    return c.json({ success: false, error: 'Failed to get queue info' }, 500);
  }
});

// ==========================================
// Accept Session Route (客服接收会话)
// ==========================================

chatRoutes.post('/sessions/:id/accept', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const businessId = c.get('businessId');
    const staffId = c.get('userId');

    const db = getDb();

    const session = await db.get('SELECT * FROM sessions WHERE id = ? AND business_id = ?', [sessionId, businessId]);
    if (!session) {
      return c.json({ success: false, error: '会话不存在' }, 404);
    }

    if (session.assigned_staff_id !== null && session.assigned_staff_id !== staffId) {
      return c.json({ success: false, error: '会话已被其他客服接收' }, 400);
    }

    await db.run(
      'UPDATE sessions SET assigned_staff_id = ?, updated_at = ? WHERE id = ?',
      [staffId, Date.now(), sessionId]
    );

    return c.json({ success: true });
  } catch (error) {
    console.error('Accept session error:', error);
    return c.json({ success: false, error: 'Failed to accept session' }, 500);
  }
});

// ==========================================
// Transfer Session Route
// ==========================================

chatRoutes.post('/sessions/:id/transfer', requireAuth, async (c) => {
  try {
    const sessionId = c.req.param('id');
    const body = await c.req.json();
    const { targetStaffId, reason } = body;
    const businessId = c.get('businessId');

    const db = getDb();

    const session = await db.get('SELECT * FROM sessions WHERE id = ? AND business_id = ?', [sessionId, businessId]);
    if (!session) {
      return c.json({ success: false, error: '会话不存在' }, 404);
    }

    const targetStaff = await db.get(
      'SELECT id, username, name FROM staff_users WHERE id = ? AND status = "active"',
      [targetStaffId]
    );
    if (!targetStaff) {
      return c.json({ success: false, error: '目标客服不存在或未激活' }, 400);
    }

    await db.run(
      'UPDATE sessions SET assigned_staff_id = ?, updated_at = ? WHERE id = ?',
      [targetStaffId, Date.now(), sessionId]
    );

    const transferRecord = {
      timestamp: Date.now(),
      fromStaffId: session.assigned_staff_id,
      toStaffId: targetStaffId,
      reason: reason || '主动转接'
    };

    await db.run(
      'UPDATE sessions SET transfer_history = ? WHERE id = ?',
      [JSON.stringify(transferRecord), sessionId]
    );

    return c.json({ 
      success: true, 
      data: { 
        staff: { id: targetStaff.id, username: targetStaff.username, name: targetStaff.name } 
      } 
    });
  } catch (error) {
    console.error('Transfer session error:', error);
    return c.json({ success: false, error: '转接失败' }, 500);
  }
});

// ==========================================
// Delete Message Route
// ==========================================

chatRoutes.post('/messages/:id/delete', requireAuth, async (c) => {
  try {
    const messageId = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const { sessionId } = body;
    const businessId = c.get('businessId');

    const db = getDb();

    const message = await db.get('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!message) {
      return c.json({ success: false, error: '消息不存在' }, 404);
    }

    const session = await db.get('SELECT business_id FROM sessions WHERE id = ?', [sessionId]);
    if (!session || session.business_id !== businessId) {
      return c.json({ success: false, error: '无权操作此消息' }, 403);
    }

    const now = Date.now();
    const timeLimit = 5 * 60 * 1000;
    if (now - message.created_at > timeLimit) {
      return c.json({ success: false, error: '超过撤回时间限制（5分钟）' }, 400);
    }

    await db.run(
      'UPDATE messages SET is_deleted = 1, deleted_at = ? WHERE id = ?',
      [now, messageId]
    );

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    return c.json({ success: false, error: '撤回失败' }, 500);
  }
});

// ==========================================
// Statistics Route
// ==========================================

chatRoutes.get('/stats', requireAuth, async (c) => {
  try {
    const businessId = c.get('businessId');
    const db = getDb();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = todayStart.getTime();

    const todaySessions = await db.get(
      'SELECT COUNT(*) as count FROM sessions WHERE business_id = ? AND created_at >= ?',
      [businessId, todayTimestamp]
    );

    const activeSessions = await db.get(
      'SELECT COUNT(*) as count FROM sessions WHERE business_id = ? AND status = "active"',
      [businessId]
    );

    const queueCount = await db.get(
      'SELECT COUNT(*) as count FROM queue WHERE business_id = ?',
      [businessId]
    );

    const avgResponse = await db.get(
      'SELECT AVG(response_time) as avg FROM sessions WHERE business_id = ? AND response_time IS NOT NULL',
      [businessId]
    );

    const satisfaction = await db.get(
      'SELECT AVG(score) as avg, COUNT(*) as total FROM evaluations WHERE session_id IN (SELECT id FROM sessions WHERE business_id = ?)',
      [businessId]
    );

    const todayMessages = await db.get(
      'SELECT COUNT(*) as count FROM messages WHERE created_at >= ?',
      [todayTimestamp]
    );

    return c.json({
      success: true,
      data: {
        todaySessions: Number(todaySessions.count) || 0,
        activeSessions: Number(activeSessions.count) || 0,
        queueCount: Number(queueCount.count) || 0,
        avgResponseTime: avgResponse.avg ? Math.round(Number(avgResponse.avg)) : 0,
        satisfactionRate: satisfaction.avg ? Math.round(Number(satisfaction.avg) * 20) : 0,
        evaluationCount: Number(satisfaction.total) || 0,
        todayMessages: Number(todayMessages.count) || 0
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ success: false, error: '获取统计数据失败' }, 500);
  }
});

// ==========================================
// Blacklist Routes
// ==========================================

chatRoutes.post('/blacklist/add', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { visitorId, ip, reason, days } = body;
    const businessId = c.get('businessId');

    const db = getDb();

    const existing = await db.get(
      'SELECT id FROM visitor_blacklist WHERE business_id = ? AND visitor_id = ?',
      [businessId, visitorId]
    );

    if (existing) {
      return c.json({ success: false, error: '该访客已在黑名单中' }, 400);
    }

    const expiresAt = days ? Date.now() + days * 24 * 60 * 60 * 1000 : null;

    await db.run(
      'INSERT INTO visitor_blacklist (business_id, visitor_id, ip, reason, expires_at) VALUES (?, ?, ?, ?, ?)',
      [businessId, visitorId, ip, reason, expiresAt]
    );

    return c.json({ success: true });
  } catch (error) {
    console.error('Add blacklist error:', error);
    return c.json({ success: false, error: '添加黑名单失败' }, 500);
  }
});

chatRoutes.post('/blacklist/remove', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { visitorId } = body;
    const businessId = c.get('businessId');

    const db = getDb();

    await db.run(
      'DELETE FROM visitor_blacklist WHERE business_id = ? AND visitor_id = ?',
      [businessId, visitorId]
    );

    return c.json({ success: true });
  } catch (error) {
    console.error('Remove blacklist error:', error);
    return c.json({ success: false, error: '移除黑名单失败' }, 500);
  }
});

chatRoutes.get('/blacklist', requireAuth, async (c) => {
  try {
    const businessId = c.get('businessId');
    const db = getDb();

    const blacklist = await db.all(
      'SELECT * FROM visitor_blacklist WHERE business_id = ? ORDER BY created_at DESC',
      [businessId]
    );

    return c.json({ success: true, data: blacklist });
  } catch (error) {
    console.error('Get blacklist error:', error);
    return c.json({ success: false, error: '获取黑名单失败' }, 500);
  }
});

// ==========================================
// Banword Check Route
// ==========================================

chatRoutes.post('/banword/check', async (c) => {
  try {
    const body = await c.req.json();
    const { content } = body;

    const db = getDb();
    const banwords = await db.all('SELECT keyword, level FROM banwords WHERE status = 1');

    for (const banword of banwords) {
      if (content.includes(banword.keyword)) {
        if (banword.level >= 2) {
          return c.json({ blocked: true, message: '内容包含违禁词' });
        }
      }
    }

    return c.json({ blocked: false });
  } catch (error) {
    console.error('Check banword error:', error);
    return c.json({ blocked: false });
  }
});

// ==========================================
// Staff Online Status Route
// ==========================================

chatRoutes.get('/staff/online', async (c) => {
  try {
    const businessSlug = c.req.query('business');
    const db = getDb();
    const now = Date.now();
    const onlineThreshold = 5 * 60 * 1000;

    let query = `
      SELECT COUNT(*) as count 
      FROM staff_users 
      WHERE (role = 'staff' OR role = 'admin') AND status = 'active' 
      AND last_active IS NOT NULL AND last_active > ?
    `;
    
    const params: unknown[] = [now - onlineThreshold];

    if (businessSlug) {
      query += ' AND business_slug = ?';
      params.push(businessSlug);
    }

    const result = await db.get<{ count: number }>(query, params);

    return c.json({ 
      success: true, 
      data: { 
        onlineCount: result?.count || 0,
        isOnline: (result?.count || 0) > 0 
      } 
    });
  } catch (error) {
    console.error('Get staff online status error:', error);
    return c.json({ success: false, error: '获取客服在线状态失败' }, 500);
  }
});

chatRoutes.post('/transfer/request', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, toStaffId, reason } = body;
    
    if (!sessionId || !toStaffId) {
      return c.json({ success: false, error: '会话ID和目标客服ID不能为空' }, 400);
    }
    
    const staffId = c.get('userId');
    
    const result = await transferService.createTransferRequest({
      sessionId,
      fromStaffId: staffId,
      toStaffId: parseInt(toStaffId, 10),
      reason: reason || ''
    });
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Create transfer request error:', error);
    return c.json({ success: false, error: '创建转接请求失败' }, 500);
  }
});

chatRoutes.post('/transfer/:requestId/respond', async (c) => {
  try {
    const { requestId } = c.req.param();
    const body = await c.req.json();
    const { action } = body;
    
    if (!action || (action !== 'accept' && action !== 'reject')) {
      return c.json({ success: false, error: '无效的操作类型' }, 400);
    }
    
    const staffId = c.get('userId');
    
    const result = await transferService.respondToTransferRequest(
      parseInt(requestId, 10),
      staffId,
      action as 'accept' | 'reject'
    );
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Respond to transfer request error:', error);
    return c.json({ success: false, error: '处理转接请求失败' }, 500);
  }
});

chatRoutes.get('/transfer/pending', async (c) => {
  try {
    const staffId = c.get('userId');
    const requests = await transferService.getPendingTransferRequests(staffId);
    return c.json({ success: true, data: requests });
  } catch (error) {
    console.error('Get pending transfer requests error:', error);
    return c.json({ success: false, error: '获取待处理转接请求失败' }, 500);
  }
});

chatRoutes.delete('/transfer/:requestId', async (c) => {
  try {
    const { requestId } = c.req.param();
    const staffId = c.get('userId');
    
    const result = await transferService.deleteTransferRequest(
      parseInt(requestId, 10),
      staffId
    );
    
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete transfer request error:', error);
    return c.json({ success: false, error: '删除转接请求失败' }, 500);
  }
});
