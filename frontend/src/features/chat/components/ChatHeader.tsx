/**
 * Chat Header Component
 * Header for active chat (group or DM)
 */
'use client';

import React, { useState } from 'react';
import { useChatStore, useCurrentGroup, useCurrentDMUser, useIsOnline } from '../store/chatStore';
import { getProfileImageUrl } from '../services/chat.service';
import { OnlineStatus } from './OnlineStatus';
import { LastSeen } from './LastSeen';
import { UserProfileModal } from './UserProfileModal';

export function ChatHeader() {
  const [showDMUserProfile, setShowDMUserProfile] = useState(false);
  
  const {
    currentGroupId,
    currentDMUserId,
    showMemberList,
    setShowMemberList,
    setShowGroupSettings,
  } = useChatStore();
  
  const currentGroup = useCurrentGroup();
  const currentDMUser = useCurrentDMUser();

  // For DM, get other user info (would be fetched)
  const isOtherUserOnline = useIsOnline(currentDMUserId || '');

  if (currentGroupId && currentGroup) {
    return (
      <div className="p-4 z-10">
        <div className="h-16 px-4 flex items-center justify-between bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl border-2 border-white/80 dark:border-gray-700/80 rounded-[2rem] shadow-[10px_10px_20px_rgba(0,0,0,0.05),-10px_-10px_20px_rgba(255,255,255,0.8)] dark:shadow-[10px_10px_20px_rgba(0,0,0,0.4),-5px_-5px_15px_rgba(255,255,255,0.05)]">
          {/* Back + Group Info */}
          <div className="flex items-center gap-3">
            {/* Back Arrow */}
            <button
              onClick={() => useChatStore.getState().setCurrentGroup(null, null)}
              className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-colors shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_5px_rgba(255,255,255,0.1),inset_-2px_-2px_5px_rgba(0,0,0,0.2)]"
              title="Back"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Avatar */}
            {currentGroup.avatar ? (
              <img
                src={currentGroup.avatar}
                alt={currentGroup.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-[2px_2px_5px_rgba(0,0,0,0.1)]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-gray-700 dark:to-gray-800 border-2 border-white dark:border-gray-600 flex items-center justify-center text-blue-800 dark:text-white font-bold text-sm shadow-[2px_2px_5px_rgba(0,0,0,0.1)]">
                {currentGroup.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            {/* Name & Members */}
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
                {currentGroup.name}
              </h2>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {currentGroup._count?.members || 0} members
                {currentGroup.onlineMemberCount !== undefined && currentGroup.onlineMemberCount > 0 && (
                  <span className="text-blue-500 dark:text-blue-400"> · {currentGroup.onlineMemberCount} online</span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Search in chat */}
            <button
              className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-colors shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_5px_rgba(255,255,255,0.1),inset_-2px_-2px_5px_rgba(0,0,0,0.2)]"
              title="Search in chat"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Toggle Members */}
            <button
              onClick={() => setShowMemberList(!showMemberList)}
              className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-colors shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_5px_rgba(255,255,255,0.1),inset_-2px_-2px_5px_rgba(0,0,0,0.2)]"
              title="Toggle members"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowGroupSettings(true)}
              className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-colors shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_5px_rgba(255,255,255,0.1),inset_-2px_-2px_5px_rgba(0,0,0,0.2)]"
              title="Group settings"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DM Header
  if (currentDMUserId) {
    const getDMUserName = () => {
      if (!currentDMUser) return 'User';
      if (currentDMUser.employeeDetails) {
        return currentDMUser.employeeDetails.displayName || 
          `${currentDMUser.employeeDetails.firstName || ''} ${currentDMUser.employeeDetails.lastName || ''}`.trim() || 'User';
      }
      if (currentDMUser.studentLogin) {
        return `${currentDMUser.studentLogin.firstName || ''} ${currentDMUser.studentLogin.lastName || ''}`.trim() || 'User';
      }
      return currentDMUser.uid || 'User';
    };

    const getDMUserInitials = () => {
      const name = getDMUserName();
      return name
        .split(' ')
        .map((word: string) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    return (
      <div className="p-4 z-10">
        <div className="h-16 px-4 flex items-center justify-between bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl border-2 border-white/80 dark:border-gray-700/80 rounded-[2rem] shadow-[10px_10px_20px_rgba(0,0,0,0.05),-10px_-10px_20px_rgba(255,255,255,0.8)] dark:shadow-[10px_10px_20px_rgba(0,0,0,0.4),-5px_-5px_15px_rgba(255,255,255,0.05)]">
          {/* Back + User Info */}
          <div className="flex items-center gap-3">
            {/* Back Arrow */}
            <button
              onClick={() => useChatStore.getState().setCurrentDMUser(null)}
              className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-colors shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_5px_rgba(255,255,255,0.1),inset_-2px_-2px_5px_rgba(0,0,0,0.2)]"
              title="Back"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Avatar with online indicator */}
            <button
              onClick={() => setShowDMUserProfile(true)}
              className="relative hover:scale-105 transition-transform"
              title="View profile"
            >
              {currentDMUser?.profileImage ? (
                <img
                  src={getProfileImageUrl(currentDMUser.profileImage) || currentDMUser.profileImage}
                  alt={getDMUserName()}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-[2px_2px_5px_rgba(0,0,0,0.1)] cursor-pointer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-gray-700 dark:to-gray-800 border-2 border-white dark:border-gray-600 flex items-center justify-center text-blue-800 dark:text-white font-bold text-sm shadow-[2px_2px_5px_rgba(0,0,0,0.1)] cursor-pointer">
                  {getDMUserInitials()}
                </div>
              )}
              <OnlineStatus userId={currentDMUserId} size="sm" />
            </button>

            {/* Name & Status */}
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
                {getDMUserName()}
              </h2>
              <LastSeen userId={currentDMUserId} className="text-xs font-medium text-gray-500 dark:text-gray-400" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <button
              className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-colors shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_5px_rgba(255,255,255,0.1),inset_-2px_-2px_5px_rgba(0,0,0,0.2)]"
              title="Search in chat"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            {/* More Options */}
            <button
              className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-colors shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_5px_rgba(255,255,255,0.1),inset_-2px_-2px_5px_rgba(0,0,0,0.2)]"
              title="More options"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* DM User Profile Modal */}
      {showDMUserProfile && currentDMUser && (
        <UserProfileModal
          isOpen={showDMUserProfile}
          user={{
            id: currentDMUser.id,
            username: currentDMUser.uid || 'Unknown',
            firstName: currentDMUser.employeeDetails?.firstName || currentDMUser.studentLogin?.firstName,
            lastName: currentDMUser.employeeDetails?.lastName || currentDMUser.studentLogin?.lastName,
            email: currentDMUser.email,
            uid: currentDMUser.uid,
            profileImage: currentDMUser.profileImage,
            userType: undefined,
            employee: currentDMUser.employeeDetails ? {
              empId: undefined,
              designation: undefined,
              displayName: currentDMUser.employeeDetails.displayName,
            } : undefined,
            student: currentDMUser.studentLogin ? {
              studentId: undefined,
              registrationNo: undefined,
              program: undefined,
              semester: undefined,
            } : undefined,
          }}
          onClose={() => setShowDMUserProfile(false)}
        />
      )}
    </>
  );
}
