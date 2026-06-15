/**
 * Chat API routes - User/Visitor endpoints
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import * as chatService from '../services/chat-service';
import * as uploadService from '../services/upload-service';
import * as sseService from '../services/sse-service';
import * as queueService from '../services/queue-service';
import * as barkService from '@server/services/bark-service';

export const chatRoutes = new Hono();

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
