/**
 * Message Input Component
 * Input area for sending messages
 */
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { VoiceRecorder } from './VoiceRecorder';
import { EmojiPicker } from './EmojiPicker';
import { FileUpload } from './FileUpload';
import * as chatService from '../services/chat.service';
import type { FileUploadResult } from '../types';

interface MessageInputProps {
  onSendMessage: (data: {
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
  }) => void;
  onTyping: () => void;
  onStopTyping: () => void;
}

export function MessageInput({ onSendMessage, onTyping, onStopTyping }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    currentGroupId,
    currentDMUserId,
    currentGroup,
    replyingTo,
    isSending,
    setReplyingTo,
    setSending,
  } = useChatStore();

  // Check permissions
  const canSendMessage = currentGroup?.myPermissions?.canSendMessage ?? true;
  const canSendVoice = currentGroup?.myPermissions?.canSendVoice ?? true;
  const canUploadFiles = currentGroup?.myPermissions?.canUploadFiles ?? true;
  const canSendEmoji = currentGroup?.myPermissions?.canSendEmoji ?? true;

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    onTyping();
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping();
    }, 2000);
  }, [onTyping, onStopTyping]);

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Handle message input change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    handleTyping();
  };

  // Auto resize textarea
  const handleInput = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  };

  // Send text message
  const handleSend = () => {
    if (!message.trim() || isSending) return;

    const messageData: Parameters<typeof onSendMessage>[0] = {
      content: message.trim(),
      messageType: 'text',
    };

    if (replyingTo) {
      messageData.replyToId = replyingTo.id;
    }

    // Extract mentions
    const mentionRegex = /@(\w+)/g;
    const mentions = message.match(mentionRegex)?.map((m) => m.slice(1)) || [];
    if (mentions.length > 0) {
      messageData.mentions = mentions;
    }

    onSendMessage(messageData);
    setMessage('');
    setReplyingTo(null);
    onStopTyping();
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  // Handle keyboard submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!currentGroupId && !currentDMUserId) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let result: FileUploadResult;

      if (currentGroupId) {
        result = await chatService.uploadGroupFile(currentGroupId, file);
      } else if (currentDMUserId) {
        result = await chatService.uploadDirectFile(currentDMUserId, file);
      } else {
        return;
      }

      onSendMessage({
        content: message.trim() || undefined,
        messageType: result.messageType || 'file',
        filePath: result.filePath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        replyToId: replyingTo?.id,
      });

      setMessage('');
      setReplyingTo(null);
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle voice message
  const handleVoiceSend = async (audioBlob: Blob) => {
    if (!currentGroupId && !currentDMUserId) return;

    setIsUploading(true);

    try {
      let result: FileUploadResult;

      if (currentGroupId) {
        result = await chatService.uploadGroupVoice(currentGroupId, audioBlob);
      } else if (currentDMUserId) {
        result = await chatService.uploadDirectVoice(currentDMUserId, audioBlob);
      } else {
        return;
      }

      onSendMessage({
        messageType: 'voice',
        filePath: result.filePath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        duration: result.duration,
        waveformData: result.waveformData,
        replyToId: replyingTo?.id,
      });

      setReplyingTo(null);
      setShowVoice(false);
    } catch (error) {
      console.error('Voice upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Check if messaging is disabled
  const isDisabled = !canSendMessage || (!currentGroupId && !currentDMUserId);

  if (showVoice && canSendVoice) {
    return (
      <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-4">
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={() => setShowVoice(false)}
          isUploading={isUploading}
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-4 pt-2 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border-l-2 border-[#6497b1] mx-4 mt-2 rounded-lg">
          <div className="flex-1 min-w-0 py-1.5">
            <p className="text-xs text-[#005b96] dark:text-[#6497b1] font-medium">
              Replying to {replyingTo.sender?.employeeDetails?.firstName || 
                          replyingTo.sender?.studentLogin?.firstName || 
                          'User'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
              {replyingTo.content || `[${replyingTo.messageType}]`}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full ml-2"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="px-4 py-1.5 flex items-center gap-2">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-[#005b96] border-t-transparent" />
          <span className="text-xs text-[#005b96]">Uploading...</span>
        </div>
      )}

      {/* Input Row */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* + Button (File Upload) */}
        <div className="flex-shrink-0">
          {canUploadFiles ? (
            <FileUpload
              onFileSelect={handleFileUpload}
              disabled={isDisabled || isUploading}
            />
          ) : (
            <button
              disabled
              className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center opacity-40"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {/* Pill Input */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleChange}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isDisabled ? "You can't send messages here" : "Your message..."}
            disabled={isDisabled || isUploading}
            className="w-full px-5 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-[#6497b1]/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm leading-relaxed"
            rows={1}
            style={{ maxHeight: '120px' }}
          />

          {/* Emoji Picker */}
          {showEmoji && (
            <div className="absolute bottom-full right-0 mb-2 z-50">
              <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />
            </div>
          )}
        </div>

        {/* Right Action Button */}
        {message.trim() ? (
          /* Send Button */
          <button
            onClick={handleSend}
            disabled={isDisabled || isSending}
            className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{background:'linear-gradient(135deg,#005b96 0%,#6497b1 100%)'}}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        ) : canSendVoice ? (
          /* Voice Button */
          <button
            onClick={() => setShowVoice(true)}
            disabled={isDisabled || isUploading}
            className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50"
            style={{background:'linear-gradient(135deg,#005b96 0%,#6497b1 100%)'}}
          >
            {/* Sparkle icon */}
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6z" />
            </svg>
          </button>
        ) : (
          /* Emoji button fallback */
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            disabled={isDisabled}
            className="w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50"
            style={{background:'linear-gradient(135deg,#005b96 0%,#6497b1 100%)'}}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
