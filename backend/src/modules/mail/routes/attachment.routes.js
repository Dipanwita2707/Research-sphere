/**
 * Attachment Routes
 * File upload for mail attachments
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const { uploadMiddleware, uploadFiles } = require('../controllers/attachment.controller');

// All routes require authentication
router.use(protect);

// Upload files
router.post('/upload', uploadMiddleware, uploadFiles);

module.exports = router;
