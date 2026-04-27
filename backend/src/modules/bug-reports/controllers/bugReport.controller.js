/**
 * Bug Report Controller
 * Handles public bug report submission and retrieval
 */

const bugReportService = require('../services/bugReport.service');
const screenshotService = require('../services/screenshot.service');
const { sanitizeBugReportData } = require('../utils/inputSanitizer');
const { createModuleLogger } = require('../../../shared/utils/logger');

// Create module-specific logger
const logger = createModuleLogger('bug-reports');

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
    const bugReportData = {
      userId,
      userRole: sanitizedData.userRole || req.user.role,
      userIdentifier: sanitizedData.userIdentifier || req.user.uid,
      userEmail: sanitizedData.userEmail || req.user.email,
      description: sanitizedData.description,
      pageUrl: sanitizedData.pageUrl,
      routePath: sanitizedData.routePath,
    };

    logger.logUserAction(userId, 'submit_bug_report', 'Submitting new bug report', {
      pageUrl: sanitizedData.pageUrl,
      routePath: sanitizedData.routePath,
      screenshotCount: files.length
    });

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

    // Handle specific error cases
    if (error.message.includes('required') || error.message.includes('must be') || error.message.includes('validation')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message,
      });
    }

    if (error.message.includes('Maximum') || error.message.includes('exceed')) {
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

    // Get screenshots for the bug report
    const screenshots = await bugReportService.getScreenshots(id);

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
    if (error.message === 'Bug report not found') {
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
const downloadScreenshot = async (req, res) => {
  try {
    const { screenshotId } = req.params;

    // Get screenshot file
    const screenshot = await screenshotService.getScreenshotById(screenshotId);

    if (!screenshot) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Screenshot not found',
      });
    }

    // Get file from storage
    const fileBuffer = await screenshotService.getScreenshotFile(screenshot.storagePath);

    // Set appropriate headers for file download
    res.setHeader('Content-Type', screenshot.mimeType);
    res.setHeader('Content-Length', screenshot.fileSize);
    res.setHeader('Content-Disposition', `inline; filename="${screenshot.originalFilename}"`);

    // Send file buffer
    return res.send(fileBuffer);
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

    if (error.message.includes('File not found') || error.message.includes('not found in storage')) {
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
const downloadThumbnail = async (req, res) => {
  try {
    const { screenshotId } = req.params;

    // Get screenshot metadata
    const screenshot = await screenshotService.getScreenshotById(screenshotId);

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

    // Get thumbnail from storage
    const thumbnailBuffer = await screenshotService.getThumbnailFile(screenshot.thumbnailPath);

    // Set appropriate headers for thumbnail
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', thumbnailBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Content-Disposition', `inline; filename="thumb_${screenshot.originalFilename}"`);

    // Send thumbnail buffer
    return res.send(thumbnailBuffer);
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

    if (error.message.includes('not found')) {
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
