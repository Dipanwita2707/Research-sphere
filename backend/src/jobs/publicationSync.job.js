const cron = require('node-cron');
const { publicationSyncService } = require('../modules/research/services');

let publicationSyncJob = null;

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
      const results = await publicationSyncService.runScheduledSync();
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
};
