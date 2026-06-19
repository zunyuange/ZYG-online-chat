/**
 * Topic Header Component - Displays session topic, status and queue info
 */

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { type Session } from '@shared/types';

interface TopicHeaderProps {
  session: Session;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  t?: (key: string) => string;
}

export function TopicHeader({
  session,
  queuePosition,
  estimatedWaitMinutes,
  t = (key: string) => key,
}: TopicHeaderProps) {
  const showQueueInfo = queuePosition && queuePosition > 1;

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

  const queueBadgeStyle: React.CSSProperties = {
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '12px',
    backgroundColor: '#722ed1',
    color: '#fff',
    flexShrink: 0,
    marginLeft: '8px',
  };

  return (
    <div style={containerStyle}>
      <div style={topicAreaStyle}>
        <MessageSquare size={16} style={topicIconStyle} />
        <span style={topicTextStyle}>{t('important_notice') || '重要通知'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {showQueueInfo && (
          <span style={queueBadgeStyle}>
            #{queuePosition} | 约{estimatedWaitMinutes}分钟
          </span>
        )}
      </div>
    </div>
  );
}
