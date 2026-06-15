/**
 * Cloudflare Workers entry point
 * Handles D1 database and R2 storage initialization
 */

import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Hono } from 'hono';
import type { D1Database, R2Bucket, Fetcher } from '@cloudflare/workers-types';
import { apiRoutes } from './module-todos/routes/todos-routes';
import { chatRoutes } from './module-chat/routes/chat-routes';
import { staffRoutes } from './module-staff/routes/staff-routes';
import { authRoutes } from './module-auth/routes/auth-routes';
import { initializeD1Db } from './shared/db';
import { initializeR2Storage } from './shared/storage';
import { initBarkService } from './services/bark-service';
import { initAuthService } from './module-auth/services/auth-service';

// Cloudflare Workers bindings
interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
  // Environment variables
  BARK_KEY?: string;
  BARK_API?: string;
  STAFF_URL_BASE?: string;
  // Auth configuration
  REQUIRE_AUTH?: string;
  STAFF_PASSWORD?: string;
  JWT_SECRET?: string;
}

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
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ipa': 'application/octet-stream',
  '.apk': 'application/vnd.android.package-archive',
  '.dmg': 'application/x-apple-diskimage',
};

// Create Hono app with Cloudflare Workers bindings
const app = new Hono<{ Bindings: Env }>();

// Initialize on first request
let initialized = false;

async function ensureInitialized(env: Env): Promise<void> {
  if (initialized) return;

  // Initialize D1 database (this also initializes schema)
  await initializeD1Db(env.DB);

  // Initialize R2 storage if available
  if (env.BUCKET) {
    initializeR2Storage(env.BUCKET);
  }

  // Initialize Bark service with environment variables
  initBarkService({
    BARK_KEY: env.BARK_KEY,
    BARK_API: env.BARK_API,
    STAFF_URL_BASE: env.STAFF_URL_BASE,
  });

  // Initialize Auth service
  initAuthService({
    REQUIRE_AUTH: env.REQUIRE_AUTH,
    STAFF_PASSWORD: env.STAFF_PASSWORD,
    JWT_SECRET: env.JWT_SECRET,
  });

  initialized = true;
  console.log('[Worker] Initialized D1 database, R2 storage, Bark service, and Auth service');
}

// Serve uploaded files from R2
app.get('/uploads/:filename', async (c) => {
  const filename = c.req.param('filename');

  // If R2 bucket is available, serve from R2
  if (c.env.BUCKET) {
    const object = await c.env.BUCKET.get(filename);
    if (!object) {
      return c.json({ error: 'File not found' }, 404);
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeType = MIME_TYPES[`.${ext}`] || 'application/octet-stream';

    // Convert to ArrayBuffer for Response compatibility
    const arrayBuffer = await object.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000',
        'Content-Length': object.size.toString(),
      },
    });
  }

  return c.json({ error: 'Storage not configured' }, 500);
});

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*', // Allow all origins in production
  credentials: true,
}));

// Initialize before API routes
app.use('*', async (c, next) => {
  await ensureInitialized(c.env);
  await next();
});

// API routes
app.route('/api', apiRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/staff', staffRoutes);
app.route('/api/auth', authRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString(), env: 'cloudflare-workers' });
});

// Test Bark API endpoint
app.get('/test-bark', async (c) => {
  const barkKey = c.env.BARK_KEY;
  const barkApi = c.env.BARK_API || 'https://api.day.app';

  if (!barkKey) {
    return c.json({ error: 'BARK_KEY not configured' });
  }

  try {
    const testUrl = `${barkApi}/${barkKey}/Test/Hello%20from%20Workers?sound=minuet`;
    console.log('[TestBark] Fetching:', testUrl);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Cloudflare-Workers-Chat/1.0',
      },
    });

    const text = await response.text();
    console.log('[TestBark] Response:', response.status, text);

    return c.json({
      success: true,
      status: response.status,
      body: text,
      url: `${barkApi}/${barkKey.substring(0, 4)}***...`,
    });
  } catch (error) {
    console.error('[TestBark] Error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({
    success: false,
    error: err.message || 'Internal server error',
  }, 500);
});

// 404 handler for API routes only
app.notFound((c) => {
  // Only return JSON 404 for API routes
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/uploads/')) {
    return c.json({
      success: false,
      error: 'Not found',
    }, 404);
  }
  // For other routes, return null to let the default handler take over
  return new Response(null, { status: 404 });
});

// Export the Hono app
export { app };

// Default export for Workers - handles both API and static assets
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize database
    await ensureInitialized(env);

    // Handle API routes through Hono
    if (path.startsWith('/api/') || path === '/health' || path.startsWith('/uploads/')) {
      return app.fetch(request, env, ctx);
    }

    // For SPA routes (chat, staff, todo), serve the root index
    const isSpaRoute = path === '/chat' || path === '/staff' || path === '/todo' ||
        path.startsWith('/chat/') || path.startsWith('/staff/');

    // ASSETS is injected by wrangler for Workers Sites
    if (env.ASSETS) {
      // For SPA routes, serve root (/) which contains the SPA
      if (isSpaRoute) {
        try {
          const rootRequest = new Request(new URL('/', url.origin), request);
          const rootResponse = await env.ASSETS.fetch(rootRequest);
          if (rootResponse && (rootResponse.status === 200 || rootResponse.status === 304)) {
            return rootResponse;
          }
        } catch (e) {
          // Continue to fallback
        }
      } else {
        // For other static assets, try to serve directly
        try {
          const assetResponse = await env.ASSETS.fetch(request);
          if (assetResponse && (assetResponse.status === 200 || assetResponse.status === 304)) {
            return assetResponse;
          }
        } catch (e) {
          // Continue to fallback
        }
      }
    }

    // Fallback to Hono for other routes
    return app.fetch(request, env, ctx);
  },
};

/**
 * Export for type inference
 */
export type AppType = typeof app;
