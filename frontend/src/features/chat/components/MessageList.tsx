/**
 * Message List Component
 * Displays messages in a chat
 */
'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useChatStore, useMessages, useDirectMessages, useTypingUsers, useDMTyping } from '../store/chatStore';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';
import * as chatService from '../services/chat.service';
import type { ChatMessage, DirectMessage } from '../types';

export function MessageList() {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  
  const {
    currentGroupId,
    currentDMUserId,
    currentGroup,
    hasMoreMessages,
    messageCursors,
    hasMoreDMs,
    dmCursors,
    setMessages,
    prependMessages,
    setDirectMessages,
    prependDirectMessages,
    setCurrentDMUser,
  } = useChatStore();

  const groupMessages = useMessages(currentGroupId || '');
  const dmMessages = useDirectMessages(currentDMUserId || '');
  const typingUsers = useTypingUsers(currentGroupId || '');
  const dmTyping = useDMTyping(currentDMUserId || '');

  const messages = currentGroupId ? groupMessages : dmMessages;
  const hasMore = currentGroupId 
    ? hasMoreMessages[currentGroupId] 
    : hasMoreDMs[currentDMUserId || ''];
  const cursor = currentGroupId 
    ? messageCursors[currentGroupId] 
    : dmCursors[currentDMUserId || ''];

  // Load initial messages
  useEffect(() => {
    let cancelled = false;
    const loadMessages = async () => {
      if (!currentGroupId && !currentDMUserId) {
        setIsLoadingInitial(false);
        return;
      }
      
      setIsLoadingInitial(true);
      try {
        if (currentGroupId) {
          const response = await chatService.getGroupMessages(currentGroupId);
          if (!cancelled) {
            // Backend already returns messages in chronological order (oldest first)
            setMessages(currentGroupId, response.messages, response.hasMore, response.nextCursor);
          }
        } else if (currentDMUserId) {
          const response = await chatService.getDirectMessages(currentDMUserId);
          if (!cancelled) {
            // Backend already returns messages in chronological order (oldest first)
            setDirectMessages(currentDMUserId, response.messages, response.hasMore, response.nextCursor);
            // Store the other user's info for DM header
            if (response.otherUser) {
              setCurrentDMUser(currentDMUserId, response.otherUser);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingInitial(false);
        }
      }
    };

    loadMessages();
    return () => { cancelled = true; };
  }, [currentGroupId, currentDMUserId, setMessages, setDirectMessages, setCurrentDMUser]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current && messages.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Load more messages (infinite scroll)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !cursor) return;

    setIsLoadingMore(true);
    try {
      if (currentGroupId) {
        const response = await chatService.getGroupMessages(currentGroupId, { cursor });
        prependMessages(currentGroupId, response.messages, response.hasMore, response.nextCursor);
      } else if (currentDMUserId) {
        const response = await chatService.getDirectMessages(currentDMUserId, { cursor });
        prependDirectMessages(currentDMUserId, response.messages, response.hasMore, response.nextCursor);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentGroupId, currentDMUserId, hasMore, cursor, isLoadingMore, prependMessages, prependDirectMessages]);

  // Intersection observer for load more
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, isLoadingMore, loadMore]);

  // Group messages by date
  const groupMessagesByDate = (msgs: (ChatMessage | DirectMessage)[]) => {
    const groups: { date: string; messages: (ChatMessage | DirectMessage)[] }[] = [];
    let currentDate = '';

    msgs.forEach((message) => {
      // Use toDateString() instead of toLocaleDateString() for consistent date comparison
      const messageDate = new Date(message.createdAt).toDateString();
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  if (isLoadingInitial && messages.length ===
   0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-transparent"
    >
      {/* Load More Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-2 flex justify-center">
          {isLoadingMore && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          )}
        </div>
      )}

      {/* Messages grouped by date */}
      {messageGroups.map((dateGroup, groupIndex) => (
        <div key={`${dateGroup.date}-${groupIndex}`}>
          {/* Date Divider */}
          <div className="flex items-center justify-center my-4">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl border-2 border-white/80 dark:border-gray-700/80 shadow-[5px_5px_10px_rgba(0,0,0,0.05),-5px_-5px_10px_rgba(255,255,255,0.8)] dark:shadow-[5px_5px_10px_rgba(0,0,0,0.4),-5px_-5px_10px_rgba(255,255,255,0.05)] text-gray-600 dark:text-gray-300 text-xs font-bold px-4 py-1.5 rounded-full">
              {formatDateDivider(dateGroup.date)}
            </div>
          </div>

          {/* Messages */}
          {dateGroup.messages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              isGroupChat={!!currentGroupId}
              showAvatar={shouldShowAvatar(dateGroup.messages, index)}
              group={currentGroup || undefined}
            />
          ))}
        </div>
      ))}

      {/* Empty State */}
      {messages.length ===
   0 && !isLoadingInitial && (
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Be the first to send a message!</p>
          </div>
        </div>
      )}

      {/* Typing Indicator */}
      {currentGroupId && typingUsers.length > 0 && (
        <TypingIndicator users={typingUsers} />
      )}
      {currentDMUserId && dmTyping && (
        <TypingIndicator users={[dmTyping]} />
      )}
    </div>
  );
}

// Helper to format date divider
function formatDateDivider(dateString: string): string {
  // dateString is now in toDateString() format (e.g., "Tue Feb 11 2026")
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Compare using toDateString() for consistency
  if (date.toDateString() ===
   today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() ===
   yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
}

// Helper to determine if avatar should be shown
function shouldShowAvatar(messages: (ChatMessage | DirectMessage)[], index: number): boolean {
  if (index ===
   0) return true;
  const current = messages[index];
  const previous = messages[index - 1];
  return current.senderId !== previous.senderId;
}
