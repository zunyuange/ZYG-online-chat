/**
 * Service Worker for offline support
 */

const CACHE_NAME = 'chat-cache-v1';
const STATIC_CACHE_NAME = 'chat-static-v1';

// Static assets to cache
// ★ 注意：不要缓存 /chat 路径，因为 PWA 启动时该路径不含商家参数
//   商家归属通过 localStorage + chatStore.initSession 动态恢复
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip SSE requests
  if (url.pathname.includes('/sse/')) {
    return;
  }

  // Skip API requests for real-time data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return offline response for API requests
        return new Response(
          JSON.stringify({ success: false, error: 'Offline' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // For static assets and pages, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        event.waitUntil(
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response.clone());
              });
            }
          }).catch(() => {
            // Ignore network errors
          })
        );
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ===== Push Notification Events =====

// Push event: show notification when push message received from server
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, badge, tag, data: payload, requireInteraction } = data;

    const options = {
      body: body || '',
      icon: icon || '/icons/icon-192.svg',
      badge: badge || '/icons/icon-192.svg',
      tag: tag || 'chat-message',
      data: payload || {},
      requireInteraction: requireInteraction ?? false,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: payload?.actionOpenTitle || '查看' },
        { action: 'close', title: payload?.actionCloseTitle || '关闭' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(title || 'New Message', options)
    );
  } catch {
    // Fallback: treat as text
    event.waitUntil(
      self.registration.showNotification('New Message', {
        body: event.data.text(),
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
      })
    );
  }
});

// Notification click: focus existing window or open new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;
  console.log('[SW] notificationclick', { action, data });

  if (action === 'close') return;

  // Determine target page: staff or chat
  const targetPage = data.page || 'chat';

  // Build URL with session info
  let url = targetPage === 'staff' ? '/staff' : '/chat';
  if (data.sessionId) {
    url += `?s=${encodeURIComponent(data.sessionId)}`;
  }
  if (data.business) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}business=${encodeURIComponent(data.business)}`;
  }

  console.log('[SW] Resolved URL:', url, 'targetPage:', targetPage);

  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      console.log('[SW] Found', clientList.length, 'window(s):', clientList.map(c => c.url));
      
      // ★ 1. 优先查找同类型页面，通过 navigate 切换 session
      for (const client of clientList) {
        const clientUrl = client.url;
        
        if (targetPage === 'staff' && clientUrl.includes('/staff')) {
          console.log('[SW] Matched staff window:', clientUrl);
          return navigateAndFocus(client, fullUrl, url);
        }
        if (targetPage === 'chat' && clientUrl.includes('/chat')) {
          console.log('[SW] Matched chat window:', clientUrl);
          return navigateAndFocus(client, fullUrl, url);
        }
      }

      // ★ 2. 无同类型窗口 → 找任意窗口通过 postMessage 切换后再聚焦
      for (const client of clientList) {
        const clientUrl = client.url;
        // 匹配主页或同类根路径
        if (clientUrl.includes('/staff') || clientUrl.includes('/chat') || clientUrl === self.location.origin + '/') {
          console.log('[SW] Fallback: postMessage navigate to', fullUrl);
          client.postMessage({ type: 'NOTIFICATION_NAVIGATE', url: fullUrl });
          if ('focus' in client) client.focus();
          return;
        }
      }

      // ★ 3. 完全无匹配 → 打开新窗口
      console.log('[SW] No matching window, opening new window:', fullUrl);
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    }).catch((err) => {
      console.error('[SW] notificationclick error:', err);
    })
  );
});

/**
 * ★ 尝试 navigate + focus，失败时降级到 postMessage
 */
function navigateAndFocus(client, fullUrl, relativeUrl) {
  // 如果 URL 已经是目标 URL，直接聚焦即可
  if (client.url === fullUrl) {
    console.log('[SW] URL already matches, just focusing');
    if ('focus' in client) return client.focus();
    return;
  }

  if ('navigate' in client) {
    // 先导航到正确 URL，再聚焦
    return client.navigate(relativeUrl).then(() => {
      console.log('[SW] Navigated successfully, now focusing');
      if ('focus' in client) client.focus();
    }).catch((err) => {
      console.warn('[SW] navigate() failed:', err, '→ fallback to postMessage');
      // 导航失败 → 尝试通过 postMessage 通知页面自行导航
      client.postMessage({ type: 'NOTIFICATION_NAVIGATE', url: fullUrl });
      if ('focus' in client) client.focus();
    });
  }

  // 不支持 navigate → postMessage 降级
  console.log('[SW] navigate not supported, using postMessage');
  client.postMessage({ type: 'NOTIFICATION_NAVIGATE', url: fullUrl });
  if ('focus' in client) return client.focus();
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] message received:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});