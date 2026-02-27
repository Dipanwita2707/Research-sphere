/**
 * Thread Controller
 * Handles viewing thread conversation
 */
const threadService = require('../services/thread.service');

/**
 * GET /api/v1/mail/threads/:threadId
 * Get full thread conversation
 */
exports.getThread = async (req, res) => {
  try {
    const { threadId } = req.params;

    const thread = await threadService.getThreadConversation(threadId, req.user.id);

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found',
      });
    }

    // Auto-mark as read when viewing
    await threadService.markThreadAsRead(threadId, req.user.id);

    res.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch thread',
    });
  }
};
