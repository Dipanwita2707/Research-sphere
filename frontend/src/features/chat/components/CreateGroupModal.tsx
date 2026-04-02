/**
 * Create Group Modal Component
 * Modal for creating a new chat group with bulk upload and permissions
 */
'use client';

import React, { useState, useRef } from 'react';
import { useChatStore } from '../store/chatStore';
import * as chatService from '../services/chat.service';
import type { GroupPermissions } from '../types';

interface CreateGroupModalProps {
  onClose: () => void;
}

type TabType = 'basic' | 'members' | 'permissions';

// Default permissions (group-level only)
const defaultPermissions: GroupPermissions = {
  canSendMessage: true,
  canUploadFiles: true,
  canSendVoice: true,
  canSendVideo: true,
  canSendEmoji: true,
  canEditMessage: true,
  canDeleteMessage: false,
  canPinMessage: false,
  canMentionAll: false,
  canAddMembers: false,
  canRemoveMembers: false,
  canDeleteGroup: false,
  adminOnlyMessaging: false,
  readOnlyMode: false,
  privateDMAllowed: true,
  searchMembers: true,
  maxFileSize: 10485760, // 10MB default
};

export function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Member management
  const [memberUids, setMemberUids] = useState<string[]>([]);
  const [manualUid, setManualUid] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvPreview, setCsvPreview] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Permissions
  const [groupPermissions, setGroupPermissions] = useState<GroupPermissions>(defaultPermissions);

  const { addGroup, setCurrentGroup } = useChatStore();

  // Handle CSV file selection
  const handleCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    setCsvParsing(true);
    setError(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
      
      // Parse CSV - expect UID/username in first column
      const uids: string[] = [];
      const preview: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip header row if it contains common header names
        if (i ===
   0 && /uid|username|user|member|employee|student/i.test(line)) {
          continue;
        }
        
        const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
        const uid = columns[0];
        
        if (uid && uid.length > 0) {
          uids.push(uid);
          if (preview.length < 5) {
            preview.push(uid);
          }
        }
      }

      setMemberUids(prev => Array.from(new Set([...prev, ...uids])));
      setCsvPreview(preview);
      setSuccess(`Found ${uids.length} valid UID${uids.length !== 1 ? 's' : ''} in CSV`);
    } catch (err) {
      setError('Failed to parse CSV file');
      console.error('CSV parse error:', err);
    } finally {
      setCsvParsing(false);
    }
  };

  // Add manual UID
  const handleAddUid = () => {
    if (!manualUid.trim()) return;
    
    if (manualUid.trim().length < 3) {
      setError('UID must be at least 3 characters');
      return;
    }

    if (memberUids.includes(manualUid.trim())) {
      setError('UID already added');
      return;
    }

    setMemberUids(prev => [...prev, manualUid.trim()]);
    setManualUid('');
    setError(null);
  };

  // Remove UID
  const handleRemoveUid = (uid: string) => {
    setMemberUids(prev => prev.filter(e => e !== uid));
  };

  // Toggle permission
  const togglePermission = (key: keyof GroupPermissions) => {
    setGroupPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Create group
  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Group name is required');
      setActiveTab('basic');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const group = await chatService.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        isEncrypted,
        initialMembers: memberUids.length > 0 ? memberUids : undefined,
        permissions: groupPermissions,
      });

      addGroup(group);
      setCurrentGroup(group.id, group);
      onClose();
    } catch (err: any) {
      console.error('Failed to create group:', err);
      setError(err.response?.data?.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  // Download sample CSV
  const downloadSampleCsv = () => {
    const csvContent = 'uid,name,role\nEMP001,John Doe,member\nEMP002,Jane Smith,admin\nSTD12345,Student Name,member';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_members.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const permissionGroups = [
    {
      title: 'Messaging',
      permissions: [
        { key: 'canSendMessage' as const, label: 'Send Messages', description: 'Members can send text messages' },
        { key: 'canEditMessage' as const, label: 'Edit Messages', description: 'Members can edit their own messages' },
        { key: 'canDeleteMessage' as const, label: 'Delete Messages', description: 'Members can delete their own messages' },
        { key: 'canPinMessage' as const, label: 'Pin Messages', description: 'Members can pin important messages' },
        { key: 'adminOnlyMessaging' as const, label: 'Admin Only Messaging', description: 'Only admins can send messages' },
        { key: 'readOnlyMode' as const, label: 'Read Only Mode', description: 'Group is read-only for non-admins' },
      ],
    },
    {
      title: 'Media & Files',
      permissions: [
        { key: 'canUploadFiles' as const, label: 'Upload Files', description: 'Members can share files and documents' },
        { key: 'canSendVoice' as const, label: 'Voice Messages', description: 'Members can send voice recordings' },
        { key: 'canSendVideo' as const, label: 'Video Messages', description: 'Members can share videos' },
        { key: 'canSendEmoji' as const, label: 'Use Emoji', description: 'Members can use emoji reactions' },
      ],
    },
    {
      title: 'Group Management',
      permissions: [
        { key: 'canAddMembers' as const, label: 'Add Members', description: 'Members can add new members' },
        { key: 'canRemoveMembers' as const, label: 'Remove Members', description: 'Members can remove other members' },
        { key: 'canMentionAll' as const, label: 'Mention All', description: 'Members can use @all mention' },
        { key: 'privateDMAllowed' as const, label: 'Private DMs', description: 'Members can DM each other from the group' },
        { key: 'searchMembers' as const, label: 'Search Members', description: 'Members can search the member list' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Create New Group
          </h2>
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
          {(['basic', 'members', 'permissions'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab ===
   tab
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {tab ===
   'basic' && '1. Basic Info'}
              {tab ===
   'members' && `2. Members ${memberUids.length > 0 ? `(${memberUids.length})` : ''}`}
              {tab ===
   'permissions' && '3. Permissions'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg">
              {success}
            </div>
          )}

          {/* Basic Info Tab */}
          {activeTab ===
   'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter group description (optional)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Enable Encryption
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Messages will be encrypted for privacy
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEncrypted(!isEncrypted)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isEncrypted ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEncrypted ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab ===
   'members' && (
            <div className="space-y-4">
              {/* Bulk CSV Upload */}
              <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <div className="text-center">
                  <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    Bulk Upload Members
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Upload a CSV file with UIDs (employee/student usernames)
                  </p>
                  <div className="flex justify-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleCsvSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={csvParsing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {csvParsing ? 'Parsing...' : 'Select CSV File'}
                    </button>
                    <button
                      onClick={downloadSampleCsv}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium"
                    >
                      Download Sample
                    </button>
                  </div>
                  {csvFile && (
                    <p className="mt-2 text-xs text-gray-500">
                      Selected: {csvFile.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Manual UID Entry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Add Members Manually
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualUid}
                    onChange={(e) => setManualUid(e.target.value)}
                    placeholder="Enter UID (e.g., EMP001, STD12345)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                    onKeyPress={(e) => e.key ===
   'Enter' && handleAddUid()}
                  />
                  <button
                    onClick={handleAddUid}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Member List */}
              {memberUids.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Members to Add ({memberUids.length})
                    </label>
                    <button
                      onClick={() => setMemberUids([])}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    {memberUids.map((uid, index) => (
                      <div
                        key={uid}
                        className={`flex items-center justify-between px-3 py-2 ${
                          index !== memberUids.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                        }`}
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">{uid}</span>
                        <button
                          onClick={() => handleRemoveUid(uid)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab ===
   'permissions' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure default permissions for all members. You can customize individual member permissions after creating the group.
              </p>

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
                            groupPermissions[perm.key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              groupPermissions[perm.key] ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Quick Presets */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Quick Presets
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setGroupPermissions({
                      ...defaultPermissions,
                      canAddMembers: true,
                      canRemoveMembers: true,
                      canPinMessage: true,
                      canDeleteMessage: true,
                      canMentionAll: true,
                    })}
                    className="px-3 py-1.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full hover:bg-green-200"
                  >
                    Open Group
                  </button>
                  <button
                    onClick={() => setGroupPermissions({
                      ...defaultPermissions,
                      canAddMembers: false,
                      canRemoveMembers: false,
                      readOnlyMode: false,
                    })}
                    className="px-3 py-1.5 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full hover:bg-yellow-200"
                  >
                    Moderated
                  </button>
                  <button
                    onClick={() => setGroupPermissions({
                      ...defaultPermissions,
                      adminOnlyMessaging: true,
                      canUploadFiles: false,
                      canSendVoice: false,
                      canSendVideo: false,
                    })}
                    className="px-3 py-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full hover:bg-red-200"
                  >
                    Announcement Only
                  </button>
                  <button
                    onClick={() => setGroupPermissions(defaultPermissions)}
                    className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200"
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {activeTab !== 'basic' && (
              <button
                onClick={() => setActiveTab(activeTab ===
   'permissions' ? 'members' : 'basic')}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            {activeTab !== 'permissions' ? (
              <button
                onClick={() => setActiveTab(activeTab ===
   'basic' ? 'members' : 'permissions')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={!name.trim() || isCreating}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Group'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
