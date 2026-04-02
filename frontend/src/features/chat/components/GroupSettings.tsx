/**
 * Group Settings Component
 * Panel for managing group settings and permissions
 */
'use client';

import React, { useState } from 'react';
import { useChatStore, useCurrentGroup } from '../store/chatStore';
import { useAuthStore } from '@/shared/auth/authStore';
import * as chatService from '../services/chat.service';
import type { ChatGroupPermission } from '../types';

export function GroupSettings() {
  const { setShowGroupSettings, updateGroup, removeGroup } = useChatStore();
  const currentGroup = useCurrentGroup();
  
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'danger'>('general');
  const [name, setName] = useState(currentGroup?.name || '');
  const [description, setDescription] = useState(currentGroup?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [permissions, setPermissions] = useState<Partial<ChatGroupPermission>>(
    currentGroup?.permissions || {}
  );

  const authUser = useAuthStore((s) => s.user);

  if (!currentGroup) return null;

  const isOwner = currentGroup.myRole ===
   'owner';
  const isAdmin = currentGroup.myRole ===
   'owner' || currentGroup.myRole ===
   'admin';
  // System admin can delete any group; group admin can delete if granted canDeleteGroup permission
  const isSystemAdmin = authUser?.userType ===
   'admin' || authUser?.role?.name ===
   'superadmin';
  const isGroupAdmin = currentGroup.myRole ===
   'admin';
  const groupAdminCanDelete = isGroupAdmin && (currentGroup as any).myCustomPermissions?.canDeleteGroup ===
   true;
  const canDeleteGroup = isSystemAdmin || groupAdminCanDelete;
  // Any member who is not the owner can leave
  const canLeaveGroup = !isOwner;
  // System admin or group admin/owner can manage permissions
  const canManagePermissions = isSystemAdmin || isAdmin;
  // System admin or group admin/owner can edit general settings
  const canEditGeneral = isSystemAdmin || isAdmin;

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      await chatService.updateGroup(currentGroup.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      updateGroup(currentGroup.id, { name: name.trim(), description: description.trim() });
    } catch (error) {
      console.error('Failed to update group:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    try {
      await chatService.updateGroupPermissions(currentGroup.id, permissions);
      updateGroup(currentGroup.id, { permissions: { ...currentGroup.permissions, ...permissions } as ChatGroupPermission });
    } catch (error) {
      console.error('Failed to update permissions:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    setIsSaving(true);
    try {
      await chatService.deleteGroup(currentGroup.id);
      removeGroup(currentGroup.id);
      setShowGroupSettings(false);
    } catch (error) {
      console.error('Failed to delete group:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) {
      return;
    }

    setIsSaving(true);
    try {
      await chatService.leaveGroup(currentGroup.id);
      removeGroup(currentGroup.id);
      setShowGroupSettings(false);
    } catch (error) {
      console.error('Failed to leave group:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const PermissionToggle = ({ 
    label, 
    description, 
    checked, 
    onChange,
    disabled = false 
  }: { 
    label: string; 
    description: string; 
    checked: boolean; 
    onChange: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
          {label}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Group Settings
        </h2>
        <button
          onClick={() => setShowGroupSettings(false)}
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
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab ===
   'general'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          General
        </button>
        {canManagePermissions && (
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab ===
   'permissions'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Permissions
          </button>
        )}
        <button
          onClick={() => setActiveTab('danger')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab ===
   'danger'
              ? 'text-red-600 border-b-2 border-red-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Danger
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab ===
   'general' && (
          <div className="space-y-4">
            {/* Group Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEditGeneral}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 disabled:opacity-50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEditGeneral}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 disabled:opacity-50 resize-none"
                rows={3}
              />
            </div>

            {/* Info */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Created</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {new Date(currentGroup.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Members</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {currentGroup._count?.members || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Encrypted</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {currentGroup.isEncrypted ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Your Role</span>
                <span className="text-gray-900 dark:text-gray-100 capitalize">
                  {currentGroup.myRole || 'Member'}
                </span>
              </div>
            </div>

            {canEditGeneral && (
              <button
                onClick={handleSaveGeneral}
                disabled={isSaving}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        )}

        {activeTab ===
   'permissions' && canManagePermissions && (
          <div className="space-y-1 divide-y divide-gray-200 dark:divide-gray-700">
            <div className="pb-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Messaging</h4>
            </div>
            <PermissionToggle
              label="Admin Only Messaging"
              description="Only admins can send messages"
              checked={permissions.adminOnlyMessaging ?? currentGroup.permissions?.adminOnlyMessaging ?? false}
              onChange={(v) => setPermissions({ ...permissions, adminOnlyMessaging: v })}
            />
            <PermissionToggle
              label="Read Only Mode"
              description="Members can only read messages"
              checked={permissions.readOnlyMode ?? currentGroup.permissions?.readOnlyMode ?? false}
              onChange={(v) => setPermissions({ ...permissions, readOnlyMode: v })}
            />
            <PermissionToggle
              label="Send Messages"
              description="Members can send text messages"
              checked={permissions.canSendMessage ?? currentGroup.permissions?.canSendMessage ?? true}
              onChange={(v) => setPermissions({ ...permissions, canSendMessage: v })}
            />
            <PermissionToggle
              label="Edit Messages"
              description="Members can edit their own messages"
              checked={permissions.canEditMessage ?? currentGroup.permissions?.canEditMessage ?? true}
              onChange={(v) => setPermissions({ ...permissions, canEditMessage: v })}
            />
            <PermissionToggle
              label="Delete Messages"
              description="Members can delete their own messages"
              checked={permissions.canDeleteMessage ?? currentGroup.permissions?.canDeleteMessage ?? false}
              onChange={(v) => setPermissions({ ...permissions, canDeleteMessage: v })}
            />
            <PermissionToggle
              label="Pin Messages"
              description="Members can pin important messages"
              checked={permissions.canPinMessage ?? currentGroup.permissions?.canPinMessage ?? false}
              onChange={(v) => setPermissions({ ...permissions, canPinMessage: v })}
            />

            <div className="pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Media & Files</h4>
            </div>
            <PermissionToggle
              label="Allow File Uploads"
              description="Members can upload files"
              checked={permissions.canUploadFiles ?? currentGroup.permissions?.canUploadFiles ?? true}
              onChange={(v) => setPermissions({ ...permissions, canUploadFiles: v })}
            />
            <PermissionToggle
              label="Allow Voice Messages"
              description="Members can send voice messages"
              checked={permissions.canSendVoice ?? currentGroup.permissions?.canSendVoice ?? true}
              onChange={(v) => setPermissions({ ...permissions, canSendVoice: v })}
            />
            <PermissionToggle
              label="Allow Video Messages"
              description="Members can share videos"
              checked={permissions.canSendVideo ?? currentGroup.permissions?.canSendVideo ?? true}
              onChange={(v) => setPermissions({ ...permissions, canSendVideo: v })}
            />
            <PermissionToggle
              label="Allow Emoji"
              description="Members can use emoji reactions"
              checked={permissions.canSendEmoji ?? currentGroup.permissions?.canSendEmoji ?? true}
              onChange={(v) => setPermissions({ ...permissions, canSendEmoji: v })}
            />

            <div className="pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Group Management</h4>
            </div>
            <PermissionToggle
              label="Allow @all Mentions"
              description="Members can mention everyone"
              checked={permissions.canMentionAll ?? currentGroup.permissions?.canMentionAll ?? false}
              onChange={(v) => setPermissions({ ...permissions, canMentionAll: v })}
            />
            <PermissionToggle
              label="Add Members"
              description="Members can add new members"
              checked={permissions.canAddMembers ?? currentGroup.permissions?.canAddMembers ?? false}
              onChange={(v) => setPermissions({ ...permissions, canAddMembers: v })}
            />
            <PermissionToggle
              label="Remove Members"
              description="Members can remove other members"
              checked={permissions.canRemoveMembers ?? currentGroup.permissions?.canRemoveMembers ?? false}
              onChange={(v) => setPermissions({ ...permissions, canRemoveMembers: v })}
            />
            <PermissionToggle
              label="Allow Member Search"
              description="Members can search other members"
              checked={permissions.searchMembers ?? currentGroup.permissions?.searchMembers ?? true}
              onChange={(v) => setPermissions({ ...permissions, searchMembers: v })}
            />
            <PermissionToggle
              label="Allow Private DMs"
              description="Members can DM each other"
              checked={permissions.privateDMAllowed ?? currentGroup.permissions?.privateDMAllowed ?? true}
              onChange={(v) => setPermissions({ ...permissions, privateDMAllowed: v })}
            />

            <div className="pt-4">
              <button
                onClick={handleSavePermissions}
                disabled={isSaving}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isSaving ? 'Saving Permissions...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        )}

        {activeTab ===
   'danger' && (
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                These actions cannot be undone. Please be careful.
              </p>
            </div>

            {/* Leave Group - available to all non-owner members */}
            {canLeaveGroup && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Leave Group</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  You will no longer receive messages from this group.
                </p>
                <button
                  onClick={handleLeaveGroup}
                  disabled={isSaving}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {isSaving ? 'Leaving...' : 'Leave Group'}
                </button>
              </div>
            )}

            {/* Delete Group - only system admin or group admin with canDeleteGroup permission */}
            {canDeleteGroup && (
              <div>
                <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Delete Group</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  This will permanently deactivate the group and all its messages.
                  {isSystemAdmin && !isGroupAdmin && ' (System Admin privilege)'}
                </p>
                <button
                  onClick={handleDeleteGroup}
                  disabled={isSaving}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {isSaving ? 'Deleting...' : 'Delete Group'}
                </button>
              </div>
            )}

            {/* If owner, show info that they can't leave */}
            {isOwner && !canDeleteGroup && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                As the group owner, you cannot leave. Transfer ownership first or contact a system admin to delete the group.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
