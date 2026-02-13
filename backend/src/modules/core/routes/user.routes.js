const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../../shared/middleware/auth');
const userController = require('../controllers/user.controller');

// Get all users (admin/superadmin - for permission management)
// TODO: Transfer to HR module when implemented
router.get('/', protect, restrictTo('admin', 'superadmin'), userController.getAllUsers);

// Test route to check if routing works
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'User routes working!' });
});

// Search users by partial UID for suggestions (available to all authenticated users)
router.get('/suggestions/:query', userController.searchUsersByPartialUid);

// Search user by UID for auto-fill (temporarily without auth for testing)
router.get('/search/:uid', userController.searchUserByUid);

// Get user by ID (admin only)
// TODO: Transfer to HR module when implemented
router.get('/:userId', protect, restrictTo('admin'), userController.getUserById);

// Permission management routes (for admin UI checkboxes)
// Get the IPR permissions configuration (structure for UI checkboxes)
router.get('/permissions/ipr-config', protect, restrictTo('admin', 'central_admin'), userController.getIprPermissionsConfig);

// Get user permissions by user ID
router.get('/permissions/:userId', protect, restrictTo('admin', 'central_admin'), userController.getUserPermissions);

// Update user IPR permissions (admin checkbox UI)
router.put('/permissions/:userId/ipr', protect, restrictTo('admin', 'central_admin'), userController.updateUserIprPermissions);

module.exports = router;
