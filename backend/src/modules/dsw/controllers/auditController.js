/**
 * DSW Audit Controller
 * Handles HTTP requests for audit log operations
 */

const auditLogger = require('../utils/auditLogger');

/**
 * Get audit logs for a specific club
 * GET /api/dsw/clubs/:clubId/audit-logs
 */
async function getClubAuditLogs(req, res) {
  try {
    const { clubId } = req.params;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      action: req.query.action,
      startDate: req.query.startDate ? new Date(req.query.startDate) : null,
      endDate: req.query.endDate ? new Date(req.query.endDate) : null,
    };

    const auditLogs = await auditLogger.getClubAuditLogs(clubId, options);

    res.json({
      success: true,
      data: auditLogs,
      count: auditLogs.length,
    });
  } catch (error) {
    console.error('Error in getClubAuditLogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message,
    });
  }
}

/**
 * Get audit logs by action type
 * GET /api/dsw/audit-logs/action/:action
 */
async function getAuditLogsByAction(req, res) {
  try {
    const { action } = req.params;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    };

    const auditLogs = await auditLogger.getAuditLogsByAction(action, options);

    res.json({
      success: true,
      data: auditLogs,
      count: auditLogs.length,
    });
  } catch (error) {
    console.error('Error in getAuditLogsByAction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message,
    });
  }
}

/**
 * Get audit logs for current user
 * GET /api/dsw/audit-logs/my
 */
async function getMyAuditLogs(req, res) {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    };

    const auditLogs = await auditLogger.getUserAuditLogs(req.user.id, options);

    res.json({
      success: true,
      data: auditLogs,
      count: auditLogs.length,
    });
  } catch (error) {
    console.error('Error in getMyAuditLogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your audit logs',
      error: error.message,
    });
  }
}

module.exports = {
  getClubAuditLogs,
  getAuditLogsByAction,
  getMyAuditLogs,
};
