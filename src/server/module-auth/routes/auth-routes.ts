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
authRoutes.get('/check', (c) => {
  const requireAuth = checkAuthRequired();
  return c.json({
    success: true,
    requireAuth,
  });
});

/**
 * POST /api/auth/login
 * Login with password
 */
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { password } = body;

    if (!password) {
      return c.json({
        success: false,
        error: '请输入密码',
      }, 400);
    }

    const clientIp = getClientIp(c.req.raw.headers);
    const result = await login(password, clientIp);

    if (result.success) {
      return c.json({
        success: true,
        token: result.token,
        expiresAt: result.expiresAt,
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
    });
  } else {
    return c.json({
      success: false,
      valid: false,
      error: result.error,
    }, 401);
  }
});
