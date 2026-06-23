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

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // ★ 优先聚焦已有窗口，同时导航到正确的 session URL
      for (const client of clientList) {
        const clientUrl = client.url;
        // 匹配同类型页面（staff 或 chat）
        if (targetPage === 'staff' && clientUrl.includes('/staff')) {
          if ('navigate' in client) {
            // ★ 先导航到正确的 session URL，再聚焦
            return client.navigate(url).then(() => {
              if ('focus' in client) client.focus();
            });
          }
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (targetPage === 'chat' && clientUrl.includes('/chat')) {
          if ('navigate' in client) {
            return client.navigate(url).then(() => {
              if ('focus' in client) client.focus();
            });
          }
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // 无匹配窗口则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});