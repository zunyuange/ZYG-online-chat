/**
 * Staff Page - Customer service interface
 * Responsive design: PC shows sidebar, Mobile uses floating button
 * With authentication support
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { MessageCircle, Users, User, LogOut, Trash2, Globe, Code2, Settings } from 'lucide-react';
import { useStaffStore } from '@client/stores/staffStore';
import { SessionList } from '@client/components/staff/SessionList';
import { StaffChatWindow } from '@client/components/staff/StaffChatWindow';
import { QueueList } from '@client/components/staff/QueueList';
import { StaffManagement } from '@client/components/staff/StaffManagement';
import { StaffCode } from '@client/components/staff/StaffCode';
import { StaffSettings } from '@client/components/staff/StaffSettings';
import { useAuth } from '@client/hooks/useAuth';
import { useSiteSettings } from '@client/hooks/useSiteSettings';
import { useI18n } from '@client/context/I18nContext';

interface UserInfo {
  userId?: number;
  username?: string;
  businessId?: number;
  businessSlug?: string;
  businessName?: string;
  role?: string;
}

// Check if device is mobile
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768;
};

// Update URL with session ID
const updateUrlSessionId = (sessionId: string | null) => {
  const url = new URL(window.location.href);
  if (sessionId) {
    url.searchParams.set('s', sessionId);
  } else {
    url.searchParams.delete('s');
  }
  window.history.replaceState({}, '', url.toString());
};

export function StaffPage() {
  const { t, locale, setLocale, supportedLocales } = useI18n();
  const { siteName } = useSiteSettings();
  
  // Authentication
  const {
    isLoading: authLoading,
    isAuthenticated,
    requireAuth,
    error: authError,
    remainingAttempts,
    login,
  } = useAuth();

  const {
    sessions,
    currentSessionId,
    messages: messagesMap,
    hasMore: hasMoreMap,
    loading,
    messagesLoading,
    sending,
    sseConnected,
    usePolling,
    totalUnread,
    error,
    inputMode,
    loadSessions,
    selectSession,
    loadMoreMessages,
    sendMessage,
    uploadFile,
    markAsRead,
    initFromUrl,
    connectSSE,
    clearError,
    setInputMode,
    updateTopic,
    updateTaskStatus,
    clearMessages,
  } = useStaffStore();

  // UI state for mobile
  const [isMobile, setIsMobile] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showQueueList, setShowQueueList] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<'home' | 'staff' | 'code' | 'settings'>('home');
  
  // Statistics data
  const [stats, setStats] = useState<{
    todaySessions: number;
    activeSessions: number;
    queueCount: number;
    avgResponseTime: number;
    satisfactionRate: number;
    evaluationCount: number;
    todayMessages: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Ref to prevent multiple initializations
  const dataLoadedRef = useRef(false);

  // ============ ALL HOOKS MUST BE BEFORE CONDITIONAL RETURNS ============

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(isMobileDevice());
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle redirect to login when not authenticated
  useEffect(() => {
    if (requireAuth && !isAuthenticated && !authLoading) {
      // Use replace to prevent going back to staff page after logout
      window.location.replace('/stafflogin');
    }
  }, [requireAuth, isAuthenticated, authLoading]);

  // Load sessions, connect SSE and check URL params only after authentication
  useEffect(() => {
    // Only load data when authenticated and not already loaded
    if (!isAuthenticated || dataLoadedRef.current) return;

    // Mark as loaded to prevent re-initialization
    dataLoadedRef.current = true;

    // Initialize data
    loadSessions();
    connectSSE();
    initFromUrl();
  }, [isAuthenticated, loadSessions, connectSSE, initFromUrl]);

  // Get user info after authentication
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
          },
        });
        const result = await response.json();
        if (result.success && result.valid) {
          setUserInfo({
            userId: result.userId,
            username: result.username || '管理员',
            businessId: result.businessId,
            businessSlug: result.businessSlug,
            businessName: result.businessName,
            role: result.role,
          });
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      }
    };

    fetchUserInfo();
    fetchStats();
  }, [isAuthenticated]);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/chat/stats', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_token_expires');
    window.location.reload();
  };

  const handleClearMessages = () => {
    if (currentSessionId) {
      clearMessages(currentSessionId);
      setShowClearConfirm(false);
    }
  };

  const handleEndSession = async () => {
    if (currentSessionId) {
      try {
        const response = await fetch(`/api/staff/sessions/${currentSessionId}/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
          },
        });
        const result = await response.json();
        if (result.success) {
          // Refresh sessions list to remove the closed session
          await loadSessions();
          // Clear current session selection
          setSelectedSessionId(null);
          setCurrentSessionId(null);
          console.log('Session ended successfully');
        } else {
          console.error('Failed to end session:', result.error);
        }
      } catch (error) {
        console.error('Failed to end session:', error);
      }
      setShowEndSessionConfirm(false);
    }
  };

  // Get current session info
  const currentSession = sessions.find((s) => s.id === currentSessionId) || null;
  const currentMessages = currentSessionId ? messagesMap.get(currentSessionId) || [] : [];
  const currentHasMore = currentSessionId ? hasMoreMap.get(currentSessionId) || false : false;

  const handleSelectSession = useCallback((sessionId: string) => {
    selectSession(sessionId);
    markAsRead(sessionId);
    // Update URL with session ID
    updateUrlSessionId(sessionId);
    // Close session list on mobile after selection
    if (isMobile) {
      setShowSessionList(false);
    }
  }, [selectSession, markAsRead, isMobile]);

  const handleSend = (content: string, type: 'text' | 'image' | 'video' | 'file') => {
    // 如果是主题模式，更新主题而不是发送消息
    if (inputMode === 'topic' && currentSessionId) {
      updateTopic(currentSessionId, content);
      setInputMode('chat'); // 更新后切回聊天模式
    } else {
      sendMessage(content, type);
    }
  };

  const handleUpload = (file: File) => {
    uploadFile(file);
  };

  const handleTopicChange = (topic: string) => {
    if (currentSessionId) {
      updateTopic(currentSessionId, topic);
    }
  };

  const handleStatusChange = (status: 'requirement_discussion' | 'requirement_confirmed' | 'in_progress' | 'delivered' | 'reviewed') => {
    if (currentSessionId) {
      updateTaskStatus(currentSessionId, status);
    }
  };

  const toggleSessionList = () => {
    setShowSessionList((prev) => !prev);
  };

  // ============ CONDITIONAL RETURNS AFTER ALL HOOKS ============

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            margin: '0 auto 16px',
          }}></div>
          <p style={{ color: '#6b7280' }}>加载中...</p>
        </div>
      </div>
    );
  }

  // ============ STYLES (only used when authenticated) ============

  const pageStyle: React.CSSProperties = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isMobile ? '12px 16px' : '12px 24px',
    backgroundColor: '#001529',
    color: '#fff',
    flexShrink: 0,
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    position: 'relative',
  };

  const sidebarStyle: React.CSSProperties = isMobile ? {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '85%',
    maxWidth: '320px',
    zIndex: 100,
    transform: showSessionList ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.3s ease',
    boxShadow: showSessionList ? '2px 0 8px rgba(0,0,0,0.15)' : 'none',
  } : {
    width: '320px',
    flexShrink: 0,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
  };

  const statusStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '8px' : '16px',
    fontSize: '14px',
  };

  const statusItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  const dotStyle = (connected: boolean, polling?: boolean): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: connected ? '#52c41a' : polling ? '#faad14' : '#ff4d4f',
  });

  const getStatusText = () => {
    if (sseConnected) return t('service_online');
    if (usePolling) return 'Polling...';
    return 'Connecting...';
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

  const floatingButtonStyle: React.CSSProperties = {
    position: 'fixed',
    left: '16px',
    bottom: '90px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    zIndex: 99,
    transition: 'transform 0.2s ease',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 50,
    display: showSessionList ? 'block' : 'none',
  };

  // Navigation tabs style
  const navTabStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid #e8e8e8',
    backgroundColor: '#fff',
  };

  const navTabItemStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 24px',
    borderBottom: active ? '2px solid #1890ff' : '2px solid transparent',
    backgroundColor: active ? '#f0f5ff' : 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: active ? '#1890ff' : '#666',
    fontWeight: active ? 500 : 400,
    transition: 'all 0.2s',
  });

  // ============ MAIN RENDER ============

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ fontSize: '18px', fontWeight: 500 }}>
          {siteName || t('service_title')}
        </div>
        <div style={statusStyle}>
          {/* Queue button */}
          <button
            onClick={() => setShowQueueList(true)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '16px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
            }}
            title="查看任务队列"
          >
            <Users size={14} />
            <span style={{ display: isMobile ? 'none' : 'inline' }}>{t('queue')}</span>
          </button>
          <div style={statusItemStyle}>
            <span style={dotStyle(sseConnected, usePolling)}></span>
            <span style={{ display: isMobile ? 'none' : 'inline' }}>
              {getStatusText()}
            </span>
          </div>
          {totalUnread > 0 && (
            <div style={statusItemStyle}>
              <span
                style={{
                  backgroundColor: '#ff4d4f',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              >
                {totalUnread}
              </span>
            </div>
          )}
          {/* User menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '16px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
              }}
            >
              <User size={14} />
              <span>{userInfo?.username || '登录'}</span>
            </button>
            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '8px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                  padding: '8px',
                  minWidth: '150px',
                  zIndex: 200,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', marginBottom: '4px' }}>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '6px' }}>{t('choose_lang')}</div>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #d9d9d9',
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    {supportedLocales.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.nativeName}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#666',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={14} />
                  {t('logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={navTabStyle}>
        <div
          onClick={() => setCurrentPage('home')}
          style={navTabItemStyle(currentPage === 'home')}
        >
          <MessageCircle size={16} />
          <span>首页</span>
        </div>
        {userInfo?.role === 'admin' && (
          <div
            onClick={() => setCurrentPage('staff')}
            style={navTabItemStyle(currentPage === 'staff')}
          >
            <Users size={16} />
            <span>客服管理</span>
          </div>
        )}
        <div
          onClick={() => setCurrentPage('code')}
          style={navTabItemStyle(currentPage === 'code')}
        >
          <Code2 size={16} />
          <span>代码</span>
        </div>
        {userInfo?.role === 'admin' && (
          <div
            onClick={() => setCurrentPage('settings')}
            style={navTabItemStyle(currentPage === 'settings')}
          >
            <Settings size={16} />
            <span>设置</span>
          </div>
        )}
      </div>

      {/* Clear messages confirmation modal */}
      {showClearConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '24px',
              minWidth: '320px',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>
              {t('clear_messages')}
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>
              {t('confirm_clear')}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: '#fff',
                  color: '#666',
                  fontSize: '14px',
                }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleClearMessages}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: '#ff4d4f',
                  color: '#fff',
                  fontSize: '14px',
                }}
              >
                {t('confirm_clear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End session confirmation modal */}
      {showEndSessionConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowEndSessionConfirm(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '24px',
              minWidth: '320px',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 500 }}>
              {t('end_session')}
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#666' }}>
              {t('confirm_end_session')}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEndSessionConfirm(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: '#fff',
                  color: '#666',
                  fontSize: '14px',
                }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleEndSession}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: '#ff4d4f',
                  color: '#fff',
                  fontSize: '14px',
                }}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Main content */}
      <div style={mainStyle}>
        {/* Home page - Chat interface */}
        {currentPage === 'home' && (
          <>
            {/* Overlay (mobile only) */}
            {isMobile && (
              <div style={overlayStyle} onClick={() => setShowSessionList(false)} />
            )}

            {/* Sidebar - Statistics and Session List */}
            <div style={sidebarStyle}>
              {/* Statistics Cards */}
              {currentPage === 'home' && (
                <div style={{ padding: '12px', borderBottom: '1px solid #e8e8e8', backgroundColor: '#fff' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#666', marginBottom: '12px', paddingLeft: '4px' }}>
                    统计概览
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ backgroundColor: '#f6ffed', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: '#52c41a' }}>
                        {statsLoading ? '...' : stats?.todaySessions || 0}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8c8c8c' }}>今日会话</div>
                    </div>
                    <div style={{ backgroundColor: '#fff7e6', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: '#fa8c16' }}>
                        {statsLoading ? '...' : stats?.activeSessions || 0}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8c8c8c' }}>活跃会话</div>
                    </div>
                    <div style={{ backgroundColor: '#fff1f0', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: '#ff4d4f' }}>
                        {statsLoading ? '...' : stats?.queueCount || 0}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8c8c8c' }}>排队人数</div>
                    </div>
                    <div style={{ backgroundColor: '#e6f7ff', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 600, color: '#1890ff' }}>
                        {statsLoading ? '...' : stats?.todayMessages || 0}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8c8c8c' }}>今日消息</div>
                    </div>
                  </div>
                </div>
              )}
              <SessionList
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelect={handleSelectSession}
                loading={loading}
              />
            </div>

            {/* Chat Window */}
            <div style={contentStyle}>
              <StaffChatWindow
                session={currentSession}
                messages={currentMessages}
                hasMore={currentHasMore}
                loading={messagesLoading}
                sending={sending}
                inputMode={inputMode}
                isMobile={isMobile}
                onLoadMore={loadMoreMessages}
                onSend={handleSend}
                onUpload={handleUpload}
                onModeChange={setInputMode}
                onTopicChange={handleTopicChange}
                onStatusChange={handleStatusChange}
                onClearMessages={() => setShowClearConfirm(true)}
                onEndSession={() => setShowEndSessionConfirm(true)}
              />
            </div>
          </>
        )}

        {/* Staff management page */}
        {currentPage === 'staff' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <StaffManagement />
          </div>
        )}

        {/* Code page */}
        {currentPage === 'code' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <StaffCode />
          </div>
        )}

        {/* Settings page */}
        {currentPage === 'settings' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <StaffSettings />
          </div>
        )}
      </div>

      {/* Floating button (mobile only) */}
      {isMobile && (
        <button
          style={floatingButtonStyle}
          onClick={toggleSessionList}
          title="会话列表"
        >
          <MessageCircle size={24} />
          {totalUnread > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#ff4d4f',
                color: '#fff',
                fontSize: '12px',
                minWidth: '20px',
                height: '20px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
              }}
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Queue List Modal */}
      <QueueList
        isOpen={showQueueList}
        onClose={() => setShowQueueList(false)}
        onSelectSession={handleSelectSession}
      />
    </div>
  );
}
