/**
 * Chat Window Component - Main chat interface
 */

import { useState } from 'react';
import type { Message, Session, ContentType } from '@shared/types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TopicHeader } from './TopicHeader';

interface LocaleOption {
  code: string;
  nativeName: string;
}

interface ChatWindowProps {
  messages: Message[];
  hasMore: boolean;
  loading: boolean;
  sending: boolean;
  onLoadMore: () => void;
  onSend: (content: string, type: ContentType) => void;
  onUpload: (file: File) => void;
  isOwn: (message: Message) => boolean;
  title?: string;
  visitorName?: string;
  sseConnected?: boolean;
  usePolling?: boolean;
  session?: Session | null;
  t?: (key: string) => string;
  locale?: string;
  setLocale?: (locale: string) => void;
  supportedLocales?: LocaleOption[];
}

export function ChatWindow({
  messages,
  hasMore,
  loading,
  sending,
  onLoadMore,
  onSend,
  onUpload,
  isOwn,
  title = '在线客服',
  visitorName,
  sseConnected,
  usePolling,
  session,
  t = (key: string) => key,
  locale,
  setLocale,
  supportedLocales = [],
}: ChatWindowProps) {
  const [showLangModal, setShowLangModal] = useState(false);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#1890ff',
    color: '#fff',
    flexShrink: 0,
  };

  const statusStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    opacity: 0.9,
  };

  const dotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: sseConnected ? '#52c41a' : usePolling ? '#faad14' : '#ff4d4f',
  };

  const langButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
    transition: 'opacity 0.2s',
  };

  const langModalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const langModalStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    width: '90%',
    maxWidth: '320px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  };

  const langModalTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: '20px',
    textAlign: 'center',
  };

  const langOptionStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#f5f5f5',
    cursor: 'pointer',
    fontSize: '16px',
    textAlign: 'left',
    marginBottom: '8px',
    transition: 'background-color 0.2s',
  };

  const getStatusText = () => {
    if (sseConnected) return t('service_online');
    if (usePolling) return 'Polling...';
    return 'Connecting...';
  };

  const handleLangSelect = (selectedLocale: string) => {
    if (setLocale) {
      setLocale(selectedLocale);
    }
    setShowLangModal(false);
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 500 }}>{title}</div>
          {visitorName && (
            <div style={{ fontSize: '12px', opacity: 0.8 }}>{visitorName}</div>
          )}
        </div>
        <div style={statusStyle}>
          <span style={dotStyle}></span>
          <span>{getStatusText()}</span>
          {setLocale && supportedLocales.length > 0 && (
            <button
              onClick={() => setShowLangModal(true)}
              style={langButtonStyle}
              title={t('select_language')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 2 12 12 15 15"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Language Selection Modal */}
      {showLangModal && (
        <div style={langModalOverlayStyle} onClick={() => setShowLangModal(false)}>
          <div style={langModalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={langModalTitleStyle}>{t('select_language')}</div>
            {supportedLocales.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLangSelect(l.code)}
                style={{
                  ...langOptionStyle,
                  backgroundColor: locale === l.code ? '#1890ff' : '#f5f5f5',
                  color: locale === l.code ? '#fff' : '#333',
                }}
              >
                {l.nativeName}
                {locale === l.code && (
                  <span style={{ float: 'right' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Topic Header (user view - read only) - 始终显示让用户看到状态 */}
      {session && (
        <TopicHeader
          session={session}
          editable={false}
          queuePosition={session.queuePosition}
          estimatedWaitMinutes={session.estimatedWaitMinutes}
          compact={true}
        />
      )}

      {/* Message List - scrollable area */}
      <MessageList
        messages={messages}
        hasMore={hasMore}
        loading={loading}
        isOwn={isOwn}
        onLoadMore={onLoadMore}
      />

      {/* Input - fixed at bottom */}
      <MessageInput
        onSend={onSend}
        onUpload={onUpload}
        sending={sending}
        t={t}
      />
    </div>
  );
}