/**
 * Chat store - User/Visitor state management
 */

import { create } from 'zustand';
import type { Session, Message, ContentType } from '@shared/types';
import { playNotificationSound } from '@client/utils/notificationSound';
import { notifyNewStaffMessage, startUnreadTitleFlash, stopUnreadTitleFlash } from '@client/services/notificationService';

// LocalStorage keys
const SESSION_ID_KEY = 'chat_session_id';
const VISITOR_NAME_KEY = 'chat_visitor_name';
const BUSINESS_SLUG_KEY = 'chat_business_slug'; // ★ 持久化商家标识，确保 PWA 重启后能找到正确商家

// URL helper functions
const getUrlSessionId = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('s');
};

const getUrlBusiness = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('business');
};

// 系统保留的 URL 参数名（不会被当作自定义参数）
const SYSTEM_PARAMS = new Set([
  'business', 's', 'userName', 'email', 'phone', 'pid',
  'groupId', 'adminId', 'params', 'lang', 'avatar',
]);

// 从 URL 参数读取访客自定义信息
const getVisitorInfoFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search);
  
  // 收集所有不在系统参数列表中的 URL 参数作为自定义参数
  const extraParams: Record<string, string> = {};
  urlParams.forEach((value, key) => {
    if (!SYSTEM_PARAMS.has(key) && value) {
      extraParams[key] = value;
    }
  });
  
  return {
    userName: urlParams.get('userName') || undefined,
    email: urlParams.get('email') || undefined,
    phone: urlParams.get('phone') || undefined,
    pid: urlParams.get('pid') || undefined,
    groupId: urlParams.get('groupId') || undefined,
    adminId: urlParams.get('adminId') || undefined,
    paramsStr: urlParams.get('params') || undefined,
    lang: urlParams.get('lang') || undefined,
    avatar: urlParams.get('avatar') || undefined,
    extraParams: Object.keys(extraParams).length > 0 ? extraParams : undefined,
  };
};

const updateUrlSessionId = (sessionId: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set('s', sessionId);
  // 保留关键 URL 参数：business, lang, userName 等
  const preserveParams = ['business', 'lang', 'userName', 'email', 'phone', 'pid', 'avatar'];
  for (const param of preserveParams) {
    const value = url.searchParams.get(param);
    if (!value) {
      // 尝试从原始 URL 读取（如果当前 URL 已经丢失了某些参数）
      const originalValue = new URLSearchParams(window.location.search).get(param);
      if (originalValue) {
        url.searchParams.set(param, originalValue);
      } else if (param === 'business') {
        // ★ business 参数：如果 URL 里没有，尝试从 localStorage 恢复
        const savedBusiness = localStorage.getItem(BUSINESS_SLUG_KEY);
        if (savedBusiness) {
          url.searchParams.set('business', savedBusiness);
          console.log('[ChatStore] Restored business from localStorage:', savedBusiness);
        }
      }
    } else if (param === 'business' && value) {
      // ★ 发现 URL 中有 business 参数，同步到 localStorage
      localStorage.setItem(BUSINESS_SLUG_KEY, value);
      console.log('[ChatStore] Synced business to localStorage:', value);
    }
  }
  window.history.replaceState({}, '', url.toString());
};

interface ChatState {
  // Session state
  session: Session | null;
  messages: Message[];
  hasMore: boolean;

  // UI state
  loading: boolean;
  sending: boolean;
  error: string | null;
  sseConnected: boolean;
  usePolling: boolean; // Fallback for Workers environment
  staffOnline: boolean; // 是否有客服在线（任意客服）
  assignedStaffOnline: boolean | null; // 已分配客服是否在线（null = 未分配/未检测）

  // Actions
  initSession: () => Promise<void>;
  setVisitorName: (name: string) => void;
  loadMessages: (before?: number) => Promise<void>;
  checkNewMessages: () => Promise<void>;
  sendMessage: (content: string, type: ContentType) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  markAsRead: () => Promise<void>;
  addMessage: (message: Message) => void;
  updateSession: (sessionUpdate: Partial<Session>) => void;
  connectSSE: () => void;
  disconnectSSE: () => void;
  startPolling: () => void;
  stopPolling: () => void;
  clearError: () => void;
  checkStaffOnline: () => Promise<void>;
  resetSession: () => Promise<void>;
}

// EventSource reference
let eventSource: EventSource | null = null;
// Polling interval reference
let pollingInterval: ReturnType<typeof setInterval> | null = null;
// Track last message time for polling
let lastMessageTime: number = 0;
// Polling cycle counter for periodic staff online check (check every 5 cycles ≈ 15s)
let pollingCycleCount: number = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  session: null,
  messages: [],
  hasMore: false,
  loading: false,
  sending: false,
  error: null,
  sseConnected: false,
  usePolling: false,
  staffOnline: false,
  assignedStaffOnline: null,

  // Initialize session from URL, localStorage or create new
  initSession: async () => {
    set({ loading: true, error: null });

    try {
      // Priority: URL param > localStorage
      const urlSessionId = getUrlSessionId();
      const sessionId = urlSessionId || localStorage.getItem(SESSION_ID_KEY);
      const visitorName = localStorage.getItem(VISITOR_NAME_KEY) || undefined;
      // ★ PWA 归属修复：business 优先从 URL 读取，其次从 localStorage 恢复
      //   PWA 安装后的 start_url 不携带 business 参数，需要从 localStorage 恢复
      let business = getUrlBusiness();
      if (!business) {
        business = localStorage.getItem(BUSINESS_SLUG_KEY) || undefined;
        if (business) {
          console.log('[ChatStore] Recovered business from localStorage:', business);
        }
      }
      // ★ 域名自动识别：通过 Host 头解析商家（子域名/自定义域名无需 ?business= 参数）
      if (!business) {
        try {
          const resolveResp = await fetch('/api/business/resolve-by-host');
          if (resolveResp.ok) {
            const resolveData = await resolveResp.json();
            if (resolveData.success && resolveData.data?.slug) {
              business = resolveData.data.slug;
              localStorage.setItem(BUSINESS_SLUG_KEY, business);
              console.log('[ChatStore] Detected business from domain host:', business);
              // 同步到 URL，确保后续刷新和分享链接携带 business 参数
              const url = new URL(window.location.href);
              url.searchParams.set('business', business);
              window.history.replaceState({}, '', url.toString());
            }
          }
        } catch (err) {
          console.log('[ChatStore] Domain host resolution skipped:', err);
        }
      }
      
      console.log('[ChatStore] initSession: business from URL =', getUrlBusiness(), 'effective business =', business);
      console.log('[ChatStore] initSession: URL =', window.location.href);
      
      // 从 URL 获取访客自定义信息
      const visitorInfo = getVisitorInfoFromUrl();
      // 如果 URL 传了 userName，优先使用
      const finalVisitorName = visitorInfo.userName || visitorName;
      
      // 合并自定义参数：JSON格式的 params 参数 + 其他未知 URL 参数
      let paramsObj: Record<string, string> | undefined;
      if (visitorInfo.paramsStr) {
        try {
          paramsObj = JSON.parse(visitorInfo.paramsStr);
        } catch {
          console.warn('[ChatStore] Failed to parse params JSON:', visitorInfo.paramsStr);
        }
      }
      // 将 URL 中的其他未知参数也合并进 paramsObj（extraParams 中的值不覆盖显式 JSON 中的值）
      if (visitorInfo.extraParams) {
        if (!paramsObj) paramsObj = {};
        for (const [key, value] of Object.entries(visitorInfo.extraParams)) {
          if (!(key in paramsObj)) {
            paramsObj[key] = value;
          }
        }
      }
      
      // 获取当前页面 URL 作为 fromUrl
      const currentUrl = window.location.href;

      // 检测设备类型
      const getDeviceType = (): string => {
        const ua = navigator.userAgent;
        if (/Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
          return 'Mobile';
        }
        if (/Tablet|iPad/i.test(ua)) {
          return 'Tablet';
        }
        return 'Desktop';
      };

      const response = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          visitorName: finalVisitorName,
          business,
          email: visitorInfo.email,
          phone: visitorInfo.phone,
          pid: visitorInfo.pid,
          params: paramsObj,
          fromUrl: currentUrl,
          lang: visitorInfo.lang || navigator.language,
          device: getDeviceType(),
          avatar: visitorInfo.avatar,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        localStorage.setItem(SESSION_ID_KEY, result.data.id);
        if (result.data.visitorName) {
          localStorage.setItem(VISITOR_NAME_KEY, result.data.visitorName);
        }
        // ★ PWA 归属修复：保存 business slug 到 localStorage
        //   确保 PWA 重启后能通过 localStorage 恢复商家归属
        if (business) {
          localStorage.setItem(BUSINESS_SLUG_KEY, business);
          console.log('[ChatStore] Saved business to localStorage:', business);
        } else if (result.data.businessSlug && result.data.businessSlug !== 'default') {
          localStorage.setItem(BUSINESS_SLUG_KEY, result.data.businessSlug);
          console.log('[ChatStore] Saved business from session.businessSlug:', result.data.businessSlug);
        }
        // Sync session ID and business to URL
        updateUrlSessionId(result.data.id);
        set({ session: result.data, loading: false });

        // Load initial messages
        get().loadMessages();

        // Connect SSE (will fallback to polling if it fails)
        get().connectSSE();
      } else {
        const rawErr = result.error || 'Failed to initialize session';
        let displayError = rawErr;
        if (rawErr.includes('BUSINESS_NOT_FOUND')) {
          displayError = '该商家不存在或尚未激活，请确认访问链接是否正确';
        }
        set({ error: displayError, loading: false });
      }
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : String(error);
      let displayError = rawMsg;
      if (rawMsg.includes('BUSINESS_NOT_FOUND')) {
        displayError = '该商家不存在或尚未激活，请确认访问链接是否正确';
      } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
        displayError = '网络连接失败，请检查网络后重试';
      }
      set({
        error: displayError,
        loading: false,
      });
    }
  },

  // Set visitor name
  setVisitorName: (name: string) => {
    localStorage.setItem(VISITOR_NAME_KEY, name);
    if (get().session) {
      set({ session: { ...get().session!, visitorName: name } });
    }
  },

  // Load messages with pagination
  loadMessages: async (before?: number) => {
    const { session, messages } = get();
    if (!session) return;

    set({ loading: true, error: null });

    try {
      const params = new URLSearchParams({ sessionId: session.id, limit: '20' });
      if (before) {
        params.set('before', before.toString());
      }

      const response = await fetch(`/api/chat/messages?${params}`);
      const result = await response.json();

      if (result.success) {
        // Prepend older messages
        const newMessages = result.data as Message[];
        // Update last message time for polling
        if (newMessages.length > 0) {
          lastMessageTime = Math.max(lastMessageTime, new Date(newMessages[0].createdAt).getTime());
        }
        set({
          messages: before ? [...newMessages, ...messages] : newMessages,
          hasMore: result.hasMore,
          loading: false,
        });
      } else {
        set({ error: result.error || 'Failed to load messages', loading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  // Check for new messages (used by polling)
  checkNewMessages: async () => {
    const { session, messages } = get();
    if (!session) {
      console.log('[ChatStore] No session, skipping polling');
      return;
    }

    console.log(`[ChatStore] Checking new messages for session ${session.id}, current status: ${session.status}`);

    try {
      // First check session status
      console.log('[ChatStore] Fetching session status...');
      // ★ PWA 归属修复：business 优先从 URL 读取，其次从 localStorage 恢复
      let business = getUrlBusiness();
      if (!business) {
        business = localStorage.getItem(BUSINESS_SLUG_KEY) || undefined;
      }
      const sessionResponse = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, business }),
      });
      const sessionResult = await sessionResponse.json();
      console.log('[ChatStore] Session status response:', JSON.stringify(sessionResult));

      if (sessionResult.success && sessionResult.data) {
        const updatedSession = sessionResult.data;
        console.log(`[ChatStore] Updated session status: ${updatedSession.status}, current status: ${session.status}`);
        
        // If session is now closed and was not closed before, update state immediately
        if (updatedSession.status === 'closed' && session.status !== 'closed') {
          console.log('[ChatStore] Session closed detected! Clearing messages and stopping polling');
          // Clear messages when session is closed
          set({ session: updatedSession, messages: [] });
          // Stop polling since session is closed
          get().stopPolling();
          // Disconnect SSE
          get().disconnectSSE();
          return;
        }

        // Update session if there are any changes (including staff assignment)
        const staffChanged = updatedSession.assignedStaffId !== session.assignedStaffId;
        
        if (updatedSession.status !== session.status || 
            updatedSession.unreadByVisitor !== session.unreadByVisitor ||
            staffChanged) {
          console.log('[ChatStore] Updating session state, staffChanged:', staffChanged);
          set({ session: updatedSession });
        }

        // ★ 关键修复：分配客服变化时，立即重新检查该客服的在线状态
        if (staffChanged) {
          console.log('[ChatStore] Assigned staff changed, re-checking online status...');
          // 延迟一小段时间后检查（确保 session 状态已更新）
          setTimeout(() => get().checkStaffOnline(), 50);
        }
      } else {
        console.log('[ChatStore] Failed to get session status:', sessionResult.error);
      }

      // Only check messages if session is still active
      if (session.status !== 'closed') {
        console.log('[ChatStore] Session is active, checking for new messages');
        const params = new URLSearchParams({ sessionId: session.id, limit: '50' });
        const response = await fetch(`/api/chat/messages?${params}`);
        const result = await response.json();

        if (result.success && result.data) {
          const serverMessages = result.data as Message[];
          console.log(`[ChatStore] Found ${serverMessages.length} messages from server`);
          
          // Check if any messages have updated isRead status
          // ★ 同时同步 server 端的 translatedContent（仅在本地无手动翻译时采用）
          let hasReadStatusChanges = false;
          const updatedMessages = messages.map((localMsg) => {
            const serverMsg = serverMessages.find((m) => m.id === localMsg.id);
            if (!serverMsg) return localMsg;
            
            const updated = { ...localMsg };
            let hasChanges = false;
            
            // 同步已读状态
            if (serverMsg.isRead !== localMsg.isRead) {
              updated.isRead = serverMsg.isRead;
              hasChanges = true;
              hasReadStatusChanges = true;
              console.log(`[ChatStore] Message ${localMsg.id} isRead: ${localMsg.isRead} → ${serverMsg.isRead}`);
            }
            
            // ★ 同步翻译内容：只在本地没有翻译时采用 server 端的
            //   如果本地已有翻译（用户手动翻译过），保护不被覆盖
            if (serverMsg.translatedContent && !localMsg.translatedContent) {
              updated.translatedContent = serverMsg.translatedContent;
              updated.translateEngine = serverMsg.translateEngine;
              hasChanges = true;
              console.log(`[ChatStore] Message ${localMsg.id} accepted server translation via ${serverMsg.translateEngine}`);
            } else if (serverMsg.translatedContent && localMsg.translatedContent) {
              // 本地已有翻译，保持本地版本不变
              console.log(`[ChatStore] Message ${localMsg.id} keeping local translation (manual override protection)`);
            }
            
            return hasChanges ? updated : localMsg;
          });

          // Find messages newer than our last known message (use ID-based dedup)
          const existingIds = new Set(updatedMessages.map((m) => m.id));
          const freshMessages = serverMessages.filter((m) => !existingIds.has(m.id));
          console.log(`[ChatStore] Found ${freshMessages.length} fresh messages`);

          // Check if we need to update
          if (freshMessages.length > 0 || hasReadStatusChanges) {
            // ★ 已读状态变化：直接更新消息列表
            if (hasReadStatusChanges && freshMessages.length === 0) {
              set({ messages: updatedMessages });
            }

            // ★ 核心修复：新消息必须通过 addMessage 添加以触发通知
            if (freshMessages.length > 0) {
              console.log(`[ChatStore] Found ${freshMessages.length} new messages via polling, dispatching via addMessage`);
              for (const msg of freshMessages) {
                get().addMessage(msg);
              }
            }
          }
        } else {
          console.log('[ChatStore] Failed to get messages:', result.error);
        }
      } else {
        console.log('[ChatStore] Session is closed, skipping message check');
      }
    } catch (error) {
      console.error('[ChatStore] Polling error:', error);
    }
  },

  // Send text message
  sendMessage: async (content: string, type: ContentType) => {
    const { session } = get();
    if (!session || !content.trim()) return;
    
    // Prevent sending messages if session is closed
    if (session.status === 'closed') {
      set({ error: 'Session has ended. Please restart the conversation.' });
      return;
    }

    set({ sending: true, error: null });

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          contentType: type,
          content: content.trim(),
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        // 服务器返回 { message, autoReply? }，分别处理
        if (result.data.message) {
          get().addMessage(result.data.message);
        }
        if (result.data.autoReply) {
          get().addMessage(result.data.autoReply);
        }
        set({ sending: false });
      } else {
        set({ error: result.error || 'Failed to send message', sending: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        sending: false,
      });
    }
  },

  // Upload file
  uploadFile: async (file: File) => {
    const { session } = get();
    if (!session) return;

    set({ sending: true, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', session.id);

      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data) {
        get().addMessage(result.data);
        set({ sending: false });
      } else {
        set({ error: result.error || 'Failed to upload file', sending: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        sending: false,
      });
    }
  },

  // Mark messages as read
  markAsRead: async () => {
    const { session } = get();
    if (!session) return;

    try {
      await fetch(`/api/chat/read/${session.id}`, { method: 'PUT' });
      // Update local state
      set({
        messages: get().messages.map((m) => ({ ...m, isRead: true })),
        session: { ...session, unreadByVisitor: 0 },
      });
      // 已读后停止标题闪烁
      stopUnreadTitleFlash();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  },

  // Add message from SSE or polling
  addMessage: (message: Message) => {
    const { messages, session } = get();
    // Avoid duplicates
    if (messages.some((m) => m.id === message.id)) return;

    // Update last message time
    lastMessageTime = Math.max(lastMessageTime, new Date(message.createdAt).getTime());

    const isStaffMessage = message.senderType === 'staff';

    const updatedSession = session
      ? {
          ...session,
          lastMessageAt: message.createdAt,
          unreadByVisitor: isStaffMessage ? session.unreadByVisitor + 1 : session.unreadByVisitor,
        }
      : null;

    set({
      messages: [...messages, message],
      session: updatedSession,
    });

    // ★ 新消息通知：当收到客服消息时触发
    if (isStaffMessage) {
      // 音频提示
      playNotificationSound();

      // 桌面通知（仅页面不可见时）
      const staffName = session?.assignedStaffName || '客服';
      const preview = typeof message.content === 'string'
        ? message.content
        : `[${message.contentType || 'message'}]`;
      notifyNewStaffMessage(staffName, preview, session?.id, session?.businessSlug, message.id);

      // 闪烁标题栏（未读消息数）
      if (updatedSession) {
        startUnreadTitleFlash(updatedSession.unreadByVisitor);
      }
    }
  },

  // Update session from SSE
  updateSession: (sessionUpdate: Partial<Session>) => {
    const { session } = get();
    if (session && sessionUpdate) {
      const updatedSession = { ...session, ...sessionUpdate } as Session;
      // If session is closed, clear messages immediately
      if (updatedSession.status === 'closed' && session.status !== 'closed') {
        set({ session: updatedSession, messages: [] });
      } else {
        set({ session: updatedSession });
      }
    }
  },

  // Connect to SSE (with polling fallback)
  connectSSE: () => {
    const { session } = get();
    if (!session || eventSource) return;

    // Always start polling as backup (Workers SSE may not broadcast correctly)
    get().startPolling();

    eventSource = new EventSource(`/api/chat/sse/${session.id}`);

    eventSource.onopen = () => {
      set({ sseConnected: true });
    };

    // Handle named 'message' events (server sends event: message)
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message) {
          get().addMessage(data.message);
        }
      } catch (error) {
        console.error('SSE message parse error:', error);
      }
    });

    eventSource.addEventListener('session_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.session) {
          get().updateSession(data.session);
        }
      } catch (error) {
        console.error('SSE session_update parse error:', error);
      }
    });

    eventSource.addEventListener('message_read', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.sessionId && data.messageIds && Array.isArray(data.messageIds)) {
          console.log(`[ChatStore] SSE message_read received for session ${data.sessionId}, messageIds: ${data.messageIds}`);
          const messageIdsSet = new Set(data.messageIds);
          set({
            messages: get().messages.map((m) =>
              messageIdsSet.has(m.id) ? { ...m, isRead: true } : m
            ),
          });
        }
      } catch (error) {
        console.error('SSE message_read parse error:', error);
      }
    });

    eventSource.addEventListener('connected', (event) => {
      console.log('SSE connected:', event.data);
      set({ sseConnected: true });
    });

    eventSource.addEventListener('heartbeat', () => {
      // Keep alive, no action needed
    });

    eventSource.onerror = () => {
      set({ sseConnected: false });
      // Polling is already running as backup
      // Auto-reconnect SSE after 30 seconds
      const currentEventSource = eventSource;
      setTimeout(() => {
        if (get().session && eventSource === currentEventSource) {
          eventSource?.close();
          eventSource = null;
          get().connectSSE();
        }
      }, 30000);
    };
  },

  // Disconnect SSE
  disconnectSSE: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    set({ sseConnected: false });
  },

  // Start polling for new messages
  startPolling: () => {
    if (pollingInterval) {
      console.log('[ChatStore] Polling already running, skipping');
      return; // Already polling
    }

    set({ usePolling: true });
    console.log('[ChatStore] Starting message polling (SSE fallback)');

    pollingCycleCount = 0;

    // Poll every 3 seconds
    pollingInterval = setInterval(() => {
      console.log('[ChatStore] Polling for new messages...');
      get().checkNewMessages();
      
      // ★ 关键修复：每 5 个轮询周期（约 15 秒）重新检测已分配客服是否在线
      pollingCycleCount++;
      if (pollingCycleCount % 5 === 0) {
        const { session } = get();
        if (session?.assignedStaffId) {
          console.log('[ChatStore] Periodic check: re-checking assigned staff online status...');
          get().checkStaffOnline();
        }
      }
    }, 3000);
  },

  // Stop polling
  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    set({ usePolling: false });
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Reset session - create new session when current one is closed
  resetSession: async () => {
    // Stop polling and disconnect SSE
    get().stopPolling();
    get().disconnectSSE();

    // Clear localStorage - remove session ID and visitor name ONLY
    // ★ 保留 BUSINESS_SLUG_KEY，确保 PWA 重启后商家归属不丢失
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(VISITOR_NAME_KEY);
    
    // Clear URL session param but KEEP business param
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    // ★ 确保 business 参数在 URL 中（从 localStorage 恢复）
    if (!url.searchParams.get('business')) {
      const savedBusiness = localStorage.getItem(BUSINESS_SLUG_KEY);
      if (savedBusiness) {
        url.searchParams.set('business', savedBusiness);
      }
    }
    window.history.replaceState({}, '', url.toString());

    // Reset state - clear all messages and session info
    set({
      session: null,
      messages: [],
      hasMore: false,
      loading: true,
      error: null,
      sseConnected: false,
      usePolling: false,
      assignedStaffOnline: null,
    });

    // Reset last message time
    lastMessageTime = 0;

    // Initialize new session
    await get().initSession();
  },

  // Check if staff is online
  // - 已分配客服：检查该特定客服是否在线
  // - 未分配客服：检查是否有任意在线客服
  checkStaffOnline: async () => {
    const { session } = get();
    try {
      // ★ PWA 归属修复：business 优先从 URL 读取，其次从 localStorage 恢复
      let business = getUrlBusiness();
      if (!business) {
        business = localStorage.getItem(BUSINESS_SLUG_KEY) || undefined;
      }
      const params = new URLSearchParams();
      if (business) {
        params.set('business', business);
      }
      
      // ★ 关键修复：如果已分配客服，检查该客服是否在线
      if (session?.assignedStaffId) {
        params.set('staffId', String(session.assignedStaffId));
      }
      
      const response = await fetch(`/api/chat/staff/online?${params}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        
        if (data.isAssignedStaffOnline !== undefined) {
          // 检查的是特定客服
          set({
            staffOnline: data.isOnline,
            assignedStaffOnline: data.isAssignedStaffOnline,
          });
          console.log(`[ChatStore] Assigned staff #${data.staffId} (${data.staffName}) online:`, data.isAssignedStaffOnline);
        } else {
          // 检查的是任意客服
          set({ staffOnline: data.isOnline });
        }
      }
    } catch (error) {
      console.error('Check staff online error:', error);
    }
  },
}));
