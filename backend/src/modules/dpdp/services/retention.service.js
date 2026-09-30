/**
 * @module dpdp/services/retention
 * @description Storage limitation (DPDP s. 8(7)): retention policies and the work the
 * daily retention job does for one university.
 */
const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { AppError } = require('../../../shared/utils/AppError');
const { RETENTION_CATEGORIES } = require('../dpdp.constants');
const { normalizeRetentionPolicy, resolveEffectivePolicies, retentionCutoff } = require('../dpdp.utils');
const { dpdpAudit, AuditActionType } = require('./dpdpAudit.service');

const log = createModuleLogger('dpdp');

const ANONYMISE_BATCH = parseInt(process.env.DPDP_RETENTION_ANONYMISE_BATCH || '200', 10) || 200;

/** Is the retention job allowed to change data? Default: dry run (DPDP_RETENTION_DRY_RUN unset → true). */
const isDryRun = (env = process.env) => String(env.DPDP_RETENTION_DRY_RUN ?? 'true').toLowerCase() !== 'false';

/** Policy rows visible for a tenant (its own + platform), filtered explicitly. */
const loadPolicyRows = (tenantId) => prisma.dataRetentionPolicy.findMany({
  where: tenantId ? { OR: [{ universityId: tenantId }, { universityId: null }] } : { universityId: null },
});

/** GET /admin/retention-policies: effective policy per category with its source. */
const getEffectivePolicies = async (tenantId) => resolveEffectivePolicies(await loadPolicyRows(tenantId), tenantId);

/**
 * PUT /admin/retention-policies. Tenant admins write tenant rows; a superadmin without a
 * tenant selected writes platform defaults. Floors (e.g. audit_log >= 365 days) enforced.
 */
const savePolicies = async ({ req, tenantId, policies }) => {
  const normalized = policies.map(normalizeRetentionPolicy);
  for (const p of normalized) {
    if (tenantId && RETENTION_CATEGORIES[p.category].platformOnly) {
      throw new AppError(`${p.category} is a platform-wide policy and can only be set by the platform administrator`, 400);
    }
  }
  const scope = tenantId || null;
  await prisma.$transaction(async (tx) => {
    for (const p of normalized) {
      const existing = await tx.dataRetentionPolicy.findFirst({ where: { universityId: scope, category: p.category }, select: { id: true } });
      if (existing) {
        await tx.dataRetentionPolicy.update({ where: { id: existing.id }, data: { retentionDays: p.retentionDays, action: p.action, isActive: true } });
      } else {
        await tx.dataRetentionPolicy.create({ data: { universityId: scope, ...p, isActive: true } });
      }
    }
  });
  await dpdpAudit({
    req,
    action: `DPDP retention policies updated (${scope ? 'university' : 'platform'})`,
    actionType: AuditActionType.CONFIG_CHANGE,
    category: 'retention',
    targetTable: 'data_retention_policies',
    details: { policies: normalized },
  });
  return getEffectivePolicies(tenantId);
};

// ── job work ─────────────────────────────────────────────────────────────────

/**
 * Apply one tenant's effective policies. Must run inside runForTenant(universityId).
 * @returns {Promise<object>} per-category counts ({ matched, changed })
 */
const applyTenantPolicies = async (universityId, { dryRun = isDryRun(), now = new Date() } = {}) => {
  const policies = await getEffectivePolicies(universityId);
  const summary = {};
  for (const policy of policies) {
    if (policy.platformOnly) continue;
    const cutoff = retentionCutoff(policy.retentionDays, now);
    try {
      summary[policy.category] = await applyCategory(policy, cutoff, { dryRun, universityId });
    } catch (err) {
      log.error('Retention category failed', { universityId, category: policy.category, error: err.message });
      summary[policy.category] = { error: err.message };
    }
  }
  return summary;
};

const applyCategory = async (policy, cutoff, { dryRun, universityId }) => {
  switch (policy.category) {
    case 'audit_log': {
      const where = { createdAt: { lt: cutoff } };
      const matched = await prisma.auditLog.count({ where });
      const changed = dryRun || !matched ? 0 : (await prisma.auditLog.deleteMany({ where })).count;
      return { matched, changed, action: 'delete', retentionDays: policy.retentionDays };
    }
    case 'notifications': {
      const where = { createdAt: { lt: cutoff } };
      const matched = await prisma.notification.count({ where });
      const changed = dryRun || !matched ? 0 : (await prisma.notification.deleteMany({ where })).count;
      return { matched, changed, action: 'delete', retentionDays: policy.retentionDays };
    }
    case 'bug_reports': {
      const where = { resolutionStatus: 'resolved', createdAt: { lt: cutoff } };
      if (policy.action === 'delete') {
        const matched = await prisma.bugReport.count({ where });
        // screenshot rows cascade; stored files are left to the storage lifecycle rules
        const changed = dryRun || !matched ? 0 : (await prisma.bugReport.deleteMany({ where })).count;
        return { matched, changed, action: 'delete', retentionDays: policy.retentionDays };
      }
      const anonWhere = { ...where, NOT: { userIdentifier: 'erased' } };
      const matched = await prisma.bugReport.count({ where: anonWhere });
      const changed = dryRun || !matched ? 0 : (await prisma.bugReport.updateMany({
        where: anonWhere,
        data: { userIdentifier: 'erased', userEmail: null, description: '[removed by data retention policy]' },
      })).count;
      return { matched, changed, action: 'anonymize', retentionDays: policy.retentionDays };
    }
    case 'inactive_student_accounts': {
      // lazy require: rights.service → consent.service → … avoids a load-order cycle
      const rights = require('./rights.service');
      const students = await prisma.studentDetails.findMany({
        where: { graduationDate: { lt: cutoff }, userLoginId: { not: null }, userLogin: { anonymizedAt: null } },
        select: { userLoginId: true },
        take: ANONYMISE_BATCH,
      });
      const matched = students.length;
      let changed = 0;
      let skippedOpenWork = 0;
      if (!dryRun) {
        for (const s of students) {
          const out = await rights.anonymiseUser({ userId: s.userLoginId, reason: 'retention', actorId: null, universityId });
          if (out.erased) changed += 1; else skippedOpenWork += 1;
        }
      }
      return { matched, changed, skippedOpenWork, action: 'anonymize', retentionDays: policy.retentionDays, batchLimit: ANONYMISE_BATCH };
    }
    default:
      return { skipped: true };
  }
};

/** Platform-only categories (tables without universityId). Runs unscoped as system. */
const applyPlatformPolicies = async ({ dryRun = isDryRun(), now = new Date() } = {}) => tenantContext.runAsSystem(async () => {
  const policies = await getEffectivePolicies(null);
  const summary = {};
  const tokens = policies.find((p) => p.category === 'password_reset_tokens');
  if (tokens) {
    const cutoff = retentionCutoff(tokens.retentionDays, now);
    const where = { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] };
    const matched = await prisma.passwordResetToken.count({ where });
    const changed = dryRun || !matched ? 0 : (await prisma.passwordResetToken.deleteMany({ where })).count;
    summary.password_reset_tokens = { matched, changed, action: 'delete', retentionDays: tokens.retentionDays };
  }
  return summary;
});

module.exports = { isDryRun, getEffectivePolicies, savePolicies, applyTenantPolicies, applyPlatformPolicies };
