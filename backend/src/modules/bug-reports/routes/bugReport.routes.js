/**
 * Bug Report Routes
 * Public routes for bug report submission and retrieval
 */

const router = require('express').Router();
const multer = require('multer');
const bugReportController = require('../controllers/bugReport.controller');
const { protect } = require('../../../shared/middleware/auth');
const {
  bugReportSubmissionLimiter,
  screenshotUploadLimiter,
} = require('../../../shared/middleware/rateLimiter');
const {
  validateBugReportSubmission,
  validateBugReportId,
  validateScreenshotId,
  checkValidationResult,
  validateScreenshots,
} = require('../validators/bugReport.validators');

// Configure multer for memory storage (files stored in memory as Buffer)
// This allows us to process files before saving to disk/S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5, // Maximum 5 files
  },
});

// Submit a new bug report with optional screenshots
// POST /api/bug-reports
router.post(
  '/',
  protect, // Require authentication
  bugReportSubmissionLimiter, // Rate limit: 10 reports per hour per user
  screenshotUploadLimiter, // Rate limit: 50 uploads per hour per user
  upload.array('screenshots', 5), // Accept up to 5 screenshot files
  validateScreenshots, // Validate uploaded files
  validateBugReportSubmission, // Validate request body
  checkValidationResult, // Check for validation errors
  bugReportController.submitBugReport
);

// Get screenshots for a bug report
// GET /api/bug-reports/:id/screenshots
router.get(
  '/:id/screenshots',
  protect, // Require authentication
  validateBugReportId, // Validate bug report ID
  checkValidationResult,
  bugReportController.getScreenshots
);

// Download a specific screenshot
// GET /api/bug-reports/screenshots/:screenshotId
router.get(
  '/screenshots/:screenshotId',
  protect, // Require authentication
  validateScreenshotId, // Validate screenshot ID
  checkValidationResult,
  bugReportController.downloadScreenshot
);

// Download a screenshot thumbnail
// GET /api/bug-reports/screenshots/:screenshotId/thumbnail
router.get(
  '/screenshots/:screenshotId/thumbnail',
  protect, // Require authentication
  validateScreenshotId, // Validate screenshot ID
  checkValidationResult,
  bugReportController.downloadThumbnail
);

module.exports = router;
