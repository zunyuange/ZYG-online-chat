/**
 * Staff Chat Window Component - Chat window for staff with session info
 */

import type { Message, Session, InputMode, TaskStatus, ContentType } from '@shared/types';
import { MessageList } from '@client/components/chat/MessageList';
import { MessageInput } from '@client/components/chat/MessageInput';
import { TopicHeader } from '@client/components/chat/TopicHeader';
import { Trash2, LogOut, ArrowRightLeft, X } from 'lucide-react';
import { useState } from 'react';

export interface VisitorFieldDef {
  fieldKey: string;
  label: string;
  type: string;
  isFixed?: boolean;
}

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
  onClearMessages?: () => void;
  onEndSession?: () => void;
  currentStaffId?: number;
  staffList?: { id: number; name: string; username: string }[];
  t?: (key: string) => string;
  visitorFieldDefs?: VisitorFieldDef[];
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
  onClearMessages,
  onEndSession,
  currentStaffId,
  staffList = [],
  t = (key: string) => key,
  visitorFieldDefs,
}: StaffChatWindowProps) {
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [recentRejections, setRecentRejections] = useState<any[]>([]);

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

  const handleTransfer = async () => {
    if (!selectedStaffId || !transferReason.trim()) {
      setTransferMessage('请选择客服并填写转接原因');
      return;
    }
    try {
      const response = await fetch('/api/chat/transfer/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify({
          sessionId: session?.id,
          toStaffId: selectedStaffId,
          reason: transferReason,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setTransferMessage('转接请求已发送');
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferMessage('');
          setSelectedStaffId(null);
          setTransferReason('');
        }, 1500);
      } else {
        setTransferMessage(result.error || '转接失败');
      }
    } catch {
      setTransferMessage('转接失败');
    }
  };

  // Load recent rejection history when modal opens
  const loadRecentRejections = async () => {
    if (!session?.id) return;
    
    try {
      const response = await fetch(`/api/chat/transfer/my?sessionId=${session.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success && result.data) {
        // Filter only rejected requests with reject_reason
        const rejections = result.data.filter((req: any) => 
          req.status === 'rejected' && req.reject_reason
        );
        setRecentRejections(rejections);
      }
    } catch {
      console.error('Failed to load recent rejections:');
    }
  };

  if (!session) {
    return (
      <div style={containerStyle}>
        <div style={placeholderStyle}>
          {t('select_session')}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={containerStyle}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                {session.unreadByStaff} {t('unread')}
              </span>
            )}
            {onClearMessages && messages.length > 0 && (
              <button
                onClick={onClearMessages}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  border: '1px solid #ff4d4f',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#ff4d4f',
                  fontSize: '12px',
                }}
                title={t('clear_messages')}
              >
                <Trash2 size={12} />
                {t('clear')}
              </button>
            )}
            {currentStaffId && session?.assignedStaffId === currentStaffId && session?.status === 'active' && staffList.length > 0 && (
              <button
                onClick={() => {
                  setShowTransferModal(true);
                  loadRecentRejections();
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'transparent',
                  border: '1px solid #1890ff',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#1890ff',
                  fontSize: '12px',
                }}
                title="会话转接"
              >
                <ArrowRightLeft size={12} />
                转接
              </button>
            )}
            {onEndSession && session?.status === 'active' && (
              <button
                onClick={onEndSession}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#ff4d4f',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                title={t('end_session')}
              >
                <LogOut size={12} />
                {t('end')}
              </button>
            )}
          </div>
        </div>

        {/* 访客信息面板 */}
        {session && <VisitorInfoPanel session={session} fieldDefs={visitorFieldDefs} />}

        {session && (
          <TopicHeader
            session={session}
            editable={true}
            queuePosition={session.queuePosition}
            estimatedWaitMinutes={session.estimatedWaitMinutes}
            onTopicChange={onTopicChange}
            onStatusChange={onStatusChange}
            compact={false}
            t={t}
          />
        )}

        <MessageList
          messages={messages}
          hasMore={hasMore}
          loading={loading}
          isOwn={(message) => message.senderType === 'staff'}
          onLoadMore={onLoadMore}
          t={t}
        />

        <MessageInput
          onSend={onSend}
          onUpload={onUpload}
          t={t}
          sending={sending}
          inputMode={inputMode}
          onModeChange={onModeChange}
          showModeToggle={true}
          isMobile={isMobile}
        />
      </div>

      {showTransferModal && (
        <div
          style={{
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
          }}
          onClick={() => {
            setShowTransferModal(false);
            setTransferMessage('');
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '20px',
              width: '400px',
              maxWidth: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px' }}>会话转接</h3>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferMessage('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                选择目标客服
              </label>
              <select
                value={selectedStaffId || ''}
                onChange={(e) => setSelectedStaffId(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="">请选择客服</option>
                {staffList
                  .filter((staff) => staff.id !== currentStaffId)
                  .map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name || staff.username}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                转接原因 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="请输入转接原因，以便对方了解情况"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px',
                  minHeight: '80px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Show recent rejection history */}
            {recentRejections.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#faad14', marginBottom: '8px' }}>
                  ️ 最近的拒绝记录
                </div>
                {recentRejections.slice(0, 2).map((rejection, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#fff7e6',
                      border: '1px solid #ffe58f',
                      borderRadius: '4px',
                      padding: '8px',
                      marginBottom: '8px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ marginBottom: '4px', color: '#666' }}>
                      被客服 <strong>{rejection.to_staff_name || rejection.to_staff_id}</strong> 拒绝
                    </div>
                    <div style={{ color: '#999' }}>
                      拒绝原因: {rejection.reject_reason}
                    </div>
                    <div style={{ color: '#bbb', marginTop: '4px' }}>
                      {new Date(rejection.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {transferMessage && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: transferMessage.includes('成功') ? '#f6ffed' : '#fff2f0',
                  color: transferMessage.includes('成功') ? '#52c41a' : '#ff4d4f',
                }}
              >
                {transferMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferMessage('');
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={handleTransfer}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#1890ff',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                发送请求
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Visitor Info Panel - 访客详细信息面板
 * 显示访客的：用户名、邮箱、手机、来源地址、进入链接、设备、IP等
 */
function VisitorInfoPanel({ session, fieldDefs }: { session: Session; fieldDefs?: VisitorFieldDef[] }) {
  const [expanded, setExpanded] = useState(false);

  // 构建字段定义映射表（fieldKey → label, type）
  const fieldDefMap = new Map<string, { label: string; type: string }>();
  if (fieldDefs) {
    for (const def of fieldDefs) {
      fieldDefMap.set(def.fieldKey, { label: def.label, type: def.type });
    }
  }
  
  const hasVisitorInfo = session.visitorName || session.email || session.phone || session.pid || session.fromUrl || session.referer || session.ip || session.userAgent || session.device || session.lang || session.avatar || (session.params && Object.keys(session.params).length > 0);
  
  if (!hasVisitorInfo) return null;

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #e8e8e8',
    padding: '8px 12px',
    fontSize: '12px',
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    color: '#666',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px 12px',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #e8e8e8',
  };

  const itemStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const labelStyle: React.CSSProperties = {
    color: '#999',
    fontSize: '11px',
  };

  const valueStyle: React.CSSProperties = {
    color: '#333',
    fontSize: '12px',
    wordBreak: 'break-all',
  };

  return (
    <div style={panelStyle}>
      <div style={headerRowStyle} onClick={() => setExpanded(!expanded)}>
        <span>📋 访客信息</span>
        <span style={{ fontSize: '10px' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      
      {expanded && (
        <div style={gridStyle}>
          {session.visitorName && (
            <div style={itemStyle}>
              <div style={labelStyle}>👤 姓名</div>
              <div style={valueStyle}>{session.visitorName}</div>
            </div>
          )}
          {session.email && (
            <div style={itemStyle}>
              <div style={labelStyle}>📧 邮箱</div>
              <div style={valueStyle}>{session.email}</div>
            </div>
          )}
          {session.phone && (
            <div style={itemStyle}>
              <div style={labelStyle}>📱 手机</div>
              <div style={valueStyle}>{session.phone}</div>
            </div>
          )}
          {session.pid && (
            <div style={itemStyle}>
              <div style={labelStyle}>🆔 用户ID</div>
              <div style={valueStyle}>{session.pid}</div>
            </div>
          )}
          {session.ip && (
            <div style={itemStyle}>
              <div style={labelStyle}>🌐 IP地址</div>
              <div style={valueStyle}>{session.ip}</div>
            </div>
          )}
          {session.fromUrl && (
            <div style={{ ...itemStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>🔗 进入链接</div>
              <div style={{ ...valueStyle, fontSize: '11px' }}>{session.fromUrl}</div>
            </div>
          )}
          {session.referer && (
            <div style={{ ...itemStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>📎 来源地址</div>
              <div style={{ ...valueStyle, fontSize: '11px' }}>{session.referer}</div>
            </div>
          )}
          {session.userAgent && (
            <div style={{ ...itemStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>💻 浏览器</div>
              <div style={{ ...valueStyle, fontSize: '11px' }}>{session.userAgent}</div>
            </div>
          )}
          {session.device && (
            <div style={itemStyle}>
              <div style={labelStyle}>📱 设备</div>
              <div style={valueStyle}>{session.device}</div>
            </div>
          )}
          {session.lang && (
            <div style={itemStyle}>
              <div style={labelStyle}>🌍 语言</div>
              <div style={valueStyle}>{session.lang}</div>
            </div>
          )}
          {session.avatar && (
            <div style={itemStyle}>
              <div style={labelStyle}>🖼️ 头像</div>
              <div style={valueStyle}>
                <a href={session.avatar} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff', fontSize: '11px' }}>
                  查看头像
                </a>
              </div>
            </div>
          )}
          {session.params && Object.keys(session.params).length > 0 && (
            <div style={{ ...itemStyle, gridColumn: '1 / -1' }}>
              <div style={labelStyle}>📝 自定义参数</div>
              <div style={{ ...valueStyle, fontSize: '11px' }}>
                {Object.entries(session.params).map(([key, value]) => {
                  const def = fieldDefMap.get(key);
                  const displayLabel = def ? def.label : key; // 有定义用label，无定义用原始key
                  const displayType = def ? def.type : 'text';
                  
                  if (displayType === 'url' && value) {
                    return (
                      <div key={key} style={{ marginBottom: '2px' }}>
                        <strong>{displayLabel}</strong>: {' '}
                        <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>
                          {value.length > 50 ? value.substring(0, 50) + '...' : value}
                        </a>
                      </div>
                    );
                  }
                  if (displayType === 'json' && value) {
                    let parsed = value;
                    try { parsed = JSON.stringify(JSON.parse(value), null, 2); } catch {}
                    return (
                      <div key={key} style={{ marginBottom: '4px' }}>
                        <strong>{displayLabel}</strong>:
                        <pre style={{ margin: '2px 0 0 0', padding: '4px 6px', backgroundColor: '#f0f0f0', borderRadius: '3px', fontSize: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {typeof parsed === 'string' ? parsed : value}
                        </pre>
                      </div>
                    );
                  }
                  return (
                    <div key={key} style={{ marginBottom: '2px' }}>
                      <strong>{displayLabel}</strong>: {value}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}