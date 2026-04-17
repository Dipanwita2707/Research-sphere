/**
 * Inbox Controller
 * Handles inbox, sent, starred, trash views + actions
 */
const threadService = require('../services/thread.service');

/**
 * GET /api/v1/mail/inbox
 * Get user's inbox
 */
exports.getInbox = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const result = await threadService.getInboxThreads(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.threads,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inbox',
    });
  }
};

/**
 * GET /api/v1/mail/inbox/sent
 * Get sent threads
 */
exports.getSent = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const result = await threadService.getSentThreads(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.threads,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Get sent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sent mail',
    });
  }
};

/**
 * GET /api/v1/mail/inbox/starred
 * Get starred threads
 */
exports.getStarred = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const result = await threadService.getStarredThreads(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.threads,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Get starred error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch starred mail',
    });
  }
};

/**
 * GET /api/v1/mail/inbox/trash
 * Get trashed threads
 */
exports.getTrash = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const result = await threadService.getTrashThreads(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.threads,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trash',
    });
  }
};

/**
 * GET /api/v1/mail/inbox/counts
 * Get sidebar badge counts
 */
exports.getCounts = async (req, res) => {
  try {
    const counts = await threadService.getMailCounts(req.user.id);

    res.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    console.error('Get counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mail counts',
    });
  }
};

/**
 * POST /api/v1/mail/inbox/mark-read/:threadId
 */
exports.markRead = async (req, res) => {
  try {
    await threadService.markThreadAsRead(req.params.threadId, req.user.id);
    res.json({ success: true, message: 'Thread marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

/**
 * POST /api/v1/mail/inbox/mark-unread/:threadId
 */
exports.markUnread = async (req, res) => {
  try {
    await threadService.markThreadAsUnread(req.params.threadId, req.user.id);
    res.json({ success: true, message: 'Thread marked as unread' });
  } catch (error) {
    console.error('Mark unread error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark as unread' });
  }
};

/**
 * POST /api/v1/mail/inbox/star/:threadId
 */
exports.toggleStar = async (req, res) => {
  try {
    const result = await threadService.toggleStarThread(req.params.threadId, req.user.id);
    res.json({
      success: true,
      message: result.isStarred ? 'Thread starred' : 'Thread unstarred',
      data: result,
    });
  } catch (error) {
    console.error('Toggle star error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle star' });
  }
};

/**
 * DELETE /api/v1/mail/inbox/delete/:threadId
 * Move to trash
 */
exports.deleteThread = async (req, res) => {
  try {
    await threadService.deleteThread(req.params.threadId, req.user.id);
    res.json({ success: true, message: 'Thread moved to trash' });
  } catch (error) {
    console.error('Delete thread error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete thread' });
  }
};

/**
 * POST /api/v1/mail/inbox/restore/:threadId
 * Restore from trash
 */
exports.restoreThread = async (req, res) => {
  try {
    await threadService.restoreThread(req.params.threadId, req.user.id);
    res.json({ success: true, message: 'Thread restored from trash' });
  } catch (error) {
    console.error('Restore thread error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore thread' });
  }
};

/**
 * POST /api/v1/mail/inbox/archive/:threadId
 */
exports.archiveThread = async (req, res) => {
  try {
    await threadService.archiveThread(req.params.threadId, req.user.id);
    res.json({ success: true, message: 'Thread archived' });
  } catch (error) {
    console.error('Archive thread error:', error);
    res.status(500).json({ success: false, message: 'Failed to archive thread' });
  }
};

/**
 * POST /api/v1/mail/inbox/unarchive/:threadId
 */
exports.unarchiveThread = async (req, res) => {
  try {
    await threadService.unarchiveThread(req.params.threadId, req.user.id);
    res.json({ success: true, message: 'Thread unarchived' });
  } catch (error) {
    console.error('Unarchive thread error:', error);
    res.status(500).json({ success: false, message: 'Failed to unarchive thread' });
  }
};
