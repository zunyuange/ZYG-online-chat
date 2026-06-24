/**
 * Hono server entry point
 * Main application server with CORS and error handling
 *
 * IMPORTANT: Uses CHAIN SYNTAX for proper Hono RPC type inference
 */

import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Hono } from 'hono';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiRoutes } from './module-todos/routes/todos-routes';
import { chatRoutes } from './module-chat/routes/chat-routes';
import { staffRoutes } from './module-staff/routes/staff-routes';
import { adminRoutes } from './module-admin/routes/admin-routes';
import { adminAuthRoutes } from './module-admin/routes/admin-auth-routes';
import { businessRoutes } from './module-business/routes/business-routes';
import { robotRoutes } from './module-robot/routes/robot-routes';
import { activityRoutes } from './module-activity/routes/activity-routes';

// Note: @hono/zod-openapi is installed but openAPI helper is not used in this simple setup
// If you need OpenAPI docs, you can add: import { openAPI } from '@hono/zod-openapi';

// Get project root directory for static file serving
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const uploadDir = join(projectRoot, 'data', 'uploads');

console.log('[Static] Upload directory:', uploadDir);

// MIME types for common file extensions
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.ipa': 'application/octet-stream',
  '.apk': 'application/vnd.android.package-archive',
  '.dmg': 'application/x-apple-diskimage',
};

// Create Hono app with CHAIN SYNTAX for type inference
const app = new Hono()
  // Serve uploaded files - custom handler
  .get('/uploads/:filename', (c) => {
    const filename = c.req.param('filename');
    const filepath = join(uploadDir, filename);

    if (!existsSync(filepath)) {
      console.log('[Static] File not found:', filepath);
      return c.json({ error: 'File not found' }, 404);
    }

    const ext = extname(filename).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const fileBuffer = readFileSync(filepath);
      console.log('[Static] Serving file:', filename, 'Type:', mimeType, 'Size:', fileBuffer.length);
      return new Response(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000',
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error('[Static] Error reading file:', error);
      return c.json({ error: 'Failed to read file' }, 500);
    }
  })
  // Global middleware
  .use('*', logger())
  .use('*', cors({
    origin: ['http://localhost:3010', 'http://localhost:5173'],
    credentials: true,
  }))
  // Public settings endpoint (no auth required) - MUST BE BEFORE /api routes
  .get('/api/site-settings', async (c) => {
    try {
      const db = await import('./shared/db').then(m => m.getDb());
      const configs = await db.all('SELECT key, value, description FROM admin_config');
      
      const settings: Record<string, any> = {};
      configs.forEach((config: any) => {
        settings[config.key] = {
          value: config.value,
          description: config.description,
        };
      });

      return c.json({ success: true, data: settings });
    } catch (error) {
      console.error('[Public] Get site settings error:', error);
      return c.json({ success: false, error: '获取设置失败' }, 500);
    }
  })
  // Alias for site-settings (singular form)
  .get('/api/site-setting', async (c) => {
    try {
      const db = await import('./shared/db').then(m => m.getDb());
      const configs = await db.all('SELECT key, value, description FROM admin_config');
      
      const settings: Record<string, any> = {};
      configs.forEach((config: any) => {
        settings[config.key] = {
          value: config.value,
          description: config.description,
        };
      });

      return c.json({ success: true, data: settings });
    } catch (error) {
      console.error('[Public] Get site setting error:', error);
      return c.json({ success: false, error: '获取设置失败' }, 500);
    }
  })
  // API routes
  .route('/api', apiRoutes)
  .route('/api/business', businessRoutes)
  .route('/api/chat', chatRoutes)
  .route('/api/staff', staffRoutes)
  .route('/api/robot', robotRoutes)
  .route('/api/admin', adminRoutes)
  .route('/api/admin-auth', adminAuthRoutes)
  .route('/api/activity', activityRoutes)
  // Health check
  .get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  })
  // 🔧 翻译 API 连通性诊断端点
  .get('/api/debug/translate-test', async (c) => {
    const testWord = 'hello';
    const results: Record<string, any> = {};

    // 测试 1: SimplyTranslate AI（首选推荐）
    try {
      const t1 = Date.now();
      const simpResp = await fetch('https://api.simplytranslate.ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testWord, from: 'en', to: 'zh-cn' }),
      });
      const simpData: any = await simpResp.json();
      const t2 = Date.now();
      results.simplytranslate = {
        ok: simpResp.ok,
        status: simpResp.status,
        latency_ms: t2 - t1,
        translatedText: simpData?.result || null,
      };
    } catch (err: any) {
      results.simplytranslate = { ok: false, error: err.message };
    }

    // 测试 2: MyMemory（免费 API）
    try {
      const t1 = Date.now();
      const myResp = await fetch(`https://api.mymemory.translated.net/get?q=${testWord}&langpair=en|zh-CN`);
      const myData: any = await myResp.json();
      const t2 = Date.now();
      results.mymemory = {
        ok: myResp.ok,
        status: myResp.status,
        latency_ms: t2 - t1,
        translatedText: myData?.responseData?.translatedText || null,
        error: myData?.responseDetails || null,
      };
    } catch (err: any) {
      results.mymemory = { ok: false, error: err.message };
    }

    // 测试 3: 通用外网连通性
    try {
      const t1 = Date.now();
      const cfResp = await fetch('https://cloudflare.com/cdn-cgi/trace');
      const cfText = await cfResp.text();
      const t2 = Date.now();
      results.cloudflare_connectivity = {
        ok: cfResp.ok,
        latency_ms: t2 - t1,
        colo: cfText.match(/colo=(\S+)/)?.[1] || 'unknown',
      };
    } catch (err: any) {
      results.cloudflare_connectivity = { ok: false, error: err.message };
    }

    return c.json({ success: true, data: results });
  })
  // Root endpoint
  .get('/', (c) => {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Todo & Chat API</title>
        </head>
        <body>
          <h1>Todo & Chat API Server</h1>
          <p>Server is running on port 3010</p>
          <ul>
            <li><a href="/docs">Todo API Documentation</a></li>
            <li><a href="/chat">Chat (User)</a></li>
            <li><a href="/staff">Chat (Staff)</a></li>
          </ul>
        </body>
      </html>
    `);
  });

// Error handler (must be set separately, not in chain)
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    success: false,
    error: err.message || 'Internal server error',
  }, 500);
});

// 404 handler (must be set separately, not in chain)
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not found',
  }, 404);
});

export default app;

/**
 * Export for Hono RPC type inference
 * @see src/shared/rpc-server.ts
 */
// Temporarily widen AppType to any to avoid over-strict RPC client inference
// TODO: restore to `typeof app` after RPC typings are reconciled
export type AppType = any;
