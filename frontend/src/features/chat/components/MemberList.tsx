/**
 * Member List Component
 * Displays group members in sidebar
 */
'use client';

import React, { useState } from 'react';
import { useChatStore, useCurrentGroup } from '../store/chatStore';
import { useAuthStore } from '@/shared/auth/authStore';
import { MemberListItem } from './MemberListItem';
import { AddMemberModal } from './AddMemberModal';
import { MemberPermissionsModal } from './MemberPermissionsModal';
import type { ChatGroupMember } from '../types';
import * as chatService from '../services/chat.service';

export function MemberList() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<ChatGroupMember | null>(null);
  
  const currentGroup = useCurrentGroup();
  const { onlineUsers } = useChatStore();
  const authUser = useAuthStore((s) => s.user);
  const isSystemAdmin = authUser?.userType === 'admin' || authUser?.role?.name === 'superadmin';

  if (!currentGroup) return null;

  const members = currentGroup.members || [];
  const myRole = currentGroup.myRole;
  const canAddMembers = isSystemAdmin || myRole === 'owner' || myRole === 'admin' || currentGroup.myPermissions?.canAddMembers;

  // Filter members by search
  const filteredMembers = members.filter((member) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const user = member.user;
    if (!user) return false;

    const name = user.employeeDetails?.displayName || 
      `${user.employeeDetails?.firstName || ''} ${user.employeeDetails?.lastName || ''}`.trim() ||
      `${user.studentLogin?.firstName || ''} ${user.studentLogin?.lastName || ''}`.trim() ||
      user.uid || '';
    
    return name.toLowerCase().includes(query);
  });

  // Sort members: online first, then by role
  const sortedMembers = [...filteredMembers].sort((a, b) => {
    const aOnline = onlineUsers.has(a.userId);
    const bOnline = onlineUsers.has(b.userId);
    
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    
    const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3 };
    return (roleOrder[a.memberRole] || 4) - (roleOrder[b.memberRole] || 4);
  });

  const onlineCount = members.filter(m => onlineUsers.has(m.userId)).length;

  return (
    <div className="w-64 flex-shrink-0 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Members ({members.length})
          </h3>
          {canAddMembers && (
            <button
              onClick={() => setShowAddMember(true)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title="Add member"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
          )}
        </div>

        {/* Online count */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {onlineCount} online
        </p>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Member List */}
      <div className="flex-1 overflow-y-auto">
        {sortedMembers.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No members found
          </p>
        ) : (
          <div className="py-2">
            {sortedMembers.map((member) => (
              <MemberListItem
                key={member.id}
                member={member}
                groupId={currentGroup.id}
                myRole={myRole}
                onManagePermissions={(m) => setSelectedMember(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          groupId={currentGroup.id}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Member Permissions Modal */}
      {selectedMember && (
        <MemberPermissionsModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
