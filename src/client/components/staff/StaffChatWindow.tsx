/**
 * Staff Chat Window Component - Chat window for staff with session info
 */

import type { Message, Session, InputMode, ContentType } from '@shared/types';
import { MessageList } from '@client/components/chat/MessageList';
import { MessageInput } from '@client/components/chat/MessageInput';
import { TopicHeader } from '@client/components/chat/TopicHeader';
import { Trash2, LogOut, ArrowRightLeft, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@client/context/I18nContext';

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
  onClearMessages?: () => void;
  onEndSession?: () => void;
  onTransfer?: () => void;
  currentStaffId?: number;
  staffList?: { id: number; name: string; username: string }[];
  t?: (key: string) => string;
  /** Show manual translate button on messages */
  showTranslate?: boolean;
  /** Current target language for translation */
  translateLang?: string;
  /** Callback when a message is manually translated */
  onTranslated?: (messageId: number, translatedContent: string, translateEngine?: string) => void;
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
  onClearMessages,
  onEndSession,
  currentStaffId,
  staffList = [],
  t = (key: string) => key,
  showTranslate = false,
  translateLang,
  onTranslated,
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
    backgroundColor: '#f5f6fa',
  };

  const headerStyle: React.CSSProperties = {
    padding: '14px 18px',
    borderBottom: '1px solid #e8ecf1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    backgroundColor: '#fff',
  };

  const infoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
    flex: 1,
  };

  const headerAvatarStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: '#5c7cfa',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '15px',
    fontWeight: 700,
    flexShrink: 0,
  };

  // 判断访客是否真正在线：基于 lastVisitorActivityAt，与 SessionList / StaffPage 保持一致
  const isVisitorOnline = (s: Session): boolean => {
    if (s.status !== 'active') return false;
    const threshold = 5 * 60 * 1000; // 5分钟
    if (s.lastVisitorActivityAt) {
      return Date.now() - new Date(s.lastVisitorActivityAt).getTime() < threshold;
    }
    return false;
  };

  const statusDotStyle = (online: boolean): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: online ? '#51cf66' : '#ced4da',
    flexShrink: 0,
    boxShadow: online ? '0 0 0 3px rgba(81,207,102,0.25)' : 'none',
    animation: online ? 'pulseGreen 2s ease-in-out infinite' : 'none',
  });

  const actionBtnStyle = (color: string): React.CSSProperties => ({
    padding: '5px 10px',
    backgroundColor: 'transparent',
    border: `1px solid ${color}`,
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: color,
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
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
      setTransferMessage(t('transfer_select_staff_hint'));
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
        setTransferMessage(t('transfer_sent'));
        setTimeout(() => {
          setShowTransferModal(false);
          setTransferMessage('');
          setSelectedStaffId(null);
          setTransferReason('');
        }, 1500);
      } else {
        setTransferMessage(result.error || t('transfer_failed'));
      }
    } catch {
      setTransferMessage(t('transfer_failed'));
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
      <style>{`
        @keyframes pulseGreen {
          0%, 100% { box-shadow: 0 0 0 3px rgba(81,207,102,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(81,207,102,0.1); }
        }
      `}</style>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={infoStyle}>
            {/* 访客头像 */}
            <div style={headerAvatarStyle}>
              {(session.visitorName?.match(/[\u4e00-\u9fff\w]/) || ['?'])[0].toUpperCase()}
            </div>
            {/* 状态点 + 名字 + 时间 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={statusDotStyle(isVisitorOnline(session))} />
                <span style={{ fontWeight: 600, fontSize: '15px', color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.visitorName}
                </span>
              </div>
              <span style={{ color: '#adb5bd', fontSize: '11px', paddingLeft: '15px' }}>
                {new Date(session.createdAt).toLocaleString(navigator.language || 'en', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {session.unreadByStaff > 0 && (
              <span
                style={{
                  backgroundColor: '#ff4d4f',
                  color: '#fff',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {session.unreadByStaff} {t('unread')}
              </span>
            )}
            {onClearMessages && messages.length > 0 && (
              <button
                onClick={onClearMessages}
                style={actionBtnStyle('#ff6b6b')}
                title={t('clear_messages')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Trash2 size={13} />
                {t('clear')}
              </button>
            )}
            {currentStaffId && session?.assignedStaffId === currentStaffId && session?.status === 'active' && staffList.length > 0 && (
              <button
                onClick={() => {
                  setShowTransferModal(true);
                  loadRecentRejections();
                }}
                style={actionBtnStyle('#5c7cfa')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f4ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ArrowRightLeft size={13} />
                {t('transfer')}
              </button>
            )}
            {onEndSession && (
              <button
                onClick={onEndSession}
                style={actionBtnStyle('#ff922b')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff9f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <LogOut size={13} />
                {t('end')}
              </button>
            )}
          </div>
        </div>

        {/* 来源面板 — 仅显示进入链接 + 来源地址 */}
        {session && <SourcePanel session={session} />}

        {session && (
          <TopicHeader
            session={session}
            editable={true}
            queuePosition={session.queuePosition}
            estimatedWaitMinutes={session.estimatedWaitMinutes}
            onTopicChange={onTopicChange}
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
          currentLang={translateLang}
          showTranslate={showTranslate}
          onTranslated={onTranslated}
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
              <h3 style={{ margin: 0, fontSize: '16px' }}>{t('session_transfer')}</h3>
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
                {t('select_target_staff')}
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
                <option value="">{t('select_staff')}</option>
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
                {t('transfer_reason_label')} <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder={t('transfer_reason_placeholder')}
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
                  {t('recent_reject_records')}
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
                      {t('rejected_by_staff')}<strong>{rejection.to_staff_name || rejection.to_staff_id}</strong>{t('rejected')}
                    </div>
                    <div style={{ color: '#999' }}>
                      {t('reject_reason_prefix')}{rejection.reject_reason}
                    </div>
                    <div style={{ color: '#bbb', marginTop: '4px' }}>
                      {new Date(rejection.created_at).toLocaleString(navigator.language || 'en')}
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
                {t('cancel')}
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
                {t('send_request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ===================== 域名提取工具函数 =====================
function extractUrlParts(url?: string): { domain: string; path: string } {
  if (!url) return { domain: '', path: '' };
  try {
    const u = new URL(url);
    return { domain: u.hostname.replace(/^www\\./, ''), path: u.pathname + u.search + u.hash };
  } catch {
    return { domain: url, path: '' };
  }
}

/**
 * 来源面板 — 仅显示「进入链接」+「来源地址」，紧凑模式
 */
function SourcePanel({ session }: { session: Session }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const fromUrl = session.fromUrl || '';
  const referer = session.referer || '';

  if (!fromUrl && !referer) return null;

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#f0f5ff',
    borderBottom: '1px solid #d6e4ff',
    padding: '6px 12px',
    fontSize: '12px',
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    color: '#666',
  };

  return (
    <div style={panelStyle}>
      <div style={headerRowStyle} onClick={() => setExpanded(!expanded)}>
        <span>{t('staff_chat_source_title')}</span>
        <span style={{ fontSize: '10px' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #d6e4ff' }}>
          {fromUrl && (
            <SourceUrlRow
              label={t('staff_chat_entry_url')}
              url={fromUrl}
              color="#1890ff"
              bgColor="#e6f7ff"
              borderColor="#91d5ff"
            />
          )}
          {referer && (
            <SourceUrlRow
              label={t('staff_chat_source_url')}
              url={referer}
              color="#d46b08"
              bgColor="#fff7e6"
              borderColor="#ffd591"
            />
          )}
        </div>
      )}
    </div>
  );
}

/** 来源面板中单条 URL 行组件 */
function SourceUrlRow({ label, url, color, bgColor, borderColor }: {
  label: string; url: string; color: string; bgColor: string; borderColor: string;
}) {
  const { domain, path } = extractUrlParts(url);
  return (
    <div style={{
      marginBottom: '4px',
      padding: '6px 8px',
      backgroundColor: bgColor,
      borderRadius: '4px',
      border: `1px solid ${borderColor}`,
    }}>
      <div style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>{label}</div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color, fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '2px' }}
      >
        {domain || url}
      </a>
      {path && path.length > 1 && (
        <div style={{ color: '#aaa', fontSize: '10px', wordBreak: 'break-all' }}>
          {path.length > 60 ? path.substring(0, 60) + '…' : path}
        </div>
      )}
    </div>
  );
}

/**
 * 访客信息面板 — 竖屏单列布局，分区显示（系统固定字段 / 自定义字段）
 * 注意：fromUrl 和 referer 已在「来源」面板显示，此处隐藏
 */
export function VisitorInfoPanel({ session, fieldDefs, t: externalT }: { session: Session; fieldDefs?: VisitorFieldDef[]; t?: (key: string) => string }) {
  const { t: hookT } = useI18n();
  const t = externalT || hookT;
  // ═══════════════ 字段定义 ═══════════════
  interface FixedFieldDef { fieldKey: string; label: string; type: string; icon: string }
  const defaultFixedDefs: FixedFieldDef[] = [
    { fieldKey: 'userName', label: t('fixed_field_userName'), type: 'text', icon: '👤' },
    { fieldKey: 'email',    label: t('fixed_field_email'),    type: 'text', icon: '📧' },
    { fieldKey: 'phone',    label: t('fixed_field_phone'),    type: 'text', icon: '📱' },
    { fieldKey: 'pid',      label: t('fixed_field_pid'),      type: 'text', icon: '🆔' },
    { fieldKey: 'ip',       label: t('fixed_field_ip'),       type: 'text', icon: '🌐' },
    // fromUrl / referer 不在此显示（已在来源面板）
    { fieldKey: 'userAgent',label: t('fixed_field_userAgent'), type: 'text', icon: '💻' },
    { fieldKey: 'device',   label: t('fixed_field_device'),   type: 'text', icon: '📱' },
    { fieldKey: 'lang',     label: t('fixed_field_lang'),     type: 'text', icon: '🌍' },
    { fieldKey: 'avatar',   label: t('fixed_field_avatar'),   type: 'url', icon: '🖼️' },
  ];

  const fieldDefMap = new Map<string, { label: string; type: string; isFixed: boolean }>();
  for (const d of defaultFixedDefs) {
    fieldDefMap.set(d.fieldKey, { label: d.label, type: d.type, isFixed: true });
  }
  if (fieldDefs) {
    for (const def of fieldDefs) {
      fieldDefMap.set(def.fieldKey, { label: def.label, type: def.type, isFixed: def.isFixed ?? false });
    }
  }

  // ═══════════════ session 固定字段值 ═══════════════
  const sessionFixedValues: Record<string, string | undefined> = {
    userName: session.visitorName,
    email: session.email,
    phone: session.phone,
    pid: session.pid,
    ip: session.ip,
    userAgent: session.userAgent,
    device: session.device,
    lang: session.lang,
    avatar: session.avatar,
  };

  // ═══════════════ 收集字段 ═══════════════
  interface FieldItem { fieldKey: string; label: string; type: string; value: string; icon?: string }
  const fixedFields: FieldItem[] = [];
  const customFields: FieldItem[] = [];

  for (const df of defaultFixedDefs) {
    const value = sessionFixedValues[df.fieldKey];
    if (value) {
      const def = fieldDefMap.get(df.fieldKey)!;
      fixedFields.push({ fieldKey: df.fieldKey, label: def.label, type: def.type, value, icon: df.icon });
    }
  }

  if (session.params) {
    for (const [key, value] of Object.entries(session.params)) {
      const def = fieldDefMap.get(key);
      customFields.push({
        fieldKey: key,
        label: def ? def.label : key,
        type: def ? def.type : 'text',
        value,
      });
    }
  }

  const allFields = [...fixedFields, ...customFields];
  if (allFields.length === 0) return null;

  // ═══════════════ 样式 ═══════════════
  const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #e8e8e8',
    padding: '10px 14px',
    fontSize: '12px',
  };

  const fieldRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '6px 8px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #f0f0f0',
  };

  const labelCellStyle: React.CSSProperties = {
    flexShrink: 0,
    width: '80px',
    color: '#999',
    fontSize: '12px',
    lineHeight: '20px',
  };

  const valueCellStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    color: '#333',
    fontSize: '13px',
    wordBreak: 'break-all',
    lineHeight: '20px',
  };

  const sectionStyle: React.CSSProperties = {
    color: '#bbb',
    fontSize: '11px',
    padding: '8px 0 2px 0',
    borderTop: '1px dashed #e0e0e0',
  };

  // ═══════════════ 渲染 ═══════════════
  const renderValue = (field: FieldItem) => {
    if (field.fieldKey === 'avatar') {
      return <a href={field.value} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>{t('staff_chat_view_avatar')}</a>;
    }
    if (field.type === 'url') {
      return <a href={field.value} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff', wordBreak: 'break-all' }}>{field.value.length > 60 ? field.value.substring(0, 60) + '…' : field.value}</a>;
    }
    if (field.type === 'json') {
      let parsed = field.value;
      try { parsed = JSON.stringify(JSON.parse(field.value), null, 2); } catch { /* 非 JSON 则原样 */ }
      return <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{typeof parsed === 'string' ? parsed : field.value}</pre>;
    }
    return field.value;
  };

  const hasBothSections = fixedFields.length > 0 && customFields.length > 0;

  return (
    <div style={panelStyle}>
      {/* 标题 */}
      <div style={{
        color: '#999',
        fontSize: '11px',
        marginBottom: '10px',
        fontWeight: 500,
      }}>
        {t('staff_chat_visitor_info_title')} ({allFields.length}{t('staff_chat_items')})
      </div>

      {/* ═══ 系统固定字段 ═══ */}
      {fixedFields.length > 0 && (
        <div style={sectionStyle}>{t('staff_chat_system_fields')}</div>
      )}
      {fixedFields.map((field) => (
        <div key={field.fieldKey} style={fieldRowStyle}>
          <span style={labelCellStyle}>{field.icon} {field.label}</span>
          <span style={valueCellStyle}>{renderValue(field)}</span>
        </div>
      ))}

      {/* ═══ 自定义字段 ═══ */}
      {customFields.length > 0 && (
        <div style={{ ...sectionStyle, ...(hasBothSections ? {} : { borderTop: 'none', paddingTop: 0 }) }}>
          {t('staff_chat_custom_fields')}
        </div>
      )}
      {customFields.map((field) => (
        <div key={field.fieldKey} style={fieldRowStyle}>
          <span style={labelCellStyle}>🔧 {field.label}</span>
          <span style={valueCellStyle}>{renderValue(field)}</span>
        </div>
      ))}
    </div>
  );
}