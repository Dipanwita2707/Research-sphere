/**
 * Chat Layout Component
 * Main layout structure for the chat feature
 */
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSocket } from '../hooks/useSocket';
import { useChatStore } from '../store/chatStore';
import { UnifiedChatList } from './UnifiedChatList';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
import { MemberList } from './MemberList';
import { GroupSettings } from './GroupSettings';
import { CreateGroupModal } from './CreateGroupModal';
import { ChatUserManagement } from './ChatUserManagement';
import { UserProfileModal } from './UserProfileModal';
import { useAuthStore } from '@/shared/auth/authStore';
import * as chatService from '../services/chat.service';
import { getProfileImageUrl } from '../services/chat.service';
import type { UserChatAccess } from '../types';

export function ChatLayout() {
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const actionParam = searchParams.get('action');
  
  const [showCreateGroup, setShowCreateGroup] = useState(actionParam ===
   'create' || actionParam ===
   'bulk-upload');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [chatAccess, setChatAccess] = useState<UserChatAccess | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle URL parameter changes
  useEffect(() => {
    if (actionParam ===
   'create' || actionParam ===
   'bulk-upload') {
      setShowCreateGroup(true);
    }
  }, [actionParam]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const {
    currentGroupId,
    currentGroup,
    currentDMUserId,
    showGroupSettings,
    showMemberList,
    groups,
    setGroups,
    setConversations,
    setLoading,
    setError,
  } = useChatStore();

  // Check user's chat access permissions
  const userPermissions = chatAccess?.permissions;
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = authUser?.userType ===
   'admin' || authUser?.role?.name ===
   'superadmin';
  const canCreateGroup = userPermissions?.canCreateGroup !== false && (
    isAdmin || groups.some(g => g.myRole ===
   'owner' || g.myRole ===
   'admin')
  );
  const canPrivateMessage = userPermissions?.canPrivateMessage !== false;

  // Initialize socket connection (only if chat access granted)
  const { 
    isConnected, 
    connectionError, 
    joinGroup, 
    leaveGroup,
    sendMessage,
    sendDirectMessage,
    markRead,
    markDMRead,
    sendTyping,
    sendStopTyping,
    sendTypingDM,
    sendStopTypingDM,
  } = useSocket({ enabled: chatAccess?.hasAccess !== false });

  // Check chat access first
  useEffect(() => {
    const checkAccess = async () => {
      setCheckingAccess(true);
      try {
        const access = await chatService.getMyPermissions();
        setChatAccess(access);
      } catch (err: any) {
        // If 403 with CHAT_ACCESS_DENIED, user doesn't have access
        if (err.response?.data?.code ===
   'CHAT_ACCESS_DENIED') {
          setChatAccess({ hasAccess: false, permissions: null });
        } else {
          // Other errors - assume access allowed (backwards compatible)
          setChatAccess({ hasAccess: true, permissions: null });
        }
      } finally {
        setCheckingAccess(false);
      }
    };
    checkAccess();
  }, []);

  // Load initial data (only if access granted)
  useEffect(() => {
    if (checkingAccess || chatAccess?.hasAccess ===
   false) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [groupsRes, conversationsRes] = await Promise.all([
          chatService.getMyGroups(),
          canPrivateMessage ? chatService.getConversations() : Promise.resolve([]),
        ]);
        setGroups(groupsRes.groups);
        setConversations(Array.isArray(conversationsRes) ? conversationsRes : []);

        // Restore currentGroup object after refresh (only ID is persisted)
        const { currentGroupId, currentGroup } = useChatStore.getState();
        if (currentGroupId && !currentGroup) {
          // Check if group still exists in the fetched list
          const matchedGroup = groupsRes.groups.find((g: any) => g.id === currentGroupId);
          if (!matchedGroup) {
            // Stale group ID — clear it silently
            useChatStore.getState().setCurrentGroup(null, null);
          } else {
            // Set a quick placeholder from the list for responsiveness
            useChatStore.getState().setCurrentGroup(currentGroupId, matchedGroup);
            // Then fetch full group details (with all member data)
            try {
              const fullGroup = await chatService.getGroup(currentGroupId);
              useChatStore.getState().setCurrentGroup(fullGroup.id, fullGroup as any);
            } catch (err) {
              console.error('Failed to fetch full group details:', err);
              // Group no longer accessible — clear it
              useChatStore.getState().setCurrentGroup(null, null);
            }
          }
        }
      } catch (error: any) {
        console.error('Failed to load chat data:', error);
        setError(error.message || 'Failed to load chat data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [checkingAccess, chatAccess, canPrivateMessage, setGroups, setConversations, setLoading, setError]);

  // Join/leave group rooms when current group changes
  useEffect(() => {
    if (currentGroupId && isConnected) {
      joinGroup(currentGroupId);
      return () => {
        leaveGroup(currentGroupId);
      };
    }
  }, [currentGroupId, isConnected, joinGroup, leaveGroup]);

  // Loading state
  if (checkingAccess) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm">Checking access...</p>
        </div>
      </div>
    );
  }

  // Access denied state
  if (chatAccess?.hasAccess ===
   false) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Chat Access Required</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You do not have access to the chat application. Please contact your administrator to get access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#e8eef5] dark:bg-gray-900 text-gray-900 relative overflow-hidden">
      {/* 3D Environment Lighting / Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-400/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] bg-pink-400/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Sidebar - 3D Floating Panel */}
      <div 
        className={`${
          sidebarOpen ? 'w-80 ml-4 my-4' : 'w-0 m-0'
        } flex-shrink-0 flex flex-col bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl border-2 border-white/80 dark:border-gray-700/80 rounded-[2.5rem] shadow-[20px_20px_40px_rgba(0,0,0,0.08),-20px_-20px_40px_rgba(255,255,255,0.8)] dark:shadow-[20px_20px_40px_rgba(0,0,0,0.4),-10px_-10px_20px_rgba(255,255,255,0.05)] transition-all duration-300 overflow-hidden z-10`}
      >
        {/* Sidebar Header */}
        <div className="relative z-30 flex items-center justify-between px-5 py-4 bg-white/40 dark:bg-black/20 backdrop-blur-md border-b border-white/50 dark:border-gray-700/50 shadow-[inset_0_-2px_10px_rgba(255,255,255,0.5)]">
          {/* User Profile Photo */}
          <button
            onClick={() => setShowMyProfile(true)}
            className="flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg p-1 transition-colors"
            title="View my profile"
          >
            {authUser?.profileImageUrl ? (
              <img
                src={getProfileImageUrl(authUser.profileImageUrl) || authUser.profileImageUrl}
                alt={authUser.username}
                className="w-9 h-9 rounded-full object-cover border-2 border-white/40 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/50 dark:bg-gray-800/50 border-2 border-white/40 flex items-center justify-center text-gray-800 dark:text-white font-semibold text-sm shadow-sm">
                {authUser?.username?.slice(0, 2).toUpperCase() || 'ME'}
              </div>
            )}
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">Chats</h1>
          </button>
          
          <div className="flex items-center gap-1">
            {/* Search icon */}
            <button
              onClick={() => {}}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Search"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Three-dot Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title="More options"
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-[80]">
                  {canCreateGroup && (
                    <button
                      onClick={() => {
                        setShowCreateGroup(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 "
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      New group
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setShowUserManagement(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Manage Chat Users
                    </button>
                  )}
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Starred messages
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      router.push('/settings');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    My Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      router.push('/settings');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Account Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unified Chat List */}
        <div className="flex-1 overflow-y-auto">
          <UnifiedChatList />
        </div>

        {/* Connection Status */}
        {connectionError && (
          <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs text-center">
            Connection error. Reconnecting...
          </div>
        )}
      </div>

      {/* Toggle Sidebar Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-4 z-10 p-2 rounded-md bg-white dark:bg-gray-800 shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {currentGroupId || currentDMUserId ? (
          <>
            {/* Chat Header */}
            <ChatHeader />

            {/* Messages */}
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 flex flex-col min-w-0">
                <MessageList />
                <MessageInput
                  onSendMessage={(data: {
                    content?: string;
                    messageType?: string;
                    filePath?: string;
                    fileName?: string;
                    fileSize?: number;
                    mimeType?: string;
                    duration?: number;
                    waveformData?: number[];
                    replyToId?: string;
                    mentions?: string[];
                  }) => {
                    if (currentGroupId) {
                      sendMessage({ ...data, groupId: currentGroupId });
                    } else if (currentDMUserId) {
                      sendDirectMessage({ ...data, receiverId: currentDMUserId });
                    }
                  }}
                  onTyping={() => {
                    if (currentGroupId) sendTyping(currentGroupId);
                    else if (currentDMUserId) sendTypingDM(currentDMUserId);
                  }}
                  onStopTyping={() => {
                    if (currentGroupId) sendStopTyping(currentGroupId);
                    else if (currentDMUserId) sendStopTypingDM(currentDMUserId);
                  }}
                />
              </div>

              {/* Member List (Groups only) */}
              {showMemberList && currentGroup && (
                <MemberList />
              )}
            </div>
          </>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center text-gray-400 dark:text-gray-500">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-sky-100 dark:from-blue-900/30 dark:to-sky-900/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-[#6497b1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-gray-600 dark:text-gray-400 mb-1">Select a conversation</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">Choose a group or start a direct message</p>
            </div>
          </div>
        )}
      </div>

      {/* Group Settings Panel */}
      {showGroupSettings && currentGroup && (
        <GroupSettings />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}

      {/* Chat User Management Modal (Admin only) */}
      {showUserManagement && isAdmin && (
        <ChatUserManagement onClose={() => setShowUserManagement(false)} />
      )}

      {/* My Profile Modal */}
      {showMyProfile && authUser && (
        <UserProfileModal
          isOpen={showMyProfile}
          user={{
            id: authUser.id,
            username: authUser.username,
            firstName: authUser.firstName,
            lastName: authUser.lastName,
            email: authUser.email,
            uid: authUser.uid,
            profileImage: authUser.profileImageUrl,
            userType: authUser.userType,
            employee: authUser.employee,
            student: authUser.student,
          }}
          onClose={() => setShowMyProfile(false)}
        />
      )}
    </div>
  );
}
