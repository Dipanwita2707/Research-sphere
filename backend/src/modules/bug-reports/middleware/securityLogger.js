/**
 * Security Logging Middleware for Bug Reports
 * Logs security-relevant events for audit trail
 */

const { auditService, AuditActionType, AuditSeverity, AuditModule } = require('../../../modules/audit/services/audit.service');
const { getClientIp } = require('../../../shared/middleware/audit.middleware');

/**
 * Log screenshot upload attempts
 * Logs all screenshot upload attempts with user identity and file metadata
 */
const logScreenshotUpload = async (req, files, bugReportId, success = true, error = null) => {
  try {
    const filesMetadata = files.map(file => ({
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    }));

    await auditService.log({
      actorId: req.user?.id || null,
      performedByName: req.user?.uid || req.user?.email || 'Unknown',
      performedByRole: req.user?.role || 'Unknown',
      action: success ? 'Screenshot upload successful' : 'Screenshot upload failed',
      description: success 
        ? `Uploaded ${files.length} screenshot(s) for bug report ${bugReportId}`
        : `Failed to upload screenshot(s): ${error}`,
      actionType: AuditActionType.UPLOAD,
      module: AuditModule.SYSTEM,
      category: 'bug-report-screenshot',
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      requestPath: req.originalUrl || req.url,
      requestMethod: req.method,
      status: success ? 'success' : 'failed',
      targetTable: 'bug_report_screenshots',
      targetId: bugReportId,
      metadata: {
        filesCount: files.length,
        files: filesMetadata,
        error: error || undefined,
      },
      errorMessage: error || null,
    });
  } catch (logError) {
    console.error('Error logging screenshot upload:', logError);
    // Don't throw - logging failures shouldn't break the application
  }
};

/**
 * Log resolution status changes
 * Logs all resolution status changes with admin ID and timestamp
 */
const logResolutionStatusChange = async (req, bugReportId, oldStatus, newStatus, success = true, error = null) => {
  try {
    await auditService.log({
      actorId: req.user?.id || null,
      performedByName: req.user?.uid || req.user?.email || 'Unknown',
      performedByRole: req.user?.role || 'Unknown',
      action: success 
        ? `Bug report resolution status changed from ${oldStatus} to ${newStatus}`
        : `Failed to change bug report resolution status`,
      description: success
        ? `Admin ${req.user?.uid} changed bug report ${bugReportId} status from ${oldStatus} to ${newStatus}`
        : `Failed to change bug report ${bugReportId} status: ${error}`,
      actionType: AuditActionType.UPDATE,
      module: AuditModule.SYSTEM,
      category: 'bug-report-resolution',
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      requestPath: req.originalUrl || req.url,
      requestMethod: req.method,
      status: success ? 'success' : 'failed',
      targetTable: 'bug_reports',
      targetId: bugReportId,
      metadata: {
        oldStatus,
        newStatus,
        adminId: req.user?.id,
        adminUid: req.user?.uid,
        timestamp: new Date().toISOString(),
        error: error || undefined,
      },
      oldValues: { resolutionStatus: oldStatus },
      newValues: { resolutionStatus: newStatus },
      errorMessage: error || null,
    });
  } catch (logError) {
    console.error('Error logging resolution status change:', logError);
  }
};

/**
 * Log authentication failures for admin endpoints
 */
const logAuthenticationFailure = async (req, reason = 'Authentication failed') => {
  try {
    await auditService.log({
      actorId: null, // No authenticated user
      performedByName: 'Anonymous',
      performedByRole: 'Unknown',
      action: 'Admin endpoint authentication failure',
      description: `Failed authentication attempt for admin endpoint: ${reason}`,
      actionType: AuditActionType.LOGIN,
      module: AuditModule.AUTH,
      category: 'bug-report-admin-auth',
      severity: AuditSeverity.WARNING,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      requestPath: req.originalUrl || req.url,
      requestMethod: req.method,
      status: 'failed',
      metadata: {
        reason,
        timestamp: new Date().toISOString(),
      },
      errorMessage: reason,
    });
  } catch (logError) {
    console.error('Error logging authentication failure:', logError);
  }
};

/**
 * Log rate limit violations
 */
const logRateLimitViolation = async (req, limitType, limit, window) => {
  try {
    await auditService.log({
      actorId: req.user?.id || null,
      performedByName: req.user?.uid || req.user?.email || getClientIp(req),
      performedByRole: req.user?.role || 'Unknown',
      action: 'Rate limit exceeded',
      description: `Rate limit exceeded for ${limitType}: ${limit} requests per ${window}`,
      actionType: AuditActionType.OTHER,
      module: AuditModule.SYSTEM,
      category: 'rate-limit-violation',
      severity: AuditSeverity.WARNING,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      requestPath: req.originalUrl || req.url,
      requestMethod: req.method,
      status: 'blocked',
      metadata: {
        limitType,
        limit,
        window,
        userId: req.user?.id || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (logError) {
    console.error('Error logging rate limit violation:', logError);
  }
};

/**
 * Log bug report submission
 */
const logBugReportSubmission = async (req, bugReportId, success = true, error = null) => {
  try {
    await auditService.log({
      actorId: req.user?.id || null,
      performedByName: req.user?.uid || req.user?.email || 'Unknown',
      performedByRole: req.user?.role || 'Unknown',
      action: success ? 'Bug report submitted' : 'Bug report submission failed',
      description: success
        ? `User submitted bug report ${bugReportId}`
        : `Failed to submit bug report: ${error}`,
      actionType: AuditActionType.CREATE,
      module: AuditModule.SYSTEM,
      category: 'bug-report-submission',
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      requestPath: req.originalUrl || req.url,
      requestMethod: req.method,
      status: success ? 'success' : 'failed',
      targetTable: 'bug_reports',
      targetId: bugReportId,
      metadata: {
        bugReportId,
        pageUrl: req.body?.pageUrl,
        hasScreenshots: req.files && req.files.length > 0,
        screenshotCount: req.files?.length || 0,
        error: error || undefined,
      },
      errorMessage: error || null,
    });
  } catch (logError) {
    console.error('Error logging bug report submission:', logError);
  }
};

module.exports = {
  logScreenshotUpload,
  logResolutionStatusChange,
  logAuthenticationFailure,
  logRateLimitViolation,
  logBugReportSubmission,
};
