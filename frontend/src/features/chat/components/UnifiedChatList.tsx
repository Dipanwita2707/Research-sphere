/**
 * Unified Chat List Component
 * WhatsApp-style single list combining groups and DMs, sorted by last activity
 */
'use client';

import React, { useState, useMemo } from 'react';
import { useChatStore, useGroups, useConversations } from '../store/chatStore';
import { GroupListItem } from './GroupListItem';
import { ConversationItem } from './ConversationItem';
import * as chatService from '../services/chat.service';
import type { ChatUser, ChatGroup, Conversation } from '../types';

export function UnifiedChatList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const groups = useGroups();
  const conversations = useConversations();
  const { currentGroupId, currentDMUserId, isLoading, setCurrentDMUser } = useChatStore();

  // Search for new DM users
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await chatService.searchUsersForDM(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const startConversation = (user: ChatUser) => {
    setCurrentDMUser(user.id);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Build a unified list sorted by last message time
  type UnifiedItem =
    | { type: 'group'; data: ChatGroup; timestamp: number }
    | { type: 'dm'; data: Conversation; timestamp: number };

  const unifiedList = useMemo(() => {
    const items: UnifiedItem[] = [];

    groups.forEach((group) => {
      const ts = group.lastMessage
        ? new Date(group.lastMessage.createdAt).getTime()
        : new Date(group.createdAt || 0).getTime();
      items.push({ type: 'group', data: group, timestamp: ts });
    });

    conversations.forEach((conv) => {
      const ts = conv.lastMessage
        ? new Date(conv.lastMessage.createdAt).getTime()
        : 0;
      items.push({ type: 'dm', data: conv, timestamp: ts });
    });

    // Sort newest first
    items.sort((a, b) => b.timestamp - a.timestamp);

    // Filter by search query (only filter when searching local items, not DM user search)
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      return items.filter((item) => {
        if (item.type ===
   'group') {
          return item.data.name.toLowerCase().includes(q);
        }
        const u = item.data.user;
        const name =
          u.employeeDetails?.displayName ||
          `${u.employeeDetails?.firstName || ''} ${u.employeeDetails?.lastName || ''}`.trim() ||
          `${u.studentLogin?.firstName || ''} ${u.studentLogin?.lastName || ''}`.trim() ||
          u.uid || '';
        return name.toLowerCase().includes(q);
      });
    }

    return items;
  }, [groups, conversations, searchQuery]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* DM User Search Results (new conversation) */}
      {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <p className="px-4 py-1 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Start new chat
          </p>
          {searchResults.map((user) => (
            <button
              key={user.id}
              onClick={() => startConversation(user)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                {(user.employeeDetails?.firstName?.[0] || user.studentLogin?.firstName?.[0] || 'U').toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user.employeeDetails?.displayName ||
                    `${user.employeeDetails?.firstName || ''} ${user.employeeDetails?.lastName || ''}`.trim() ||
                    `${user.studentLogin?.firstName || ''} ${user.studentLogin?.lastName || ''}`.trim() ||
                    user.uid}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Unified Chat List */}
      <div className="flex-1 overflow-y-auto">
        {unifiedList.length ===
   0 && !isSearching ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No chats yet</p>
            <p className="text-xs mt-1">Search for a user or create a group to start chatting</p>
          </div>
        ) : (
          <div>
            {unifiedList.map((item) =>
              item.type ===
   'group' ? (
                <GroupListItem
                  key={`group-${item.data.id}`}
                  group={item.data}
                  isActive={currentGroupId ===
   item.data.id}
                />
              ) : (
                <ConversationItem
                  key={`dm-${item.data.user.id}`}
                  conversation={item.data}
                  isActive={currentDMUserId ===
   item.data.user.id}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
