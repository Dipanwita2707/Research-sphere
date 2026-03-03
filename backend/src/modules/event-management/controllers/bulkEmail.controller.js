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
  let fallbackNames = {};
  if (unresolvedEmails.length > 0) {
    const [sdRows, edRows] = await Promise.all([
      prisma.studentDetails.findMany({
        where: { email: { in: unresolvedEmails } },
        select: { email: true, firstName: true, lastName: true, displayName: true },
      }),
      prisma.employeeDetails.findMany({
        where: { email: { in: unresolvedEmails } },
        select: { email: true, firstName: true, lastName: true, displayName: true },
      }),
    ]);
    for (const row of [...sdRows, ...edRows]) {
      if (row.email && !fallbackNames[row.email]) {
        fallbackNames[row.email] =
          row.displayName || `${row.firstName || ''} ${row.lastName || ''}`.trim();
      }
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

  if (recipients.length === 0) {
    return res.status(404).json({ success: false, message: 'No recipients found matching the selected filter.' });
  }

  // ── Credit check ────────────────────────────────────────────
  const creditCheck = await emailCreditService.checkAvailable(event.id, recipients.length);
  if (!creditCheck.ok) {
    return res.status(402).json({
      success: false,
      message: `Insufficient email credits. You need ${recipients.length} credit(s) but only ${creditCheck.available} available. Credits reset automatically as new registrations occur (1 reg = 3 credits).`,
      credits: { ...creditCheck, required: recipients.length },
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
      status: 'sent',
      replyTo: replyTo || null,
      recipientEmails: recipients,
      errors: [],
    },
  });

  // ── Create per-recipient logs & build tracking map ──────────
  // Use createMany for batch insert instead of N individual creates
  await prisma.emailRecipientLog.createMany({
    data: recipients.map((r) => ({
      emailLogId: emailLog.id,
      email: r.email,
      name: r.name || '',
      status: 'sent',
    })),
  });

  // Fetch all created recipient logs to build tracking map
  const recipientLogs = await prisma.emailRecipientLog.findMany({
    where: { emailLogId: emailLog.id },
    select: { id: true, email: true },
  });

  // Map email→recipientLogId for tracking pixel injection
  const recipientTrackingIds = {};
  for (const rl of recipientLogs) {
    recipientTrackingIds[rl.email] = rl.id;
  }

  // Build tracking base URL.
  // Priority: BACKEND_PUBLIC_URL env var (required for local dev / ngrok)
  //           → x-forwarded headers (production reverse proxy)
  //           → raw request host (last resort, won't work outside localhost)
  let trackingBaseUrl;
  if (process.env.BACKEND_PUBLIC_URL) {
    // Strip any trailing slash then append the API prefix
    trackingBaseUrl = `${process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '')}/api/v1/events`;
  } else {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    trackingBaseUrl = `${protocol}://${host}/api/v1/events`;
  }
  console.log(`[EmailTrack] pixel base URL: ${trackingBaseUrl}`);

  // ── Deduct credits upfront (before sending) ─────────────────
  // Credits for ALL recipients are reserved now. Any that fail to
  // deliver will be automatically refunded after the batch completes.
  await emailCreditService.deductCredits(event.id, recipients.length, emailLog.id);

  // ── Send ────────────────────────────────────────────────────
  const result = await bulkEmailService.sendBulk({
    eventName: event.name,
    subject,
    body,
    recipients,
    replyTo,
    trackingBaseUrl,
    recipientTrackingIds,
  });

  // ── Update email log with results ───────────────────────────
  try {
    await prisma.eventEmailLog.update({
      where: { id: emailLog.id },
      data: {
        sentCount: result.sent,
        failedCount: result.failed,
        status: result.failed === 0 ? 'sent' : result.sent === 0 ? 'failed' : 'partial',
        errors: result.errors || [],
      },
    });

    // ── Refund credits for failed deliveries ────────────────────
    // Credits were pre-deducted for all recipients; refund those that
    // failed so the organiser is only charged for successful sends.
    if (result.failed > 0) {
      emailCreditService.refundCredits(event.id, result.failed, emailLog.id).catch((err) =>
        console.error('[EmailCredit] Failed to refund credits for failures:', err.message)
      );
    }

    // Mark failed recipients
    if (result.failedEmails && result.failedEmails.length > 0) {
      await prisma.emailRecipientLog.updateMany({
        where: {
          emailLogId: emailLog.id,
          email: { in: result.failedEmails },
        },
        data: {
          status: 'failed',
          failureReason: 'SendGrid API error – batch failed',
          failedAt: new Date(),
        },
      });
    }

    // Mark successful recipients as delivered
    const successEmails = recipients
      .map((r) => r.email)
      .filter((e) => !result.failedEmails?.includes(e));
    if (successEmails.length > 0) {
      await prisma.emailRecipientLog.updateMany({
        where: {
          emailLogId: emailLog.id,
          email: { in: successEmails },
        },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
        },
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

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true },
  });

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  const [all, confirmed, pending, cancelled] = await Promise.all([
    prisma.eventRegistration.count({ where: { eventId: event.id } }),
    prisma.eventRegistration.count({ where: { eventId: event.id, status: 'confirmed' } }),
    prisma.eventRegistration.count({ where: { eventId: event.id, status: 'pending' } }),
    prisma.eventRegistration.count({ where: { eventId: event.id, status: 'cancelled' } }),
  ]);

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
      include: {
        sentBy: {
          select: {
            uid: true,
            email: true,
            studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
            employeeDetails: { select: { displayName: true, firstName: true, lastName: true } },
          },
        },
        recipients: {
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
        },
      },
    }),
  ]);

  // Format sentBy name & aggregate stats
  const formatted = logs.map((log) => {
    const u = log.sentBy;
    let sentByName = u?.uid || 'Unknown';
    if (u?.studentLogin) {
      sentByName = u.studentLogin.displayName || `${u.studentLogin.firstName || ''} ${u.studentLogin.lastName || ''}`.trim();
    } else if (u?.employeeDetails) {
      sentByName = u.employeeDetails.displayName || `${u.employeeDetails.firstName || ''} ${u.employeeDetails.lastName || ''}`.trim();
    }

    // Aggregate recipient stats
    const recipients = log.recipients || [];
    const deliveredCount = recipients.filter((r) => r.status === 'delivered').length;
    const failedRecipients = recipients.filter((r) => r.status === 'failed');
    const bouncedCount = recipients.filter((r) => r.status === 'bounced').length;
    const openedCount = recipients.filter((r) => r.openCount > 0).length;
    const notOpenedCount = recipients.filter((r) => r.openCount === 0 && r.status === 'delivered').length;

    return {
      id: log.id,
      subject: log.subject,
      body: log.body,
      filter: log.filter,
      recipientCount: log.recipientCount,
      sentCount: log.sentCount,
      failedCount: log.failedCount,
      status: log.status,
      replyTo: log.replyTo,
      errors: log.errors,
      sentAt: log.sentAt,
      sentByName,
      sentByEmail: u?.email || null,
      // New aggregated stats
      deliveredCount,
      bouncedCount,
      openedCount,
      notOpenedCount,
      // Per-recipient details
      recipientDetails: recipients.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        status: r.status,
        failureReason: r.failureReason,
        openCount: r.openCount,
        firstOpenedAt: r.firstOpenedAt,
        lastOpenedAt: r.lastOpenedAt,
        deliveredAt: r.deliveredAt,
        failedAt: r.failedAt,
      })),
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

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true },
  });
  if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

  const credits = await emailCreditService.getCredits(event.id);
  return ApiResponse.success(res, {
    ...credits,
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

module.exports = { sendBulkEmail, getRecipientsCount, getEmailHistory, getEmailAnalytics, getEmailCredits, trackEmailOpen, cancelScheduledEmail };
