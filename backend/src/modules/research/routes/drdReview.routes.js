const express = require('express');
const router = express.Router();
const drdReviewController = require('../controllers/drdReview.controller');
const { protect, requirePermission, requireAnyPermission, checkIprTenantAccess } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// DRD Team Member routes - Review IPR Applications permission
router.get('/pending', requireAnyPermission('central-department', ['ipr_review', 'ipr_approve']), drdReviewController.getPendingDrdReviews);
router.get('/statistics', requireAnyPermission('central-department', ['ipr_review', 'ipr_approve']), drdReviewController.getDrdReviewStatistics);
router.post('/assign/:id', requirePermission('central-department', 'ipr_approve'), checkIprTenantAccess, drdReviewController.assignDrdReviewer);
router.post('/review/:id', requirePermission('central-department', 'ipr_review'), checkIprTenantAccess, drdReviewController.submitDrdReview);
router.post('/accept-edits/:id', requirePermission('central-department', 'ipr_review'), checkIprTenantAccess, drdReviewController.acceptEditsAndResubmit);

// Request changes - Review permission
router.post('/request-changes/:id', requirePermission('central-department', 'ipr_review'), checkIprTenantAccess, drdReviewController.requestChanges);

// Recommend to Head - Review permission (recommend is part of review)
router.post('/recommend/:id', requirePermission('central-department', 'ipr_review'), checkIprTenantAccess, drdReviewController.recommendToHead);

// DRD Head Approval routes - Final Approve permission
router.post('/head-approve/:id', requirePermission('central-department', 'ipr_approve'), checkIprTenantAccess, drdReviewController.headApproveAndSubmitToGovt);
router.post('/approve/:id', requirePermission('central-department', 'ipr_approve'), checkIprTenantAccess, drdReviewController.finalApproval);
router.post('/reject/:id', requirePermission('central-department', 'ipr_approve'), checkIprTenantAccess, drdReviewController.finalRejection);

// Government Filing & Publication - Only Reviewers (ipr_review), NOT DRD Head
// DRD Head can view but not fill these - this is the reviewer's task after head approval
router.post('/govt-application/:id', requirePermission('central-department', 'ipr_review'), checkIprTenantAccess, drdReviewController.addGovtApplicationId);
router.post('/publication/:id', requirePermission('central-department', 'ipr_review'), checkIprTenantAccess, drdReviewController.addPublicationId);
router.post('/mark-govt-rejected/:id', requirePermission('central-department', 'ipr_review'), checkIprTenantAccess, drdReviewController.markGovtRejected);

// Status Updates - For DRD to communicate with applicants/inventors (hearings, document requests, milestones)
router.post('/status-update/:id', requireAnyPermission('central-department', ['ipr_review', 'ipr_approve']), checkIprTenantAccess, drdReviewController.addStatusUpdate);
router.get('/status-updates/:id', checkIprTenantAccess, drdReviewController.getStatusUpdates);  // Accessible by applicant, inventors, and DRD
router.delete('/status-update/:updateId', requireAnyPermission('central-department', ['ipr_review', 'ipr_approve']), checkIprTenantAccess, drdReviewController.deleteStatusUpdate);

// System Override - Approve permission (DRD Head level)
router.post('/system-override/:id', requirePermission('central-department', 'ipr_approve'), checkIprTenantAccess, drdReviewController.systemOverride);

module.exports = router;
