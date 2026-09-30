/**
 * Bug Report Controller
 * Handles public bug report submission and retrieval
 */

const bugReportService = require('../services/bugReport.service');
const screenshotService = require('../services/screenshot.service');
const { sanitizeBugReportData } = require('../utils/inputSanitizer');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { resolveLocalFile, sendResolvedFile } = require('../../uploads/fileAccess.service');

// Create module-specific logger
const logger = createModuleLogger('bug-reports');

/**
 * Stream a stored screenshot/thumbnail through the shared upload file server
 * (confined to the upload roots; nosniff, sandbox CSP, private cache headers).
 * Access must already have been checked. Returns false when the file is missing.
 */
const sendStoredFile = (res, storagePath, next) => {
  const segments = String(storagePath || '').split(/[\\/]+/).filter(Boolean);
  if (segments.length === 0 || segments.some((s) => s === '..' || s === '.')) return false;
  const fullPath = resolveLocalFile(segments);
  if (!fullPath) return false;
  sendResolvedFile(res, fullPath, next);
  return true;
};

/**
 * Load a screenshot the caller may see: tenant scoping is automatic (a foreign id is
 * "not found"); within the tenant only the reporter or an admin/superadmin.
 */
const loadAccessibleScreenshot = async (screenshotId, user) => {
  let screenshot;
  try {
    screenshot = await screenshotService.getScreenshotById(screenshotId);
  } catch (error) {
    if (/not found/i.test(error.message)) return null;
    throw error;
  }
  if (!screenshot || !bugReportService.canAccessBugReport(screenshot.bugReport || {}, user)) return null;
  return screenshot;
};

/**
 * Submit a new bug report
 * POST /api/bug-reports
 */
const submitBugReport = async (req, res, next) => {
  try {
    const { description, pageUrl, routePath, userIdentifier, userRole, userEmail } = req.body;
    const files = req.files || []; // Multer attaches files to req.files
    const userId = req.user.id; // From protect middleware

    // Validate required fields (additional validation beyond express-validator)
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required',
      });
    }

    // Sanitize input data to prevent XSS attacks
    const sanitizationResult = sanitizeBugReportData({
      description,
      pageUrl,
      routePath,
      userIdentifier,
      userRole,
      userEmail,
    });

    // Check for sanitization errors (e.g., invalid URL domain)
    if (!sanitizationResult.isValid) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Input validation failed',
        details: sanitizationResult.errors,
      });
    }

    // Use sanitized data
    const sanitizedData = sanitizationResult.sanitized;

    // Create bug report data object with sanitized values
    // Reporter identity always comes from the authenticated session (body values are ignored
    // so a report cannot be filed in someone else's name).
    const bugReportData = {
      userId,
      userRole: req.user.role,
      userIdentifier: req.user.uid || sanitizedData.userIdentifier,
      userEmail: req.user.email || null,
      description: sanitizedData.description,
      pageUrl: sanitizedData.pageUrl,
      routePath: sanitizedData.routePath,
    };

    logger.logUserAction(userId, 'submit_bug_report', 'Submitting new bug report', {
      pageUrl: sanitizedData.pageUrl,
      routePath: sanitizedData.routePath,
      screenshotCount: files.length
    });

    // Screenshots are tenant rows: a superadmin must pick a university to attach them
    if (files.length > 0 && !req.tenantId) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Select a university before attaching screenshots.',
      });
    }

    // Create bug report with screenshots
    const bugReport = await bugReportService.createBugReport(bugReportData, files);

    logger.logUserAction(userId, 'submit_bug_report_success', 'Bug report submitted successfully', {
      bugReportId: bugReport.id,
      screenshotCount: bugReport.screenshots?.length || 0
    });

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Bug report submitted successfully',
      data: bugReport,
    });
  } catch (error) {
    // Log error with context for monitoring
    logger.logError('submit_bug_report', error, {
      userId: req.user?.id,
      userIdentifier: req.body?.userIdentifier,
      pageUrl: req.body?.pageUrl
    });

    // Deliberate validation errors from the service are safe to show
    if (error.isOperational && error.statusCode === 400) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message,
      });
    }

    // Generic server error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};

/**
 * Get screenshots for a bug report
 * GET /api/bug-reports/:id/screenshots
 */
const getScreenshots = async (req, res) => {
  try {
    const { id } = req.params;

    // Get screenshots for the bug report (reporter or admin only)
    const screenshots = await bugReportService.getScreenshots(id, req.user);

    return res.status(200).json({
      success: true,
      data: {
        screenshots,
      },
    });
  } catch (error) {
    // Log error with context
    logger.logError('get_screenshots', error, {
      bugReportId: req.params.id,
      userId: req.user?.id
    });

    // Handle specific error cases
    if (error.statusCode === 404) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Bug report not found',
      });
    }

    // Generic server error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};

/**
 * Download a specific screenshot
 * GET /api/bug-reports/screenshots/:screenshotId
 */
const downloadScreenshot = async (req, res, next) => {
  try {
    const { screenshotId } = req.params;

    // Get screenshot file (404 for missing, foreign-tenant, or not the caller's report)
    const screenshot = await loadAccessibleScreenshot(screenshotId, req.user);

    if (!screenshot) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Screenshot not found',
      });
    }

    // Stream from storage via the shared upload file server
    if (!sendStoredFile(res, screenshot.storagePath, next)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Screenshot file not found in storage',
      });
    }
    return undefined;
  } catch (error) {
    // Log error with context
    logger.logError('download_screenshot', error, {
      screenshotId: req.params.screenshotId,
      userId: req.user?.id
    });

    // Handle specific error cases
    if (error.message === 'Screenshot not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Screenshot not found',
      });
    }

    if (/not found/i.test(error.message || '')) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Screenshot file not found in storage',
      });
    }

    // Generic server error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};

/**
 * Download a screenshot thumbnail
 * GET /api/bug-reports/screenshots/:screenshotId/thumbnail
 */
const downloadThumbnail = async (req, res, next) => {
  try {
    const { screenshotId } = req.params;

    // Get screenshot metadata (404 for missing, foreign-tenant, or not the caller's report)
    const screenshot = await loadAccessibleScreenshot(screenshotId, req.user);

    if (!screenshot) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Screenshot not found',
      });
    }

    // Check if thumbnail exists
    if (!screenshot.thumbnailPath) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Thumbnail not available for this screenshot',
      });
    }

    // Stream from storage via the shared upload file server
    if (!sendStoredFile(res, screenshot.thumbnailPath, next)) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Thumbnail file not found in storage',
      });
    }
    return undefined;
  } catch (error) {
    // Log error with context
    logger.logError('download_thumbnail', error, {
      screenshotId: req.params.screenshotId,
      userId: req.user?.id
    });

    // Handle specific error cases
    if (error.message === 'Screenshot not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Screenshot not found',
      });
    }

    if (/not found/i.test(error.message || '')) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Thumbnail file not found in storage',
      });
    }

    // Generic server error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
};

module.exports = {
  submitBugReport,
  getScreenshots,
  downloadScreenshot,
  downloadThumbnail,
};
