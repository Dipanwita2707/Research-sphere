/**
 * Label Service
 * Handles CRUD for custom labels and message-label associations
 */
const prisma = require('../../../shared/config/database');

// System labels (created once, shared by all users)
const SYSTEM_LABELS = [
  { name: 'Inbox', icon: 'inbox', color: '#1a73e8', sortOrder: 1 },
  { name: 'Sent', icon: 'send', color: '#188038', sortOrder: 2 },
  { name: 'Drafts', icon: 'file-text', color: '#f9ab00', sortOrder: 3 },
  { name: 'Starred', icon: 'star', color: '#f4b400', sortOrder: 4 },
  { name: 'Trash', icon: 'trash-2', color: '#ea4335', sortOrder: 5 },
  { name: 'Archive', icon: 'archive', color: '#5f6368', sortOrder: 6 },
];

/**
 * Initialize system labels (idempotent)
 */
const initializeSystemLabels = async () => {
  for (const label of SYSTEM_LABELS) {
    await prisma.mailLabel.upsert({
      where: {
        id: label.name.toLowerCase(), // This won't work with UUID, so use findFirst
      },
      update: {},
      create: {
        name: label.name,
        icon: label.icon,
        color: label.color,
        sortOrder: label.sortOrder,
        isSystem: true,
        userId: null, // System labels don't belong to any user
      },
    }).catch(async () => {
      // If upsert fails (because id is UUID), try findFirst + create
      const existing = await prisma.mailLabel.findFirst({
        where: { name: label.name, isSystem: true, userId: null },
      });
      if (!existing) {
        await prisma.mailLabel.create({
          data: {
            name: label.name,
            icon: label.icon,
            color: label.color,
            sortOrder: label.sortOrder,
            isSystem: true,
            userId: null,
          },
        });
      }
    });
  }
};

/**
 * Get all labels for a user (system + custom)
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
const getLabelsForUser = async (userId) => {
  const labels = await prisma.mailLabel.findMany({
    where: {
      OR: [
        { isSystem: true, userId: null },
        { userId },
      ],
    },
    orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });

  return labels;
};

/**
 * Create a custom label for a user
 * @param {string} userId
 * @param {object} data - { name, color, icon }
 * @returns {Promise<object>}
 */
const createLabel = async (userId, { name, color, icon }) => {
  // Check max 50 custom labels per user
  const count = await prisma.mailLabel.count({
    where: { userId, isSystem: false },
  });

  if (count >= 50) {
    throw new Error('Maximum of 50 custom labels allowed');
  }

  // Check duplicate name
  const existing = await prisma.mailLabel.findFirst({
    where: { userId, name, isSystem: false },
  });

  if (existing) {
    throw new Error('A label with this name already exists');
  }

  const label = await prisma.mailLabel.create({
    data: {
      userId,
      name,
      color: color || '#5f6368',
      icon: icon || 'tag',
      isSystem: false,
      sortOrder: count + 10, // After system labels
    },
  });

  return label;
};

/**
 * Update a custom label
 * @param {string} labelId
 * @param {string} userId
 * @param {object} data - { name, color, icon }
 * @returns {Promise<object>}
 */
const updateLabel = async (labelId, userId, { name, color, icon }) => {
  const label = await prisma.mailLabel.findFirst({
    where: { id: labelId, userId, isSystem: false },
  });

  if (!label) {
    throw new Error('Label not found or cannot be edited');
  }

  return prisma.mailLabel.update({
    where: { id: labelId },
    data: {
      ...(name && { name }),
      ...(color && { color }),
      ...(icon && { icon }),
    },
  });
};

/**
 * Delete a custom label
 * @param {string} labelId
 * @param {string} userId
 */
const deleteLabel = async (labelId, userId) => {
  const label = await prisma.mailLabel.findFirst({
    where: { id: labelId, userId, isSystem: false },
  });

  if (!label) {
    throw new Error('Label not found or cannot be deleted');
  }

  // Delete all message-label associations first, then the label
  await prisma.$transaction([
    prisma.mailMessageLabel.deleteMany({ where: { labelId } }),
    prisma.mailLabel.delete({ where: { id: labelId } }),
  ]);
};

/**
 * Apply a label to a message for a user
 * @param {string} messageId
 * @param {string} labelId
 * @param {string} userId
 */
const applyLabelToMessage = async (messageId, labelId, userId) => {
  await prisma.mailMessageLabel.upsert({
    where: {
      unique_label_per_message_per_user: {
        messageId,
        labelId,
        userId,
      },
    },
    update: {},
    create: { messageId, labelId, userId },
  });
};

/**
 * Remove a label from a message for a user
 */
const removeLabelFromMessage = async (messageId, labelId, userId) => {
  await prisma.mailMessageLabel.deleteMany({
    where: { messageId, labelId, userId },
  });
};

/**
 * Apply label to all messages in a thread for a user
 */
const applyLabelToThread = async (threadId, labelId, userId) => {
  const messages = await prisma.mailMessage.findMany({
    where: { threadId },
    select: { id: true },
  });

  const data = messages.map((m) => ({
    messageId: m.id,
    labelId,
    userId,
  }));

  // Use createMany with skipDuplicates
  await prisma.mailMessageLabel.createMany({
    data,
    skipDuplicates: true,
  });
};

/**
 * Remove label from all messages in a thread for a user
 */
const removeLabelFromThread = async (threadId, labelId, userId) => {
  const messages = await prisma.mailMessage.findMany({
    where: { threadId },
    select: { id: true },
  });

  const messageIds = messages.map((m) => m.id);

  await prisma.mailMessageLabel.deleteMany({
    where: {
      messageId: { in: messageIds },
      labelId,
      userId,
    },
  });
};

/**
 * Get messages with a specific label for a user
 */
const getMessagesWithLabel = async (userId, labelId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;

  const [messageLabels, total] = await Promise.all([
    prisma.mailMessageLabel.findMany({
      where: { userId, labelId },
      orderBy: { appliedAt: 'desc' },
      skip,
      take: limit,
      include: {
        message: {
          include: {
            sender: {
              select: {
                id: true, uid: true, role: true,
                employeeDetails: { select: { displayName: true, firstName: true, lastName: true } },
                studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
              },
            },
            thread: { select: { id: true, subject: true } },
            attachments: { select: { id: true, fileName: true } },
          },
        },
      },
    }),
    prisma.mailMessageLabel.count({ where: { userId, labelId } }),
  ]);

  return {
    messages: messageLabels.map((ml) => ml.message),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get distinct threads that have at least one message with a specific label for a user
 */
const getThreadsForLabel = async (userId, labelId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;

  // Find thread IDs with labeled messages for this user
  const labeledMessages = await prisma.mailMessageLabel.findMany({
    where: { userId, labelId },
    select: { message: { select: { threadId: true } } },
    distinct: ['messageId'],
  });

  const threadIds = [...new Set(labeledMessages.map((ml) => ml.message.threadId))];
  const total = threadIds.length;
  const pagedThreadIds = threadIds.slice(skip, skip + limit);

  if (pagedThreadIds.length === 0) {
    return { threads: [], total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  const { USER_SELECT, getDisplayName } = require('./recipient.service');

  const threads = await prisma.mailThread.findMany({
    where: { id: { in: pagedThreadIds } },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      messages: {
        orderBy: { sentAt: 'desc' },
        take: 1,
        include: {
          sender: { select: USER_SELECT },
          attachments: { select: { id: true, fileName: true } },
        },
      },
      participants: {
        where: { userId },
        select: { lastReadAt: true, isMuted: true, isStarred: true },
      },
      _count: { select: { messages: true } },
    },
  });

  const enrichedThreads = await Promise.all(
    threads.map(async (thread) => {
      const unreadCount = await prisma.mailRecipient.count({
        where: { userId, readAt: null, isDeleted: false, message: { threadId: thread.id } },
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

module.exports = {
  SYSTEM_LABELS,
  initializeSystemLabels,
  getLabelsForUser,
  createLabel,
  updateLabel,
  deleteLabel,
  applyLabelToMessage,
  removeLabelFromMessage,
  applyLabelToThread,
  removeLabelFromThread,
  getMessagesWithLabel,
  getThreadsForLabel,
};
