/**
 * @module dpdp/services/breach
 * @description Personal data breach register (DPDP s. 8(6) + Rules 2025): Board
 * intimation due 72 h after detection, intimation of affected data principals.
 */
const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { AppError, ValidationError, NotFoundError } = require('../../../shared/utils/AppError');
const { BREACH_STATUS_ORDER } = require('../dpdp.constants');
const { computeBoardReportDueAt, withBreachFlags, isValidBreachTransition, escapeHtml } = require('../dpdp.utils');
const { dpdpAudit, AuditActionType, AuditSeverity } = require('./dpdpAudit.service');

const log = createModuleLogger('dpdp');

const NOTIFY_BATCH_SIZE = parseInt(process.env.DPDP_BREACH_EMAIL_BATCH || '50', 10) || 50;

const listBreaches = async ({ isSuperadmin = false } = {}) => {
  const rows = await prisma.dataBreachIncident.findMany({
    orderBy: { detectedAt: 'desc' },
    include: {
      reportedBy: { select: { id: true, uid: true } },
      ...(isSuperadmin ? { university: { select: { id: true, name: true, code: true } } } : {}),
    },
    take: 500,
  });
  return rows.map((r) => withBreachFlags(r));
};

const getBreachOr404 = async (id) => {
  const r = await prisma.dataBreachIncident.findUnique({ where: { id } });
  if (!r) throw new NotFoundError('Breach incident');
  return r;
};

const createBreach = async ({ req, title, description, severity, detectedAt, affectedCount, dataCategories }) => {
  const detected = new Date(detectedAt);
  if (detected.getTime() > Date.now() + 5 * 60 * 1000) throw new ValidationError('detectedAt cannot be in the future');
  const incident = await prisma.dataBreachIncident.create({
    data: {
      title,
      description,
      severity: severity || 'medium',
      detectedAt: detected,
      boardReportDueAt: computeBoardReportDueAt(detected),
      affectedCount: affectedCount ?? null,
      dataCategories: dataCategories || [],
      reportedById: req.user.id,
    },
  });
  await dpdpAudit({
    req,
    universityId: incident.universityId,
    action: 'DPDP breach incident recorded',
    actionType: AuditActionType.CREATE,
    category: 'breach',
    severity: AuditSeverity.CRITICAL,
    targetTable: 'data_breach_incidents',
    targetId: incident.id,
    details: { severity: incident.severity, boardReportDueAt: incident.boardReportDueAt, affectedCount: incident.affectedCount },
  });
  return withBreachFlags(incident);
};

const updateBreach = async ({ req, id, status, remediation, boardNotifiedAt, affectedCount }) => {
  const current = await getBreachOr404(id);
  const data = {};
  if (status && status !== current.status) {
    if (!isValidBreachTransition(current.status, status)) {
      throw new AppError(`Status cannot move from ${current.status} to ${status}. Allowed order: ${BREACH_STATUS_ORDER.join(' → ')}.`, 400);
    }
    data.status = status;
    if (status === 'board_notified' && !current.boardNotifiedAt && !boardNotifiedAt) data.boardNotifiedAt = new Date();
  }
  if (remediation !== undefined) data.remediation = remediation;
  if (boardNotifiedAt !== undefined) data.boardNotifiedAt = boardNotifiedAt ? new Date(boardNotifiedAt) : null;
  if (affectedCount !== undefined) data.affectedCount = affectedCount;
  const updated = await prisma.dataBreachIncident.update({ where: { id }, data });
  await dpdpAudit({
    req,
    universityId: updated.universityId,
    action: `DPDP breach incident updated${data.status ? ` to ${data.status}` : ''}`,
    actionType: data.status ? AuditActionType.STATUS_CHANGE : AuditActionType.UPDATE,
    category: 'breach',
    severity: AuditSeverity.WARNING,
    targetTable: 'data_breach_incidents',
    targetId: id,
    details: { from: current.status, to: updated.status, fields: Object.keys(data) },
  });
  return withBreachFlags(updated);
};

const buildBreachEmail = ({ universityName, incident, message, dpo }) => {
  const subject = `Important: personal data breach notice from ${universityName}`;
  const contact = [dpo.name, dpo.email, dpo.phone].filter(Boolean).join(', ') || 'your university administration';
  const text = [
    'Dear user,',
    '',
    message,
    '',
    `Incident: ${incident.title}`,
    `Detected on: ${new Date(incident.detectedAt).toUTCString()}`,
    '',
    `If you have questions, contact the Data Protection Officer: ${contact}.`,
    'You may also complain to the Data Protection Board of India.',
  ].join('\n');
  const html = `<p>Dear user,</p>
<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
<p><strong>Incident:</strong> ${escapeHtml(incident.title)}<br><strong>Detected on:</strong> ${escapeHtml(new Date(incident.detectedAt).toUTCString())}</p>
<p>If you have questions, contact the Data Protection Officer: ${escapeHtml(contact)}.<br>You may also complain to the Data Protection Board of India.</p>`;
  return { subject, text, html };
};

/**
 * Email every active user of the incident's university (BCC batches), set principalsNotifiedAt.
 * Platform-wide incidents (no universityId) cannot be mass-notified from here.
 */
const notifyPrincipals = async ({ req, id, message }) => {
  const incident = await getBreachOr404(id);
  if (!incident.universityId) {
    throw new AppError('This incident is not linked to a university. Record it per university to notify its users.', 400);
  }
  const { emailService } = require('../../core/services/email.service');

  const { university, recipients } = await tenantContext.runForTenant(incident.universityId, async () => {
    const uni = await prisma.university.findUnique({
      where: { id: incident.universityId },
      select: { name: true, dpoName: true, dpoEmail: true, dpoPhone: true },
    });
    const users = await prisma.userLogin.findMany({
      where: { status: 'active', anonymizedAt: null, email: { not: null }, role: { not: 'superadmin' } },
      select: { email: true },
    });
    return { university: uni, recipients: users.map((u) => u.email).filter(Boolean) };
  });

  const mail = buildBreachEmail({
    universityName: university?.name || 'your university',
    incident,
    message,
    dpo: { name: university?.dpoName, email: university?.dpoEmail, phone: university?.dpoPhone },
  });
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || process.env.SMTP_USER;
  const visibleTo = university?.dpoEmail || fromAddress;

  let notified = 0;
  let failedBatches = 0;
  for (let i = 0; i < recipients.length; i += NOTIFY_BATCH_SIZE) {
    const batch = recipients.slice(i, i + NOTIFY_BATCH_SIZE);
    // BCC so recipients do not see each other's addresses
    const res = await emailService.sendEmail({ to: visibleTo, bcc: batch, subject: mail.subject, text: mail.text, html: mail.html });
    if (res?.success) notified += batch.length;
    else failedBatches += 1;
  }
  if (failedBatches) log.warn('Some breach notification batches failed', { incidentId: id, failedBatches });

  const data = {};
  if (notified > 0) {
    data.principalsNotifiedAt = new Date();
    if (BREACH_STATUS_ORDER.indexOf(incident.status) < BREACH_STATUS_ORDER.indexOf('principals_notified')) {
      data.status = 'principals_notified';
    }
    await prisma.dataBreachIncident.update({ where: { id }, data });
  }
  await dpdpAudit({
    req,
    universityId: incident.universityId,
    action: 'DPDP breach: data principals notified',
    actionType: AuditActionType.EMAIL_SENT,
    category: 'breach',
    severity: AuditSeverity.WARNING,
    targetTable: 'data_breach_incidents',
    targetId: id,
    details: { recipients: recipients.length, notified, failedBatches },
  });
  return { notified, total: recipients.length, failedBatches };
};

module.exports = { listBreaches, createBreach, updateBreach, notifyPrincipals, buildBreachEmail };
