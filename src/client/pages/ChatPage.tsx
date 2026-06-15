/**
 * Chat Page - User/Visitor chat interface
 */

import { useEffect } from 'react';
import type { ContentType } from '@shared/types';
import { useChatStore } from '@client/stores/chatStore';
import { ChatWindow } from '@client/components/chat/ChatWindow';
import { PWAInstallPrompt } from '@client/components/chat/PWAInstallPrompt';
import { useI18n } from '@client/context/I18nContext';

export function ChatPage() {
  const { t, locale, setLocale, supportedLocales } = useI18n();
  
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

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e8e8e8',
  };

  const langSelectStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #d9d9d9',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
  };

  if (!session && loading) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <span>{t('service_title')}</span>
          <select value={locale} onChange={(e) => setLocale(e.target.value as any)} style={langSelectStyle}>
            {supportedLocales.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </div>
        <div style={loadingStyle}>
          {t('hello')} {t('tip_waiting')}
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header with language selector */}
      <div style={headerStyle}>
        <span>{t('service_title')}</span>
        <select value={locale} onChange={(e) => setLocale(e.target.value as any)} style={langSelectStyle}>
          {supportedLocales.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName}
            </option>
          ))}
        </select>
      </div>

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
        title={t('service_title')}
        visitorName={session?.visitorName}
        sseConnected={sseConnected}
        usePolling={usePolling}
        session={session}
        t={t}
        locale={locale}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}