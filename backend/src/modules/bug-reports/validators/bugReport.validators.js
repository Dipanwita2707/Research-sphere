/**
 * Bug Report Validators
 * Input validation for bug report endpoints
 */

const { body, param, query, validationResult } = require('express-validator');

// Constants for file validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const MAX_SCREENSHOT_COUNT = 5;
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

/**
 * Validation rules for bug report submission
 */
const validateBugReportSubmission = [
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('pageUrl')
    .trim()
    .isLength({ min: 1, max: 2048 })
    .withMessage('Page URL is required and must not exceed 2048 characters'),
  body('routePath')
    .trim()
    .isLength({ min: 1, max: 512 })
    .withMessage('Route path is required and must not exceed 512 characters'),
  body('userIdentifier')
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('User identifier is required and must not exceed 64 characters'),
  body('userRole')
    .trim()
    .isLength({ min: 1, max: 32 })
    .withMessage('User role is required and must not exceed 32 characters'),
  body('userEmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),
];

/**
 * Validation rules for resolution status update
 */
const validateResolutionStatusUpdate = [
  param('id')
    .isUUID()
    .withMessage('Invalid bug report ID'),
  body('status')
    .isIn(['resolved', 'unresolved'])
    .withMessage('Status must be either "resolved" or "unresolved"'),
];

/**
 * Validation rules for bug report ID parameter
 */
const validateBugReportId = [
  param('id')
    .isUUID()
    .withMessage('Invalid bug report ID'),
];

/**
 * Validation rules for screenshot ID parameter
 */
const validateScreenshotId = [
  param('screenshotId')
    .isUUID()
    .withMessage('Invalid screenshot ID'),
];

/**
 * Validation rules for admin bug report listing
 */
const validateBugReportListing = [
  query('status')
    .optional()
    .isIn(['all', 'resolved', 'unresolved'])
    .withMessage('Status must be "all", "resolved", or "unresolved"'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Search term must not exceed 255 characters'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'resolutionStatus', 'userRole'])
    .withMessage('Invalid sort field'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be "asc" or "desc"'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

/**
 * Middleware to check validation results
 */
const checkValidationResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Validate screenshot files from multipart/form-data upload
 * This middleware should be used after multer processes the files
 */
const validateScreenshots = (req, res, next) => {
  // If no files uploaded, that's valid (screenshots are optional)
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const errors = [];

  // Validate screenshot count
  if (req.files.length > MAX_SCREENSHOT_COUNT) {
    errors.push({
      field: 'screenshots',
      message: `Maximum ${MAX_SCREENSHOT_COUNT} screenshots allowed. You uploaded ${req.files.length} files.`,
    });
  }

  // Validate each file
  req.files.forEach((file, index) => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push({
        field: `screenshots[${index}]`,
        message: `File "${file.originalname}" exceeds maximum size of 5MB. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
      });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      errors.push({
        field: `screenshots[${index}]`,
        message: `File "${file.originalname}" has invalid type "${file.mimetype}". Allowed types: PNG, JPEG, JPG, GIF, WebP`,
      });
    }
  });

  // If there are validation errors, return them
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      details: errors,
    });
  }

  next();
};

/**
 * Validate individual screenshot file properties
 * Used for more granular validation
 */
const isValidScreenshotType = (mimetype) => {
  return ALLOWED_MIME_TYPES.includes(mimetype);
};

/**
 * Validate screenshot file size
 */
const isValidScreenshotSize = (fileSize) => {
  return fileSize <= MAX_FILE_SIZE;
};

/**
 * Validate screenshot count
 */
const isValidScreenshotCount = (count) => {
  return count >= 0 && count <= MAX_SCREENSHOT_COUNT;
};

module.exports = {
  validateBugReportSubmission,
  validateResolutionStatusUpdate,
  validateBugReportId,
  validateScreenshotId,
  validateBugReportListing,
  checkValidationResult,
  validateScreenshots,
  isValidScreenshotType,
  isValidScreenshotSize,
  isValidScreenshotCount,
  // Export constants for use in other modules
  MAX_FILE_SIZE,
  MAX_SCREENSHOT_COUNT,
  ALLOWED_MIME_TYPES,
};
