/**
 * Comprehensive Audit Logging Service
 * Handles all audit logging operations, queries, and statistics
 */

const prisma = require('../../../shared/config/database');

const ALLOWED_PAGE_SIZES = new Set([25, 50, 100]);

function isUuid(value) {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function toSerializable(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return null;
    }
  }
  return value;
}

function getSafeSort(sortBy, sortOrder) {
  const allowedSortBy = new Set([
    'createdAt',
    'actionType',
    'module',
    'severity',
    'status',
    'performedByName',
    'entityName'
  ]);
  const safeSortBy = allowedSortBy.has(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
  return { safeSortBy, safeSortOrder };
}

function computeChangedFields(oldValues, newValues) {
  if (!oldValues || !newValues || typeof oldValues !== 'object' || typeof newValues !== 'object') {
    return [];
  }

  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  const changes = [];

  for (const key of keys) {
    const oldValue = oldValues[key];
    const newValue = newValues[key];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({ field: key, from: oldValue, to: newValue });
    }
  }

  return changes;
}

function buildDescription({ performedByName, actionType, entityType, entityName, changedFields = [] }) {
  const actor = performedByName || 'SYSTEM';
  const prettyEntityType = entityType || 'record';
  const prettyEntityName = entityName ? `'${entityName}'` : 'record';

  if (actionType === AuditActionType.UPDATE && changedFields.length > 0) {
    const first = changedFields[0];
    const from = first.from == null ? 'empty' : String(first.from);
    const to = first.to == null ? 'empty' : String(first.to);
    if (changedFields.length === 1) {
      return `${actor} updated ${prettyEntityType} ${prettyEntityName} - changed ${first.field} from ${from} to ${to}`;
    }
    return `${actor} updated ${prettyEntityType} ${prettyEntityName} - changed ${changedFields.length} fields (including ${first.field} from ${from} to ${to})`;
  }

  if (actionType === AuditActionType.CREATE) {
    return `${actor} created ${prettyEntityType} ${prettyEntityName}`;
  }
  if (actionType === AuditActionType.DELETE) {
    return `${actor} deleted ${prettyEntityType} ${prettyEntityName}`;
  }
  if (actionType === AuditActionType.READ) {
    return `${actor} viewed ${prettyEntityType} ${prettyEntityName}`;
  }

  return `${actor} performed ${actionType || 'OTHER'} on ${prettyEntityType} ${prettyEntityName}`;
}

// Action type constants
const AuditActionType = {
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  SUBMIT: 'SUBMIT',
  REVIEW: 'REVIEW',
  UPLOAD: 'UPLOAD',
  DOWNLOAD: 'DOWNLOAD',
  EMAIL_SENT: 'EMAIL_SENT',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  OTHER: 'OTHER'
};

// Severity levels
const AuditSeverity = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

// Module constants
const AuditModule = {
  AUTH: 'auth',
  IPR: 'ipr',
  RESEARCH: 'research',
  EVENT: 'event',
  DSW: 'dsw',
  NOTES: 'notes',
  ADMIN: 'admin',
  USER: 'user',
  DASHBOARD: 'dashboard',
  SYSTEM: 'system',
  REPORT: 'report',
  PERMISSION: 'permission',
  FINANCE: 'finance',
  POLICY: 'policy'
};

class AuditService {
  async resolvePerformedBySnapshot(actorId) {
    if (!actorId) {
      return { performedByName: 'SYSTEM', performedByRole: 'SYSTEM' };
    }

    try {
      const actor = await prisma.userLogin.findUnique({
        where: { id: actorId },
        select: {
          uid: true,
          role: true,
          employeeDetails: {
            select: { displayName: true, firstName: true, lastName: true }
          },
          studentLogin: {
            select: { displayName: true, firstName: true, lastName: true }
          }
        }
      });

      if (!actor) {
        return { performedByName: 'UNKNOWN_USER', performedByRole: 'UNKNOWN_ROLE' };
      }

      const empName = actor.employeeDetails?.displayName ||
        [actor.employeeDetails?.firstName, actor.employeeDetails?.lastName].filter(Boolean).join(' ').trim();
      const studentName = actor.studentLogin?.displayName ||
        [actor.studentLogin?.firstName, actor.studentLogin?.lastName].filter(Boolean).join(' ').trim();

      return {
        performedByName: empName || studentName || actor.uid || 'UNKNOWN_USER',
        performedByRole: actor.role || 'UNKNOWN_ROLE'
      };
    } catch (_) {
      return { performedByName: 'UNKNOWN_USER', performedByRole: 'UNKNOWN_ROLE' };
    }
  }

  buildLogWhere({
    actorId = null,
    module = null,
    actionType = null,
    severity = null,
    status = null,
    performedBy = null,
    targetTable = null,
    startDate = null,
    endDate = null,
    search = null
  }) {
    const where = {};

    if (actorId) where.actorId = actorId;
    if (module) where.module = module;
    if (actionType) where.actionType = actionType;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (targetTable) where.targetTable = targetTable;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const andConditions = [];
    if (performedBy) {
      andConditions.push({
        performedByName: { contains: performedBy, mode: 'insensitive' }
      });
    }

    if (search) {
      andConditions.push({
        OR: [
          { action: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { entityName: { contains: search, mode: 'insensitive' } },
          { performedByName: { contains: search, mode: 'insensitive' } },
          { errorMessage: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  /**
   * Log an audit event
   * @param {Object} params - Audit log parameters
   */
  async log({
    actorId = null,
    universityId = null,
    performedByName = null,
    performedByRole = null,
    action,
    description = null,
    actionType = AuditActionType.OTHER,
    module = null,
    category = null,
    severity = AuditSeverity.INFO,
    targetTable = null,
    targetId = null,
    entityId = null,
    entityName = null,
    details = {},
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null,
    sessionId = null,
    requestPath = null,
    requestMethod = null,
    responseStatus = null,
    status = null,
    duration = null,
    errorMessage = null,
    metadata = null
  }) {
    try {
      let nameSnapshot = performedByName;
      let roleSnapshot = performedByRole;

      if (!nameSnapshot || !roleSnapshot) {
        const resolved = await this.resolvePerformedBySnapshot(actorId);
        nameSnapshot = nameSnapshot || resolved.performedByName;
        roleSnapshot = roleSnapshot || resolved.performedByRole;
      }

      const normalizedStatus = status || (responseStatus && responseStatus >= 400 ? 'failed' : 'success');
      const changedFields = computeChangedFields(oldValues, newValues);
      const finalDescription = description || buildDescription({
        performedByName: nameSnapshot,
        actionType,
        entityType: targetTable,
        entityName,
        changedFields
      });

      const auditLogData = {
        action,
        actionType,
        module,
        category,
        severity,
        targetTable,
        targetId: isUuid(targetId) ? targetId : null,
        details: {
          ...(toSerializable(details) || {}),
          changedFields,
          performedByName: nameSnapshot,
          performedByRole: roleSnapshot,
          description: finalDescription,
          status: normalizedStatus,
          entityId: entityId || targetId || null,
          entityName
        },
        ipAddress,
        userAgent,
        oldValues: toSerializable(oldValues),
        newValues: toSerializable(newValues),
        sessionId,
        requestPath,
        requestMethod,
        responseStatus,
        duration,
        errorMessage,
        metadata: toSerializable(metadata)
      };

      if (isUuid(actorId)) {
        auditLogData.actor = {
          connect: { id: actorId }
        };
      }

      if (isUuid(universityId)) {
        auditLogData.university = {
          connect: { id: universityId }
        };
      }

      const auditLog = await prisma.auditLog.create({
        data: auditLogData
      });

      return auditLog;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw - audit logging should not break the main flow
      return null;
    }
  }

  /**
   * Log a user login event
   */
  async logLogin(userId, { ipAddress, userAgent, sessionId, success = true, errorMessage = null }) {
    return this.log({
      actorId: userId,
      action: success ? 'User logged in successfully' : 'Login attempt failed',
      actionType: AuditActionType.LOGIN,
      module: AuditModule.AUTH,
      category: 'authentication',
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      ipAddress,
      userAgent,
      sessionId,
      errorMessage,
      metadata: { success }
    });
  }

  /**
   * Log a user logout event
   */
  async logLogout(userId, { ipAddress, userAgent, sessionId }) {
    return this.log({
      actorId: userId,
      action: 'User logged out',
      actionType: AuditActionType.LOGOUT,
      module: AuditModule.AUTH,
      category: 'authentication',
      severity: AuditSeverity.INFO,
      ipAddress,
      userAgent,
      sessionId
    });
  }

  /**
   * Log an IPR application action
   */
  async logIprAction({
    actorId,
    action,
    actionType,
    applicationId,
    applicationNumber,
    iprType,
    details = {},
    oldValues = null,
    newValues = null,
    ipAddress,
    userAgent
  }) {
    return this.log({
      actorId,
      action,
      actionType,
      module: AuditModule.IPR,
      category: 'application',
      severity: AuditSeverity.INFO,
      targetTable: 'ipr_application',
      targetId: applicationId,
      details: { ...details, applicationNumber, iprType },
      oldValues,
      newValues,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log a research contribution action
   */
  async logResearchAction({
    actorId,
    action,
    actionType,
    contributionId,
    contributionType,
    details = {},
    oldValues = null,
    newValues = null,
    ipAddress,
    userAgent
  }) {
    return this.log({
      actorId,
      action,
      actionType,
      module: AuditModule.RESEARCH,
      category: 'contribution',
      severity: AuditSeverity.INFO,
      targetTable: 'research_contribution',
      targetId: contributionId,
      details: { ...details, contributionType },
      oldValues,
      newValues,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log a permission change
   */
  async logPermissionChange({
    actorId,
    targetUserId,
    permissionType,
    oldPermissions,
    newPermissions,
    ipAddress,
    userAgent
  }) {
    return this.log({
      actorId,
      action: `Permission ${permissionType} changed for user`,
      actionType: AuditActionType.PERMISSION_CHANGE,
      module: AuditModule.PERMISSION,
      category: 'security',
      severity: AuditSeverity.WARNING, // Permission changes are important
      targetTable: 'user_login',
      targetId: targetUserId,
      oldValues: oldPermissions,
      newValues: newPermissions,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log a status change
   */
  async logStatusChange({
    actorId,
    targetTable,
    targetId,
    entityType,
    entityIdentifier,
    oldStatus,
    newStatus,
    reason = null,
    ipAddress,
    userAgent
  }) {
    return this.log({
      actorId,
      action: `${entityType} status changed from ${oldStatus} to ${newStatus}`,
      actionType: AuditActionType.STATUS_CHANGE,
      module: entityType.toLowerCase().includes('ipr') ? AuditModule.IPR : AuditModule.RESEARCH,
      category: 'workflow',
      severity: AuditSeverity.INFO,
      targetTable,
      targetId,
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
      details: { entityIdentifier, reason },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log a file upload
   */
  async logFileUpload({
    actorId,
    fileName,
    fileType,
    fileSize,
    targetTable,
    targetId,
    ipAddress,
    userAgent
  }) {
    return this.log({
      actorId,
      action: `File uploaded: ${fileName}`,
      actionType: AuditActionType.UPLOAD,
      module: AuditModule.SYSTEM,
      category: 'file',
      severity: AuditSeverity.INFO,
      targetTable,
      targetId,
      metadata: { fileName, fileType, fileSize },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log a data export
   */
  async logExport({
    actorId,
    exportType,
    filters,
    recordCount,
    format,
    ipAddress,
    userAgent
  }) {
    return this.log({
      actorId,
      action: `Data exported: ${exportType} (${recordCount} records)`,
      actionType: AuditActionType.EXPORT,
      module: AuditModule.REPORT,
      category: 'export',
      severity: AuditSeverity.INFO,
      metadata: { exportType, filters, recordCount, format },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log an error
   */
  async logError({
    actorId,
    action,
    module,
    errorMessage,
    errorStack,
    requestPath,
    requestMethod,
    ipAddress,
    userAgent
  }) {
    return this.log({
      actorId,
      action,
      actionType: AuditActionType.OTHER,
      module,
      category: 'error',
      severity: AuditSeverity.ERROR,
      errorMessage,
      requestPath,
      requestMethod,
      metadata: { errorStack },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log an email sent
   */
  async logEmailSent({
    actorId,
    recipients,
    subject,
    emailType,
    success = true,
    errorMessage = null
  }) {
    return this.log({
      actorId,
      action: `Email sent: ${subject}`,
      actionType: AuditActionType.EMAIL_SENT,
      module: AuditModule.SYSTEM,
      category: 'notification',
      severity: success ? AuditSeverity.INFO : AuditSeverity.ERROR,
      metadata: { recipients, subject, emailType, success },
      errorMessage
    });
  }

  /**
   * Get audit logs with filters and pagination
   */
  async getLogs({
    page = 1,
    limit = 50,
    actorId = null,
    module = null,
    actionType = null,
    severity = null,
    status = null,
    performedBy = null,
    targetTable = null,
    startDate = null,
    endDate = null,
    search = null,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  }) {
    const pageNumber = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
    const normalizedLimit = ALLOWED_PAGE_SIZES.has(Number(limit)) ? Number(limit) : 50;
    const skip = (pageNumber - 1) * normalizedLimit;
    const { safeSortBy, safeSortOrder } = getSafeSort(sortBy, sortOrder);

    const where = this.buildLogWhere({
      actorId,
      module,
      actionType,
      severity,
      status,
      performedBy,
      targetTable,
      startDate,
      endDate,
      search
    });

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: normalizedLimit,
        orderBy: { [safeSortBy]: safeSortOrder },
        include: {
          actor: {
            select: {
              id: true,
              uid: true,
              email: true,
              role: true,
              employeeDetails: {
                select: {
                  displayName: true,
                  empId: true
                }
              }
            }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    const hydratedLogs = logs.map((log) => ({
      ...log,
      performedByName:
        log.performedByName ||
        log.actor?.employeeDetails?.displayName ||
        log.actor?.uid ||
        'SYSTEM',
      performedByRole: log.performedByRole || log.actor?.role || 'SYSTEM',
      status: log.status || (log.responseStatus && log.responseStatus >= 400 ? 'failed' : 'success')
    }));

    return {
      data: hydratedLogs,
      pagination: {
        page: pageNumber,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit)
      }
    };
  }

  /**
   * Get audit statistics for a period
   */
  async getStatistics({ startDate, endDate }) {
    const where = {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };

    const [
      totalLogs,
      byActionType,
      byModule,
      bySeverity,
      topActors,
      errorCount
    ] = await Promise.all([
      // Total logs count
      prisma.auditLog.count({ where }),

      // Group by action type
      prisma.auditLog.groupBy({
        by: ['actionType'],
        where,
        _count: true
      }),

      // Group by module
      prisma.auditLog.groupBy({
        by: ['module'],
        where,
        _count: true
      }),

      // Group by severity
      prisma.auditLog.groupBy({
        by: ['severity'],
        where,
        _count: true
      }),

      // Top 10 most active users
      prisma.auditLog.groupBy({
        by: ['actorId'],
        where: { ...where, actorId: { not: null } },
        _count: true,
        orderBy: { _count: { actorId: 'desc' } },
        take: 10
      }),

      // Error count
      prisma.auditLog.count({
        where: {
          ...where,
          severity: { in: ['ERROR', 'CRITICAL'] }
        }
      })
    ]);

    // Get actor details for top actors
    const actorIds = topActors.map(a => a.actorId).filter(Boolean);
    const actors = await prisma.userLogin.findMany({
      where: { id: { in: actorIds } },
      select: {
        id: true,
        uid: true,
        email: true,
        employeeDetails: {
          select: { displayName: true }
        }
      }
    });

    const actorMap = new Map(actors.map(a => [a.id, a]));

    return {
      totalLogs,
      byActionType: byActionType.map(item => ({
        actionType: item.actionType,
        count: item._count
      })),
      byModule: byModule.filter(m => m.module).map(item => ({
        module: item.module,
        count: item._count
      })),
      bySeverity: bySeverity.map(item => ({
        severity: item.severity,
        count: item._count
      })),
      topActors: topActors.map(item => ({
        actorId: item.actorId,
        actorName: actorMap.get(item.actorId)?.employeeDetails?.displayName || 
                   actorMap.get(item.actorId)?.uid || 'Unknown',
        email: actorMap.get(item.actorId)?.email,
        count: item._count
      })),
      errorCount,
      period: { startDate, endDate }
    };
  }

  /**
   * Get logs for a specific entity
   */
  async getEntityHistory(targetTable, targetId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { targetTable, targetId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              uid: true,
              employeeDetails: {
                select: { displayName: true }
              }
            }
          }
        }
      }),
      prisma.auditLog.count({ where: { targetTable, targetId } })
    ]);

    return {
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  /**
   * Get logs for monthly report (raw data for Excel export)
   */
  async getMonthlyReportData(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: {
          select: {
            uid: true,
            email: true,
            role: true,
            employeeDetails: {
              select: {
                displayName: true,
                empId: true,
                designation: true
              }
            }
          }
        }
      }
    });

    return {
      logs,
      period: {
        year,
        month,
        startDate,
        endDate,
        monthName: startDate.toLocaleString('default', { month: 'long' })
      }
    };
  }

  /**
   * Clean up old audit logs (older than specified days)
   * NEVER deletes email sending logs for transparency
   * NEVER deletes ERROR or CRITICAL logs
   */
  async cleanupOldLogs(retentionDays = 365) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        severity: { notIn: ['ERROR', 'CRITICAL'] }, // Keep errors and critical logs
        actionType: { not: 'EMAIL_SENT' }, // NEVER delete email logs for transparency
        action: { 
          not: {
            contains: 'email'
          }
        }
      }
    });

    // Log the cleanup itself
    await this.log({
      action: `Cleaned up ${result.count} old audit logs (older than ${retentionDays} days). Email logs and errors preserved permanently.`,
      actionType: AuditActionType.DELETE,
      module: AuditModule.SYSTEM,
      category: 'maintenance',
      severity: AuditSeverity.INFO,
      metadata: { 
        deletedCount: result.count, 
        retentionDays, 
        cutoffDate,
        preservedTypes: ['EMAIL_SENT', 'ERROR', 'CRITICAL']
      }
    });

    return result;
  }
}

// Export singleton instance
const auditService = new AuditService();

module.exports = {
  auditService,
  AuditActionType,
  AuditSeverity,
  AuditModule
};
