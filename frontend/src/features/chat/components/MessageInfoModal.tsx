/**
 * Message Info Modal
 * WhatsApp-style message info showing read receipts
 */
'use client';

import React from 'react';
import { format } from 'date-fns';
import { getProfileImageUrl } from '../services/chat.service';
import type { ChatMessage, ChatGroup, ReadReceipt } from '../types';

interface MessageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage;
  group?: ChatGroup;
}

export function MessageInfoModal({ isOpen, onClose, message, group }: MessageInfoModalProps) {
  if (!isOpen) return null;

  const totalMembers = group?._count?.members || group?.members?.length || 0;
  const readBy = message.readBy || [];
  const readCount = readBy.length;
  const deliveredCount = totalMembers - 1; // Exclude sender
  const pendingCount = deliveredCount - readCount;

  const getMemberName = (userId: string) => {
    const member = group?.members?.find(m => m.userId === userId);
    if (!member?.user) return 'Unknown User';
    
    if (member.user.employeeDetails) {
      return member.user.employeeDetails.displayName || 
        `${member.user.employeeDetails.firstName || ''} ${member.user.employeeDetails.lastName || ''}`.trim();
    }
    if (member.user.studentLogin) {
      return `${member.user.studentLogin.firstName || ''} ${member.user.studentLogin.lastName || ''}`.trim();
    }
    return member.user.uid || 'Unknown User';
  };

  const getMemberAvatar = (userId: string) => {
    const member = group?.members?.find(m => m.userId === userId);
    return member?.user?.profileImage ? getProfileImageUrl(member.user.profileImage) : null;
  };

  const getInitials = (userId: string) => {
    const name = getMemberName(userId);
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get members who haven't read the message
  const unreadMembers = group?.members?.filter(
    m => m.userId !== message.senderId && !readBy.find(r => r.userId === m.userId)
  ) || [];

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Message Info
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-64px)]">
          {/* Message Preview */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50">
            <div className="bg-blue-600 text-white rounded-lg p-3 max-w-[80%] ml-auto">
              <p className="text-sm">{message.content || `[${message.messageType}]`}</p>
              <p className="text-[10px] text-blue-200 mt-1">
                {format(new Date(message.createdAt), 'HH:mm')}
              </p>
            </div>
          </div>

          {/* Read By Section */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
              </svg>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                Read by {readCount}
              </span>
            </div>

            {readBy.length > 0 ? (
              <div className="space-y-2">
                {readBy.map((receipt: ReadReceipt) => (
                  <div 
                    key={receipt.userId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    {getMemberAvatar(receipt.userId) ? (
                      <img
                        src={getMemberAvatar(receipt.userId)!}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                        {getInitials(receipt.userId)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {getMemberName(receipt.userId)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Read at {format(new Date(receipt.readAt), 'MMM d, HH:mm')}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                    </svg>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No one has read this message yet
              </p>
            )}
          </div>

          {/* Delivered To Section (pending reads) */}
          {unreadMembers.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                </svg>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Delivered to {unreadMembers.length}
                </span>
              </div>

              <div className="space-y-2">
                {unreadMembers.map((member) => (
                  <div 
                    key={member.userId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    {member.user?.profileImage ? (
                      <img
                        src={getProfileImageUrl(member.user.profileImage) || member.user.profileImage}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-sm font-medium">
                        {getInitials(member.userId)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {getMemberName(member.userId)}
                      </p>
                      <p className="text-xs text-gray-500">
                        Not read yet
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
