/**
 * Topic Header Component - Displays session topic, status and queue info
 */

import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { type Session } from '@shared/types';

interface TopicHeaderProps {
  session: Session;
  editable?: boolean;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  onTopicChange?: (topic: string) => void;
  t?: (key: string) => string;
}

export function TopicHeader({
  session,
  editable = false,
  queuePosition,
  estimatedWaitMinutes,
  onTopicChange,
  t = (key: string) => key,
}: TopicHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTopic, setEditTopic] = useState(session.topic || '');

  const showQueueInfo = queuePosition && queuePosition > 1;
  const noticeLabel = t('important_notice');

  const containerStyle: React.CSSProperties = {
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #e8e8e8',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const topicAreaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
    cursor: editable ? 'pointer' : 'default',
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

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '4px 8px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    outline: 'none',
  };

  const statusBadgeStyle: React.CSSProperties = {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '12px',
    backgroundColor: '#ff4d4f',
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

  const handleClick = () => {
    if (editable && !isEditing) {
      setEditTopic(session.topic || '');
      setIsEditing(true);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={topicAreaStyle}>
        <MessageSquare size={16} style={topicIconStyle} />

        {isEditing && editable ? (
          <input
            type="text"
            value={editTopic}
            onChange={(e) => setEditTopic(e.target.value)}
            onBlur={handleTopicSubmit}
            onKeyDown={handleKeyDown}
            placeholder={t('enter_notice_placeholder')}
            style={inputStyle}
            autoFocus
          />
        ) : editable && !session.topic ? (
          <span
            style={{ ...topicTextStyle, color: '#999', fontStyle: 'italic' }}
            onClick={handleClick}
          >
            {t('click_add_notice')}
          </span>
        ) : (
          <span
            style={{ ...topicTextStyle, cursor: editable ? 'pointer' : 'default' }}
            onClick={handleClick}
            title={session.topic || undefined}
          >
            {session.topic || t('notice_no_notice')}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* 非编辑模式（访客端）显示红色重要通知徽章 */}
        {!editable && (
          <span style={statusBadgeStyle}>{noticeLabel}</span>
        )}

        {showQueueInfo && (
          <span style={queueBadgeStyle}>
            #{queuePosition} | {t('about')} {estimatedWaitMinutes} {t('minutes_unit')}
          </span>
        )}
      </div>
    </div>
  );
}
