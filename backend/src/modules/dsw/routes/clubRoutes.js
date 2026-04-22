/**
 * DSW Club Routes
 * Routes for club management operations
 */

const express = require("express");
const router = express.Router();
const clubController = require("../controllers/clubController");
const auditController = require("../controllers/auditController");
const { protect } = require("../../../shared/middleware/auth");
const {
  validateClubCreation,
  validateDirectClubCreation,
  validateClubId,
  validateClubUpdate,
  validateAddMember,
  validateRemoveMember,
  validateGetClubs,
  validateClubApplicationCreate,
  validateClubApplicationReview,
  validateMemberRoleUpdate,
  validateClubLeadershipUpdate,
} = require("../validators");
const {
  canViewClub,
  canManageMembers,
  canViewAuditLogs,
  isDSWAdmin,
} = require("../middleware/rbac");

// Get all clubs with filtering
router.get(
  "/",
  protect,
  canViewClub,
  validateGetClubs,
  clubController.getClubs,
);

// Create club creation noting (faculty submits → noting created → DSW approves → club created)
router.post("/", protect, validateClubCreation, clubController.createClub);

// Admin direct club creation (bypasses noting workflow)
router.post(
  "/admin/create-direct",
  protect,
  isDSWAdmin,
  validateDirectClubCreation,
  clubController.createClubDirect,
);

// Get my club creation requests (pending notings initiated by the logged-in student)
router.get("/my-requests", protect, clubController.getMyClubRequests);

// Patch old club creation notings to backfill the student's UUID into clubInitialMembers
// (one-time repair for notings created before the fix)
router.post(
  "/my-requests/patch-old",
  protect,
  clubController.patchOldClubRequests,
);

// Get my clubs
router.get("/my", protect, canViewClub, clubController.getMyClubs);

// Get my club applications
router.get("/applications/my", protect, clubController.getMyClubApplications);

// Get club by ID
router.get(
  "/:clubId",
  protect,
  canViewClub,
  validateClubId,
  clubController.getClubById,
);

// Update club editable fields
router.patch(
  "/:clubId",
  protect,
  canManageMembers,
  validateClubUpdate,
  clubController.updateClub,
);

// Update chairperson / faculty facilitator assignments
router.patch(
  "/:clubId/leadership",
  protect,
  canManageMembers,
  validateClubLeadershipUpdate,
  clubController.updateClubLeadership,
);

// Get club members
router.get(
  "/:clubId/members",
  protect,
  canViewClub,
  validateClubId,
  clubController.getClubMembers,
);

// Student applies to join a club
router.post(
  "/:clubId/applications",
  protect,
  validateClubApplicationCreate,
  clubController.createClubApplication,
);

// Club owner/facilitator reviews applications
router.get(
  "/:clubId/applications",
  protect,
  canManageMembers,
  validateClubId,
  clubController.getClubApplications,
);

router.patch(
  "/:clubId/applications/:applicationId/review",
  protect,
  canManageMembers,
  validateClubApplicationReview,
  clubController.reviewClubApplication,
);

// Add member to club
router.post(
  "/:clubId/members",
  protect,
  canManageMembers,
  validateAddMember,
  clubController.addMember,
);

// Update member role
router.patch(
  "/:clubId/members/:memberId/role",
  protect,
  canManageMembers,
  validateMemberRoleUpdate,
  clubController.updateMemberRole,
);

// Remove member from club
router.delete(
  "/:clubId/members/:memberId",
  protect,
  canManageMembers,
  validateRemoveMember,
  clubController.removeMember,
);

// Get club audit logs
router.get(
  "/:clubId/audit-logs",
  protect,
  canViewAuditLogs,
  validateClubId,
  auditController.getClubAuditLogs,
);

// Get events linked to this club
router.get(
  "/:clubId/events",
  protect,
  canViewClub,
  validateClubId,
  clubController.getClubEvents,
);

module.exports = router;
