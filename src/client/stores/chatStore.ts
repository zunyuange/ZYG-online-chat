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

const updateUrlSessionId = (sessionId: string): void => {
  const url = new URL(window.location.href);
  url.searchParams.set('s', sessionId);
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

  // Initialize session from URL, localStorage or create new
  initSession: async () => {
    set({ loading: true, error: null });

    try {
      // Priority: URL param > localStorage
      const urlSessionId = getUrlSessionId();
      const sessionId = urlSessionId || localStorage.getItem(SESSION_ID_KEY);
      const visitorName = localStorage.getItem(VISITOR_NAME_KEY) || undefined;

      const response = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId || undefined, visitorName }),
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
    if (!session) return;

    try {
      const params = new URLSearchParams({ sessionId: session.id, limit: '20' });
      const response = await fetch(`/api/chat/messages?${params}`);
      const result = await response.json();

      if (result.success && result.data) {
        const newMessages = result.data as Message[];
        // Find messages newer than our last known message
        const latestTime = messages.length > 0 ? messages[messages.length - 1].createdAt : 0;
        const freshMessages = newMessages.filter((m) => m.createdAt > latestTime);

        if (freshMessages.length > 0) {
          // Add only new messages (avoid duplicates)
          const existingIds = new Set(messages.map((m) => m.id));
          const toAdd = freshMessages.filter((m) => !existingIds.has(m.id));
          if (toAdd.length > 0) {
            set({ messages: [...messages, ...toAdd] });
          }
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  },

  // Send text message
  sendMessage: async (content: string, type: ContentType) => {
    const { session } = get();
    if (!session || !content.trim()) return;

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
      set({ session: { ...session, ...sessionUpdate } as Session });
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
}));
