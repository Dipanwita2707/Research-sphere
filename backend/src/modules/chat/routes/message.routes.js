/**
 * Message Routes
 * Routes for chat messages
 */
const express = require('express');
const router = express.Router();
const { requireChatAuth } = require('../../chat-auth/middleware/requireChatAuth');
const {
  getGroupMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  togglePinMessage,
  getPinnedMessages,
  markAsRead,
  searchMessages,
  getUnreadCount,
} = require('../controllers/message.controller');
const { requireChatAccess } = require('../middleware/chatAccess');

// All routes require authentication and chat access
router.use(requireChatAuth);
router.use(requireChatAccess);

// Send message (REST fallback)
router.post('/', sendMessage);

// Message operations
router.put('/:id', editMessage);
router.delete('/:id', deleteMessage);
router.post('/:id/pin', togglePinMessage);

// Group message routes
router.get('/group/:groupId', getGroupMessages);
router.get('/group/:groupId/pinned', getPinnedMessages);
router.post('/group/:groupId/read', markAsRead);
router.get('/group/:groupId/search', searchMessages);
router.get('/group/:groupId/unread-count', getUnreadCount);

module.exports = router;
