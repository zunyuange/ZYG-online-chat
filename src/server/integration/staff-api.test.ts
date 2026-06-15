/**
 * Integration tests for Staff API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { serve } from '@hono/node-server';
import { hc } from 'hono/client';
import app, { type AppType } from '../index';
import { sqlite } from '../shared/db';
import { randomUUID } from 'node:crypto';

/**
 * Type guard for success responses
 */
function isSuccess<T>(response: any): response is { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Helper function to create a test session
 */
function createTestSession(overrides?: { id?: string; visitorName?: string; status?: 'active' | 'closed' }) {
  const id = overrides?.id || randomUUID();
  const visitorName = overrides?.visitorName || `TestVisitor${Math.floor(Math.random() * 1000)}`;
  const status = overrides?.status || 'active';
  const now = Date.now();

  const stmt = sqlite.prepare(`
    INSERT INTO sessions (id, visitor_name, status, created_at, updated_at)
    VALUES (:id, :visitor_name, :status, :created_at, :updated_at)
  `);
  stmt.run({ id, visitor_name: visitorName, status, created_at: now, updated_at: now });

  return { id, visitorName, status };
}

/**
 * Helper function to create a test message
 */
function createTestMessage(sessionId: string, senderType: 'visitor' | 'staff', contentType: 'text' | 'image' | 'video', content: string) {
  const now = Date.now();

  const stmt = sqlite.prepare(`
    INSERT INTO messages (session_id, sender_type, content_type, content, created_at)
    VALUES (:session_id, :sender_type, :content_type, :content, :created_at)
  `);
  const result = stmt.run({ session_id: sessionId, sender_type: senderType, content_type: contentType, content, created_at: now });

  // Update session's last_message_at
  const updateStmt = sqlite.prepare(`
    UPDATE sessions SET last_message_at = :last_message_at, updated_at = :updated_at WHERE id = :id
  `);
  updateStmt.run({ last_message_at: now, updated_at: now, id: sessionId });

  return result.lastInsertRowid as number;
}

describe('Staff API Integration Tests', () => {
  let server: ReturnType<typeof serve>;
  let client: ReturnType<typeof hc<typeof app>>;

  beforeAll(async () => {
    // Start test server
    server = serve({
      fetch: app.fetch,
      port: 3012,
    });

    // Create API client
    client = hc<AppType>('http://localhost:3012');
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    sqlite.exec('DELETE FROM messages');
    sqlite.exec('DELETE FROM sessions');
  });

  // ==========================================
  // GET /api/staff/sessions - 会话列表
  // ==========================================

  describe('GET /api/staff/sessions', () => {
    it('should return empty array when no sessions exist', async () => {
      const response = await client.api.staff.sessions.$get();
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toEqual([]);
      }
    });

    it('should return all sessions', async () => {
      // Create test sessions
      createTestSession({ id: 'session-1', visitorName: 'Visitor1', status: 'active' });
      createTestSession({ id: 'session-2', visitorName: 'Visitor2', status: 'active' });
      createTestSession({ id: 'session-3', visitorName: 'Visitor3', status: 'closed' });

      const response = await client.api.staff.sessions.$get();
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(3);
        // 验证所有会话ID都存在，而不是按特定顺序
        const sessionIds = result.data.map((s: any) => s.id);
        expect(sessionIds).toContain('session-1');
        expect(sessionIds).toContain('session-2');
        expect(sessionIds).toContain('session-3');
        // 验证状态
        expect(result.data.filter((s: any) => s.status === 'active')).toHaveLength(2);
        expect(result.data.filter((s: any) => s.status === 'closed')).toHaveLength(1);
      }
    });

    it('should filter sessions by status=active', async () => {
      // Create test sessions with different statuses
      createTestSession({ id: 'active-1', visitorName: 'ActiveVisitor1', status: 'active' });
      createTestSession({ id: 'active-2', visitorName: 'ActiveVisitor2', status: 'active' });
      createTestSession({ id: 'closed-1', visitorName: 'ClosedVisitor1', status: 'closed' });

      const response = await client.api.staff.sessions.$get({
        query: { status: 'active' },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(2);
        expect(result.data.every((s: any) => s.status === 'active')).toBe(true);
      }
    });

    it('should filter sessions by status=closed', async () => {
      // Create test sessions
      createTestSession({ id: 'active-1', visitorName: 'ActiveVisitor1', status: 'active' });
      createTestSession({ id: 'closed-1', visitorName: 'ClosedVisitor1', status: 'closed' });

      const response = await client.api.staff.sessions.$get({
        query: { status: 'closed' },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe('closed');
      }
    });

    it('should include last message preview', async () => {
      const session = createTestSession({ id: 'session-with-msg', visitorName: 'TestVisitor', status: 'active' });
      createTestMessage(session.id, 'visitor', 'text', 'Hello, this is a test message');

      const response = await client.api.staff.sessions.$get();
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].lastMessage).toBeDefined();
        expect(result.data[0].lastMessage.content).toBe('Hello, this is a test message');
        expect(result.data[0].lastMessage.contentType).toBe('text');
      }
    });
  });

  // ==========================================
  // GET /api/staff/messages - 消息获取
  // ==========================================

  describe('GET /api/staff/messages', () => {
    let testSession: { id: string };

    beforeEach(() => {
      testSession = createTestSession({ id: 'msg-session', visitorName: 'MessageTestVisitor', status: 'active' });
    });

    it('should return empty array when no messages exist', async () => {
      const response = await client.api.staff.messages.$get({
        query: { sessionId: testSession.id },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toEqual([]);
        expect(result.hasMore).toBe(false);
      }
    });

    it('should return messages for a session', async () => {
      // Create test messages
      createTestMessage(testSession.id, 'visitor', 'text', 'Message 1');
      createTestMessage(testSession.id, 'staff', 'text', 'Message 2');
      createTestMessage(testSession.id, 'visitor', 'text', 'Message 3');

      const response = await client.api.staff.messages.$get({
        query: { sessionId: testSession.id },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(3);
        expect(result.data[0].content).toBe('Message 1');
        expect(result.data[1].content).toBe('Message 2');
        expect(result.data[2].content).toBe('Message 3');
      }
    });

    it('should respect limit parameter', async () => {
      // Create 5 messages
      for (let i = 1; i <= 5; i++) {
        createTestMessage(testSession.id, 'visitor', 'text', `Message ${i}`);
      }

      // Request with limit=2
      const response = await client.api.staff.messages.$get({
        query: { sessionId: testSession.id, limit: 2 },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(2);
        expect(result.hasMore).toBe(true);
      }
    });

    it('should return 400 when sessionId is missing', async () => {
      const response = await client.api.staff.messages.$get({
        query: { sessionId: '' },
      });

      expect(response.status).toBe(400);
    });
  });

  // ==========================================
  // POST /api/staff/messages - 客服发送消息
  // ==========================================

  describe('POST /api/staff/messages', () => {
    let testSession: { id: string };

    beforeEach(() => {
      testSession = createTestSession({ id: 'send-session', visitorName: 'SendTestVisitor', status: 'active' });
    });

    it('should send a text message', async () => {
      const messageData = {
        sessionId: testSession.id,
        contentType: 'text' as const,
        content: 'Hello from staff!',
      };

      const response = await client.api.staff.messages.$post({
        json: messageData,
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data.sessionId).toBe(testSession.id);
        expect(result.data.senderType).toBe('staff');
        expect(result.data.contentType).toBe('text');
        expect(result.data.content).toBe('Hello from staff!');
        expect(result.data.id).toBeGreaterThan(0);
      }
    });

    it('should send an image message', async () => {
      const messageData = {
        sessionId: testSession.id,
        contentType: 'image' as const,
        content: '/uploads/test-image.jpg',
        thumbnailUrl: '/uploads/test-image-thumb.jpg',
        fileName: 'test-image.jpg',
        fileSize: 12345,
      };

      const response = await client.api.staff.messages.$post({
        json: messageData,
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data.senderType).toBe('staff');
        expect(result.data.contentType).toBe('image');
        expect(result.data.content).toBe('/uploads/test-image.jpg');
        expect(result.data.thumbnailUrl).toBe('/uploads/test-image-thumb.jpg');
        expect(result.data.fileName).toBe('test-image.jpg');
        expect(result.data.fileSize).toBe(12345);
      }
    });

    it('should send a video message', async () => {
      const messageData = {
        sessionId: testSession.id,
        contentType: 'video' as const,
        content: '/uploads/test-video.mp4',
        fileName: 'test-video.mp4',
        fileSize: 543210,
      };

      const response = await client.api.staff.messages.$post({
        json: messageData,
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data.senderType).toBe('staff');
        expect(result.data.contentType).toBe('video');
        expect(result.data.content).toBe('/uploads/test-video.mp4');
        expect(result.data.fileName).toBe('test-video.mp4');
        expect(result.data.fileSize).toBe(543210);
      }
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await client.api.staff.messages.$post({
        json: {
          sessionId: testSession.id,
          // Missing contentType and content
        },
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when sessionId is missing', async () => {
      const response = await client.api.staff.messages.$post({
        json: {
          contentType: 'text',
          content: 'Test message',
          // Missing sessionId
        },
      });

      expect(response.status).toBe(400);
    });
  });

  // ==========================================
  // POST /api/staff/upload - 客服文件上传
  // ==========================================

  describe('POST /api/staff/upload', () => {
    let testSession: { id: string };

    beforeEach(() => {
      testSession = createTestSession({ id: 'upload-session', visitorName: 'UploadTestVisitor', status: 'active' });
    });

    it('should upload an image file', async () => {
      // Create a small test image buffer (1x1 PNG)
      const imageBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
      ]);

      const formData = new FormData();
      formData.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'test.png');
      formData.append('sessionId', testSession.id);

      const response = await fetch('http://localhost:3012/api/staff/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.senderType).toBe('staff');
      expect(result.data.contentType).toBe('image');
      expect(result.data.content).toMatch(/^\/uploads\/[a-f0-9-]+\.png$/);
      expect(result.data.fileName).toBeDefined();
    });

    it('should upload a video file', async () => {
      // Create a minimal test video buffer (WebM header)
      const videoBuffer = Buffer.from([
        0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);

      const formData = new FormData();
      formData.append('file', new Blob([videoBuffer], { type: 'video/webm' }), 'test.webm');
      formData.append('sessionId', testSession.id);

      const response = await fetch('http://localhost:3012/api/staff/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.contentType).toBe('video');
    });

    it('should reject invalid file type', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test content'], { type: 'application/pdf' }), 'test.pdf');
      formData.append('sessionId', testSession.id);

      const response = await fetch('http://localhost:3012/api/staff/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should return 400 when file is missing', async () => {
      const formData = new FormData();
      formData.append('sessionId', testSession.id);
      // Missing file

      const response = await fetch('http://localhost:3012/api/staff/upload', {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 when sessionId is missing', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test'], { type: 'image/png' }), 'test.png');
      // Missing sessionId

      const response = await fetch('http://localhost:3012/api/staff/upload', {
        method: 'POST',
        body: formData,
      });

      expect(response.status).toBe(400);
    });
  });

  // ==========================================
  // PUT /api/staff/read/:sessionId - 已读标记
  // ==========================================

  describe('PUT /api/staff/read/:sessionId', () => {
    let testSession: { id: string };

    beforeEach(() => {
      testSession = createTestSession({
        id: 'read-session',
        visitorName: 'ReadTestVisitor',
        status: 'active',
      });
    });

    it('should mark messages as read by staff', async () => {
      // Create some visitor messages
      createTestMessage(testSession.id, 'visitor', 'text', 'Visitor message 1');
      createTestMessage(testSession.id, 'visitor', 'text', 'Visitor message 2');

      // Update unread_by_staff counter
      const now = Date.now();
      const updateStmt = sqlite.prepare(`
        UPDATE sessions SET unread_by_staff = 2, updated_at = :updated_at WHERE id = :id
      `);
      updateStmt.run({ updated_at: now, id: testSession.id });

      // Verify unread count before marking as read
      const beforeSession = sqlite.prepare('SELECT unread_by_staff FROM sessions WHERE id = ?').get(testSession.id) as { unread_by_staff: number };
      expect(beforeSession.unread_by_staff).toBe(2);

      // Mark as read
      const response = await client.api.staff.read[':sessionId'].$put({
        param: { sessionId: testSession.id },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      // Verify unread count after marking as read
      const afterSession = sqlite.prepare('SELECT unread_by_staff FROM sessions WHERE id = ?').get(testSession.id) as { unread_by_staff: number };
      expect(afterSession.unread_by_staff).toBe(0);
    });

    it('should return success even for session with no messages', async () => {
      const response = await client.api.staff.read[':sessionId'].$put({
        param: { sessionId: testSession.id },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });

    it('should return success for non-existent session', async () => {
      const response = await client.api.staff.read[':sessionId'].$put({
        param: { sessionId: 'non-existent-session' },
      });
      const result = await response.json();

      // API returns success even if session doesn't exist
      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================
  // GET /api/staff/sessions/:sessionId - 获取单个会话
  // ==========================================

  describe('GET /api/staff/sessions/:sessionId', () => {
    it('should return session by id', async () => {
      const session = createTestSession({ id: 'get-session', visitorName: 'GetSessionVisitor', status: 'active' });

      const response = await client.api.staff.sessions[':sessionId'].$get({
        param: { sessionId: session.id },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data.session.id).toBe(session.id);
        expect(result.data.session.visitorName).toBe('GetSessionVisitor');
        expect(result.data.session.status).toBe('active');
      }
    });

    it('should return 404 for non-existent session', async () => {
      const response = await client.api.staff.sessions[':sessionId'].$get({
        param: { sessionId: 'non-existent-id' },
      });

      expect(response.status).toBe(404);
    });

    it('should include last message preview', async () => {
      const session = createTestSession({ id: 'preview-session', visitorName: 'PreviewVisitor', status: 'active' });
      createTestMessage(session.id, 'visitor', 'text', 'Last message preview');

      const response = await client.api.staff.sessions[':sessionId'].$get({
        param: { sessionId: session.id },
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data.lastMessage).toBeDefined();
        expect(result.data.lastMessage.content).toBe('Last message preview');
      }
    });
  });

  // ==========================================
  // GET /api/staff/unread - 获取未读消息总数
  // ==========================================

  describe('GET /api/staff/unread', () => {
    it('should return 0 when no unread messages', async () => {
      const response = await client.api.staff.unread.$get();
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        expect(result.data.count).toBe(0);
      }
    });

    it('should return total unread count across all active sessions', async () => {
      const session1 = createTestSession({ id: 'unread-1', visitorName: 'UnreadVisitor1', status: 'active' });
      const session2 = createTestSession({ id: 'unread-2', visitorName: 'UnreadVisitor2', status: 'active' });
      const closedSession = createTestSession({ id: 'unread-closed', visitorName: 'UnreadVisitor3', status: 'closed' });

      // Create messages and update unread counts
      const now = Date.now();
      const updateStmt = sqlite.prepare(`
        UPDATE sessions SET unread_by_staff = :count, updated_at = :updated_at WHERE id = :id
      `);
      updateStmt.run({ count: 3, updated_at: now, id: session1.id });
      updateStmt.run({ count: 2, updated_at: now, id: session2.id });
      updateStmt.run({ count: 5, updated_at: now, id: closedSession.id });

      const response = await client.api.staff.unread.$get();
      const result = await response.json();

      expect(response.status).toBe(200);
      if (isSuccess(result)) {
        // Should only count active sessions (3 + 2 = 5)
        expect(result.data.count).toBe(5);
      }
    });
  });
});
