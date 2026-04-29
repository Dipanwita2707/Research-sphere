/**
 * Group Routes
 * Routes for chat group management
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { restrictTo } = require('../../../shared/middleware/auth');
const { requireChatAuth } = require('../../chat-auth/middleware/requireChatAuth');
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
  searchUsersToAdd,
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
router.use(requireChatAuth);
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

// Search members (existing) and users to add
router.get('/:id/members/search', searchMembers);
router.get('/:id/members/search-users', searchUsersToAdd);

// Group permissions
router.put('/:id/permissions', updateGroupPermissions);

module.exports = router;
