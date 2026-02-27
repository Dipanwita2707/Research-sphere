/**
 * Group List Component
 * Displays list of chat groups
 */
'use client';

import React from 'react';
import { useChatStore, useGroups } from '../store/chatStore';
import { GroupListItem } from './GroupListItem';

interface GroupListProps {
  onCreateGroup: () => void;
}

export function GroupList({ onCreateGroup }: GroupListProps) {
  const groups = useGroups();
  const { isLoading, currentGroupId } = useChatStore();

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
      {/* Create Group Button */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onCreateGroup}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Group
        </button>
      </div>

      {/* Group List */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No groups yet</p>
            <p className="text-xs mt-1">Create a group to start chatting</p>
          </div>
        ) : (
          <div className="py-2">
            {groups.map((group) => (
              <GroupListItem
                key={group.id}
                group={group}
                isActive={currentGroupId === group.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
