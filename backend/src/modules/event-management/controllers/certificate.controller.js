/**
 * Certificate Controller
 *
 * HTTP handlers for uploading certificate templates, generating PDFs,
 * and sending certificates to event registrants.
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const prisma = require('../../../shared/config/database');
const certificateService = require('../services/certificate.service');
const { uploadToS3, getSignedUrl, deleteFromS3 } = require('../../../shared/utils/s3');

// ── Upload Certificate Template ──────────────────────────────────
/**
 * POST /api/v1/events/:id/certificates/templates
 *
 * Multipart form upload. Fields:
 *   file             – image file (PNG/JPG, max 1 MB)
 *   name             – template name (optional)
 *   certificateType  – 'participation' | 'winner' (default: 'participation')
 *   title            – certificate title text (default: 'Certificate of Participation')
 *   content          – body text with placeholders (optional)
 *   textColor        – hex colour (default: '#1c4980')
 */
const uploadTemplate = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const { name, certificateType, title, content, textColor } = req.body;

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true },
  });

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  let templateS3Key = null;
  let templateUrl = null;

  if (req.file) {
    const uploadResult = await uploadToS3(
      req.file.buffer,
      'certificate-templates',
      req.user.id,
      req.file.originalname,
      req.file.mimetype
    );
    templateS3Key = uploadResult.key;
    templateUrl = uploadResult.location;
  }

  const template = await prisma.eventCertificateTemplate.create({
    data: {
      eventId: event.id,
      name: name || 'Certificate of Participation',
      certificateType: certificateType || 'participation',
      templateS3Key,
      templateUrl,
      title: title || 'Certificate of Participation',
      content: content || 'This is to certify that [Candidate Name] from [Candidate\'s Organisation Name] has participated in [Event Name] organized by the [Organizer].',
      textColor: textColor || '#1c4980',
      createdById: req.user.id,
    },
  });

  // Return presigned URL so the frontend can display the image
  const responseData = { ...template };
  if (template.templateS3Key) {
    responseData.templateUrl = await getSignedUrl(template.templateS3Key, 3600);
  }

  return ApiResponse.success(res, responseData, 'Certificate template uploaded successfully.', 201);
});

// ── List Templates ───────────────────────────────────────────────
/**
 * GET /api/v1/events/:id/certificates/templates
 */
const getTemplates = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true },
  });

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  const templates = await prisma.eventCertificateTemplate.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      certificateType: true,
      templateS3Key: true,
      templateUrl: true,
      title: true,
      content: true,
      textColor: true,
      isDefault: true,
      createdAt: true,
    },
  });

  // Generate presigned URLs for templates that have an S3 key
  const templatesWithUrls = await Promise.all(
    templates.map(async (t) => {
      if (t.templateS3Key) {
        return { ...t, templateUrl: await getSignedUrl(t.templateS3Key, 3600) };
      }
      return t;
    })
  );

  return ApiResponse.success(res, templatesWithUrls);
});

// ── Save / Update Template Config ────────────────────────────────
/**
 * PATCH /api/v1/events/:id/certificates/templates/:templateId
 *
 * Updates title, content, textColor on an existing template.
 */
const updateTemplate = asyncHandler(async (req, res) => {
  const { id: eventId, templateId } = req.params;
  const { title, content, textColor, name, certificateType } = req.body;

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true },
  });

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  const template = await prisma.eventCertificateTemplate.findFirst({
    where: { id: templateId, eventId: event.id },
  });

  if (!template) {
    return res.status(404).json({ success: false, message: 'Template not found.' });
  }

  const data = {};
  if (title !== undefined) data.title = title;
  if (content !== undefined) data.content = content;
  if (textColor !== undefined) data.textColor = textColor;
  if (name !== undefined) data.name = name;
  if (certificateType !== undefined) data.certificateType = certificateType;

  const updated = await prisma.eventCertificateTemplate.update({
    where: { id: templateId },
    data,
  });

  return ApiResponse.success(res, updated, 'Template updated.');
});

// ── Get Recipients Count ─────────────────────────────────────────
/**
 * GET /api/v1/events/:id/certificates/recipients-count
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

// ── Send Certificates ────────────────────────────────────────────
/**
 * POST /api/v1/events/:id/certificates/send
 *
 * Body:
 *   templateId      – string (required)
 *   textFields      – array of { text, x, y, fontSize, color, fontWeight, textAlign }
 *   filter          – 'all' | 'confirmed' | 'pending' | 'cancelled' (default: 'all')
 *   registrationIds – string[] (specific IDs, overrides filter)
 */
const sendCertificates = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const {
    templateId,
    textFields,
    imageFields,
    canvasWidth,
    filter = 'all',
    registrationIds,
  } = req.body;

  // ── Validate ────────────────────────────────────────────────
  if (!templateId) {
    return res.status(400).json({ success: false, message: 'templateId is required.' });
  }

  // ── Resolve event ───────────────────────────────────────────
  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true, eventId: true, name: true, createdById: true },
  });

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  // ── Resolve template ────────────────────────────────────────
  const template = await prisma.eventCertificateTemplate.findFirst({
    where: { id: templateId, eventId: event.id },
  });

  if (!template) {
    return res.status(404).json({ success: false, message: 'Certificate template not found.' });
  }

  // Derive title/content from textFields for logging
  const fields = Array.isArray(textFields) ? textFields : [];
  const titleField = fields.find((f) => f.fontSize >= 18 && f.fontWeight === 'bold');
  const title = titleField ? titleField.text : template.title;
  const content = fields.map((f) => f.text).join(' | ');
  const textColor = (fields[0] && fields[0].color) || template.textColor;

  // ── Build recipient list ────────────────────────────────────
  const where = { eventId: event.id };
  if (Array.isArray(registrationIds) && registrationIds.length > 0) {
    where.id = { in: registrationIds };
  } else if (filter && filter !== 'all') {
    where.status = filter;
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
      EventTeam: {
        select: { name: true },
      },
    },
  });

  // Resolve names (same pattern as bulkEmail controller)
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
      return {
        email: u.email,
        name,
        teamName: r.EventTeam?.name || '',
      };
    })
    .filter(Boolean);

  // Fallback name resolution
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

  const recipients = prelimRecipients
    .map((r) => {
      if (r.name) return r;
      const fallback = fallbackNames[r.email];
      if (fallback) return { ...r, name: fallback };
      const localPart = r.email.split('@')[0]
        .replace(/[._\-+]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return { ...r, name: localPart };
    })
    .filter(Boolean);

  if (recipients.length === 0) {
    return res.status(404).json({ success: false, message: 'No recipients found matching the selected filter.' });
  }

  // Deduplicate by email
  const seen = new Set();
  const uniqueRecipients = [];
  for (const r of recipients) {
    const key = (r.email || '').toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueRecipients.push({ ...r, email: key });
    }
  }

  // ── Handle duplicate detection & action ─────────────────────
  // duplicateAction: undefined (check only) | 'skip' | 'resend'
  const { duplicateAction } = req.body;

  // Find recipients who already have a sent certificate for this event
  const recipientEmails = uniqueRecipients.map((r) => r.email);
  const existingCerts = await prisma.certificateRecipientLog.findMany({
    where: {
      email: { in: recipientEmails },
      status: 'sent',
      certificateLog: { eventId: event.id },
    },
    select: { email: true, verificationCode: true },
    orderBy: { sentAt: 'desc' },
  });

  // Build a map of email -> earliest verification code (to preserve on resend)
  const existingVerificationMap = {};
  const alreadySentEmails = new Set();
  for (const ec of existingCerts) {
    const key = ec.email.toLowerCase();
    alreadySentEmails.add(key);
    if (!existingVerificationMap[key]) {
      existingVerificationMap[key] = ec.verificationCode;
    }
  }

  const duplicateCount = alreadySentEmails.size;

  // If there are duplicates and no action specified, return warning for frontend confirmation
  if (duplicateCount > 0 && !duplicateAction) {
    return ApiResponse.success(res, {
      requiresConfirmation: true,
      duplicateCount,
      totalRecipients: uniqueRecipients.length,
      newRecipients: uniqueRecipients.length - duplicateCount,
    }, `${duplicateCount} recipient(s) have already been sent a certificate.`);
  }

  // If action is 'skip', filter out already-sent recipients
  let finalRecipients = uniqueRecipients;
  if (duplicateAction === 'skip') {
    finalRecipients = uniqueRecipients.filter((r) => !alreadySentEmails.has(r.email));
    if (finalRecipients.length === 0) {
      return res.status(400).json({ success: false, message: 'All selected recipients have already received certificates. No new certificates to send.' });
    }
  }
  // If action is 'resend', send to all (finalRecipients stays as uniqueRecipients)

  // ── Create certificate log ──────────────────────────────────
  const certLog = await prisma.eventCertificateLog.create({
    data: {
      eventId: event.id,
      templateId: template.id,
      sentById: req.user.id,
      certificateType: template.certificateType,
      title,
      content,
      textColor,
      filter,
      registrationIds: Array.isArray(registrationIds) ? registrationIds : [],
      recipientCount: finalRecipients.length,
      sentCount: 0,
      failedCount: 0,
      status: 'processing',
      errors: [],
    },
  });

  // Create per-recipient logs, preserving existing verification codes on resend
  const recipientLogData = finalRecipients.map((r) => {
    const data = {
      certificateLogId: certLog.id,
      email: r.email,
      name: r.name || '',
      status: 'pending',
    };
    // Preserve the original verification code if resending
    if (duplicateAction === 'resend' && existingVerificationMap[r.email]) {
      data.verificationCode = existingVerificationMap[r.email];
    }
    return data;
  });

  // For recipients with preserved verification codes, we need individual creates
  // (since createMany cannot handle unique constraint conflicts by design)
  const recipientsWithExistingCodes = recipientLogData.filter((d) => d.verificationCode);
  const recipientsWithNewCodes = recipientLogData.filter((d) => !d.verificationCode);

  // For resend: update existing recipient logs to point to new cert log OR create with same verification code
  // Since verificationCode is unique, we update the existing rows to reference the new certLog
  for (const rd of recipientsWithExistingCodes) {
    await prisma.certificateRecipientLog.update({
      where: { verificationCode: rd.verificationCode },
      data: {
        certificateLogId: certLog.id,
        name: rd.name,
        status: 'pending',
        failureReason: null,
        certificateS3Key: null,
        sentAt: null,
        failedAt: null,
      },
    });
  }

  if (recipientsWithNewCodes.length > 0) {
    await prisma.certificateRecipientLog.createMany({
      data: recipientsWithNewCodes,
    });
  }

  // Fetch the recipient logs to get verification codes
  const recipientLogs = await prisma.certificateRecipientLog.findMany({
    where: { certificateLogId: certLog.id },
    select: { email: true, verificationCode: true },
  });
  const verificationMap = {};
  for (const rl of recipientLogs) {
    verificationMap[rl.email.toLowerCase()] = rl.verificationCode;
  }

  // ── Send certificates ───────────────────────────────────────
  const result = await certificateService.sendCertificates({
    eventName: event.name,
    eventId: event.id,
    textFields: fields,
    imageFields: Array.isArray(imageFields) ? imageFields : [],
    canvasWidth: canvasWidth || 600,
    templateS3Key: template.templateS3Key,
    recipients: finalRecipients,
    verificationMap,
  });

  // ── Update logs ─────────────────────────────────────────────
  try {
    await prisma.eventCertificateLog.update({
      where: { id: certLog.id },
      data: {
        sentCount: result.sent,
        failedCount: result.failed,
        status: result.failed === 0 ? 'sent' : result.sent === 0 ? 'failed' : 'partial',
        errors: result.errors || [],
      },
    });

    // Mark failed recipients
    if (result.failedEmails && result.failedEmails.length > 0) {
      await prisma.certificateRecipientLog.updateMany({
        where: {
          certificateLogId: certLog.id,
          email: { in: result.failedEmails },
        },
        data: {
          status: 'failed',
          failureReason: 'Certificate delivery failed',
          failedAt: new Date(),
        },
      });
    }

    // Mark successful recipients + save S3 keys
    const successEmails = finalRecipients
      .map((r) => r.email)
      .filter((e) => !result.failedEmails?.includes(e));
    if (successEmails.length > 0) {
      // Bulk update status
      await prisma.certificateRecipientLog.updateMany({
        where: {
          certificateLogId: certLog.id,
          email: { in: successEmails },
        },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });
      // Save per-recipient S3 keys
      if (result.s3Keys && Object.keys(result.s3Keys).length > 0) {
        const s3Updates = Object.entries(result.s3Keys).map(([email, key]) =>
          prisma.certificateRecipientLog.updateMany({
            where: { certificateLogId: certLog.id, email },
            data: { certificateS3Key: key },
          })
        );
        await Promise.all(s3Updates);
      }
    }
  } catch (logErr) {
    console.error('[Certificate] Failed to update certificate log:', logErr.message);
  }

  const msg = result.success
    ? `Certificates sent successfully to ${result.sent} recipient(s).`
    : `Sent ${result.sent}, failed ${result.failed}. Errors: ${result.errors.join(' | ')}`;

  return ApiResponse.success(res, {
    success: result.success,
    sent: result.sent,
    failed: result.failed,
    recipientCount: finalRecipients.length,
    skippedCount: duplicateAction === 'skip' ? duplicateCount : 0,
    logId: certLog.id,
  }, msg);
});

// ── Certificate History ──────────────────────────────────────────
/**
 * GET /api/v1/events/:id/certificates/history
 */
const getCertificateHistory = asyncHandler(async (req, res) => {
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
    prisma.eventCertificateLog.count({ where: { eventId: event.id } }),
    prisma.eventCertificateLog.findMany({
      where: { eventId: event.id },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        certificateType: true,
        title: true,
        filter: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        status: true,
        errors: true,
        sentAt: true,
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

  // Resolve sender names
  const enrichedLogs = logs.map((log) => {
    const u = log.sentBy;
    let sentByName = '';
    if (u?.studentLogin) {
      sentByName = u.studentLogin.displayName || `${u.studentLogin.firstName || ''} ${u.studentLogin.lastName || ''}`.trim();
    } else if (u?.employeeDetails) {
      sentByName = u.employeeDetails.displayName || `${u.employeeDetails.firstName || ''} ${u.employeeDetails.lastName || ''}`.trim();
    }
    return {
      id: log.id,
      certificateType: log.certificateType,
      title: log.title,
      filter: log.filter,
      recipientCount: log.recipientCount,
      sentCount: log.sentCount,
      failedCount: log.failedCount,
      status: log.status,
      errors: log.errors,
      sentAt: log.sentAt,
      sentByName: sentByName || u?.uid || 'Unknown',
      sentByEmail: u?.email || null,
    };
  });

  return ApiResponse.success(res, {
    logs: enrichedLogs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ── Send Test Certificate ────────────────────────────────────────
/**
 * POST /api/v1/events/:id/certificates/test-send
 *
 * Sends a single test certificate to any email address.
 * Body:
 *   templateId – string (required)
 *   textFields – array of { text, x, y, fontSize, color, fontWeight, textAlign }
 *   testEmail  – string (required)
 */
const sendTestCertificate = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const { templateId, textFields, imageFields, canvasWidth, testEmail } = req.body;

  console.log('[Certificate Test] Request body:', JSON.stringify({ templateId, testEmail, canvasWidth, textFieldsCount: textFields?.length, imageFieldsCount: imageFields?.length }));

  if (!templateId) {
    return res.status(400).json({ success: false, message: 'templateId is required.' });
  }
  if (!testEmail) {
    return res.status(400).json({ success: false, message: 'testEmail is required.' });
  }

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true, name: true },
  });

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  const template = await prisma.eventCertificateTemplate.findFirst({
    where: { id: templateId, eventId: event.id },
  });

  if (!template) {
    return res.status(404).json({ success: false, message: 'Certificate template not found.' });
  }

  const fields = Array.isArray(textFields) ? textFields : [];

  console.log('[Certificate Test] Template found:', { id: template.id, templateS3Key: template.templateS3Key });
  console.log('[Certificate Test] textFields:', JSON.stringify(fields));
  console.log('[Certificate Test] imageFields:', JSON.stringify(imageFields));

  try {
    const result = await certificateService.sendCertificates({
      eventName: event.name,
      eventId: event.id,
      textFields: fields,
      imageFields: Array.isArray(imageFields) ? imageFields : [],
      canvasWidth: canvasWidth || 600,
      templateS3Key: template.templateS3Key,
      recipients: [{ email: testEmail, name: 'John Doe', teamName: 'Sample Team' }],
    });

    console.log('[Certificate Test] Result:', JSON.stringify(result));

    if (result.success) {
      return ApiResponse.success(res, { sent: 1 }, `Test certificate sent to ${testEmail}.`);
    }

    return res.status(500).json({
      success: false,
      message: `Failed to send test certificate: ${result.errors.join(', ')}`,
    });
  } catch (err) {
    console.error('[Certificate Test] EXCEPTION:', err.message, err.stack);
    throw err;
  }
});

// ── Delete Template ──────────────────────────────────────────────
/**
 * DELETE /api/v1/events/:id/certificates/templates/:templateId
 */
const deleteTemplate = asyncHandler(async (req, res) => {
  const { id: eventId, templateId } = req.params;

  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { id: true },
  });

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  const template = await prisma.eventCertificateTemplate.findFirst({
    where: { id: templateId, eventId: event.id },
  });

  if (!template) {
    return res.status(404).json({ success: false, message: 'Template not found.' });
  }

  // Delete file from S3 if it exists
  if (template.templateS3Key) {
    try {
      await deleteFromS3(template.templateS3Key);
    } catch (err) {
      console.error('[Certificate] Failed to delete S3 object:', err.message);
    }
  }

  await prisma.eventCertificateTemplate.delete({
    where: { id: templateId },
  });

  return ApiResponse.success(res, null, 'Template deleted successfully.');
});

// ── Verify Certificate (public, no auth) ─────────────────────────
/**
 * GET /api/v1/events/certificates/verify/:code
 *
 * Public endpoint — anyone with the verification code can check authenticity.
 */
const verifyCertificate = asyncHandler(async (req, res) => {
  const { code } = req.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!code || !uuidRegex.test(code)) {
    return res.status(400).json({ success: false, message: 'Invalid verification code.' });
  }

  const recipient = await prisma.certificateRecipientLog.findUnique({
    where: { verificationCode: code },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      sentAt: true,
      verificationCode: true,
      certificateS3Key: true,
      certificateLog: {
        select: {
          title: true,
          certificateType: true,
          sentAt: true,
          event: {
            select: {
              name: true,
              eventId: true,
            },
          },
        },
      },
    },
  });

  if (!recipient || recipient.status !== 'sent') {
    return res.status(404).json({
      success: false,
      verified: false,
      message: 'Certificate not found or not yet issued.',
    });
  }

  return ApiResponse.success(res, {
    verified: true,
    certificateId: recipient.verificationCode,
    holderName: recipient.name,
    eventName: recipient.certificateLog.event.name,
    eventId: recipient.certificateLog.event.eventId,
    certificateTitle: recipient.certificateLog.title,
    certificateType: recipient.certificateLog.certificateType,
    issuingOrganization: 'SGT University',
    issueDate: recipient.sentAt || recipient.certificateLog.sentAt,
  });
});

// ── My Certificates (authenticated) ──────────────────────────────
/**
 * GET /api/v1/events/certificates/my
 *
 * Returns all certificates received by the authenticated user (by email).
 */
const getMyCertificates = asyncHandler(async (req, res) => {
  const userEmail = req.user.email;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  if (!userEmail) {
    return res.status(400).json({ success: false, message: 'User email not found.' });
  }

  const emailLower = userEmail.toLowerCase();

  // Get only the latest certificate per event:
  // 1. Fetch all sent certs for this user, ordered newest-first
  const allCerts = await prisma.certificateRecipientLog.findMany({
    where: { email: emailLower, status: 'sent' },
    orderBy: { sentAt: 'desc' },
    select: {
      id: true,
      name: true,
      verificationCode: true,
      certificateS3Key: true,
      sentAt: true,
      certificateLog: {
        select: {
          title: true,
          certificateType: true,
          eventId: true,
          event: {
            select: {
              name: true,
              eventId: true,
            },
          },
        },
      },
    },
  });

  // 2. Keep only the latest certificate per event
  const seenEvents = new Set();
  const latestPerEvent = [];
  for (const c of allCerts) {
    const evId = c.certificateLog.eventId;
    if (!seenEvents.has(evId)) {
      seenEvents.add(evId);
      latestPerEvent.push(c);
    }
  }

  const total = latestPerEvent.length;
  const skip = (page - 1) * limit;
  const paginated = latestPerEvent.slice(skip, skip + limit);

  const data = paginated.map((c) => ({
    id: c.id,
    certificateTitle: c.certificateLog.title,
    certificateType: c.certificateLog.certificateType,
    eventName: c.certificateLog.event.name,
    eventId: c.certificateLog.event.eventId,
    holderName: c.name,
    issueDate: c.sentAt,
    verificationCode: c.verificationCode,
    hasDownload: !!c.certificateS3Key,
  }));

  return ApiResponse.success(res, {
    certificates: data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ── Download Certificate (authenticated) ─────────────────────────
/**
 * GET /api/v1/events/certificates/download/:code
 *
 * Returns a presigned S3 URL for the certificate PDF.
 */
const downloadCertificate = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const userEmail = req.user.email;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!code || !uuidRegex.test(code)) {
    return res.status(400).json({ success: false, message: 'Invalid code.' });
  }

  const recipient = await prisma.certificateRecipientLog.findUnique({
    where: { verificationCode: code },
    select: {
      email: true,
      certificateS3Key: true,
      status: true,
    },
  });

  if (!recipient || recipient.status !== 'sent') {
    return res.status(404).json({ success: false, message: 'Certificate not found.' });
  }

  // Only the certificate owner can download
  if (recipient.email.toLowerCase() !== userEmail.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  if (!recipient.certificateS3Key) {
    return res.status(404).json({ success: false, message: 'Certificate PDF not available for download.' });
  }

  const downloadUrl = await getSignedUrl(recipient.certificateS3Key, 300); // 5 min expiry
  return ApiResponse.success(res, { downloadUrl });
});

module.exports = {
  uploadTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,
  getRecipientsCount,
  sendCertificates,
  sendTestCertificate,
  getCertificateHistory,
  verifyCertificate,
  getMyCertificates,
  downloadCertificate,
};
