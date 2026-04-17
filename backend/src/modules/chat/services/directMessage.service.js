/**
 * Direct Message Service
 * Business logic for 1-1 direct messaging
 */
const prisma = require('../../../shared/config/database');

/**
 * Get conversations list for a user
 */
const getConversations = async (userId, { page = 1, limit = 50 } = {}) => {
  // Get all users the current user has had conversations with
  const conversations = await prisma.$queryRaw`
    WITH conversation_users AS (
      SELECT DISTINCT 
        CASE 
          WHEN sender_id = ${userId}::uuid THEN receiver_id 
          ELSE sender_id 
        END as other_user_id
      FROM direct_message
      WHERE sender_id = ${userId}::uuid OR receiver_id = ${userId}::uuid
    ),
    last_messages AS (
      SELECT DISTINCT ON (
        LEAST(sender_id, receiver_id), 
        GREATEST(sender_id, receiver_id)
      )
        id,
        sender_id,
        receiver_id,
        content,
        message_type,
        read_at,
        created_at
      FROM direct_message
      WHERE (sender_id = ${userId}::uuid OR receiver_id = ${userId}::uuid)
        AND is_deleted = false
      ORDER BY 
        LEAST(sender_id, receiver_id),
        GREATEST(sender_id, receiver_id),
        created_at DESC
    )
    SELECT 
      cu.other_user_id,
      lm.id as last_message_id,
      lm.content as last_message_content,
      lm.message_type as last_message_type,
      lm.sender_id as last_message_sender_id,
      lm.read_at as last_message_read_at,
      lm.created_at as last_message_created_at
    FROM conversation_users cu
    LEFT JOIN last_messages lm ON 
      (lm.sender_id = cu.other_user_id OR lm.receiver_id = cu.other_user_id)
    ORDER BY lm.created_at DESC
    LIMIT ${limit}
    OFFSET ${(page - 1) * limit}
  `;

  // Get user details for each conversation
  const userIds = conversations.map((c) => c.other_user_id);
  
  const users = await prisma.userLogin.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      uid: true,
      email: true,
      role: true,
      profileImage: true,
      employeeDetails: {
        select: { firstName: true, lastName: true, displayName: true },
      },
      studentLogin: {
        select: { firstName: true, lastName: true },
      },
      chatStatus: {
        select: { isOnline: true, lastSeenAt: true, lastSeenPrivacy: true },
      },
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Get unread counts
  const unreadCounts = await getUnreadCountsByUsers(userId, userIds);

  const enrichedConversations = conversations.map((conv) => ({
    user: userMap.get(conv.other_user_id),
    lastMessage: conv.last_message_id
      ? {
          id: conv.last_message_id,
          content: conv.last_message_content,
          messageType: conv.last_message_type,
          senderId: conv.last_message_sender_id,
          readAt: conv.last_message_read_at,
          createdAt: conv.last_message_created_at,
        }
      : null,
    unreadCount: unreadCounts.get(conv.other_user_id) || 0,
  }));

  return enrichedConversations;
};

/**
 * Get unread counts for conversations with specific users
 */
const getUnreadCountsByUsers = async (userId, otherUserIds) => {
  const counts = await prisma.directMessage.groupBy({
    by: ['senderId'],
    where: {
      receiverId: userId,
      senderId: { in: otherUserIds },
      readAt: null,
      isDeleted: false,
    },
    _count: true,
  });

  return new Map(counts.map((c) => [c.senderId, c._count]));
};

/**
 * Get messages between two users
 */
const getDirectMessages = async (userId, otherUserId, { cursor, limit = 50 } = {}) => {
  const where = {
    OR: [
      { senderId: userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: userId },
    ],
    isDeleted: false,
  };

  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const messages = await prisma.directMessage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
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
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          messageType: true,
        },
      },
    },
  });

  const hasMore = messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages;

  // Get other user's details
  const otherUser = await prisma.userLogin.findUnique({
    where: { id: otherUserId },
    select: {
      id: true,
      uid: true,
      email: true,
      role: true,
      profileImage: true,
      employeeDetails: {
        select: { firstName: true, lastName: true, displayName: true },
      },
      studentLogin: {
        select: { firstName: true, lastName: true },
      },
      chatStatus: {
        select: { isOnline: true, lastSeenAt: true, lastSeenPrivacy: true },
      },
    },
  });

  return {
    messages: resultMessages.reverse(),
    hasMore,
    nextCursor: hasMore ? resultMessages[0].createdAt.toISOString() : null,
    otherUser,
  };
};

/**
 * Send a direct message
 */
const sendDirectMessage = async (senderId, receiverId, messageData) => {
  const { content, encryptedContent, messageType = 'text', filePath, fileName, fileSize, mimeType, duration, waveformData, replyToId } = messageData;

  // Verify receiver exists
  const receiver = await prisma.userLogin.findUnique({
    where: { id: receiverId },
    select: { id: true },
  });

  if (!receiver) {
    throw new Error('Recipient not found');
  }

  const message = await prisma.directMessage.create({
    data: {
      senderId,
      receiverId,
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
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          messageType: true,
        },
      },
    },
  });

  return message;
};

/**
 * Mark direct messages as read
 */
const markDirectMessagesAsRead = async (userId, otherUserId) => {
  await prisma.directMessage.updateMany({
    where: {
      senderId: otherUserId,
      receiverId: userId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { success: true };
};

/**
 * Edit a direct message
 */
const editDirectMessage = async (messageId, userId, newContent) => {
  const message = await prisma.directMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true, isDeleted: true },
  });

  if (!message || message.isDeleted) {
    throw new Error('Message not found');
  }

  if (message.senderId !== userId) {
    throw new Error('You can only edit your own messages');
  }

  const updated = await prisma.directMessage.update({
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
 * Delete a direct message
 */
const deleteDirectMessage = async (messageId, userId) => {
  const message = await prisma.directMessage.findUnique({
    where: { id: messageId },
    select: { senderId: true },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  if (message.senderId !== userId) {
    throw new Error('You can only delete your own messages');
  }

  const deleted = await prisma.directMessage.update({
    where: { id: messageId },
    data: { isDeleted: true },
  });

  return deleted;
};

/**
 * Search users for starting a DM
 */
const searchUsersForDM = async (userId, query, { limit = 20 } = {}) => {
  const users = await prisma.userLogin.findMany({
    where: {
      id: { not: userId },
      status: 'active',
      OR: [
        { uid: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        {
          employeeDetails: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { displayName: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
        {
          studentLogin: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
      ],
    },
    select: {
      id: true,
      uid: true,
      email: true,
      role: true,
      profileImage: true,
      employeeDetails: {
        select: { firstName: true, lastName: true, displayName: true },
      },
      studentLogin: {
        select: { firstName: true, lastName: true },
      },
      chatStatus: {
        select: { isOnline: true, lastSeenAt: true, lastSeenPrivacy: true },
      },
    },
    take: limit,
  });

  return users;
};

module.exports = {
  getConversations,
  getDirectMessages,
  sendDirectMessage,
  markDirectMessagesAsRead,
  editDirectMessage,
  deleteDirectMessage,
  searchUsersForDM,
};
