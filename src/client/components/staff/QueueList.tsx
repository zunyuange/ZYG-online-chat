/**
 * Queue List Component - Shows all sessions in queue (Staff view)
 */

import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Clock, User, MessageSquare, ArrowRightLeft } from 'lucide-react';
import type { QueueItem, TaskStatus } from '@shared/types';
import { TASK_STATUS_LIST } from '@shared/types';

interface QueueListProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession?: (sessionId: string) => void;
}

export function QueueList({ isOpen, onClose, onSelectSession }: QueueListProps) {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [transferRequests, setTransferRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('staff_token');
      // Use the new endpoint that returns current staff's queue with transfer requests
      const response = await fetch('/api/staff/queue/my', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setQueueItems(result.data.sessions || []);
        setTransferRequests(result.data.transferRequests || []);
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

  const handleAcceptTransfer = async (requestId: number) => {
    try {
      const token = localStorage.getItem('staff_token');
      const response = await fetch(`/api/chat/transfer/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'accept' }),
      });
      const result = await response.json();
      if (result.success) {
        // Refresh queue list
        await loadQueue();
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
    if (!selectedTransfer) return;
    
    if (!rejectReason.trim()) {
      alert('请填写拒绝原因');
      return;
    }

    try {
      const token = localStorage.getItem('staff_token');
      const response = await fetch(`/api/chat/transfer/${selectedTransfer.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'reject', reason: rejectReason }),
      });
      const result = await response.json();
      if (result.success) {
        // Close modal and refresh
        setShowRejectModal(false);
        setRejectReason('');
        setSelectedTransfer(null);
        await loadQueue();
        alert('已拒绝转接请求');
      } else {
        alert(result.error || '拒绝失败');
      }
    } catch (error) {
      console.error('Failed to reject transfer:', error);
      alert('拒绝失败');
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

  // Reject Modal Styles
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalContentStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    width: '400px',
    maxWidth: '90%',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
  };

  const modalTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#333',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '100px',
    padding: '12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
  };

  const modalButtonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
    justifyContent: 'flex-end',
  };

  const modalBtnStyle = (type: 'primary' | 'danger' | 'default'): React.CSSProperties => ({
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: type === 'primary' ? '#1890ff' : type === 'danger' ? '#ff4d4f' : '#f0f0f0',
    color: type === 'default' ? '#333' : '#fff',
  });

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
          {loading && queueItems.length === 0 && transferRequests.length === 0 ? (
            <div style={emptyStyle}>加载中...</div>
          ) : error ? (
            <div style={{ ...emptyStyle, color: '#ff4d4f' }}>{error}</div>
          ) : (
            <>
              {/* Transfer Requests Section */}
              {transferRequests.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#faad14',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ArrowRightLeft size={14} />
                    申请会话转接 ({transferRequests.length})
                  </div>
                  {transferRequests.map((request) => (
                    <div
                      key={request.id}
                      style={{
                        backgroundColor: '#fffbe6',
                        border: '1px solid #ffe58f',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedTransfer(request)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 500, fontSize: '14px' }}>
                          {request.session?.visitor_name || '未知访客'}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            backgroundColor: '#faad14',
                            color: '#fff',
                          }}
                        >
                          待处理
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        来自客服: {request.from_staff_name || request.from_staff_id}
                      </div>
                      {request.reason && (
                        <div style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>
                          "{request.reason}"
                        </div>
                      )}
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        <button
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            backgroundColor: '#52c41a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptTransfer(request.id);
                          }}
                        >
                          同意
                        </button>
                        <button
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            backgroundColor: '#ff4d4f',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowRejectModal(true);
                            setSelectedTransfer(request);
                          }}
                        >
                          拒绝
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sessions Section */}
              {queueItems.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#666',
                      marginBottom: '8px',
                    }}
                  >
                    我的会话 ({queueItems.length})
                  </div>
                  {queueItems.map((item) => (
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
            ))}
                </div>
              )}

              {/* Empty State */}
              {queueItems.length === 0 && transferRequests.length === 0 && (
                <div style={emptyStyle}>暂无排队中的任务</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedTransfer && (
        <div style={modalOverlayStyle} onClick={() => setShowRejectModal(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalTitleStyle}>拒绝转接请求</div>
            <div style={{ marginBottom: '16px', fontSize: '14px', color: '#666' }}>
              您正在拒绝来自客服 {selectedTransfer.from_staff_name || selectedTransfer.from_staff_id} 的转接申请
            </div>
            <textarea
              style={textareaStyle}
              placeholder="请输入拒绝原因（必填）"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
            <div style={modalButtonGroupStyle}>
              <button
                style={modalBtnStyle('default')}
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
              >
                取消
              </button>
              <button
                style={modalBtnStyle('danger')}
                onClick={() => handleRejectTransfer()}
                disabled={!rejectReason.trim()}
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
