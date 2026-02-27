/**
 * Message Controller
 * Handles HTTP requests for chat messages
 */
const messageService = require('../services/message.service');

/**
 * Get messages for a group
 */
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { cursor, limit = 50 } = req.query;
    const userId = req.user.id;

    const result = await messageService.getGroupMessages(groupId, userId, {
      cursor,
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(error.message.includes('not a member') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to get messages',
    });
  }
};

/**
 * Send a message (REST fallback - primary is Socket.io)
 */
const sendMessage = async (req, res) => {
  try {
    const { groupId, content, encryptedContent, messageType, filePath, fileName, fileSize, mimeType, duration, waveformData, replyToId, mentions } = req.body;
    const senderId = req.user.id;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required',
      });
    }

    if (!content && !encryptedContent && !filePath) {
      return res.status(400).json({
        success: false,
        message: 'Message content or file is required',
      });
    }

    const message = await messageService.sendMessage(groupId, senderId, {
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

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(error.message.includes('permission') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to send message',
    });
  }
};

/**
 * Edit a message
 */
const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'New content is required',
      });
    }

    const message = await messageService.editMessage(id, userId, content);

    res.json({
      success: true,
      message: 'Message edited successfully',
      data: message,
    });
  } catch (error) {
    console.error('Edit message error:', error);
    const status = error.message.includes('own messages') ? 403 : 
                   error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to edit message',
    });
  }
};

/**
 * Delete a message
 */
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await messageService.deleteMessage(id, userId);

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Delete message error:', error);
    const status = error.message.includes('permission') ? 403 : 
                   error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete message',
    });
  }
};

/**
 * Toggle pin message
 */
const togglePinMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const message = await messageService.togglePinMessage(id, userId);

    res.json({
      success: true,
      message: message.isPinned ? 'Message pinned' : 'Message unpinned',
      data: message,
    });
  } catch (error) {
    console.error('Toggle pin error:', error);
    res.status(error.message.includes('permission') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to pin/unpin message',
    });
  }
};

/**
 * Get pinned messages for a group
 */
const getPinnedMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const messages = await messageService.getPinnedMessages(groupId, userId);

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Get pinned messages error:', error);
    res.status(error.message.includes('not a member') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to get pinned messages',
    });
  }
};

/**
 * Mark messages as read
 */
const markAsRead = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { messageIds } = req.body;
    const userId = req.user.id;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        message: 'Message IDs array is required',
      });
    }

    const result = await messageService.markMessagesAsRead(groupId, userId, messageIds);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark messages as read',
    });
  }
};

/**
 * Search messages in a group
 */
const searchMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { q, limit = 20 } = req.query;
    const userId = req.user.id;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const messages = await messageService.searchMessages(groupId, userId, q, {
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(error.message.includes('not a member') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to search messages',
    });
  }
};

/**
 * Get unread count for a group
 */
const getUnreadCount = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const count = await messageService.getUnreadCount(groupId, userId);

    res.json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
    });
  }
};

module.exports = {
  getGroupMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  togglePinMessage,
  getPinnedMessages,
  markAsRead,
  searchMessages,
  getUnreadCount,
};
