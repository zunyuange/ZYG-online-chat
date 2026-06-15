/**
 * Session List Component - Shows all chat sessions
 */

import type { Session } from '@shared/types';
import { UnreadBadge } from './UnreadBadge';

interface SessionWithPreview extends Session {
  lastMessage?: {
    content: string;
    contentType: string;
    createdAt: Date;
  };
}

interface SessionListProps {
  sessions: SessionWithPreview[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  loading?: boolean;
}

export function SessionList({
  sessions,
  currentSessionId,
  onSelect,
  loading,
}: SessionListProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(date).toLocaleDateString('zh-CN');
  };

  const getLastMessagePreview = (session: SessionWithPreview) => {
    if (!session.lastMessage) return '暂无消息';

    const { content, contentType } = session.lastMessage;
    switch (contentType) {
      case 'image':
        return '[图片]';
      case 'video':
        return '[视频]';
      default:
        return content.length > 30 ? `${content.slice(0, 30)}...` : content;
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
    borderRight: '1px solid #e8e8e8',
  };

  const headerStyle: React.CSSProperties = {
    padding: '16px',
    borderBottom: '1px solid #e8e8e8',
    fontSize: '16px',
    fontWeight: 500,
  };

  const listStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
  };

  const itemStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 16px',
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer',
    backgroundColor: isActive ? '#e6f7ff' : 'transparent',
    position: 'relative',
    transition: 'background-color 0.2s',
  });

  const nameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
    marginBottom: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const previewStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#999',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    paddingRight: '20px',
  };

  const timeStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#999',
  };

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    fontSize: '14px',
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    color: '#999',
    fontSize: '14px',
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>会话列表</div>
        <div style={loadingStyle}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>会话列表 ({sessions.length})</div>
      <div style={listStyle}>
        {sessions.length === 0 ? (
          <div style={emptyStyle}>暂无会话</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              style={itemStyle(session.id === currentSessionId)}
              onClick={() => onSelect(session.id)}
            >
              <div style={nameStyle}>
                <span>{session.visitorName}</span>
                <span style={timeStyle}>
                  {session.lastMessageAt
                    ? formatTime(session.lastMessageAt)
                    : formatTime(session.createdAt)}
                </span>
              </div>
              <div style={previewStyle}>
                {getLastMessagePreview(session)}
              </div>
              {session.unreadByStaff > 0 && (
                <UnreadBadge count={session.unreadByStaff} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export type { SessionWithPreview };