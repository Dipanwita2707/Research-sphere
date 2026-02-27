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
      <div className="h-16 px-4 flex items-center justify-between shadow-md" style={{background:'linear-gradient(90deg,#005b96 0%,#6497b1 100%)'}}>
        {/* Back + Group Info */}
        <div className="flex items-center gap-3">
          {/* Back Arrow */}
          <button
            onClick={() => useChatStore.getState().setCurrentGroup(null, null)}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
            title="Back"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Avatar */}
          {currentGroup.avatar ? (
            <img
              src={currentGroup.avatar}
              alt={currentGroup.name}
              className="w-9 h-9 rounded-full object-cover border-2 border-white/40"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/30 border-2 border-white/40 flex items-center justify-center text-white font-semibold text-sm">
              {currentGroup.name.slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* Name & Members */}
          <div>
            <h2 className="font-semibold text-white leading-tight">
              {currentGroup.name}
            </h2>
            <p className="text-xs text-white/75">
              {currentGroup._count?.members || 0} members
              {currentGroup.onlineMemberCount !== undefined && currentGroup.onlineMemberCount > 0 && (
                <span className="text-white/90"> · {currentGroup.onlineMemberCount} online</span>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Search in chat */}
          <button
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Search in chat"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Toggle Members */}
          <button
            onClick={() => setShowMemberList(!showMemberList)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Toggle members"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowGroupSettings(true)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Group settings"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
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
      <div className="h-16 px-4 flex items-center justify-between shadow-md" style={{background:'linear-gradient(90deg,#005b96 0%,#6497b1 100%)'}}>
        {/* Back + User Info */}
        <div className="flex items-center gap-3">
          {/* Back Arrow */}
          <button
            onClick={() => useChatStore.getState().setCurrentDMUser(null)}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
            title="Back"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Avatar with online indicator */}
          <button
            onClick={() => setShowDMUserProfile(true)}
            className="relative hover:opacity-90 transition-opacity"
            title="View profile"
          >
            {currentDMUser?.profileImage ? (
              <img
                src={getProfileImageUrl(currentDMUser.profileImage) || currentDMUser.profileImage}
                alt={getDMUserName()}
                className="w-9 h-9 rounded-full object-cover border-2 border-white/40 cursor-pointer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/30 border-2 border-white/40 flex items-center justify-center text-white font-semibold text-sm cursor-pointer">
                {getDMUserInitials()}
              </div>
            )}
            <OnlineStatus userId={currentDMUserId} size="sm" />
          </button>

          {/* Name & Status */}
          <div>
            <h2 className="font-semibold text-white leading-tight">
              {getDMUserName()}
            </h2>
            <LastSeen userId={currentDMUserId} className="text-white/75" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Search */}
          <button
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="Search in chat"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          {/* More Options */}
          <button
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            title="More options"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>
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
