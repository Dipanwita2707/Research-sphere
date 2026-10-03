/**
 * Audit Report Scheduler
 * Handles scheduled generation and sending of audit reports
 */

const cron = require('node-cron');
const prisma = require('../../../shared/config/database');
const { auditService, AuditActionType, AuditModule, AuditSeverity } = require('./audit.service');
const { emailService } = require('../../core/services/email.service');
const { excelExportService } = require('../../core/services/excelExport.service');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const path = require('path');
const fs = require('fs').promises;

const envInt = (name, def) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};

/** Report limits (env-tunable). */
const reportLimits = () => ({
  // Detail rows written to the "Detailed Logs" sheet; the summary always covers every log.
  maxRows: envInt('AUDIT_REPORT_MAX_ROWS', 50000),
  pageSize: envInt('AUDIT_REPORT_PAGE_SIZE', 5000),
  // Postgres statement_timeout for each query of the report.
  statementTimeoutMs: envInt('AUDIT_REPORT_STATEMENT_TIMEOUT_MS', 60000),
  // Wall-clock budget for loading the whole report.
  overallTimeoutMs: envInt('AUDIT_REPORT_TIMEOUT_MS', 10 * 60 * 1000),
});

/** Only the columns the Excel report shows (no JSON payloads such as details/old/new values). */
const DETAIL_SELECT = {
  id: true,
  createdAt: true,
  actorId: true,
  action: true,
  actionType: true,
  module: true,
  category: true,
  severity: true,
  targetTable: true,
  targetId: true,
  requestPath: true,
  requestMethod: true,
  responseStatus: true,
  duration: true,
  ipAddress: true,
  errorMessage: true,
};

class ReportTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReportTimeoutError';
  }
}

class AuditReportScheduler {
  constructor() {
    this.jobs = new Map();
    // backend/uploads/audit-reports/<universityId|platform>/ — never served by the
    // /uploads file route (see modules/uploads/fileAccess.service.js)
    this.reportsDir = path.join(__dirname, '../../../../uploads/audit-reports');
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
      await this.runScheduledReport('monthly');
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
      await this.runScheduledReport('weekly');
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
      await this.runScheduledReport('daily');
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
      // Deliberate cross-tenant retention sweep (same retention rule for every tenant)
      await tenantContext.runAsSystem(() => this.cleanupOldLogs());
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.jobs.set('cleanup', job);
    console.log('[SCHEDULE] Log cleanup scheduled for every Sunday at 03:00 IST');
  }

  /**
   * Scheduled run: one report per university (tenant recipients, tenant logs
   * only), then one platform report for platform-level recipients
   * (AuditReportConfig.universityId = null) covering all tenants.
   */
  async runScheduledReport(reportType) {
    const { forEachTenant } = require('../../../jobs/jobRunner');
    await forEachTenant(() => this.generateAndSendReport(reportType), { label: `AuditReport:${reportType}` });
    await tenantContext.runAsSystem(() => this.generateAndSendReport(reportType));
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
   * Run fn(tx) in a transaction whose statements Postgres cancels after `ms`
   * (SET LOCAL statement_timeout), and that Prisma abandons shortly after, so a
   * stuck query fails fast instead of holding the report for hours.
   */
  async withStatementTimeout(fn, ms) {
    const timeout = Math.max(1000, Math.floor(ms));
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${timeout}`);
      return fn(tx);
    }, { maxWait: 10000, timeout: timeout + 5000 });
  }

  /**
   * Load what an audit report needs for [startDate, endDate]:
   *  - statistics aggregated in the database (count / groupBy), covering every log
   *  - detail rows (only the columns the report shows), keyset-paged, at most `maxRows`
   *  - when details are truncated, the period's error rows fetched separately so the
   *    "Errors & Warnings" sheet stays complete (also capped at `maxRows`)
   * Every query has a statement timeout and the whole load an overall deadline.
   * @returns {Promise<{ logs, errorLogs, statistics, truncation }>}
   */
  async loadReportData(startDate, endDate, limits = reportLimits()) {
    const started = Date.now();
    const deadline = started + limits.overallTimeoutMs;
    const remaining = () => deadline - Date.now();
    const checkDeadline = (stage) => {
      if (remaining() <= 0) {
        throw new ReportTimeoutError(`Audit report data load exceeded ${Math.round(limits.overallTimeoutMs / 1000)} s (${stage})`);
      }
    };
    const run = (fn) => {
      checkDeadline('before query');
      return this.withStatementTimeout(fn, Math.min(limits.statementTimeoutMs, remaining()));
    };
    const range = { createdAt: { gte: startDate, lte: endDate } };

    const statistics = await run((tx) => auditService.getStatistics(
      { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      { db: tx }
    ));

    // Keyset pagination on (createdAt, id): stable and index-friendly, unlike OFFSET.
    const pageThrough = async (where, max) => {
      const out = [];
      let last = null;
      while (out.length < max) {
        const take = Math.min(limits.pageSize, max - out.length);
        const after = last
          ? { OR: [{ createdAt: { gt: last.createdAt } }, { createdAt: last.createdAt, id: { gt: last.id } }] }
          : {};
        const page = await run((tx) => tx.auditLog.findMany({
          where: { AND: [where, after] },
          select: DETAIL_SELECT,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take,
        }));
        out.push(...page);
        if (page.length < take) break;
        last = page[page.length - 1];
      }
      return out;
    };

    const logs = await pageThrough(range, limits.maxRows);
    const total = statistics.totalLogs;
    const truncated = total > logs.length;

    let errorLogs;
    if (truncated) {
      errorLogs = await pageThrough(
        { ...range, OR: [{ severity: { in: ['ERROR', 'CRITICAL'] } }, { responseStatus: { gte: 400 } }] },
        limits.maxRows
      );
    }

    // Actor names, looked up once per distinct actor (the old per-row join loaded the same users
    // thousands of times). Like the former `include`, this follows the log's actorId as-is.
    const actorIds = [...new Set([...logs, ...(errorLogs || [])].map((l) => l.actorId).filter(Boolean))];
    const actors = new Map();
    for (let i = 0; i < actorIds.length; i += 1000) {
      const chunk = actorIds.slice(i, i + 1000);
      const users = await tenantContext.runAsSystem(() => run((tx) => tx.userLogin.findMany({
        where: { id: { in: chunk } },
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          employeeDetails: { select: { displayName: true, empId: true, designation: true } },
        },
      })));
      users.forEach((u) => actors.set(u.id, u));
    }
    const withActor = (l) => ({ ...l, actor: l.actorId ? actors.get(l.actorId) || null : null });

    return {
      logs: logs.map(withActor),
      errorLogs: errorLogs ? errorLogs.map(withActor) : undefined,
      statistics,
      truncation: { truncated, shown: logs.length, total, maxRows: limits.maxRows },
      loadMs: Date.now() - started,
    };
  }

  /**
   * Build the Excel audit report for a period (no email, no history row).
   * @returns {Promise<{ buffer, statistics, logCount, truncation }>}
   */
  async buildReport({ startDate, endDate, limits } = {}) {
    const data = await this.loadReportData(startDate, endDate, limits);
    if (data.truncation.truncated) {
      console.warn(`[REPORT] Audit report truncated: ${data.truncation.shown} of ${data.truncation.total} log entries included`);
    }
    const period = {
      year: startDate.getFullYear(),
      month: startDate.getMonth() + 1,
      startDate,
      endDate,
      monthName: startDate.toLocaleString('default', { month: 'long' })
    };
    const buffer = await excelExportService.generateAuditReport({
      logs: data.logs,
      errorLogs: data.errorLogs,
      truncation: data.truncation,
      period,
      statistics: data.statistics
    });
    return { buffer, statistics: data.statistics, logCount: data.logs.length, truncation: data.truncation, loadMs: data.loadMs };
  }

  /** Readable reason for a failed report (timeouts are expected operational failures). */
  describeReportError(error) {
    if (error instanceof ReportTimeoutError) return error.message;
    const text = `${error?.code || ''} ${error?.message || ''}`;
    if (/57014|statement timeout|canceling statement/i.test(text)) return 'Audit report query timed out (statement_timeout); try a shorter period';
    if (/P2028|Transaction already closed|transaction.*timeout|expired transaction/i.test(text)) return 'Audit report query timed out; try a shorter period';
    return error?.message || String(error);
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

    // Inside a tenant context the query is scoped to that university. Outside
    // one (platform/system run) only platform-level recipients may receive the
    // cross-tenant report — never another university's configured recipients.
    const tenantId = tenantContext.getTenantId();
    const recipients = await prisma.auditReportConfig.findMany({
      where: {
        isActive: true,
        [flag]: true,
        ...(tenantId ? {} : { universityId: null })
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
        return { success: false, skipped: true, error: `No recipients configured for ${reportType} reports` };
      }

      const recipientEmails = recipientConfigs.map(r => r.email);
      const scopeLabel = tenantContext.getTenantId() || 'platform';
      console.log(`📧 Sending ${reportType} report (${scopeLabel}) to ${recipientEmails.length} recipient(s)`);

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

      // Aggregated statistics + capped, paged detail rows, with timeouts
      const { buffer: excelBuffer, statistics, logCount, truncation } = await this.buildReport({ startDate, endDate });

      // Save report file
      const fileName = `audit-report-${reportType}-${startDate.toISOString().split('T')[0]}.xlsx`;
      const reportDir = path.join(this.reportsDir, scopeLabel);
      await fs.mkdir(reportDir, { recursive: true });
      const filePath = path.join(reportDir, fileName);
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
          totalLogs: statistics.totalLogs,
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
          logCount,
          totalLogs: statistics.totalLogs,
          truncated: truncation.truncated,
          success: emailResult.success
        }
      });

      console.log(`[SUCCESS] ${reportType} audit report sent to ${recipientEmails.length} recipients`);
      return { success: true, recipientCount: recipientEmails.length, logCount, totalLogs: statistics.totalLogs, truncated: truncation.truncated };

    } catch (error) {
      const reason = this.describeReportError(error);
      console.error(`Failed to generate ${reportType} audit report: ${reason}`, error);

      // Update report history with error (best effort: the DB may be the problem)
      if (reportHistory) {
        await prisma.auditReportHistory.update({
          where: { id: reportHistory.id },
          data: {
            status: 'failed',
            errorMsg: reason
          }
        }).catch((e) => console.error('Failed to record audit report failure:', e.message));
      }

      // Log the error
      await auditService.log({
        action: `Failed to generate ${reportType} audit report`,
        actionType: AuditActionType.OTHER,
        module: AuditModule.SYSTEM,
        category: 'report',
        severity: AuditSeverity.ERROR,
        errorMessage: reason,
        metadata: { reportType, stack: error.stack }
      }).catch(() => {});

      return { success: false, error: reason };
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

      // Aggregated statistics + capped, paged detail rows, with timeouts
      const { buffer: excelBuffer, statistics, logCount, truncation, loadMs } = await this.buildReport({ startDate: start, endDate: end });

      console.log(`[REPORT] Excel report generated with ${logCount} of ${statistics.totalLogs} log entries (data loaded in ${loadMs} ms)`);

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
        
        console.log(`[SUCCESS] Email sent successfully with ${logCount} logs for period ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`);
      }

      return {
        success: true,
        buffer: excelBuffer,
        statistics,
        logCount,
        totalLogs: statistics.totalLogs,
        truncated: truncation.truncated
      };

    } catch (error) {
      const reason = this.describeReportError(error);
      console.error(`Failed to generate on-demand report: ${reason}`, error);
      return { success: false, error: reason };
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

module.exports = { auditReportScheduler, AuditReportScheduler, ReportTimeoutError, reportLimits };
