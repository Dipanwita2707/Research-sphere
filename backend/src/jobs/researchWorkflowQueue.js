/**
 * Research Workflow Queue
 *
 * Background processing for research workflow side effects:
 * - in-app notifications
 * - audit log entries for status changes
 *
 * If Redis/BullMQ is unavailable, the queue falls back to synchronous execution.
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const prisma = require('../shared/config/database');
const auditLogger = require('../shared/utils/auditLogger');

const QUEUE_NAME = 'research-workflow';

let queue = null;
let worker = null;
let redisConnection = null;
let available = false;

function createRedisConnection() {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }

  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
}

function buildRequestFromContext(requestContext = {}) {
  const ip = requestContext.ipAddress || requestContext.ip || '0.0.0.0';
  const userAgent = requestContext.userAgent || 'background-worker';

  return {
    ip,
    headers: {
      'user-agent': userAgent,
      'x-forwarded-for': ip,
    },
  };
}

async function processResearchWorkflowJob(job) {
  const { type, payload } = job.data;

  if (type === 'notification') {
    await prisma.notification.create({ data: payload });
    return { ok: true, type };
  }

  if (type === 'audit_status_change') {
    await auditLogger.logResearchStatusChange(
      payload.contribution,
      payload.oldStatus,
      payload.newStatus,
      payload.userId,
      buildRequestFromContext(payload.requestContext),
      payload.comments || null
    );
    return { ok: true, type };
  }

  throw new Error(`Unsupported research workflow job type: ${type}`);
}

async function init() {
  try {
    redisConnection = createRedisConnection();
    await redisConnection.connect();
    await redisConnection.ping();

    queue = new Queue(QUEUE_NAME, { connection: redisConnection });
    const workerConnection = redisConnection.duplicate();
    worker = new Worker(QUEUE_NAME, processResearchWorkflowJob, {
      connection: workerConnection,
      concurrency: 4,
    });

    worker.on('failed', (job, err) => {
      console.error(`[ResearchWorkflowQueue] Job ${job?.id} failed:`, err.message);
    });

    worker.on('completed', (job) => {
      console.log(`[ResearchWorkflowQueue] Job ${job.id} completed`);
    });

    available = true;
    console.log('[ResearchWorkflowQueue] ✓ BullMQ queue + worker initialized');
  } catch (error) {
    available = false;
    console.warn(`[ResearchWorkflowQueue] Redis unavailable — using sync fallback. (${error.message})`);
    try { redisConnection?.disconnect(); } catch (_) {}
    redisConnection = null;
    queue = null;
    worker = null;
  }
}

function isAvailable() {
  return available && queue !== null;
}

async function enqueue(type, payload) {
  if (!isAvailable()) return null;

  try {
    const job = await queue.add(type, { type, payload }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 7 * 86400 },
    });
    return job;
  } catch (error) {
    console.error('[ResearchWorkflowQueue] Enqueue failed:', error.message);
    available = false;
    return null;
  }
}

async function dispatchNotification(data) {
  const job = await enqueue('notification', data);
  if (job) return job;
  return prisma.notification.create({ data });
}

async function dispatchResearchStatusAudit({
  contribution,
  oldStatus,
  newStatus,
  userId,
  requestContext,
  comments,
}) {
  const job = await enqueue('audit_status_change', {
    contribution,
    oldStatus,
    newStatus,
    userId,
    requestContext,
    comments,
  });
  if (job) return job;

  return auditLogger.logResearchStatusChange(
    contribution,
    oldStatus,
    newStatus,
    userId,
    buildRequestFromContext(requestContext),
    comments || null
  );
}

async function shutdown() {
  try {
    if (worker) await worker.close();
    if (queue) await queue.close();
    if (redisConnection) redisConnection.disconnect();
    console.log('[ResearchWorkflowQueue] Shut down cleanly');
  } catch (error) {
    console.error('[ResearchWorkflowQueue] Shutdown error:', error.message);
  }
}

module.exports = {
  init,
  isAvailable,
  enqueue,
  dispatchNotification,
  dispatchResearchStatusAudit,
  shutdown,
};
