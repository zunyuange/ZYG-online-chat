/**
 * Authentication Routes
 * Handles login, token verification, and auth check
 */

import { Hono } from 'hono';
import {
  checkAuthRequired,
  login,
  verifyToken,
  getClientIp,
} from '../services/auth-service';

export const authRoutes = new Hono();

/**
 * GET /api/auth/check
 * Check if authentication is required for this deployment
 */
authRoutes.get('/check', async (c) => {
  const requireAuth = await checkAuthRequired();
  
  // Test database connection
  let dbStatus = 'unknown';
  let userCount = 0;
  try {
    const { listUsers } = await import('@server/module-admin/services/admin-service');
    const users = await listUsers();
    userCount = users.length;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = `error: ${error}`;
  }
  
  return c.json({
    success: true,
    requireAuth,
    dbStatus,
    userCount,
  });
});

/**
 * GET /api/auth/test-login
 * Test login credentials (for debugging)
 */
authRoutes.get('/test-login', async (c) => {
  const username = c.req.query('username');
  const password = c.req.query('password');
  
  if (!username || !password) {
    return c.json({
      success: false,
      error: 'Please provide username and password as query parameters',
    }, 400);
  }
  
  try {
    const { verifyPassword } = await import('@server/module-admin/services/admin-service');
    const user = await verifyPassword(username, password);
    
    if (user) {
      return c.json({
        success: true,
        message: 'Login successful',
        user: { id: user.id, username: user.username, name: user.name },
      });
    } else {
      return c.json({
        success: false,
        message: 'Username or password incorrect',
      });
    }
  } catch (error) {
    return c.json({
      success: false,
      message: 'Error during authentication',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!password) {
      return c.json({
        success: false,
        error: '请输入密码',
      }, 400);
    }

    const clientIp = getClientIp(c.req.raw.headers);
    const result = await login(username || '', password, clientIp);

    if (result.success) {
      return c.json({
        success: true,
        token: result.token,
        expiresAt: result.expiresAt,
        userId: result.userId,
        username: result.username,
      });
    } else {
      return c.json({
        success: false,
        error: result.error,
        remainingAttempts: result.remainingAttempts,
      }, 401);
    }
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return c.json({
      success: false,
      error: '登录失败，请重试',
    }, 500);
  }
});

/**
 * GET /api/auth/verify
 * Verify token validity
 */
authRoutes.get('/verify', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      success: false,
      valid: false,
      error: '未提供认证令牌',
    }, 401);
  }

  const token = authHeader.substring(7);
  const result = await verifyToken(token);

  if (result.valid) {
    return c.json({
      success: true,
      valid: true,
      userId: result.userId,
      username: result.username,
      businessId: result.businessId,
      businessSlug: result.businessSlug,
      businessName: result.businessName,
      role: result.role,
    });
  } else {
    return c.json({
      success: false,
      valid: false,
      error: result.error,
    }, 401);
  }
});
