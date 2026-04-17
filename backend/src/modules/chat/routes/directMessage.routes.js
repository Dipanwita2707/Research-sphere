/**
 * Direct Message Routes
 * Routes for 1-1 messaging
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  editMessage,
  deleteMessage,
  searchUsers,
} = require('../controllers/directMessage.controller');
const { requireChatAccess, requireUserPermission } = require('../middleware/chatAccess');

// All routes require authentication and chat access
router.use(protect);
router.use(requireChatAccess);

// Conversations list
router.get('/conversations', requireUserPermission('canPrivateMessage'), getConversations);

// Search users for starting DM
router.get('/users/search', requireUserPermission('canPrivateMessage'), searchUsers);

// Messages with a specific user
router.get('/:otherUserId/messages', requireUserPermission('canPrivateMessage'), getMessages);
router.post('/:otherUserId/read', requireUserPermission('canPrivateMessage'), markAsRead);

// Send message
router.post('/', requireUserPermission('canPrivateMessage'), sendMessage);

// Message operations
router.put('/messages/:id', editMessage);
router.delete('/messages/:id', deleteMessage);

module.exports = router;
