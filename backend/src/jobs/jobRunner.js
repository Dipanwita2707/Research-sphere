/**
 * Shared helpers for background jobs.
 *
 * Instance election (PM2 cluster / multiple containers)
 * -----------------------------------------------------
 * Schedulers and cron jobs must run on exactly one process, otherwise every
 * instance fires the same job (duplicate reports, double billing rows, parallel
 * publication syncs). A process runs schedulers only when BOTH hold:
 *   - RUN_JOBS is not "false"  (default true; set RUN_JOBS=false on web-only
 *     replicas, e.g. extra Render/K8s instances, and true on one worker)
 *   - it is PM2 instance 0     (NODE_APP_INSTANCE / pm_id unset or "0")
 * Queue *workers* (BullMQ) are safe on every instance; only schedulers are gated.
 *
 * Tenancy
 * -------
 * Jobs run outside any request, so Prisma is unscoped. Per-tenant work must go
 * through forEachTenant() (tenantContext.runForTenant) so reads are filtered and
 * creates are stamped with universityId; deliberate cross-tenant reads go through
 * tenantContext.runAsSystem().
 */
const prisma = require('../shared/config/database');
const tenantContext = require('../shared/tenancy/tenantContext');

function isJobsInstance() {
  if (process.env.RUN_JOBS === 'false') return false;
  const instance = process.env.NODE_APP_INSTANCE ?? process.env.pm_id;
  return instance === undefined || instance === '' || String(instance) === '0';
}

/** Ids of universities a job should process (active tenants by default). */
async function listUniversityIds({ activeOnly = true } = {}) {
  const rows = await tenantContext.runAsSystem(() =>
    prisma.university.findMany({
      where: activeOnly ? { isActive: true } : {},
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  );
  return rows.map((r) => r.id);
}

/**
 * Run fn(universityId) once per university inside that tenant's context.
 * Errors are isolated per tenant and returned, never thrown.
 */
async function forEachTenant(fn, { activeOnly = true, label = 'job' } = {}) {
  const ids = await listUniversityIds({ activeOnly });
  const results = [];
  for (const universityId of ids) {
    try {
      const value = await tenantContext.runForTenant(universityId, () => fn(universityId));
      results.push({ universityId, ok: true, value });
    } catch (error) {
      console.error(`[${label}] Failed for university ${universityId}:`, error.message);
      results.push({ universityId, ok: false, error: error.message });
    }
  }
  return results;
}

module.exports = { isJobsInstance, listUniversityIds, forEachTenant };
