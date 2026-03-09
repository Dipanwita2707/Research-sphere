/**
 * Email Queue (BullMQ + Redis)
 *
 * Background job processing for bulk email sending.
 * If Redis is unavailable, the queue gracefully degrades and the
 * controller falls back to synchronous sending.
 *
 * Architecture:
 *   Controller → enqueue(jobData) → BullMQ Queue → Worker → sendBulk
 *   Controller → enqueue fails   → fallback sync send (same flow as before)
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const prisma = require('../shared/config/database');
const bulkEmailService = require('../modules/event-management/services/bulkEmail.service');
const emailCreditService = require('../modules/event-management/services/emailCredit.service');

const QUEUE_NAME = 'bulk-email';

let queue = null;
let worker = null;
let _redisConnection = null;
let _available = false;

// ── Redis Connection (separate from cache — BullMQ needs its own) ────────────

function _createRedisConnection() {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requirement
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    maxRetriesPerRequest: null, // BullMQ requirement
    enableReadyCheck: false,
    lazyConnect: true,
  });
}

// ── Worker processor ─────────────────────────────────────────────────────────

async function processEmailJob(job) {
  const {
    emailLogId,
    eventId,
    eventName,
    subject,
    body,
    recipients,
    replyTo,
  } = job.data;

  console.log(`[EmailQueue] Processing job ${job.id} — emailLog ${emailLogId}, ${recipients.length} recipient(s)`);

  // Run independent setup in parallel:
  // 1. Mark log as 'sending'
  // 2. Create per-recipient logs
  // 3. Deduct email credits
  const [, , recipientLogs] = await Promise.all([
    prisma.eventEmailLog.update({
      where: { id: emailLogId },
      data: { status: 'sending' },
    }),
    emailCreditService.deductCredits(eventId, recipients.length, emailLogId),
    prisma.emailRecipientLog.createMany({
      data: recipients.map((r) => ({
        emailLogId,
        email: r.email,
        name: r.name || '',
        status: 'queued',
      })),
    }).then(() =>
      prisma.emailRecipientLog.findMany({
        where: { emailLogId },
        select: { id: true, email: true },
      })
    ),
  ]);

  // Build tracking ID map from freshly created recipient logs
  const recipientTrackingIds = {};
  for (const rl of recipientLogs) {
    recipientTrackingIds[rl.email] = rl.id;
  }

  // Build tracking base URL
  const trackingBaseUrl = process.env.BACKEND_PUBLIC_URL
    ? `${process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '')}/api/v1/events`
    : `https://localhost:${process.env.PORT || 5000}/api/v1/events`;

  // Send via SendGrid
  const result = await bulkEmailService.sendBulk({
    eventName,
    subject,
    body,
    recipients,
    replyTo,
    trackingBaseUrl,
    recipientTrackingIds,
  });

  // Update email log with results
  await prisma.eventEmailLog.update({
    where: { id: emailLogId },
    data: {
      sentCount: result.sent,
      failedCount: result.failed,
      status: result.failed === 0 ? 'sent' : result.sent === 0 ? 'failed' : 'partial',
      errors: result.errors || [],
      sentAt: new Date(),
    },
  });

  // Mark failed recipients
  if (result.failedEmails?.length > 0) {
    await prisma.emailRecipientLog.updateMany({
      where: { emailLogId, email: { in: result.failedEmails } },
      data: { status: 'failed', failureReason: 'SendGrid API error', failedAt: new Date() },
    });
  }

  // Mark successful recipients
  const successEmails = recipients.map((r) => r.email).filter((e) => !result.failedEmails?.includes(e));
  if (successEmails.length > 0) {
    await prisma.emailRecipientLog.updateMany({
      where: { emailLogId, email: { in: successEmails } },
      data: { status: 'delivered', deliveredAt: new Date() },
    });
  }

  // Refund credits for failed deliveries (non-blocking)
  if (result.failed > 0) {
    emailCreditService.refundCredits(eventId, result.failed, emailLogId).catch((err) =>
      console.error('[EmailQueue] Credit refund error:', err.message)
    );
  }

  console.log(`[EmailQueue] ✓ Job ${job.id} done — sent ${result.sent}, failed ${result.failed}`);
  return { sent: result.sent, failed: result.failed };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize the email queue and worker.
 * Call once on server startup (after Redis init).
 * Safe to call even if Redis is unavailable — it will just mark itself as unavailable.
 */
async function init() {
  try {
    _redisConnection = _createRedisConnection();
    await _redisConnection.connect();

    // Test connectivity
    await _redisConnection.ping();

    // Create queue
    queue = new Queue(QUEUE_NAME, { connection: _redisConnection });

    // Create worker (same process for simplicity; can be separate process later)
    const workerConnection = _redisConnection.duplicate();
    worker = new Worker(QUEUE_NAME, processEmailJob, {
      connection: workerConnection,
      concurrency: 2, // process 2 email jobs at a time
    });

    worker.on('failed', (job, err) => {
      console.error(`[EmailQueue] Job ${job?.id} failed:`, err.message);
      // Mark the email log as failed
      if (job?.data?.emailLogId) {
        prisma.eventEmailLog.update({
          where: { id: job.data.emailLogId },
          data: { status: 'failed', errors: [err.message] },
        }).catch(() => {});
      }
    });

    worker.on('completed', (job) => {
      console.log(`[EmailQueue] Job ${job.id} completed`);
    });

    _available = true;
    console.log('[EmailQueue] ✓ BullMQ queue + worker initialized (Redis connected)');
  } catch (err) {
    _available = false;
    console.warn(`[EmailQueue] Redis unavailable — falling back to sync sending. (${err.message})`);
    // Clean up partial connections
    try { _redisConnection?.disconnect(); } catch (_) {}
    _redisConnection = null;
    queue = null;
    worker = null;
  }
}

/**
 * Check if the queue is available (Redis connected + queue initialized).
 */
function isAvailable() {
  return _available && queue !== null;
}

/**
 * Enqueue a bulk email job for background processing.
 * Returns the BullMQ job, or null if enqueue failed.
 *
 * @param {Object} jobData
 * @param {string} jobData.emailLogId
 * @param {string} jobData.eventId       - internal UUID
 * @param {string} jobData.eventName
 * @param {string} jobData.subject
 * @param {string} jobData.body
 * @param {Array}  jobData.recipients
 * @param {string} [jobData.replyTo]
 * @param {Object} [jobData.recipientTrackingIds]
 */
async function enqueue(jobData) {
  if (!isAvailable()) return null;

  try {
    const job = await queue.add('send-bulk', jobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400 },   // keep completed jobs for 24h
      removeOnFail: { age: 7 * 86400 },   // keep failed jobs for 7 days
    });
    console.log(`[EmailQueue] Enqueued job ${job.id} for emailLog ${jobData.emailLogId}`);
    return job;
  } catch (err) {
    console.error('[EmailQueue] Enqueue failed:', err.message);
    // Mark queue as unavailable so next request uses sync fallback
    _available = false;
    return null;
  }
}

/**
 * Gracefully shut down the queue and worker.
 */
async function shutdown() {
  try {
    if (worker) await worker.close();
    if (queue) await queue.close();
    if (_redisConnection) _redisConnection.disconnect();
    console.log('[EmailQueue] Shut down cleanly');
  } catch (err) {
    console.error('[EmailQueue] Shutdown error:', err.message);
  }
}

module.exports = { init, isAvailable, enqueue, shutdown };
