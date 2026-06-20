/**
 * Chat Page - User/Visitor chat interface
 */

import { useEffect } from 'react';
import type { ContentType } from '@shared/types';
import { useChatStore } from '@client/stores/chatStore';
import { ChatWindow } from '@client/components/chat/ChatWindow';
import { PWAInstallPrompt } from '@client/components/chat/PWAInstallPrompt';
import { useI18n } from '@client/context/I18nContext';
import { useSiteSettings } from '@client/hooks/useSiteSettings';

export function ChatPage() {
  const { t, locale, setLocale, supportedLocales } = useI18n();
  const { siteName } = useSiteSettings();
  
  const {
    session,
    messages,
    hasMore,
    loading,
    sending,
    sseConnected,
    usePolling,
    staffOnline,
    error,
    initSession,
    loadMessages,
    sendMessage,
    uploadFile,
    markAsRead,
    clearError,
    resetSession,
    checkStaffOnline,
  } = useChatStore();

  // Initialize session on mount
  useEffect(() => {
    initSession();
    checkStaffOnline();
  }, [initSession, checkStaffOnline]);

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

  const handleRestart = () => {
    resetSession();
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

  // Use business name if available, otherwise fall back to siteName or default
  const chatTitle = session?.businessName || siteName || t('service_title');

  if (!session && loading) {
    return (
      <div style={pageStyle}>
        <div style={loadingStyle}>
          {t('hello')} {t('tip_waiting')}
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
        title={chatTitle}
        visitorName={session?.visitorName}
        sseConnected={sseConnected}
        usePolling={usePolling}
        staffOnline={staffOnline}
        session={session}
        t={t as any}
        locale={locale}
        setLocale={setLocale as any}
        supportedLocales={supportedLocales}
        onRestart={handleRestart}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}