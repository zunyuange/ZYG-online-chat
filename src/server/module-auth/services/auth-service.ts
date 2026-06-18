/**
 * Authentication Service
 * Handles password verification, token generation, and IP rate limiting
 * Supports both legacy single-password auth and multi-user database auth
 */

import { verifyPassword, listUsers, updateStaffLastActive } from '@server/module-admin/services/admin-service';

// Configuration
let _staffPassword: string | null = null;
let _requireAuth: boolean = true;
let _jwtSecret: string = 'default-secret-change-me';

// Token expiration: 7 days in seconds
const TOKEN_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;

// IP Rate Limiting: 5 attempts per 10 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
}

// In-memory rate limit store (resets on server restart)
const ipRateLimit = new Map<string, RateLimitEntry>();

interface TokenPayload {
  role: 'staff' | 'admin';
  userId?: number;
  username?: string;
  businessId?: number;
  businessSlug?: string;
  businessName?: string;
  iat: number;
  exp: number;
}

/**
 * Initialize auth service with environment variables
 */
export function initAuthService(env: {
  STAFF_PASSWORD?: string;
  REQUIRE_AUTH?: string;
  JWT_SECRET?: string;
}): void {
  if (env.STAFF_PASSWORD) {
    _staffPassword = env.STAFF_PASSWORD;
  }
  if (env.REQUIRE_AUTH !== undefined) {
    _requireAuth = env.REQUIRE_AUTH === 'true' || env.REQUIRE_AUTH === '1';
  }
  if (env.JWT_SECRET) {
    _jwtSecret = env.JWT_SECRET;
  }
  console.log('[AuthService] Initialized, requireAuth:', _requireAuth, 'hasPassword:', !!_staffPassword);
}

/**
 * Check if authentication is required
 */
export async function checkAuthRequired(): Promise<boolean> {
  // If REQUIRE_AUTH is explicitly set to false, no auth needed
  if (_requireAuth === false) {
    return false;
  }
  
  // If REQUIRE_AUTH is explicitly set to true, always require auth
  if (_requireAuth === true) {
    return true;
  }
  
  // Default behavior: check if there are staff users in database
  try {
    const users = await listUsers();
    if (users.length > 0) {
      return true;
    }
  } catch (error) {
    console.log('[AuthService] Database check failed:', error);
  }
  
  // If no password is configured and no database users, no auth needed
  if (!_staffPassword) {
    return false;
  }
  return true;
}

/**
 * Get client IP address from request
 */
export function getClientIp(headers: Headers): string {
  // Cloudflare Workers
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Standard proxy headers
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;

  // Fallback
  return 'unknown';
}

/**
 * Check if IP is rate limited
 */
function isRateLimited(ip: string): boolean {
  const entry = ipRateLimit.get(ip);
  if (!entry) return false;

  const now = Date.now();

  // Check if window has expired
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    ipRateLimit.delete(ip);
    return false;
  }

  return entry.count >= RATE_LIMIT_MAX_ATTEMPTS;
}

/**
 * Record a failed login attempt
 */
function recordFailedAttempt(ip: string): void {
  const entry = ipRateLimit.get(ip);
  const now = Date.now();

  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    // Start new window
    ipRateLimit.set(ip, { count: 1, firstAttempt: now });
  } else {
    // Increment in existing window
    entry.count++;
  }
}

/**
 * Get remaining attempts for IP
 */
function getRemainingAttempts(ip: string): number {
  const entry = ipRateLimit.get(ip);
  if (!entry) return RATE_LIMIT_MAX_ATTEMPTS;

  const now = Date.now();
  if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    return RATE_LIMIT_MAX_ATTEMPTS;
  }

  return Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - entry.count);
}

/**
 * Simple base64url encode
 * Supports both UTF-8 strings and binary data
 */
function base64urlEncode(input: string | Uint8Array): string {
  let data: Uint8Array;
  if (typeof input === 'string') {
    const encoder = new TextEncoder();
    data = encoder.encode(input);
  } else {
    data = input;
  }
  
  let result = '';
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  
  for (let i = 0; i < data.length; i += 3) {
    const byte1 = data[i];
    const byte2 = data[i + 1] || 0;
    const byte3 = data[i + 2] || 0;
    
    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;
    
    result += table[(chunk >> 18) & 0x3F];
    result += table[(chunk >> 12) & 0x3F];
    
    if (i + 1 < data.length) {
      result += table[(chunk >> 6) & 0x3F];
    }
    
    if (i + 2 < data.length) {
      result += table[chunk & 0x3F];
    }
  }
  
  return result
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Simple base64url decode
 * Supports UTF-8 characters (including Chinese)
 */
function base64urlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes);
}

/**
 * Simple hash function for JWT signature (HMAC-SHA256 simulation)
 * Note: In production, use a proper crypto library
 */
async function simpleHash(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  // Use Web Crypto API for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  return base64urlEncode(new Uint8Array(signature));
}

/**
 * Generate JWT token
 */
async function generateToken(userId?: number, username?: string, businessId?: number, businessSlug?: string, businessName?: string, role?: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    role: role || 'staff',
    userId,
    username,
    businessId,
    businessSlug,
    businessName,
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

/**
 * Verify JWT token
 */
async function verifyTokenSignature(token: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const message = `${headerB64}.${payloadB64}`;
    const expectedSignature = await simpleHash(message, _jwtSecret);

    if (signatureB64 !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payloadJson = base64urlDecode(payloadB64);
    const payload: TokenPayload = JSON.parse(payloadJson);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    // Check role (allow both staff and admin)
    if (payload.role !== 'staff' && payload.role !== 'admin') {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Login result
 */
export interface LoginResult {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
  remainingAttempts?: number;
  userId?: number;
  username?: string;
}

/**
 * Verify result
 */
export interface VerifyResult {
  valid: boolean;
  error?: string;
  userId?: number;
  username?: string;
  businessId?: number;
  businessSlug?: string;
  businessName?: string;
}

/**
 * Login with username and password
 * Supports both legacy single-password mode and multi-user database mode
 */
export async function login(username: string, password: string, clientIp: string): Promise<LoginResult> {
  console.log('[AuthService] login called with username:', username, 'password length:', password.length);
  
  // Check if auth is required
  const authRequired = await checkAuthRequired();
  console.log('[AuthService] authRequired:', authRequired);
  
  if (!authRequired) {
    // No auth required, generate token anyway for push notifications
    const token = await generateToken();
    return {
      success: true,
      token,
      expiresAt: Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION_SECONDS,
    };
  }

  // Check rate limit
  if (isRateLimited(clientIp)) {
    return {
      success: false,
      error: '尝试次数过多，请 10 分钟后重试',
      remainingAttempts: 0,
    };
  }

  try {
    console.log('[AuthService] Trying database authentication, username:', username);
    
    const user = await verifyPassword(username, password);
    console.log('[AuthService] verifyPassword result:', user ? 'found user' : 'null');
    
    if (user) {
      // Database user authentication successful
      const u = user as any;
      const businessId = Number(u.business_id);
      const userId = Number(user.id);
      
      // Update last_active timestamp for online status tracking
      await updateStaffLastActive(userId);
      
      // 商家主账号：business_id = 0，使用自己的business_slug
      // 客服账号：business_id > 0，需要查找商家信息
      const token = await generateToken(
        userId, 
        user.username, 
        businessId === 0 ? userId : businessId,
        u.business_slug || '',
        u.business_name || '',
        user.role
      );
      return {
        success: true,
        token,
        expiresAt: Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION_SECONDS,
        userId: userId,
        username: user.username,
      };
    } else {
      console.log('[AuthService] Database authentication failed - user not found or password mismatch');
    }
  } catch (error) {
    console.log('[AuthService] Database auth error:', error instanceof Error ? error.message : String(error));
  }

  // Legacy single-password mode fallback
  if (_staffPassword && password === _staffPassword) {
    const token = await generateToken();
    return {
      success: true,
      token,
      expiresAt: Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION_SECONDS,
    };
  }

  recordFailedAttempt(clientIp);
  return {
    success: false,
    error: '用户名或密码错误',
    remainingAttempts: getRemainingAttempts(clientIp),
  };
}

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<VerifyResult> {
  // Check if auth is required
  const authRequired = await checkAuthRequired();
  if (!authRequired) {
    return { valid: true };
  }

  const payload = await verifyTokenSignature(token);
  if (!payload) {
    return { valid: false, error: 'Token 无效或已过期' };
  }

  return { 
    valid: true, 
    userId: payload.userId, 
    username: payload.username, 
    businessId: payload.businessId,
    businessSlug: payload.businessSlug,
    businessName: payload.businessName,
    role: payload.role
  };
}

/**
 * Generate a token for push notifications (used internally)
 */
export async function generatePushToken(): Promise<string> {
  return generateToken();
}
