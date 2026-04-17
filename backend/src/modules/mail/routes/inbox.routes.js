/**
 * Inbox Routes
 * Inbox, Sent, Starred, Trash views + actions
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const inboxController = require('../controllers/inbox.controller');

// All routes require authentication
router.use(protect);

// Views
router.get('/', inboxController.getInbox);
router.get('/sent', inboxController.getSent);
router.get('/starred', inboxController.getStarred);
router.get('/trash', inboxController.getTrash);
router.get('/counts', inboxController.getCounts);

// Actions
router.post('/mark-read/:threadId', inboxController.markRead);
router.post('/mark-unread/:threadId', inboxController.markUnread);
router.post('/star/:threadId', inboxController.toggleStar);
router.delete('/delete/:threadId', inboxController.deleteThread);
router.post('/restore/:threadId', inboxController.restoreThread);
router.post('/archive/:threadId', inboxController.archiveThread);
router.post('/unarchive/:threadId', inboxController.unarchiveThread);

module.exports = router;
