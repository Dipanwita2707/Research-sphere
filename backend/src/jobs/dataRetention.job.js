/**
 * DPDP data retention job (DPDP Act s. 8(7): erase personal data once its purpose is served).
 *
 * Daily, for each university (inside tenantContext.runForTenant), applies the effective
 * DataRetentionPolicy per category (tenant row > platform row > built-in default), then the
 * platform-only categories (password reset tokens). Writes one audit entry per university
 * with counts only.
 *
 * DRY RUN BY DEFAULT: unless DPDP_RETENTION_DRY_RUN=false, the job only counts what it
 * would delete/anonymise. Deletion and anonymisation are irreversible, so an operator
 * should review a few dry-run logs (and the policies each university configured) before
 * enabling it.
 *
 * Env:
 *   DPDP_RETENTION_ENABLED   default true  ('false' → job not scheduled)
 *   DPDP_RETENTION_DRY_RUN   default true  ('false' → actually delete/anonymise)
 *   DPDP_RETENTION_CRON      default '15 2 * * *' (02:15 daily, server time)
 */
const cron = require('node-cron');
const prisma = require('../shared/config/database');
const tenantContext = require('../shared/tenancy/tenantContext');
const { createModuleLogger } = require('../shared/utils/logger');

const log = createModuleLogger('dpdp-retention');

let job = null;
let running = false;

/**
 * Run retention once for every university.
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {Promise<{ dryRun: boolean, universities: object[], platform: object }>}
 */
async function runDataRetention(opts = {}) {
  const retention = require('../modules/dpdp/services/retention.service');
  const { dpdpAudit, AuditActionType } = require('../modules/dpdp/services/dpdpAudit.service');
  const dryRun = opts.dryRun !== undefined ? !!opts.dryRun : retention.isDryRun();
  if (running) {
    log.warn('Retention run already in progress; skipping');
    return { skipped: true };
  }
  running = true;
  const started = Date.now();
  const report = { dryRun, universities: [], platform: {} };
  try {
    const universities = await tenantContext.runAsSystem(() => prisma.university.findMany({ select: { id: true, code: true } }));
    for (const uni of universities) {
      try {
        const summary = await tenantContext.runForTenant(uni.id, () => retention.applyTenantPolicies(uni.id, { dryRun }));
        report.universities.push({ universityId: uni.id, code: uni.code, summary });
        log.info(`[Retention] ${dryRun ? 'DRY RUN ' : ''}${uni.code}`, { universityId: uni.id, summary });
        await dpdpAudit({
          universityId: uni.id,
          actorId: null,
          action: `DPDP retention job ${dryRun ? '(dry run) ' : ''}completed`,
          actionType: AuditActionType.DELETE,
          category: 'retention',
          targetTable: 'data_retention_policies',
          details: { dryRun, summary },
        });
      } catch (err) {
        log.error('[Retention] university failed', { universityId: uni.id, error: err.message });
        report.universities.push({ universityId: uni.id, code: uni.code, error: err.message });
      }
    }
    try {
      report.platform = await retention.applyPlatformPolicies({ dryRun });
      log.info(`[Retention] ${dryRun ? 'DRY RUN ' : ''}platform`, { summary: report.platform });
    } catch (err) {
      log.error('[Retention] platform categories failed', { error: err.message });
      report.platform = { error: err.message };
    }
    log.info(`[Retention] finished in ${Date.now() - started} ms`, { dryRun, universities: report.universities.length });
    return report;
  } finally {
    running = false;
  }
}

function startDataRetentionJob() {
  if (job) return job;
  if (process.env.DPDP_RETENTION_ENABLED === 'false') {
    log.info('[Retention] disabled by DPDP_RETENTION_ENABLED=false');
    return null;
  }
  const expr = process.env.DPDP_RETENTION_CRON || '15 2 * * *';
  if (!cron.validate(expr)) {
    log.error(`[Retention] invalid DPDP_RETENTION_CRON "${expr}"; job not scheduled`);
    return null;
  }
  job = cron.schedule(expr, () => {
    runDataRetention().catch((err) => log.error('[Retention] run failed', { error: err.message }));
  });
  const dry = require('../modules/dpdp/services/retention.service').isDryRun();
  log.info(`[Retention] scheduled "${expr}"${dry ? ' in DRY RUN mode (set DPDP_RETENTION_DRY_RUN=false to apply)' : ''}`);
  return job;
}

function stopDataRetentionJob() {
  if (job) {
    job.stop();
    job = null;
  }
}

module.exports = {
  startDataRetentionJob,
  stopDataRetentionJob,
  runDataRetention,
  // generic aliases
  start: startDataRetentionJob,
  stop: stopDataRetentionJob,
};
