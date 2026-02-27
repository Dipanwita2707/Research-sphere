/**
 * Status Routes
 * Routes for online/offline status and privacy
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const {
  getUserStatus,
  getBulkStatus,
  getGroupOnlineMembers,
  updatePrivacy,
  getPrivacy,
} = require('../controllers/status.controller');
const { requireChatAccess } = require('../middleware/chatAccess');

// All routes require authentication and chat access
router.use(protect);
router.use(requireChatAccess);

// Privacy settings
router.get('/privacy', getPrivacy);
router.put('/privacy', updatePrivacy);

// Get single user status
router.get('/user/:userId', getUserStatus);

// Get bulk user status
router.post('/bulk', getBulkStatus);

// Get online members for a group
router.get('/group/:groupId/online', getGroupOnlineMembers);

module.exports = router;
