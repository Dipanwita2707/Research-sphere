/**
 * Research Contribution Routes
 * Handles all routes for research paper, book, conference, and grant submissions
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const researchContributionController = require('../controllers/contribution.controller');
const researchReviewController = require('../controllers/review.controller');
const { protect, requirePermission, checkResearchFilePermission } = require('../../../shared/middleware/auth');
const prisma = require('../../../shared/config/database');

// Configure multer with memory storage for S3 uploads
const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-compressed',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    files: 11, // Allow up to 11 files total (1 main + 10 supporting)
  },
});

// Helper middleware: Allow either research_review OR research_approve permission
// Uses merged permissions from req.user (includes both direct and role-based permissions)
const requireResearchAccess = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    // Merge all DRD permissions from req.user (includes both direct and role-based)
    let mergedPermissions = {};
    
    if (req.user?.centralDeptPermissions && Array.isArray(req.user.centralDeptPermissions)) {
      req.user.centralDeptPermissions.forEach(deptPerm => {
        if (deptPerm.permissions) {
          // Merge all permissions (role-based are already included by auth middleware)
          Object.assign(mergedPermissions, deptPerm.permissions);
        }
      });
    }

    // Check for research-related permissions
    const hasReviewPerm = mergedPermissions.research_review === true || 
                          mergedPermissions.book_review === true ||
                          mergedPermissions.conference_review === true ||
                          mergedPermissions.grant_review === true;
    const hasApprovePerm = mergedPermissions.research_approve === true ||
                           mergedPermissions.book_approve === true ||
                           mergedPermissions.conference_approve === true ||
                           mergedPermissions.grant_approve === true;

    if (!hasReviewPerm && !hasApprovePerm) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - review or approve permission required'
      });
    }

    next();
  } catch (error) {
    console.error('Research access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify permissions',
      error: error.message
    });
  }
};

// =====================================
// Research Contribution Routes (Filing)
// =====================================
// Get my research contributions
router.get(
  '/my-contributions',
  protect,
  researchContributionController.getMyResearchContributions
);

// Get contributions where I am a co-author
router.get(
  '/contributed',
  protect,
  researchContributionController.getContributedResearch
);

// Lookup user by registration number
router.get(
  '/lookup/:registrationNumber',
  protect,
  researchContributionController.lookupByRegistration
);

// Get incentive policies
router.get(
  '/incentive-policies',
  protect,
  researchContributionController.getIncentivePolicies
);

// Create new research contribution
router.post(
  '/',
  protect,
  checkResearchFilePermission,
  researchContributionController.createResearchContribution
);

// Get single research contribution
router.get(
  '/:id',
  protect,
  researchContributionController.getResearchContributionById
);

// Update research contribution (draft or changes_required)
router.put(
  '/:id',
  protect,
  researchContributionController.updateResearchContribution
);

// Submit research contribution
router.post(
  '/:id/submit',
  protect,
  researchContributionController.submitResearchContribution
);

// =====================================
// Mentor Routes (for student submissions)
// =====================================
// Get pending mentor approvals
router.get(
  '/mentor/pending',
  protect,
  researchContributionController.getPendingMentorApprovals
);

// Mentor approve contribution
router.post(
  '/:id/mentor-approve',
  protect,
  researchContributionController.mentorApproveContribution
);

// Mentor reject contribution
router.post(
  '/:id/mentor-reject',
  protect,
  researchContributionController.mentorRejectContribution
);

// =====================================
// Resubmit after changes
router.post(
  '/:id/resubmit',
  protect,
  researchContributionController.resubmitResearchContribution
);

// Delete research contribution (draft only)
router.delete(
  '/:id',
  protect,
  researchContributionController.deleteResearchContribution
);

// =====================================
// Document Upload Routes
// =====================================
// Upload documents for research contribution
router.post(
  '/:id/documents',
  protect,
  upload.fields([
    { name: 'researchDocument', maxCount: 1 },
    { name: 'supportingDocuments', maxCount: 10 }
  ]),
  researchContributionController.uploadDocuments
);

// Download research document or supporting document
router.get(
  '/:id/documents/:type/:filename',
  protect,
  researchContributionController.downloadDocument
);

// =====================================
// Author Management Routes
// =====================================
// Add author to contribution
router.post(
  '/:id/authors',
  protect,
  researchContributionController.addAuthor
);

// Update author
router.put(
  '/:id/authors/:authorId',
  protect,
  researchContributionController.updateAuthor
);

// Remove author
router.delete(
  '/:id/authors/:authorId',
  protect,
  researchContributionController.removeAuthor
);

// =====================================
// DRD Review Routes
// =====================================
// Get pending reviews (DRD - reviewers and approvers)
router.get(
  '/review/pending',
  protect,
  requireResearchAccess,
  researchReviewController.getPendingReviews
);

// Get review statistics (DRD - reviewers and approvers)
router.get(
  '/review/statistics',
  protect,
  requireResearchAccess,
  researchReviewController.getReviewStatistics
);

router.get(
  '/review/health',
  protect,
  requirePermission('central-department', 'research_approve'),
  researchReviewController.getWorkflowHealthSummary
);

// Get schools for filtering (DRD - reviewers and approvers)
router.get(
  '/review/schools',
  protect,
  requireResearchAccess,
  researchReviewController.getSchoolsForFilter
);

// Start review
router.post(
  '/:id/review/start',
  protect,
  requirePermission('central-department', 'research_review'),
  researchReviewController.startReview
);

// Request changes
router.post(
  '/:id/review/request-changes',
  protect,
  requirePermission('central-department', 'research_review'),
  researchReviewController.requestChanges
);

// Recommend for approval (Reviewer with research_review permission)
router.post(
  '/:id/review/recommend',
  protect,
  requirePermission('central-department', 'research_review'),
  researchReviewController.recommendForApproval
);

// Approve contribution (DRD Head)
router.post(
  '/:id/review/approve',
  protect,
  requirePermission('central-department', 'research_approve'),
  researchReviewController.approveContribution
);

// Reject contribution
router.post(
  '/:id/review/reject',
  protect,
  requirePermission('central-department', 'research_approve'),
  researchReviewController.rejectContribution
);

// Mark as completed
router.post(
  '/:id/review/complete',
  protect,
  requirePermission('central-department', 'research_approve'),
  researchReviewController.markCompleted
);

// =====================================
// Edit Suggestion Routes
// =====================================
// Respond to edit suggestion (applicant)
router.post(
  '/suggestions/:suggestionId/respond',
  protect,
  researchReviewController.respondToSuggestion
);

module.exports = router;
