'use client';

/**
 * Socket.io Hook for Chat
 * Manages WebSocket connection and event handling
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/chatStore';
import { useChatAuthStore } from '@/shared/auth/chatAuthStore';
import type { ChatMessage, DirectMessage, ChatUser, TypingUser } from '../types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001';

interface UseSocketOptions {
  enabled?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { enabled = true, onConnect, onDisconnect, onError } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const { getChatToken: getToken, chatAccessToken } = useChatAuthStore();

  const {
    addMessage,
    updateMessage,
    removeMessage,
    updateReadReceipts,
    addDirectMessage,
    updateDirectMessageRead,
    setTypingUsers,
    removeTypingUser,
    setDMTypingUser,
    removeDMTypingUser,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
  } = useChatStore();

  // Initialize socket connection
  useEffect(() => {
    if (!enabled) return;

    // Get token from authStore or fallback to cookie
    const token = getToken() || 
      document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];

    if (!token) {
      console.warn('No auth token found for socket connection');
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
      onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      onDisconnect?.();
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionError(error);
      onError?.(error);
    });

    // Group message events
    socket.on('newMessage', (data: { groupId: string; message: ChatMessage }) => {
      addMessage(data.groupId, data.message);
    });

    socket.on('messageEdited', (data: { groupId: string; message: ChatMessage }) => {
      updateMessage(data.groupId, data.message);
    });

    socket.on('messageDeleted', (data: { groupId: string; messageId: string }) => {
      removeMessage(data.groupId, data.messageId);
    });

    socket.on('messagesRead', (data: { groupId: string; userId: string; messageIds: string[]; readAt: string }) => {
      updateReadReceipts(data.groupId, data.userId, data.messageIds, data.readAt);
    });

    // Direct message events
    socket.on('newDirectMessage', (data: { message: DirectMessage }) => {
      // Determine the other user: if I sent it, the other user is the receiver; otherwise the sender
      const currentUserId = useChatAuthStore.getState().chatUser?.id ?? null;
      const otherUserId = data.message.senderId ===
   currentUserId 
        ? data.message.receiverId 
        : data.message.senderId;
      addDirectMessage(otherUserId, data.message);
    });

    socket.on('dmRead', (data: { readBy: string; readAt: string }) => {
      // readBy is the userId who read the messages (the other user)
      // Update messages in the conversation with that user
      updateDirectMessageRead(data.readBy, data.readAt);
    });

    // Typing events
    socket.on('userTyping', (data: { groupId: string; userId: string; user: { id: string; firstName?: string } }) => {
      setTypingUsers(data.groupId, { userId: data.userId, user: data.user });
    });

    socket.on('userStoppedTyping', (data: { groupId: string; userId: string }) => {
      removeTypingUser(data.groupId, data.userId);
    });

    socket.on('userTypingDM', (data: { userId: string; user: { id: string; firstName?: string } }) => {
      setDMTypingUser(data.userId, { userId: data.userId, user: data.user });
    });

    socket.on('userStoppedTypingDM', (data: { userId: string }) => {
      removeDMTypingUser(data.userId);
    });

    // Presence events
    socket.on('userOnline', (data: { userId: string; user: ChatUser }) => {
      addOnlineUser(data.userId);
    });

    socket.on('userOffline', (data: { userId: string; lastSeenAt: string }) => {
      removeOnlineUser(data.userId);
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    enabled,
    chatAccessToken,
    getToken,
    onConnect,
    onDisconnect,
    onError,
    addMessage,
    updateMessage,
    removeMessage,
    updateReadReceipts,
    addDirectMessage,
    updateDirectMessageRead,
    setTypingUsers,
    removeTypingUser,
    setDMTypingUser,
    removeDMTypingUser,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
  ]);

  // Join a group room
  const joinGroup = useCallback((groupId: string) => {
    socketRef.current?.emit('joinGroup', { groupId });
  }, []);

  // Leave a group room
  const leaveGroup = useCallback((groupId: string) => {
    socketRef.current?.emit('leaveGroup', { groupId });
  }, []);

  // Send a message via socket
  const sendMessage = useCallback((data: {
    groupId: string;
    content?: string;
    encryptedContent?: string;
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
    socketRef.current?.emit('sendMessage', data);
  }, []);

  // Send a direct message via socket
  const sendDirectMessage = useCallback((data: {
    receiverId: string;
    content?: string;
    encryptedContent?: string;
    messageType?: string;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
    waveformData?: number[];
    replyToId?: string;
  }) => {
    socketRef.current?.emit('sendDirectMessage', data);
  }, []);

  // Mark messages as read
  const markRead = useCallback((data: { groupId: string; messageIds: string[] }) => {
    socketRef.current?.emit('markRead', data);
  }, []);

  // Mark direct messages as read
  const markDMRead = useCallback((data: { otherUserId: string; messageIds: string[] }) => {
    socketRef.current?.emit('markDMRead', data);
  }, []);

  // Send typing indicator
  const sendTyping = useCallback((groupId: string) => {
    socketRef.current?.emit('typing', { groupId });
  }, []);

  // Send stop typing indicator
  const sendStopTyping = useCallback((groupId: string) => {
    socketRef.current?.emit('stopTyping', { groupId });
  }, []);

  // Send typing indicator for DM
  const sendTypingDM = useCallback((receiverId: string) => {
    socketRef.current?.emit('typingDM', { receiverId });
  }, []);

  // Send stop typing indicator for DM
  const sendStopTypingDM = useCallback((receiverId: string) => {
    socketRef.current?.emit('stopTypingDM', { receiverId });
  }, []);

  return {
    socket: socketRef.current,
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
  };
}
