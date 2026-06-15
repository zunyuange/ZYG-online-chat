/**
 * Chat API Integration Tests
 * Tests all chat API endpoints via HTTP requests
 *
 * 运行方式: npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { sqlite } from '@server/shared/db';
import { serve } from '@hono/node-server';
import type { Server } from 'node:http';

// Test server configuration
const TEST_PORT = 3011;
const TEST_HOST = '127.0.0.1';
const API_BASE = `http://${TEST_HOST}:${TEST_PORT}/api/chat`;

let server: Server | null = null;

// ==========================================
// Setup & Teardown
// ==========================================

beforeAll(async () => {
  // Import and start server
  const { default: app } = await import('@server/index');

  // Create HTTP server from Hono app
  server = await new Promise<Server>((resolve, reject) => {
    const srv = serve({
      fetch: app.fetch,
      port: TEST_PORT,
      hostname: TEST_HOST,
    });

    // Wait a bit for server to be ready
    setTimeout(() => {
      resolve(srv as unknown as Server);
    }, 100);
  });
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});

beforeEach(async () => {
  // Clean up database before each test
  sqlite.exec('DELETE FROM messages');
  sqlite.exec('DELETE FROM sessions');
});

// ==========================================
// Session API Tests
// ==========================================

describe('POST /api/chat/session', () => {
  describe('创建新会话（无 sessionId）', () => {
    it('应当创建新会话并生成随机访客名称', async () => {
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: expect.any(String),
        visitorName: expect.any(String),
        status: 'active',
        unreadByVisitor: 0,
        unreadByStaff: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(result.data.id).toHaveLength(36); // UUID format
    });

    it('应当使用提供的访客名称创建会话', async () => {
      const visitorName = 'TestVisitor123';
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorName }),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.visitorName).toBe(visitorName);
    });

    it('应当验证返回数据结构的完整性', async () => {
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorName: 'TestUser' }),
      });

      const result = await response.json();

      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('visitorName');
      expect(result.data).toHaveProperty('status');
      expect(result.data).toHaveProperty('unreadByVisitor');
      expect(result.data).toHaveProperty('unreadByStaff');
      expect(result.data).toHaveProperty('createdAt');
      expect(result.data).toHaveProperty('updatedAt');

      // 验证状态值
      expect(result.data.status).toBe('active');

      // 验证未读计数器
      expect(result.data.unreadByVisitor).toBe(0);
      expect(result.data.unreadByStaff).toBe(0);
    });
  });

  describe('获取已有会话（带 sessionId）', () => {
    it('应当返回已存在的会话', async () => {
      // 创建会话
      const createResponse = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorName: 'OriginalUser' }),
      });
      const createResult = await createResponse.json();
      const sessionId = createResult.data.id;

      // 使用 sessionId 获取会话
      const getResponse = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const getResult = await getResponse.json();

      expect(getResult.success).toBe(true);
      expect(getResult.data.id).toBe(sessionId);
      expect(getResult.data.visitorName).toBe('OriginalUser');
    });

    it('当 sessionId 不存在时应当创建新会话', async () => {
      const fakeSessionId = '00000000-0000-0000-0000-000000000000';
      const response = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: fakeSessionId }),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(fakeSessionId);
      expect(result.data.visitorName).toBeTruthy();
    });
  });
});

// ==========================================
// Messages API Tests
// ==========================================

describe('GET /api/chat/messages', () => {
  let sessionId: string;

  beforeEach(async () => {
    // 创建测试会话
    const response = await fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorName: 'MessageTestUser' }),
    });
    const result = await response.json();
    sessionId = result.data.id;
  });

  describe('获取消息列表', () => {
    it('应当返回空列表（无消息）', async () => {
      const response = await fetch(
        `${API_BASE}/messages?sessionId=${encodeURIComponent(sessionId)}`
      );

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('应当返回会话的所有消息', async () => {
      // 发送三条消息
      await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'text',
          content: 'Message 1',
        }),
      });

      await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'text',
          content: 'Message 2',
        }),
      });

      await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'text',
          content: 'Message 3',
        }),
      });

      // 获取消息
      const response = await fetch(
        `${API_BASE}/messages?sessionId=${encodeURIComponent(sessionId)}`
      );

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3);
      expect(result.data[0].content).toBe('Message 1');
      expect(result.data[1].content).toBe('Message 2');
      expect(result.data[2].content).toBe('Message 3');
    });

    it('应当验证消息数据结构', async () => {
      await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'text',
          content: 'Test message content',
        }),
      });

      const response = await fetch(
        `${API_BASE}/messages?sessionId=${encodeURIComponent(sessionId)}`
      );

      const result = await response.json();
      const message = result.data[0];

      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('sessionId');
      expect(message).toHaveProperty('senderType');
      expect(message).toHaveProperty('contentType');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('isRead');
      expect(message).toHaveProperty('createdAt');

      expect(message.sessionId).toBe(sessionId);
      expect(message.senderType).toBe('visitor');
      expect(message.contentType).toBe('text');
      expect(message.content).toBe('Test message content');
      expect(message.isRead).toBe(false);
    });
  });

  describe('分页测试（before 参数）', () => {
    it('应当支持使用 before 参数分页', async () => {
      // 创建 25 条消息
      for (let i = 1; i <= 25; i++) {
        await fetch(`${API_BASE}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            contentType: 'text',
            content: `Message ${i}`,
          }),
        });
      }

      // 第一页
      const firstPageResponse = await fetch(
        `${API_BASE}/messages?sessionId=${encodeURIComponent(sessionId)}&limit=10`
      );
      const firstPage = await firstPageResponse.json();

      expect(firstPage.data).toHaveLength(10);
      expect(firstPage.hasMore).toBe(true);

      // 获取最后一条消息的 ID 用于下一页
      const lastMessageId = firstPage.data[9].id;

      // 第二页
      const secondPageResponse = await fetch(
        `${API_BASE}/messages?sessionId=${encodeURIComponent(sessionId)}&before=${lastMessageId}&limit=10`
      );
      const secondPage = await secondPageResponse.json();

      expect(secondPage.data).toHaveLength(10);
      expect(secondPage.hasMore).toBe(true);
    });

    it('应当正确返回 hasMore 字段', async () => {
      // 创建 15 条消息（超过默认 limit）
      for (let i = 1; i <= 15; i++) {
        await fetch(`${API_BASE}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            contentType: 'text',
            content: `Message ${i}`,
          }),
        });
      }

      const response = await fetch(
        `${API_BASE}/messages?sessionId=${encodeURIComponent(sessionId)}&limit=10`
      );

      const result = await response.json();

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(10);
    });

    it('当没有更多消息时 hasMore 应为 false', async () => {
      // 创建 5 条消息（少于 limit）
      for (let i = 1; i <= 5; i++) {
        await fetch(`${API_BASE}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            contentType: 'text',
            content: `Message ${i}`,
          }),
        });
      }

      const response = await fetch(
        `${API_BASE}/messages?sessionId=${encodeURIComponent(sessionId)}&limit=10`
      );

      const result = await response.json();

      expect(result.hasMore).toBe(false);
      expect(result.data).toHaveLength(5);
    });
  });

  describe('错误处理', () => {
    it('当缺少 sessionId 参数时返回错误', async () => {
      const response = await fetch(`${API_BASE}/messages`);

      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session ID is required');
    });
  });
});

// ==========================================
// Send Message API Tests
// ==========================================

describe('POST /api/chat/messages', () => {
  let sessionId: string;

  beforeEach(async () => {
    const response = await fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorName: 'SenderTestUser' }),
    });
    const result = await response.json();
    sessionId = result.data.id;
  });

  describe('发送文本消息', () => {
    it('应当成功发送文本消息', async () => {
      const messageContent = 'Hello, this is a test message!';
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'text',
          content: messageContent,
        }),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: expect.any(Number),
        sessionId,
        senderType: 'visitor',
        contentType: 'text',
        content: messageContent,
        isRead: false,
        createdAt: expect.any(String),
      });
    });

    it('应当验证返回的消息结构包含所有必需字段', async () => {
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'text',
          content: 'Structured message test',
        }),
      });

      const result = await response.json();

      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('sessionId');
      expect(result.data).toHaveProperty('senderType');
      expect(result.data).toHaveProperty('contentType');
      expect(result.data).toHaveProperty('content');
      expect(result.data).toHaveProperty('isRead');
      expect(result.data).toHaveProperty('createdAt');

      // 验证字段类型
      expect(typeof result.data.id).toBe('number');
      expect(typeof result.data.sessionId).toBe('string');
      expect(typeof result.data.content).toBe('string');
      expect(typeof result.data.isRead).toBe('boolean');
    });

    it('应当支持发送特殊字符的文本消息', async () => {
      const specialContent = '测试消息 with emoji 😊 and symbols @#$%';
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'text',
          content: specialContent,
        }),
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.content).toBe(specialContent);
    });
  });

  describe('错误处理', () => {
    it('当缺少 sessionId 时返回错误', async () => {
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'text',
          content: 'Test message',
        }),
      });

      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('当缺少 contentType 时返回错误', async () => {
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          content: 'Test message',
        }),
      });

      const result = await response.json();

      expect(result.success).toBe(false);
    });

    it('当缺少 content 时返回错误', async () => {
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'text',
        }),
      });

      const result = await response.json();

      expect(result.success).toBe(false);
    });
  });
});

// ==========================================
// File Upload API Tests
// ==========================================

describe('POST /api/chat/upload', () => {
  let sessionId: string;

  beforeEach(async () => {
    const response = await fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorName: 'UploadTestUser' }),
    });
    const result = await response.json();
    sessionId = result.data.id;
  });

  describe('图片上传测试', () => {
    it('应当成功上传 PNG 图片', async () => {
      // Minimal PNG file (1x1 pixel)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const formData = new FormData();
      const file = new File([pngBuffer], 'test-image.png', { type: 'image/png' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: expect.any(Number),
        sessionId,
        senderType: 'visitor',
        contentType: 'image',
        content: expect.stringMatching(/^\/uploads\/.+/),
        isRead: false,
      });
    });

    it('应当成功上传 JPEG 图片', async () => {
      // Minimal JPEG
      const jpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
      ]);

      const formData = new FormData();
      const file = new File([jpegBuffer], 'test-image.jpg', { type: 'image/jpeg' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.contentType).toBe('image');
      expect(result.data.fileName).toBe('test-image.jpg');
    });

    it('上传图片后应当验证消息包含文件元数据', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const formData = new FormData();
      const file = new File([pngBuffer], 'photo.png', { type: 'image/png' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.data).toHaveProperty('fileName');
      expect(result.data).toHaveProperty('fileSize');
      expect(result.data.fileName).toBe('photo.png');
      expect(result.data.fileSize).toBeGreaterThan(0);
    });
  });

  describe('视频上传测试', () => {
    it('应当成功上传 MP4 视频', async () => {
      // Minimal MP4 header (ftyp box)
      const mp4Buffer = Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
      ]);

      const formData = new FormData();
      const file = new File([mp4Buffer], 'test-video.mp4', { type: 'video/mp4' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.contentType).toBe('video');
    });

    it('应当成功上传 WebM 视频', async () => {
      // Minimal WebM file header
      const webmBuffer = Buffer.from([
        0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f,
        0x42, 0x86, 0x81, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);

      const formData = new FormData();
      const file = new File([webmBuffer], 'test-video.webm', { type: 'video/webm' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.contentType).toBe('video');
    });

    it('上传视频后应当验证消息包含文件元数据', async () => {
      const webmBuffer = Buffer.from([
        0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f,
        0x42, 0x86, 0x81, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);

      const formData = new FormData();
      const file = new File([webmBuffer], 'movie.webm', { type: 'video/webm' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.data).toHaveProperty('fileName');
      expect(result.data).toHaveProperty('fileSize');
      expect(result.data.fileName).toBe('movie.webm');
    });
  });

  describe('文件类型验证测试', () => {
    it('应当拒绝非法文件类型（如 PDF）', async () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

      const formData = new FormData();
      const file = new File([pdfBuffer], 'document.pdf', { type: 'application/pdf' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('应当拒绝文本文件', async () => {
      const textBuffer = Buffer.from('Plain text content');

      const formData = new FormData();
      const file = new File([textBuffer], 'document.txt', { type: 'text/plain' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(false);
    });
  });

  describe('文件大小限制测试', () => {
    it('应当拒绝超过图片大小限制的文件（5MB）', async () => {
      // 创建一个超过 5MB 的 buffer
      const hugeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1); // 5MB + 1 byte
      // 添加 PNG header 使其看起来像图片
      hugeBuffer[0] = 0x89;
      hugeBuffer[1] = 0x50;
      hugeBuffer[2] = 0x4e;
      hugeBuffer[3] = 0x47;

      const formData = new FormData();
      const file = new File([hugeBuffer], 'huge-image.png', { type: 'image/png' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('应当拒绝超过视频大小限制的文件（20MB）', async () => {
      // 创建一个超过 20MB 的 buffer
      const hugeBuffer = Buffer.alloc(20 * 1024 * 1024 + 1); // 20MB + 1 byte
      // 添加 WebM header
      hugeBuffer[0] = 0x1a;
      hugeBuffer[1] = 0x45;

      const formData = new FormData();
      const file = new File([hugeBuffer], 'huge-video.webm', { type: 'video/webm' });
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });
  });

  describe('错误处理', () => {
    it('当缺少文件时返回错误', async () => {
      const formData = new FormData();
      formData.append('sessionId', sessionId);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('当缺少 sessionId 时返回错误', async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      const formData = new FormData();
      const file = new File([pngBuffer], 'test.png', { type: 'image/png' });
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      expect(result.success).toBe(false);
    });
  });
});

// ==========================================
// Mark as Read API Tests
// ==========================================

describe('PUT /api/chat/read/:sessionId', () => {
  let sessionId: string;

  beforeEach(async () => {
    const response = await fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorName: 'ReadTestUser' }),
    });
    const result = await response.json();
    sessionId = result.data.id;
  });

  describe('标记消息已读', () => {
    it('应当成功标记消息为已读', async () => {
      // 先发送一条消息
      await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          contentType: 'text',
          content: 'Test message',
        }),
      });

      const response = await fetch(`${API_BASE}/read/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
      });

      const result = await response.json();

      expect(result.success).toBe(true);
    });

    it('标记已读后应当更新会话未读计数', async () => {
      // 先发送一条 staff 消息（让 visitor 有未读消息）
      // 注意：这里需要手动插入 staff 消息，因为 chat API 只允许 visitor 发送
      // 我们通过直接调用 service 来模拟 staff 发送消息
      const { sendMessage } = await import('@server/module-chat/services/chat-service');

      for (let i = 0; i < 3; i++) {
        await sendMessage({
          sessionId,
          senderType: 'staff',
          contentType: 'text',
          content: `Staff message ${i + 1}`,
        });
      }

      // 获取会话信息（检查未读数）
      const sessionResponse = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const sessionResult = await sessionResponse.json();
      const unreadCount = sessionResult.data.unreadByVisitor;
      expect(unreadCount).toBeGreaterThan(0);

      // 标记已读（visitor 标记 staff 消息为已读）
      await fetch(`${API_BASE}/read/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
      });

      // 再次获取会话信息
      const afterReadResponse = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const afterReadResult = await afterReadResponse.json();

      expect(afterReadResult.data.unreadByVisitor).toBe(0);
    });

    it('应当验证已读状态在消息中更新', async () => {
      // 发送 staff 消息（让 visitor 有未读消息）
      const { sendMessage } = await import('@server/module-chat/services/chat-service');

      await sendMessage({
        sessionId,
        senderType: 'staff',
        contentType: 'text',
        content: 'Unread staff message',
      });

      // 获取消息（未读）
      const beforeReadResponse = await fetch(
        `${API_BASE}/messages?sessionId=${encodeURIComponent(sessionId)}`
      );
      const beforeRead = await beforeReadResponse.json();
      expect(beforeRead.data[0].isRead).toBe(false);

      // 标记已读
      await fetch(`${API_BASE}/read/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
      });

      // 再次获取消息（应该已读）
      const afterReadResponse = await fetch(
        `${API_BASE}/messages?sessionId=${encodeURIComponent(sessionId)}`
      );
      const afterRead = await afterReadResponse.json();
      expect(afterRead.data[0].isRead).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('当 sessionId 不存在时应当返回成功（幂等操作）', async () => {
      const fakeSessionId = 'non-existent-session-id';
      const response = await fetch(`${API_BASE}/read/${encodeURIComponent(fakeSessionId)}`, {
        method: 'PUT',
      });

      const result = await response.json();

      // 标记已读通常是幂等操作，不存在的会话也可能返回成功
      expect(result.success).toBe(true);
    });
  });
});
