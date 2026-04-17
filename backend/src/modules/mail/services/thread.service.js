/**
 * Thread Service
 * Handles thread listing, viewing, read tracking, starring, archiving, deleting
 */
const prisma = require('../../../shared/config/database');
const { USER_SELECT, getDisplayName } = require('./recipient.service');

/**
 * Get inbox threads for a user (where user is a recipient and not deleted)
 * @param {string} userId
 * @param {object} options - { page, limit, filter }
 * @returns {Promise<{ threads: object[], total: number, page: number, limit: number }>}
 */
const getInboxThreads = async (userId, { page = 1, limit = 50, filter = 'all' } = {}) => {
  const skip = (page - 1) * limit;

  // Base condition: user is a participant and not soft-deleted
  const participantCondition = {
    participants: {
      some: {
        userId,
        isDeleted: false,
      },
    },
  };

  // Must have messages where user is a recipient (not just sender)
  const recipientCondition = {
    messages: {
      some: {
        recipients: {
          some: {
            userId,
            isDeleted: false,
            isArchived: false,
          },
        },
      },
    },
  };

  const where = {
    AND: [participantCondition, recipientCondition],
  };

  const [threads, total] = await Promise.all([
    prisma.mailThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: limit,
      include: {
        createdBy: { select: USER_SELECT },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          include: {
            sender: { select: USER_SELECT },
            recipients: {
              where: { userId },
              select: { recipientType: true, readAt: true, isStarred: true, isArchived: true },
            },
            attachments: { select: { id: true, fileName: true } },
          },
        },
        participants: {
          where: { userId },
          select: { lastReadAt: true, isMuted: true, isStarred: true },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    }),
    prisma.mailThread.count({ where }),
  ]);

  // Calculate unread count per thread
  const enrichedThreads = await Promise.all(
    threads.map(async (thread) => {
      const unreadCount = await prisma.mailRecipient.count({
        where: {
          userId,
          readAt: null,
          isDeleted: false,
          message: { threadId: thread.id },
        },
      });

      const lastMessage = thread.messages[0];
      const participant = thread.participants[0];

      return {
        id: thread.id,
        subject: thread.subject,
        lastMessageAt: thread.lastMessageAt,
        lastMessageSnippet: thread.lastMessageSnippet,
        messageCount: thread._count.messages,
        unreadCount,
        isStarred: participant?.isStarred || false,
        isMuted: participant?.isMuted || false,
        lastSender: lastMessage
          ? {
              uid: lastMessage.sender.uid,
              displayName: getDisplayName(lastMessage.sender),
              profileImage: lastMessage.sender.profileImage || lastMessage.sender.profileImageFilePath,
            }
          : null,
        hasAttachments: lastMessage?.attachments?.length > 0,
        createdAt: thread.createdAt,
      };
    })
  );

  return {
    threads: enrichedThreads,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get sent threads for a user
 */
const getSentThreads = async (userId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;

  const where = {
    messages: {
      some: { senderId: userId },
    },
  };

  const [threads, total] = await Promise.all([
    prisma.mailThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: limit,
      include: {
        messages: {
          where: { senderId: userId },
          orderBy: { sentAt: 'desc' },
          take: 1,
          include: {
            recipients: {
              where: { recipientType: { in: ['TO', 'CC'] } },
              take: 5,
              include: { user: { select: USER_SELECT } },
            },
            attachments: { select: { id: true, fileName: true } },
          },
        },
        _count: { select: { messages: true } },
      },
    }),
    prisma.mailThread.count({ where }),
  ]);

  const enrichedThreads = threads.map((thread) => {
    const lastMessage = thread.messages[0];
    return {
      id: thread.id,
      subject: thread.subject,
      lastMessageAt: thread.lastMessageAt,
      lastMessageSnippet: thread.lastMessageSnippet,
      messageCount: thread._count.messages,
      recipients: lastMessage?.recipients?.map((r) => ({
        uid: r.user.uid,
        displayName: getDisplayName(r.user),
        type: r.recipientType,
      })) || [],
      hasAttachments: lastMessage?.attachments?.length > 0,
      createdAt: thread.createdAt,
    };
  });

  return {
    threads: enrichedThreads,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get starred messages for a user
 */
const getStarredThreads = async (userId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;

  // Find threads where the participant has starred the thread
  const where = {
    participants: {
      some: {
        userId,
        isStarred: true,
        isDeleted: false,
      },
    },
  };

  const [threads, total] = await Promise.all([
    prisma.mailThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: limit,
      include: {
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          include: {
            sender: { select: USER_SELECT },
            attachments: { select: { id: true, fileName: true } },
          },
        },
        _count: { select: { messages: true } },
      },
    }),
    prisma.mailThread.count({ where }),
  ]);

  const enrichedThreads = threads.map((thread) => {
    const lastMessage = thread.messages[0];
    return {
      id: thread.id,
      subject: thread.subject,
      lastMessageAt: thread.lastMessageAt,
      lastMessageSnippet: thread.lastMessageSnippet,
      messageCount: thread._count.messages,
      isStarred: true,
      lastSender: lastMessage
        ? {
            uid: lastMessage.sender.uid,
            displayName: getDisplayName(lastMessage.sender),
          }
        : null,
      hasAttachments: lastMessage?.attachments?.length > 0,
      createdAt: thread.createdAt,
    };
  });

  return { threads: enrichedThreads, total, page, limit, totalPages: Math.ceil(total / limit) };
};

/**
 * Get trashed messages for a user
 */
const getTrashThreads = async (userId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      {
        participants: {
          some: { userId, isDeleted: true },
        },
      },
      {
        messages: {
          some: {
            OR: [
              { senderId: userId },
              { recipients: { some: { userId, isDeleted: true } } },
            ],
          },
        },
      },
    ],
  };

  // Find threads with any deleted recipient for this user
  const deletedRecipientThreads = await prisma.mailRecipient.findMany({
    where: { userId, isDeleted: true },
    select: { message: { select: { threadId: true } } },
    distinct: ['messageId'],
  });

  const threadIds = [...new Set(deletedRecipientThreads.map((r) => r.message.threadId))];

  const [threads, total] = await Promise.all([
    prisma.mailThread.findMany({
      where: { id: { in: threadIds } },
      orderBy: { lastMessageAt: 'desc' },
      skip,
      take: limit,
      include: {
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          include: {
            sender: { select: USER_SELECT },
          },
        },
        _count: { select: { messages: true } },
      },
    }),
    threadIds.length,
  ]);

  const enrichedThreads = threads.map((thread) => {
    const lastMessage = thread.messages[0];
    return {
      id: thread.id,
      subject: thread.subject,
      lastMessageAt: thread.lastMessageAt,
      lastMessageSnippet: thread.lastMessageSnippet,
      messageCount: thread._count.messages,
      lastSender: lastMessage
        ? {
            uid: lastMessage.sender.uid,
            displayName: getDisplayName(lastMessage.sender),
          }
        : null,
      createdAt: thread.createdAt,
    };
  });

  return { threads: enrichedThreads, total, page, limit, totalPages: Math.ceil(total / limit) };
};

/**
 * Get full thread conversation
 * @param {string} threadId
 * @param {string} userId - Current user (for BCC filtering)
 * @returns {Promise<object>}
 */
const getThreadConversation = async (threadId, userId) => {
  const thread = await prisma.mailThread.findUnique({
    where: { id: threadId },
    include: {
      createdBy: { select: USER_SELECT },
      messages: {
        orderBy: { sentAt: 'asc' },
        include: {
          sender: { select: USER_SELECT },
          recipients: {
            include: { user: { select: USER_SELECT } },
          },
          attachments: true,
          replyTo: {
            select: {
              id: true,
              subject: true,
              sender: { select: { uid: true } },
            },
          },
        },
      },
      participants: {
        where: { userId },
        select: { lastReadAt: true, isMuted: true },
      },
    },
  });

  if (!thread) return null;

  // Filter BCC recipients: only show BCC if current user is the sender
  const filteredMessages = thread.messages.map((msg) => {
    const filteredRecipients = msg.recipients.filter((r) => {
      // Always show TO and CC
      if (r.recipientType !== 'BCC') return true;
      // Show BCC only if current user is the sender of this message
      if (msg.senderId === userId) return true;
      // Show BCC entry only for the BCC recipient themselves
      if (r.userId === userId) return true;
      return false;
    });

    return {
      ...msg,
      sender: {
        uid: msg.sender.uid,
        displayName: getDisplayName(msg.sender),
        profileImage: msg.sender.profileImage || msg.sender.profileImageFilePath,
        role: msg.sender.role,
      },
      recipients: filteredRecipients.map((r) => ({
        id: r.id,
        userId: r.userId,
        uid: r.user.uid,
        displayName: getDisplayName(r.user),
        recipientType: r.recipientType,
        readAt: r.readAt,
        isStarred: r.isStarred,
      })),
    };
  });

  return {
    id: thread.id,
    subject: thread.subject,
    messageCount: thread.messages.length,
    createdAt: thread.createdAt,
    createdBy: {
      uid: thread.createdBy.uid,
      displayName: getDisplayName(thread.createdBy),
    },
    lastReadAt: thread.participants[0]?.lastReadAt,
    isMuted: thread.participants[0]?.isMuted || false,
    messages: filteredMessages,
  };
};

/**
 * Mark all messages in a thread as read for a user
 */
const markThreadAsRead = async (threadId, userId) => {
  await prisma.$transaction([
    // Update all unread recipient records
    prisma.mailRecipient.updateMany({
      where: {
        userId,
        readAt: null,
        message: { threadId },
      },
      data: { readAt: new Date() },
    }),
    // Update participant lastReadAt
    prisma.mailParticipant.updateMany({
      where: { threadId, userId },
      data: { lastReadAt: new Date() },
    }),
  ]);
};

/**
 * Mark a thread as unread for a user (clears readAt on latest message)
 */
const markThreadAsUnread = async (threadId, userId) => {
  // Get the latest message in the thread
  const latestMessage = await prisma.mailMessage.findFirst({
    where: { threadId },
    orderBy: { sentAt: 'desc' },
  });

  if (latestMessage) {
    await prisma.mailRecipient.updateMany({
      where: { messageId: latestMessage.id, userId },
      data: { readAt: null },
    });
  }
};

/**
 * Star/unstar a thread — stored on MailParticipant (works for senders AND recipients)
 */
const toggleStarThread = async (threadId, userId) => {
  const participant = await prisma.mailParticipant.findUnique({
    where: { unique_participant_per_thread: { threadId, userId } },
  });

  if (!participant) throw new Error('Cannot star - not a participant in this thread');

  const newStarred = !participant.isStarred;
  await prisma.mailParticipant.update({
    where: { unique_participant_per_thread: { threadId, userId } },
    data: { isStarred: newStarred },
  });

  return { isStarred: newStarred };
};

/**
 * Soft-delete a thread for a user (move to trash)
 */
const deleteThread = async (threadId, userId) => {
  await prisma.$transaction([
    prisma.mailRecipient.updateMany({
      where: { userId, message: { threadId } },
      data: { isDeleted: true, deletedAt: new Date() },
    }),
    prisma.mailParticipant.updateMany({
      where: { threadId, userId },
      data: { isDeleted: true, deletedAt: new Date() },
    }),
  ]);
};

/**
 * Restore a thread from trash
 */
const restoreThread = async (threadId, userId) => {
  await prisma.$transaction([
    prisma.mailRecipient.updateMany({
      where: { userId, message: { threadId } },
      data: { isDeleted: false, deletedAt: null },
    }),
    prisma.mailParticipant.updateMany({
      where: { threadId, userId },
      data: { isDeleted: false, deletedAt: null },
    }),
  ]);
};

/**
 * Archive a thread for a user
 */
const archiveThread = async (threadId, userId) => {
  await prisma.mailRecipient.updateMany({
    where: { userId, message: { threadId } },
    data: { isArchived: true },
  });
};

/**
 * Unarchive a thread
 */
const unarchiveThread = async (threadId, userId) => {
  await prisma.mailRecipient.updateMany({
    where: { userId, message: { threadId } },
    data: { isArchived: false },
  });
};

/**
 * Get unread count for a user across all threads
 */
const getUnreadCount = async (userId) => {
  const count = await prisma.mailRecipient.count({
    where: {
      userId,
      readAt: null,
      isDeleted: false,
      isArchived: false,
    },
  });
  return count;
};

/**
 * Get counts for sidebar badges
 */
const getMailCounts = async (userId) => {
  const [unreadCount, draftCount, starredCount, trashCount] = await Promise.all([
    prisma.mailRecipient.count({
      where: { userId, readAt: null, isDeleted: false, isArchived: false },
    }),
    prisma.mailDraft.count({
      where: { userId },
    }),
    prisma.mailRecipient.count({
      where: { userId, isStarred: true, isDeleted: false },
    }),
    prisma.mailRecipient.count({
      where: { userId, isDeleted: true },
    }),
  ]);

  return { unreadCount, draftCount, starredCount, trashCount };
};

module.exports = {
  getInboxThreads,
  getSentThreads,
  getStarredThreads,
  getTrashThreads,
  getThreadConversation,
  markThreadAsRead,
  markThreadAsUnread,
  toggleStarThread,
  deleteThread,
  restoreThread,
  archiveThread,
  unarchiveThread,
  getUnreadCount,
  getMailCounts,
};
