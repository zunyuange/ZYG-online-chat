/**
 * Message Item Component - Single message bubble
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Image, Video, FileText, Download, Languages, ChevronDown } from 'lucide-react';
import type { Message } from '@shared/types';

/** 翻译引擎列表（与后端 ALL_TRANSLATE_ENGINES 保持一致，按推荐优先级排序） */
const TRANSLATE_ENGINES = [
  { key: 'cloudflare', label: 'Cloudflare AI 翻译', icon: '☁️' },
  { key: 'pearapi', label: 'PearApi 万能翻译', icon: '🔄' },
  { key: 'simplytranslate', label: 'SimplyTranslate AI', icon: '🌍' },
  { key: 'google', label: 'Google Translate', icon: '🔍' },
  { key: 'mymemory', label: 'MyMemory', icon: '📚' },
] as const;

/** 引擎 key → 显示名称映射 */
const ENGINE_LABEL: Record<string, string> = {};
TRANSLATE_ENGINES.forEach((e) => { ENGINE_LABEL[e.key] = e.label; });

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  t?: (key: string) => string;
  /** 当前界面语言，用于翻译目标 */
  currentLang?: string;
  /** 是否显示翻译渠道按钮（非己方文本消息时显示，点击可切换翻译引擎） */
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
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    if (!showEngineDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowEngineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEngineDropdown]);

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
        // same_language：文本已是目标语言，无需翻译，仅给信息提示
        if (te === 'same_language') {
          setTranslateError(result.info || '文本已是目标语言，无需翻译');
          return;
        }
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

  // 使用指定引擎重新翻译（客服切换翻译渠道）
  const handleReTranslate = useCallback(async (engine: string) => {
    if (!currentLang || translating) return;
    setShowEngineDropdown(false);
    setTranslating(true);
    setTranslateError('');
    try {
      const token = localStorage.getItem('staff_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const response = await fetch(`/api/chat/messages/${message.id}/translate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: currentLang, engine }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        const tc = result.data.translatedContent;
        const te = result.data.translateEngine;
        if (te === 'same_language') {
          setTranslateError(result.info || '文本已是目标语言，无需翻译');
          return;
        }
        setLocalTranslated(tc);
        onTranslated?.(message.id, tc, te);
      } else {
        const errMsg = result.error || '翻译失败';
        setTranslateError(errMsg);
        console.warn('[MessageItem] Re-translate failed:', errMsg);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '网络错误';
      setTranslateError(errMsg);
      console.error('[MessageItem] Re-translate error:', err);
    } finally {
      setTranslating(false);
    }
  }, [message.id, currentLang, translating, onTranslated]);

  // 使用本地或 props 中的翻译内容
  const effectiveTranslated = localTranslated || message.translatedContent;
  // 使用的翻译引擎
  const translateEngine = message.translateEngine || '';
  // 是否显示翻译渠道按钮：文本消息 + 尚无翻译 + 非己方消息 + 有目标语言
  const canTranslate = showTranslate && isTextMessage && !effectiveTranslated && !!currentLang && !isOwn;
  // 是否已翻译且有内容显示（用于内嵌翻译下拉菜单）
  const hasTranslation = showTranslate && isTextMessage && !!effectiveTranslated && !isOwn;

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
          const currentEngine = message.translateEngine || '';
          const engineDisplayName = ENGINE_LABEL[currentEngine] || currentEngine || '';
          
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
                <div ref={dropdownRef} style={{ display: 'inline', position: 'relative' }}>
                  {/* 可点击的翻译标签 → 打开引擎切换菜单 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEngineDropdown(!showEngineDropdown); }}
                    disabled={translating}
                    title={t('click_to_switch_engine') || '点击切换翻译引擎'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      padding: '1px 5px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px',
                      backgroundColor: translating ? '#f5f5f5' : '#fafafa',
                      cursor: translating ? 'default' : 'pointer',
                      fontSize: '0.7em',
                      color: '#666',
                      verticalAlign: 'middle',
                      marginRight: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    🌐 TR
                    <ChevronDown size={10} style={{ opacity: 0.5 }} />
                  </button>
                  
                  {/* 下拉菜单 */}
                  {showEngineDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      backgroundColor: '#fff',
                      border: '1px solid #e8e8e8',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      zIndex: 1000,
                      minWidth: '200px',
                      overflow: 'hidden',
                    }}>
                      {/* 当前引擎标题 */}
                      <div style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        color: '#999',
                        borderBottom: '1px solid #f0f0f0',
                        backgroundColor: '#fafbfc',
                      }}>
                        {t('current_engine') || '当前引擎'}: {engineDisplayName || t('unknown') || '未知'}
                      </div>
                      
                      {/* 引擎选项列表 */}
                      {TRANSLATE_ENGINES.map((eng) => (
                        <button
                          key={eng.key}
                          onClick={(e) => { e.stopPropagation(); handleReTranslate(eng.key); }}
                          disabled={translating}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            backgroundColor: currentEngine === eng.key ? '#e6f7ff' : '#fff',
                            cursor: translating ? 'default' : 'pointer',
                            fontSize: '12px',
                            color: '#333',
                            textAlign: 'left',
                            transition: 'background-color 0.15s',
                            borderBottom: '1px solid #f5f5f5',
                          }}
                        >
                          <span>{eng.icon}</span>
                          <span style={{ flex: 1 }}>{eng.label}</span>
                          {currentEngine === eng.key && (
                            <span style={{ fontSize: '10px', color: '#52c41a' }}>✓</span>
                          )}
                        </button>
                      ))}

                    </div>
                  )}
                </div>
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
          <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
            {/* 翻译渠道选择按钮 — 始终显示下拉菜单而非直接翻译 */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowEngineDropdown(!showEngineDropdown); }}
              disabled={translating}
              title={t('click_to_choose_engine') || '选择翻译渠道'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                padding: '2px 5px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                backgroundColor: translating ? '#f5f5f5' : '#fafafa',
                cursor: translating ? 'default' : 'pointer',
                fontSize: '11px',
                color: '#1890ff',
                transition: 'all 0.15s',
              }}
            >
              <Languages size={12} />
              <span>{t('translate') || '翻译'}</span>
              <ChevronDown size={10} style={{ opacity: 0.5 }} />
            </button>

            {/* 翻译引擎下拉菜单 */}
            {showEngineDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                backgroundColor: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                zIndex: 1000,
                minWidth: '200px',
                overflow: 'hidden',
              }}>
                {/* 标题 */}
                <div style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  color: '#999',
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: '#fafbfc',
                }}>
                  {t('choose_translate_engine') || '选择翻译渠道'}
                </div>

                {/* 各翻译引擎选项 */}
                {TRANSLATE_ENGINES.map((eng) => (
                  <button
                    key={eng.key}
                    onClick={(e) => { e.stopPropagation(); handleReTranslate(eng.key); }}
                    disabled={translating}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: '#fff',
                      cursor: translating ? 'default' : 'pointer',
                      fontSize: '12px',
                      color: '#333',
                      textAlign: 'left',
                      transition: 'background-color 0.15s',
                      borderBottom: '1px solid #f5f5f5',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fafafa'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
                  >
                    <span>{eng.icon}</span>
                    <span style={{ flex: 1 }}>{eng.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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