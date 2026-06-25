/**
 * Token 加密/解密工具
 * 用于安全存储商家的 CF API Token
 *
 * 使用 AES-GCM 加密，密钥从环境变量 ENCRYPTION_KEY 获取
 * 开发环境无密钥时使用 base64 编码（不安全，仅开发用）
 */

// 加密密钥从环境变量获取（通过 wrangler secret put 设置）
let ENCRYPTION_KEY: string | null = null;

/**
 * 初始化加密模块
 * 在 Worker 启动时由 index.worker.ts 调用
 */
export function initTokenEncryption(key?: string): void {
  ENCRYPTION_KEY = key || null;
  if (key) {
    console.log('[TokenCrypto] Encryption key initialized');
  } else {
    console.warn('[TokenCrypto] No ENCRYPTION_KEY set - using base64 fallback (INSECURE for production!)');
  }
}

/**
 * AES-GCM 加密
 */
export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext) return '';

  if (!ENCRYPTION_KEY) {
    // 开发环境：仅 base64 编码（不安全）
    return `base64:${btoa(plaintext)}`;
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY).slice(0, 32);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // 格式: aes:iv(base64).ciphertext(base64)
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const cipherBase64 = btoa(
    String.fromCharCode(...new Uint8Array(encrypted))
  );

  return `aes:${ivBase64}.${cipherBase64}`;
}

/**
 * AES-GCM 解密
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  if (!ciphertext) return '';

  // base64 回退模式
  if (ciphertext.startsWith('base64:')) {
    return atob(ciphertext.slice(7));
  }

  // AES 模式
  if (ciphertext.startsWith('aes:')) {
    if (!ENCRYPTION_KEY) {
      throw new Error('[TokenCrypto] Cannot decrypt: ENCRYPTION_KEY not set');
    }

    const payload = ciphertext.slice(4);
    const [ivBase64, cipherBase64] = payload.split('.');
    if (!ivBase64 || !cipherBase64) {
      throw new Error('[TokenCrypto] Invalid ciphertext format');
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(ENCRYPTION_KEY).slice(0, 32);
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const encrypted = Uint8Array.from(atob(cipherBase64), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  }

  // 旧格式：纯 base64
  return atob(ciphertext);
}

/**
 * 便捷别名（兼容旧 API）
 */
export const encrypt = encryptToken;
export const decrypt = decryptToken;
