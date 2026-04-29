/**
 * Message Service
 * Business logic for chat messages
 */
const prisma = require('../../../shared/config/database');
const { checkPermission, isGroupMember } = require('../utils/permissions');

/**
 * Get messages for a group with pagination
 */
const getGroupMessages = async (groupId, userId, { cursor, limit = 50, userRole } = {}) => {
  // Admins/superadmins can read any group's messages
  const isSystemAdmin = userRole === 'admin' || userRole === 'superadmin';
  if (!isSystemAdmin) {
    const isMember = await isGroupMember(groupId, userId);
    if (!isMember) {
      throw new Error('You are not a member of this group');
    }
  }

  const where = {
    groupId,
    isDeleted: false,
  };

  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const messages = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Get one extra to check if there are more
    include: {
      sender: {
        select: {
          id: true,
          uid: true,
          profileImage: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
          studentLogin: {
            select: { firstName: true, lastName: true },
          },
          chatStatus: {
            select: { isOnline: true },
          },
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          messageType: true,
          sender: {
            select: {
              id: true,
              employeeDetails: { select: { firstName: true } },
              studentLogin: { select: { firstName: true } },
            },
          },
        },
      },
    },
  });

  const hasMore = messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages;

  // Get group's encryption status
  const group = await prisma.chatGroup.findUnique({
    where: { id: groupId },
    select: { isEncrypted: true },
  });

  return {
    messages: resultMessages.reverse(), // Return in chronological order
    hasMore,
    nextCursor: hasMore ? resultMessages[0].createdAt.toISOString() : null,
    isEncrypted: group?.isEncrypted || false,
  };
};

/**
 * Send a message to a group
 */
const sendMessage = async (groupId, senderId, messageData) => {
  const { content, encryptedContent, messageType = 'text', filePath, fileName, fileSize, mimeType, duration, waveformData, replyToId, mentions } = messageData;

  // Check if user can send messages
  const canSend = await checkPermission(groupId, senderId, 'canSendMessage');
  if (!canSend) {
    throw new Error('You do not have permission to send messages in this group');
  }

  // Check specific message type permissions
  if (messageType === 'voice') {
    const canVoice = await checkPermission(groupId, senderId, 'canSendVoice');
    if (!canVoice) {
      throw new Error('Voice messages are not allowed in this group');
    }
  }

  if (messageType === 'video') {
    const canVideo = await checkPermission(groupId, senderId, 'canSendVideo');
    if (!canVideo) {
      throw new Error('Video messages are not allowed in this group');
    }
  }

  if (['file', 'image', 'document'].includes(messageType)) {
    const canUpload = await checkPermission(groupId, senderId, 'canUploadFiles');
    if (!canUpload) {
      throw new Error('File uploads are not allowed in this group');
    }
  }

  // Check @all mention permission
  if (mentions && mentions.includes('all')) {
    const canMentionAll = await checkPermission(groupId, senderId, 'canMentionAll');
    if (!canMentionAll) {
      throw new Error('You do not have permission to mention @all');
    }
  }

  const message = await prisma.chatMessage.create({
    data: {
      groupId,
      senderId,
      messageType,
      content,
      encryptedContent,
      filePath,
      fileName,
      fileSize,
      mimeType,
      duration,
      waveformData,
      replyToId,
      mentions,
      readBy: JSON.stringify([{ userId: senderId, readAt: new Date() }]),
    },
    include: {
      sender: {
        select: {
          id: true,
          uid: true,
          profileImage: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
          studentLogin: {
            select: { firstName: true, lastName: true },
          },
          chatStatus: {
            select: { isOnline: true },
          },
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          messageType: true,
          sender: {
            select: {
              id: true,
              employeeDetails: { select: { firstName: true } },
              studentLogin: { select: { firstName: true } },
            },
          },
        },
      },
    },
  });

  // Update group's updatedAt
  await prisma.chatGroup.update({
    where: { id: groupId },
    data: { updatedAt: new Date() },
  });

  return message;
};

/**
 * Edit a message
 */
const editMessage = async (messageId, userId, newContent) => {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true, groupId: true, isDeleted: true },
  });

  if (!message || message.isDeleted) {
    throw new Error('Message not found');
  }

  if (message.senderId !== userId) {
    throw new Error('You can only edit your own messages');
  }

  const canEdit = await checkPermission(message.groupId, userId, 'canEditMessage');
  if (!canEdit) {
    throw new Error('You do not have permission to edit messages');
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      content: newContent,
      isEdited: true,
    },
    include: {
      sender: {
        select: {
          id: true,
          uid: true,
          profileImage: true,
          employeeDetails: { select: { firstName: true, lastName: true } },
          studentLogin: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return updated;
};

/**
 * Delete a message
 */
const deleteMessage = async (messageId, userId) => {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true, groupId: true },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // Check if user is sender or admin
  const member = await prisma.chatGroupMember.findUnique({
    where: { 
      groupId_userId: { 
        groupId: message.groupId, 
        userId 
      } 
    },
    select: { memberRole: true },
  });

  const isAdminOrOwner = member && ['owner', 'admin', 'moderator'].includes(member.memberRole);
  const isSender = message.senderId === userId;

  if (!isSender && !isAdminOrOwner) {
    throw new Error('You do not have permission to delete this message');
  }

  if (isSender) {
    const canDelete = await checkPermission(message.groupId, userId, 'canDeleteMessage');
    if (!canDelete) {
      throw new Error('You do not have permission to delete messages');
    }
  }

  // Soft delete
  const deleted = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { isDeleted: true },
  });

  return deleted;
};

/**
 * Pin/unpin a message
 */
const togglePinMessage = async (messageId, userId) => {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { groupId: true, isPinned: true, isDeleted: true },
  });

  if (!message || message.isDeleted) {
    throw new Error('Message not found');
  }

  const canPin = await checkPermission(message.groupId, userId, 'canPinMessage');
  if (!canPin) {
    throw new Error('You do not have permission to pin messages');
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { isPinned: !message.isPinned },
    include: {
      sender: {
        select: {
          id: true,
          employeeDetails: { select: { firstName: true, lastName: true } },
          studentLogin: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return updated;
};

/**
 * Get pinned messages for a group
 */
const getPinnedMessages = async (groupId, userId) => {
  const isMember = await isGroupMember(groupId, userId);
  if (!isMember) {
    throw new Error('You are not a member of this group');
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      groupId,
      isPinned: true,
      isDeleted: false,
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      sender: {
        select: {
          id: true,
          uid: true,
          profileImage: true,
          employeeDetails: { select: { firstName: true, lastName: true } },
          studentLogin: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return messages;
};

/**
 * Mark messages as read
 */
const markMessagesAsRead = async (groupId, userId, messageIds) => {
  const isMember = await isGroupMember(groupId, userId);
  if (!isMember) {
    throw new Error('You are not a member of this group');
  }

  const readEntry = { userId, readAt: new Date().toISOString() };

  // Update each message's readBy array
  for (const messageId of messageIds) {
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { readBy: true },
    });

    if (message) {
      let readBy = [];
      try {
        readBy = typeof message.readBy === 'string' 
          ? JSON.parse(message.readBy) 
          : (message.readBy || []);
      } catch (e) {
        readBy = [];
      }

      // Check if already read by this user
      const alreadyRead = readBy.some((r) => r.userId === userId);
      if (!alreadyRead) {
        readBy.push(readEntry);
        await prisma.chatMessage.update({
          where: { id: messageId },
          data: { readBy: JSON.stringify(readBy) },
        });
      }
    }
  }

  return { success: true, count: messageIds.length };
};

/**
 * Search messages in a group
 */
const searchMessages = async (groupId, userId, query, { limit = 20 } = {}) => {
  const isMember = await isGroupMember(groupId, userId);
  if (!isMember) {
    throw new Error('You are not a member of this group');
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      groupId,
      isDeleted: false,
      content: { contains: query, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: {
        select: {
          id: true,
          uid: true,
          profileImage: true,
          employeeDetails: { select: { firstName: true, lastName: true } },
          studentLogin: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return messages;
};

/**
 * Get unread message count for a user in a group
 */
const getUnreadCount = async (groupId, userId) => {
  const member = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { joinedAt: true },
  });

  if (!member) {
    return 0;
  }

  // Count messages sent after user joined that they haven't read
  const count = await prisma.$queryRaw`
    SELECT COUNT(*) as count
    FROM chat_message
    WHERE group_id = ${groupId}::uuid
      AND is_deleted = false
      AND sender_id != ${userId}::uuid
      AND created_at > ${member.joinedAt}
      AND NOT (read_by::text LIKE '%' || ${userId} || '%')
  `;

  return parseInt(count[0]?.count || 0);
};

module.exports = {
  getGroupMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  togglePinMessage,
  getPinnedMessages,
  markMessagesAsRead,
  searchMessages,
  getUnreadCount,
};
