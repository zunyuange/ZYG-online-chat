/**
 * Staff Chat Window Component - Chat window for staff with session info
 */

import type { Message, Session, InputMode, TaskStatus, ContentType } from '@shared/types';
import { MessageList } from '@client/components/chat/MessageList';
import { MessageInput } from '@client/components/chat/MessageInput';
import { TopicHeader } from '@client/components/chat/TopicHeader';

interface StaffChatWindowProps {
  session: Session | null;
  messages: Message[];
  hasMore: boolean;
  loading: boolean;
  sending: boolean;
  inputMode?: InputMode;
  isMobile?: boolean;
  onLoadMore: () => void;
  onSend: (content: string, type: ContentType) => void;
  onUpload: (file: File) => void;
  onModeChange?: (mode: InputMode) => void;
  onTopicChange?: (topic: string) => void;
  onStatusChange?: (status: TaskStatus) => void;
}

export function StaffChatWindow({
  session,
  messages,
  hasMore,
  loading,
  sending,
  inputMode = 'chat',
  isMobile = false,
  onLoadMore,
  onSend,
  onUpload,
  onModeChange,
  onTopicChange,
  onStatusChange,
}: StaffChatWindowProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#fff',
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #e8e8e8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  };

  const infoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const statusDotStyle = (status: string): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: status === 'active' ? '#52c41a' : '#999',
  });

  const placeholderStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: '14px',
  };

  if (!session) {
    return (
      <div style={containerStyle}>
        <div style={placeholderStyle}>
          选择一个会话开始聊天
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={infoStyle}>
          <span style={statusDotStyle(session.status)}></span>
          <span style={{ fontWeight: 500 }}>{session.visitorName}</span>
          <span style={{ color: '#999', fontSize: '12px' }}>
            {new Date(session.createdAt).toLocaleString('zh-CN', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        {session.unreadByStaff > 0 && (
          <span
            style={{
              backgroundColor: '#ff4d4f',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px',
            }}
          >
            {session.unreadByStaff} 条未读
          </span>
        )}
      </div>

      {/* Topic Header */}
      {session && (
        <TopicHeader
          session={session}
          editable={true}
          queuePosition={session.queuePosition}
          estimatedWaitMinutes={session.estimatedWaitMinutes}
          onTopicChange={onTopicChange}
          onStatusChange={onStatusChange}
          compact={false}
        />
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        hasMore={hasMore}
        loading={loading}
        isOwn={(message) => message.senderType === 'staff'}
        onLoadMore={onLoadMore}
      />

      {/* Input */}
      <MessageInput
        onSend={onSend}
        onUpload={onUpload}
        sending={sending}
        inputMode={inputMode}
        onModeChange={onModeChange}
        showModeToggle={true}
        isMobile={isMobile}
      />
    </div>
  );
}