/**
 * 浏览器推送通知服务
 * ★ 兼容 Chrome / Firefox / Edge / Safari / Opera / Samsung Internet
 * 
 * 功能：
 *   1. 请求通知权限 + 权限引导横幅
 *   2. 访客端：收到客服消息时弹通知
 *   3. 客服端：收到访客消息时弹通知（核心场景）
 *   4. 客服端：新访客上线时弹通知
 *   5. 通知点击 → 自动聚焦到对应标签页
 *   6. 音频联动：通知弹出时同步播放提示音
 * 
 * 浏览器差异处理：
 *   - Safari: 不支持 vibrate，需在用户手势中请求权限
 *   - Firefox: vibrate 在非 Android 上无效，静默忽略
 *   - Chrome/Edge: 完整支持
 *   - Samsung Internet: 基于 Chromium，支持良好
 */

import { playNotificationSound } from '@client/utils/notificationSound';

const NOTIFICATION_GRANTED_KEY = 'chat_notification_granted';

/** ★ 检测浏览器是否支持振动（Safari/桌面Firefox不支持） */
function supportsVibrate(): boolean {
  return 'vibrate' in navigator;
}

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
 * 获取 Service Worker 注册引用（用于通过 SW 显示通知）
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

/**
 * 核心：显示桌面通知
 * 优先使用 ServiceWorker（兼容 PWA 离线模式）
 * 降级使用 Notification API
 */
async function showDesktopNotification(
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
    requireInteraction?: boolean;
  }
): Promise<void> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  const finalOptions: NotificationOptions & { vibrate?: number[] } = {
    body,
    icon: options?.icon || '/icons/icon-192.svg',
    badge: options?.badge || '/icons/icon-192.svg',
    tag: options?.tag || 'chat-message',
    data: options?.data,
    requireInteraction: options?.requireInteraction ?? false,
    lang: document.documentElement.lang || 'zh-CN',
    dir: 'auto',
    silent: false,
  };

  // ★ 仅在支持 vibrate 的浏览器上添加振动（Safari/桌面Firefox不支持）
  if (supportsVibrate()) {
    finalOptions.vibrate = [200, 100, 200];
  }

  try {
    // 优先通过 Service Worker 显示通知（PWA 模式下更可靠）
    if (swRegistration) {
      console.log('[Notification] Using ServiceWorker to show notification, tag:', finalOptions.tag);
      await swRegistration.showNotification(title, finalOptions);
    } else {
      // 降级：直接使用 Notification API
      console.log('[Notification] SW unavailable, using direct Notification API');
      const notification = new Notification(title, finalOptions);
      // ★ 降级路径也必须支持点击导航
      notification.onclick = () => {
        notification.close();
        const notifyData = finalOptions.data as Record<string, unknown> | undefined;
        if (notifyData?.page && notifyData?.sessionId) {
          // 构建目标 URL
          let targetUrl = notifyData.page === 'staff' ? '/staff' : '/chat';
          targetUrl += `?s=${encodeURIComponent(String(notifyData.sessionId))}`;
          if (notifyData.business) {
            targetUrl += `&business=${encodeURIComponent(String(notifyData.business))}`;
          }
          console.log('[Notification] Direct API onclick → navigating to:', targetUrl);
          // 尝试导航当前窗口（如果已是目标页面）
          if (window.location.pathname.includes(notifyData.page === 'staff' ? '/staff' : '/chat')) {
            window.location.href = targetUrl;
          } else {
            window.open(targetUrl, '_blank');
          }
        } else {
          window.focus();
        }
      };
    }
  } catch (err) {
    console.warn('[Notification] ServiceWorker path failed:', err, '→ trying fallback');
    // 降级再试一次
    try {
      const fallbackNotification = new Notification(title, finalOptions);
      fallbackNotification.onclick = () => {
        fallbackNotification.close();
        window.focus();
      };
    } catch {
      console.error('[Notification] All notification paths failed');
    }
  }
}

/**
 * ★ 检查页面是否在后台/不可见
 */
export function isPageHidden(): boolean {
  return document.hidden;
}

// ============ 访客端通知 ============

/**
 * 访客端：收到客服消息时触发通知
 * 仅在页面不可见（后台标签页/PWA 最小化）时弹出桌面通知
 */
export async function notifyNewStaffMessage(
  staffName: string,
  messagePreview: string,
  sessionId?: string,
  business?: string,
): Promise<void> {
  // 页面可见：只播放提示音，不弹通知
  if (!isPageHidden()) {
    return;
  }

  const title = `【新消息】${staffName || '客服'}`;
  const body = messagePreview.length > 60
    ? messagePreview.substring(0, 60) + '...'
    : messagePreview;

  await showDesktopNotification(title, body, {
    tag: sessionId ? `chat-${sessionId}` : 'chat-message',
    data: { sessionId: sessionId || '', business: business || '', page: 'chat' },
  });
}

// ============ 客服端通知（核心业务） ============

/**
 * ★ 客服端：收到访客新消息时触发
 * 场景：客服在浏览其他标签页/使用其他软件时，访客发了新消息
 */
export async function notifyNewVisitorMessage(
  visitorName: string,
  messagePreview: string,
  sessionId?: string,
  business?: string,
): Promise<void> {
  // 页面可见 → 不弹桌面通知（客服正在看）
  if (!isPageHidden()) {
    return;
  }

  const title = `【新消息】${visitorName || '访客'}`;
  const body = messagePreview.length > 60
    ? messagePreview.substring(0, 60) + '...'
    : messagePreview;

  await showDesktopNotification(title, body, {
    tag: sessionId ? `staff-session-${sessionId}` : 'staff-chat',
    data: { sessionId: sessionId || '', business: business || '', page: 'staff' },
  });
}

/**
 * ★ 客服端：新访客上线通知
 * 场景：全新访客进入网站点击咨询，分配给当前客服
 */
export async function notifyNewVisitorSession(
  visitorName: string,
  sessionId?: string,
  business?: string,
): Promise<void> {
  // 页面可见 → 不弹桌面通知
  if (!isPageHidden()) {
    return;
  }

  const title = '【新访客提示】';
  const body = `提示：${visitorName || '新访客'}进入，请及时接待`;

  await showDesktopNotification(title, body, {
    tag: sessionId ? `staff-new-${sessionId}` : 'staff-new-visitor',
    data: { sessionId: sessionId || '', business: business || '', page: 'staff' },
    requireInteraction: true, // ★ 新访客通知需要手动关闭
  });
}

/**
 * ★ 客服端：转接通知
 * 场景：其他客服将对话转接过来
 */
export async function notifyTransferReceived(
  fromStaffName: string,
  visitorName: string,
  sessionId?: string,
  business?: string,
): Promise<void> {
  const title = '【对话转接】';
  const body = `${fromStaffName} 将 ${visitorName || '访客'} 的对话转接给你`;

  await showDesktopNotification(title, body, {
    tag: sessionId ? `staff-transfer-${sessionId}` : 'staff-transfer',
    data: { sessionId: sessionId || '', business: business || '', page: 'staff' },
    requireInteraction: true,
  });
}

// ============ 标题栏闪烁 ============

let originalTitle: string = '';
let flashInterval: ReturnType<typeof setInterval> | null = null;

/** ★ 开始标题闪烁（显示未读消息数） */
export function startUnreadTitleFlash(unreadCount: number): void {
  if (flashInterval) return;
  if (!originalTitle) {
    originalTitle = document.title;
  }

  flashInterval = setInterval(() => {
    document.title = document.title.startsWith('🔔')
      ? originalTitle
      : `🔔 (${unreadCount}) ${originalTitle}`;
  }, 1500);
}

/** ★ 停止标题闪烁 */
export function stopUnreadTitleFlash(): void {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  if (originalTitle) {
    document.title = originalTitle;
    originalTitle = '';
  }
}

// ============ 页面可见性变化处理 ============

/**
 * ★ 当页面从后台切回前台时自动停止闪烁
 */
export function setupVisibilityHandler(): () => void {
  const handler = () => {
    if (!document.hidden) {
      stopUnreadTitleFlash();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
