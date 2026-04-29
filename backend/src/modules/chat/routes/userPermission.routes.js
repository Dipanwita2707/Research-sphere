/**
 * User Permission Routes
 * Routes for managing individual user-level chat permissions
 * 
 * Admin routes: Manage which users can access chat and their permissions
 * User routes: Check own permissions
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { restrictTo } = require('../../../shared/middleware/auth');
const { requireChatAuth } = require('../../chat-auth/middleware/requireChatAuth');
const {
  getAuthorizedUsers,
  getUserPermission,
  getMyPermissions,
  addUser,
  bulkAddUsers,
  updateUserPermissions,
  removeUser,
  toggleUserChat,
  getStats,
  searchUnaddedUsers,
} = require('../controllers/userPermission.controller');

// Configure multer for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

// All routes require authentication
router.use(requireChatAuth);

// User routes - check own permissions
router.get('/me', getMyPermissions);

// Admin-only routes
router.get('/stats', restrictTo('superadmin', 'admin'), getStats);
router.get('/users', restrictTo('superadmin', 'admin'), getAuthorizedUsers);
router.get('/users/search-unadded', restrictTo('superadmin', 'admin'), searchUnaddedUsers);
router.get('/users/:userId', restrictTo('superadmin', 'admin'), getUserPermission);
router.post('/users', restrictTo('superadmin', 'admin'), addUser);
router.post('/users/bulk', restrictTo('superadmin', 'admin'), upload.single('file'), bulkAddUsers);
router.put('/users/:userId', restrictTo('superadmin', 'admin'), updateUserPermissions);
router.delete('/users/:userId', restrictTo('superadmin', 'admin'), removeUser);
router.patch('/users/:userId/toggle', restrictTo('superadmin', 'admin'), toggleUserChat);

module.exports = router;
