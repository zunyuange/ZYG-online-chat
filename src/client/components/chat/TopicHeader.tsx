/**
 * Topic Header Component - Displays session topic, status and queue info
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { TASK_STATUS_LIST, type TaskStatus, type Session } from '@shared/types';
import { TaskProgressBar } from './TaskProgressBar';

interface TopicHeaderProps {
  session: Session;
  editable?: boolean;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  onTopicChange?: (topic: string) => void;
  onStatusChange?: (status: TaskStatus) => void;
  compact?: boolean; // 紧凑模式（用户端使用）
}

export function TopicHeader({
  session,
  editable = false,
  queuePosition,
  estimatedWaitMinutes,
  onTopicChange,
  onStatusChange,
  compact = false,
}: TopicHeaderProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [isEditing, setIsEditing] = useState(false);
  const [editTopic, setEditTopic] = useState(session.topic || '');

  const currentStatusLabel = TASK_STATUS_LIST.find((s) => s.status === session.taskStatus)?.label || '需求讨论';

  // 获取当前状态的索引
  const currentIndex = TASK_STATUS_LIST.findIndex((s) => s.status === session.taskStatus);
  // 只有在讨论或确认阶段，且排队位置大于1时才显示排队信息
  const showQueueInfo = queuePosition && queuePosition > 1 &&
    (session.taskStatus === 'requirement_discussion' || session.taskStatus === 'requirement_confirmed');

  const containerStyle: React.CSSProperties = {
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #e8e8e8',
    padding: compact ? '8px 12px' : '12px 16px',
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: compact ? 'pointer' : 'default',
  };

  const topicAreaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  };

  const topicIconStyle: React.CSSProperties = {
    color: '#1890ff',
    flexShrink: 0,
  };

  const topicTextStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#333',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  };

  const statusBadgeStyle: React.CSSProperties = {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '12px',
    backgroundColor: currentIndex >= 3 ? '#52c41a' : currentIndex >= 1 ? '#1890ff' : '#faad14',
    color: '#fff',
    flexShrink: 0,
  };

  const queueBadgeStyle: React.CSSProperties = {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '12px',
    backgroundColor: '#722ed1',
    color: '#fff',
    flexShrink: 0,
    marginLeft: '8px',
  };

  const expandIconStyle: React.CSSProperties = {
    color: '#999',
    cursor: 'pointer',
    flexShrink: 0,
    marginLeft: '8px',
  };

  const expandedContentStyle: React.CSSProperties = {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e8e8e8',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
  };

  const handleTopicSubmit = () => {
    if (onTopicChange && editTopic !== session.topic) {
      onTopicChange(editTopic);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTopicSubmit();
    } else if (e.key === 'Escape') {
      setEditTopic(session.topic || '');
      setIsEditing(false);
    }
  };

  const renderTopicContent = () => {
    if (isEditing && editable) {
      return (
        <input
          type="text"
          value={editTopic}
          onChange={(e) => setEditTopic(e.target.value)}
          onBlur={handleTopicSubmit}
          onKeyDown={handleKeyDown}
          placeholder="输入主题..."
          style={inputStyle}
          autoFocus
        />
      );
    }

    return (
      <div style={topicAreaStyle}>
        {session.topic ? (
          <>
            <MessageSquare size={16} style={topicIconStyle} />
            <span style={topicTextStyle} title={session.topic}>
              {session.topic}
            </span>
          </>
        ) : (
          <span style={{ ...topicTextStyle, color: '#999', fontStyle: 'italic' }}>
            {editable ? '点击添加主题...' : '暂无主题'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={containerStyle}>
      <div
        style={headerRowStyle}
        onClick={() => compact && setExpanded(!expanded)}
      >
        {renderTopicContent()}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={statusBadgeStyle}>{currentStatusLabel}</span>

          {showQueueInfo && (
            <span style={queueBadgeStyle}>
              #{queuePosition} | 约{estimatedWaitMinutes}分钟
            </span>
          )}

          {compact && (
            <div style={expandIconStyle}>
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div style={expandedContentStyle}>
          {/* Topic edit button for editable mode */}
          {editable && !isEditing && (
            <div
              style={{ marginBottom: '12px', cursor: 'pointer' }}
              onClick={() => {
                setEditTopic(session.topic || '');
                setIsEditing(true);
              }}
            >
              {renderTopicContent()}
            </div>
          )}

          {/* Progress bar */}
          <TaskProgressBar
            currentStatus={session.taskStatus}
            onChange={onStatusChange}
            editable={editable}
          />

          {/* Queue info in expanded view */}
          {showQueueInfo && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              排队位置: 第 {queuePosition} 位 | 预计等待: 约 {estimatedWaitMinutes} 分钟
            </div>
          )}
        </div>
      )}
    </div>
  );
}
