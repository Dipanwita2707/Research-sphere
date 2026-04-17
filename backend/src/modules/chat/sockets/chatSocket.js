/**
 * Chat Socket Handler
 * Handles real-time messaging via Socket.io
 */
const prisma = require('../../../shared/config/database');
const presenceService = require('../services/presence.service');
const messageService = require('../services/message.service');
const dmService = require('../services/directMessage.service');
const { checkPermission, isGroupMember } = require('../utils/permissions');

// Store for typing indicators (userId -> { groupId, timeout })
const typingUsers = new Map();

/**
 * Initialize chat socket handlers
 */
const initChatSocket = (io) => {
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const user = socket.user;
    let groupIds = [];

    console.log(`🔌 User connected: ${user.uid} (${socket.id})`);
    try {
      // Set user online
      await presenceService.setUserOnline(userId, socket.id);

      // Get user's groups and join rooms
      const userGroups = await prisma.chatGroupMember.findMany({
        where: { userId },
        select: { groupId: true },
      });

      groupIds = userGroups.map((g) => g.groupId);
      groupIds.forEach((groupId) => {
        socket.join(`group:${groupId}`);
      });

      // Also join personal room for DMs
      socket.join(`user:${userId}`);

      // Broadcast online status to all groups
      groupIds.forEach((groupId) => {
        socket.to(`group:${groupId}`).emit('userOnline', {
          userId,
          user: {
            id: user.id,
            uid: user.uid,
            firstName: user.employeeDetails?.firstName || user.studentLogin?.firstName,
            lastName: user.employeeDetails?.lastName || user.studentLogin?.lastName,
          },
        });
      });
    } catch (error) {
      console.error('Chat socket init failed:', error.message);
      socket.emit('chatError', {
        message: 'Chat is temporarily unavailable. Please try again shortly.',
      });
      return;
    }

    // ============ GROUP MESSAGE EVENTS =====
    /**
     * Send message to group
     */
    socket.on('sendMessage', async (data, callback) => {
      try {
        const { groupId, content, encryptedContent, messageType, filePath, fileName, fileSize, mimeType, duration, waveformData, replyToId, mentions } = data;

        // Check permissions and send
        const message = await messageService.sendMessage(groupId, userId, {
          content,
          encryptedContent,
          messageType: messageType || 'text',
          filePath,
          fileName,
          fileSize,
          mimeType,
          duration,
          waveformData,
          replyToId,
          mentions,
        });

        // Broadcast to group
        io.to(`group:${groupId}`).emit('newMessage', {
          groupId,
          message,
        });

        // Send notifications to offline members
        const offlineMembers = await getOfflineGroupMembers(groupId, userId);
        await createNotificationsForMembers(offlineMembers, message, groupId);

        // Clear typing indicator
        clearTyping(userId, groupId);

        if (callback) callback({ success: true, message });
      } catch (error) {
        console.error('sendMessage error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Edit message
     */
    socket.on('editMessage', async (data, callback) => {
      try {
        const { messageId, content } = data;

        const message = await messageService.editMessage(messageId, userId, content);

        // Broadcast to group
        io.to(`group:${message.groupId}`).emit('messageEdited', {
          groupId: message.groupId,
          message,
        });

        if (callback) callback({ success: true, message });
      } catch (error) {
        console.error('editMessage error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Delete message
     */
    socket.on('deleteMessage', async (data, callback) => {
      try {
        const { messageId, groupId } = data;

        await messageService.deleteMessage(messageId, userId);

        // Broadcast to group
        io.to(`group:${groupId}`).emit('messageDeleted', {
          groupId,
          messageId,
        });

        if (callback) callback({ success: true });
      } catch (error) {
        console.error('deleteMessage error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Typing indicator
     */
    socket.on('typing', async (data) => {
      const { groupId } = data;

      // Check if user is member
      const isMember = await isGroupMember(groupId, userId);
      if (!isMember) return;

      // Clear existing timeout
      const existing = typingUsers.get(userId);
      if (existing?.timeout) {
        clearTimeout(existing.timeout);
      }

      // Set typing indicator with auto-clear after 3s
      const timeout = setTimeout(() => {
        clearTyping(userId, groupId);
        socket.to(`group:${groupId}`).emit('userStoppedTyping', {
          groupId,
          userId,
        });
      }, 3000);

      typingUsers.set(userId, { groupId, timeout });

      // Broadcast to group
      socket.to(`group:${groupId}`).emit('userTyping', {
        groupId,
        userId,
        user: {
          id: user.id,
          firstName: user.employeeDetails?.firstName || user.studentLogin?.firstName,
        },
      });
    });

    /**
     * Stop typing (explicit)
     */
    socket.on('stopTyping', async (data) => {
      const { groupId } = data;
      clearTyping(userId, groupId);
      socket.to(`group:${groupId}`).emit('userStoppedTyping', {
        groupId,
        userId,
      });
    });

    /**
     * Mark messages as read
     */
    socket.on('markAsRead', async (data, callback) => {
      try {
        const { groupId, messageIds } = data;

        await messageService.markMessagesAsRead(groupId, userId, messageIds);

        // Broadcast read receipt
        socket.to(`group:${groupId}`).emit('messagesRead', {
          groupId,
          userId,
          messageIds,
          readAt: new Date().toISOString(),
        });

        if (callback) callback({ success: true });
      } catch (error) {
        console.error('markAsRead error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Join a new group (after being added)
     */
    socket.on('joinGroup', async (data) => {
      const { groupId } = data;
      const isMember = await isGroupMember(groupId, userId);
      if (isMember) {
        socket.join(`group:${groupId}`);
        socket.emit('joinedGroup', { groupId });
      }
    });

    /**
     * Leave a group room
     */
    socket.on('leaveGroup', async (data) => {
      const { groupId } = data;
      socket.leave(`group:${groupId}`);
      socket.emit('leftGroup', { groupId });
    });

    // ============ DIRECT MESSAGE EVENTS =====
    /**
     * Send direct message
     */
    socket.on('sendDirectMessage', async (data, callback) => {
      try {
        const { receiverId, content, encryptedContent, messageType, filePath, fileName, fileSize, mimeType, duration, waveformData, replyToId } = data;

        const message = await dmService.sendDirectMessage(userId, receiverId, {
          content,
          encryptedContent,
          messageType: messageType || 'text',
          filePath,
          fileName,
          fileSize,
          mimeType,
          duration,
          waveformData,
          replyToId,
        });

        // Send to both sender and receiver
        io.to(`user:${userId}`).to(`user:${receiverId}`).emit('newDirectMessage', {
          message,
        });

        // Check if receiver is offline and create notification
        const receiverStatus = await presenceService.getUserStatus(receiverId);
        if (!receiverStatus.isOnline) {
          await createDMNotification(receiverId, message);
        }

        if (callback) callback({ success: true, message });
      } catch (error) {
        console.error('sendDirectMessage error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    /**
     * Typing in DM
     */
    socket.on('typingDM', async (data) => {
      const { receiverId } = data;
      io.to(`user:${receiverId}`).emit('userTypingDM', {
        userId,
        user: {
          id: user.id,
          firstName: user.employeeDetails?.firstName || user.studentLogin?.firstName,
        },
      });

      // Auto-clear after 3s
      setTimeout(() => {
        io.to(`user:${receiverId}`).emit('userStoppedTypingDM', { userId });
      }, 3000);
    });

    /**
     * Mark DM as read
     */
    socket.on('markDMAsRead', async (data, callback) => {
      try {
        const { otherUserId } = data;

        await dmService.markDirectMessagesAsRead(userId, otherUserId);

        // Notify the other user
        io.to(`user:${otherUserId}`).emit('dmRead', {
          readBy: userId,
          readAt: new Date().toISOString(),
        });

        if (callback) callback({ success: true });
      } catch (error) {
        console.error('markDMAsRead error:', error.message);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ============ PRESENCE EVENTS =====
    /**
     * Heartbeat to keep connection alive and update last seen
     */
    socket.on('heartbeat', async () => {
      try {
        await presenceService.updateLastSeen(userId);
      } catch (error) {
        console.error('heartbeat error:', error.message);
      }
    });

    /**
     * Get online users in a group
     */
    socket.on('getOnlineUsers', async (data, callback) => {
      try {
        const { groupId } = data;
        const onlineUserIds = await presenceService.getGroupOnlineMembers(groupId);
        if (callback) callback({ success: true, onlineUserIds });
      } catch (error) {
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // ============ DISCONNECT =====
    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${user.uid} (${socket.id})`);

      let lastSeenAt = null;
      try {
        // Set user offline
        const status = await presenceService.setUserOffline(userId, socket.id);
        lastSeenAt = status.lastSeenAt;
      } catch (error) {
        console.error('disconnect presence update error:', error.message);
      }

      // Clear any typing indicators
      const typing = typingUsers.get(userId);
      if (typing?.timeout) {
        clearTimeout(typing.timeout);
        typingUsers.delete(userId);
      }

      // Broadcast offline status to all groups
      groupIds.forEach((groupId) => {
        socket.to(`group:${groupId}`).emit('userOffline', {
          userId,
          lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : new Date().toISOString(),
        });
      });
    });
  });
};

/**
 * Clear typing indicator for a user
 */
const clearTyping = (userId, groupId) => {
  const existing = typingUsers.get(userId);
  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }
  typingUsers.delete(userId);
};

/**
 * Get offline members of a group (excluding sender)
 */
const getOfflineGroupMembers = async (groupId, excludeUserId) => {
  try {
    const members = await prisma.chatGroupMember.findMany({
      where: {
        groupId,
        userId: { not: excludeUserId },
        OR: [
          {
            user: {
              chatStatus: {
                isOnline: false,
              },
            },
          },
          {
            user: {
              chatStatus: null,
            },
          },
        ],
      },
      select: { userId: true },
    });

    return members.map((m) => m.userId);
  } catch (error) {
    console.error('Error getting offline members:', error);
    // Fallback: try simpler query without chatStatus
    try {
      const members = await prisma.chatGroupMember.findMany({
        where: {
          groupId,
          userId: { not: excludeUserId },
        },
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return []; // Return empty array to prevent crashes
    }
  }
};

/**
 * Create notifications for offline members
 */
const createNotificationsForMembers = async (userIds, message, groupId) => {
  if (userIds.length === 0) return;

  const group = await prisma.chatGroup.findUnique({
    where: { id: groupId },
    select: { name: true },
  });

  const senderName = message.sender?.employeeDetails?.firstName || 
                     message.sender?.studentLogin?.firstName ||
                     'Someone';

  const preview = message.messageType === 'text' 
    ? (message.content?.substring(0, 50) + (message.content?.length > 50 ? '...' : ''))
    : `Sent a ${message.messageType}`;

  const notifications = userIds.map((userId) => ({
    userId,
    type: 'chat_message',
    title: `New message in ${group?.name || 'Chat'}`,
    message: `${senderName}: ${preview}`,
    referenceType: 'chat_group',
    referenceId: groupId,
    isRead: false,
  }));

  await prisma.notification.createMany({
    data: notifications,
  });
};

/**
 * Create notification for DM
 */
const createDMNotification = async (receiverId, message) => {
  const senderName = message.sender?.employeeDetails?.firstName || 
                     message.sender?.studentLogin?.firstName ||
                     'Someone';

  const preview = message.messageType === 'text' 
    ? (message.content?.substring(0, 50) + (message.content?.length > 50 ? '...' : ''))
    : `Sent a ${message.messageType}`;

  await prisma.notification.create({
    data: {
      userId: receiverId,
      type: 'chat_direct_message',
      title: `New message from ${senderName}`,
      message: preview,
      referenceType: 'chat_direct',
      referenceId: message.senderId,
      isRead: false,
    },
  });
};

module.exports = { initChatSocket };
