/**
 * Add Member Modal Component
 * Modal for adding members to a group
 */
'use client';

import React, { useState, useRef } from 'react';
import * as chatService from '../services/chat.service';
import type { ChatUser, BulkUploadResult } from '../types';

interface AddMemberModalProps {
  groupId: string;
  onClose: () => void;
}

export function AddMemberModal({ groupId, onClose }: AddMemberModalProps) {
  const [mode, setMode] = useState<'search' | 'csv'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search for users
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await chatService.searchGroupMembers(groupId, query, 20);
      // Filter out already selected users
      const filtered = results
        .filter(m => !selectedUsers.some(s => s.id ===
   m.user?.id))
        .map(m => m.user!)
        .filter(Boolean);
      setSearchResults(filtered as ChatUser[]);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Add user to selection
  const addToSelection = (user: ChatUser) => {
    setSelectedUsers([...selectedUsers, user]);
    setSearchResults(searchResults.filter(u => u.id !== user.id));
    setSearchQuery('');
  };

  // Remove user from selection
  const removeFromSelection = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  // Add selected users to group
  const handleAddMembers = async () => {
    if (selectedUsers.length ===
   0) return;

    setIsAdding(true);
    try {
      for (const user of selectedUsers) {
        await chatService.addMember(groupId, { userId: user.id });
      }
      onClose();
    } catch (error) {
      console.error('Failed to add members:', error);
    } finally {
      setIsAdding(false);
    }
  };

  // Handle CSV upload
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAdding(true);
    try {
      const result = await chatService.bulkAddMembers(groupId, file);
      setBulkResult(result);
    } catch (error) {
      console.error('Bulk upload failed:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const getUserName = (user: ChatUser) => {
    if (user.employeeDetails) {
      return user.employeeDetails.displayName || 
        `${user.employeeDetails.firstName || ''} ${user.employeeDetails.lastName || ''}`.trim();
    }
    if (user.studentLogin) {
      return `${user.studentLogin.firstName || ''} ${user.studentLogin.lastName || ''}`.trim();
    }
    return user.uid || 'Unknown';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add Members
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
          <button
            onClick={() => setMode('search')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode ===
   'search'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Search Users
          </button>
          <button
            onClick={() => setMode('csv')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode ===
   'csv'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Import CSV
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {mode ===
   'search' ? (
            <>
              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedUsers.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                    >
                      {getUserName(user)}
                      <button
                        onClick={() => removeFromSelection(user.id)}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search Input */}
              <div className="relative mb-3">
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
                  placeholder="Search by name, email, or user ID..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                />
              </div>

              {/* Search Results */}
              {isSearching ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => addToSelection(user)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                        {getUserName(user).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {getUserName(user)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {user.email || user.uid}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                  No users found
                </p>
              ) : (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                  Start typing to search for users
                </p>
              )}
            </>
          ) : (
            // CSV Upload
            <>
              {bulkResult ? (
                <div className="space-y-4">
                  {bulkResult.success.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                      <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
                        Successfully added ({bulkResult.success.length})
                      </h4>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {bulkResult.success.map(s => s.identifier).join(', ')}
                      </p>
                    </div>
                  )}
                  
                  {bulkResult.failed.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                        Failed ({bulkResult.failed.length})
                      </h4>
                      <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                        {bulkResult.failed.map((f, i) => (
                          <li key={i}>{f.identifier}: {f.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {bulkResult.duplicates.length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                        Already members ({bulkResult.duplicates.length})
                      </h4>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">
                        {bulkResult.duplicates.map(d => d.identifier).join(', ')}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => setBulkResult(null)}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-700"
                  >
                    Upload another file
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                  
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Upload a CSV file with user emails or IDs
                  </p>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAdding}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {isAdding ? 'Uploading...' : 'Select CSV File'}
                  </button>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                    CSV should have one column with email addresses or user IDs
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {mode ===
   'search' && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAddMembers}
              disabled={selectedUsers.length ===
   0 || isAdding}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isAdding ? 'Adding...' : `Add ${selectedUsers.length || ''} Member${selectedUsers.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
