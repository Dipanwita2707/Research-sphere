const express = require('express');
const router = express.Router();
const iprController = require('../controllers/ipr.controller');
const { protect, restrictTo, requirePermission, requireAnyPermission, checkIprFilePermission, checkIprTenantAccess } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// Applicant routes - available to users with file/edit own permissions
router.get('/my-applications', iprController.getMyIprApplications);
router.get('/my-applications/:id', checkIprTenantAccess, iprController.getMyIprApplicationById);  // View own application details
router.get('/my-published-provisionals', iprController.getMyPublishedProvisionals);  // Get published provisionals for complete filing conversion
router.get('/contributed', iprController.getContributedIprApplications);  // Get applications where user is a contributor
router.get('/contributed/:id', checkIprTenantAccess, iprController.getContributedIprApplicationById);  // View single contributed application
// IPR Filing: Faculty/Student can file by default, Staff needs ipr_file_new permission from admin
router.post('/create', checkIprFilePermission, iprController.createIprApplication);
router.post('/:id/submit', checkIprTenantAccess, iprController.submitIprApplication);
router.post('/:id/resubmit', checkIprTenantAccess, iprController.resubmitIprApplication);
router.put('/:id', checkIprTenantAccess, iprController.updateIprApplication);  // Edit own handled in controller
router.delete('/:id', requireAnyPermission('central-department', ['ipr_delete', 'ipr_edit_all']), checkIprTenantAccess, iprController.deleteIprApplication);

// Mentor approval routes (for faculty mentors)
router.get('/mentor/pending', restrictTo('faculty', 'admin'), iprController.getPendingMentorApprovals);
router.get('/mentor/history', restrictTo('faculty', 'admin'), iprController.getMentorReviewHistory);  // Mentor's review history
router.get('/mentor/application/:id', restrictTo('faculty', 'admin'), checkIprTenantAccess, iprController.getMentorApplicationById);  // View application as mentor
router.post('/mentor/:id/approve', restrictTo('faculty', 'admin'), checkIprTenantAccess, iprController.approveMentorApplication);
router.post('/mentor/:id/reject', restrictTo('faculty', 'admin'), checkIprTenantAccess, iprController.rejectMentorApplication);

// Admin/DRD routes - require appropriate permissions
router.get('/statistics', requireAnyPermission('central-department', ['ipr_analytics', 'ipr_all_dashboard']), iprController.getIprStatistics);
router.get('/stats', requireAnyPermission('central-department', ['ipr_analytics', 'ipr_all_dashboard']), iprController.getIprStatistics);
router.get('/:id', requireAnyPermission('central-department', ['ipr_all_dashboard', 'ipr_own_dashboard', 'ipr_review', 'ipr_approve']), checkIprTenantAccess, iprController.getIprApplicationById);
router.get('/', requireAnyPermission('central-department', ['ipr_all_dashboard', 'ipr_own_dashboard', 'ipr_review', 'ipr_approve']), iprController.getAllIprApplications);

module.exports = router;
