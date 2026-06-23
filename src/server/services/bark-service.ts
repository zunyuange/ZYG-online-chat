/**
 * Bark Notification Service - Send push notifications to iOS
 */

import { generatePushToken } from '../module-auth/services/auth-service';

// Configuration (can be initialized from Workers env)
let _barkKey: string | null = null;
let _barkApi: string = 'https://api.day.app';
let _staffUrlBase: string = 'http://localhost:3010/staff';

/**
 * Dynamically set staff URL base from the request host
 * This auto-adapts to any deployment environment:
 * - Custom domain: https://{name}.linzihai.workers.dev/staff
 * - Default domain: https://{name}.workers.dev/staff
 * - Local dev: falls back to http://localhost:3010/staff
 * 
 * @param host - The host from the request (e.g., "zyg-online-chat.linzihai.workers.dev")
 */
export function setStaffUrlFromHost(host: string): void {
  if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
    // Keep local dev default
    return;
  }
  // Build staff URL from the actual request host
  _staffUrlBase = `https://${host}/staff`;
  console.log('[Bark] Staff URL auto-detected:', _staffUrlBase);
}

/**
 * Initialize Bark service with environment variables
 * Call this from Workers context with c.env
 */
export function initBarkService(env: {
  BARK_KEY?: string;
  BARK_API?: string;
  STAFF_URL_BASE?: string;
}): void {
  if (env.BARK_KEY) _barkKey = env.BARK_KEY;
  if (env.BARK_API) _barkApi = env.BARK_API;
  if (env.STAFF_URL_BASE) _staffUrlBase = env.STAFF_URL_BASE;
}

/**
 * Check if Bark is configured
 */
export function isBarkConfigured(): boolean {
  // Check initialized config first, then fall back to process.env (Node.js)
  if (_barkKey) return true;
  if (typeof process !== 'undefined' && process.env?.BARK_KEY) {
    _barkKey = process.env.BARK_KEY;
    return true;
  }
  return false;
}

/**
 * Send notification via Bark
 */
export async function sendBarkNotification(
  title: string,
  body: string,
  options?: {
    sound?: string;
    url?: string;
    group?: string;
  }
): Promise<void> {
  // 如果没有配置 Bark Key，跳过通知
  if (!isBarkConfigured()) {
    console.log('[Bark] Skipped - BARK_KEY not configured');
    return;
  }

  const { sound = 'minuet', url, group = 'chat' } = options || {};

  try {
    const params = new URLSearchParams();
    params.set('sound', sound);
    params.set('group', group);
    if (url) params.set('url', url);

    const encodedTitle = encodeURIComponent(title);
    const encodedBody = encodeURIComponent(body);
    const barkUrl = `${_barkApi}/${_barkKey}/${encodedTitle}/${encodedBody}?${params.toString()}`;

    console.log('[Bark] Sending to:', `${_barkApi}/${_barkKey?.substring(0, 4)}***...`);

    // 使用 fetch 发送通知
    const response = await fetch(barkUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Cloudflare-Workers-Chat/1.0',
      },
    });

    const result = await response.text();
    console.log('[Bark] API Response:', response.status, result);

    if (response.ok) {
      console.log('[Bark] Notification sent successfully:', title);
    } else {
      console.error('[Bark] API error:', response.status, result);
    }
  } catch (error) {
    // 不要让通知失败影响主流程
    console.error('[Bark] Fetch error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Notify when visitor sends a message
 */
export async function notifyVisitorMessage(
  sessionId: string,
  visitorName: string,
  content: string,
  contentType: string
): Promise<void> {
  console.log('[Bark] notifyVisitorMessage called, barkKey configured:', !!_barkKey);

  // 如果没有配置 Bark Key，跳过通知
  if (!isBarkConfigured()) {
    console.log('[Bark] Skipped - BARK_KEY not configured');
    return;
  }

  // 截取消息内容前50个字符
  let preview = content;
  if (contentType === 'text') {
    preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
  } else if (contentType === 'image') {
    preview = '[图片]';
  } else if (contentType === 'video') {
    preview = '[视频]';
  } else if (contentType === 'file') {
    preview = '[文件]';
  }

  // 生成推送 token 用于免密访问
  const pushToken = await generatePushToken();

  // 客服端链接 - 使用环境变量配置的地址，添加 token 参数
  const staffUrl = `${_staffUrlBase}?s=${sessionId}&token=${pushToken}`;

  await sendBarkNotification(
    `💬 ${visitorName}`,
    preview,
    {
      sound: 'minuet',
      url: staffUrl,
      group: 'chat-message',
    }
  );
}
