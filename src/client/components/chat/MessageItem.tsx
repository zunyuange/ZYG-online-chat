/**
 * Message Item Component - Single message bubble
 */

import React, { useState, useCallback } from 'react';
import { Image, Video, FileText, Download } from 'lucide-react';
import type { Message } from '@shared/types';

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
}

export function MessageItem({ message, isOwn }: MessageItemProps) {
  const [expandedMedia, setExpandedMedia] = useState<Record<string, boolean>>({});

  const formattedTime = new Date(message.createdAt).toLocaleTimeString('zh-CN', {
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
      <span style={placeholderTextStyle}>点击查看图片</span>
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
      <span style={placeholderTextStyle}>点击查看视频</span>
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
          {msg.fileName || '文件'}
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
        下载
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
            Your browser does not support video.
          </video>
        ) : (
          renderVideoPlaceholder(message)
        );

      case 'file':
        return renderFileContent(message);

      default:
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
            {message.isRead ? '已读' : '未读'}
          </span>
        )}
      </div>
    </div>
  );
}