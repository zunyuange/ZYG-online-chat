/**
 * Message Item Component - Single message bubble
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Image, Video, FileText, Download, Languages } from 'lucide-react';
import type { Message } from '@shared/types';

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  t?: (key: string) => string;
  /** 当前界面语言，用于翻译目标 */
  currentLang?: string;
  /** 是否显示翻译按钮（仅非己方消息且无翻译时显示） */
  showTranslate?: boolean;
  /** 翻译完成回调，更新父组件消息列表 */
  onTranslated?: (messageId: number, translatedContent: string, translateEngine?: string) => void;
}

export function MessageItem({
  message,
  isOwn,
  t = (key: string) => key,
  currentLang,
  showTranslate = false,
  onTranslated,
}: MessageItemProps) {
  const [expandedMedia, setExpandedMedia] = useState<Record<string, boolean>>({});
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string>('');
  const [localTranslated, setLocalTranslated] = useState<string | undefined>(message.translatedContent);

  const formattedTime = new Date(message.createdAt).toLocaleTimeString(navigator.language || 'en', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: isOwn ? 'flex-end' : 'flex-start',
    alignSelf: isOwn ? 'flex-end' : 'flex-start', // 关键：让自己发送的消息居右
    marginBottom: '12px',
    maxWidth: '70%',
  };

  const isTextMessage = message.contentType === 'text';

  const bubbleStyle: React.CSSProperties = {
    padding: isTextMessage ? '10px 14px' : '8px',
    borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
    backgroundColor: isOwn ? '#1890ff' : '#f0f0f0',
    color: isOwn ? '#fff' : '#333',
    lineHeight: 1.5,
    textAlign: 'left',
    maxWidth: isTextMessage ? '100%' : '280px',
  };

  const metaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginTop: '4px',
    fontSize: '12px',
    color: '#999',
    gap: '6px',
  };

  const toggleMedia = useCallback((messageId: number) => {
    setExpandedMedia((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  }, []);

  // 手动翻译处理
  const handleTranslate = useCallback(async () => {
    if (!currentLang || translating) return;
    setTranslating(true);
    setTranslateError('');
    try {
      // 如果页面存在 staff_token（客服端），携带认证头
      const token = localStorage.getItem('staff_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/chat/messages/${message.id}/translate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: currentLang }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        const tc = result.data.translatedContent;
        const te = result.data.translateEngine;
        setLocalTranslated(tc);
        onTranslated?.(message.id, tc, te);
      } else {
        const errMsg = result.error || '翻译失败';
        setTranslateError(errMsg);
        console.warn('[MessageItem] Translate failed:', errMsg);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '网络错误';
      setTranslateError(errMsg);
      console.error('[MessageItem] Translate error:', err);
    } finally {
      setTranslating(false);
    }
  }, [message.id, currentLang, translating, onTranslated]);

  // 使用本地或 props 中的翻译内容
  const effectiveTranslated = localTranslated || message.translatedContent;
  // 使用的翻译引擎
  const translateEngine = message.translateEngine || '';
  // 是否显示翻译按钮：文本消息 + 尚无翻译 + 非己方消息 + 有目标语言
  const canTranslate = showTranslate && isTextMessage && !effectiveTranslated && !!currentLang && !isOwn;

  const placeholderStyle: React.CSSProperties = {
    width: '180px',
    height: '120px',
    backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    gap: '8px',
  };

  const placeholderTextStyle: React.CSSProperties = {
    fontSize: '12px',
    opacity: 0.8,
    textAlign: 'center',
  };

  const mediaContentStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '260px',
    maxHeight: '300px',
    borderRadius: '12px',
    display: 'block',
    objectFit: 'cover',
  };

  const renderImagePlaceholder = (msg: Message) => (
    <div
      style={placeholderStyle}
      onClick={() => toggleMedia(msg.id)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          toggleMedia(msg.id);
        }
      }}
    >
      <Image size={32} style={{ opacity: 0.7 }} />
      <span style={placeholderTextStyle}>{t('click_view_image')}</span>
    </div>
  );

  const renderVideoPlaceholder = (msg: Message) => (
    <div
      style={placeholderStyle}
      onClick={() => toggleMedia(msg.id)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          toggleMedia(msg.id);
        }
      }}
    >
      <Video size={32} style={{ opacity: 0.7 }} />
      <span style={placeholderTextStyle}>{t('click_view_video')}</span>
    </div>
  );

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  const renderFileContent = (msg: Message) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px',
        minWidth: '220px',
      }}
    >
      <FileText size={36} style={{ opacity: 0.8, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: '14px',
          }}
        >
          {msg.fileName || t('file_type')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
          {formatFileSize(msg.fileSize)}
        </div>
      </div>
      <a
        href={msg.content}
        download={msg.fileName}
        style={{
          padding: '8px 12px',
          backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.05)',
          borderRadius: '8px',
          color: 'inherit',
          textDecoration: 'none',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexShrink: 0,
        }}
      >
        <Download size={14} />
        {t('download')}
      </a>
    </div>
  );

  const renderContent = () => {
    // 自己发的消息直接显示，不需要点击展开（用户已经看过）
    // 对方发的消息需要点击展开以节省流量
    const shouldShowMedia = isOwn || expandedMedia[message.id];

    switch (message.contentType) {
      case 'image':
        return shouldShowMedia ? (
          <img
            src={message.content}
            alt={message.fileName || 'Image'}
            style={mediaContentStyle}
            onClick={() => window.open(message.content, '_blank')}
          />
        ) : (
          renderImagePlaceholder(message)
        );

      case 'video':
        return shouldShowMedia ? (
          <video
            controls
            style={mediaContentStyle}
            preload="metadata"
          >
            <source src={message.content} />
            {t('browser_no_video')}
          </video>
        ) : (
          renderVideoPlaceholder(message)
        );

      case 'file':
        return renderFileContent(message);

      default:
        // 文本消息：如果有翻译内容，同时显示原文和翻译
        if (effectiveTranslated && message.contentType === 'text') {
          return (
            <div>
              <div>{message.content}</div>
              <div style={{
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: `1px solid ${isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'}`,
                opacity: 0.75,
                fontSize: '0.92em',
                fontStyle: 'italic',
              }}>
                <span style={{
                  fontSize: '0.75em',
                  opacity: 0.6,
                  marginRight: '4px',
                  textTransform: 'uppercase',
                }}>🌐 TR{translateEngine ? ` (${translateEngine})` : ''}</span>
                {effectiveTranslated}
              </div>
            </div>
          );
        }
        return <span>{message.content}</span>;
    }
  };

  return (
    <div style={containerStyle}>
      <div style={bubbleStyle}>
        {renderContent()}
      </div>
      <div style={metaStyle}>
        <span>{formattedTime}</span>
        {isOwn && (
          <span style={{ color: message.isRead ? '#52c41a' : '#999' }}>
            {message.isRead ? t('read') : t('unread')}
          </span>
        )}
        {canTranslate && (
          <button
            onClick={handleTranslate}
            disabled={translating}
            title={t('click_to_translate') || 'Translate'}
            style={{
              background: 'none',
              border: 'none',
              cursor: translating ? 'default' : 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              opacity: translating ? 0.5 : 0.7,
              transition: 'opacity 0.2s',
            }}
          >
            <Languages size={14} />
          </button>
        )}
        {translateError && (
          <span style={{
            fontSize: '11px',
            color: '#ff4d4f',
            maxWidth: '200px',
            wordBreak: 'break-all',
            cursor: 'default',
          }} title={translateError}>
            ⚠ {translateError.length > 20 ? translateError.substring(0, 20) + '…' : translateError}
          </span>
        )}
      </div>
    </div>
  );
}