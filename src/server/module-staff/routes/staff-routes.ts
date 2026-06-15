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

export const staffRoutes = new Hono();

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
