/**
 * Conversation Item Component
 * Individual conversation in the list
 */
'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useChatStore, useIsOnline } from '../store/chatStore';
import { getProfileImageUrl } from '../services/chat.service';
import type { Conversation } from '../types';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
}

export function ConversationItem({ conversation, isActive }: ConversationItemProps) {
  const { setCurrentDMUser } = useChatStore();
  const isOnline = useIsOnline(conversation.user.id);
  
  const user = conversation.user;

  const handleClick = () => {
    setCurrentDMUser(user.id);
  };

  const getUserName = () => {
    if (user.employeeDetails) {
      return user.employeeDetails.displayName || 
        `${user.employeeDetails.firstName || ''} ${user.employeeDetails.lastName || ''}`.trim();
    }
    if (user.studentLogin) {
      return `${user.studentLogin.firstName || ''} ${user.studentLogin.lastName || ''}`.trim();
    }
    return user.uid || 'Unknown';
  };

  const getInitials = () => {
    const name = getUserName();
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getLastMessagePreview = () => {
    if (!conversation.lastMessage) return 'No messages yet';
    
    const message = conversation.lastMessage;
    const prefix = message.senderId === user.id ? '' : 'You: ';
    
    if (message.messageType === 'text') {
      const content = message.content?.slice(0, 40) + (message.content && message.content.length > 40 ? '...' : '');
      return prefix + content;
    }
    if (message.messageType === 'image') return prefix + '📷 Photo';
    if (message.messageType === 'voice') return prefix + '🎤 Voice message';
    if (message.messageType === 'video') return prefix + '🎬 Video';
    if (message.messageType === 'file' || message.messageType === 'document') return prefix + '📎 File';
    return 'Message';
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-3 py-2 transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/30'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
      }`}
    >
      {/* Avatar with online indicator */}
      <div className="relative flex-shrink-0">
        {user.profileImage ? (
          <img
            src={getProfileImageUrl(user.profileImage) || user.profileImage}
            alt={getUserName()}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
            {getInitials()}
          </div>
        )}
        
        {/* Online indicator */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <h4 className={`font-medium text-sm truncate ${
            isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
          }`}>
            {getUserName()}
          </h4>
          {conversation.lastMessage && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: false })}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {getLastMessagePreview()}
          </p>
          
          {/* Unread badge */}
          {conversation.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
