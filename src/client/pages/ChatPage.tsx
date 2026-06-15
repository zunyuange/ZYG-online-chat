/**
 * Chat Page - User/Visitor chat interface
 */

import { useEffect } from 'react';
import type { ContentType } from '@shared/types';
import { useChatStore } from '@client/stores/chatStore';
import { ChatWindow } from '@client/components/chat/ChatWindow';
import { PWAInstallPrompt } from '@client/components/chat/PWAInstallPrompt';

export function ChatPage() {
  const {
    session,
    messages,
    hasMore,
    loading,
    sending,
    sseConnected,
    usePolling,
    error,
    initSession,
    loadMessages,
    sendMessage,
    uploadFile,
    markAsRead,
    clearError,
  } = useChatStore();

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, [initSession]);

  // Mark as read when window gets focus
  useEffect(() => {
    const handleFocus = () => {
      if (session && session.unreadByVisitor > 0) {
        markAsRead();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [session, markAsRead]);

  const handleSend = (content: string, type: ContentType) => {
    sendMessage(content, type);
  };

  const handleUpload = (file: File) => {
    uploadFile(file);
  };

  const handleLoadMore = () => {
    if (messages.length > 0) {
      loadMessages(messages[0].id);
    }
  };

  // Full page container - no scroll, fixed height
  const pageStyle: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  };

  const errorStyle: React.CSSProperties = {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#ff4d4f',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '8px',
    zIndex: 1001,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '16px',
    color: '#999',
  };

  if (!session && loading) {
    return (
      <div style={pageStyle}>
        <div style={loadingStyle}>
          正在连接...
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Error toast */}
      {error && (
        <div style={errorStyle}>
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Chat Window - takes full height */}
      <ChatWindow
        messages={messages}
        hasMore={hasMore}
        loading={loading}
        sending={sending}
        onLoadMore={handleLoadMore}
        onSend={handleSend}
        onUpload={handleUpload}
        isOwn={(message) => message.senderType === 'visitor'}
        title={`在线客服`}
        visitorName={session?.visitorName}
        sseConnected={sseConnected}
        usePolling={usePolling}
        session={session}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}