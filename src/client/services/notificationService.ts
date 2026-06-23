/**
 * 浏览器推送通知服务
 * 支持 Chrome / Firefox / Edge / Opera / Samsung Internet
 * 
 * 功能：
 *   1. 请求通知权限
 *   2. 当标签页处于后台时，显示桌面通知
 *   3. 通过 Service Worker 注册 Web Push（预留 VAPID 通道）
 *   4. 通知点击后自动聚焦到聊天标签页
 */

import { playNotificationSound } from '@client/utils/notificationSound';

const NOTIFICATION_GRANTED_KEY = 'chat_notification_granted';

/** 检查浏览器是否支持通知 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/** 获取当前通知权限 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/** 请求通知权限 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';

  const result = await Notification.requestPermission();
  if (result === 'granted') {
    localStorage.setItem(NOTIFICATION_GRANTED_KEY, 'true');
  }
  return result;
}

/** 用户是否已经授权通知 */
export function isNotificationGranted(): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  return localStorage.getItem(NOTIFICATION_GRANTED_KEY) === 'true';
}

/** 重置通知状态（清除 localStorage 标记） */
export function resetNotificationState(): void {
  localStorage.removeItem(NOTIFICATION_GRANTED_KEY);
}

/**
 * 显示桌面通知
 * 优先使用 ServiceWorker（兼容 PWA 离线模式）
 * 降级使用 Notification API
 */
let swRegistration: ServiceWorkerRegistration | null = null;

export async function initServiceWorkerForNotification(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    swRegistration = await navigator.serviceWorker.ready;
  } catch {
    // 静默失败
  }
}

export async function showDesktopNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, string>;
    requireInteraction?: boolean;
  }
): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  // 播放提示音
  playNotificationSound();

  const finalOptions: NotificationOptions = {
    body,
    icon: options?.icon || '/icons/icon-192.svg',
    badge: options?.badge || '/icons/icon-192.svg',
    tag: options?.tag || 'chat-message',
    data: options?.data,
    requireInteraction: options?.requireInteraction ?? false,
    vibrate: [200, 100, 200],
    lang: document.documentElement.lang || 'zh-CN',
    dir: 'auto',
    silent: false,
  };

  try {
    // 优先通过 Service Worker 显示通知（PWA 模式下更可靠）
    if (swRegistration) {
      await swRegistration.showNotification(title, finalOptions);
    } else {
      // 降级：直接使用 Notification API
      const notification = new Notification(title, finalOptions);
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  } catch {
    // 静默失败
  }
}

/**
 * 检查页面是否在后台/不可见
 */
export function isPageHidden(): boolean {
  return document.hidden;
}

/**
 * 当新客服消息到达时触发通知
 * 仅在页面不可见（后台标签页/PWA 最小化）时弹出桌面通知
 */
export async function notifyNewStaffMessage(
  staffName: string,
  messagePreview: string,
  sessionId?: string,
): Promise<void> {
  // 只有在页面不可见时才弹出桌面通知
  if (!isPageHidden()) {
    // 页面可见：只播放提示音，不弹通知
    playNotificationSound();
    return;
  }

  const title = staffName || '客服';
  const body = messagePreview.length > 60
    ? messagePreview.substring(0, 60) + '...'
    : messagePreview;

  await showDesktopNotification(title, body, {
    tag: sessionId ? `chat-${sessionId}` : 'chat-message',
    data: sessionId ? { sessionId } : undefined,
    requireInteraction: false,
  });
}

/**
 * 更新浏览器标签页标题（未读消息闪烁）
 */
let originalTitle: string = '';
let flashInterval: ReturnType<typeof setInterval> | null = null;

export function startUnreadTitleFlash(unreadCount: number): void {
  if (flashInterval) return;
  originalTitle = document.title;

  flashInterval = setInterval(() => {
    document.title = document.title.startsWith('🔔')
      ? originalTitle
      : `🔔 (${unreadCount}) ${originalTitle}`;
  }, 1500);
}

export function stopUnreadTitleFlash(): void {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  if (originalTitle) {
    document.title = originalTitle;
  }
}
