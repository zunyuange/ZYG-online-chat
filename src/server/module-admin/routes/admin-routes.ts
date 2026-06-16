/**
 * Admin Routes
 * Handles staff user management and role management API endpoints
 */

import { Hono } from 'hono';
import * as adminService from '../services/admin-service';
import { verifyAdminToken } from './admin-auth-routes';

export const adminRoutes = new Hono();

async function requireAuth(c: any, next: any) {
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

// Staff Users Management (商家用户管理)
adminRoutes.post('/staff-users', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, email, name, role, status } = body;

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码是必填项' }, 400);
    }

    const result = await adminService.createUser({ 
      username, 
      password, 
      email, 
      name, 
      role: role || 'staff',
      status: status || 'active'
    });
    
    if (result.success) {
      return c.json({ success: true, message: '商家用户创建成功', userId: result.userId }, 201);
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Admin] Create staff user error:', error);
    return c.json({ success: false, error: '创建商家用户失败' }, 500);
  }
});

adminRoutes.get('/staff-users', async (c) => {
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
    }));
    return c.json({ success: true, data: sanitizedUsers });
  } catch (error) {
    console.error('[Admin] List staff users error:', error);
    return c.json({ success: false, error: '获取商家用户列表失败' }, 500);
  }
});

adminRoutes.get('/staff-users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的用户ID' }, 400);
    }

    const user = await adminService.getUserById(id);
    if (!user) {
      return c.json({ success: false, error: '商家用户不存在' }, 404);
    }

    const sanitizedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
    };

    return c.json({ success: true, data: sanitizedUser });
  } catch (error) {
    console.error('[Admin] Get staff user error:', error);
    return c.json({ success: false, error: '获取商家用户失败' }, 500);
  }
});

adminRoutes.put('/staff-users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的用户ID' }, 400);
    }

    const body = await c.req.json();
    const { email, name, role, status, password } = body;

    const result = await adminService.updateUser(id, { email, name, role, status, password });
    
    if (result.success) {
      return c.json({ success: true, message: '商家用户更新成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Admin] Update staff user error:', error);
    return c.json({ success: false, error: '更新商家用户失败' }, 500);
  }
});

adminRoutes.delete('/staff-users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的用户ID' }, 400);
    }

    const result = await adminService.deleteUser(id);
    
    if (result.success) {
      return c.json({ success: true, message: '商家用户删除成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Admin] Delete staff user error:', error);
    return c.json({ success: false, error: '删除商家用户失败' }, 500);
  }
});

// Roles Management (角色管理)
adminRoutes.post('/roles', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, permissions } = body;

    if (!name) {
      return c.json({ success: false, error: '角色名称是必填项' }, 400);
    }

    const db = await import('@server/shared/db').then(m => m.getDb());
    const existing = await db.get('SELECT id FROM staff_groups WHERE name = ?', [name]);
    if (existing) {
      return c.json({ success: false, error: '角色名称已存在' }, 400);
    }

    const result = await db.run(
      'INSERT INTO staff_groups (name, description, permissions) VALUES (?, ?, ?)',
      [name, description || null, JSON.stringify(permissions || [])]
    );

    return c.json({ success: true, message: '角色创建成功', roleId: result.lastInsertRowid }, 201);
  } catch (error) {
    console.error('[Admin] Create role error:', error);
    return c.json({ success: false, error: '创建角色失败' }, 500);
  }
});

adminRoutes.get('/roles', async (c) => {
  try {
    const db = await import('@server/shared/db').then(m => m.getDb());
    const roles = await db.all('SELECT * FROM staff_groups ORDER BY created_at DESC');
    
    const formattedRoles = roles.map((role: any) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions ? JSON.parse(role.permissions) : [],
      created_at: role.created_at,
    }));

    return c.json({ success: true, data: formattedRoles });
  } catch (error) {
    console.error('[Admin] List roles error:', error);
    return c.json({ success: false, error: '获取角色列表失败' }, 500);
  }
});

adminRoutes.get('/roles/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的角色ID' }, 400);
    }

    const db = await import('@server/shared/db').then(m => m.getDb());
    const role = await db.get('SELECT * FROM staff_groups WHERE id = ?', [id]);
    
    if (!role) {
      return c.json({ success: false, error: '角色不存在' }, 404);
    }

    const formattedRole = {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions ? JSON.parse(role.permissions) : [],
      created_at: role.created_at,
    };

    return c.json({ success: true, data: formattedRole });
  } catch (error) {
    console.error('[Admin] Get role error:', error);
    return c.json({ success: false, error: '获取角色失败' }, 500);
  }
});

adminRoutes.put('/roles/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的角色ID' }, 400);
    }

    const body = await c.req.json();
    const { name, description, permissions } = body;

    const db = await import('@server/shared/db').then(m => m.getDb());
    
    const existing = await db.get('SELECT id FROM staff_groups WHERE name = ? AND id != ?', [name, id]);
    if (existing) {
      return c.json({ success: false, error: '角色名称已存在' }, 400);
    }

    await db.run(
      'UPDATE staff_groups SET name = ?, description = ?, permissions = ? WHERE id = ?',
      [name, description || null, JSON.stringify(permissions || []), id]
    );

    return c.json({ success: true, message: '角色更新成功' });
  } catch (error) {
    console.error('[Admin] Update role error:', error);
    return c.json({ success: false, error: '更新角色失败' }, 500);
  }
});

adminRoutes.delete('/roles/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的角色ID' }, 400);
    }

    const db = await import('@server/shared/db').then(m => m.getDb());
    
    const role = await db.get('SELECT id FROM staff_groups WHERE id = ?', [id]);
    if (!role) {
      return c.json({ success: false, error: '角色不存在' }, 404);
    }

    await db.run('DELETE FROM staff_groups WHERE id = ?', [id]);

    return c.json({ success: true, message: '角色删除成功' });
  } catch (error) {
    console.error('[Admin] Delete role error:', error);
    return c.json({ success: false, error: '删除角色失败' }, 500);
  }
});
