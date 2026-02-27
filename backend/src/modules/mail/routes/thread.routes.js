/**
 * Thread Routes
 * View thread conversations
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const { requireThreadAccess } = require('../middleware/mailAccess');
const threadController = require('../controllers/thread.controller');

// All routes require authentication
router.use(protect);

// Get thread conversation (with access check)
router.get('/:threadId', requireThreadAccess, threadController.getThread);

module.exports = router;
