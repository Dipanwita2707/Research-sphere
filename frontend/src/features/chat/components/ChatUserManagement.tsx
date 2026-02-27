/**
 * Chat User Management Component
 * Admin panel for managing which users can access the chat system
 * and configuring individual user-level permissions
 * 
 * Features:
 * - View all authorized chat users
 * - Add users manually by UID or bulk CSV upload
 * - Configure individual permissions (DM, group creation, profile, privacy, etc.)
 * - Enable/disable chat access per user
 * - Remove users from chat system
 */
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as chatService from '../services/chat.service';
import type { ChatUserPermission, ChatUser, ChatPermissionStats, BulkUserPermissionResult } from '../types';

// Default user permissions for adding new users
const DEFAULT_USER_PERMISSIONS = {
  chatEnabled: true,
  canPrivateMessage: true,
  canCreateGroup: true,
  canUploadProfilePhoto: true,
  canSetLastSeen: true,
  canSetOnlineStatus: true,
  canSetProfilePrivacy: true,
  canSetAboutPrivacy: true,
  canSetStatusPrivacy: true,
  canSetReadReceipts: true,
  canSetMessageTimer: true,
  canSetGroupsPrivacy: true,
  canBlockContacts: true,
  canChangeTheme: true,
  canChangeWallpaper: true,
  canToggleNotifications: true,
};

type PermissionKey = keyof typeof DEFAULT_USER_PERMISSIONS;

// Permission groups for the UI
const userPermissionGroups = [
  {
    title: 'Chat Access',
    permissions: [
      { key: 'chatEnabled' as PermissionKey, label: 'Chat Enabled', description: 'User can access the chat application' },
    ],
  },
  {
    title: 'Messaging',
    permissions: [
      { key: 'canPrivateMessage' as PermissionKey, label: 'Private Messages', description: 'User can send direct/private messages' },
    ],
  },
  {
    title: 'Group Management',
    permissions: [
      { key: 'canCreateGroup' as PermissionKey, label: 'Create Groups', description: 'User can create new chat groups' },
    ],
  },
  {
    title: 'Profile & Media',
    permissions: [
      { key: 'canUploadProfilePhoto' as PermissionKey, label: 'Upload Profile Photo', description: 'User can upload/change profile photo' },
    ],
  },
  {
    title: 'Privacy Settings',
    permissions: [
      { key: 'canSetLastSeen' as PermissionKey, label: 'Last Seen', description: 'User can control last seen visibility' },
      { key: 'canSetOnlineStatus' as PermissionKey, label: 'Online Status', description: 'User can control online status visibility' },
      { key: 'canSetProfilePrivacy' as PermissionKey, label: 'Profile Privacy', description: 'User can set profile picture privacy' },
      { key: 'canSetAboutPrivacy' as PermissionKey, label: 'About Privacy', description: 'User can set about info privacy' },
      { key: 'canSetStatusPrivacy' as PermissionKey, label: 'Status Privacy', description: 'User can set status privacy' },
      { key: 'canSetReadReceipts' as PermissionKey, label: 'Read Receipts', description: 'User can toggle read receipts' },
      { key: 'canSetMessageTimer' as PermissionKey, label: 'Message Timer', description: 'User can set disappearing messages' },
      { key: 'canSetGroupsPrivacy' as PermissionKey, label: 'Groups Privacy', description: 'User can control who adds them to groups' },
      { key: 'canBlockContacts' as PermissionKey, label: 'Block Contacts', description: 'User can block other users' },
    ],
  },
  {
    title: 'Customization',
    permissions: [
      { key: 'canChangeTheme' as PermissionKey, label: 'Change Theme', description: 'User can customize chat theme' },
      { key: 'canChangeWallpaper' as PermissionKey, label: 'Change Wallpaper', description: 'User can set custom wallpaper' },
    ],
  },
  {
    title: 'Notifications',
    permissions: [
      { key: 'canToggleNotifications' as PermissionKey, label: 'Toggle Notifications', description: 'User can control notification settings' },
    ],
  },
];

// Helper to get user display name
const getUserName = (user?: ChatUser) => {
  if (!user) return 'Unknown User';
  if (user.employeeDetails?.firstName) {
    return `${user.employeeDetails.firstName} ${user.employeeDetails.lastName || ''}`.trim();
  }
  if (user.studentLogin?.firstName) {
    return `${user.studentLogin.firstName} ${user.studentLogin.lastName || ''}`.trim();
  }
  return user.email || user.uid || 'Unknown';
};

interface ChatUserManagementProps {
  onClose?: () => void;
}

export function ChatUserManagement({ onClose }: ChatUserManagementProps) {
  const [users, setUsers] = useState<ChatUserPermission[]>([]);
  const [stats, setStats] = useState<ChatPermissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add user modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'bulk'>('manual');
  const [manualUid, setManualUid] = useState('');
  const [bulkUids, setBulkUids] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [addPermissions, setAddPermissions] = useState<Record<string, boolean>>({ ...DEFAULT_USER_PERMISSIONS });
  const [isAdding, setIsAdding] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkUserPermissionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit user modal
  const [editUser, setEditUser] = useState<ChatUserPermission | null>(null);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Search unadded users
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load data
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        chatService.getAuthorizedUsers({ page, limit: 20, search }),
        chatService.getChatPermissionStats(),
      ]);
      setUsers(usersRes.users);
      setTotalPages(usersRes.pagination?.totalPages || 1);
      setStats(statsRes);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Search unadded users
  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await chatService.searchUnaddedUsers(query, 10);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Add single user
  const handleAddUser = async (uid?: string) => {
    const targetUid = uid || manualUid.trim();
    if (!targetUid) return;

    setIsAdding(true);
    setError(null);
    try {
      await chatService.addChatUser({
        uid: targetUid,
        permissions: addPermissions,
      });
      setSuccess(`User ${targetUid} added successfully`);
      setManualUid('');
      setSearchQuery('');
      setSearchResults([]);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add user');
    } finally {
      setIsAdding(false);
    }
  };

  // Bulk add
  const handleBulkAdd = async () => {
    if (bulkUids.length === 0 && !csvFile) return;

    setIsAdding(true);
    setError(null);
    setBulkResult(null);

    try {
      let result: BulkUserPermissionResult;

      if (csvFile) {
        const formData = new FormData();
        formData.append('file', csvFile);
        result = await chatService.bulkAddChatUsers(formData);
      } else {
        result = await chatService.bulkAddChatUsers({
          identifiers: bulkUids,
          permissions: addPermissions,
        });
      }

      setBulkResult(result);
      setSuccess(`Added ${result.success.length} users`);
      setBulkUids([]);
      setCsvFile(null);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to bulk add users');
    } finally {
      setIsAdding(false);
    }
  };

  // CSV handling
  const handleCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvParsing(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const uids: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (i === 0 && /uid|username|user|email|employee|student/i.test(lines[i])) continue;
        const uid = lines[i].split(',')[0].trim().replace(/"/g, '');
        if (uid) uids.push(uid);
      }
      setBulkUids(uids);
      setSuccess(`Found ${uids.length} UIDs in CSV`);
    } catch {
      setError('Failed to parse CSV');
    } finally {
      setCsvParsing(false);
    }
  };

  // Toggle user access 
  const handleToggleAccess = async (userId: string, enabled: boolean) => {
    try {
      await chatService.toggleChatUser(userId, enabled);
      setUsers(prev => prev.map(u => 
        u.userId === userId ? { ...u, chatEnabled: enabled } : u
      ));
      setSuccess(`Chat ${enabled ? 'enabled' : 'disabled'} for user`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle access');
    }
  };

  // Update user permissions
  const handleSavePermissions = async () => {
    if (!editUser) return;
    setIsSaving(true);
    setError(null);
    try {
      await chatService.updateChatUserPermissions(editUser.userId, editPermissions);
      setSuccess('Permissions updated');
      setEditUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update permissions');
    } finally {
      setIsSaving(false);
    }
  };

  // Remove user
  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Remove this user from chat system? They will lose access to chat.')) return;
    try {
      await chatService.removeChatUser(userId);
      setSuccess('User removed');
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove user');
    }
  };

  // Download sample CSV
  const downloadSampleCsv = () => {
    const content = 'uid\nEMP001\nEMP002\nSTD12345\nFAC001';
    const blob = new Blob([content], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chat_users_sample.csv';
    a.click();
  };

  // Auto-clear messages
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(t);
    }
  }, [error]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto">
      <div className="bg-gray-50 dark:bg-gray-900 w-full max-w-5xl rounded-lg shadow-2xl my-8 mx-4">
        <div className="p-6 space-y-6">
      {/* Header + Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Chat User Management</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage which users can access the chat application and their individual permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={() => { setShowAddModal(true); setBulkResult(null); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Users
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Active (Chat Enabled)</p>
            <p className="text-2xl font-bold text-green-600">{stats.enabled}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Disabled</p>
            <p className="text-2xl font-bold text-red-600">{stats.disabled}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg border border-green-200 dark:border-green-800">
          {success}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, UID, or email..."
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* User Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">UID</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Chat Access</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">DM</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Groups</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Profile</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {search ? 'No users found matching your search' : 'No users added yet. Click "Add Users" to get started.'}
                  </td>
                </tr>
              ) : (
                users.map((userPerm) => (
                  <tr key={userPerm.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                          {getUserName(userPerm.user).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{getUserName(userPerm.user)}</p>
                          <p className="text-xs text-gray-500">{userPerm.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      {userPerm.user?.uid}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleAccess(userPerm.userId, !userPerm.chatEnabled)}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          userPerm.chatEnabled
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {userPerm.chatEnabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusDot enabled={userPerm.canPrivateMessage} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusDot enabled={userPerm.canCreateGroup} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusDot enabled={userPerm.canUploadProfilePhoto} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditUser(userPerm);
                            setEditPermissions({
                              chatEnabled: userPerm.chatEnabled,
                              canPrivateMessage: userPerm.canPrivateMessage,
                              canCreateGroup: userPerm.canCreateGroup,
                              canUploadProfilePhoto: userPerm.canUploadProfilePhoto,
                              canSetLastSeen: userPerm.canSetLastSeen,
                              canSetOnlineStatus: userPerm.canSetOnlineStatus,
                              canSetProfilePrivacy: userPerm.canSetProfilePrivacy,
                              canSetAboutPrivacy: userPerm.canSetAboutPrivacy,
                              canSetStatusPrivacy: userPerm.canSetStatusPrivacy,
                              canSetReadReceipts: userPerm.canSetReadReceipts,
                              canSetMessageTimer: userPerm.canSetMessageTimer,
                              canSetGroupsPrivacy: userPerm.canSetGroupsPrivacy,
                              canBlockContacts: userPerm.canBlockContacts,
                              canChangeTheme: userPerm.canChangeTheme,
                              canChangeWallpaper: userPerm.canChangeWallpaper,
                              canToggleNotifications: userPerm.canToggleNotifications,
                            });
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          title="Edit Permissions"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRemoveUser(userPerm.userId)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Remove User"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Users to Chat</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setAddMode('manual')}
                className={`flex-1 px-4 py-2 text-sm font-medium ${addMode === 'manual' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-500'}`}
              >
                Manual Add
              </button>
              <button
                onClick={() => setAddMode('bulk')}
                className={`flex-1 px-4 py-2 text-sm font-medium ${addMode === 'bulk' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-500'}`}
              >
                Bulk Upload (CSV)
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {addMode === 'manual' ? (
                <>
                  {/* Search for users */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Search User by UID, Name, or Email
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchUsers(e.target.value)}
                      placeholder="Enter UID (e.g., EMP001) or name..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {isSearching && <p className="text-xs text-gray-500 mt-1">Searching...</p>}
                    {searchResults.length > 0 && (
                      <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg max-h-40 overflow-y-auto">
                        {searchResults.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{getUserName(user)}</p>
                              <p className="text-xs text-gray-500">{user.uid} - {user.email}</p>
                            </div>
                            <button
                              onClick={() => handleAddUser(user.uid)}
                              disabled={isAdding}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Or enter UID directly */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Or Enter UID Directly
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualUid}
                        onChange={(e) => setManualUid(e.target.value)}
                        placeholder="Enter UID"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                      />
                      <button
                        onClick={() => handleAddUser()}
                        disabled={!manualUid.trim() || isAdding}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {isAdding ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* CSV Upload */}
                  <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
                    <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Upload CSV with User IDs</p>
                    <p className="text-xs text-gray-500 mb-3">CSV should have UIDs or emails in the first column</p>
                    <div className="flex justify-center gap-2">
                      <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvSelect} className="hidden" />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={csvParsing}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {csvParsing ? 'Parsing...' : 'Select CSV'}
                      </button>
                      <button onClick={downloadSampleCsv} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium">
                        Download Sample
                      </button>
                    </div>
                    {csvFile && <p className="mt-2 text-xs text-gray-500">Selected: {csvFile.name}</p>}
                  </div>

                  {/* Bulk UIDs list */}
                  {bulkUids.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Users to Add ({bulkUids.length})</p>
                        <button onClick={() => setBulkUids([])} className="text-xs text-red-600">Clear All</button>
                      </div>
                      <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                        <div className="flex flex-wrap gap-1">
                          {bulkUids.slice(0, 50).map((uid) => (
                            <span key={uid} className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                              {uid}
                              <button onClick={() => setBulkUids(prev => prev.filter(u => u !== uid))} className="ml-1 text-gray-400 hover:text-red-500">
                                &times;
                              </button>
                            </span>
                          ))}
                          {bulkUids.length > 50 && (
                            <span className="text-xs text-gray-500">...and {bulkUids.length - 50} more</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bulk result */}
                  {bulkResult && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-green-600">Added: {bulkResult.success.length}</p>
                      {bulkResult.failed.length > 0 && (
                        <div className="text-xs text-red-600">
                          Failed ({bulkResult.failed.length}): {bulkResult.failed.slice(0, 5).map(f => `${f.identifier}: ${f.reason}`).join(', ')}
                          {bulkResult.failed.length > 5 && ` ...and ${bulkResult.failed.length - 5} more`}
                        </div>
                      )}
                      {bulkResult.duplicates.length > 0 && (
                        <p className="text-xs text-yellow-600">Duplicates: {bulkResult.duplicates.length}</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Default Permissions for new users */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Permissions for New Users
                </h4>
                <div className="space-y-4">
                  {userPermissionGroups.map((group) => (
                    <div key={group.title}>
                      <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{group.title}</h5>
                      <div className="space-y-1">
                        {group.permissions.map((perm) => (
                          <div key={perm.key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                            <div>
                              <p className="text-sm text-gray-900 dark:text-gray-100">{perm.label}</p>
                              <p className="text-xs text-gray-500">{perm.description}</p>
                            </div>
                            <button
                              onClick={() => setAddPermissions(prev => ({ ...prev, [perm.key]: !prev[perm.key] }))}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                addPermissions[perm.key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                addPermissions[perm.key] ? 'translate-x-4.5' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                Close
              </button>
              {addMode === 'bulk' && bulkUids.length > 0 && (
                <button
                  onClick={handleBulkAdd}
                  disabled={isAdding}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {isAdding ? 'Adding...' : `Add ${bulkUids.length} Users`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Edit Permissions - {getUserName(editUser.user)}
                </h3>
                <p className="text-xs text-gray-500">{editUser.user?.uid}</p>
              </div>
              <button onClick={() => setEditUser(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {userPermissionGroups.map((group) => (
                <div key={group.title}>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{group.title}</h4>
                  <div className="space-y-1">
                    {group.permissions.map((perm) => (
                      <div key={perm.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{perm.label}</p>
                          <p className="text-xs text-gray-500">{perm.description}</p>
                        </div>
                        <button
                          onClick={() => setEditPermissions(prev => ({ ...prev, [perm.key]: !prev[perm.key] }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            editPermissions[perm.key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            editPermissions[perm.key] ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

// Status dot component
function StatusDot({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-red-400'}`} title={enabled ? 'Enabled' : 'Disabled'} />
  );
}
