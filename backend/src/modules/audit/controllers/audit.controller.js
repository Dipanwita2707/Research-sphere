/**
 * Audit Controller
 * Handles API endpoints for audit log management
 */

const { auditService, AuditActionType, AuditModule, AuditSeverity } = require('../services/audit.service');
const { excelExportService } = require('../../core/services/excelExport.service');
const { auditReportScheduler } = require('../services/auditScheduler.service');
const prisma = require('../../../shared/config/database');

function toCsvValue(value) {
  if (value == null) return '';
  const normalized = String(value).replace(/\r?\n|\r/g, ' ');
  return `"${normalized.replace(/"/g, '""')}"`;
}

/**
 * Get audit logs with filters and pagination
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      actorId,
      performedBy,
      module,
      actionType,
      severity,
      status,
      targetTable,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const result = await auditService.getLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      actorId,
      performedBy,
      module,
      actionType,
      severity,
      status,
      targetTable,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message
    });
  }
};

/**
 * Get audit statistics for a period
 */
const getAuditStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    const statistics = await auditService.getStatistics({ startDate, endDate });

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit statistics',
      error: error.message
    });
  }
};

/**
 * Get audit history for a specific entity
 */
const getEntityAuditHistory = async (req, res) => {
  try {
    const { targetTable, targetId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await auditService.getEntityHistory(targetTable, targetId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching entity audit history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch entity audit history',
      error: error.message
    });
  }
};

/**
 * Export audit logs to Excel
 */
const exportAuditLogs = async (req, res) => {
  try {
    const {
      actorId,
      performedBy,
      module,
      actionType,
      severity,
      status,
      targetTable,
      startDate,
      endDate,
      search,
      format = 'xlsx'
    } = req.query;

    const where = auditService.buildLogWhere({
      actorId,
      performedBy,
      module,
      actionType,
      severity,
      status,
      targetTable,
      startDate,
      endDate,
      search
    });

    const logs = await prisma.auditLog.findMany({
      where,
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

    const statisticsStartDate = startDate || logs[0]?.createdAt || new Date();
    const statisticsEndDate = endDate || logs[logs.length - 1]?.createdAt || new Date();

    // Get statistics
    const statistics = await auditService.getStatistics({
      startDate: statisticsStartDate,
      endDate: statisticsEndDate
    });

    if (String(format).toLowerCase() === 'csv') {
      const headers = [
        'timestamp',
        'module',
        'action',
        'entity_id',
        'entity_name',
        'performed_by_name',
        'performed_by_role',
        'ip_address',
        'status',
        'description',
        'request_method',
        'request_path'
      ];

      const rows = logs.map((log) => [
        log.createdAt?.toISOString?.() || log.createdAt,
        log.module || '',
        log.actionType || '',
        log.entityId || log.targetId || '',
        log.entityName || '',
        log.performedByName || log.actor?.employeeDetails?.displayName || log.actor?.uid || 'SYSTEM',
        log.performedByRole || log.actor?.role || 'SYSTEM',
        log.ipAddress || '',
        log.status || (log.responseStatus >= 400 ? 'failed' : 'success'),
        log.description || log.action || '',
        log.requestMethod || '',
        log.requestPath || ''
      ]);

      const csv = [
        headers.map(toCsvValue).join(','),
        ...rows.map((row) => row.map(toCsvValue).join(','))
      ].join('\n');

      const csvFileName = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${csvFileName}"`);
      await auditService.logExport({
        actorId: req.user?.id,
        exportType: 'audit_logs',
        filters: { actorId, performedBy, module, actionType, severity, status, targetTable, startDate, endDate, search },
        recordCount: logs.length,
        format: 'csv',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      return res.send(csv);
    }

    // Generate Excel
    const period = {
      year: new Date(statisticsStartDate).getFullYear(),
      month: new Date(statisticsStartDate).getMonth() + 1,
      startDate: new Date(statisticsStartDate),
      endDate: new Date(statisticsEndDate),
      monthName: new Date(statisticsStartDate).toLocaleString('default', { month: 'long' })
    };

    const excelBuffer = await excelExportService.generateAuditReport({
      logs,
      period,
      statistics
    });

    // Log the export
    await auditService.logExport({
      actorId: req.user?.id,
      exportType: 'audit_logs',
      filters: { actorId, performedBy, module, actionType, severity, status, targetTable, startDate, endDate, search },
      recordCount: logs.length,
      format: 'xlsx',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Set headers and send file
    const fileName = `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export audit logs',
      error: error.message
    });
  }
};

/**
 * Generate on-demand report
 */
const generateReport = async (req, res) => {
  try {
    const { startDate, endDate, reportType = 'custom', sendEmail = false, recipientEmails = [] } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }

    const result = await auditReportScheduler.generateOnDemandReport({
      reportType,
      startDate,
      endDate,
      recipientEmails: sendEmail ? recipientEmails : []
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error
      });
    }

    if (sendEmail) {
      res.json({
        success: true,
        message: `Report generated and sent to ${recipientEmails.length} recipients`,
        statistics: result.statistics,
        logCount: result.logCount
      });
    } else {
      // Return file for download
      const fileName = `audit-report-${reportType}-${startDate}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(result.buffer);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

/**
 * Get report history
 */
const getReportHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, reportType } = req.query;

    const result = await auditReportScheduler.getReportHistory({
      page: parseInt(page),
      limit: parseInt(limit),
      reportType
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching report history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report history',
      error: error.message
    });
  }
};

/**
 * Get audit report recipients configuration
 */
const getReportRecipients = async (req, res) => {
  try {
    const recipients = await prisma.auditReportConfig.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: recipients
    });
  } catch (error) {
    console.error('Error fetching report recipients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report recipients',
      error: error.message
    });
  }
};

/**
 * Add or update report recipient
 */
const saveReportRecipient = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      email, 
      role, 
      isActive = true, 
      receiveMonthly = true, 
      receiveWeekly = false, 
      receiveDaily = false,
      modules = [],
      severities = []
    } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and role are required'
      });
    }

    let recipient;

    if (id) {
      // Update existing
      recipient = await prisma.auditReportConfig.update({
        where: { id },
        data: {
          name,
          email,
          role,
          isActive,
          receiveMonthly,
          receiveWeekly,
          receiveDaily,
          modules,
          severities
        }
      });
    } else {
      // Create new
      recipient = await prisma.auditReportConfig.create({
        data: {
          name,
          email,
          role,
          isActive,
          receiveMonthly,
          receiveWeekly,
          receiveDaily,
          modules,
          severities
        }
      });
    }

    // Log the change
    await auditService.log({
      actorId: req.user?.id,
      action: id ? 'Updated audit report recipient' : 'Added audit report recipient',
      actionType: AuditActionType.CONFIG_CHANGE,
      module: AuditModule.ADMIN,
      category: 'configuration',
      severity: AuditSeverity.INFO,
      targetTable: 'audit_report_config',
      targetId: recipient.id,
      details: { name, email, role }
    });

    res.json({
      success: true,
      data: recipient,
      message: id ? 'Recipient updated successfully' : 'Recipient added successfully'
    });
  } catch (error) {
    console.error('Error saving report recipient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save report recipient',
      error: error.message
    });
  }
};

/**
 * Delete report recipient
 */
const deleteReportRecipient = async (req, res) => {
  try {
    const { id } = req.params;

    const recipient = await prisma.auditReportConfig.findUnique({
      where: { id }
    });

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    await prisma.auditReportConfig.delete({
      where: { id }
    });

    // Log the deletion
    await auditService.log({
      actorId: req.user?.id,
      action: 'Deleted audit report recipient',
      actionType: AuditActionType.DELETE,
      module: AuditModule.ADMIN,
      category: 'configuration',
      severity: AuditSeverity.WARNING,
      targetTable: 'audit_report_config',
      targetId: id,
      details: { name: recipient.name, email: recipient.email }
    });

    res.json({
      success: true,
      message: 'Recipient deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting report recipient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete report recipient',
      error: error.message
    });
  }
};

/**
 * Get available filter options
 */
const getFilterOptions = async (req, res) => {
  try {
    const [modules, actionTypes, severities, statuses, performers] = await Promise.all([
      prisma.auditLog.findMany({
        select: { module: true },
        distinct: ['module'],
        where: { module: { not: null } }
      }),
      prisma.auditLog.findMany({
        select: { actionType: true },
        distinct: ['actionType']
      }),
      prisma.auditLog.findMany({
        select: { severity: true },
        distinct: ['severity']
      }),
      prisma.auditLog.findMany({
        select: { status: true },
        distinct: ['status'],
        where: { status: { not: null } }
      }),
      prisma.auditLog.findMany({
        select: { performedByName: true },
        distinct: ['performedByName'],
        where: { performedByName: { not: null } },
        orderBy: { performedByName: 'asc' },
        take: 100
      })
    ]);

    res.json({
      success: true,
      data: {
        modules: modules.map(m => m.module).filter(Boolean),
        actionTypes: actionTypes.map(a => a.actionType),
        severities: severities.map(s => s.severity),
        statuses: statuses.map(s => s.status).filter(Boolean),
        performers: performers.map(p => p.performedByName).filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch filter options',
      error: error.message
    });
  }
};

/**
 * Trigger manual log cleanup
 */
const triggerCleanup = async (req, res) => {
  try {
    const { retentionDays = 365 } = req.body;

    const result = await auditReportScheduler.cleanupOldLogs(retentionDays);

    res.json({
      success: true,
      message: `Cleaned up ${result?.count || 0} old audit logs`,
      deletedCount: result?.count || 0
    });
  } catch (error) {
    console.error('Error triggering cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger cleanup',
      error: error.message
    });
  }
};

/**
 * Manually send audit report via email
 * Generates and sends report immediately to configured recipients
 */
const sendManualReport = async (req, res) => {
  try {
    const { reportType = 'monthly' } = req.body;

    console.log(`📧 Manual report send triggered by ${req.user?.email || 'admin'}`);
    
    // Generate and send the report
    const result = await auditReportScheduler.generateAndSendReport(reportType);

    if (result.success) {
      // Log the manual send action
      await auditService.log({
        actorId: req.user?.id,
        action: `Manually sent ${reportType} audit report`,
        actionType: AuditActionType.EMAIL_SENT,
        module: AuditModule.SYSTEM,
        category: 'audit_report',
        severity: AuditSeverity.INFO,
        details: {
          reportType,
          recipientCount: result.recipientCount,
          logCount: result.logCount
        }
      });

      res.json({
        success: true,
        message: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report sent successfully`,
        data: {
          recipientCount: result.recipientCount,
          logCount: result.logCount,
          dateRange: result.dateRange,
          statistics: result.statistics
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.error || 'Failed to send report'
      });
    }
  } catch (error) {
    console.error('Error sending manual report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send audit report',
      error: error.message
    });
  }
};

module.exports = {
  getAuditLogs,
  getAuditStatistics,
  getEntityAuditHistory,
  exportAuditLogs,
  generateReport,
  getReportHistory,
  getReportRecipients,
  saveReportRecipient,
  deleteReportRecipient,
  getFilterOptions,
  triggerCleanup,
  sendManualReport
};
