/**
 * Message Input Component - Text input and file upload
 */

import { useState, useRef } from 'react';
import { Paperclip, Send, MessageSquare, Pin } from 'lucide-react';
import type { ContentType, InputMode } from '@shared/types';

interface MessageInputProps {
  onSend: (content: string, type: ContentType) => void;
  onUpload: (file: File) => void;
  sending: boolean;
  disabled?: boolean;
  // 新增：模式切换相关
  inputMode?: InputMode;
  onModeChange?: (mode: InputMode) => void;
  showModeToggle?: boolean;
  isMobile?: boolean;
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
}: MessageInputProps) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      alert('请选择图片、视频或支持的文件类型（CSV, ZIP, IPA, PDF, DOC, XLS等）');
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

  const placeholder = inputMode === 'topic' ? '输入主题...' : '输入消息...';

  return (
    <form style={containerStyle} onSubmit={handleSubmit}>
      {/* Mode toggle button (staff only) - 双图标切换 */}
      {showModeToggle && onModeChange && (
        <div style={modeToggleContainerStyle}>
          <button
            type="button"
            style={modeIconStyle(inputMode === 'chat')}
            onClick={() => onModeChange('chat')}
            title="聊天模式"
          >
            <MessageSquare size={isMobile ? 14 : 16} />
            {!isMobile && inputMode === 'chat' && '聊天'}
          </button>
          <button
            type="button"
            style={modeIconStyle(inputMode === 'topic')}
            onClick={() => onModeChange('topic')}
            title="主题模式"
          >
            <Pin size={isMobile ? 14 : 16} />
            {!isMobile && inputMode === 'topic' && '主题'}
          </button>
        </div>
      )}

      {/* Unified file upload (image, video, file) */}
      <label style={iconButtonStyle} title="发送文件/图片/视频">
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