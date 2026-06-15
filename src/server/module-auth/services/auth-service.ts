/**
 * Authentication Service
 * Handles password verification, token generation, and IP rate limiting
 */

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
  role: 'staff';
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
export function checkAuthRequired(): boolean {
  // If REQUIRE_AUTH is false, no auth needed
  if (!_requireAuth) {
    return false;
  }
  // If no password is configured, no auth needed
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
 */
function base64urlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Simple base64url decode
 */
function base64urlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
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
  const signatureArray = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < signatureArray.length; i++) {
    binary += String.fromCharCode(signatureArray[i]);
  }
  return base64urlEncode(binary);
}

/**
 * Generate JWT token
 */
async function generateToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    role: 'staff',
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

    // Check role
    if (payload.role !== 'staff') {
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
}

/**
 * Verify result
 */
export interface VerifyResult {
  valid: boolean;
  error?: string;
}

/**
 * Login with password
 */
export async function login(password: string, clientIp: string): Promise<LoginResult> {
  // Check if auth is required
  if (!checkAuthRequired()) {
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

  // Verify password
  if (password !== _staffPassword) {
    recordFailedAttempt(clientIp);
    return {
      success: false,
      error: '密码错误',
      remainingAttempts: getRemainingAttempts(clientIp),
    };
  }

  // Generate token
  const token = await generateToken();
  return {
    success: true,
    token,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION_SECONDS,
  };
}

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<VerifyResult> {
  // Check if auth is required
  if (!checkAuthRequired()) {
    return { valid: true };
  }

  const payload = await verifyTokenSignature(token);
  if (!payload) {
    return { valid: false, error: 'Token 无效或已过期' };
  }

  return { valid: true };
}

/**
 * Generate a token for push notifications (used internally)
 */
export async function generatePushToken(): Promise<string> {
  return generateToken();
}
