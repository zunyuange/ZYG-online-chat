/**
 * Message List Component - Scrollable message list with pagination
 */

import { useRef, useEffect, useCallback } from 'react';
import type { Message } from '@shared/types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  hasMore: boolean;
  loading: boolean;
  isOwn: (message: Message) => boolean;
  onLoadMore: () => void;
}

export function MessageList({
  messages,
  hasMore,
  loading,
  isOwn,
  onLoadMore,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollHeightRef = useRef(0);
  const prevMessagesLengthRef = useRef(0);
  const shouldScrollToBottomRef = useRef(true);
  const lastMessageIdRef = useRef<number | string | null>(null);
  const isOwnRef = useRef(isOwn);

  // Keep isOwn ref updated
  useEffect(() => {
    isOwnRef.current = isOwn;
  }, [isOwn]);

  // Scroll to bottom with smooth animation
  const scrollToBottom = useCallback((smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant',
      });
    }
  }, []);

  // Check if user is near bottom
  const isNearBottom = useCallback(() => {
    if (!containerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;

    if (currentLength === 0) {
      prevMessagesLengthRef.current = currentLength;
      return;
    }

    // Get the last message
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?.id;
    const prevLastMessageId = lastMessageIdRef.current;

    // Check if this is a new message (different from previous last message)
    const isNewMessage = currentLength > prevLength || lastMessageId !== prevLastMessageId;

    if (isNewMessage) {
      // If the new message is from the user (own message), always scroll to bottom
      // Or if user was already near bottom, scroll to bottom
      const isOwnMessage = isOwnRef.current(lastMessage);
      if (isOwnMessage || shouldScrollToBottomRef.current) {
        // Small delay to ensure DOM is updated
        setTimeout(() => scrollToBottom(), 50);
      }
      lastMessageIdRef.current = lastMessageId;
    }

    prevMessagesLengthRef.current = currentLength;
  }, [messages, scrollToBottom]);

  // Handle scroll to load more and track scroll position
  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight } = containerRef.current;

    // Track if user is near bottom
    shouldScrollToBottomRef.current = isNearBottom();

    // Load more when scrolled to top
    if (hasMore && !loading && scrollTop < 50) {
      scrollHeightRef.current = scrollHeight;
      onLoadMore();
    }
  };

  // Restore scroll position after loading more (loading history)
  useEffect(() => {
    if (containerRef.current && scrollHeightRef.current > 0) {
      const newScrollHeight = containerRef.current.scrollHeight;
      containerRef.current.scrollTop = newScrollHeight - scrollHeightRef.current;
      scrollHeightRef.current = 0;
      // Don't auto-scroll to bottom after loading history
      shouldScrollToBottomRef.current = false;
    }
  }, [messages.length]);

  const containerStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    backgroundColor: '#fafafa',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch', // 让子元素占满宽度
  };

  const loadingStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '10px',
    color: '#999',
    fontSize: '14px',
  };

  const emptyStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: '14px',
  };

  if (messages.length === 0 && !loading) {
    return (
      <div style={containerStyle}>
        <div style={emptyStyle}>
          开始对话吧！
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={containerStyle} onScroll={handleScroll}>
      {hasMore && (
        <div style={loadingStyle}>
          {loading ? '加载中...' : '↑ 上拉加载更多'}
        </div>
      )}
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isOwn={isOwn(message)}
        />
      ))}
      {loading && messages.length === 0 && (
        <div style={loadingStyle}>加载中...</div>
      )}
    </div>
  );
}