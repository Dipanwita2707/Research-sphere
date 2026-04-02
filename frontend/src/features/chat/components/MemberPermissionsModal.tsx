/**
 * Member Permissions Modal Component
 * Modal for managing individual member permissions in a group
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useChatStore, useCurrentGroup } from '../store/chatStore';
import { useAuthStore } from '@/shared/auth/authStore';
import * as chatService from '../services/chat.service';
import type { ChatGroupMember, GroupPermissions, MemberRole } from '../types';

interface MemberPermissionsModalProps {
  member: ChatGroupMember;
  onClose: () => void;
}

const roleLabels: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  moderator: 'Moderator',
  member: 'Member',
};

const roleColors: Record<MemberRole, string> = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  moderator: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  member: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

// Default member permissions (group-level only)
const defaultMemberPermissions: Partial<GroupPermissions> = {
  canSendMessage: true,
  canUploadFiles: true,
  canSendVoice: true,
  canSendVideo: true,
  canSendEmoji: true,
  canEditMessage: true,
  canDeleteMessage: false,
  canMentionAll: false,
  canPinMessage: false,
  canAddMembers: false,
  canRemoveMembers: false,
  canDeleteGroup: false,
};

export function MemberPermissionsModal({ member, onClose }: MemberPermissionsModalProps) {
  const currentGroup = useCurrentGroup();
  const { updateGroupMember } = useChatStore();
  const authUser = useAuthStore((s) => s.user);
  
  const [activeTab, setActiveTab] = useState<'role' | 'permissions'>('role');
  const [selectedRole, setSelectedRole] = useState<MemberRole>(member.memberRole);
  const [customPermissions, setCustomPermissions] = useState<Partial<GroupPermissions>>(
    member.customPermissions || {}
  );
  const [useCustomPermissions, setUseCustomPermissions] = useState(
    Object.keys(member.customPermissions || {}).length > 0
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentGroup?.myRole ===
   'owner';
  const isAdmin = currentGroup?.myRole ===
   'owner' || currentGroup?.myRole ===
   'admin';
  const isSystemAdmin = authUser?.userType ===
   'admin' || authUser?.role?.name ===
   'superadmin';
  const isEditingSelf = member.userId ===
   currentGroup?.createdById;

  // Get display name
  const getMemberName = () => {
    const user = member.user;
    if (user?.employeeDetails?.firstName) {
      return `${user.employeeDetails.firstName} ${user.employeeDetails.lastName || ''}`.trim();
    }
    if (user?.studentLogin?.firstName) {
      return `${user.studentLogin.firstName} ${user.studentLogin.lastName || ''}`.trim();
    }
    return user?.email || 'Unknown User';
  };

  // Toggle custom permission
  const togglePermission = (key: keyof GroupPermissions) => {
    setCustomPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Save changes
  const handleSave = async () => {
    if (!currentGroup) return;

    setIsSaving(true);
    setError(null);

    try {
      await chatService.updateMemberRole(currentGroup.id, member.userId, selectedRole);
      
      if (useCustomPermissions) {
        await chatService.updateMemberPermissions(currentGroup.id, member.userId, customPermissions);
      } else {
        // Clear custom permissions if disabled
        await chatService.updateMemberPermissions(currentGroup.id, member.userId, {});
      }

      updateGroupMember(currentGroup.id, member.userId, {
        memberRole: selectedRole,
        customPermissions: useCustomPermissions ? customPermissions : undefined,
      });

      onClose();
    } catch (err: any) {
      console.error('Failed to update member:', err);
      setError(err.response?.data?.message || 'Failed to update member');
    } finally {
      setIsSaving(false);
    }
  };

  const permissionGroups = [
    {
      title: 'Messaging',
      permissions: [
        { key: 'canSendMessage' as const, label: 'Send Messages', description: 'Can send text messages' },
        { key: 'canEditMessage' as const, label: 'Edit Messages', description: 'Can edit own messages' },
        { key: 'canDeleteMessage' as const, label: 'Delete Messages', description: 'Can delete own messages' },
        { key: 'canPinMessage' as const, label: 'Pin Messages', description: 'Can pin important messages' },
      ],
    },
    {
      title: 'Media & Files',
      permissions: [
        { key: 'canUploadFiles' as const, label: 'Upload Files', description: 'Can share files and documents' },
        { key: 'canSendVoice' as const, label: 'Voice Messages', description: 'Can send voice recordings' },
        { key: 'canSendVideo' as const, label: 'Video Messages', description: 'Can share videos' },
        { key: 'canSendEmoji' as const, label: 'Use Emoji', description: 'Can use emoji reactions' },
      ],
    },
    {
      title: 'Group Management',
      permissions: [
        { key: 'canAddMembers' as const, label: 'Add Members', description: 'Can add new members' },
        { key: 'canRemoveMembers' as const, label: 'Remove Members', description: 'Can remove other members' },
        { key: 'canMentionAll' as const, label: 'Mention All', description: 'Can use @all mention' },
      ],
    },
    // Only show admin permissions section for admin-role members when system admin is editing
    ...(isSystemAdmin && selectedRole ===
   'admin' ? [{
      title: 'Admin Privileges',
      permissions: [
        { key: 'canDeleteGroup' as const, label: 'Delete Group', description: 'Can delete/deactivate this group' },
      ],
    }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {getMemberName().charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {getMemberName()}
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[member.memberRole]}`}>
                {roleLabels[member.memberRole]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('role')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab ===
   'role'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Role
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab ===
   'permissions'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Custom Permissions
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Role Tab */}
          {activeTab ===
   'role' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select a role for this member. Higher roles have more permissions by default.
              </p>

              {(['member', 'moderator', 'admin'] as MemberRole[]).map((role) => {
                const isDisabled = 
                  (role ===
   'admin' && !isOwner && !isSystemAdmin) ||
                  isEditingSelf ||
                  member.memberRole ===
   'owner';

                return (
                  <button
                    key={role}
                    onClick={() => !isDisabled && setSelectedRole(role)}
                    disabled={isDisabled}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      selectedRole ===
   role
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                          {roleLabels[role]}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {role ===
   'admin' && 'Full access to manage group settings and members'}
                          {role ===
   'moderator' && 'Can moderate messages and manage basic settings'}
                          {role ===
   'member' && 'Standard member with default permissions'}
                        </p>
                      </div>
                      {selectedRole ===
   role && (
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}

              {member.memberRole ===
   'owner' && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-purple-700 dark:text-purple-400">
                    This member is the group owner. Owner role cannot be changed.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab ===
   'permissions' && (
            <div className="space-y-4">
              {/* Enable Custom Permissions Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Use Custom Permissions
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Override role-based permissions for this member
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUseCustomPermissions(!useCustomPermissions)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useCustomPermissions ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useCustomPermissions ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {useCustomPermissions ? (
                <div className="space-y-6">
                  {permissionGroups.map((group) => (
                    <div key={group.title}>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        {group.title}
                      </h3>
                      <div className="space-y-2">
                        {group.permissions.map((perm) => (
                          <div
                            key={perm.key}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {perm.label}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {perm.description}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePermission(perm.key)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                customPermissions[perm.key] ?? defaultMemberPermissions[perm.key]
                                  ? 'bg-blue-600'
                                  : 'bg-gray-300 dark:bg-gray-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  customPermissions[perm.key] ?? defaultMemberPermissions[perm.key]
                                    ? 'translate-x-6'
                                    : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This member uses role-based permissions. Enable custom permissions above to override specific settings.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || member.memberRole ===
   'owner'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
