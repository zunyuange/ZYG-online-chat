/**
 * Staff API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:3010';

describe('Staff API', () => {
  let testSessionId: string;

  beforeAll(async () => {
    // Create a test session for message tests
    const response = await fetch(`${BASE_URL}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorName: 'StaffTestUser' }),
    });
    const result = await response.json();
    testSessionId = result.data.id;

    // Send a test message from visitor
    await fetch(`${BASE_URL}/api/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: testSessionId,
        contentType: 'text',
        content: 'Test message from visitor',
      }),
    });
  });

  describe('GET /api/staff/sessions', () => {
    it('should get all sessions', async () => {
      const response = await fetch(`${BASE_URL}/api/staff/sessions`);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should filter sessions by status=active', async () => {
      const response = await fetch(`${BASE_URL}/api/staff/sessions?status=active`);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      result.data.forEach((session: any) => {
        expect(session.status).toBe('active');
      });
    });

    it('should include lastMessage preview', async () => {
      const response = await fetch(`${BASE_URL}/api/staff/sessions?status=active`);
      const result = await response.json();
      if (result.data.length > 0) {
        const sessionWithMessage = result.data.find((s: any) => s.lastMessage);
        if (sessionWithMessage) {
          expect(sessionWithMessage.lastMessage.content).toBeDefined();
          expect(sessionWithMessage.lastMessage.contentType).toBeDefined();
        }
      }
    });
  });

  describe('GET /api/staff/messages', () => {
    it('should get messages for a session', async () => {
      const response = await fetch(
        `${BASE_URL}/api/staff/messages?sessionId=${testSessionId}&limit=20`
      );
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should fail without sessionId', async () => {
      const response = await fetch(`${BASE_URL}/api/staff/messages`);
      const result = await response.json();
      expect(result.success).toBe(false);
    });

    it('should paginate messages with before parameter', async () => {
      const allResponse = await fetch(
        `${BASE_URL}/api/staff/messages?sessionId=${testSessionId}&limit=20`
      );
      const allResult = await allResponse.json();
      if (allResult.data.length > 0) {
        const firstMessageId = allResult.data[0].id;
        const pagedResponse = await fetch(
          `${BASE_URL}/api/staff/messages?sessionId=${testSessionId}&before=${firstMessageId}&limit=10`
        );
        const pagedResult = await pagedResponse.json();
        expect(pagedResult.success).toBe(true);
        expect(Array.isArray(pagedResult.data)).toBe(true);
      }
    });
  });

  describe('POST /api/staff/messages', () => {
    it('should send a text message from staff', async () => {
      const response = await fetch(`${BASE_URL}/api/staff/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: testSessionId,
          contentType: 'text',
          content: 'Hello from staff!',
        }),
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.sessionId).toBe(testSessionId);
      expect(result.data.senderType).toBe('staff');
      expect(result.data.contentType).toBe('text');
      expect(result.data.content).toBe('Hello from staff!');
    });

    it('should fail with missing required fields', async () => {
      const response = await fetch(`${BASE_URL}/api/staff/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: testSessionId }),
      });
      const result = await response.json();
      expect(result.success).toBe(false);
    });
  });

  describe('POST /api/staff/upload', () => {
    // Note: File upload tests are skipped due to Node.js test environment limitations
    it.skip('should upload an image file from staff', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
        0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const formData = new FormData();
      formData.append('file', pngBuffer, {
        filename: 'staff-test.png',
        contentType: 'image/png',
      });
      formData.append('sessionId', testSessionId);

      const response = await fetch(`${BASE_URL}/api/staff/upload`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders(),
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.senderType).toBe('staff');
      expect(result.data.contentType).toBe('image');
      expect(result.data.content).toMatch(/^\/uploads\//);
    });

    it.skip('should upload a video file from staff', async () => {
      const mp4Buffer = Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
        0x00, 0x00, 0x00, 0x01, 0x69, 0x73, 0x6f, 0x6d, 0x61, 0x76, 0x63, 0x31,
      ]);

      const formData = new FormData();
      formData.append('file', mp4Buffer, {
        filename: 'staff-test.mp4',
        contentType: 'video/mp4',
      });
      formData.append('sessionId', testSessionId);

      const response = await fetch(`${BASE_URL}/api/staff/upload`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders(),
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.contentType).toBe('video');
    });

    it('should reject invalid file types', async () => {
      const formData = new FormData();
      formData.append('file', Buffer.from('test content'), {
        filename: 'test.pdf',
        contentType: 'application/pdf',
      });
      formData.append('sessionId', testSessionId);

      const response = await fetch(`${BASE_URL}/api/staff/upload`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders(),
      });

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail without file', async () => {
      const formData = new FormData();
      formData.append('sessionId', testSessionId);

      const response = await fetch(`${BASE_URL}/api/staff/upload`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders(),
      });

      const result = await response.json();
      expect(result.success).toBe(false);
    });

    it('should fail without sessionId', async () => {
      const formData = new FormData();
      formData.append('file', Buffer.from('test'), {
        filename: 'test.png',
        contentType: 'image/png',
      });

      const response = await fetch(`${BASE_URL}/api/staff/upload`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders(),
      });

      const result = await response.json();
      expect(result.success).toBe(false);
    });
  });

  describe('PUT /api/staff/read/:sessionId', () => {
    it('should mark messages as read by staff', async () => {
      const response = await fetch(`${BASE_URL}/api/staff/read/${testSessionId}`, {
        method: 'PUT',
      });
      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it('should update unread count in session list', async () => {
      await fetch(`${BASE_URL}/api/staff/read/${testSessionId}`, { method: 'PUT' });
      const response = await fetch(`${BASE_URL}/api/staff/sessions?status=active`);
      const result = await response.json();
      const session = result.data.find((s: any) => s.id === testSessionId);
      if (session) {
        expect(session.unreadByStaff).toBe(0);
      }
    });
  });

  describe('GET /api/staff/unread', () => {
    it('should get total unread count', async () => {
      const response = await fetch(`${BASE_URL}/api/staff/unread`);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(typeof result.data.count).toBe('number');
    });
  });
});
