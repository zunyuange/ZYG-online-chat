/**
 * Node.js production entry point
 * Initializes database and storage, then starts HTTP server
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { config } from 'dotenv';
import { initializeNodeDb } from './shared/db';
import { initializeNodeStorage } from './shared/storage';
import { apiRoutes } from './module-todos/routes/todos-routes';
import { chatRoutes } from './module-chat/routes/chat-routes';
import { staffRoutes } from './module-staff/routes/staff-routes';
import { authRoutes } from './module-auth/routes/auth-routes';
import { initAuthService } from './module-auth/services/auth-service';

// Load environment variables from .env.local, .env
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
config({ path: join(projectRoot, '.env.local') });
config({ path: join(projectRoot, '.env') });

const distDir = join(projectRoot, 'dist');
const uploadDir = join(projectRoot, 'data', 'uploads');
const port = parseInt(process.env.PORT || '3010', 10);

// Ensure data directories exist
if (!existsSync(join(projectRoot, 'data'))) {
  mkdirSync(join(projectRoot, 'data'), { recursive: true });
}

// Create Hono app for Node.js production
const app = new Hono();

// Static file serving for uploads
app.get('/uploads/:filename', (c) => {
  const filename = c.req.param('filename');
  const filepath = join(uploadDir, filename);

  // Security: prevent directory traversal
  if (filename.includes('..') || filename.includes('/')) {
    return c.json({ error: 'Invalid filename' }, 400);
  }

  if (!existsSync(filepath)) {
    return c.json({ error: 'File not found' }, 404);
  }

  const fileBuffer = readFileSync(filepath);
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // MIME types
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
    pdf: 'application/pdf',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    csv: 'text/csv',
    zip: 'application/zip',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  credentials: true,
}));

// API routes
app.route('/api', apiRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/staff', staffRoutes);
app.route('/api/auth', authRoutes);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Static file serving for SPA (dist folder)
app.use('*', serveStatic({ root: distDir }));

// SPA fallback - serve index.html for non-API routes
app.notFound(async (c) => {
  const path = c.req.path;
  if (path.startsWith('/api/') || path.startsWith('/uploads/')) {
    return c.json({ success: false, error: 'Not found' }, 404);
  }
  const indexPath = join(distDir, 'index.html');
  if (existsSync(indexPath)) {
    return c.html(readFileSync(indexPath, 'utf-8'));
  }
  return c.json({ success: false, error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ success: false, error: err.message || 'Internal server error' }, 500);
});

// Initialize and start server
async function start(): Promise<void> {
  console.log('[Node] Initializing database...');
  await initializeNodeDb();
  console.log('[Node] Database initialized');

  console.log('[Node] Initializing storage at:', uploadDir);
  initializeNodeStorage(uploadDir);
  console.log('[Node] Storage initialized');

  // Initialize Auth service from environment variables
  initAuthService({
    STAFF_PASSWORD: process.env.STAFF_PASSWORD,
    REQUIRE_AUTH: process.env.REQUIRE_AUTH,
    JWT_SECRET: process.env.JWT_SECRET,
  });
  console.log('[Node] Auth service initialized');

  console.log('[Node] Starting server...');
  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`\n🚀 Server running at http://localhost:${port}`);
  console.log(`   - User chat: http://localhost:${port}/chat`);
  console.log(`   - Staff panel: http://localhost:${port}/staff`);
  console.log(`   - Health check: http://localhost:${port}/health\n`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
