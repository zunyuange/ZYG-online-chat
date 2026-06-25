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
import { businessRoutes } from './module-business/routes/business-routes';
import { businessDomainRoutes } from './module-business/routes/business-domain-routes';
import { authRoutes } from './module-auth/routes/auth-routes';
import { adminRoutes } from './module-admin/routes/admin-routes';
import { adminAuthRoutes, initAdminAuth } from './module-admin/routes/admin-auth-routes';
import { robotRoutes } from './module-robot/routes/robot-routes';
import { faqRoutes } from './module-faq/routes/faq-routes';
import { evaluationRoutes } from './module-evaluation/routes/evaluation-routes';
import { initializeD1Db, getDb } from './shared/db';
import { initializeR2Storage } from './shared/storage';
import { initBarkService, setStaffUrlFromHost } from './services/bark-service';
import { initAuthService } from './module-auth/services/auth-service';
import { initTranslateService } from './services/translate-service';
import { createDomainRouter, setDbGetter } from './middleware/domain-router';
import { initTokenEncryption } from './shared/token-crypto';
import { initAIRouter } from './services/ai-router';
import { startSSEHeartbeat } from './module-chat/services/sse-service';
import { setPlatformCFConfig } from './services/domain-service';

// Cloudflare Workers bindings
interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
  AI?: any; // Cloudflare Workers AI binding
  // Environment variables
  BARK_KEY?: string;
  BARK_API?: string;
  STAFF_URL_BASE?: string;
  ENCRYPTION_KEY?: string; // 🆕 Token encryption key
  // Auth configuration
  REQUIRE_AUTH?: string;
  STAFF_PASSWORD?: string;
  JWT_SECRET?: string;
  ADMIN_JWT_SECRET?: string;
  // 🆕 Cloudflare 平台级配置（用于 Workers 自定义域管理）
  CF_API_TOKEN?: string;     // 平台级 API Token (Workers:Edit, Zone:Read)
  CF_ACCOUNT_ID?: string;    // Cloudflare Account ID
  CF_ZONE_ID?: string;       // zygmail.icu 的 Zone ID
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
let initError: Error | null = null;

async function ensureInitialized(env: Env): Promise<void> {
  if (initialized) return;
  if (initError) {
    throw initError;
  }

  try {
    // Initialize D1 database (this also initializes schema)
    console.log('[Worker] Initializing D1 database...');
    await initializeD1Db(env.DB);
    console.log('[Worker] D1 database initialized');

    // Initialize R2 storage if available
    if (env.BUCKET) {
      console.log('[Worker] Initializing R2 storage...');
      initializeR2Storage(env.BUCKET);
      console.log('[Worker] R2 storage initialized');
    }

    // Initialize Bark service with environment variables
    // Note: STAFF_URL_BASE is now auto-detected from request host per-request
    console.log('[Worker] Initializing Bark service...');
    initBarkService({
      BARK_KEY: env.BARK_KEY,
      BARK_API: env.BARK_API,
    });
    console.log('[Worker] Bark service initialized');

    // Initialize Auth service
    console.log('[Worker] Initializing Auth service...');
    initAuthService({
      REQUIRE_AUTH: env.REQUIRE_AUTH,
      STAFF_PASSWORD: env.STAFF_PASSWORD,
      JWT_SECRET: env.JWT_SECRET,
    });
    console.log('[Worker] Auth service initialized');

    // Initialize Admin Auth service
    console.log('[Worker] Initializing Admin Auth service...');
    initAdminAuth({
      ADMIN_JWT_SECRET: env.ADMIN_JWT_SECRET,
    });
    console.log('[Worker] Admin Auth service initialized');

    // Initialize Cloudflare AI translation service
    if (env.AI) {
      console.log('[Worker] Initializing Cloudflare AI translation...');
      initTranslateService(env.AI);
      console.log('[Worker] Cloudflare AI translation initialized');
    } else {
      console.warn('[Worker] Cloudflare AI binding not available, AI translation will be skipped');
    }

    // 🆕 Initialize Token Encryption
    console.log('[Worker] Initializing token encryption...');
    initTokenEncryption(env.ENCRYPTION_KEY);
    console.log('[Worker] Token encryption initialized');

    // 🆕 Initialize AI Router
    console.log('[Worker] Initializing AI Router...');
    initAIRouter(env.AI);
    console.log('[Worker] AI Router initialized');

    // 🆕 Initialize platform CF config for Workers custom domain registration
    if (env.CF_API_TOKEN && env.CF_ACCOUNT_ID && env.CF_ZONE_ID) {
      console.log('[Worker] Setting up platform CF config for Workers domain management...');
      setPlatformCFConfig({
        apiToken: env.CF_API_TOKEN,
        accountId: env.CF_ACCOUNT_ID,
        zoneId: env.CF_ZONE_ID,
      });
      console.log('[Worker] Platform CF config initialized');
    } else {
      console.log('[Worker] Platform CF config not fully configured, Workers custom domain registration will be skipped');
      setPlatformCFConfig(null);
    }

    // 🆕 Set up domain router database getter
    setDbGetter(getDb);

    // 🆕 Start SSE heartbeat (Node.js only, safe to call in Worker - checks env)
    startSSEHeartbeat();

    initialized = true;
    console.log('[Worker] All services initialized successfully');
  } catch (error) {
    initError = error instanceof Error ? error : new Error(String(error));
    console.error('[Worker] Initialization failed:', initError);
    throw initError;
  }
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

// Auto-detect staff URL from request host (runs on every request)
// This dynamically constructs STAFF_URL_BASE so it follows the project name
// and custom domain settings automatically:
//   - Custom domain: https://{name}.{custom}.workers.dev/staff
//   - Default domain: https://{name}.workers.dev/staff
app.use('*', async (c, next) => {
  const host = c.req.header('host');
  if (host) {
    setStaffUrlFromHost(host);
  }
  await next();
});

// Set correct Content-Type with UTF-8 encoding for JSON responses
app.use('*', async (c, next) => {
  await next();
  const res = c.res;
  const contentType = res.headers.get('Content-Type');
  if (contentType && contentType.includes('application/json')) {
    res.headers.set('Content-Type', 'application/json; charset=utf-8');
  }
});

// 🆕 Domain Router - 自动从 Host 头识别商家（三级子域名 / 自定义域名 / URL参数兜底）
const domainRouter = createDomainRouter();
app.use('*', domainRouter);

// Public settings endpoint (no auth required) - MUST BE BEFORE /api routes
app.get('/api/site-settings', async (c) => {
  try {
    console.log('[Public] Getting site settings...');
    const db = getDb();
    const configs = await db.all('SELECT key, value, description FROM admin_config');
    
    const settings: Record<string, any> = {};
    configs.forEach((config: any) => {
      settings[config.key] = {
        value: config.value,
        description: config.description,
      };
    });

    console.log('[Public] Site settings retrieved successfully');
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.error('[Public] Get site settings error:', error);
    return c.json({ success: false, error: '获取设置失败', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Alias for site-settings (singular form)
app.get('/api/site-setting', async (c) => {
  try {
    console.log('[Public] Getting site setting (singular)...');
    const db = getDb();
    const configs = await db.all('SELECT key, value, description FROM admin_config');
    
    const settings: Record<string, any> = {};
    configs.forEach((config: any) => {
      settings[config.key] = {
        value: config.value,
        description: config.description,
      };
    });

    console.log('[Public] Site setting (singular) retrieved successfully');
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.error('[Public] Get site setting error:', error);
    return c.json({ success: false, error: '获取设置失败', details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// API routes
app.route('/api', apiRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/staff', staffRoutes);
app.route('/api/business', businessRoutes);
app.route('/api/business/domains', businessDomainRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/admin-auth', adminAuthRoutes);
app.route('/api/robot', robotRoutes);
app.route('/api/faq', faqRoutes);
app.route('/api/evaluation', evaluationRoutes);

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
    try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize database
    await ensureInitialized(env);

    // ★ 子域名/自定义域名访问根路径 → 重定向到 /chat
    //   让 domainRouter 中间件自动识别商家归属
    if (path === '/' || path === '') {
      const host = (request.headers.get('host') || '').toLowerCase();
      const hostname = host.split(':')[0];
      // 排除平台主域名和 workers.dev 域名（它们仍走默认首页）
      if (hostname &&
          hostname !== 'zygonlinechat.zygmail.icu' &&
          hostname !== 'www.zygonlinechat.zygmail.icu' &&
          !hostname.endsWith('.workers.dev')) {
        return Response.redirect(new URL('/chat', url.origin), 302);
      }
    }

    // Handle API routes through Hono
    if (path.startsWith('/api/') || path === '/health' || path.startsWith('/uploads/')) {
      return app.fetch(request, env, ctx);
    }

    // For SPA routes (chat, staff, stafflogin, adminlogin, admin, todo, docs), serve the root index
    const isSpaRoute = path === '/chat' || path === '/staff' || path === '/stafflogin' || path === '/adminlogin' || path === '/admin' || path === '/todo' || path === '/docs' ||
        path.startsWith('/chat/') || path.startsWith('/staff/') || path.startsWith('/stafflogin/') || path.startsWith('/adminlogin/') || path.startsWith('/admin/') || path.startsWith('/docs/');

    // ASSETS is injected by wrangler for Workers Sites
    if (env.ASSETS) {
      // For SPA routes, serve root (/) which contains the SPA
      if (isSpaRoute) {
        try {
          // 🔧 使用主域名获取静态资源，避免子域名触发循环重定向导致 522
          // 子域名下 new URL('/', url.origin) 的请求会被 Worker 再次拦截并返回 302 重定向，形成死循环
          const reqHost = (request.headers.get('host') || '').toLowerCase();
          const reqHostname = reqHost.split(':')[0];
          const isSubdomain = reqHostname &&
            reqHostname !== 'zygonlinechat.zygmail.icu' &&
            reqHostname !== 'www.zygonlinechat.zygmail.icu' &&
            !reqHostname.endsWith('.workers.dev');
          const assetOrigin = isSubdomain ? 'https://zygonlinechat.zygmail.icu' : url.origin;
          const rootRequest = new Request(new URL('/', assetOrigin), request);
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
    } catch (err) {
      console.error('[Worker] FATAL fetch error:', err instanceof Error ? err.message : String(err), err instanceof Error ? err.stack : '');
      return new Response(JSON.stringify({ success: false, error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

/**
 * Export for type inference
 */
// Temporarily widen AppType to any to avoid over-strict RPC client inference
// TODO: restore to `typeof app` after RPC typings are reconciled
export type AppType = any;
