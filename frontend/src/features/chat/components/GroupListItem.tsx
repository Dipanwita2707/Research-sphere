/**
 * Group List Item Component
 * Individual group item in the list
 */
'use client';

import React from 'react';
import { useChatStore } from '../store/chatStore';
import * as chatService from '../services/chat.service';
import type { ChatGroup } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface GroupListItemProps {
  group: ChatGroup;
  isActive: boolean;
}

export function GroupListItem({ group, isActive }: GroupListItemProps) {
  const { setCurrentGroup } = useChatStore();

  const handleClick = async () => {
    // Set group immediately for responsiveness
    setCurrentGroup(group.id, group);
    // Always fetch full group data (members, permissions, etc.)
    try {
      const fullGroup = await chatService.getGroup(group.id);
      setCurrentGroup(fullGroup.id, fullGroup as ChatGroup);
    } catch (err) {
      console.error('Failed to fetch group details:', err);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getLastMessagePreview = () => {
    if (!group.lastMessage) return 'No messages yet';
    
    const message = group.lastMessage;
    if (message.messageType === 'text') {
      return message.content?.slice(0, 50) + (message.content && message.content.length > 50 ? '...' : '');
    }
    if (message.messageType === 'image') return '📷 Photo';
    if (message.messageType === 'voice') return '🎤 Voice message';
    if (message.messageType === 'video') return '🎬 Video';
    if (message.messageType === 'file' || message.messageType === 'document') return '📎 File';
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
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {group.avatar ? (
          <img
            src={group.avatar}
            alt={group.name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
            {getInitials(group.name)}
          </div>
        )}
        
        {/* Online indicator */}
        {group.onlineMemberCount && group.onlineMemberCount > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">{group.onlineMemberCount}</span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <h4 className={`font-medium text-sm truncate ${
            isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
          }`}>
            {group.name}
          </h4>
          {group.lastMessage && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {formatDistanceToNow(new Date(group.lastMessage.createdAt), { addSuffix: false })}
            </span>
          )}
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {getLastMessagePreview()}
        </p>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {group._count?.members || 0} members
          </span>
          {group.isEncrypted && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Encrypted
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
