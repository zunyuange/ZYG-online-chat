/**
 * Admin Service
 * Handles staff user management (CRUD operations)
 */

import { getDb } from '@server/shared/db';
import { hashPassword } from '@server/shared/crypto';
import { CFService } from '@server/services/cf-service';

export interface StaffUser {
  id: number;
  business_id: number;
  business_slug: string | null;
  business_name: string | null;
  custom_domain: string | null;
  cf_zone_id: string | null;
  cf_configured: number;
  username: string;
  password_hash: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  created_at: number;
  updated_at: number;
}

const cfApiToken = process.env.CF_API_TOKEN || '';
const cfAccountId = process.env.CF_ACCOUNT_ID || '';
const cfZoneId = process.env.CF_ZONE_ID || '';
const cfBaseDomain = process.env.CF_BASE_DOMAIN || 'zygmail.icu';
const cfWorkerDomain = process.env.CF_WORKER_DOMAIN || 'zyg-online-chat.linzihai.workers.dev';

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  name?: string;
  role?: string;
  business_id?: number;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  password?: string;
}

export async function createUser(input: CreateUserInput): Promise<{ success: boolean; error?: string; userId?: number; customDomain?: string }> {
  const db = getDb();
  
  try {
    const existing = await db.get<StaffUser>('SELECT id FROM staff_users WHERE username = ?', [input.username]);
    if (existing) {
      return { success: false, error: '用户名已存在' };
    }

    const passwordHash = await hashPassword(input.password);
    
    let businessSlug: string | null = null;
    let businessName: string | null = null;
    let customDomain: string | null = null;
    let finalBusinessId = input.business_id || 0;
    
    if (!input.business_id || input.business_id === 0) {
      finalBusinessId = 0;
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
      
      if (cfApiToken && cfZoneId && businessSlug) {
        const cfService = new CFService({
          apiToken: cfApiToken,
          accountId: cfAccountId,
          zoneId: cfZoneId,
        });
        
        const subdomain = `${businessSlug}.${cfBaseDomain}`;
        const record = await cfService.createCNAMERecord(subdomain, cfWorkerDomain);
        
        if (record) {
          customDomain = subdomain;
          console.log(`[AdminService] Created custom domain: ${customDomain}`);
        } else {
          console.warn(`[AdminService] Failed to create custom domain for ${businessSlug}`);
        }
      }
    }
    
    const result = await db.run(
      'INSERT INTO staff_users (username, password_hash, email, name, role, business_id, business_slug, business_name, custom_domain, cf_zone_id, cf_configured, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [input.username, passwordHash, input.email || null, input.name || null, input.role || 'staff', finalBusinessId, businessSlug, businessName, customDomain, cfZoneId || null, customDomain ? 1 : 0, 'active', Date.now(), Date.now()]
    );

    return { success: true, userId: result.lastInsertRowid, customDomain };
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
