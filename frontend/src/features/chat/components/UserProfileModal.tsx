/**
 * User Profile Modal Component
 * Shows user details when clicking on profile photos
 */
'use client';

import React from 'react';
import { X, Mail, Phone, User, Briefcase, GraduationCap } from 'lucide-react';
import { getProfileImageUrl } from '../services/chat.service';

interface UserProfileData {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  uid?: string;
  profileImage?: string;
  userType?: 'student' | 'staff' | 'admin' | 'faculty';
  employee?: {
    empId?: string;
    designation?: string;
    displayName?: string;
  };
  student?: {
    studentId?: string;
    registrationNo?: string;
    program?: string;
    semester?: number;
    displayName?: string;
  };
}

interface UserProfileModalProps {
  isOpen: boolean;
  user: UserProfileData | null;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, user, onClose }: UserProfileModalProps) {
  if (!isOpen || !user) return null;

  const getDisplayName = () => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username;
  };

  const getAvatarUrl = () => {
    if (user.profileImage) {
      return getProfileImageUrl(user.profileImage);
    }
    return null;
  };

  const getInitials = () => {
    const name = getDisplayName();
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-6 pb-20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Photo - Overlapping */}
        <div className="relative -mt-16 flex justify-center mb-4">
          <div className="relative">
            {getAvatarUrl() ? (
              <img
                src={getAvatarUrl()!}
                alt={getDisplayName()}
                className="w-32 h-32 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-xl"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-gray-800 shadow-xl">
                {getInitials()}
              </div>
            )}
          </div>
        </div>

        {/* User Details */}
        <div className="px-6 pb-6 space-y-4">
          {/* Name */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {getDisplayName()}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              @{user.username}
            </p>
          </div>

          {/* Info Cards */}
          <div className="space-y-3 pt-4">
            {/* UID */}
            {user.uid && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">User ID</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.uid}
                  </p>
                </div>
              </div>
            )}

            {/* Email */}
            {user.email && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            )}

            {/* Employee Info */}
            {user.employee && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Employee</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.employee.designation || user.employee.displayName || user.employee.empId}
                  </p>
                  {user.employee.empId && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      ID: {user.employee.empId}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Student Info */}
            {user.student && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Student</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {user.student.displayName || user.student.registrationNo}
                  </p>
                  {user.student.program && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.student.program}
                      {user.student.semester && ` - Sem ${user.student.semester}`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* User Type Badge */}
            {user.userType && (
              <div className="flex justify-center pt-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  user.userType ===
   'admin' 
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    : user.userType ===
   'faculty'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    : user.userType ===
   'staff'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }`}>
                  {user.userType.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
