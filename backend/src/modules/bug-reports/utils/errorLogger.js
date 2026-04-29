/**
 * Error Logger Utility
 * Centralized error logging for bug report system
 * Logs errors to console in development and to monitoring service in production
 */

/**
 * Log error with context
 * @param {Object} errorContext - Error context information
 * @param {string} errorContext.operation - Operation that failed (e.g., 'submitBugReport', 'uploadScreenshot')
 * @param {Error} errorContext.error - The error object
 * @param {string} errorContext.userId - User ID (if available)
 * @param {string} errorContext.userIdentifier - User identifier (UID or registration number)
 * @param {Object} errorContext.metadata - Additional metadata
 */
const logError = (errorContext) => {
  const {
    operation,
    error,
    userId = 'unknown',
    userIdentifier = 'unknown',
    metadata = {},
  } = errorContext;

  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    userId,
    userIdentifier,
    metadata,
    environment: process.env.NODE_ENV || 'development',
  };

  // Log to console in all environments
  console.error(`[Bug Report Error] ${operation}:`, logEntry);

  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with monitoring service (e.g., Sentry, DataDog, CloudWatch)
    // Example:
    // Sentry.captureException(error, {
    //   tags: {
    //     operation,
    //     userId,
    //     userIdentifier,
    //   },
    //   extra: metadata,
    // });
    
    // For now, just log to console with production flag
    console.error('[PRODUCTION ERROR]', logEntry);
  }
};

/**
 * Log bug report submission error
 * @param {Object} context - Error context
 */
const logBugReportSubmissionError = (context) => {
  logError({
    operation: 'submitBugReport',
    ...context,
  });
};

/**
 * Log screenshot upload error
 * @param {Object} context - Error context
 */
const logScreenshotUploadError = (context) => {
  logError({
    operation: 'uploadScreenshot',
    ...context,
  });
};

/**
 * Log screenshot download error
 * @param {Object} context - Error context
 */
const logScreenshotDownloadError = (context) => {
  logError({
    operation: 'downloadScreenshot',
    ...context,
  });
};

/**
 * Log bug report retrieval error
 * @param {Object} context - Error context
 */
const logBugReportRetrievalError = (context) => {
  logError({
    operation: 'getBugReport',
    ...context,
  });
};

/**
 * Log resolution status update error
 * @param {Object} context - Error context
 */
const logResolutionStatusUpdateError = (context) => {
  logError({
    operation: 'updateResolutionStatus',
    ...context,
  });
};

module.exports = {
  logError,
  logBugReportSubmissionError,
  logScreenshotUploadError,
  logScreenshotDownloadError,
  logBugReportRetrievalError,
  logResolutionStatusUpdateError,
};
