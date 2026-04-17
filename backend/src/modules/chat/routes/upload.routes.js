/**
 * Upload Routes
 * Routes for file uploads in chat
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, optionalAuth } = require('../../../shared/middleware/auth');
const {
  uploadGroupFile,
  uploadDirectFile,
  uploadGroupVoice,
  uploadDirectVoice,
  serveFile,
} = require('../controllers/upload.controller');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max (videos)
});

// Configure multer for voice uploads
const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// File serving route (public access for media elements)
router.get('/files/*', serveFile);

// All other routes require authentication and chat access
const { requireChatAccess } = require('../middleware/chatAccess');
router.use(protect);
router.use(requireChatAccess);

// File uploads
router.post('/group/:groupId/file', upload.single('file'), uploadGroupFile);
router.post('/direct/:receiverId/file', upload.single('file'), uploadDirectFile);

// Voice uploads
router.post('/group/:groupId/voice', voiceUpload.single('voice'), uploadGroupVoice);
router.post('/direct/:receiverId/voice', voiceUpload.single('voice'), uploadDirectVoice);

module.exports = router;
