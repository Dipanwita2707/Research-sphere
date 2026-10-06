const express = require('express');
const router = express.Router();
const controller = require('../controllers/drdAnalytics.controller');
const { protect, checkPermission: baseCheckPermission, checkAnyPermission: baseCheckAnyPermission } = require('../../../shared/middleware/auth');

router.use(protect);

// Superadmin sees every university (or the one selected via X-University-Id; scoping is
// done by the tenant extension) without holding tenant-level analytics permissions.
const superadminOr = (check) => (req, res, next) => (req.user?.role === 'superadmin' ? next() : check(req, res, next));
const checkPermission = (permissionKey) => superadminOr(baseCheckPermission(permissionKey));

// Applicant analytics can be granted for all categories (applicant_analytics) or per category
// (research / book / conference / IPR / grant). The service resolves which categories the user may
// see and shows only those, so the category-aware endpoints let any of these keys through; the
// service still refuses (403) when none of the categories is allowed.
const APPLICANT_ANALYTICS_KEYS = [
  'applicant_analytics',
  'research_applicant_analytics',
  'book_applicant_analytics',
  'conference_applicant_analytics',
  'ipr_applicant_analytics',
  'grant_applicant_analytics',
];
const checkApplicantAnalytics = superadminOr(baseCheckAnyPermission(APPLICANT_ANALYTICS_KEYS));

// Helper middleware to allow users to view their own profile analytics/submissions
const checkApplicantOrSelf = (req, res, next) => {
  if (req.params.personId === req.user.id) {
    return next();
  }
  return checkApplicantAnalytics(req, res, next);
};

// Applicant analytics — the general key or a per-category one (scoped by the service)
router.get('/applicant', checkApplicantAnalytics, controller.getApplicantAnalytics);
router.get('/applicant/category-breakdown', checkApplicantAnalytics, controller.getCategoryBreakdown);
router.get('/applicant/schools/:schoolId', checkApplicantAnalytics, controller.getApplicantSchoolAnalytics);
router.get('/applicant/departments/:departmentId', checkApplicantAnalytics, controller.getApplicantDepartmentAnalytics);
router.get('/applicant/people/:personId', checkApplicantOrSelf, controller.getApplicantPersonAnalytics);
router.get('/applicant/people/:personId/submissions', checkApplicantOrSelf, controller.getApplicantPersonSubmissions);

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
