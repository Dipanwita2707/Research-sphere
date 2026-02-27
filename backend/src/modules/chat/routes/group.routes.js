/**
 * Group Routes
 * Routes for chat group management
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, restrictTo } = require('../../../shared/middleware/auth');
const { requireChatAccess, requireUserPermission } = require('../middleware/chatAccess');
const {
  createGroup,
  getMyGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addMember,
  bulkAddMembers,
  removeMember,
  updateMemberRole,
  updateMemberPermissions,
  updateGroupPermissions,
  searchMembers,
  muteMember,
  unmuteMember,
  leaveGroup,
} = require('../controllers/group.controller');

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

// All routes require authentication and chat access
router.use(protect);
router.use(requireChatAccess);

// Group CRUD
router.post('/', restrictTo('superadmin', 'admin'), requireUserPermission('canCreateGroup'), createGroup);
router.get('/', getMyGroups);
router.get('/:id', getGroup);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);

// Leave group
router.post('/:id/leave', leaveGroup);

// Member management
router.post('/:id/members', addMember);
router.post('/:id/members/bulk', upload.single('file'), bulkAddMembers);
router.delete('/:id/members/:userId', removeMember);
router.put('/:id/members/:userId/role', updateMemberRole);
router.put('/:id/members/:userId/permissions', updateMemberPermissions);
router.post('/:id/members/:userId/mute', muteMember);
router.post('/:id/members/:userId/unmute', unmuteMember);

// Search members
router.get('/:id/members/search', searchMembers);

// Group permissions
router.put('/:id/permissions', updateGroupPermissions);

module.exports = router;
