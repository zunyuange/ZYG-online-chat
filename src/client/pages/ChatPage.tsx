/**
 * Chat Page - User/Visitor chat interface
 */

import { useEffect, useCallback, useState } from 'react';
import type { ContentType } from '@shared/types';
import { useChatStore } from '@client/stores/chatStore';
import { ChatWindow } from '@client/components/chat/ChatWindow';
import { PWAInstallPrompt } from '@client/components/chat/PWAInstallPrompt';
import { useI18n } from '@client/context/I18nContext';
import { useSiteSettings } from '@client/hooks/useSiteSettings';
import {
  initServiceWorkerForNotification,
  isNotificationGranted,
  isNotificationSupported,
  requestNotificationPermission,
} from '@client/services/notificationService';
import { initSound, isSoundEnabled, setSoundEnabled } from '@client/utils/notificationSound';

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
    assignedStaffOnline,
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

  // 音频/通知开关状态
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  // Initialize session on mount
  useEffect(() => {
    initSession();
    checkStaffOnline();
  }, [initSession, checkStaffOnline]);

  // ★ 初始化音频和推送通知服务（首次用户交互时请求权限）
  useEffect(() => {
    initSound();
    initServiceWorkerForNotification();

    // 延迟请求通知权限，避免页面加载时弹窗
    const timer = setTimeout(() => {
      if (!isNotificationGranted() && isNotificationSupported()) {
        requestNotificationPermission().catch(() => {
          // 用户拒绝或浏览器不支持，静默处理
        });
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  /** 切换音频开关 */
  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  // Manual translation callback: updates local message state
  const handleTranslated = useCallback((messageId: number, translatedContent: string, translateEngine?: string) => {
    const store = useChatStore;
    const state = store.getState();
    const updatedMessages = state.messages.map((m) =>
      m.id === messageId ? { ...m, translatedContent, translateEngine } : m
    );
    store.setState({ messages: updatedMessages });
  }, []);
  // ★ 页面获得焦点时：通知点击导航 → 重新初始化URL会话 + 自动标记已读
  useEffect(() => {
    const handleFocus = () => {
      // ★ SW 导航后 URL 中的 sessionId 可能与当前不同，需要重新匹配
      const urlParams = new URLSearchParams(window.location.search);
      const urlSessionId = urlParams.get('s');
      if (urlSessionId && session?.id !== urlSessionId) {
        console.log('[ChatPage] Focus: URL session changed, re-initializing from URL', urlSessionId);
        initSession();
        return;
      }

      // 同一会话 → 自动标记已读
      if (session && session.unreadByVisitor > 0) {
        markAsRead();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [session, markAsRead, initSession]);

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

  // 标题优先级：已分配客服名称 > 商家名称 > 站点名称 > 默认名称
  const chatTitle = session?.assignedStaffName || session?.businessName || siteName || t('service_title');

  // 同步浏览器标签页标题
  useEffect(() => {
    if (chatTitle) {
      document.title = chatTitle;
    }
  }, [chatTitle]);

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
        assignedStaffOnline={assignedStaffOnline}
        session={session}
        t={t as any}
        locale={locale}
        setLocale={setLocale as any}
        supportedLocales={supportedLocales}
        onRestart={handleRestart}
        showTranslate={true}
        onTranslated={handleTranslated}
        soundOn={soundOn}
        onToggleSound={handleToggleSound}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}