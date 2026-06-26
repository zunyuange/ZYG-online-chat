/**
 * Admin Service
 * Handles staff user management (CRUD operations)
 */

import { getDb } from '@server/shared/db';
import { hashPassword } from '@server/shared/crypto';

export interface StaffUser {
  id: number;
  business_id: number;
  business_slug: string | null;
  business_name: string | null;
  username: string;
  password_hash: string;
  email: string | null;
  name: string | null;
  role: string;
  role_id: number | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  name?: string;
  role?: string;
  role_id?: number | null;
  business_id?: number;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: string;
  role_id?: number | null;
  status?: string;
  password?: string;
}

export async function createUser(input: CreateUserInput): Promise<{ success: boolean; error?: string; userId?: number }> {
  const db = getDb();
  
  try {
    const existing = await db.get<StaffUser>('SELECT id FROM staff_users WHERE username = ?', [input.username]);
    if (existing) {
      return { success: false, error: '用户名已存在' };
    }

    const passwordHash = await hashPassword(input.password);
    
    // Generate business_slug for new business users
    let businessSlug: string | null = null;
    let businessName: string | null = null;
    let finalBusinessId = input.business_id || 0;
    
    // For new business owner accounts (no business_id specified or business_id = 0)
    if (!input.business_id || input.business_id === 0) {
      finalBusinessId = 0;
      // Generate a unique business_slug
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        let slug = '';
        for (let i = 0; i < 8; i++) {
          slug += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const existingSlug = await db.get('SELECT id FROM staff_users WHERE business_slug = ?', [slug]);
        if (!existingSlug) {
          businessSlug = slug;
          break;
        }
        attempts++;
      }
      if (!businessSlug) {
        return { success: false, error: '无法生成唯一的商家标识' };
      }
      businessName = input.name || input.username;
    }
    
    const result = await db.run(
      'INSERT INTO staff_users (username, password_hash, email, name, role, role_id, business_id, business_slug, business_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [input.username, passwordHash, input.email || null, input.name || null, input.role || 'staff', input.role_id ?? null, finalBusinessId, businessSlug, businessName, 'active', Date.now(), Date.now()]
    );

    return { success: true, userId: result.lastInsertRowid };
  } catch (error) {
    console.error('[AdminService] Create user error:', error);
    return { success: false, error: '创建用户失败' };
  }
}

export async function getUserById(id: number): Promise<StaffUser | null> {
  const db = getDb();
  return db.get<StaffUser>('SELECT * FROM staff_users WHERE id = ?', [id]);
}

export async function getUserByUsername(username: string): Promise<StaffUser | null> {
  const db = getDb();
  return db.get<StaffUser>('SELECT * FROM staff_users WHERE username = ?', [username]);
}

export async function listUsers(): Promise<StaffUser[]> {
  const db = getDb();
  return db.all<StaffUser>('SELECT * FROM staff_users ORDER BY created_at DESC');
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    const existing = await db.get<StaffUser>('SELECT id FROM staff_users WHERE id = ?', [id]);
    if (!existing) {
      return { success: false, error: '用户不存在' };
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.email !== undefined) {
      updates.push('email = ?');
      params.push(input.email || null);
    }
    if (input.name !== undefined) {
      updates.push('name = ?');
      params.push(input.name || null);
    }
    if (input.role !== undefined) {
      updates.push('role = ?');
      params.push(input.role);
    }
    if (input.role_id !== undefined) {
      updates.push('role_id = ?');
      params.push(input.role_id || null);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }
    if (input.password !== undefined && input.password) {
      const passwordHash = await hashPassword(input.password);
      updates.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (updates.length === 0) {
      return { success: true };
    }

    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    await db.run(
      `UPDATE staff_users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return { success: true };
  } catch (error) {
    console.error('[AdminService] Update user error:', error);
    return { success: false, error: '更新用户失败' };
  }
}

export async function deleteUser(id: number): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    const existing = await db.get<StaffUser>('SELECT id FROM staff_users WHERE id = ?', [id]);
    if (!existing) {
      return { success: false, error: '用户不存在' };
    }

    await db.run('DELETE FROM staff_users WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('[AdminService] Delete user error:', error);
    return { success: false, error: '删除用户失败' };
  }
}

export async function getRolePermissions(roleId: number | null): Promise<string[]> {
  if (!roleId) return [];
  const db = getDb();
  const role = await db.get<{ permissions: string }>(
    'SELECT permissions FROM roles WHERE id = ? AND status = ?',
    [roleId, 'active']
  );
  if (!role) return [];
  try {
    return JSON.parse(role.permissions);
  } catch {
    return [];
  }
}

export async function getUserWithPermissions(userId: number): Promise<(StaffUser & { permissions: string[] }) | null> {
  const db = getDb();
  const user = await db.get<StaffUser>(
    'SELECT su.* FROM staff_users su WHERE su.id = ?',
    [userId]
  );
  if (!user) return null;
  const permissions = await getRolePermissions(user.role_id);
  return { ...user, permissions };
}

export async function verifyPassword(username: string, password: string): Promise<StaffUser | null> {
  const db = getDb();
  console.log('[AdminService] verifyPassword called for username:', username);
  
  // Allow login for users with status 'active' or empty status (backward compatibility)
  const user = await db.get<StaffUser>(
    "SELECT * FROM staff_users WHERE username = ? AND (status = ? OR status IS NULL OR status = '')", 
    [username, 'active']
  );
  
  if (!user) {
    console.log('[AdminService] User not found:', username);
    return null;
  }

  console.log('[AdminService] User found:', user.username);
  
  const passwordHash = await hashPassword(password);
  console.log('[AdminService] Input password hash:', passwordHash);
  console.log('[AdminService] Stored password hash:', user.password_hash);
  
  if (user.password_hash !== passwordHash) {
    console.log('[AdminService] Password mismatch');
    return null;
  }

  console.log('[AdminService] Password verified successfully');
  return user;
}

export async function getOnlineStaffCount(): Promise<number> {
  const db = getDb();
  const now = Date.now();
  const onlineThreshold = 5 * 60 * 1000;
  
  const result = await db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM staff_users 
     WHERE (role = 'staff' OR role = 'admin') AND status = 'active' 
     AND last_active IS NOT NULL AND last_active > ?`,
    [now - onlineThreshold]
  );
  
  return result?.count || 0;
}

export async function updateStaffLastActive(staffId: number): Promise<void> {
  const db = getDb();
  await db.run(
    'UPDATE staff_users SET last_active = ? WHERE id = ?',
    [Date.now(), staffId]
  );
}

export async function getStaffWithOnlineStatus(): Promise<(StaffUser & { isOnline: boolean })[]> {
  const db = getDb();
  const now = Date.now();
  const onlineThreshold = 5 * 60 * 1000;
  
  const users = await db.all<StaffUser & { last_active: number | null }>(
    'SELECT *, last_active FROM staff_users WHERE role IN (?, ?) ORDER BY created_at DESC',
    ['staff', 'admin']
  );
  
  return users.map(user => ({
    ...user,
    isOnline: user.last_active !== null && user.last_active > now - onlineThreshold,
  }));
}
