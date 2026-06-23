/**
 * Staff store - Customer service state management
 */

import { create } from 'zustand';
import type { Session, Message, ContentType, TaskStatus, InputMode } from '@shared/types';
import { authFetch } from '@client/services/authFetch';
import { playNotificationSound } from '@client/utils/notificationSound';
import {
  notifyNewVisitorMessage,
  notifyNewVisitorSession,
  startUnreadTitleFlash,
  stopUnreadTitleFlash,
} from '@client/services/notificationService';

interface SessionWithPreview extends Session {
  lastMessage?: {
    content: string;
    contentType: string;
    senderType: string;
    createdAt: Date;
  };
}

interface StaffState {
  // Data state
  sessions: SessionWithPreview[];
  currentSessionId: string | null;
  messages: Map<string, Message[]>;
  hasMore: Map<string, boolean>;
  totalUnread: number;
  user: { userId: number; username: string; businessId: number; role: string } | null;

  // UI state
  loading: boolean;
  messagesLoading: boolean;
  sending: boolean;
  error: string | null;
  sseConnected: boolean;
  usePolling: boolean; // Fallback for Workers environment
  inputMode: InputMode; // 新增：输入模式

  // Actions
  loadSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  checkNewMessages: () => Promise<void>;
  sendMessage: (content: string, type: ContentType) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  markAsRead: (sessionId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateSession: (session: Partial<Session> & { id: string }) => void;
  initFromUrl: () => Promise<void>;
  connectSSE: () => void;
  disconnectSSE: () => void;
  startPolling: () => void;
  stopPolling: () => void;
  clearError: () => void;
  setUser: (user: { userId: number; username: string; businessId: number; role: string }) => void;
  // 新增：主题和状态管理
  setInputMode: (mode: InputMode) => void;
  updateTopic: (sessionId: string, topic: string) => Promise<void>;
  updateTaskStatus: (sessionId: string, status: TaskStatus) => Promise<void>;
  clearMessages: (sessionId: string) => Promise<void>;
}

// EventSource reference
let eventSource: EventSource | null = null;
// Polling interval reference
let pollingInterval: ReturnType<typeof setInterval> | null = null;
// ★ 新访客检测：跟踪已见过的 session ID，用于发现新上线访客
let seenSessionIds: Set<string> = new Set();

export const useStaffStore = create<StaffState>((set, get) => ({
  // Initial state
  sessions: [],
  currentSessionId: null,
  messages: new Map(),
  hasMore: new Map(),
  totalUnread: 0,
  user: null,
  loading: false,
  messagesLoading: false,
  sending: false,
  error: null,
  sseConnected: false,
  usePolling: false,
  inputMode: 'chat', // 新增：默认聊天模式

  // Load sessions list
  loadSessions: async () => {
    set({ loading: true, error: null });

    try {
      const response = await authFetch('/api/staff/sessions?status=active');
      const result = await response.json();

      if (result.success) {
        const sessions = result.data as SessionWithPreview[];

        // Calculate total unread
        const totalUnread = sessions.reduce((sum, s) => sum + s.unreadByStaff, 0);

        // ★ 初始化已见 session 列表（首次加载不触发新访客通知）
        seenSessionIds = new Set(sessions.map((s) => s.id));

        set({ sessions, totalUnread, loading: false });
      } else {
        set({ error: result.error || 'Failed to load sessions', loading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  // Select a session and load messages
  selectSession: async (sessionId: string) => {
    const { messages, sessions, user } = get();

    set({ currentSessionId: sessionId, messagesLoading: true, error: null });

    const session = sessions.find(s => s.id === sessionId);
    
    if (session && !session.assignedStaffId) {
      try {
        const response = await authFetch(`/api/chat/sessions/${sessionId}/accept`, {
          method: 'POST',
        });
        const result = await response.json();
        if (result.success && user) {
          const newSessions = sessions.map(s => 
            s.id === sessionId ? { ...s, assignedStaffId: user.userId } : s
          );
          set({ sessions: newSessions });
        }
      } catch (error) {
        console.error('Failed to accept session:', error);
      }
    }

    // Only load if not already loaded
    if (!messages.has(sessionId)) {
      try {
        const params = new URLSearchParams({ sessionId, limit: '20' });
        const response = await authFetch(`/api/staff/messages?${params}`);
        const result = await response.json();

        if (result.success) {
          const newMessages = new Map(messages);
          newMessages.set(sessionId, result.data as Message[]);

          const newHasMore = new Map(get().hasMore);
          newHasMore.set(sessionId, result.hasMore);

          set({ messages: newMessages, hasMore: newHasMore, messagesLoading: false });
        } else {
          set({ error: result.error || 'Failed to load messages', messagesLoading: false });
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Unknown error',
          messagesLoading: false,
        });
      }
    } else {
      set({ messagesLoading: false });
    }

    // Mark as read
    get().markAsRead(sessionId);
  },

  // Load more messages for current session
  loadMoreMessages: async () => {
    const { currentSessionId, messages, hasMore } = get();
    if (!currentSessionId || !hasMore.get(currentSessionId)) return;

    const currentMessages = messages.get(currentSessionId) || [];
    const oldestMessage = currentMessages[0];
    if (!oldestMessage) return;

    set({ messagesLoading: true, error: null });

    try {
      const params = new URLSearchParams({
        sessionId: currentSessionId,
        before: oldestMessage.id.toString(),
        limit: '20',
      });

      const response = await authFetch(`/api/staff/messages?${params}`);
      const result = await response.json();

      if (result.success) {
        const newMessages = new Map(messages);
        newMessages.set(currentSessionId, [...(result.data as Message[]), ...currentMessages]);

        const newHasMore = new Map(hasMore);
        newHasMore.set(currentSessionId, result.hasMore);

        set({ messages: newMessages, hasMore: newHasMore, messagesLoading: false });
      } else {
        set({ error: result.error || 'Failed to load messages', messagesLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        messagesLoading: false,
      });
    }
  },

  // Check for new messages (used by polling)
  checkNewMessages: async () => {
    const { currentSessionId, messages } = get();

    try {
      // Refresh sessions list
      const response = await authFetch('/api/staff/sessions?status=active');
      const result = await response.json();

      if (result.success) {
        const newSessions = result.data as SessionWithPreview[];
        const totalUnread = newSessions.reduce((sum, s) => sum + s.unreadByStaff, 0);
        
        // Debug: Log unread counts from server
        console.log('[StaffStore] Sessions from server:');
        newSessions.forEach(s => {
          console.log(`  - ${s.visitorName}: unreadByStaff=${s.unreadByStaff}`);
        });
        console.log(`[StaffStore] Total unread: ${totalUnread}`);
        
        // Check if current session is still active
        const isCurrentSessionActive = newSessions.some((s) => s.id === currentSessionId);
        
        // If current session is no longer in the active list (it was closed), clear it
        if (currentSessionId && !isCurrentSessionActive) {
          console.log(`[StaffStore] Current session ${currentSessionId} is no longer active, clearing selection`);
          set({ 
            sessions: newSessions, 
            totalUnread,
            currentSessionId: null 
          });
          return;
        }
        
        // ★ 新访客检测：发现之前未见过的 session，触发通知
        if (seenSessionIds.size > 0) {
          for (const s of newSessions) {
            if (!seenSessionIds.has(s.id)) {
              // 新上线访客！
              console.log(`[StaffStore] New visitor detected: ${s.visitorName} (${s.id})`);
              notifyNewVisitorSession(s.visitorName || '访客', s.id, s.businessSlug);
            }
          }
        }
        // 更新已见 session 列表
        seenSessionIds = new Set(newSessions.map((s) => s.id));

        set({ sessions: newSessions, totalUnread });
      }

      // If we have a selected session, check for new messages
      if (currentSessionId) {
        const params = new URLSearchParams({ sessionId: currentSessionId, limit: '50' });
        const msgResponse = await authFetch(`/api/staff/messages?${params}`);
        const msgResult = await msgResponse.json();

        if (msgResult.success && msgResult.data) {
          const serverMessages = msgResult.data as Message[];
          const currentMsgs = messages.get(currentSessionId) || [];
          
          // Check if any messages have updated isRead status
          let hasReadStatusChanges = false;
          const updatedMessages = currentMsgs.map((localMsg) => {
            const serverMsg = serverMessages.find((m) => m.id === localMsg.id);
            if (serverMsg && serverMsg.isRead !== localMsg.isRead) {
              hasReadStatusChanges = true;
              console.log(`[StaffStore] Message ${localMsg.id} read status changed from ${localMsg.isRead} to ${serverMsg.isRead}`);
              return { ...localMsg, isRead: serverMsg.isRead };
            }
            return localMsg;
          });

          // Find new messages
          const existingIds = new Set(currentMsgs.map((m) => m.id));
          const toAdd = serverMessages.filter((m) => !existingIds.has(m.id));

          // Update read status changes
          if (hasReadStatusChanges && toAdd.length === 0) {
            const newMessages = new Map(messages);
            newMessages.set(currentSessionId, updatedMessages);
            set({ messages: newMessages });
          }

          // ★ 关键修复：新消息必须通过 addMessage 添加以触发通知
          if (toAdd.length > 0) {
            console.log(`[StaffStore] Found ${toAdd.length} new messages via polling, dispatching via addMessage`);
            for (const msg of toAdd) {
              get().addMessage(msg);
            }
            // Auto-mark as read after receiving new messages
            get().markAsRead(currentSessionId);
          }
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  },

  // Send message
  sendMessage: async (content: string, type: ContentType) => {
    const { currentSessionId } = get();
    if (!currentSessionId || !content.trim()) return;

    set({ sending: true, error: null });

    try {
      const response = await authFetch('/api/staff/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          contentType: type,
          content: content.trim(),
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        get().addMessage(result.data);
        set({ sending: false });
        // Auto-mark as read after sending message (so visitor sees "read" status)
        get().markAsRead(currentSessionId);
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
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    set({ sending: true, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', currentSessionId);

      const response = await authFetch('/api/staff/upload', {
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

  // Mark session as read
  markAsRead: async (sessionId: string) => {
    try {
      console.log(`[StaffStore] Calling markAsRead for session ${sessionId}`);
      const response = await authFetch(`/api/staff/read/${sessionId}`, { method: 'PUT' });
      const result = await response.json();
      console.log(`[StaffStore] markAsRead response:`, result);

      if (!result.success) {
        console.error(`[StaffStore] markAsRead failed: ${result.error}`);
        return;
      }

      // Update local state
      const { sessions, messages, totalUnread } = get();
      const session = sessions.find((s) => s.id === sessionId);

      if (session && session.unreadByStaff > 0) {
        console.log(`[StaffStore] Updating local state for session ${sessionId}, unreadByStaff: ${session.unreadByStaff}`);
        const newSessions = sessions.map((s) =>
          s.id === sessionId ? { ...s, unreadByStaff: 0 } : s
        );

        const sessionMessages = messages.get(sessionId);
        if (sessionMessages) {
          const newMessages = new Map(messages);
          newMessages.set(
            sessionId,
            sessionMessages.map((m) => ({ ...m, isRead: true }))
          );
          set({
            sessions: newSessions,
            messages: newMessages,
            totalUnread: totalUnread - session.unreadByStaff,
          });
          // ★ 已读后停止标题闪烁
          stopUnreadTitleFlash();
        } else {
          set({
            sessions: newSessions,
            totalUnread: totalUnread - session.unreadByStaff,
          });
          stopUnreadTitleFlash();
        }
      }
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  },

  // Add message from SSE or polling
  addMessage: (message: Message) => {
    const { messages, sessions } = get();
    const sessionId = message.sessionId;

    // Add message to the session's message list
    const sessionMessages = messages.get(sessionId) || [];
    // Avoid duplicates
    if (sessionMessages.some((m) => m.id === message.id)) return;

    const newMessages = new Map(messages);
    newMessages.set(sessionId, [...sessionMessages, message]);

    // Update session's last message and unread count
    const newSessions = sessions.map((s) => {
      if (s.id === sessionId) {
        return {
          ...s,
          lastMessageAt: message.createdAt,
          lastMessage: {
            content: message.content,
            contentType: message.contentType,
            senderType: message.senderType,
            createdAt: message.createdAt,
          },
          unreadByStaff: message.senderType === 'visitor' ? s.unreadByStaff + 1 : s.unreadByStaff,
        };
      }
      return s;
    });

    // Calculate total unread
    const totalUnread = newSessions.reduce((sum, s) => sum + s.unreadByStaff, 0);

    set({ messages: newMessages, sessions: newSessions, totalUnread });

    // ★ 客服端通知：收到访客新消息时触发
    if (message.senderType === 'visitor') {
      // 音频提示音
      playNotificationSound();

      // 桌面通知（页面后台时弹出）
      const session = newSessions.find((s) => s.id === sessionId);
      const visitorName = session?.visitorName || '访客';
      const preview = typeof message.content === 'string'
        ? message.content
        : `[${message.contentType || '消息'}]`;

      notifyNewVisitorMessage(visitorName, preview, sessionId, session?.businessSlug);

      // 标题栏闪烁
      startUnreadTitleFlash(totalUnread);
    }
  },

  // Update session from SSE
  updateSession: (sessionUpdate) => {
    const { sessions } = get();
    const newSessions = sessions.map((s) =>
      s.id === sessionUpdate.id ? { ...s, ...sessionUpdate } : s
    );
    set({ sessions: newSessions });
  },

  // Initialize from URL parameter (for quick access to specific session)
  initFromUrl: async () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('s');

    if (sessionId) {
      // Load sessions first
      await get().loadSessions();
      // Check if session exists in the list
      const { sessions } = get();
      if (sessions.some((s) => s.id === sessionId)) {
        // Auto-select the session
        await get().selectSession(sessionId);
      }
    }
  },

  // Connect to SSE (with polling fallback)
  connectSSE: () => {
    if (eventSource) return;

    // Always start polling as backup (Workers SSE may not broadcast correctly)
    get().startPolling();

    const token = localStorage.getItem('staff_token');
    eventSource = new EventSource(`/api/staff/sse${token ? `?token=${token}` : ''}`);

    eventSource.onopen = () => {
      set({ sseConnected: true });
    };

    // Handle generic messages
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

    eventSource.addEventListener('connected', () => {
      set({ sseConnected: true });
    });

    eventSource.addEventListener('heartbeat', () => {
      // Keep alive
    });

    eventSource.onerror = () => {
      set({ sseConnected: false });
      // Polling is already running as backup
      // Auto-reconnect SSE after 30 seconds
      const currentEventSource = eventSource;
      setTimeout(() => {
        if (eventSource === currentEventSource) {
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
    if (pollingInterval) return; // Already polling

    set({ usePolling: true });
    console.log('Starting message polling (SSE fallback)');

    // Poll every 3 seconds
    pollingInterval = setInterval(() => {
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

  // Set user info
  setUser: (user) => set({ user }),

  // Set input mode
  setInputMode: (mode: InputMode) => set({ inputMode: mode }),

  // Update session topic
  updateTopic: async (sessionId: string, topic: string) => {
    set({ error: null });
    try {
      const response = await authFetch(`/api/staff/sessions/${sessionId}/topic`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        get().updateSession(result.data);
      } else {
        set({ error: result.error || 'Failed to update topic' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Update task status
  updateTaskStatus: async (sessionId: string, status: TaskStatus) => {
    set({ error: null });
    try {
      const response = await authFetch(`/api/staff/sessions/${sessionId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskStatus: status }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        get().updateSession(result.data);
      } else {
        set({ error: result.error || 'Failed to update status' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  // Clear all messages for current session
  clearMessages: async (sessionId: string) => {
    set({ error: null });
    try {
      const response = await authFetch(`/api/staff/messages/${sessionId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        const newMessages = new Map(get().messages);
        newMessages.set(sessionId, []);
        set({ messages: newMessages });
        
        const newSessions = get().sessions.map((s) =>
          s.id === sessionId ? { ...s, unreadByStaff: 0, unreadByVisitor: 0 } : s
        );
        set({ sessions: newSessions, totalUnread: get().totalUnread - (get().sessions.find(s => s.id === sessionId)?.unreadByStaff || 0) });
      } else {
        set({ error: result.error || 'Failed to clear messages' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
}));

export type { SessionWithPreview };
