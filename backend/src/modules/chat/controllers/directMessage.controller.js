/**
 * Direct Message Controller
 * Handles HTTP requests for 1-1 messaging
 */
const dmService = require('../services/directMessage.service');

/**
 * Get conversations list
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    const conversations = await dmService.getConversations(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversations',
    });
  }
};

/**
 * Get messages with a specific user
 */
const getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;
    const { cursor, limit = 50 } = req.query;

    const result = await dmService.getDirectMessages(userId, otherUserId, {
      cursor,
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get DM messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get messages',
    });
  }
};

/**
 * Send a direct message
 */
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, content, encryptedContent, messageType, filePath, fileName, fileSize, mimeType, duration, waveformData, replyToId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID is required',
      });
    }

    if (!content && !encryptedContent && !filePath) {
      return res.status(400).json({
        success: false,
        message: 'Message content or file is required',
      });
    }

    const message = await dmService.sendDirectMessage(senderId, receiverId, {
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

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    console.error('Send DM error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to send message',
    });
  }
};

/**
 * Mark messages as read
 */
const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;

    await dmService.markDirectMessagesAsRead(userId, otherUserId);

    res.json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('Mark DM as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
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

    const message = await dmService.editDirectMessage(id, userId, content);

    res.json({
      success: true,
      message: 'Message edited successfully',
      data: message,
    });
  } catch (error) {
    console.error('Edit DM error:', error);
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

    await dmService.deleteDirectMessage(id, userId);

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Delete DM error:', error);
    const status = error.message.includes('own messages') ? 403 : 
                   error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete message',
    });
  }
};

/**
 * Search users for starting a DM
 */
const searchUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const users = await dmService.searchUsersForDM(userId, q, {
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
    });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  editMessage,
  deleteMessage,
  searchUsers,
};
