/**
 * Chat store - User/Visitor state management
 */

import { create } from 'zustand';
import type { Session, Message, ContentType } from '@shared/types';

// LocalStorage keys
const SESSION_ID_KEY = 'chat_session_id';
const VISITOR_NAME_KEY = 'chat_visitor_name';

// URL helper functions
const getUrlSessionId = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('s');
};

const getUrlBusiness = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('business');
};

// 从 URL 参数读取访客自定义信息
const getVisitorInfoFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    userName: params.get('userName') || undefined,
    email: params.get('email') || undefined,
    phone: params.get('phone') || undefined,
    pid: params.get('pid') || undefined,
    groupId: params.get('groupId') || undefined,
    adminId: params.get('adminId') || undefined,
    paramsStr: params.get('params') || undefined,
    lang: params.get('lang') || undefined,
    avatar: params.get('avatar') || undefined,
  };
};

const updateUrlSessionId = (sessionId: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set('s', sessionId);
  // Preserve business parameter if present
  const business = getUrlBusiness();
  if (business) {
    url.searchParams.set('business', business);
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
  staffOnline: boolean; // 是否有客服在线

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
}

// EventSource reference
let eventSource: EventSource | null = null;
// Polling interval reference
let pollingInterval: ReturnType<typeof setInterval> | null = null;
// Track last message time for polling
let lastMessageTime: number = 0;

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

  // Initialize session from URL, localStorage or create new
  initSession: async () => {
    set({ loading: true, error: null });

    try {
      // Priority: URL param > localStorage
      const urlSessionId = getUrlSessionId();
      const sessionId = urlSessionId || localStorage.getItem(SESSION_ID_KEY);
      const visitorName = localStorage.getItem(VISITOR_NAME_KEY) || undefined;
      const business = getUrlBusiness();
      
      // 从 URL 获取访客自定义信息
      const visitorInfo = getVisitorInfoFromUrl();
      // 如果 URL 传了 userName，优先使用
      const finalVisitorName = visitorInfo.userName || visitorName;
      
      // 解析 params JSON 字符串
      let paramsObj: Record<string, string> | undefined;
      if (visitorInfo.paramsStr) {
        try {
          paramsObj = JSON.parse(visitorInfo.paramsStr);
        } catch {
          console.warn('[ChatStore] Failed to parse params JSON:', visitorInfo.paramsStr);
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
        // Sync session ID to URL
        updateUrlSessionId(result.data.id);
        set({ session: result.data, loading: false });

        // Load initial messages
        get().loadMessages();

        // Connect SSE (will fallback to polling if it fails)
        get().connectSSE();
      } else {
        set({ error: result.error || 'Failed to initialize session', loading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
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
          lastMessageTime = Math.max(lastMessageTime, newMessages[0].createdAt);
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
      const business = getUrlBusiness();
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

        // Update session if there are any changes
        if (updatedSession.status !== session.status || 
            updatedSession.unreadByVisitor !== session.unreadByVisitor) {
          console.log('[ChatStore] Updating session state');
          set({ session: updatedSession });
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
          let hasReadStatusChanges = false;
          const updatedMessages = messages.map((localMsg) => {
            const serverMsg = serverMessages.find((m) => m.id === localMsg.id);
            if (serverMsg && serverMsg.isRead !== localMsg.isRead) {
              hasReadStatusChanges = true;
              console.log(`[ChatStore] Message ${localMsg.id} read status changed from ${localMsg.isRead} to ${serverMsg.isRead}`);
              return { ...localMsg, isRead: serverMsg.isRead };
            }
            return localMsg;
          });

          // Find messages newer than our last known message
          const latestTime = messages.length > 0 ? messages[messages.length - 1].createdAt : 0;
          const freshMessages = serverMessages.filter((m) => m.createdAt > latestTime);
          console.log(`[ChatStore] Found ${freshMessages.length} fresh messages`);

          // Check if we need to update
          if (freshMessages.length > 0 || hasReadStatusChanges) {
            // Add only new messages (avoid duplicates)
            const existingIds = new Set(updatedMessages.map((m) => m.id));
            const toAdd = freshMessages.filter((m) => !existingIds.has(m.id));
            console.log(`[ChatStore] Adding ${toAdd.length} new messages`);
            
            const finalMessages = [...updatedMessages, ...toAdd];
            console.log(`[ChatStore] Updating messages, total: ${finalMessages.length}`);
            set({ messages: finalMessages });
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
        // Message will be added via SSE/polling, but add immediately for better UX
        get().addMessage(result.data);
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
    lastMessageTime = Math.max(lastMessageTime, message.createdAt);

    set({
      messages: [...messages, message],
      session: session
        ? {
            ...session,
            lastMessageAt: message.createdAt,
            unreadByVisitor: message.senderType === 'staff' ? session.unreadByVisitor + 1 : session.unreadByVisitor,
          }
        : null,
    });
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

    // Handle generic messages (no event type)
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message) {
          get().addMessage(data.message);
        } else if (data.type === 'session_update' && data.session) {
          get().updateSession(data.session);
        }
      } catch (error) {
        console.error('SSE parse error:', error);
      }
    };

    // Handle specific event types
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

    // Poll every 3 seconds
    pollingInterval = setInterval(() => {
      console.log('[ChatStore] Polling for new messages...');
      get().checkNewMessages();
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

    // Clear localStorage - remove both session ID and visitor name
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(VISITOR_NAME_KEY);
    
    // Clear URL session param
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
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
    });

    // Reset last message time
    lastMessageTime = 0;

    // Initialize new session
    await get().initSession();
  },

  // Check if staff is online
  checkStaffOnline: async () => {
    try {
      const business = getUrlBusiness();
      const params = new URLSearchParams();
      if (business) {
        params.set('business', business);
      }
      
      const response = await fetch(`/api/chat/staff/online?${params}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        set({ staffOnline: result.data.isOnline });
      }
    } catch (error) {
      console.error('Check staff online error:', error);
    }
  },
}));
