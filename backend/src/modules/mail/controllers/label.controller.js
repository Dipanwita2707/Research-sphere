/**
 * Label Controller
 * CRUD for labels + apply/remove labels from messages/threads
 */
const prisma = require('../../../shared/config/database');
const labelService = require('../services/label.service');

/**
 * GET /api/v1/mail/labels
 * Get all labels for user (system + custom)
 */
exports.getLabels = async (req, res) => {
  try {
    const labels = await labelService.getLabelsForUser(req.user.id);
    res.json({ success: true, data: labels });
  } catch (error) {
    console.error('Get labels error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch labels' });
  }
};

/**
 * POST /api/v1/mail/labels
 * Create custom label
 */
exports.createLabel = async (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Label name is required' });
    }

    const label = await labelService.createLabel(req.user.id, {
      name: name.trim(),
      color,
      icon,
    });

    res.status(201).json({
      success: true,
      message: 'Label created',
      data: label,
    });
  } catch (error) {
    console.error('Create label error:', error);
    res.status(error.message.includes('Maximum') || error.message.includes('exists') ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to create label',
    });
  }
};

/**
 * PUT /api/v1/mail/labels/:labelId
 * Update custom label
 */
exports.updateLabel = async (req, res) => {
  try {
    const { name, color, icon } = req.body;

    const label = await labelService.updateLabel(req.params.labelId, req.user.id, {
      name,
      color,
      icon,
    });

    res.json({
      success: true,
      message: 'Label updated',
      data: label,
    });
  } catch (error) {
    console.error('Update label error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to update label',
    });
  }
};

/**
 * DELETE /api/v1/mail/labels/:labelId
 * Delete custom label
 */
exports.deleteLabel = async (req, res) => {
  try {
    await labelService.deleteLabel(req.params.labelId, req.user.id);
    res.json({ success: true, message: 'Label deleted' });
  } catch (error) {
    console.error('Delete label error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to delete label',
    });
  }
};

/**
 * POST /api/v1/mail/labels/apply
 * Apply label to a message or thread
 */
exports.applyLabel = async (req, res) => {
  try {
    const { messageId, threadId, labelId } = req.body;

    if (!labelId) {
      return res.status(400).json({ success: false, message: 'Label ID is required' });
    }

    if (threadId) {
      await labelService.applyLabelToThread(threadId, labelId, req.user.id);
    } else if (messageId) {
      await labelService.applyLabelToMessage(messageId, labelId, req.user.id);
    } else {
      return res.status(400).json({ success: false, message: 'Message ID or Thread ID is required' });
    }

    res.json({ success: true, message: 'Label applied' });
  } catch (error) {
    console.error('Apply label error:', error);
    res.status(500).json({ success: false, message: 'Failed to apply label' });
  }
};

/**
 * POST /api/v1/mail/labels/remove
 * Remove label from a message or thread
 */
exports.removeLabel = async (req, res) => {
  try {
    const { messageId, threadId, labelId } = req.body;

    if (!labelId) {
      return res.status(400).json({ success: false, message: 'Label ID is required' });
    }

    if (threadId) {
      await labelService.removeLabelFromThread(threadId, labelId, req.user.id);
    } else if (messageId) {
      await labelService.removeLabelFromMessage(messageId, labelId, req.user.id);
    } else {
      return res.status(400).json({ success: false, message: 'Message ID or Thread ID is required' });
    }

    res.json({ success: true, message: 'Label removed' });
  } catch (error) {
    console.error('Remove label error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove label' });
  }
};

/**
 * GET /api/v1/mail/labels/:labelId/threads
 * Get threads tagged with a specific label
 */
exports.getLabelThreads = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = await labelService.getThreadsForLabel(req.user.id, req.params.labelId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get label threads error:', error);
    res.status(500).json({ success: false, message: 'Failed to get label threads' });
  }
};

/**
 * GET /api/v1/mail/labels/thread/:threadId
 * Get all labels applied to a thread by this user
 */
exports.getThreadLabels = async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.id;

    const messages = await prisma.mailMessage.findMany({
      where: { threadId },
      select: { id: true },
    });
    const messageIds = messages.map((m) => m.id);

    const labelAssignments = await prisma.mailMessageLabel.findMany({
      where: { messageId: { in: messageIds }, userId },
      include: {
        label: { select: { id: true, name: true, color: true, icon: true, isSystem: true } },
      },
      distinct: ['labelId'],
    });

    const labels = labelAssignments.map((la) => la.label);
    res.json({ success: true, data: labels });
  } catch (error) {
    console.error('Get thread labels error:', error);
    res.status(500).json({ success: false, message: 'Failed to get thread labels' });
  }
};

/**
 * GET /api/v1/mail/labels/:labelId/messages
 * Get messages with a specific label
 */
exports.getLabelMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const result = await labelService.getMessagesWithLabel(req.user.id, req.params.labelId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.messages,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Get label messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch label messages' });
  }
};
