/**
 * Queue List Component - Shows all sessions in queue (Staff view)
 */

import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Clock, User, MessageSquare } from 'lucide-react';
import type { QueueItem, TaskStatus } from '@shared/types';
import { TASK_STATUS_LIST } from '@shared/types';

interface QueueListProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession?: (sessionId: string) => void;
}

export function QueueList({ isOpen, onClose, onSelectSession }: QueueListProps) {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/staff/queue');
      const result = await response.json();
      if (result.success) {
        setQueueItems(result.data);
      } else {
        setError(result.error || 'Failed to load queue');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadQueue();
    }
  }, [isOpen]);

  const getStatusLabel = (status: TaskStatus): string => {
    return TASK_STATUS_LIST.find((s) => s.status === status)?.label || status;
  };

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case 'in_progress':
        return '#1890ff';
      case 'requirement_confirmed':
        return '#52c41a';
      case 'requirement_discussion':
        return '#faad14';
      default:
        return '#999';
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 1000,
    display: isOpen ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e8e8e8',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const refreshBtnStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: '#f0f0f0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    color: '#666',
  };

  const closeBtnStyle: React.CSSProperties = {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#999',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    marginBottom: '8px',
    cursor: onSelectSession ? 'pointer' : 'default',
    transition: 'background-color 0.2s',
  };

  const positionStyle = (status: TaskStatus): React.CSSProperties => ({
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: status === 'in_progress' ? '#1890ff' : '#f0f0f0',
    color: status === 'in_progress' ? '#fff' : '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '14px',
    flexShrink: 0,
  });

  const infoStyle: React.CSSProperties = {
    flex: 1,
    marginLeft: '12px',
    minWidth: 0,
  };

  const nameStyle: React.CSSProperties = {
    fontWeight: 500,
    fontSize: '14px',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const topicStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#999',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const statusBadgeStyle = (status: TaskStatus): React.CSSProperties => ({
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    backgroundColor: getStatusColor(status),
    color: '#fff',
    flexShrink: 0,
  });

  const timeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    color: '#999',
    marginLeft: '12px',
    flexShrink: 0,
  };

  const emptyStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#999',
  };

  const waitingCount = queueItems.filter(
    (item) => item.taskStatus !== 'in_progress'
  ).length;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={titleStyle}>
            <Clock size={20} />
            任务队列
            {waitingCount > 0 && (
              <span
                style={{
                  backgroundColor: '#ff4d4f',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                {waitingCount} 个等待
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={refreshBtnStyle}
              onClick={loadQueue}
              disabled={loading}
              title="刷新"
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              刷新
            </button>
            <button style={closeBtnStyle} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {loading && queueItems.length === 0 ? (
            <div style={emptyStyle}>加载中...</div>
          ) : error ? (
            <div style={{ ...emptyStyle, color: '#ff4d4f' }}>{error}</div>
          ) : queueItems.length === 0 ? (
            <div style={emptyStyle}>暂无排队中的任务</div>
          ) : (
            queueItems.map((item) => (
              <div
                key={item.sessionId}
                style={itemStyle}
                onClick={() => {
                  if (onSelectSession) {
                    onSelectSession(item.sessionId);
                    onClose();
                  }
                }}
                onMouseEnter={(e) => {
                  if (onSelectSession) {
                    e.currentTarget.style.backgroundColor = '#e6f7ff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fafafa';
                }}
              >
                <div style={positionStyle(item.taskStatus)}>
                  {item.taskStatus === 'in_progress' ? (
                    <User size={16} />
                  ) : (
                    `#${item.position}`
                  )}
                </div>
                <div style={infoStyle}>
                  <div style={nameStyle}>
                    {item.visitorName}
                    <span style={statusBadgeStyle(item.taskStatus)}>
                      {getStatusLabel(item.taskStatus)}
                    </span>
                  </div>
                  {item.topic && (
                    <div style={topicStyle}>
                      <MessageSquare size={10} style={{ marginRight: '4px' }} />
                      {item.topic}
                    </div>
                  )}
                </div>
                {item.taskStatus !== 'in_progress' && item.waitMinutes > 0 && (
                  <div style={timeStyle}>
                    <Clock size={12} />
                    {item.waitMinutes}分钟
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
