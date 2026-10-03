const cron = require('node-cron');
const { publicationSyncService } = require('../modules/research/services');
const { forEachTenant } = require('./jobRunner');

let publicationSyncJob = null;

let running = false;

/**
 * One scheduled pass over every tenant. Each tenant's runScheduledSync() picks its
 * due profiles in the database (oldest first, one batch) and syncs a few at a time;
 * the whole pass shares one deadline (PUBLICATION_SYNC_MAX_RUN_MS, default 45 min)
 * after which no new profile is started — the rest are picked up next run.
 * Overlapping passes are skipped.
 */
async function runScheduledSyncForAllTenants({ maxRunMs } = {}) {
  if (running) {
    console.warn('[PublicationSyncJob] Previous run still in progress; skipping this tick');
    return [];
  }
  running = true;
  try {
    const budget = Number(maxRunMs) || Number(process.env.PUBLICATION_SYNC_MAX_RUN_MS) || 45 * 60 * 1000;
    const deadline = Date.now() + budget;
    const perTenant = await forEachTenant(
      (universityId) => (Date.now() > deadline
        ? []
        : publicationSyncService.runScheduledSync({ universityId, deadline })),
      { label: 'PublicationSyncJob' }
    );
    return perTenant.flatMap((r) => (r.ok && Array.isArray(r.value) ? r.value : []));
  } finally {
    running = false;
  }
}

function startPublicationSyncJob() {
  if (publicationSyncJob) {
    return publicationSyncJob;
  }

  const cronExpression = process.env.PUBLICATION_SYNC_CRON || '0 2 * * *';
  const enabled = process.env.PUBLICATION_SYNC_ENABLED !== 'false';

  if (!enabled) {
    console.log('[PublicationSyncJob] Disabled by PUBLICATION_SYNC_ENABLED=false');
    return null;
  }

  publicationSyncJob = cron.schedule(cronExpression, async () => {
    try {
      console.log('[PublicationSyncJob] Starting scheduled faculty publication sync');
      const results = await runScheduledSyncForAllTenants();
      console.log(`[PublicationSyncJob] Completed scheduled sync for ${results.length} profile(s)`);
    } catch (error) {
      console.error('[PublicationSyncJob] Scheduled sync failed:', error.message);
    }
  });

  console.log(`[PublicationSyncJob] Scheduled with cron "${cronExpression}"`);
  return publicationSyncJob;
}

function stopPublicationSyncJob() {
  if (publicationSyncJob) {
    publicationSyncJob.stop();
    publicationSyncJob = null;
  }
}

module.exports = {
  startPublicationSyncJob,
  stopPublicationSyncJob,
  runScheduledSyncForAllTenants,
};
