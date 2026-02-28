/**
 * TMS Auto-Escalation Scheduler
 * Runs periodically to check for overdue tickets and escalate them
 * 
 * Follows the same pattern as auditScheduler.service.js
 */
const cron = require('node-cron');
const { processAutoEscalations } = require('./escalation.service');

class TmsEscalationScheduler {
  constructor() {
    this.job = null;
  }

  /**
   * Initialize the scheduler
   * Called from server.js after DB connect
   */
  async initialize() {
    try {
      // Run auto-escalation check every hour
      this.job = cron.schedule('0 * * * *', async () => {
        console.log('[TMS] Running auto-escalation check...');
        try {
          const results = await processAutoEscalations();
          const escalatedCount = results.filter(r => r.action === 'escalated').length;
          const errorCount = results.filter(r => r.action === 'error').length;
          if (escalatedCount > 0) {
            console.log(`[TMS] Auto-escalated ${escalatedCount} ticket(s)`);
          }
          if (errorCount > 0) {
            console.error(`[TMS] Auto-escalation errors: ${errorCount}`);
          }
        } catch (error) {
          console.error('[TMS] Auto-escalation job failed:', error.message);
        }
      }, {
        scheduled: true,
        timezone: 'Asia/Kolkata',
      });

      console.log('[TMS] Auto-escalation scheduler initialized (runs every hour)');
    } catch (error) {
      console.error('[TMS] Failed to initialize escalation scheduler:', error.message);
    }
  }

  /**
   * Stop the scheduler (for graceful shutdown)
   */
  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('[TMS] Auto-escalation scheduler stopped');
    }
  }
}

const tmsEscalationScheduler = new TmsEscalationScheduler();

module.exports = { tmsEscalationScheduler };
