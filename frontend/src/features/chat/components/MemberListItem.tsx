/**
 * Member List Item Component
 * Individual member in the member list
 */
'use client';

import React, { useState } from 'react';
import { useIsOnline } from '../store/chatStore';
import { useAuthStore } from '@/shared/auth/authStore';
import { UserProfileModal } from './UserProfileModal';
import type { ChatGroupMember, MemberRole } from '../types';
import * as chatService from '../services/chat.service';
import { getProfileImageUrl } from '../services/chat.service';

interface MemberListItemProps {
  member: ChatGroupMember;
  groupId: string;
  myRole?: MemberRole;
  onManagePermissions?: (member: ChatGroupMember) => void;
}

export function MemberListItem({ member, groupId, myRole, onManagePermissions }: MemberListItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const isOnline = useIsOnline(member.userId);
  const authUser = useAuthStore((s) => s.user);
  const isSystemAdmin = authUser?.userType === 'admin' || authUser?.role?.name === 'superadmin';
  const user = member.user;

  const canManageMember = 
    isSystemAdmin ||
    myRole === 'owner' || 
    (myRole === 'admin' && member.memberRole !== 'owner' && member.memberRole !== 'admin') ||
    (myRole === 'moderator' && member.memberRole === 'member');

  const getUserName = () => {
    if (!user) return 'Unknown';
    if (user.employeeDetails) {
      return user.employeeDetails.displayName || 
        `${user.employeeDetails.firstName || ''} ${user.employeeDetails.lastName || ''}`.trim();
    }
    if (user.studentLogin) {
      return `${user.studentLogin.firstName || ''} ${user.studentLogin.lastName || ''}`.trim();
    }
    return user.uid || 'Unknown';
  };

  const getInitials = () => {
    const name = getUserName();
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = () => {
    const roleColors = {
      owner: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      moderator: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      member: '',
    };

    if (member.memberRole === 'member') return null;

    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleColors[member.memberRole]}`}>
        {member.memberRole}
      </span>
    );
  };

  const handleRemove = async () => {
    if (!confirm('Remove this member from the group?')) return;
    
    setIsLoading(true);
    try {
      await chatService.removeMember(groupId, member.userId);
      setShowMenu(false);
      // Could trigger a refresh of the group data here
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMute = async () => {
    setIsLoading(true);
    try {
      if (member.isMuted) {
        await chatService.unmuteMember(groupId, member.userId);
      } else {
        await chatService.muteMember(groupId, member.userId, 24 * 60 * 60 * 1000); // 24 hours
      }
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to mute/unmute member:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (newRole: MemberRole) => {
    setIsLoading(true);
    try {
      await chatService.updateMemberRole(groupId, member.userId, newRole);
      setShowMenu(false);
    } catch (error) {
      console.error('Failed to change role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Avatar */}
      <button
        onClick={() => setShowProfile(true)}
        className="relative flex-shrink-0 hover:opacity-80 transition-opacity"
        title="View profile"
      >
        {user?.profileImage ? (
          <img
            src={getProfileImageUrl(user.profileImage) || user.profileImage}
            alt={getUserName()}
            className="w-8 h-8 rounded-full object-cover cursor-pointer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-xs font-medium cursor-pointer">
            {getInitials()}
          </div>
        )}
        
        {/* Online indicator */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-50 dark:border-gray-900 ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {getUserName()}
          </p>
          {getRoleBadge()}
          {member.isMuted && (
            <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {user?.role || 'Member'}
        </p>
      </div>

      {/* Actions Menu */}
      {canManageMember && (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={isLoading}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
              {/* Role options */}
              {(myRole === 'owner' || isSystemAdmin) && member.memberRole !== 'owner' && (
                <>
                  <button
                    onClick={() => handleRoleChange('admin')}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Make Admin
                  </button>
                  <button
                    onClick={() => handleRoleChange('moderator')}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Make Moderator
                  </button>
                  <button
                    onClick={() => handleRoleChange('member')}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Make Member
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-gray-700" />
                </>
              )}

              {/* Mute/Unmute */}
              <button
                onClick={handleMute}
                disabled={isLoading}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {member.isMuted ? 'Unmute' : 'Mute'}
              </button>

              {/* Manage Permissions */}
              {(myRole === 'owner' || myRole === 'admin' || isSystemAdmin) && onManagePermissions && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onManagePermissions(member);
                  }}
                  disabled={isLoading}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Manage Permissions
                </button>
              )}

              {/* Remove */}
              <button
                onClick={handleRemove}
                disabled={isLoading}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                Remove from group
              </button>
            </div>
          )}
        </div>
      )}

      {/* User Profile Modal */}
      {showProfile && user && (
        <UserProfileModal
          isOpen={showProfile}
          user={{
            id: user.id,
            username: user.uid || 'Unknown',
            firstName: user.employeeDetails?.firstName || user.studentLogin?.firstName,
            lastName: user.employeeDetails?.lastName || user.studentLogin?.lastName,
            email: user.email,
            uid: user.uid,
            profileImage: user.profileImage,
            userType: undefined,
            employee: user.employeeDetails ? {
              empId: undefined,
              designation: undefined,
              displayName: user.employeeDetails.displayName,
            } : undefined,
            student: user.studentLogin ? {
              studentId: undefined,
              registrationNo: undefined,
              program: undefined,
              semester: undefined,
            } : undefined,
          }}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
