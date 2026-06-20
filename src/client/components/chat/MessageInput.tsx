/**
 * Message Input Component - Text input and file upload
 */

import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, MessageSquare, Pin, Smile } from 'lucide-react';
import type { ContentType, InputMode } from '@shared/types';
import 'emoji-picker-element';

interface MessageInputProps {
  onSend: (content: string, type: ContentType) => void;
  onUpload: (file: File) => void;
  sending: boolean;
  disabled?: boolean;
  inputMode?: InputMode;
  onModeChange?: (mode: InputMode) => void;
  showModeToggle?: boolean;
  isMobile?: boolean;
  t?: (key: string) => string;
}

export function MessageInput({
  onSend,
  onUpload,
  sending,
  disabled,
  inputMode = 'chat',
  onModeChange,
  showModeToggle = false,
  isMobile = false,
  t = (key: string) => key,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inject emoji picker styles
  useEffect(() => {
    if (document.querySelector('#emoji-picker-styles')) return;
    const style = document.createElement('style');
    style.id = 'emoji-picker-styles';
    style.textContent = `
      emoji-picker {
        --background: #fff;
        --border-color: rgba(0, 0, 0, 0.1);
        --border-radius: 10px;
        --emoji-padding: 0.4rem;
        --category-emoji-size: 1.2rem;
        --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Handle emoji click
  useEffect(() => {
    const picker = emojiPickerRef.current;
    if (!picker) return;

    const handleEmojiClick = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.unicode) {
        setText((prev) => prev + customEvent.detail.unicode);
        setShowEmojiPicker(false);
      }
    };

    picker.addEventListener('emoji-click', handleEmojiClick);
    return () => {
      picker.removeEventListener('emoji-click', handleEmojiClick);
    };
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending || disabled) return;

    onSend(text.trim(), 'text');
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine content type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    // Check if it's a general file (CSV, ZIP, IPA, etc.)
    const allowedFileTypes = [
      'text/csv', 'application/csv', 'application/zip', 'application/x-zip-compressed',
      'application/octet-stream', 'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExtensions = ['.csv', '.zip', '.ipa', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.apk', '.dmg'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const isFile = allowedFileTypes.includes(file.type) || allowedExtensions.includes(fileExt);

    if (!isImage && !isVideo && !isFile) {
      alert(t('ext_error'));
      return;
    }

    onUpload(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: isMobile ? '8px 12px' : '12px 16px',
    backgroundColor: '#fff',
    borderTop: '1px solid #e8e8e8',
    gap: '8px',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: isMobile ? '8px 12px' : '10px 14px',
    border: '1px solid #d9d9d9',
    borderRadius: '20px',
    fontSize: '14px',
    outline: 'none',
    resize: 'none',
    maxHeight: '100px',
    lineHeight: '1.5',
  };

  const buttonStyle: React.CSSProperties = {
    padding: isMobile ? '8px 16px' : '10px 20px',
    backgroundColor: sending || disabled ? '#d9d9d9' : '#1890ff',
    color: '#fff',
    border: 'none',
    borderRadius: '20px',
    fontSize: '14px',
    cursor: sending || disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: isMobile ? '36px' : 'auto',
  };

  const iconButtonStyle: React.CSSProperties = {
    padding: isMobile ? '8px' : '10px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '50%',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
    color: '#666',
    transition: 'color 0.2s',
    flexShrink: 0,
  };

  // 模式切换按钮样式 - 双图标切换
  const modeToggleContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: '16px',
    padding: '2px',
    flexShrink: 0,
  };

  const modeIconStyle = (isActive: boolean): React.CSSProperties => ({
    padding: isMobile ? '6px' : (isActive ? '6px 10px' : '6px'),
    backgroundColor: isActive ? '#1890ff' : 'transparent',
    color: isActive ? '#fff' : '#999',
    borderRadius: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    fontSize: '12px',
    transition: 'all 0.2s ease',
    border: 'none',
    minWidth: isMobile ? '28px' : 'auto',
  });

  const placeholder = inputMode === 'topic' ? t('please_enter') : t('please_enter_message');

  // Emoji picker styles
  const emojiPickerContainerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '50px',
    left: '0',
    zIndex: 100,
    boxShadow: '0 3px 12px rgba(0, 0, 0, 0.15)',
    opacity: showEmojiPicker ? 1 : 0,
    transform: showEmojiPicker ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    display: showEmojiPicker ? 'block' : 'none',
  };

  return (
    <form style={containerStyle} onSubmit={handleSubmit}>
      {/* Mode toggle button (staff only) - 双图标切换 */}
      {showModeToggle && onModeChange && (
        <div style={modeToggleContainerStyle}>
          <button
            type="button"
            style={modeIconStyle(inputMode === 'chat')}
            onClick={() => onModeChange('chat')}
            title={t('chat_mode_title')}
          >
            <MessageSquare size={isMobile ? 14 : 16} />
            {!isMobile && inputMode === 'chat' && t('chat_mode_chat')}
          </button>
          <button
            type="button"
            style={modeIconStyle(inputMode === 'topic')}
            onClick={() => onModeChange('topic')}
            title={t('topic_mode_title')}
          >
            <Pin size={isMobile ? 14 : 16} />
            {!isMobile && inputMode === 'topic' && t('topic_mode_topic')}
          </button>
        </div>
      )}

      {/* Emoji button and picker */}
      <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          style={iconButtonStyle}
          onClick={(e) => {
            e.stopPropagation();
            setShowEmojiPicker(!showEmojiPicker);
          }}
          disabled={disabled || sending}
          title={t('send_emoji_title')}
        >
          <Smile size={isMobile ? 20 : 22} />
        </button>
        <div style={emojiPickerContainerStyle}>
          {/* @ts-expect-error - emoji-picker is a custom element */}
          <emoji-picker ref={emojiPickerRef as React.RefObject<any>} />
        </div>
      </div>

      {/* Unified file upload (image, video, file) */}
      <label style={iconButtonStyle} title={t('send_files')}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,.csv,.zip,.ipa,.pdf,.doc,.docx,.xls,.xlsx,.apk,.dmg"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          disabled={disabled || sending}
        />
        <Paperclip size={isMobile ? 20 : 22} />
      </label>

      {/* Text input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={inputStyle}
        rows={1}
        disabled={disabled || sending}
      />

      {/* Send button */}
      <button
        type="submit"
        style={buttonStyle}
        disabled={!text.trim() || sending || disabled}
      >
        {sending ? '...' : <Send size={isMobile ? 16 : 18} />}
      </button>
    </form>
  );
}