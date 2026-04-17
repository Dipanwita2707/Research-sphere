/**
 * Compose Routes
 * Send new mail, reply, reply-all, forward
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const { validateStudentSend } = require('../middleware/mailAccess');
const composeController = require('../controllers/compose.controller');

// All routes require authentication
router.use(protect);

// Send new mail
router.post('/send', validateStudentSend, composeController.send);

// Reply to a message (sender only)
router.post('/reply/:messageId', composeController.reply);

// Reply-all (all TO + CC)
router.post('/reply-all/:messageId', composeController.replyAll);

// Forward (creates new thread)
router.post('/forward/:messageId', validateStudentSend, composeController.forward);

module.exports = router;
