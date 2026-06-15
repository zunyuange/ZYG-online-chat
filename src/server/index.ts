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
  // API routes
  .route('/api', apiRoutes)
  .route('/api/chat', chatRoutes)
  .route('/api/staff', staffRoutes)
  // Health check
  .get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
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
export type AppType = typeof app;
