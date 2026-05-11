const express = require('express');
const router = express.Router();
const controller = require('../controllers/drdAnalytics.controller');
const { protect, checkPermission } = require('../../../shared/middleware/auth');

router.use(protect);

// Applicant analytics — requires applicant_analytics permission
router.get('/applicant', checkPermission('applicant_analytics'), controller.getApplicantAnalytics);
router.get('/applicant/category-breakdown', checkPermission('applicant_analytics'), controller.getCategoryBreakdown);
router.get('/applicant/schools/:schoolId', checkPermission('applicant_analytics'), controller.getApplicantSchoolAnalytics);
router.get('/applicant/departments/:departmentId', checkPermission('applicant_analytics'), controller.getApplicantDepartmentAnalytics);
router.get('/applicant/people/:personId', checkPermission('applicant_analytics'), controller.getApplicantPersonAnalytics);
router.get('/applicant/people/:personId/submissions', checkPermission('applicant_analytics'), controller.getApplicantPersonSubmissions);

// DRD member analytics — requires drd_member_analytics permission
router.get('/drd-member', checkPermission('drd_member_analytics'), controller.getDrdMemberAnalytics);
router.get('/drd-member/reviewers/:reviewerId', checkPermission('drd_member_analytics'), controller.getReviewerAnalytics);
router.get('/drd-member/performance', checkPermission('drd_member_analytics'), controller.getDrdMemberPerformance);
router.get('/drd-member/performance/:reviewerId', checkPermission('drd_member_analytics'), controller.getReviewerPerformanceDetail);

// Progress Tracker analytics — requires applicant_analytics permission
router.get('/progress-tracker', checkPermission('applicant_analytics'), controller.getProgressTrackerAnalytics);
router.get('/progress-tracker/records', checkPermission('applicant_analytics'), controller.getProgressTrackerRecords);

// Contributions list — requires applicant_analytics permission
router.get('/applicant/contributions', checkPermission('applicant_analytics'), controller.getContributionsList);

// External co-author affiliations — for Global Research Network globe
router.get('/applicant/affiliations', checkPermission('applicant_analytics'), controller.getAffiliations);

module.exports = router;
