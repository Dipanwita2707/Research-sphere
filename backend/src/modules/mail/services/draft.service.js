/**
 * Draft Service
 * Handles auto-save drafts and conversion to sent messages
 */
const prisma = require('../../../shared/config/database');

/**
 * Save or update a draft
 * @param {string} userId
 * @param {object} data - Draft content
 * @returns {Promise<object>}
 */
const saveDraft = async (userId, { id, threadId, replyToId, mode = 'new', subject, body, toRecipients = [], ccRecipients = [], bccRecipients = [], attachments = [] }) => {
  if (id) {
    // Update existing draft
    const existing = await prisma.mailDraft.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error('Draft not found');
    }

    return prisma.mailDraft.update({
      where: { id },
      data: {
        subject,
        body,
        toRecipients,
        ccRecipients,
        bccRecipients,
        attachments,
        threadId,
        replyToId,
        mode,
        lastSavedAt: new Date(),
      },
    });
  }

  // Create new draft
  return prisma.mailDraft.create({
    data: {
      userId,
      threadId,
      replyToId,
      mode,
      subject,
      body,
      toRecipients,
      ccRecipients,
      bccRecipients,
      attachments,
      lastSavedAt: new Date(),
    },
  });
};

/**
 * Get all drafts for a user
 */
const getDrafts = async (userId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;

  const [drafts, total] = await Promise.all([
    prisma.mailDraft.findMany({
      where: { userId },
      orderBy: { lastSavedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.mailDraft.count({ where: { userId } }),
  ]);

  return {
    drafts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get a single draft
 */
const getDraft = async (draftId, userId) => {
  return prisma.mailDraft.findFirst({
    where: { id: draftId, userId },
  });
};

/**
 * Delete a draft
 */
const deleteDraft = async (draftId, userId) => {
  const draft = await prisma.mailDraft.findFirst({
    where: { id: draftId, userId },
  });

  if (!draft) {
    throw new Error('Draft not found');
  }

  return prisma.mailDraft.delete({ where: { id: draftId } });
};

module.exports = {
  saveDraft,
  getDrafts,
  getDraft,
  deleteDraft,
};
