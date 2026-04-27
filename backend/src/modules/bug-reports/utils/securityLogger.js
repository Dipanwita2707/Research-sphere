/**
 * Security Logger
 * Centralized logging for security-related events in the bug report system
 */

const { createModuleLogger } = require('../../../shared/utils/logger');

// Create module-specific logger for security events
const securityLogger = createModuleLogger('bug-reports-security');

/**
 * Log screenshot upload attempt
 * @param {Object} data - Upload attempt data
 * @param {string} data.userId - User ID
 * @param {string} data.userIdentifier - User identifier (UID or registration number)
 * @param {string} data.filename - Original filename
 * @param {number} data.fileSize - File size in bytes
 * @param {string} data.mimeType - MIME type
 * @param {boolean} data.success - Whether upload was successful
 * @param {string} data.error - Error message if failed
 */
const logScreenshotUpload = (data) => {
  const timestamp = new Date().toISOString();
  const status = data.success ? 'SUCCESS' : 'FAILED';
  
  const logEntry = {
    timestamp,
    event: 'SCREENSHOT_UPLOAD',
    status,
    userId: data.userId,
    userIdentifier: data.userIdentifier,
    filename: data.filename,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    error: data.error || null,
  };

  if (data.success) {
    securityLogger.logAction('screenshot_upload_success', 'Screenshot uploaded successfully', logEntry);
  } else {
    securityLogger.logAction('screenshot_upload_failed', 'Screenshot upload failed', logEntry);
  }
};

/**
 * Log resolution status change
 * @param {Object} data - Status change data
 * @param {string} data.bugReportId - Bug report ID
 * @param {string} data.adminId - Admin user ID
 * @param {string} data.adminIdentifier - Admin identifier (UID)
 * @param {string} data.oldStatus - Previous status
 * @param {string} data.newStatus - New status
 * @param {Date} data.timestamp - Timestamp of change
 */
const logResolutionStatusChange = (data) => {
  const timestamp = data.timestamp || new Date().toISOString();
  
  const logEntry = {
    timestamp,
    event: 'RESOLUTION_STATUS_CHANGE',
    bugReportId: data.bugReportId,
    adminId: data.adminId,
    adminIdentifier: data.adminIdentifier,
    oldStatus: data.oldStatus,
    newStatus: data.newStatus,
  };

  securityLogger.logAction('resolution_status_change', 'Bug report resolution status changed', logEntry);
};

/**
 * Log authentication failure for admin endpoints
 * @param {Object} data - Authentication failure data
 * @param {string} data.endpoint - Endpoint that was accessed
 * @param {string} data.method - HTTP method
 * @param {string} data.userId - User ID (if available)
 * @param {string} data.userRole - User role (if available)
 * @param {string} data.ip - IP address
 * @param {string} data.reason - Reason for failure
 */
const logAuthenticationFailure = (data) => {
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    event: 'AUTHENTICATION_FAILURE',
    endpoint: data.endpoint,
    method: data.method,
    userId: data.userId || 'unknown',
    userRole: data.userRole || 'unknown',
    ip: data.ip,
    reason: data.reason,
  };

  securityLogger.warn('Authentication failure detected', logEntry);
};

/**
 * Log rate limit violation
 * @param {Object} data - Rate limit violation data
 * @param {string} data.endpoint - Endpoint that was accessed
 * @param {string} data.userId - User ID (if available)
 * @param {string} data.ip - IP address
 * @param {string} data.limitType - Type of rate limit (e.g., 'bug_report_submission', 'screenshot_upload')
 * @param {number} data.limit - Rate limit threshold
 * @param {string} data.window - Time window (e.g., '1 hour', '1 minute')
 */
const logRateLimitViolation = (data) => {
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    event: 'RATE_LIMIT_VIOLATION',
    endpoint: data.endpoint,
    userId: data.userId || 'unknown',
    ip: data.ip,
    limitType: data.limitType,
    limit: data.limit,
    window: data.window,
  };

  securityLogger.warn('Rate limit exceeded', logEntry);
};

/**
 * Log bug report submission
 * @param {Object} data - Bug report submission data
 * @param {string} data.bugReportId - Bug report ID
 * @param {string} data.userId - User ID
 * @param {string} data.userIdentifier - User identifier
 * @param {string} data.userRole - User role
 * @param {number} data.screenshotCount - Number of screenshots
 * @param {boolean} data.success - Whether submission was successful
 */
const logBugReportSubmission = (data) => {
  const timestamp = new Date().toISOString();
  const status = data.success ? 'SUCCESS' : 'FAILED';
  
  const logEntry = {
    timestamp,
    event: 'BUG_REPORT_SUBMISSION',
    status,
    bugReportId: data.bugReportId,
    userId: data.userId,
    userIdentifier: data.userIdentifier,
    userRole: data.userRole,
    screenshotCount: data.screenshotCount,
  };

  securityLogger.logAction('bug_report_submission', 'Bug report submitted', logEntry);
};

module.exports = {
  logScreenshotUpload,
  logResolutionStatusChange,
  logAuthenticationFailure,
  logRateLimitViolation,
  logBugReportSubmission,
};
