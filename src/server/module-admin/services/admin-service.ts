/**
 * Admin Service
 * Handles staff user management (CRUD operations)
 */

import { getDb } from '@server/shared/db';

export interface StaffUser {
  id: number;
  username: string;
  password_hash: string;
  email: string | null;
  name: string | null;
  role: string;
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
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  password?: string;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createUser(input: CreateUserInput): Promise<{ success: boolean; error?: string; userId?: number }> {
  const db = getDb();
  
  try {
    const existing = await db.get<StaffUser>('SELECT id FROM staff_users WHERE username = ?', [input.username]);
    if (existing) {
      return { success: false, error: '用户名已存在' };
    }

    const passwordHash = await hashPassword(input.password);
    const result = await db.run(
      'INSERT INTO staff_users (username, password_hash, email, name, role) VALUES (?, ?, ?, ?, ?)',
      [input.username, passwordHash, input.email || null, input.name || null, input.role || 'staff']
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

export async function verifyPassword(username: string, password: string): Promise<StaffUser | null> {
  const db = getDb();
  const user = await db.get<StaffUser>('SELECT * FROM staff_users WHERE username = ? AND status = ?', [username, 'active']);
  
  if (!user) {
    return null;
  }

  const passwordHash = await hashPassword(password);
  if (user.password_hash !== passwordHash) {
    return null;
  }

  return user;
}
