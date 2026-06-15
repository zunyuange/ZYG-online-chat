/**
 * Admin Authentication Service
 * Handles admin user login and verification
 */

import { getDb } from '@server/shared/db';

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  email: string | null;
  name: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyAdminPassword(username: string, password: string): Promise<AdminUser | null> {
  const db = getDb();
  const user = await db.get<AdminUser>('SELECT * FROM admin_users WHERE username = ? AND status = ?', [username, 'active']);
  
  if (!user) {
    return null;
  }

  const passwordHash = await hashPassword(password);
  if (user.password_hash !== passwordHash) {
    return null;
  }

  return user;
}

export async function getAdminUserById(id: number): Promise<AdminUser | null> {
  const db = getDb();
  return db.get<AdminUser>('SELECT * FROM admin_users WHERE id = ?', [id]);
}

export async function getAdminUserByUsername(username: string): Promise<AdminUser | null> {
  const db = getDb();
  return db.get<AdminUser>('SELECT * FROM admin_users WHERE username = ?', [username]);
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const db = getDb();
  return db.all<AdminUser>('SELECT * FROM admin_users ORDER BY created_at DESC');
}

export async function createAdminUser(username: string, password: string, email?: string, name?: string): Promise<{ success: boolean; error?: string; userId?: number }> {
  const db = getDb();
  
  try {
    const existing = await db.get<AdminUser>('SELECT id FROM admin_users WHERE username = ?', [username]);
    if (existing) {
      return { success: false, error: '用户名已存在' };
    }

    const passwordHash = await hashPassword(password);
    const result = await db.run(
      'INSERT INTO admin_users (username, password_hash, email, name, status) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, email || null, name || null, 'active']
    );

    return { success: true, userId: result.lastInsertRowid };
  } catch (error) {
    console.error('[AdminAuthService] Create admin user error:', error);
    return { success: false, error: '创建用户失败' };
  }
}

export async function updateAdminUser(id: number, data: { email?: string; name?: string; status?: string; password?: string }): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    const existing = await db.get<AdminUser>('SELECT id FROM admin_users WHERE id = ?', [id]);
    if (!existing) {
      return { success: false, error: '用户不存在' };
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.email !== undefined) {
      updates.push('email = ?');
      params.push(data.email || null);
    }
    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name || null);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.password !== undefined && data.password) {
      const passwordHash = await hashPassword(data.password);
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
      `UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return { success: true };
  } catch (error) {
    console.error('[AdminAuthService] Update admin user error:', error);
    return { success: false, error: '更新用户失败' };
  }
}

export async function deleteAdminUser(id: number): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    const existing = await db.get<AdminUser>('SELECT id FROM admin_users WHERE id = ?', [id]);
    if (!existing) {
      return { success: false, error: '用户不存在' };
    }

    await db.run('DELETE FROM admin_users WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('[AdminAuthService] Delete admin user error:', error);
    return { success: false, error: '删除用户失败' };
  }
}