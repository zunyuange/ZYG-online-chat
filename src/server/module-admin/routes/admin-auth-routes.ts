/**
 * Admin Authentication Routes
 * Handles admin login and verification
 */

import { Hono } from 'hono';
import * as adminAuthService from '../services/admin-auth-service';
import { getClientIp } from '@server/module-auth/services/auth-service';

// Configuration
let _jwtSecret: string = 'default-admin-secret-change-me';

// Token expiration: 7 days in seconds
const TOKEN_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

// IP Rate Limiting: 5 attempts per 10 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

const ipRateLimit = new Map<string, RateLimitEntry>();

interface AdminTokenPayload {
  role: 'admin';
  userId: number;
  username: string;
  iat: number;
  exp: number;
}

export function initAdminAuth(env: { ADMIN_JWT_SECRET?: string }): void {
  if (env.ADMIN_JWT_SECRET) {
    _jwtSecret = env.ADMIN_JWT_SECRET;
  }
}

function base64urlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function simpleHash(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  const signatureArray = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }
  return base64urlEncode(binary);
}

async function generateAdminToken(userId: number, username: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminTokenPayload = {
    role: 'admin',
    userId,
    username,
    iat: now,
    exp: now + TOKEN_EXPIRATION_SECONDS,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));

  const message = `${headerB64}.${payloadB64}`;
  const signature = await simpleHash(message, _jwtSecret);

  return `${message}.${signature}`;
}

async function verifyAdminTokenSignature(token: string): Promise<AdminTokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const message = `${headerB64}.${payloadB64}`;
    const expectedSignature = await simpleHash(message, _jwtSecret);

    if (signatureB64 !== expectedSignature) {
      return null;
    }

    const payloadJson = base64urlDecode(payloadB64);
    const payload: AdminTokenPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    if (payload.role !== 'admin') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function isRateLimited(ip: string): boolean {
  const entry = ipRateLimit.get(ip);
  if (!entry) return false;

  const now = Date.now();

  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    ipRateLimit.delete(ip);
    return false;
  }

  return entry.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const entry = ipRateLimit.get(ip);
  const now = Date.now();

  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    ipRateLimit.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count++;
  }
}

function getRemainingAttempts(ip: string): number {
  const entry = ipRateLimit.get(ip);
  if (!entry) return RATE_LIMIT_MAX_ATTEMPTS;

  const now = Date.now();
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    return RATE_LIMIT_MAX_ATTEMPTS;
  }

  return Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - entry.count);
}

export const adminAuthRoutes = new Hono();

export interface AdminVerifyResult {
  valid: boolean;
  error?: string;
  userId?: number;
  username?: string;
}

export async function verifyAdminToken(token: string): Promise<AdminVerifyResult> {
  const payload = await verifyAdminTokenSignature(token);
  if (!payload) {
    return { valid: false, error: 'Token 无效或已过期' };
  }

  return { valid: true, userId: payload.userId, username: payload.username };
}

async function requireAdminAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未提供认证令牌' }, 401);
  }

  const token = authHeader.substring(7);
  const result = await verifyAdminToken(token);

  if (!result.valid) {
    return c.json({ success: false, error: result.error || 'Token 无效' }, 401);
  }

  await next();
}

adminAuthRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码是必填项' }, 400);
    }

    const clientIp = getClientIp(c.req.headers);

    if (isRateLimited(clientIp)) {
      return c.json({
        success: false,
        error: '尝试次数过多，请 10 分钟后重试',
        remainingAttempts: 0,
      });
    }

    const user = await adminAuthService.verifyAdminPassword(username, password);

    if (user) {
      const token = await generateAdminToken(user.id, user.username);
      return c.json({
        success: true,
        token,
        expiresAt: Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION_SECONDS,
        userId: user.id,
        username: user.username,
      });
    }

    recordFailedAttempt(clientIp);
    return c.json({
      success: false,
      error: '用户名或密码错误',
      remainingAttempts: getRemainingAttempts(clientIp),
    });
  } catch (error) {
    console.error('[AdminAuth] Login error:', error);
    return c.json({ success: false, error: '登录失败' }, 500);
  }
});

adminAuthRoutes.post('/verify', async (c) => {
  try {
    const body = await c.req.json();
    const { token } = body;

    if (!token) {
      return c.json({ success: false, error: 'Token 是必填项' }, 400);
    }

    const result = await verifyAdminToken(token);

    if (result.valid) {
      return c.json({ success: true, userId: result.userId, username: result.username });
    } else {
      return c.json({ success: false, error: result.error }, 401);
    }
  } catch (error) {
    console.error('[AdminAuth] Verify error:', error);
    return c.json({ success: false, error: '验证失败' }, 500);
  }
});

adminAuthRoutes.post('/check', async (c) => {
  return c.json({ success: true, requireAuth: true });
});

adminAuthRoutes.use('/users/*', requireAdminAuth);

adminAuthRoutes.get('/users', async (c) => {
  try {
    const users = await adminAuthService.listAdminUsers();
    const sanitizedUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));
    return c.json({ success: true, data: sanitizedUsers });
  } catch (error) {
    console.error('[AdminAuth] List users error:', error);
    return c.json({ success: false, error: '获取用户列表失败' }, 500);
  }
});

adminAuthRoutes.post('/users', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, email, name } = body;

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码是必填项' }, 400);
    }

    const result = await adminAuthService.createAdminUser(username, password, email, name);
    
    if (result.success) {
      return c.json({ success: true, message: '用户创建成功', userId: result.userId }, 201);
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[AdminAuth] Create user error:', error);
    return c.json({ success: false, error: '创建用户失败' }, 500);
  }
});

adminAuthRoutes.put('/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的用户ID' }, 400);
    }

    const body = await c.req.json();
    const { email, name, status, password } = body;

    const result = await adminAuthService.updateAdminUser(id, { email, name, status, password });
    
    if (result.success) {
      return c.json({ success: true, message: '用户更新成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[AdminAuth] Update user error:', error);
    return c.json({ success: false, error: '更新用户失败' }, 500);
  }
});

adminAuthRoutes.delete('/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的用户ID' }, 400);
    }

    const result = await adminAuthService.deleteAdminUser(id);
    
    if (result.success) {
      return c.json({ success: true, message: '用户删除成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[AdminAuth] Delete user error:', error);
    return c.json({ success: false, error: '删除用户失败' }, 500);
  }
});