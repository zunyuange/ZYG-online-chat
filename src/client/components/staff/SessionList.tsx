/**
 * Session List Component - Shows all chat sessions
 */

import type { Session } from '@shared/types';
import { useMemo, useState, useEffect } from 'react';
import { UnreadBadge } from './UnreadBadge';

interface SessionWithPreview extends Session {
  lastMessage?: {
    content: string;
    contentType: string;
    senderType: string;
    createdAt: Date;
  };
}

interface SessionListProps {
  sessions: SessionWithPreview[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  loading?: boolean;
  staffList?: { id: number; name: string; username: string }[];
  t?: (key: string) => string;
}

/** 头像背景色板 — 按首字符哈希取色 */
const AVATAR_COLORS = [
  '#ff6b6b', '#f06595', '#cc5de8', '#845ef7',
  '#5c7cfa', '#339af0', '#22b8cf', '#20c997',
  '#51cf66', '#94d82d', '#fcc419', '#ff922b',
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getAvatarChar = (name: string) => {
  // 取第一个有意义的字符（汉字/字母/数字）
  const match = name.match(/[\u4e00-\u9fff\w]/);
  return match ? match[0].toUpperCase() : '?';
};

export function SessionList({
  sessions,
  currentSessionId,
  onSelect,
  loading,
  staffList = [],
  t = (s: string) => s,
}: SessionListProps) {
  // 定时器强制刷新，确保在线状态时间判断能及时更新
  // 每30秒强制重新渲染一次，保证绿点/灰点最多延迟30秒
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const staffMap = useMemo(() => {
    const map: Record<number, { name: string; username: string }> = {};
    for (const s of staffList) {
      map[s.id] = { name: s.name, username: s.username };
    }
    return map;
  }, [staffList]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('just_now');
    if (minutes < 60) return `${minutes}${t('minutes_ago_suffix')}`;
    if (hours < 24) return `${hours}${t('hours_ago_suffix')}`;
    if (days < 7) return `${days}${t('days_ago_suffix')}`;
    return new Date(date).toLocaleDateString(navigator.language || 'en');
  };

  const getLastMessagePreview = (session: SessionWithPreview) => {
    if (!session.lastMessage) return t('no_messages');
    const { content, contentType } = session.lastMessage;
    switch (contentType) {
      case 'image':
        return '🖼 ' + t('image_placeholder');
      case 'video':
        return '🎬 ' + t('video_placeholder');
      default:
        return content.length > 28 ? `${content.slice(0, 28)}…` : content;
    }
  };

  const getAssignedStaffName = (assignedStaffId: number | null) => {
    if (!assignedStaffId) return null;
    const staff = staffMap[assignedStaffId];
    return staff ? staff.name || staff.username : null;
  };

  // ============ Style Definitions ============

  const containerStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    backgroundColor: '#fafbfc',
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: '1px solid #e8ecf1',
    fontSize: '15px',
    fontWeight: 600,
    color: '#1a1a2e',
    letterSpacing: '0.3px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#fff',
  };

  const headerCountBadge: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '22px',
    height: '22px',
    padding: '0 6px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#5c7cfa',
    backgroundColor: '#edf2ff',
    borderRadius: '11px',
    marginLeft: 'auto',
  };

  const listStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 10px',
  };

  const itemOuterStyle = (isActive: boolean): React.CSSProperties => ({
    position: 'relative' as const,
    marginBottom: '4px',
    borderRadius: '10px',
    cursor: 'pointer',
    backgroundColor: isActive ? '#fff' : 'transparent',
    boxShadow: isActive
      ? '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(92,124,250,0.15)'
      : 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    overflow: 'hidden',
  });

  const activeBarStyle = (isActive: boolean): React.CSSProperties => ({
    position: 'absolute' as const,
    left: 0,
    top: '10px',
    bottom: '10px',
    width: '3px',
    borderRadius: '0 3px 3px 0',
    backgroundColor: isActive ? '#5c7cfa' : 'transparent',
    transition: 'background-color 0.3s',
  });

  const itemInnerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
  };

  const avatarStyle = (name: string): React.CSSProperties => ({
    flexShrink: 0,
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: getAvatarColor(name),
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '17px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    lineHeight: 1,
  });

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const nameRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '5px',
    gap: '8px',
  };

  const visitorNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1a1a2e',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const timeStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#adb5bd',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  const metaRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  };

  // 判断访客是否真正在线：最近5分钟内有活动才算在线
  const VISITOR_ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5分钟
  const isVisitorOnline = (session: SessionWithPreview): boolean => {
    if (session.status !== 'active') return false;
    // 仅使用 lastVisitorActivityAt（仅访客发消息时更新），
    // 不再使用 lastMessageAt（客服回复也会更新，导致误判）
    if (session.lastVisitorActivityAt) {
      return Date.now() - new Date(session.lastVisitorActivityAt).getTime() < VISITOR_ONLINE_THRESHOLD_MS;
    }
    // 无访客活动记录 → 离线（灰点）
    return false;
  };

  const statusDotStyle = (online: boolean): React.CSSProperties => ({
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    backgroundColor: online ? '#51cf66' : '#ced4da',
    flexShrink: 0,
    boxShadow: online ? '0 0 0 2px rgba(81,207,102,0.2)' : 'none',
  });

  const staffBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#5c7cfa',
    backgroundColor: '#edf2ff',
    borderRadius: '6px',
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const businessBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 500,
    color: '#722ed1',
    backgroundColor: '#f9f0ff',
    borderRadius: '6px',
    maxWidth: '140px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const previewStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#868e96',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: '5px',
    lineHeight: '1.3',
  };

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#adb5bd',
    fontSize: '13px',
    gap: '10px',
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#adb5bd',
    fontSize: '13px',
    gap: '10px',
  };

  // ============ Render ============

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          {t('sessions')}
        </div>
        <div style={loadingStyle}>
          <div className="session-list-spinner" style={{
            width: '28px',
            height: '28px',
            border: '3px solid #e8ecf1',
            borderTopColor: '#5c7cfa',
            borderRadius: '50%',
            animation: 'sessionListSpin 0.7s linear infinite',
          }} />
          {t('loading')}
          <style>{`@keyframes sessionListSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        {t('sessions')}
        <span style={headerCountBadge}>{sessions.length}</span>
      </div>
      <div style={listStyle}>
        {sessions.length === 0 ? (
          <div style={emptyStyle}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ced4da" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {t('no_sessions')}
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === currentSessionId;
            const assignedStaffName = getAssignedStaffName(session.assignedStaffId || null);
            const sessionTime = session.lastMessageAt || session.createdAt;

            return (
              <div
                key={session.id}
                style={itemOuterStyle(isActive)}
                onClick={() => onSelect(session.id)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f0f4ff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {/* 左侧激活指示条 */}
                <div style={activeBarStyle(isActive)} />

                <div style={itemInnerStyle}>
                  {/* 头像 */}
                  <div style={avatarStyle(session.visitorName)}>
                    {getAvatarChar(session.visitorName)}
                  </div>

                  {/* 内容区 */}
                  <div style={contentStyle}>
                    {/* 第一行：访客名 + 时间 */}
                    <div style={nameRowStyle}>
                      <span style={visitorNameStyle}>
                        {session.visitorName}
                      </span>
                      <span style={timeStyle}>
                        {formatTime(sessionTime)}
                      </span>
                    </div>

                    {/* 第二行：标签 + 状态 */}
                    <div style={metaRowStyle}>
                      {/* 会话状态 — 根据最近活动时间判断是否在线 */}
                      <span style={statusDotStyle(isVisitorOnline(session))} title={isVisitorOnline(session) ? t('online') : t('offline')} />

                      {/* 当前分配客服（优先显示），无分配时显示商家名称 */}
                      {assignedStaffName ? (
                        <span style={staffBadgeStyle}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          {assignedStaffName}
                        </span>
                      ) : session.businessName ? (
                        <span style={businessBadgeStyle}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                          </svg>
                          {session.businessName}
                        </span>
                      ) : null}
                    </div>

                    {/* 第三行：消息预览 */}
                    <div style={previewStyle}>
                      {getLastMessagePreview(session)}
                    </div>
                  </div>
                </div>

                {/* 未读角标 */}
                {session.unreadByStaff > 0 && (
                  <UnreadBadge count={session.unreadByStaff} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export type { SessionWithPreview };