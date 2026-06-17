/**
 * Admin Routes
 * Handles staff user management, role management and settings API endpoints
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
    const { username, password, email, name, role, business_id } = body;

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码是必填项' }, 400);
    }

    const result = await adminService.createUser({ username, password, email, name, role, business_id });
    
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
    const { username, password, email, name, role, status, business_id } = body;

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码是必填项' }, 400);
    }

    const result = await adminService.createUser({ 
      username, 
      password, 
      email, 
      name, 
      role: role || 'staff',
      business_id
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
      business_id: user.business_id || 0,
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

// Roles Management (角色管理) - 使用新的 roles 表
adminRoutes.post('/roles', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, permissions } = body;

    if (!name) {
      return c.json({ success: false, error: '角色名称是必填项' }, 400);
    }

    const db = await import('@server/shared/db').then(m => m.getDb());
    const existing = await db.get('SELECT id FROM roles WHERE name = ?', [name]);
    if (existing) {
      return c.json({ success: false, error: '角色名称已存在' }, 400);
    }

    const result = await db.run(
      'INSERT INTO roles (name, description, permissions, is_system, status) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, JSON.stringify(permissions || []), 0, 'active']
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
    const roles = await db.all('SELECT * FROM roles ORDER BY created_at DESC');
    
    const formattedRoles = roles.map((role: any) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions ? JSON.parse(role.permissions) : [],
      is_system: role.is_system === 1,
      status: role.status,
      created_at: role.created_at,
      updated_at: role.updated_at,
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
    const role = await db.get('SELECT * FROM roles WHERE id = ?', [id]);
    
    if (!role) {
      return c.json({ success: false, error: '角色不存在' }, 404);
    }

    const formattedRole = {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions ? JSON.parse(role.permissions) : [],
      is_system: role.is_system === 1,
      status: role.status,
      created_at: role.created_at,
      updated_at: role.updated_at,
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

    const db = await import('@server/shared/db').then(m => m.getDb());
    
    const role = await db.get('SELECT is_system FROM roles WHERE id = ?', [id]);
    if (!role) {
      return c.json({ success: false, error: '角色不存在' }, 404);
    }

    if (role.is_system === 1) {
      return c.json({ success: false, error: '系统角色不能被修改' }, 403);
    }

    const body = await c.req.json();
    const { name, description, permissions, status } = body;

    const existing = await db.get('SELECT id FROM roles WHERE name = ? AND id != ?', [name, id]);
    if (existing) {
      return c.json({ success: false, error: '角色名称已存在' }, 400);
    }

    await db.run(
      'UPDATE roles SET name = ?, description = ?, permissions = ?, status = ?, updated_at = ? WHERE id = ?',
      [name, description || null, JSON.stringify(permissions || []), status || 'active', Date.now(), id]
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
    
    const role = await db.get('SELECT is_system FROM roles WHERE id = ?', [id]);
    if (!role) {
      return c.json({ success: false, error: '角色不存在' }, 404);
    }

    if (role.is_system === 1) {
      return c.json({ success: false, error: '系统角色不能被删除' }, 403);
    }

    await db.run('DELETE FROM roles WHERE id = ?', [id]);

    return c.json({ success: true, message: '角色删除成功' });
  } catch (error) {
    console.error('[Admin] Delete role error:', error);
    return c.json({ success: false, error: '删除角色失败' }, 500);
  }
});

// Settings Management (系统设置管理)
adminRoutes.get('/settings', async (c) => {
  try {
    const db = await import('@server/shared/db').then(m => m.getDb());
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
    console.error('[Admin] Get settings error:', error);
    return c.json({ success: false, error: '获取设置失败' }, 500);
  }
});

adminRoutes.post('/settings', async (c) => {
  try {
    const body = await c.req.json();

    const db = await import('@server/shared/db').then(m => m.getDb());

    for (const [key, value] of Object.entries(body)) {
      const existing = await db.get('SELECT id FROM admin_config WHERE key = ?', [key]);
      
      if (existing) {
        await db.run(
          'UPDATE admin_config SET value = ?, updated_at = ? WHERE key = ?',
          [String(value), Date.now(), key]
        );
      } else {
        await db.run(
          'INSERT INTO admin_config (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)',
          [key, String(value), Date.now(), Date.now()]
        );
      }
    }

    return c.json({ success: true, message: '设置保存成功' });
  } catch (error) {
    console.error('[Admin] Save settings error:', error);
    return c.json({ success: false, error: '保存设置失败' }, 500);
  }
});
