/**
 * DSW Audit Logging Utility
 * Provides comprehensive audit trail for all DSW operations
 */

const prisma = require('../../../shared/config/database');
const { AuditActions } = require('../constants');
const { auditService, AuditActionType, AuditModule, AuditSeverity } = require('../../audit/services/audit.service');

function mapDswActionType(action = '') {
  const normalized = String(action).toUpperCase();
  if (normalized.includes('CREATED') || normalized.includes('ADDED') || normalized.includes('SUBMITTED')) {
    return AuditActionType.CREATE;
  }
  if (normalized.includes('REMOVED') || normalized.includes('DELETED') || normalized.includes('ARCHIVED')) {
    return AuditActionType.DELETE;
  }
  if (normalized.includes('UPDATED') || normalized.includes('APPROVED') || normalized.includes('REJECTED') || normalized.includes('CHANGED') || normalized.includes('SUSPENDED') || normalized.includes('ACTIVATED')) {
    return AuditActionType.UPDATE;
  }
  return AuditActionType.OTHER;
}

/**
 * Create an audit log entry for a club action
 * @param {Object} params - Audit parameters
 * @param {string} params.clubId - Club ID
 * @param {string} params.action - Action performed (from AuditActions)
 * @param {string} params.performedById - User ID who performed the action
 * @param {Object} params.previousState - Previous state (optional)
 * @param {Object} params.newState - New state (optional)
 * @param {Object} params.changes - Specific changes made (optional)
 * @param {string} params.source - Source of action (dsw_ui, noting, api)
 * @param {string} params.ipAddress - IP address (optional)
 * @param {string} params.userAgent - User agent (optional)
 * @param {Object} params.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Created audit log entry
 */
async function createAuditLog({
  clubId,
  action,
  performedById,
  previousState = null,
  newState = null,
  changes = null,
  source = 'dsw_ui',
  ipAddress = null,
  userAgent = null,
  metadata = {},
}) {
  try {
    const auditLog = await prisma.clubAuditLog.create({
      data: {
        clubId,
        action,
        performedById,
        previousState: previousState ? JSON.parse(JSON.stringify(previousState)) : null,
        newState: newState ? JSON.parse(JSON.stringify(newState)) : null,
        changes: changes ? JSON.parse(JSON.stringify(changes)) : null,
        source,
        ipAddress,
        userAgent,
        metadata: JSON.parse(JSON.stringify(metadata)),
      },
      include: {
        performedBy: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
            clubId: true,
          },
        },
      },
    });

    // Mirror DSW audit log into central audit stream for /admin/audit-logs.
    await auditService.log({
      actorId: performedById || null,
      action: action || 'DSW club action',
      actionType: mapDswActionType(action),
      module: AuditModule.DSW,
      category: 'club',
      severity: AuditSeverity.INFO,
      targetTable: 'club',
      targetId: clubId,
      entityId: auditLog?.club?.clubId || clubId,
      entityName: auditLog?.club?.name || null,
      oldValues: previousState,
      newValues: newState,
      status: 'success',
      description: metadata?.message || null,
      ipAddress,
      userAgent,
      metadata: {
        source,
        action,
        changes,
        ...(metadata || {}),
      },
    });

    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit failures shouldn't break the application
    return null;
  }
}

/**
 * Get audit logs for a specific club
 * @param {string} clubId - Club ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of logs to return
 * @param {number} options.offset - Offset for pagination
 * @param {string} options.action - Filter by action type
 * @param {Date} options.startDate - Filter from date
 * @param {Date} options.endDate - Filter to date
 * @returns {Promise<Array>} Array of audit log entries
 */
async function getClubAuditLogs(
  clubId,
  { limit = 50, offset = 0, action = null, startDate = null, endDate = null } = {}
) {
  const where = { clubId };

  if (action) {
    where.action = action;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const auditLogs = await prisma.clubAuditLog.findMany({
    where,
    include: {
      performedBy: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          studentLogin: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return auditLogs;
}

/**
 * Get audit logs by action type across all clubs
 * @param {string} action - Action type
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of audit log entries
 */
async function getAuditLogsByAction(action, options = {}) {
  const { limit = 50, offset = 0 } = options;

  const auditLogs = await prisma.clubAuditLog.findMany({
    where: { action },
    include: {
      performedBy: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
        },
      },
      club: {
        select: {
          id: true,
          name: true,
          clubId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return auditLogs;
}

/**
 * Get audit logs by user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of audit log entries
 */
async function getUserAuditLogs(userId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  const auditLogs = await prisma.clubAuditLog.findMany({
    where: { performedById: userId },
    include: {
      club: {
        select: {
          id: true,
          name: true,
          clubId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  });

  return auditLogs;
}

/**
 * Log club creation
 */
async function logClubCreation(clubId, performedById, clubData, req = {}) {
  return createAuditLog({
    clubId,
    action: AuditActions.CLUB_CREATED,
    performedById,
    newState: clubData,
    source: 'noting',
    ipAddress: req.ip,
    userAgent: req.get?.('user-agent'),
  });
}

/**
 * Log club approval
 */
async function logClubApproval(clubId, performedById, req = {}) {
  return createAuditLog({
    clubId,
    action: AuditActions.CLUB_APPROVED,
    performedById,
    source: 'noting',
    ipAddress: req.ip,
    userAgent: req.get?.('user-agent'),
  });
}

/**
 * Log member addition
 */
async function logMemberAdded(clubId, performedById, studentId, req = {}) {
  return createAuditLog({
    clubId,
    action: AuditActions.MEMBER_ADDED,
    performedById,
    metadata: { studentId },
    source: 'dsw_ui',
    ipAddress: req.ip,
    userAgent: req.get?.('user-agent'),
  });
}

/**
 * Log member removal
 */
async function logMemberRemoved(clubId, performedById, studentId, reason, req = {}) {
  return createAuditLog({
    clubId,
    action: AuditActions.MEMBER_REMOVED,
    performedById,
    metadata: { studentId, reason },
    source: 'dsw_ui',
    ipAddress: req.ip,
    userAgent: req.get?.('user-agent'),
  });
}

/**
 * Log field update
 */
async function logFieldUpdate(clubId, performedById, fieldName, oldValue, newValue, req = {}) {
  return createAuditLog({
    clubId,
    action: AuditActions.FIELD_UPDATED,
    performedById,
    changes: {
      field: fieldName,
      from: oldValue,
      to: newValue,
    },
    source: 'dsw_ui',
    ipAddress: req.ip,
    userAgent: req.get?.('user-agent'),
  });
}

module.exports = {
  createAuditLog,
  getClubAuditLogs,
  getAuditLogsByAction,
  getUserAuditLogs,
  logClubCreation,
  logClubApproval,
  logMemberAdded,
  logMemberRemoved,
  logFieldUpdate,
};
