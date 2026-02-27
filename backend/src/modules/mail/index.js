/**
 * Mail Module
 * Internal Gmail-like mailing system for UMS ERP
 * Handles threaded conversations, CC/BCC, labels, drafts, and search
 */
const router = require('express').Router();
const composeRoutes = require('./routes/compose.routes');
const inboxRoutes = require('./routes/inbox.routes');
const threadRoutes = require('./routes/thread.routes');
const labelRoutes = require('./routes/label.routes');
const searchRoutes = require('./routes/search.routes');
const draftRoutes = require('./routes/draft.routes');
const attachmentRoutes = require('./routes/attachment.routes');

// Compose & send mail
router.use('/compose', composeRoutes);

// Inbox, Sent, Trash views
router.use('/inbox', inboxRoutes);

// Thread operations
router.use('/threads', threadRoutes);

// Label management
router.use('/labels', labelRoutes);

// Search
router.use('/search', searchRoutes);

// Drafts
router.use('/drafts', draftRoutes);

// Attachments
router.use('/attachments', attachmentRoutes);

module.exports = router;
