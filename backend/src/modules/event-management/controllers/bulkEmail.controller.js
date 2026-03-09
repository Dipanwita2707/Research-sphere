/**
 * Bulk Email Controller
 *
 * HTTP handlers for composing & sending bulk emails to event registrants.
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const prisma = require('../../../shared/config/database');
const bulkEmailService = require('../services/bulkEmail.service');
const emailCreditService = require('../services/emailCredit.service');
const emailQueue = require('../../../jobs/emailQueue');

/**
 * POST /api/v1/events/:id/emails/send
 *
 * Body:
 *   subject   – string  (required)
 *   body      – string  (HTML content, required)
 *   filter    – 'all' | 'confirmed' | 'pending' | 'cancelled' (default 'all')
 *   replyTo   – string  (optional email)
 *   testEmail – string  (if present, send only to this address as a test)
 */
const sendBulkEmail = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const { subject, body, filter = 'all', replyTo, testEmail, registrationIds, scheduledAt } = req.body;

  // ── Validation ──────────────────────────────────────────────
  if (!subject || !subject.trim()) {
    return res.status(400).json({ success: false, message: 'Email subject is required.' });
  }
  if (!body || !body.trim()) {
    return res.status(400).json({ success: false, message: 'Email body is required.' });
  }

  // ── Check SendGrid availability ─────────────────────────────
  if (!bulkEmailService.isAvailable()) {
    return res.status(503).json({ success: false, message: 'Email service is not configured. Please set SENDGRID_API_KEY.' });
  }

  // ── Resolve the event ───────────────────────────────────────
  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true, eventId: true, name: true },
  });

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  // ── If test-email mode ──────────────────────────────────────
  if (testEmail) {
    const result = await bulkEmailService.sendTestEmail({
      eventName: event.name,
      subject,
      body,
      toEmail: testEmail,
      replyTo,
    });
    return ApiResponse.success(res, result, result.success ? 'Test email sent.' : 'Test email failed.');
  }

  // ── Build recipient list from registrations ──────────────────
  // If caller supplies specific registration IDs, use those directly.
  // Otherwise fall back to status-filter across the whole event.
  const where = { eventId: event.id };
  if (Array.isArray(registrationIds) && registrationIds.length > 0) {
    where.id = { in: registrationIds };
  } else if (filter && filter !== 'all') {
    where.status = filter;          // confirmed | pending | cancelled
  }

  const registrations = await prisma.eventRegistration.findMany({
    where,
    select: {
      user_login: {
        select: {
          email: true,
          uid: true,
          studentLogin: { select: { firstName: true, lastName: true, displayName: true } },
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
    },
  });

  // Collect all emails that still have no resolved name so we can do a
  // bulk fallback lookup in StudentDetails/EmployeeDetails by email.
  const unresolvedEmails = [];
  const prelimRecipients = registrations
    .map((r) => {
      const u = r.user_login;
      if (!u || !u.email) return null;
      let name = '';
      if (u.studentLogin) {
        name = u.studentLogin.displayName
          || `${u.studentLogin.firstName || ''} ${u.studentLogin.lastName || ''}`.trim();
      } else if (u.employeeDetails) {
        name = u.employeeDetails.displayName
          || `${u.employeeDetails.firstName || ''} ${u.employeeDetails.lastName || ''}`.trim();
      }
      if (!name) unresolvedEmails.push(u.email);
      return { email: u.email, name };
    })
    .filter(Boolean);

  // Fallback: look up names via StudentDetails.email (covers users whose
  // userLoginId is not set in StudentDetails) and EmployeeDetails (same).
  // Run in parallel with credit check since name resolution doesn't change count.
  const recipientCount = prelimRecipients.length;
  if (recipientCount === 0) {
    return res.status(404).json({ success: false, message: 'No recipients found matching the selected filter.' });
  }

  const namePromise = unresolvedEmails.length > 0
    ? Promise.all([
        prisma.studentDetails.findMany({
          where: { email: { in: unresolvedEmails } },
          select: { email: true, firstName: true, lastName: true, displayName: true },
        }),
        prisma.employeeDetails.findMany({
          where: { email: { in: unresolvedEmails } },
          select: { email: true, firstName: true, lastName: true, displayName: true },
        }),
      ])
    : Promise.resolve([[], []]);

  const [creditCheck, [sdRows, edRows]] = await Promise.all([
    emailCreditService.checkAvailable(event.id, recipientCount),
    namePromise,
  ]);

  const fallbackNames = {};
  for (const row of [...sdRows, ...edRows]) {
    if (row.email && !fallbackNames[row.email]) {
      fallbackNames[row.email] =
        row.displayName || `${row.firstName || ''} ${row.lastName || ''}`.trim();
    }
  }

  // Map to { email, name } — apply fallbacks where needed
  const recipients = prelimRecipients
    .map((r) => {
      if (r.name) return r;
      const fallback = fallbackNames[r.email];
      if (fallback) return { ...r, name: fallback };
      // Last resort: capitalise the local part of the email (e.g. john.doe@… → John Doe)
      const localPart = r.email.split('@')[0]
        .replace(/[._\-+]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return { ...r, name: localPart };
    })
    .filter(Boolean);

  // ── Credit check ────────────────────────────────────────────
  if (!creditCheck.ok) {
    return res.status(402).json({
      success: false,
      message: `Insufficient email credits. You need ${recipientCount} credit(s) but only ${creditCheck.available} available. Credits reset automatically as new registrations occur (1 reg = 3 credits).`,
      credits: { ...creditCheck, required: recipientCount },
    });
  }

  // ── Scheduled send: persist and return early ────────────────
  if (scheduledAt) {
    const schedDate = new Date(scheduledAt);
    if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'scheduledAt must be a valid future date.' });
    }
    const scheduledLog = await prisma.eventEmailLog.create({
      data: {
        eventId: event.id,
        sentById: req.user.id,
        subject,
        body,
        filter,
        registrationIds: Array.isArray(registrationIds) ? registrationIds : [],
        recipientCount: recipients.length,
        sentCount: 0,
        failedCount: 0,
        status: 'scheduled',
        replyTo: replyTo || null,
        recipientEmails: recipients,
        errors: [],
        scheduledAt: schedDate,
        sentAt: schedDate,
      },
    });
    return ApiResponse.success(res, {
      scheduled: true,
      scheduledAt: schedDate,
      recipientCount: recipients.length,
      logId: scheduledLog.id,
    }, `Email scheduled for ${schedDate.toLocaleString('en-IN')}.`);
  }

  // ── Create email log first ──────────────────────────────────
  const emailLog = await prisma.eventEmailLog.create({
    data: {
      eventId: event.id,
      sentById: req.user.id,
      subject,
      body,
      filter,
      registrationIds: Array.isArray(registrationIds) ? registrationIds : [],
      recipientCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
      status: 'queued',
      replyTo: replyTo || null,
      recipientEmails: recipients,
      errors: [],
    },
  });

  // ── Try background queue (fast path) ────────────────────────
  // Skip recipientLog creation here — the worker handles it.
  if (emailQueue.isAvailable()) {
    const job = await emailQueue.enqueue({
      emailLogId: emailLog.id,
      eventId: event.id,
      eventName: event.name,
      subject,
      body,
      recipients,
      replyTo: replyTo || undefined,
    });

    if (job) {
      // Queued successfully → return 202 immediately
      return res.status(202).json({
        success: true,
        message: `Email queued for ${recipients.length} recipient(s). Sending in background.`,
        data: {
          queued: true,
          logId: emailLog.id,
          recipientCount: recipients.length,
          jobId: job.id,
        },
      });
    }
    // enqueue failed — fall through to sync
  }

  // ── Sync fallback (Redis unavailable or enqueue failed) ─────
  console.log(`[BulkEmail] Sync fallback for emailLog ${emailLog.id}`);

  // Create per-recipient logs & build tracking map (sync path only)
  await prisma.emailRecipientLog.createMany({
    data: recipients.map((r) => ({
      emailLogId: emailLog.id,
      email: r.email,
      name: r.name || '',
      status: 'queued',
    })),
  });

  const recipientLogs = await prisma.emailRecipientLog.findMany({
    where: { emailLogId: emailLog.id },
    select: { id: true, email: true },
  });

  const recipientTrackingIds = {};
  for (const rl of recipientLogs) {
    recipientTrackingIds[rl.email] = rl.id;
  }

  // Update status to 'sending'
  await prisma.eventEmailLog.update({
    where: { id: emailLog.id },
    data: { status: 'sending' },
  });

  let trackingBaseUrl;
  if (process.env.BACKEND_PUBLIC_URL) {
    trackingBaseUrl = `${process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '')}/api/v1/events`;
  } else {
    console.warn('[EmailTrack] BACKEND_PUBLIC_URL is not set. Tracking pixels will use a localhost fallback.');
    trackingBaseUrl = `https://localhost:${process.env.PORT || 5000}/api/v1/events`;
  }

  await emailCreditService.deductCredits(event.id, recipients.length, emailLog.id);

  const result = await bulkEmailService.sendBulk({
    eventName: event.name,
    subject,
    body,
    recipients,
    replyTo,
    trackingBaseUrl,
    recipientTrackingIds,
  });

  try {
    await prisma.eventEmailLog.update({
      where: { id: emailLog.id },
      data: {
        sentCount: result.sent,
        failedCount: result.failed,
        status: result.failed === 0 ? 'sent' : result.sent === 0 ? 'failed' : 'partial',
        errors: result.errors || [],
        sentAt: new Date(),
      },
    });

    if (result.failed > 0) {
      emailCreditService.refundCredits(event.id, result.failed, emailLog.id).catch((err) =>
        console.error('[EmailCredit] Failed to refund credits for failures:', err.message)
      );
    }

    if (result.failedEmails && result.failedEmails.length > 0) {
      await prisma.emailRecipientLog.updateMany({
        where: { emailLogId: emailLog.id, email: { in: result.failedEmails } },
        data: { status: 'failed', failureReason: 'SendGrid API error – batch failed', failedAt: new Date() },
      });
    }

    const successEmails = recipients.map((r) => r.email).filter((e) => !result.failedEmails?.includes(e));
    if (successEmails.length > 0) {
      await prisma.emailRecipientLog.updateMany({
        where: { emailLogId: emailLog.id, email: { in: successEmails } },
        data: { status: 'delivered', deliveredAt: new Date() },
      });
    }
  } catch (logErr) {
    console.error('[BulkEmail] Failed to update email log:', logErr.message);
  }

  const msg = result.success
    ? `Email sent successfully to ${result.sent} recipient(s).`
    : `Sent ${result.sent}, failed ${result.failed}. Errors: ${result.errors.join(' | ')}`;

  return ApiResponse.success(res, result, msg);
});

/**
 * GET /api/v1/events/:id/emails/recipients-count
 *
 * Returns the count of recipients per filter category so the UI can show
 * "Confirmed (45) · Pending (12) · etc."
 */
const getRecipientsCount = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  // Single query: resolve eventId → UUID and count per-status in one round trip.
  // COUNT(er.id) returns 0 (not null) via LEFT JOIN when no registrations exist.
  // If the event row doesn't exist the WHERE clause yields no rows → 404.
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(er.id)::int                                                        AS "all",
      COALESCE(SUM(CASE WHEN er.status = 'confirmed'  THEN 1 END), 0)::int    AS confirmed,
      COALESCE(SUM(CASE WHEN er.status = 'pending'    THEN 1 END), 0)::int    AS pending,
      COALESCE(SUM(CASE WHEN er.status = 'cancelled'  THEN 1 END), 0)::int    AS cancelled
    FROM "Event" e
    LEFT JOIN "EventRegistration" er ON er."eventId" = e.id
    WHERE e."eventId" = ${eventId}
  `;

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  const { all, confirmed, pending, cancelled } = rows[0];
  return ApiResponse.success(res, { all, confirmed, pending, cancelled });
});

/**
 * GET /api/v1/events/:id/emails/history
 *
 * Returns the list of all bulk emails sent for this event,
 * with per-recipient delivery & open stats aggregated.
 */
const getEmailHistory = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true },
  });

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  const [total, logs] = await Promise.all([
    prisma.eventEmailLog.count({ where: { eventId: event.id } }),
    prisma.eventEmailLog.findMany({
      where: { eventId: event.id },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      // ── `body` deliberately excluded — it's large HTML not needed for the list.
      //    Fetch it separately via GET /emails/:logId when the user wants to preview or resend.
      // ── `recipients` deliberately excluded — see batch GROUP BY aggregation below.
      //    Previously `include: { recipients: [...] }` loaded every recipient row (potentially
      //    thousands per campaign) into memory just to .filter() count them in JS.
      select: {
        id: true,
        subject: true,
        filter: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        status: true,
        replyTo: true,
        errors: true,
        sentAt: true,
        scheduledAt: true,
        sentBy: {
          select: {
            uid: true,
            email: true,
            studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
            employeeDetails: { select: { displayName: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  // ── Batch aggregate per-campaign recipient stats ───────────────────────────
  // A single GROUP BY over the fetched log IDs replaces the old approach of
  // loading every recipient row and counting in JS (O(N*M) → O(pages)).
  const logIds = logs.map((l) => l.id);
  const recipientStats = {};
  if (logIds.length > 0) {
    const rows = await prisma.$queryRaw`
      SELECT
        "emailLogId",
        COUNT(*) FILTER (WHERE status = 'delivered')                        AS "deliveredCount",
        COUNT(*) FILTER (WHERE "openCount" > 0)                             AS "openedCount",
        COUNT(*) FILTER (WHERE status = 'bounced')                          AS "bouncedCount",
        COUNT(*) FILTER (WHERE status = 'delivered' AND "openCount" = 0)    AS "notOpenedCount"
      FROM "EmailRecipientLog"
      WHERE "emailLogId" = ANY(${logIds}::uuid[])
      GROUP BY "emailLogId"
    `;
    for (const row of rows) {
      recipientStats[row.emailLogId] = {
        deliveredCount: Number(row.deliveredCount),
        openedCount: Number(row.openedCount),
        bouncedCount: Number(row.bouncedCount),
        notOpenedCount: Number(row.notOpenedCount),
      };
    }
  }

  // Format sentBy name & merge aggregated stats
  const formatted = logs.map((log) => {
    const u = log.sentBy;
    let sentByName = u?.uid || 'Unknown';
    if (u?.studentLogin) {
      sentByName = u.studentLogin.displayName || `${u.studentLogin.firstName || ''} ${u.studentLogin.lastName || ''}`.trim();
    } else if (u?.employeeDetails) {
      sentByName = u.employeeDetails.displayName || `${u.employeeDetails.firstName || ''} ${u.employeeDetails.lastName || ''}`.trim();
    }

    const stats = recipientStats[log.id] || { deliveredCount: 0, openedCount: 0, bouncedCount: 0, notOpenedCount: 0 };

    return {
      id: log.id,
      subject: log.subject,
      body: null, // Not loaded in list — fetch GET /emails/:logId for full body
      filter: log.filter,
      recipientCount: log.recipientCount,
      sentCount: log.sentCount,
      failedCount: log.failedCount,
      status: log.status,
      replyTo: log.replyTo,
      errors: log.errors,
      sentAt: log.sentAt,
      scheduledAt: log.scheduledAt,
      sentByName,
      sentByEmail: u?.email || null,
      // Aggregated stats (from batch GROUP BY — no per-row data loaded)
      deliveredCount: stats.deliveredCount,
      bouncedCount: stats.bouncedCount,
      openedCount: stats.openedCount,
      notOpenedCount: stats.notOpenedCount,
      // Per-recipient details are not loaded in the list for performance.
      // Load them via GET /events/:id/emails/:logId/recipients when needed.
      recipientDetails: [],
    };
  });

  return ApiResponse.success(res, {
    logs: formatted,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/**
 * GET /api/v1/events/emails/track/:recipientLogId/open.png
 *
 * Tracking pixel endpoint — returns a 1x1 transparent PNG and records the open.
 * No authentication required (called from email client).
 */
const trackEmailOpen = async (req, res) => {
  const { recipientLogId } = req.params;

  // 1x1 transparent PNG
  const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );

  // Always return the pixel first (non-blocking tracking)
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': PIXEL.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.end(PIXEL);

  // Record the open in the background
  try {
    const recipientLog = await prisma.emailRecipientLog.findUnique({
      where: { id: recipientLogId },
    });

    if (recipientLog) {
      const now = new Date();
      await prisma.emailRecipientLog.update({
        where: { id: recipientLogId },
        data: {
          openCount: { increment: 1 },
          lastOpenedAt: now,
          ...(recipientLog.firstOpenedAt ? {} : { firstOpenedAt: now }),
        },
      });
    }
  } catch (err) {
    // Silently fail – tracking should not break email viewing
    console.error('[EmailTrack] Failed to record open:', err.message);
  }
};

/**
 * GET /api/v1/events/:id/emails/credits
 * Returns the current email credit balance for the event.
 */
const getEmailCredits = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  // Single round trip: fetch event + credit record + registration count together.
  // Prisma batches the relation + _count in one database call.
  const event = await prisma.event.findUnique({
    where: { eventId },
    select: {
      id: true,
      EventEmailCredit: { select: { usedCredits: true, totalCredits: true } },
      _count: { select: { EventRegistration: true } },
    },
  });
  if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

  const total     = event._count.EventRegistration * emailCreditService.CREDITS_PER_REGISTRATION;
  const used      = event.EventEmailCredit?.usedCredits ?? 0;
  const available = Math.max(0, total - used);

  // Keep persisted totalCredits column in sync (background, non-blocking).
  if ((event.EventEmailCredit?.totalCredits ?? -1) !== total) {
    prisma.eventEmailCredit.upsert({
      where:  { eventId: event.id },
      create: { eventId: event.id, totalCredits: total, usedCredits: 0 },
      update: { totalCredits: total },
    }).catch(() => {});
  }

  return ApiResponse.success(res, {
    total,
    used,
    available,
    creditsPerRegistration: emailCreditService.CREDITS_PER_REGISTRATION,
  });
});

/**
 * GET /api/v1/events/:id/emails/analytics
 * Returns aggregated email campaign stats for the event.
 */
const getEmailAnalytics = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true },
  });

  if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

  const [agg, openedCount, deliveredCount, scheduledCount, recentLogs] = await Promise.all([
    prisma.eventEmailLog.aggregate({
      where: { eventId: event.id, status: { not: 'cancelled' } },
      _count: { id: true },
      _sum: { recipientCount: true, sentCount: true, failedCount: true },
    }),
    prisma.emailRecipientLog.count({
      where: { emailLog: { eventId: event.id }, openCount: { gt: 0 } },
    }),
    prisma.emailRecipientLog.count({
      where: { emailLog: { eventId: event.id }, status: 'delivered' },
    }),
    prisma.eventEmailLog.count({
      where: { eventId: event.id, status: 'scheduled' },
    }),
    prisma.eventEmailLog.findMany({
      where: { eventId: event.id, status: { in: ['sent', 'partial', 'failed'] } },
      orderBy: { sentAt: 'desc' },
      take: 5,
      select: {
        id: true,
        subject: true,
        sentAt: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        status: true,
      },
    }),
  ]);

  const totalSent = agg._sum.sentCount || 0;

  return ApiResponse.success(res, {
    totalCampaigns: agg._count.id || 0,
    scheduledPending: scheduledCount,
    totalRecipients: agg._sum.recipientCount || 0,
    totalSent,
    totalFailed: agg._sum.failedCount || 0,
    totalOpened: openedCount,
    totalDelivered: deliveredCount,
    deliveryRate: totalSent > 0 ? Math.round((deliveredCount / totalSent) * 100) : 0,
    openRate: deliveredCount > 0 ? Math.round((openedCount / deliveredCount) * 100) : 0,
    recentCampaigns: recentLogs,
  });
});

/**
 * DELETE /api/v1/events/:id/emails/scheduled/:logId
 * Cancel a pending scheduled email.
 */
const cancelScheduledEmail = asyncHandler(async (req, res) => {
  const { id: eventId, logId } = req.params;

  const event = await prisma.event.findUnique({ where: { eventId }, select: { id: true } });
  if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

  const log = await prisma.eventEmailLog.findFirst({
    where: { id: logId, eventId: event.id, status: 'scheduled' },
  });
  if (!log) return res.status(404).json({ success: false, message: 'Scheduled email not found or already sent.' });

  await prisma.eventEmailLog.update({
    where: { id: logId },
    data: { status: 'cancelled' },
  });

  return ApiResponse.success(res, { cancelled: true }, 'Scheduled email cancelled.');
});

/**
 * GET /api/v1/events/:id/emails/:logId
 *
 * Returns the full body + metadata for a single email log entry.
 * Not included in the history list to avoid loading large HTML for every row.
 */
const getEmailLogDetail = asyncHandler(async (req, res) => {
  const { id: eventId, logId } = req.params;

  const event = await prisma.event.findUnique({ where: { eventId }, select: { id: true } });
  if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

  const log = await prisma.eventEmailLog.findFirst({
    where: { id: logId, eventId: event.id },
    select: {
      id: true,
      subject: true,
      body: true,
      filter: true,
      recipientCount: true,
      sentCount: true,
      failedCount: true,
      status: true,
      replyTo: true,
      errors: true,
      sentAt: true,
      scheduledAt: true,
      registrationIds: true,
    },
  });
  if (!log) return res.status(404).json({ success: false, message: 'Email log not found.' });

  return ApiResponse.success(res, log);
});

/**
 * GET /api/v1/events/:id/emails/:logId/recipients
 *
 * Returns paginated per-recipient delivery & open details for one campaign.
 * Separated from the history list to avoid loading thousands of rows upfront.
 */
const getEmailLogRecipients = asyncHandler(async (req, res) => {
  const { id: eventId, logId } = req.params;
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 50;

  const event = await prisma.event.findUnique({ where: { eventId }, select: { id: true } });
  if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

  // Verify the log belongs to this event
  const logExists = await prisma.eventEmailLog.count({ where: { id: logId, eventId: event.id } });
  if (!logExists) return res.status(404).json({ success: false, message: 'Email log not found.' });

  const [total, recipients] = await Promise.all([
    prisma.emailRecipientLog.count({ where: { emailLogId: logId } }),
    prisma.emailRecipientLog.findMany({
      where: { emailLogId: logId },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        failureReason: true,
        openCount: true,
        firstOpenedAt: true,
        lastOpenedAt: true,
        deliveredAt: true,
        failedAt: true,
      },
    }),
  ]);

  return ApiResponse.success(res, {
    recipients,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

module.exports = { sendBulkEmail, getRecipientsCount, getEmailHistory, getEmailAnalytics, getEmailCredits, trackEmailOpen, cancelScheduledEmail, getEmailLogDetail, getEmailLogRecipients };
