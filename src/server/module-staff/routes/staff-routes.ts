/**
 * Staff API routes - Customer service endpoints
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import * as staffService from '../services/staff-service';
import * as chatService from '@server/module-chat/services/chat-service';
import * as uploadService from '@server/module-chat/services/upload-service';
import * as sseService from '@server/module-chat/services/sse-service';
import * as queueService from '@server/module-chat/services/queue-service';
import { verifyToken } from '@server/module-auth/services/auth-service';

export const staffRoutes = new Hono();

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

  await next();
}

staffRoutes.use('*', requireAuth);

// ==========================================
// Session Routes
// ==========================================

// List all sessions
staffRoutes.get('/sessions', async (c) => {
  try {
    const status = c.req.query('status') as 'active' | 'closed' | undefined;
    const sessions = await staffService.listSessionsWithPreview(status);
    return c.json({ success: true, data: sessions });
  } catch (error) {
    console.error('List sessions error:', error);
    return c.json({ success: false, error: 'Failed to list sessions' }, 500);
  }
});

// Get single session
staffRoutes.get('/sessions/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const result = await staffService.getSessionWithPreview(sessionId);
    if (!result.session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Get session error:', error);
    return c.json({ success: false, error: 'Failed to get session' }, 500);
  }
});

// Get total unread count
staffRoutes.get('/unread', async (c) => {
  try {
    const count = await staffService.getTotalUnreadCount();
    return c.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Get unread count error:', error);
    return c.json({ success: false, error: 'Failed to get unread count' }, 500);
  }
});

// ==========================================
// Message Routes
// ==========================================

// Get messages for a session
staffRoutes.get('/messages', async (c) => {
  try {
    const sessionId = c.req.query('sessionId');
    if (!sessionId) {
      return c.json({ success: false, error: 'Session ID is required' }, 400);
    }

    const before = c.req.query('before') ? parseInt(c.req.query('before')!) : undefined;
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 20;

    const result = await staffService.getMessages(sessionId, before, limit);
    return c.json({ success: true, data: result.messages, hasMore: result.hasMore });
  } catch (error) {
    console.error('Get messages error:', error);
    return c.json({ success: false, error: 'Failed to get messages' }, 500);
  }
});

// Send message (staff reply)
staffRoutes.post('/messages', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, contentType, content, thumbnailUrl, fileName, fileSize } = body;

    if (!sessionId || !contentType || !content) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    const message = await staffService.sendMessage({
      sessionId,
      senderType: 'staff',
      contentType,
      content,
      thumbnailUrl,
      fileName,
      fileSize,
    });

    // Broadcast to SSE clients
    await sseService.broadcastMessage(message);

    // Broadcast session update to staff
    const session = await chatService.getSession(sessionId);
    if (session) {
      await sseService.broadcastSessionUpdate(session);
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

staffRoutes.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;

    if (!file || !sessionId) {
      return c.json({ success: false, error: 'File and sessionId are required' }, 400);
    }

    // Validate file and auto-detect content type
    const validation = uploadService.validateFile({
      type: file.type,
      size: file.size,
      name: file.name,
    });

    if (!validation.valid) {
      return c.json({ success: false, error: validation.error }, 400);
    }

    const contentType = validation.detectedType!;

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadService.saveFileBuffer(buffer, file.name, file.type);

    // Create message
    const message = await staffService.sendMessage({
      sessionId,
      senderType: 'staff',
      contentType,
      content: uploadResult.url,
      thumbnailUrl: uploadResult.thumbnailUrl,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
    });

    // Broadcast to SSE clients
    await sseService.broadcastMessage(message);

    return c.json({ success: true, data: message });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ success: false, error: 'Failed to upload file' }, 500);
  }
});

// ==========================================
// SSE Route (Staff receives all messages)
// ==========================================

staffRoutes.get('/sse', async (c) => {
  return streamSSE(c, async (stream) => {
    // Add staff client to connection pool
    sseService.addStaffClient(stream);

    // Send connected event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ type: 'connected' }),
    });

    // Keep connection alive with periodic heartbeats
    let isConnected = true;

    const cleanup = () => {
      isConnected = false;
      sseService.removeStaffClient(stream);
    };

    // Send periodic heartbeats
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

staffRoutes.put('/read/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    await staffService.markAsRead(sessionId, 'staff');

    // Broadcast session update
    const session = await chatService.getSession(sessionId);
    if (session) {
      await sseService.broadcastSessionUpdate(session);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    return c.json({ success: false, error: 'Failed to mark as read' }, 500);
  }
});

// ==========================================
// Topic & Task Status Routes
// ==========================================

// Update session topic
staffRoutes.put('/sessions/:sessionId/topic', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json();
    const { topic } = body;

    if (typeof topic !== 'string') {
      return c.json({ success: false, error: 'Topic must be a string' }, 400);
    }

    const session = await staffService.updateSessionTopic(sessionId, topic);
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    // Broadcast session update to both staff and visitor
    await sseService.broadcastSessionUpdate(session);

    return c.json({ success: true, data: session });
  } catch (error) {
    console.error('Update topic error:', error);
    return c.json({ success: false, error: 'Failed to update topic' }, 500);
  }
});

// Update task status
staffRoutes.put('/sessions/:sessionId/status', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json();
    const { taskStatus } = body;

    const validStatuses = ['requirement_discussion', 'requirement_confirmed', 'in_progress', 'delivered', 'reviewed'];
    if (!validStatuses.includes(taskStatus)) {
      return c.json({ success: false, error: 'Invalid task status' }, 400);
    }

    const session = await staffService.updateTaskStatus(sessionId, taskStatus);
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    // Broadcast session update to both staff and visitor
    await sseService.broadcastSessionUpdate(session);

    return c.json({ success: true, data: session });
  } catch (error) {
    console.error('Update status error:', error);
    return c.json({ success: false, error: 'Failed to update status' }, 500);
  }
});

// ==========================================
// Message Management Routes
// ==========================================

// Delete all messages for a session
staffRoutes.delete('/messages/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    
    const result = await staffService.deleteSessionMessages(sessionId);
    
    if (result.success) {
      return c.json({ success: true, message: 'Messages deleted successfully' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('Delete messages error:', error);
    return c.json({ success: false, error: 'Failed to delete messages' }, 500);
  }
});

// ==========================================
// Queue Routes (Staff view)
// ==========================================

// Get queue list
staffRoutes.get('/queue', async (c) => {
  try {
    const queueList = await queueService.getQueueList();
    return c.json({ success: true, data: queueList });
  } catch (error) {
    console.error('Get queue list error:', error);
    return c.json({ success: false, error: 'Failed to get queue list' }, 500);
  }
});

// ==========================================
// Statistics Routes (统计数据)
// ==========================================

// Get staff dashboard statistics
staffRoutes.get('/statistics', async (c) => {
  try {
    const stats = await staffService.getStaffStatistics();
    return c.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get statistics error:', error);
    return c.json({ success: false, error: 'Failed to get statistics' }, 500);
  }
});

// Get visitor list
staffRoutes.get('/visitors', async (c) => {
  try {
    const state = c.req.query('state') as string | undefined;
    const groupid = c.req.query('groupid') as string | undefined;
    const visitors = await staffService.getVisitorList(state, groupid);
    return c.json({ success: true, data: visitors });
  } catch (error) {
    console.error('Get visitor list error:', error);
    return c.json({ success: false, error: 'Failed to get visitor list' }, 500);
  }
});

// ==========================================
// Quick Replies Routes (常用语管理)
// ==========================================

// Get quick replies (sentences)
staffRoutes.get('/sentences', async (c) => {
  try {
    const sentences = await staffService.getSentences();
    return c.json({ success: true, data: sentences });
  } catch (error) {
    console.error('Get sentences error:', error);
    return c.json({ success: false, error: 'Failed to get sentences' }, 500);
  }
});

// Add a new sentence
staffRoutes.post('/sentences', async (c) => {
  try {
    const body = await c.req.json();
    const { content, tag, lang } = body;

    if (!content) {
      return c.json({ success: false, error: 'Content is required' }, 400);
    }

    const sentence = await staffService.addSentence({ content, tag, lang });
    return c.json({ success: true, data: sentence });
  } catch (error) {
    console.error('Add sentence error:', error);
    return c.json({ success: false, error: 'Failed to add sentence' }, 500);
  }
});

// Update a sentence
staffRoutes.put('/sentences/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const { content, tag, state } = body;

    const sentence = await staffService.updateSentence(id, { content, tag, state });
    if (!sentence) {
      return c.json({ success: false, error: 'Sentence not found' }, 404);
    }

    return c.json({ success: true, data: sentence });
  } catch (error) {
    console.error('Update sentence error:', error);
    return c.json({ success: false, error: 'Failed to update sentence' }, 500);
  }
});

// Delete a sentence
staffRoutes.delete('/sentences/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const result = await staffService.deleteSentence(id);

    if (!result) {
      return c.json({ success: false, error: 'Sentence not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete sentence error:', error);
    return c.json({ success: false, error: 'Failed to delete sentence' }, 500);
  }
});

// ==========================================
// Offline Messages Routes (留言管理)
// ==========================================

// Get offline messages
staffRoutes.get('/offline-messages', async (c) => {
  try {
    const messages = await staffService.getOfflineMessages();
    return c.json({ success: true, data: messages });
  } catch (error) {
    console.error('Get offline messages error:', error);
    return c.json({ success: false, error: 'Failed to get offline messages' }, 500);
  }
});

// Update offline message status
staffRoutes.put('/offline-messages/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const { status } = body;

    const message = await staffService.updateOfflineMessageStatus(id, status);
    if (!message) {
      return c.json({ success: false, error: 'Message not found' }, 404);
    }

    return c.json({ success: true, data: message });
  } catch (error) {
    console.error('Update offline message error:', error);
    return c.json({ success: false, error: 'Failed to update offline message' }, 500);
  }
});

// ==========================================
// Visitor Blacklist Routes (黑名单管理)
// ==========================================

// Add visitor to blacklist
staffRoutes.post('/blacklist', async (c) => {
  try {
    const body = await c.req.json();
    const { visitorId, reason } = body;

    if (!visitorId) {
      return c.json({ success: false, error: 'Visitor ID is required' }, 400);
    }

    const result = await staffService.addToBlacklist(visitorId, reason);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Add to blacklist error:', error);
    return c.json({ success: false, error: 'Failed to add to blacklist' }, 500);
  }
});

// Remove visitor from blacklist
staffRoutes.delete('/blacklist/:visitorId', async (c) => {
  try {
    const visitorId = c.req.param('visitorId');
    const result = await staffService.removeFromBlacklist(visitorId);

    if (!result) {
      return c.json({ success: false, error: 'Visitor not found in blacklist' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Remove from blacklist error:', error);
    return c.json({ success: false, error: 'Failed to remove from blacklist' }, 500);
  }
});

// Get blacklist
staffRoutes.get('/blacklist', async (c) => {
  try {
    const blacklist = await staffService.getBlacklist();
    return c.json({ success: true, data: blacklist });
  } catch (error) {
    console.error('Get blacklist error:', error);
    return c.json({ success: false, error: 'Failed to get blacklist' }, 500);
  }
});

// ==========================================
// Transfer Session Routes (转接客服)
// ==========================================

// Get available staff for transfer
staffRoutes.get('/transfer/staff', async (c) => {
  try {
    const currentStaffId = c.req.query('excludeStaffId');
    const staff = await staffService.getAvailableStaffForTransfer(currentStaffId);
    return c.json({ success: true, data: staff });
  } catch (error) {
    console.error('Get available staff error:', error);
    return c.json({ success: false, error: 'Failed to get available staff' }, 500);
  }
});

// Transfer session to another staff
staffRoutes.post('/transfer/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json();
    const { targetStaffId, reason } = body;

    if (!targetStaffId) {
      return c.json({ success: false, error: 'Target staff ID is required' }, 400);
    }

    const result = await staffService.transferSession(sessionId, parseInt(targetStaffId, 10), reason);
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({ success: true, message: 'Transfer successful' });
  } catch (error) {
    console.error('Transfer session error:', error);
    return c.json({ success: false, error: 'Failed to transfer session' }, 500);
  }
});

// ==========================================
// Evaluation Routes (评价管理)
// ==========================================

// Get evaluation settings
staffRoutes.get('/evaluation-settings', async (c) => {
  try {
    const settings = await staffService.getEvaluationSettings();
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get evaluation settings error:', error);
    return c.json({ success: false, error: 'Failed to get evaluation settings' }, 500);
  }
});

// Update evaluation settings
staffRoutes.put('/evaluation-settings', async (c) => {
  try {
    const body = await c.req.json();
    const settings = await staffService.updateEvaluationSettings(body);
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.error('Update evaluation settings error:', error);
    return c.json({ success: false, error: 'Failed to update evaluation settings' }, 500);
  }
});
