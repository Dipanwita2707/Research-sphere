/**
 * Audit Report Scheduler
 * Handles scheduled generation and sending of audit reports
 */

const cron = require('node-cron');
const prisma = require('../../../shared/config/database');
const { auditService, AuditActionType, AuditModule, AuditSeverity } = require('./audit.service');
const { emailService } = require('../../core/services/email.service');
const { excelExportService } = require('../../core/services/excelExport.service');
const path = require('path');
const fs = require('fs').promises;

class AuditReportScheduler {
  constructor() {
    this.jobs = new Map();
    this.reportsDir = path.join(__dirname, '../../uploads/audit-reports');
  }

  /**
   * Initialize the scheduler
   */
  async initialize() {
    try {
      // Ensure reports directory exists
      await fs.mkdir(this.reportsDir, { recursive: true });

      // Schedule monthly report - runs at 00:00 on the 1st of every month
      this.scheduleMonthlyReport();

      // Schedule weekly report - runs every Monday at 00:00
      this.scheduleWeeklyReport();

      // Schedule daily report - runs every day at 00:00
      this.scheduleDailyReport();

      // Schedule log cleanup - runs weekly on Sunday at 03:00
      this.scheduleLogCleanup();

      console.log('[SUCCESS] Audit report scheduler initialized');
    } catch (error) {
      console.error('Failed to initialize audit report scheduler:', error);
    }
  }

  /**
   * Schedule monthly audit report
   */
  scheduleMonthlyReport() {
    // Run at 00:00 on the 1st day of every month
    const job = cron.schedule('0 0 1 * *', async () => {
      console.log('[REPORT] Starting monthly audit report generation...');
      await this.generateAndSendReport('monthly');
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.jobs.set('monthly', job);
    console.log('[SCHEDULE] Monthly audit report scheduled for 1st of each month at 00:00 IST');
  }

  /**
   * Schedule weekly audit report
   */
  scheduleWeeklyReport() {
    // Run at 00:00 every Monday
    const job = cron.schedule('0 0 * * 1', async () => {
      console.log('[REPORT] Starting weekly audit report generation...');
      await this.generateAndSendReport('weekly');
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.jobs.set('weekly', job);
    console.log('[SCHEDULE] Weekly audit report scheduled for every Monday at 00:00 IST');
  }

  /**
   * Schedule daily audit report
   */
  scheduleDailyReport() {
    // Run at 00:00 every day
    const job = cron.schedule('0 0 * * *', async () => {
      console.log('[REPORT] Starting daily audit report generation...');
      await this.generateAndSendReport('daily');
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.jobs.set('daily', job);
    console.log('[SCHEDULE] Daily audit report scheduled for every day at 00:00 IST');
  }

  /**
   * Schedule log cleanup job
   * Note: Email logs are NEVER deleted for transparency
   */
  scheduleLogCleanup() {
    // Run at 03:00 every Sunday
    const job = cron.schedule('0 3 * * 0', async () => {
      console.log('🧹 Starting audit log cleanup...');
      await this.cleanupOldLogs();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.jobs.set('cleanup', job);
    console.log('[SCHEDULE] Log cleanup scheduled for every Sunday at 03:00 IST');
  }

  /**
   * Get period dates based on report type
   */
  getReportPeriod(reportType) {
    const now = new Date();
    let startDate, endDate;

    switch (reportType) {
      case 'monthly':
        // Previous month
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;

      case 'weekly':
        // Previous week (Monday to Sunday)
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - now.getDay());
        endDate = new Date(lastSunday.getFullYear(), lastSunday.getMonth(), lastSunday.getDate(), 23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;

      case 'daily':
        // Yesterday
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    return { startDate, endDate };
  }

  /**
   * Get active recipients for audit reports from tenant configuration.
   * No hard-coded university emails — each tenant configures recipients in Admin → Audit.
   */
  async getRecipients(reportType) {
    const fieldMap = {
      monthly: 'receiveMonthly',
      weekly: 'receiveWeekly',
      daily: 'receiveDaily'
    };

    const flag = fieldMap[reportType];
    if (!flag) return [];

    const recipients = await prisma.auditReportConfig.findMany({
      where: {
        isActive: true,
        [flag]: true
      },
      select: {
        name: true,
        email: true,
        role: true,
        receiveMonthly: true,
        receiveWeekly: true,
        receiveDaily: true
      }
    });

    return recipients;
  }

  /**
   * Generate and send audit report
   */
  async generateAndSendReport(reportType) {
    let reportHistory = null;

    try {
      const { startDate, endDate } = this.getReportPeriod(reportType);

      // Get recipients from DB config (no hard-coded SGT / university emails)
      const recipientConfigs = await this.getRecipients(reportType);
      
      if (recipientConfigs.length === 0) {
        console.log(`⚠️  No recipients configured for ${reportType} reports — skipping send. Add recipients in Audit Report Settings.`);
        return;
      }

      const recipientEmails = recipientConfigs.map(r => r.email);
      console.log(`📧 Sending ${reportType} report to ${recipientEmails.length} recipients:`, recipientEmails.join(', '));

      // Create report history record
      reportHistory = await prisma.auditReportHistory.create({
        data: {
          reportType,
          periodStart: startDate,
          periodEnd: endDate,
          recipients: recipientEmails,
          totalLogs: 0,
          status: 'pending'
        }
      });

      // Get audit data
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

      // Get statistics
      const statistics = await auditService.getStatistics({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Generate Excel report
      const period = {
        year: startDate.getFullYear(),
        month: startDate.getMonth() + 1,
        startDate,
        endDate,
        monthName: startDate.toLocaleString('default', { month: 'long' })
      };

      const excelBuffer = await excelExportService.generateAuditReport({
        logs,
        period,
        statistics
      });

      // Save report file
      const fileName = `audit-report-${reportType}-${startDate.toISOString().split('T')[0]}.xlsx`;
      const filePath = path.join(this.reportsDir, fileName);
      await fs.writeFile(filePath, excelBuffer);

      // Send emails
      const emailResult = await emailService.sendAuditReport({
        recipients: recipientEmails,
        reportType,
        periodStart: startDate,
        periodEnd: endDate,
        excelBuffer,
        stats: statistics
      });

      // Update report history
      await prisma.auditReportHistory.update({
        where: { id: reportHistory.id },
        data: {
          totalLogs: logs.length,
          filePath,
          status: emailResult.success ? 'sent' : 'failed',
          errorMsg: emailResult.error || null
        }
      });

      // Log the report generation
      await auditService.log({
        action: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} audit report generated and sent`,
        actionType: AuditActionType.EMAIL_SENT,
        module: AuditModule.SYSTEM,
        category: 'report',
        severity: AuditSeverity.INFO,
        metadata: {
          reportType,
          periodStart: startDate,
          periodEnd: endDate,
          recipientCount: recipientEmails.length,
          logCount: logs.length,
          success: emailResult.success
        }
      });

      console.log(`[SUCCESS] ${reportType} audit report sent to ${recipientEmails.length} recipients`);
      return { success: true, recipientCount: recipientEmails.length, logCount: logs.length };

    } catch (error) {
      console.error(`Failed to generate ${reportType} audit report:`, error);

      // Update report history with error
      if (reportHistory) {
        await prisma.auditReportHistory.update({
          where: { id: reportHistory.id },
          data: {
            status: 'failed',
            errorMsg: error.message
          }
        });
      }

      // Log the error
      await auditService.log({
        action: `Failed to generate ${reportType} audit report`,
        actionType: AuditActionType.OTHER,
        module: AuditModule.SYSTEM,
        category: 'report',
        severity: AuditSeverity.ERROR,
        errorMessage: error.message,
        metadata: { reportType, stack: error.stack }
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Generate report on demand
   */
  async generateOnDemandReport({ reportType, startDate, endDate, recipientEmails }) {
    try {
      // Validate and parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format');
      }

      if (start > end) {
        throw new Error('Start date must be before end date');
      }

      // Set start to beginning of day (00:00:00)
      start.setHours(0, 0, 0, 0);
      
      // Set end to end of day (23:59:59.999)
      end.setHours(23, 59, 59, 999);

      console.log(`[REPORT] Generating on-demand report from ${start.toISOString()} to ${end.toISOString()}`);

      // Get audit data
      const logs = await prisma.auditLog.findMany({
        where: {
          createdAt: {
            gte: start,
            lte: end
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

      console.log(`[SUCCESS] Found ${logs.length} audit logs for date range`);

      // Get statistics
      const statistics = await auditService.getStatistics({
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });

      // Generate Excel report
      const period = {
        year: start.getFullYear(),
        month: start.getMonth() + 1,
        startDate: start,
        endDate: end,
        monthName: start.toLocaleString('default', { month: 'long' })
      };

      const excelBuffer = await excelExportService.generateAuditReport({
        logs,
        period,
        statistics
      });

      console.log(`[REPORT] Excel report generated with ${logs.length} log entries`);

      // If recipients provided, send email
      if (recipientEmails && recipientEmails.length > 0) {
        console.log(`📧 Sending report to ${recipientEmails.length} recipient(s): ${recipientEmails.join(', ')}`);
        
        await emailService.sendAuditReport({
          recipients: recipientEmails,
          reportType: reportType || 'custom',
          periodStart: start,
          periodEnd: end,
          excelBuffer,
          stats: statistics
        });
        
        console.log(`[SUCCESS] Email sent successfully with ${logs.length} logs for period ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`);
      }

      return {
        success: true,
        buffer: excelBuffer,
        statistics,
        logCount: logs.length
      };

    } catch (error) {
      console.error('Failed to generate on-demand report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup old audit logs
   */
  async cleanupOldLogs(retentionDays = 365) {
    try {
      const result = await auditService.cleanupOldLogs(retentionDays);
      console.log(`🧹 Cleaned up ${result.count} old audit logs`);
      return result;
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped ${name} job`);
    });
    this.jobs.clear();
  }

  /**
   * Get report history
   */
  async getReportHistory({ page = 1, limit = 20, reportType = null }) {
    const skip = (page - 1) * limit;
    const where = reportType ? { reportType } : {};

    const [history, total] = await Promise.all([
      prisma.auditReportHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' }
      }),
      prisma.auditReportHistory.count({ where })
    ]);

    return {
      data: history,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }
}

// Export singleton instance
const auditReportScheduler = new AuditReportScheduler();

module.exports = { auditReportScheduler };
