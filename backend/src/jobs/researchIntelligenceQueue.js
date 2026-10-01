/**
 * Research Intelligence Queue
 *
 * Runs the per-tenant intelligence pipeline (keywords → taxonomy → expertise) in the
 * background. Uses BullMQ when Redis is reachable, otherwise runs in-process.
 * Every job executes inside tenantContext.runForTenant so Prisma calls are tenant-scoped.
 *
 * Also schedules a nightly refresh for every active university with the module enabled (RIP_PIPELINE_CRON,
 * default 03:30; disable with RIP_PIPELINE_ENABLED=false). Only the jobs instance schedules
 * (see jobRunner.isJobsInstance: PM2 instance 0, and not when RUN_JOBS=false).
 */

const cron = require('node-cron');
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const prisma = require('../shared/config/database');
const tenantContext = require('../shared/tenancy/tenantContext');
const pipeline = require('../modules/research-intelligence/services/pipeline.service');
const access = require('../modules/research-intelligence/services/access.service');
const { isJobsInstance } = require('./jobRunner');

const QUEUE_NAME = 'research-intelligence';

let queue = null;
let worker = null;
let connection = null;
let available = false;
let initPromise = null;
let nightlyJob = null;

function createRedisConnection() {
  const opts = { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: true };
  if (process.env.REDIS_URL) return new Redis(process.env.REDIS_URL, opts);
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    ...opts,
  });
}

const runJob = ({ tenantId, runId, options }) =>
  tenantContext.runForTenant(tenantId, () => pipeline.execute(tenantId, runId, options || {}));

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      connection = createRedisConnection();
      await connection.connect();
      await connection.ping();
      queue = new Queue(QUEUE_NAME, { connection });
      // Pipeline runs are long and heavy: one at a time per process.
      worker = new Worker(QUEUE_NAME, (job) => runJob(job.data), { connection: connection.duplicate(), concurrency: 1, lockDuration: 10 * 60 * 1000 });
      worker.on('failed', (job, err) => console.error(`[ResearchIntelligenceQueue] Job ${job?.id} failed:`, err.message));
      available = true;
      console.log('[ResearchIntelligenceQueue] ✓ BullMQ queue + worker initialized');
    } catch (error) {
      available = false;
      console.warn(`[ResearchIntelligenceQueue] Redis unavailable — running pipelines in-process. (${error.message})`);
      try { connection?.disconnect(); } catch (_) {}
      connection = null;
      queue = null;
      worker = null;
    }
  })();
  return initPromise;
}

/**
 * Queue a pipeline run for a tenant. The run row must already exist (pipeline.createRun).
 * Falls back to in-process execution without awaiting it.
 */
async function enqueueRun(tenantId, runId, options = {}) {
  await init();
  if (available) {
    try {
      await queue.add('pipeline', { tenantId, runId, options }, { jobId: runId, attempts: 1, removeOnComplete: { age: 7 * 86400 }, removeOnFail: { age: 30 * 86400 } });
      return { mode: 'queue' };
    } catch (error) {
      console.error('[ResearchIntelligenceQueue] Enqueue failed, running in-process:', error.message);
    }
  }
  setImmediate(() => runJob({ tenantId, runId, options }).catch((err) => console.error('[ResearchIntelligenceQueue] In-process run failed:', err.message)));
  return { mode: 'in-process' };
}

/** Nightly: refresh every active university that has the module enabled and research to index. */
async function runNightly() {
  const enabledIds = await access.enabledUniversityIds();
  const universities = enabledIds.length
    ? await tenantContext.runAsSystem(() =>
      prisma.university.findMany({ where: { id: { in: enabledIds }, isActive: true, researchContributions: { some: {} } }, select: { id: true } })
    )
    : [];
  for (const { id } of universities) {
    try {
      const run = await tenantContext.runForTenant(id, () => pipeline.createRun({ options: { trigger: 'nightly' } }));
      await enqueueRun(id, run.id, { trigger: 'nightly' });
    } catch (error) {
      // ConflictError when a run is already active — skip this tenant tonight.
      console.warn(`[ResearchIntelligenceQueue] Nightly run skipped for ${id}: ${error.message}`);
    }
  }
}

function start() {
  if (process.env.NODE_ENV === 'test') return;
  init().catch(() => {});
  const enabled = process.env.RIP_PIPELINE_ENABLED !== 'false';
  if (!enabled || !isJobsInstance() || nightlyJob) return;
  const expr = process.env.RIP_PIPELINE_CRON || '30 3 * * *';
  nightlyJob = cron.schedule(expr, () => runNightly().catch((err) => console.error('[ResearchIntelligenceQueue] Nightly failed:', err.message)));
  console.log(`[ResearchIntelligenceQueue] Nightly refresh scheduled with cron "${expr}"`);
}

async function shutdown() {
  try {
    nightlyJob?.stop();
    if (worker) await worker.close();
    if (queue) await queue.close();
    connection?.disconnect();
  } catch (error) {
    console.error('[ResearchIntelligenceQueue] Shutdown error:', error.message);
  }
}

module.exports = { init, start, enqueueRun, runNightly, shutdown, isAvailable: () => available };
