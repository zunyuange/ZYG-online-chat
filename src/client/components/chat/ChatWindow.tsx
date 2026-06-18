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
  staffOnline?: boolean;
  session?: Session | null;
  t?: (key: string) => string;
  locale?: string;
  setLocale?: (locale: string) => void;
  supportedLocales?: LocaleOption[];
  onRestart?: () => void;
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
  staffOnline,
  session,
  t = (key: string) => key,
  locale,
  setLocale,
  supportedLocales = [],
  onRestart,
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
    backgroundColor: staffOnline === false ? '#999' : (sseConnected ? '#52c41a' : (usePolling ? '#faad14' : '#ff4d4f')),
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
    width: '90%',
    maxWidth: '320px',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
  };

  const langModalTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1a1a2e',
    padding: '20px 24px',
    textAlign: 'center',
    borderBottom: '1px solid #eee',
    flexShrink: 0,
  };

  const langOptionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '16px 24px 24px',
    overflowY: 'auto',
    flexGrow: 1,
  };

  const langOptionStyle: React.CSSProperties = {
    width: 'calc(50% - 4px)',
    padding: '12px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#f5f5f5',
    color: '#333',
    fontSize: '14px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    boxSizing: 'border-box',
  };

  const getStatusText = () => {
    if (staffOnline === false) return t('service_offline');
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
              style={{ ...langButtonStyle, padding: '2px' }}
              title={t('select_language')}
            >
              <img 
                src="/icons/lang.png" 
                alt="Language" 
                style={{ width: '20px', height: '20px' }}
              />
            </button>
          )}
        </div>
      </div>

      {/* Language Selection Modal */}
      {showLangModal && (
        <div style={langModalOverlayStyle} onClick={() => setShowLangModal(false)}>
          <div style={langModalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={langModalTitleStyle}>{t('select_language')}</div>
            <div style={langOptionsContainerStyle}>
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
          t={t}
        />
      )}

      {/* Message List - scrollable area */}
      <MessageList
        messages={messages}
        hasMore={hasMore}
        loading={loading}
        isOwn={isOwn}
        onLoadMore={onLoadMore}
        t={t}
      />

      {/* Session ended notice */}
      {session?.status === 'closed' && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fff2f0',
          borderTop: '1px solid #ffccc7',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '14px', color: '#d93026', fontWeight: 500 }}>
            {t('session_ended')}
          </div>
          <div style={{ fontSize: '12px', color: '#d93026', marginTop: '4px' }}>
            {t('session_ended_tip')}
          </div>
          <button
            onClick={onRestart}
            style={{
              marginTop: '12px',
              padding: '8px 24px',
              backgroundColor: '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#40a9ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1890ff';
            }}
          >
            {t('restart_conversation')}
          </button>
        </div>
      )}

      {/* Input - fixed at bottom */}
      {session?.status !== 'closed' && (
        <MessageInput
          onSend={onSend}
          onUpload={onUpload}
          sending={sending}
          t={t}
        />
      )}
    </div>
  );
}