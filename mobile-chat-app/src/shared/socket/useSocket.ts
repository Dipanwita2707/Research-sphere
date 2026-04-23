import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatAuthStore } from '../state/chatAuthStore';
import { useChatStore } from '../state/chatStore';
import { serverConfig } from '../config/serverConfig';
import type { ChatMessage, DirectMessage, ChatGroup } from '../../types/chat.types';

// Dynamic — set from AsyncStorage at startup
let SOCKET_URL = 'http://localhost:5001';

/** Called by serverConfig.setServerUrl() to keep socket URL in sync */
export function updateSocketUrl(baseUrl: string) {
  SOCKET_URL = baseUrl;
  // If a socket is open, reconnect to new URL
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

// Initialise from AsyncStorage on module load
serverConfig.getServerUrlOrDefault().then((url) => {
  SOCKET_URL = url;
});

let socketInstance: Socket | null = null;

export function useSocket() {
  const isAuthenticated = useChatAuthStore((s) => s.isAuthenticated);
  const getChatToken = useChatAuthStore((s) => s.getChatToken);
  const refreshChatToken = useChatAuthStore((s) => s.refreshChatToken);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        socketInstance = null;
      }
      return;
    }

    const token = getChatToken();
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    socketInstance = socket;

    const store = useChatStore.getState;

    // --- Group messages ---
    socket.on('newMessage', (data: { groupId: string; message: ChatMessage }) => {
      store().addMessage(data.groupId, data.message);
    });

    socket.on('messageEdited', (data: { groupId: string; message: ChatMessage }) => {
      store().updateMessage(data.groupId, data.message);
    });

    socket.on('messageDeleted', (data: { groupId: string; messageId: string }) => {
      store().removeMessage(data.groupId, data.messageId);
    });

    socket.on('messagesRead', (data: { groupId: string; userId: string; messageIds: string[]; readAt: string }) => {
      store().updateReadReceipts(data.groupId, data.userId, data.messageIds, data.readAt);
    });

    // --- Direct messages ---
    socket.on('newDirectMessage', (data: { message: DirectMessage }) => {
      const myId = useChatAuthStore.getState().chatUser?.id;
      const otherUserId = data.message.senderId === myId ? data.message.receiverId : data.message.senderId;
      store().addDirectMessage(otherUserId, data.message);
    });

    socket.on('dmRead', (data: { userId: string; readAt: string }) => {
      store().updateDirectMessageRead(data.userId, data.readAt);
    });

    // --- Typing ---
    socket.on('userTyping', (data: { groupId: string; userId: string; userName: string }) => {
      store().setTypingUsers(data.groupId, { userId: data.userId, userName: data.userName });
    });

    socket.on('userStoppedTyping', (data: { groupId: string; userId: string }) => {
      store().removeTypingUser(data.groupId, data.userId);
    });

    socket.on('userTypingDM', (data: { userId: string; userName: string }) => {
      store().setDMTypingUser(data.userId, { userId: data.userId, userName: data.userName });
    });

    socket.on('userStoppedTypingDM', (data: { userId: string }) => {
      store().removeDMTypingUser(data.userId);
    });

    // --- Presence ---
    socket.on('userOnline', (data: { userId: string }) => {
      store().addOnlineUser(data.userId);
    });

    socket.on('userOffline', (data: { userId: string }) => {
      store().removeOnlineUser(data.userId);
    });

    // --- Group lifecycle ---
    socket.on('joinedGroup', (data: { group: ChatGroup }) => {
      store().addGroup(data.group);
    });

    socket.on('leftGroup', (data: { groupId: string }) => {
      store().removeGroup(data.groupId);
    });

    // --- Connection management ---
    socket.on('connect_error', async (err) => {
      if (err.message?.includes('401') || err.message?.includes('unauthorized') || err.message?.includes('jwt')) {
        const newToken = await refreshChatToken();
        if (newToken) {
          socket.auth = { token: newToken };
          socket.connect();
        }
      }
    });

    socket.on('chatError', (data: { message: string }) => {
      console.warn('Chat socket error:', data.message);
    });

    // Heartbeat
    heartbeatRef.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 30000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      socket.disconnect();
      socketRef.current = null;
      socketInstance = null;
    };
  }, [isAuthenticated]);

  // Emit helpers
  const emitSendMessage = useCallback(
    (data: { groupId: string; content?: string; messageType?: string; filePath?: string; fileName?: string; fileSize?: number; mimeType?: string; duration?: number; waveformData?: number[]; replyToId?: string }) => {
      socketInstance?.emit('sendMessage', data);
    },
    [],
  );

  const emitSendDM = useCallback(
    (data: { receiverId: string; content?: string; messageType?: string; filePath?: string; fileName?: string; fileSize?: number; mimeType?: string; duration?: number; waveformData?: number[]; replyToId?: string }) => {
      socketInstance?.emit('sendDirectMessage', data);
    },
    [],
  );

  const emitTyping = useCallback((groupId: string) => {
    socketInstance?.emit('typing', { groupId });
  }, []);

  const emitStopTyping = useCallback((groupId: string) => {
    socketInstance?.emit('stopTyping', { groupId });
  }, []);

  const emitTypingDM = useCallback((userId: string) => {
    socketInstance?.emit('typingDM', { userId });
  }, []);

  const emitStopTypingDM = useCallback((userId: string) => {
    socketInstance?.emit('stopTypingDM', { userId });
  }, []);

  const emitMarkAsRead = useCallback((groupId: string) => {
    socketInstance?.emit('markAsRead', { groupId });
  }, []);

  const emitMarkDMAsRead = useCallback((userId: string) => {
    socketInstance?.emit('markDMAsRead', { userId });
  }, []);

  const emitJoinGroup = useCallback((groupId: string) => {
    socketInstance?.emit('joinGroup', { groupId });
  }, []);

  const emitLeaveGroup = useCallback((groupId: string) => {
    socketInstance?.emit('leaveGroup', { groupId });
  }, []);

  return {
    socket: socketRef.current,
    emitSendMessage,
    emitSendDM,
    emitTyping,
    emitStopTyping,
    emitTypingDM,
    emitStopTypingDM,
    emitMarkAsRead,
    emitMarkDMAsRead,
    emitJoinGroup,
    emitLeaveGroup,
  };
}
