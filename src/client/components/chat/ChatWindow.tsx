/**
 * Chat Window Component - Main chat interface
 */

import type { Message, Session, ContentType } from '@shared/types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TopicHeader } from './TopicHeader';

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
  session?: Session | null; // 新增：会话信息（用于显示主题和状态）
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
}: ChatWindowProps) {
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
    gap: '6px',
    fontSize: '12px',
    opacity: 0.9,
  };

  const dotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: sseConnected ? '#52c41a' : usePolling ? '#faad14' : '#ff4d4f',
  };

  const getStatusText = () => {
    if (sseConnected) return '已连接';
    if (usePolling) return '轮询中';
    return '连接中...';
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
        </div>
      </div>

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
      />
    </div>
  );
}