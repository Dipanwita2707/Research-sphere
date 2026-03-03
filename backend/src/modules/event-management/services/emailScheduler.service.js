/**
 * Email Scheduler Service
 *
 * Polls the DB every 30 seconds for EventEmailLog entries that have
 * status='scheduled' and scheduledAt <= now(), then executes the send.
 * This works across server restarts because the schedule is persisted in DB.
 */

const prisma = require('../../../shared/config/database');
const bulkEmailService = require('./bulkEmail.service');
const emailCreditService = require('./emailCredit.service');

const POLL_INTERVAL_MS = 30_000; // 30 seconds
let _timer = null;
let _running = false;

/**
 * Execute a single scheduled email log.
 * Shared by both the scheduler and immediate-cancel-then-resend flows.
 */
async function executeScheduledEmail(log) {
  const emailLogId = log.id;
  console.log(`[EmailScheduler] Executing scheduled email ${emailLogId} (subject: "${log.subject}")`);

  try {
    // Resolve event name
    const event = await prisma.event.findUnique({
      where: { id: log.eventId },
      select: { id: true, eventId: true, name: true },
    });
    if (!event) {
      await prisma.eventEmailLog.update({
        where: { id: emailLogId },
        data: { status: 'failed', errors: [`Event not found`] },
      });
      return;
    }

    // Build recipient list
    let recipients;
    const storedIds = Array.isArray(log.registrationIds) && log.registrationIds.length > 0
      ? log.registrationIds
      : null;

    if (storedIds) {
      // Targeted send — specific registration IDs stored at schedule time
      recipients = await resolveRecipientsById(storedIds);
    } else {
      // Filter-based send
      const where = { eventId: event.id };
      if (log.filter && log.filter !== 'all') where.status = log.filter;
      recipients = await resolveRecipientsByFilter(where);
    }

    if (recipients.length === 0) {
      await prisma.eventEmailLog.update({
        where: { id: emailLogId },
        data: { status: 'failed', errors: ['No recipients found at send time'] },
      });
      return;
    }

    // Update log with final recipient count
    await prisma.eventEmailLog.update({
      where: { id: emailLogId },
      data: { recipientCount: recipients.length, status: 'sent', sentAt: new Date() },
    });

    // Create per-recipient logs
    const recipientLogs = await prisma.$transaction(
      recipients.map((r) =>
        prisma.emailRecipientLog.create({
          data: { emailLogId, email: r.email, name: r.name || '', status: 'sent' },
        })
      )
    );
    const trackingIds = {};
    for (const rl of recipientLogs) trackingIds[rl.email] = rl.id;

    // Build tracking base URL
    const trackingBaseUrl = process.env.BACKEND_PUBLIC_URL
      ? `${process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '')}/api/v1/events`
      : `${process.env.APP_URL || 'http://localhost:5001'}/api/v1/events`;
    console.log(`[EmailScheduler] pixel base URL: ${trackingBaseUrl}`);

    // Credit check before send
    const creditCheck = await emailCreditService.checkAvailable(event.id, recipients.length);
    if (!creditCheck.ok) {
      await prisma.eventEmailLog.update({
        where: { id: emailLogId },
        data: { status: 'failed', errors: [`Insufficient email credits: ${creditCheck.available} available, ${recipients.length} required.`] },
      });
      console.warn(`[EmailScheduler] Insufficient credits for log ${emailLogId}. Available: ${creditCheck.available}, required: ${recipients.length}`);
      return;
    }

    // Deduct credits upfront for ALL recipients before sending.
    // Any failed deliveries will be refunded after the batch.
    await emailCreditService.deductCredits(event.id, recipients.length, emailLogId);

    // Send
    const result = await bulkEmailService.sendBulk({
      eventName: event.name,
      subject: log.subject,
      body: log.body,
      recipients,
      replyTo: log.replyTo || undefined,
      trackingBaseUrl,
      recipientTrackingIds: trackingIds,
    });

    // Update log with results
    await prisma.eventEmailLog.update({
      where: { id: emailLogId },
      data: {
        sentCount: result.sent,
        failedCount: result.failed,
        status: result.failed === 0 ? 'sent' : result.sent === 0 ? 'failed' : 'partial',
        errors: result.errors || [],
      },
    });

    // Mark failed recipients
    if (result.failedEmails?.length > 0) {
      await prisma.emailRecipientLog.updateMany({
        where: { emailLogId, email: { in: result.failedEmails } },
        data: { status: 'failed', failureReason: 'SendGrid error', failedAt: new Date() },
      });
    }
    const successEmails = recipients.map((r) => r.email).filter((e) => !result.failedEmails?.includes(e));
    if (successEmails.length > 0) {
      await prisma.emailRecipientLog.updateMany({
        where: { emailLogId, email: { in: successEmails } },
        data: { status: 'delivered', deliveredAt: new Date() },
      });
    }

    console.log(`[EmailScheduler] ✓ Sent ${result.sent}/${recipients.length} for log ${emailLogId}`);

    // Refund credits for failed deliveries (non-blocking)
    // Credits were pre-deducted for all recipients; restore those that failed.
    if (result.failed > 0) {
      emailCreditService.refundCredits(event.id, result.failed, emailLogId).catch((err) =>
        console.error('[EmailScheduler][Credits] Failed to refund:', err.message)
      );
    }
  } catch (err) {
    console.error(`[EmailScheduler] ✗ Failed for log ${emailLogId}:`, err.message);
    try {
      await prisma.eventEmailLog.update({
        where: { id: emailLogId },
        data: { status: 'failed', errors: [err.message] },
      });
    } catch (_) {}
  }
}

// ── Recipient helpers (mirrors bulkEmail.controller.js logic) ─────────────────

async function resolveRecipientsById(registrationIds) {
  const regs = await prisma.eventRegistration.findMany({
    where: { id: { in: registrationIds } },
    select: {
      user_login: {
        select: {
          email: true,
          studentLogin: { select: { firstName: true, lastName: true, displayName: true } },
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
    },
  });
  return buildRecipients(regs);
}

async function resolveRecipientsByFilter(where) {
  const regs = await prisma.eventRegistration.findMany({
    where,
    select: {
      user_login: {
        select: {
          email: true,
          studentLogin: { select: { firstName: true, lastName: true, displayName: true } },
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
    },
  });
  return buildRecipients(regs);
}

async function buildRecipients(registrations) {
  const unresolvedEmails = [];
  const prelim = registrations
    .map((r) => {
      const u = r.user_login;
      if (!u || !u.email) return null;
      let name = '';
      if (u.studentLogin) name = u.studentLogin.displayName || `${u.studentLogin.firstName || ''} ${u.studentLogin.lastName || ''}`.trim();
      else if (u.employeeDetails) name = u.employeeDetails.displayName || `${u.employeeDetails.firstName || ''} ${u.employeeDetails.lastName || ''}`.trim();
      if (!name) unresolvedEmails.push(u.email);
      return { email: u.email, name };
    })
    .filter(Boolean);

  let fallbackNames = {};
  if (unresolvedEmails.length > 0) {
    const [sdRows, edRows] = await Promise.all([
      prisma.studentDetails.findMany({ where: { email: { in: unresolvedEmails } }, select: { email: true, firstName: true, lastName: true, displayName: true } }),
      prisma.employeeDetails.findMany({ where: { email: { in: unresolvedEmails } }, select: { email: true, firstName: true, lastName: true, displayName: true } }),
    ]);
    for (const row of [...sdRows, ...edRows]) {
      if (row.email && !fallbackNames[row.email])
        fallbackNames[row.email] = row.displayName || `${row.firstName || ''} ${row.lastName || ''}`.trim();
    }
  }

  return prelim.map((r) => {
    if (r.name) return r;
    const fb = fallbackNames[r.email];
    if (fb) return { ...r, name: fb };
    const localPart = r.email.split('@')[0].replace(/[._\-+]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return { ...r, name: localPart };
  });
}

// ── Polling loop ──────────────────────────────────────────────────────────────

async function runPoll() {
  if (_running) return;
  _running = true;
  try {
    const now = new Date();
    const due = await prisma.eventEmailLog.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
    });
    if (due.length > 0) {
      console.log(`[EmailScheduler] ${due.length} scheduled email(s) due`);
      for (const log of due) {
        await executeScheduledEmail(log);
      }
    }
  } catch (err) {
    console.error('[EmailScheduler] Poll error:', err.message);
  } finally {
    _running = false;
  }
}

/**
 * Start the scheduler. Call once on server startup.
 */
function start() {
  if (_timer) return;
  console.log(`[EmailScheduler] Started — polling every ${POLL_INTERVAL_MS / 1000}s`);
  // Run immediately on start to catch any emails that were due while server was offline
  runPoll();
  _timer = setInterval(runPoll, POLL_INTERVAL_MS);
}

/**
 * Stop the scheduler (for graceful shutdown).
 */
function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log('[EmailScheduler] Stopped');
  }
}

module.exports = { start, stop, executeScheduledEmail };
