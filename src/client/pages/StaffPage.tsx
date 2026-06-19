/**
 * Staff Page - Customer service interface
 * Responsive design: PC shows sidebar, Mobile uses floating button
 * With authentication support
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { MessageCircle, Users, User, LogOut, Code2, Settings, ArrowRightLeft, XCircle, ListChecks } from 'lucide-react';
import { useStaffStore } from '@client/stores/staffStore';
import { SessionList } from '@client/components/staff/SessionList';
import { StaffChatWindow, VisitorInfoPanel } from '@client/components/staff/StaffChatWindow';
import type { VisitorFieldDef } from '@client/components/staff/StaffChatWindow';
import { QueueList } from '@client/components/staff/QueueList';
import { StaffManagement } from '@client/components/staff/StaffManagement';
import { StaffCode } from '@client/components/staff/StaffCode';
import { StaffSettings } from '@client/components/staff/StaffSettings';
import { VisitorFields } from '@client/components/staff/VisitorFields';
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
    setUser,
    updateTopic,
    clearMessages,
  } = useStaffStore();

  // UI state for mobile
  const [isMobile, setIsMobile] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showQueueList, setShowQueueList] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentPage, setCurrentPage] = useState<'home' | 'staff' | 'code' | 'settings' | 'visitorFields'>('home');
  const [staffList, setStaffList] = useState<{ id: number; name: string; username: string }[]>([]);
  const [visitorFieldDefs, setVisitorFieldDefs] = useState<VisitorFieldDef[]>([]);
  const [profileForm, setProfileForm] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [profileMessage, setProfileMessage] = useState('');
  
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

  // Transfer request state
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [showTransferNotification, setShowTransferNotification] = useState(false);
  const transferPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Rejected transfers notification state
  const [rejectedTransfers, setRejectedTransfers] = useState<any[]>([]);
  const [showRejectionNotification, setShowRejectionNotification] = useState(false);
  const rejectionPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Re-apply transfer state
  const [selectedReapplyRequest, setSelectedReapplyRequest] = useState<any | null>(null);
  const [reapplyReason, setReapplyReason] = useState('');
  
  // Reject modal state
  const [selectedRejectRequest, setSelectedRejectRequest] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
    
    // Fetch visitor field definitions for custom param display labels
    fetchVisitorFieldDefs();
    
    // Start polling for pending transfer requests
    fetchPendingTransfers();
    transferPollingIntervalRef.current = setInterval(fetchPendingTransfers, 10000);
    
    // Start polling for rejected transfers (notifications)
    fetchRejectedTransfers();
    rejectionPollingIntervalRef.current = setInterval(fetchRejectedTransfers, 15000);
    
    return () => {
      if (transferPollingIntervalRef.current) {
        clearInterval(transferPollingIntervalRef.current);
      }
      if (rejectionPollingIntervalRef.current) {
        clearInterval(rejectionPollingIntervalRef.current);
      }
    };
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
          setUser({
            userId: result.userId,
            username: result.username || '管理员',
            businessId: result.businessId,
            role: result.role,
          });
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      }
    };

    fetchUserInfo();
    fetchStats();
    fetchStaffList();
  }, [isAuthenticated]);

  const fetchStaffList = async () => {
    try {
      const response = await fetch('/api/staff/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        const staffUsers = result.data.map((user: any) => ({
          id: user.id,
          name: user.name || user.username,
          username: user.username,
        }));
        console.log('Fetched staff list:', staffUsers);
        setStaffList(staffUsers);
      }
    } catch (error) {
      console.error('Failed to fetch staff list:', error);
    }
  };

  const fetchVisitorFieldDefs = async () => {
    try {
      const response = await fetch('/api/staff/visitor-fields', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        // 合并固定字段和自定义字段定义，全部参与动态渲染
        const fixedDefs: VisitorFieldDef[] = (result.data.fixedFields || []).map((f: any) => ({
          fieldKey: f.fieldKey,
          label: f.label,
          type: f.type,
          isFixed: true,
        }));
        const customDefs: VisitorFieldDef[] = (result.data.customFields || []).map((f: any) => ({
          fieldKey: f.fieldKey,
          label: f.label,
          type: f.type,
          isFixed: false,
        }));
        setVisitorFieldDefs([...fixedDefs, ...customDefs]);
      }
    } catch (error) {
      console.error('Failed to fetch visitor field definitions:', error);
    }
  };

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

  const fetchPendingTransfers = async () => {
    try {
      const response = await fetch('/api/chat/transfer/pending', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success && result.data) {
        const newCount = result.data.length;
        const oldCount = pendingTransfers.length;
        
        setPendingTransfers(result.data);
        
        // Show notification if there are new transfer requests
        if (newCount > oldCount && newCount > 0) {
          setShowTransferNotification(true);
          // Auto hide after 5 seconds
          setTimeout(() => {
            setShowTransferNotification(false);
          }, 5000);
        }
      }
    } catch (error) {
      console.error('Failed to fetch pending transfers:', error);
    }
  };

  const fetchRejectedTransfers = async () => {
    try {
      const response = await fetch('/api/chat/transfer/my', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success && result.data) {
        // Filter only rejected requests with reject_reason
        const rejected = result.data.filter((req: any) => 
          req.status === 'rejected' && req.reject_reason
        );
        
        const oldCount = rejectedTransfers.length;
        const newCount = rejected.length;
        
        setRejectedTransfers(rejected);
        
        // Show notification if there are new rejections
        if (newCount > oldCount && newCount > 0) {
          setShowRejectionNotification(true);
          // Auto hide after 10 seconds
          setTimeout(() => {
            setShowRejectionNotification(false);
          }, 10000);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rejected transfers:', error);
    }
  };

  const handleCancelRejection = async (requestId: number) => {
    try {
      const response = await fetch(`/api/chat/transfer/${requestId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        // Remove from local state
        setRejectedTransfers(prev => prev.filter(req => req.id !== requestId));
        // If no more rejected transfers, hide notification
        if (rejectedTransfers.length <= 1) {
          setShowRejectionNotification(false);
        }
      } else {
        alert(result.error || '删除失败');
      }
    } catch (error) {
      console.error('Failed to cancel rejection:', error);
      alert('删除失败');
    }
  };

  const handleReapplyTransfer = async () => {
    if (!selectedReapplyRequest) return;
    
    if (!reapplyReason.trim()) {
      alert('请填写转接原因');
      return;
    }

    try {
      // Create a new transfer request
      const response = await fetch('/api/chat/transfer/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify({
          sessionId: selectedReapplyRequest.session_id,
          toStaffId: selectedReapplyRequest.to_staff_id,
          reason: reapplyReason,
        }),
      });
      const result = await response.json();
      if (result.success) {
        // Delete the old rejected request
        await fetch(`/api/chat/transfer/${selectedReapplyRequest.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
          },
        });
        
        // Update local state
        setRejectedTransfers(prev => prev.filter(req => req.id !== selectedReapplyRequest.id));
        setSelectedReapplyRequest(null);
        setReapplyReason('');
        
        // If no more rejected transfers, hide notification
        if (rejectedTransfers.length <= 1) {
          setShowRejectionNotification(false);
        }
        
        alert('转接请求已重新发送');
      } else {
        alert(result.error || '重新申请失败');
      }
    } catch (error) {
      console.error('Failed to reapply transfer:', error);
      alert('重新申请失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_token_expires');
    window.location.reload();
  };

  const handleAcceptTransfer = async (requestId: number) => {
    try {
      const response = await fetch(`/api/chat/transfer/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify({ action: 'accept' }),
      });
      const result = await response.json();
      if (result.success) {
        // Refresh pending transfers list
        await fetchPendingTransfers();
        // Reload sessions to show the new session
        await loadSessions();
        alert('已接受转接请求');
      } else {
        alert(result.error || '接受失败');
      }
    } catch (error) {
      console.error('Failed to accept transfer:', error);
      alert('接受失败');
    }
  };

  const handleRejectTransfer = async () => {
    if (!selectedRejectRequest) return;
    
    if (!rejectReason.trim()) {
      alert('请填写拒绝原因');
      return;
    }

    try {
      const response = await fetch(`/api/chat/transfer/${selectedRejectRequest.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify({ action: 'reject', reason: rejectReason }),
      });
      const result = await response.json();
      if (result.success) {
        // Refresh pending transfers list
        await fetchPendingTransfers();
        // Close modal and clear form
        setSelectedRejectRequest(null);
        setRejectReason('');
        setShowTransferNotification(false);
      } else {
        alert(result.error || '拒绝失败');
      }
    } catch (error) {
      console.error('Failed to reject transfer:', error);
      alert('拒绝失败');
    }
  };

  const handleOpenProfile = () => {
    setShowProfileModal(true);
    setShowUserMenu(false);
    setProfileForm({ name: '', password: '', confirmPassword: '' });
    setProfileMessage('');
  };

  const handleCloseProfile = () => {
    setShowProfileModal(false);
    setProfileForm({ name: '', password: '', confirmPassword: '' });
    setProfileMessage('');
  };

  const handleUpdateProfile = async () => {
    setProfileMessage('');
    
    if (profileForm.password !== profileForm.confirmPassword) {
      setProfileMessage('两次输入的密码不一致');
      return;
    }

    if (!profileForm.name && !profileForm.password) {
      setProfileMessage('请至少修改一项内容');
      return;
    }

    try {
      const token = localStorage.getItem('staff_token');
      const response = await fetch('/api/staff/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profileForm.name || undefined,
          password: profileForm.password || undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setProfileMessage('修改成功');
        setTimeout(() => {
          handleCloseProfile();
        }, 1500);
      } else {
        setProfileMessage(result.error || '修改失败');
      }
    } catch (error) {
      setProfileMessage('修改失败');
    }
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

  const visitorPanelStyle: React.CSSProperties = {
    width: '280px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fff',
    borderLeft: '1px solid #e8e8e8',
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
    // SSE连接成功 → 绿色；Polling后备连接正常 → 绿色；都未连接 → 红色
    backgroundColor: (connected || polling) ? '#52c41a' : '#ff4d4f',
  });

  const getStatusText = () => {
    if (sseConnected) return t('service_online');
    if (usePolling) return t('polling');
    return t('connecting');
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
          {/* Transfer request notification badge */}
          {pendingTransfers.length > 0 && (
            <button
              onClick={() => setShowTransferNotification(!showTransferNotification)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#faad14',
                border: 'none',
                borderRadius: '16px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                fontWeight: 500,
              }}
              title="有待处理的转接请求"
            >
              <ArrowRightLeft size={14} />
              <span>{pendingTransfers.length}</span>
            </button>
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
                  onClick={handleOpenProfile}
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
                  <User size={14} />
                  修改个人资料
                </button>
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
          onClick={() => setCurrentPage('visitorFields')}
          style={navTabItemStyle(currentPage === 'visitorFields')}
        >
          <ListChecks size={16} />
          <span>访客字段</span>
        </div>
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
                staffList={staffList}
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
                onClearMessages={() => setShowClearConfirm(true)}
                onEndSession={() => setShowEndSessionConfirm(true)}
                onTransfer={() => {}}
                currentStaffId={userInfo?.userId}
                staffList={staffList}
                t={t}
              />
            </div>

            {/* 右侧访客信息侧边栏 */}
            {currentSession && !isMobile && (
              <div style={visitorPanelStyle}>
                <div style={{
                  padding: '14px',
                  backgroundColor: '#fafafa',
                  borderBottom: '1px solid #e8e8e8',
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: currentSession.status === 'active' ? '#52c41a' : '#999',
                    }}></span>
                    {currentSession.visitorName}
                  </div>
                  {currentSession.ip && (
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px', paddingLeft: '16px' }}>
                      🌐 {currentSession.ip}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <VisitorInfoPanel
                    session={currentSession}
                    fieldDefs={visitorFieldDefs}
                  />
                </div>
              </div>
            )}
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

        {/* Visitor Fields page */}
        {currentPage === 'visitorFields' && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <VisitorFields />
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

      {/* 修改个人资料模态框 */}
      {showProfileModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => handleCloseProfile()}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 'bold' }}>
              修改个人资料
            </h3>
            {profileMessage && (
              <div
                style={{
                  padding: '8px 12px',
                  marginBottom: '16px',
                  borderRadius: '4px',
                  backgroundColor: profileMessage.includes('成功') ? '#f6ffed' : '#fff2f0',
                  color: profileMessage.includes('成功') ? '#52c41a' : '#ff4d4f',
                  fontSize: '13px',
                }}
              >
                {profileMessage}
              </div>
            )}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666' }}>
                姓名
              </label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="输入新姓名（留空则不修改）"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666' }}>
                新密码
              </label>
              <input
                type="password"
                value={profileForm.password}
                onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                placeholder="输入新密码（留空则不修改）"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#666' }}>
                确认密码
              </label>
              <input
                type="password"
                value={profileForm.confirmPassword}
                onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                placeholder="再次输入新密码"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseProfile}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#666',
                }}
              >
                取消
              </button>
              <button
                onClick={handleUpdateProfile}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#1890ff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#fff',
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue List Modal */}
      <QueueList
        isOpen={showQueueList}
        onClose={() => setShowQueueList(false)}
        onSelectSession={handleSelectSession}
      />

      {/* Transfer Request Notification Panel */}
      {showTransferNotification && pendingTransfers.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            right: '20px',
            width: '350px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '400px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#faad14',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowRightLeft size={16} />
              <span style={{ fontWeight: 500 }}>待处理转接请求 ({pendingTransfers.length})</span>
            </div>
            <button
              onClick={() => setShowTransferNotification(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '340px' }}>
            {pendingTransfers.map((request) => (
              <div
                key={request.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>
                    来自: {request.from_staff_name || request.from_staff_id}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    会话: {request.session_visitor_name || request.session_id}
                  </div>
                  {request.reason && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      原因: {request.reason}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#bbb', marginTop: '4px' }}>
                    {new Date(request.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleAcceptTransfer(request.id)}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      backgroundColor: '#52c41a',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    接受
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRejectRequest(request);
                      setShowTransferNotification(true);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      backgroundColor: '#ff4d4f',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Transfers Notification */}
      {showRejectionNotification && rejectedTransfers.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '60px',
            right: '20px',
            width: '320px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#ff4d4f',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={16} />
              <span style={{ fontWeight: 500 }}>转接被拒绝 ({rejectedTransfers.length})</span>
            </div>
            <button
              onClick={() => setShowRejectionNotification(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: '340px' }}>
            {rejectedTransfers.slice(0, 5).map((request) => (
              <div
                key={request.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>
                    被客服 {request.to_staff_name || request.to_staff_id} 拒绝
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    会话: {request.session_visitor_name || request.session_id}
                  </div>
                  {request.reject_reason && (
                    <div style={{ fontSize: '12px', color: '#ff4d4f', marginTop: '4px', padding: '8px', backgroundColor: '#fff1f0', borderRadius: '4px' }}>
                      拒绝原因: {request.reject_reason}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#bbb', marginTop: '4px' }}>
                    {new Date(request.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={() => {
                      setSelectedReapplyRequest(request);
                      setReapplyReason(request.reason || ''); // Pre-fill with original reason
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      backgroundColor: '#1890ff',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    继续申请
                  </button>
                  <button
                    onClick={() => handleCancelRejection(request.id)}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      backgroundColor: '#d9d9d9',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {selectedRejectRequest && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={() => {
            setSelectedRejectRequest(null);
            setRejectReason('');
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>
              拒绝转接请求
            </h3>
            <div style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
              您正在拒绝来自客服 <strong>{selectedRejectRequest.from_staff_name || selectedRejectRequest.from_staff_id}</strong> 的转接申请
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因（必填）"
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px',
                resize: 'vertical',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setSelectedRejectRequest(null);
                  setRejectReason('');
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#666',
                }}
              >
                取消
              </button>
              <button
                onClick={handleRejectTransfer}
                disabled={!rejectReason.trim()}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: rejectReason.trim() ? '#ff4d4f' : '#d9d9d9',
                  cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  color: '#fff',
                }}
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-apply Transfer Modal */}
      {selectedReapplyRequest && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
          }}
          onClick={() => {
            setSelectedReapplyRequest(null);
            setReapplyReason('');
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>
              重新发起转接请求
            </h3>
            <div style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
              您正在向客服 <strong>{selectedReapplyRequest.to_staff_name || selectedReapplyRequest.to_staff_id}</strong> 重新发起转接申请
            </div>
            <div style={{ marginBottom: '16px', fontSize: '12px', color: '#999' }}>
              会话: {selectedReapplyRequest.session_visitor_name || selectedReapplyRequest.session_id}
            </div>
            <textarea
              value={reapplyReason}
              onChange={(e) => setReapplyReason(e.target.value)}
              placeholder="请输入转接原因（必填）"
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px',
                resize: 'vertical',
                boxSizing: 'border-box',
                marginBottom: '16px',
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setSelectedReapplyRequest(null);
                  setReapplyReason('');
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#666',
                }}
              >
                取消
              </button>
              <button
                onClick={handleReapplyTransfer}
                disabled={!reapplyReason.trim()}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: reapplyReason.trim() ? '#1890ff' : '#d9d9d9',
                  cursor: reapplyReason.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  color: '#fff',
                }}
              >
                发送请求
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
