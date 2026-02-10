/**
 * DSW Club Routes
 * Routes for club management operations
 */

const express = require('express');
const router = express.Router();
const clubController = require('../controllers/clubController');
const auditController = require('../controllers/auditController');
const { protect } = require('../../../shared/middleware/auth');
const {
  validateClubId,
  validateAddMember,
  validateRemoveMember,
  validateGetClubs,
} = require('../validators');
const {
  canViewClub,
  canManageMembers,
  canViewAuditLogs,
} = require('../middleware/rbac');

// Get all clubs with filtering
router.get('/', protect, canViewClub, validateGetClubs, clubController.getClubs);

// Create club creation noting (faculty submits → noting created → DSW approves → club created)
router.post('/', protect, clubController.createClub);

// Get my clubs
router.get('/my', protect, canViewClub, clubController.getMyClubs);

// Get club by ID
router.get('/:clubId', protect, canViewClub, validateClubId, clubController.getClubById);

// Update club editable fields
router.patch('/:clubId', protect, canManageMembers, validateClubId, clubController.updateClub);

// Get club members
router.get('/:clubId/members', protect, canViewClub, validateClubId, clubController.getClubMembers);

// Add member to club
router.post('/:clubId/members', protect, canManageMembers, validateAddMember, clubController.addMember);

// Remove member from club
router.delete('/:clubId/members/:memberId', protect, canManageMembers, validateRemoveMember, clubController.removeMember);

// Get club audit logs
router.get('/:clubId/audit-logs', protect, canViewAuditLogs, validateClubId, auditController.getClubAuditLogs);

module.exports = router;
