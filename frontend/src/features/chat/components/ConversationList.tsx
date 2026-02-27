/**
 * Conversation List Component
 * List of direct message conversations
 */
'use client';

import React, { useState } from 'react';
import { useChatStore, useConversations } from '../store/chatStore';
import { ConversationItem } from './ConversationItem';
import * as chatService from '../services/chat.service';
import type { ChatUser } from '../types';

export function ConversationList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const conversations = useConversations();
  const { currentDMUserId, isLoading, setCurrentDMUser } = useChatStore();

  // Handle search for new conversation
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

  // Start new conversation
  const startConversation = (user: ChatUser) => {
    setCurrentDMUser(user.id);
    setSearchQuery('');
    setSearchResults([]);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
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
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
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
            placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.trim().length >= 2 && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          {isSearching ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="py-2">
              <p className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
                Search Results
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user.role}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No users found
            </p>
          )}
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Search for a user to start chatting</p>
          </div>
        ) : (
          <div className="py-2">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.user.id}
                conversation={conversation}
                isActive={currentDMUserId === conversation.user.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
