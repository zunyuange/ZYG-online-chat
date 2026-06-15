/**
 * Admin Routes
 * Handles staff user management API endpoints
 */

import { Hono } from 'hono';
import * as adminService from '../services/admin-service';
import { verifyToken } from '@server/module-auth/services/auth-service';

export const adminRoutes = new Hono();

async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未提供认证令牌' }, 401);
  }

  const token = authHeader.substring(7);
  const result = await verifyToken(token);

  if (!result.valid) {
    return c.json({ success: false, error: result.error || 'Token 无效' }, 401);
  }

  await next();
}

adminRoutes.use('*', requireAuth);

adminRoutes.post('/users', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, email, name, role } = body;

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码是必填项' }, 400);
    }

    const result = await adminService.createUser({ username, password, email, name, role });
    
    if (result.success) {
      return c.json({ success: true, message: '用户创建成功', userId: result.userId }, 201);
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Admin] Create user error:', error);
    return c.json({ success: false, error: '创建用户失败' }, 500);
  }
});

adminRoutes.get('/users', async (c) => {
  try {
    const users = await adminService.listUsers();
    const sanitizedUsers = users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));
    return c.json({ success: true, data: sanitizedUsers });
  } catch (error) {
    console.error('[Admin] List users error:', error);
    return c.json({ success: false, error: '获取用户列表失败' }, 500);
  }
});

adminRoutes.get('/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的用户ID' }, 400);
    }

    const user = await adminService.getUserById(id);
    if (!user) {
      return c.json({ success: false, error: '用户不存在' }, 404);
    }

    const sanitizedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return c.json({ success: true, data: sanitizedUser });
  } catch (error) {
    console.error('[Admin] Get user error:', error);
    return c.json({ success: false, error: '获取用户失败' }, 500);
  }
});

adminRoutes.put('/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的用户ID' }, 400);
    }

    const body = await c.req.json();
    const { email, name, role, status, password } = body;

    const result = await adminService.updateUser(id, { email, name, role, status, password });
    
    if (result.success) {
      return c.json({ success: true, message: '用户更新成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Admin] Update user error:', error);
    return c.json({ success: false, error: '更新用户失败' }, 500);
  }
});

adminRoutes.delete('/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的用户ID' }, 400);
    }

    const result = await adminService.deleteUser(id);
    
    if (result.success) {
      return c.json({ success: true, message: '用户删除成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Admin] Delete user error:', error);
    return c.json({ success: false, error: '删除用户失败' }, 500);
  }
});
