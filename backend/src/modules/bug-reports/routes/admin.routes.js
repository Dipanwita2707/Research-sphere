/**
 * Admin Routes
 * Admin-only routes for bug report management
 */

const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');
const {
  adminDashboardLimiter,
  searchQueryLimiter,
} = require('../../../shared/middleware/rateLimiter');
const {
  validateBugReportListing,
  validateBugReportId,
  validateResolutionStatusUpdate,
  checkValidationResult,
} = require('../validators/bugReport.validators');

// Get all bug reports with filtering, search, and pagination
// GET /api/admin/bug-reports
router.get(
  '/',
  protect, // Require authentication
  restrictTo('admin', 'superadmin'), // Require admin or super_admin role
  adminDashboardLimiter, // Rate limit: 100 requests per minute
  searchQueryLimiter, // Rate limit: 30 search requests per minute
  validateBugReportListing, // Validate query parameters
  checkValidationResult,
  adminController.getAllBugReports
);

// Get detailed information for a specific bug report
// GET /api/admin/bug-reports/:id
router.get(
  '/:id',
  protect, // Require authentication
  restrictTo('admin', 'superadmin'), // Require admin or super_admin role
  adminDashboardLimiter, // Rate limit: 100 requests per minute
  validateBugReportId, // Validate bug report ID
  checkValidationResult,
  adminController.getBugReportById
);

// Update resolution status of a bug report
// PATCH /api/admin/bug-reports/:id/status
router.patch(
  '/:id/status',
  protect, // Require authentication
  restrictTo('admin', 'superadmin'), // Require admin or super_admin role
  adminDashboardLimiter, // Rate limit: 100 requests per minute
  validateResolutionStatusUpdate, // Validate request body and params
  checkValidationResult,
  adminController.updateResolutionStatus
);

module.exports = router;
