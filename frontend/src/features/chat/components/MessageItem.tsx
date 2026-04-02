/**
 * Message Item Component
 * WhatsApp-style individual message in the chat
 */
'use client';

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '@/shared/auth/authStore';
import { VoiceMessage } from './VoiceMessage';
import { FilePreview } from './FilePreview';
import { MessageInfoModal } from './MessageInfoModal';
import { UserProfileModal } from './UserProfileModal';
import { getChatFileUrl } from '../services/chat.service';
import * as chatService from '../services/chat.service';
import type { ChatMessage, DirectMessage, ChatGroup } from '../types';

interface MessageItemProps {
  message: ChatMessage | DirectMessage;
  isGroupChat: boolean;
  showAvatar: boolean;
  group?: ChatGroup;
}

// Message Status Types
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export function MessageItem({ message, isGroupChat, showAvatar, group }: MessageItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showMessageInfo, setShowMessageInfo] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showSenderProfile, setShowSenderProfile] = useState(false);
  const [localReactions, setLocalReactions] = useState<Record<string, string[]>>({});
  const { setReplyingTo, removeMessage, removeDirectMessage, currentGroupId, currentDMUserId } = useChatStore();
  const authUser = useAuthStore((s) => s.user);

  // Get current user ID from auth store
  const currentUserId = authUser?.id ?? null;

  const isOwnMessage = message.senderId ===
   currentUserId;
  const sender = message.sender;

  // Determine message status for own messages
  const getMessageStatus = (): MessageStatus => {
    if (!isOwnMessage) return 'read';
    
    // For group messages
    if ('readBy' in message && isGroupChat) {
      const readBy = (message as ChatMessage).readBy || [];
      const totalMembers = group?._count?.members || group?.members?.length || 1;
      
      if (readBy.length >= totalMembers - 1 && readBy.length > 0) {
        return 'read';
      }
      if (readBy.length > 0) {
        return 'read';
      }
      if (message.id) {
        return 'delivered';
      }
      return 'sending';
    }
    
    // For direct messages
    if (!isGroupChat) {
      if (!message.id) {
        return 'sending';
      }
      if ('readAt' in message && (message as DirectMessage).readAt) {
        return 'read';
      }
      return 'delivered';
    }
    
    return 'sent';
  };

  const messageStatus = getMessageStatus();

  // Check if all members have read (for blue ticks)
  const isReadByAll = useMemo(() => {
    if (!isOwnMessage || !isGroupChat) return false;
    if (!('readBy' in message)) return false;
    
    const readBy = (message as ChatMessage).readBy || [];
    const totalMembers = group?._count?.members || group?.members?.length || 1;
    return readBy.length >= totalMembers - 1 && readBy.length > 0;
  }, [isOwnMessage, isGroupChat, message, group]);

  // Render WhatsApp-style status ticks
  const renderStatusTicks = () => {
    if (!isOwnMessage) return null;

    // Sending: Clock icon
    if (messageStatus ===
   'sending') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2" />
        </svg>
      );
    }

    // Sent: Single tick
    if (messageStatus ===
   'sent') {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
        </svg>
      );
    }

    // Delivered/Read: Double ticks
    // Blue for group read, green for DM read
    const isRead = isReadByAll || messageStatus ===
   'read';
    const tickColor = isRead 
      ? (isGroupChat ? 'text-blue-400' : 'text-green-500')
      : 'text-gray-400 dark:text-gray-500';
    return (
      <svg className={`w-4 h-4 ${tickColor}`} fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
      </svg>
    );
  };

  const getSenderName = () => {
    if (!sender) return 'Unknown';
    if (sender.employeeDetails) {
      return sender.employeeDetails.displayName || 
        `${sender.employeeDetails.firstName || ''} ${sender.employeeDetails.lastName || ''}`.trim();
    }
    if (sender.studentLogin) {
      return `${sender.studentLogin.firstName || ''} ${sender.studentLogin.lastName || ''}`.trim();
    }
    return sender.uid || 'Unknown';
  };

  const getAvatarUrl = () => {
    // For own messages, use fresh profile image from auth store (not stale sender data)
    if (isOwnMessage && authUser?.profileImageUrl) {
      const { getProfileImageUrl } = require('../services/chat.service');
      return getProfileImageUrl(authUser.profileImageUrl);
    }
    if (sender?.profileImage) {
      const { getProfileImageUrl } = require('../services/chat.service');
      return getProfileImageUrl(sender.profileImage);
    }
    return null;
  };

  const getInitials = () => {
    const name = getSenderName();
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle message actions
  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setShowContextMenu(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this message?')) {
      try {
        if (isGroupChat && currentGroupId) {
          await chatService.deleteMessage(message.id);
          removeMessage(currentGroupId, message.id);
        } else if (currentDMUserId) {
          await chatService.deleteDirectMessage(message.id);
          removeDirectMessage(currentDMUserId, message.id);
        }
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
      setShowContextMenu(false);
    }
  };

  const handleForward = () => {
    // TODO: Implement forward message functionality
    setShowContextMenu(false);
  };

  const handleStar = () => {
    // TODO: Implement star message functionality
    setShowContextMenu(false);
  };

  const handlePin = () => {
    // TODO: Implement pin message functionality
    setShowContextMenu(false);
  };

  // Handle adding/toggling a reaction
  const handleReaction = (emoji: string) => {
    if (!currentUserId) return;
    setLocalReactions((prev) => {
      const existing = prev[emoji] || [];
      if (existing.includes(currentUserId)) {
        // Remove reaction
        const updated = existing.filter((id) => id !== currentUserId);
        if (updated.length ===
   0) {
          const { [emoji]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [emoji]: updated };
      }
      // Add reaction
      return { ...prev, [emoji]: [...existing, currentUserId] };
    });
    setShowMenu(false);
    setShowContextMenu(false);
  };

  const renderContent = () => {
    if (message.isDeleted) {
      return (
        <span className="italic text-gray-400 dark:text-gray-500 text-sm">
          This message was deleted
        </span>
      );
    }

    switch (message.messageType) {
      case 'voice':
        return (
          <VoiceMessage
            audioUrl={getChatFileUrl(message.filePath!)}
            duration={message.duration}
            waveformData={message.waveformData}
            isOwnMessage={isOwnMessage}
          />
        );

      case 'image':
        return (
          <div className="max-w-xs">
            <img
              src={getChatFileUrl(message.filePath!)}
              alt={message.fileName || 'Image'}
              className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
            />
            {message.content && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="max-w-xs">
            <video
              src={getChatFileUrl(message.filePath!)}
              controls
              className="rounded-lg max-w-full"
            />
            {message.content && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'file':
      case 'document':
        return (
          <FilePreview
            fileName={message.fileName!}
            fileSize={message.fileSize!}
            mimeType={message.mimeType!}
            fileUrl={getChatFileUrl(message.filePath!)}
          />
        );

      default:
        return (
          <div>
            {/* Reply Preview */}
            {message.replyTo && (
              <div className="mb-2 pl-2 border-l-2 border-blue-400 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">
                  {('sender' in message.replyTo && message.replyTo.sender?.employeeDetails?.firstName) || 
                   ('sender' in message.replyTo && message.replyTo.sender?.studentLogin?.firstName) || 
                   'User'}
                </span>
                <p className="truncate">
                  {message.replyTo.content || `[${message.replyTo.messageType}]`}
                </p>
              </div>
            )}
            
            {/* Text Content */}
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        );
    }
  };

  return (
    <div
      className={`flex gap-2 py-0.5 group relative ${
        isOwnMessage ? 'flex-row-reverse justify-start' : 'flex-row justify-start'
      }`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Avatar */}
      {isOwnMessage && showAvatar ? (
        <button
          onClick={() => setShowSenderProfile(true)}
          className="w-10 h-10 flex-shrink-0 hover:opacity-80 transition-opacity self-end"
          title="View profile"
        >
          {getAvatarUrl() ? (
            <img
              src={getAvatarUrl()!}
              alt={getSenderName()}
              className="w-10 h-10 rounded-full object-cover cursor-pointer shadow-sm border-2 border-white/40"
            />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-medium cursor-pointer shadow-sm border-2 border-white/40 bg-[#005b96]/80 backdrop-blur-md">
              {getInitials()}
            </div>
          )}
        </button>
      ) : isOwnMessage ? (
        <div className="w-10 flex-shrink-0" />
      ) : !isOwnMessage && showAvatar ? (
        <button
          onClick={() => setShowSenderProfile(true)}
          className="w-10 h-10 flex-shrink-0 hover:opacity-80 transition-opacity self-end"
          title="View profile"
        >
          {getAvatarUrl() ? (
            <img
              src={getAvatarUrl()!}
              alt={getSenderName()}
              className="w-10 h-10 rounded-full object-cover cursor-pointer shadow-sm border-2 border-white/40"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border-2 border-white/40 flex items-center justify-center text-gray-800 dark:text-white text-xs font-medium cursor-pointer shadow-sm">
              {getInitials()}
            </div>
          )}
        </button>
      ) : !isOwnMessage ? (
        <div className="w-10 flex-shrink-0" />
      ) : null}

      {/* Message Bubble */}
      <div
        className={`max-w-[70%] relative p-1.5 bg-white/70 dark:bg-gray-800/70 backdrop-blur-2xl border-2 border-white/80 dark:border-gray-700/80 shadow-[10px_10px_20px_rgba(0,0,0,0.05),-10px_-10px_20px_rgba(255,255,255,0.8)] dark:shadow-[10px_10px_20px_rgba(0,0,0,0.4),-5px_-5px_15px_rgba(255,255,255,0.05)] ${
          isOwnMessage ? 'rounded-[2rem] rounded-tr-md' : 'rounded-[2rem] rounded-tl-md'
        }`}
      >
        <div
          className={`${
            isOwnMessage
              ? 'bg-gradient-to-br from-[#6497b1] to-[#005b96] text-white shadow-[inset_2px_2px_5px_rgba(255,255,255,0.4),inset_-2px_-2px_5px_rgba(0,0,0,0.2)] rounded-[1.5rem] rounded-tr-sm'
              : 'bg-white/50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[inset_2px_2px_5px_rgba(255,255,255,0.1),inset_-2px_-2px_5px_rgba(0,0,0,0.2)] rounded-[1.5rem] rounded-tl-sm'
          } px-4 py-2.5`}
        >
          {/* Sender Name (Group chat, not own message) */}
          {!isOwnMessage && showAvatar && isGroupChat && (
            <p className="text-xs font-semibold text-[#005b96] dark:text-[#6497b1] mb-1">
              {getSenderName()}
            </p>
          )}

          {/* Message Content */}
          {renderContent()}

          {/* Timestamp & Status */}
          <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
            isOwnMessage ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'
          }`}>
            <span>{format(new Date(message.createdAt), 'h:mm a')}</span>
            {message.isEdited && <span>(edited)</span>}
            
            {/* Status ticks */}
            <span className="ml-0.5 flex items-center">
              {renderStatusTicks()}
            </span>
          </div>

          {/* Emoji Reactions Display */}
          {Object.keys(localReactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 -mb-1">
              {Object.entries(localReactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                    users.includes(currentUserId || '')
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600'
                      : 'bg-gray-100 dark:bg-gray-600 border-gray-200 dark:border-gray-500'
                  }`}
                >
                  <span>{emoji}</span>
                  {users.length > 1 && <span className="text-[10px] text-gray-600 dark:text-gray-300">{users.length}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Menu - WhatsApp style with emoji reactions */}
      {showMenu && !message.isDeleted && (
        <div className={`flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
          isOwnMessage ? 'order-last ml-1' : 'order-last ml-1'
        }`}>
          {/* Quick Emoji Reactions */}
          <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-1.5 py-0.5">
            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="p-1 hover:scale-125 transition-transform text-base"
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setReplyingTo(message)}
              className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
              title="Reply"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            
            {/* More Options Button */}
            <button
              onClick={() => setShowContextMenu(!showContextMenu)}
              className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
              title="More"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp-style Context Menu */}
      {showContextMenu && !message.isDeleted && (
        <div className={`absolute z-50 mt-2 w-56 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-1 ${
          isOwnMessage ? 'left-0' : 'left-0'
        }`}
          style={{ top: '100%' }}
          onMouseLeave={() => setShowContextMenu(false)}
        >
          {/* Emoji Reaction Strip at top */}
          <div className="flex items-center justify-around px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="p-1 hover:scale-125 transition-transform text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Reply */}
          <button
            onClick={() => {
              setReplyingTo(message);
              setShowContextMenu(false);
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span>Reply</span>
          </button>

          {/* Copy */}
          {message.content && (
            <button
              onClick={handleCopy}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </button>
          )}

          {/* Forward */}
          <button
            onClick={handleForward}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span>Forward</span>
          </button>

          {/* Pin (groups only) */}
          {isGroupChat && (
            <button
              onClick={handlePin}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span>Pin</span>
            </button>
          )}

          {/* Star */}
          <button
            onClick={handleStar}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span>Star</span>
          </button>

          {/* Message Info (for own messages) */}
          {isOwnMessage && (
            <button
              onClick={() => {
                setShowMessageInfo(true);
                setShowContextMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Message info</span>
            </button>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

          {/* Delete (only for own messages) */}
          {isOwnMessage && (
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete</span>
            </button>
          )}
        </div>
      )}

      {/* Message Info Modal */}
      {showMessageInfo && isGroupChat && 'readBy' in message && (
        <MessageInfoModal
          isOpen={showMessageInfo}
          message={message as ChatMessage}
          group={group}
          onClose={() => setShowMessageInfo(false)}
        />
      )}

      {/* DM Message Info - simple status display */}
      {showMessageInfo && !isGroupChat && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowMessageInfo(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-80 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Message Info</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sent</p>
                  <p className="text-xs text-gray-500">{format(new Date(message.createdAt), 'dd/MM/yyyy, HH:mm')}</p>
                </div>
              </div>
              {message.id && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivered</p>
                    <p className="text-xs text-gray-500">{format(new Date(message.createdAt), 'dd/MM/yyyy, HH:mm')}</p>
                  </div>
                </div>
              )}
              {'readAt' in message && (message as DirectMessage).readAt && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Read</p>
                    <p className="text-xs text-gray-500">{format(new Date((message as DirectMessage).readAt!), 'dd/MM/yyyy, HH:mm')}</p>
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowMessageInfo(false)}
              className="mt-4 w-full py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Sender Profile Modal */}
      {showSenderProfile && sender && (
        <UserProfileModal
          isOpen={showSenderProfile}
          user={isOwnMessage && authUser ? {
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
          } : {
            id: sender.id,
            username: sender.uid || 'Unknown',
            firstName: sender.employeeDetails?.firstName || sender.studentLogin?.firstName,
            lastName: sender.employeeDetails?.lastName || sender.studentLogin?.lastName,
            email: sender.email,
            uid: sender.uid,
            profileImage: sender.profileImage,
            userType: undefined,
            employee: sender.employeeDetails ? {
              empId: undefined,
              designation: undefined,
              displayName: sender.employeeDetails.displayName,
            } : undefined,
            student: sender.studentLogin ? {
              studentId: undefined,
              registrationNo: undefined,
              program: undefined,
              semester: undefined,
            } : undefined,
          }}
          onClose={() => setShowSenderProfile(false)}
        />
      )}
    </div>
  );
}
