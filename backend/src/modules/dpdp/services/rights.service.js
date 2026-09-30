/**
 * @module dpdp/services/rights
 * @description Data principal rights (DPDP ss. 11-14): access (export), correction,
 * erasure (anonymisation), grievance, consent withdrawal and nomination.
 */
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { AppError, ValidationError, NotFoundError } = require('../../../shared/utils/AppError');
const { OPEN_REQUEST_STATUSES } = require('../dpdp.constants');
const { computeDueAt, buildAnonymisedFields, mapCorrectionDetails } = require('../dpdp.utils');
const { dpdpAudit, AuditActionType, AuditSeverity } = require('./dpdpAudit.service');
const consentService = require('./consent.service');

const log = createModuleLogger('dpdp');

const EXPORT_CAP = { contributions: 500, authorship: 1000, notifications: 500, audit: 1000 };

/** Workflow statuses in which a person is still legally/operationally needed. */
const OPEN_WORKFLOW_STATUSES = {
  ipr: ['submitted', 'under_drd_review', 'changes_required', 'resubmitted', 'recommended_to_head', 'drd_head_approved',
    'submitted_to_govt', 'govt_application_filed', 'published', 'under_finance_review', 'finance_approved', 'pending_mentor_approval'],
  research: ['submitted', 'under_review', 'changes_required', 'resubmitted', 'approved'],
  grant: ['submitted', 'under_review', 'changes_required', 'resubmitted', 'recommended', 'approved'],
};

const displayNameOf = (u) => u?.employeeDetails?.displayName
  || [u?.employeeDetails?.firstName, u?.employeeDetails?.lastName].filter(Boolean).join(' ')
  || u?.studentLogin?.displayName
  || [u?.studentLogin?.firstName, u?.studentLogin?.lastName].filter(Boolean).join(' ')
  || null;

// ── requests ─────────────────────────────────────────────────────────────────

const listMyRequests = (userId) => prisma.dataPrincipalRequest.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
});

/**
 * Create a request. `consent_withdrawal` with details.purposes is applied immediately
 * (withdrawal must be as easy as consent) and completed.
 */
const createRequest = async ({ req, userId, type, description, details }) => {
  if (type === 'correction') {
    const mapped = mapCorrectionDetails(details);
    if (mapped.rejected.length) {
      throw new ValidationError(`These fields cannot be corrected through a data request: ${mapped.rejected.join(', ')}`);
    }
    if (!Object.keys(details || {}).length) throw new ValidationError('Tell us which fields to correct and the correct values');
  }
  if (type === 'erasure' || type === 'correction' || type === 'access') {
    const dup = await prisma.dataPrincipalRequest.findFirst({
      where: { userId, type, status: { in: OPEN_REQUEST_STATUSES } },
      select: { id: true },
    });
    if (dup) throw new AppError(`You already have an open ${type} request. We will respond to it before its due date.`, 409);
  }

  const now = new Date();
  let request = await prisma.dataPrincipalRequest.create({
    data: {
      userId,
      type,
      description: description || null,
      details: details || {},
      dueAt: computeDueAt(type, now),
    },
  });

  const purposes = Array.isArray(details?.purposes) ? details.purposes.filter((p) => typeof p === 'string') : [];
  if (type === 'consent_withdrawal' && purposes.length) {
    for (const purpose of purposes) {
      try {
        await consentService.withdrawConsent({ req, userId, purpose });
      } catch (e) {
        log.warn('Consent withdrawal from request failed for a purpose', { requestId: request.id, purpose, error: e.message });
      }
    }
    request = await prisma.dataPrincipalRequest.update({
      where: { id: request.id },
      data: { status: 'completed', resolvedAt: new Date(), response: `Consent withdrawn for: ${purposes.join(', ')}` },
    });
  }

  await dpdpAudit({
    req,
    action: `DPDP ${type} request submitted`,
    actionType: AuditActionType.SUBMIT,
    category: 'principal_request',
    targetTable: 'data_principal_requests',
    targetId: request.id,
    details: { type, dueAt: request.dueAt, fields: type === 'correction' ? Object.keys(details || {}) : undefined },
  });
  return request;
};

/** Admin list with the requester's uid/email/name. */
const listRequests = async ({ status, type, page = 1, limit = 20 }) => {
  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
  const [rows, total] = await Promise.all([
    prisma.dataPrincipalRequest.findMany({
      where,
      orderBy: [{ dueAt: 'asc' }],
      skip,
      take,
      include: {
        user: {
          select: {
            id: true, uid: true, email: true, role: true, anonymizedAt: true,
            employeeDetails: { select: { displayName: true, firstName: true, lastName: true } },
            studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
          },
        },
        handledBy: { select: { id: true, uid: true } },
      },
    }),
    prisma.dataPrincipalRequest.count({ where }),
  ]);
  const now = Date.now();
  const items = rows.map(({ user, ...r }) => ({
    ...r,
    overdue: OPEN_REQUEST_STATUSES.includes(r.status) && new Date(r.dueAt).getTime() < now,
    user: user ? { id: user.id, uid: user.uid, email: user.email, role: user.role, name: displayNameOf(user), erased: !!user.anonymizedAt } : null,
  }));
  return { items, total, page: Math.floor(skip / take) + 1, limit: take };
};

const getRequestOr404 = async (id) => {
  const r = await prisma.dataPrincipalRequest.findUnique({ where: { id } });
  if (!r) throw new NotFoundError('Request');
  return r;
};

/** PATCH /admin/requests/:id — status/response. */
const updateRequest = async ({ req, id, status, response }) => {
  const current = await getRequestOr404(id);
  if (['completed', 'rejected'].includes(current.status) && status && status !== current.status) {
    throw new AppError('This request is already closed.', 409);
  }
  const data = { handledById: req.user.id };
  if (status) data.status = status;
  if (response !== undefined) data.response = response;
  if (status && ['completed', 'rejected'].includes(status)) data.resolvedAt = new Date();
  const updated = await prisma.dataPrincipalRequest.update({ where: { id }, data });
  await dpdpAudit({
    req,
    action: `DPDP request updated${status ? ` to ${status}` : ''}`,
    actionType: AuditActionType.STATUS_CHANGE,
    category: 'principal_request',
    targetTable: 'data_principal_requests',
    targetId: id,
    details: { type: current.type, from: current.status, to: updated.status, responded: response !== undefined },
  });
  return updated;
};

/** Open workflow items that still need the person (erasure refused while any exist). */
const findOpenWorkflowItems = async (userId) => {
  const [ipr, research, grants] = await Promise.all([
    prisma.iprApplication.count({ where: { applicantUserId: userId, status: { in: OPEN_WORKFLOW_STATUSES.ipr } } }),
    prisma.researchContribution.count({ where: { applicantUserId: userId, status: { in: OPEN_WORKFLOW_STATUSES.research } } }),
    prisma.grantApplication.count({ where: { applicantUserId: userId, status: { in: OPEN_WORKFLOW_STATUSES.grant } } }),
  ]);
  const items = {};
  if (ipr) items.iprApplications = ipr;
  if (research) items.researchContributions = research;
  if (grants) items.grantApplications = grants;
  return items;
};

/**
 * Apply whitelisted corrections to the user's profile.
 * @returns {string[]} the generic field names changed
 */
const applyCorrection = async (userId, details) => {
  const mapped = mapCorrectionDetails(details);
  if (mapped.rejected.length) throw new ValidationError(`Fields not correctable: ${mapped.rejected.join(', ')}`);
  await prisma.$transaction(async (tx) => {
    if (Object.keys(mapped.user).length) await tx.userLogin.update({ where: { id: userId }, data: mapped.user });
    if (Object.keys(mapped.student).length) await tx.studentDetails.updateMany({ where: { userLoginId: userId }, data: mapped.student });
    if (Object.keys(mapped.employee).length) await tx.employeeDetails.updateMany({ where: { userLoginId: userId }, data: mapped.employee });
  });
  await cache.invalidateUser(userId);
  return Object.keys(details || {});
};

/**
 * Erase a user: anonymise what must be kept, delete what is optional. Does not delete the
 * UserLogin row, academic/financial/research records or audit logs (retained by law;
 * they now point at an anonymous account).
 * @param {object} p
 * @param {string} p.userId
 * @param {boolean} [p.force] erase even with open workflow items (admin decision)
 * @param {string} [p.reason] 'request' | 'retention'
 * @returns {Promise<{ erased: boolean, openItems?: object }>}
 */
const anonymiseUser = async ({ userId, force = false, reason = 'request', req = null, actorId, universityId }) => {
  const user = await prisma.userLogin.findUnique({ where: { id: userId }, select: { id: true, role: true, universityId: true, anonymizedAt: true } });
  if (!user) throw new NotFoundError('User');
  if (user.role === 'superadmin') throw new AppError('Platform administrator accounts cannot be erased this way.', 400);
  if (user.anonymizedAt) return { erased: true, alreadyErased: true };

  const openItems = await findOpenWorkflowItems(userId);
  if (Object.keys(openItems).length && !force) return { erased: false, openItems };

  const f = buildAnonymisedFields(userId);
  await prisma.$transaction(async (tx) => {
    await tx.userLogin.update({ where: { id: userId }, data: f.userLogin });
    await tx.employeeDetails.updateMany({ where: { userLoginId: userId }, data: f.employeeDetails });
    await tx.studentDetails.updateMany({ where: { userLoginId: userId }, data: f.studentDetails });
    // contact details copied into workflow records; names on authorship/inventorship are kept for research integrity
    await tx.researchContributionAuthor.updateMany({ where: { userId }, data: { email: null } });
    await tx.iprContributor.updateMany({ where: { userId }, data: { email: null } });
    await tx.grantInvestigator.updateMany({ where: { userId }, data: { email: null } });
    // optional data
    await tx.dataPrincipalNominee.deleteMany({ where: { userId } });
    await tx.userSettings.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.researchProfileIdentity.deleteMany({ where: { userId } });
  });

  await cache.invalidateUser(userId);
  await consentService.invalidateConsentCache(userId, user.universityId);
  await dpdpAudit({
    req,
    actorId: actorId !== undefined ? actorId : req?.user?.id || null,
    universityId: universityId !== undefined ? universityId : user.universityId,
    action: reason === 'retention' ? 'DPDP account anonymised by retention policy' : 'DPDP account erased (anonymised)',
    actionType: AuditActionType.DELETE,
    category: 'erasure',
    severity: AuditSeverity.WARNING,
    targetTable: 'user_login',
    targetId: userId,
    details: { reason, forced: !!force && Object.keys(openItems).length > 0, openItems },
  });
  return { erased: true };
};

/**
 * POST /admin/requests/:id/fulfil
 * access → export available to the user; correction → applies details; erasure → anonymises;
 * grievance/nomination/consent_withdrawal → closes with the response.
 */
const fulfilRequest = async ({ req, id, response, force = false }) => {
  const request = await getRequestOr404(id);
  if (!OPEN_REQUEST_STATUSES.includes(request.status)) throw new AppError('This request is already closed.', 409);

  let autoResponse;
  let result = {};
  switch (request.type) {
    case 'access':
      autoResponse = 'Your data export is ready. Download it from Privacy & my data → Download my data.';
      break;
    case 'correction': {
      const fields = await applyCorrection(request.userId, request.details);
      result = { correctedFields: fields };
      autoResponse = `Corrected: ${fields.join(', ')}`;
      break;
    }
    case 'erasure': {
      const out = await anonymiseUser({ userId: request.userId, force, req });
      if (!out.erased) {
        const err = new AppError(
          'The user still has open IPR, research or grant workflows that legally need their identity. '
          + 'Close or reassign them first, or erase anyway with force: true.',
          409,
        );
        err.errors = { openItems: out.openItems };
        throw err;
      }
      result = { erased: true };
      autoResponse = 'Your personal data has been erased. Records the law requires us to keep have been anonymised.';
      break;
    }
    default:
      autoResponse = 'Your request has been handled.';
  }

  const updated = await prisma.dataPrincipalRequest.update({
    where: { id },
    data: { status: 'completed', resolvedAt: new Date(), handledById: req.user.id, response: response || autoResponse },
  });
  await dpdpAudit({
    req,
    action: `DPDP ${request.type} request fulfilled`,
    actionType: AuditActionType.APPROVE,
    category: 'principal_request',
    targetTable: 'data_principal_requests',
    targetId: id,
    details: { type: request.type, principalUserId: request.userId, ...(result.correctedFields ? { correctedFields: result.correctedFields } : {}), forced: !!force },
  });
  return updated;
};

// ── access: export ───────────────────────────────────────────────────────────

/**
 * Everything held about a user, as JSON. Excludes credentials (passwordHash, tokenVersion).
 * @param {string} userId
 */
const buildExport = async (userId) => {
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: {
      id: true, uid: true, email: true, phone: true, profileImageFilePath: true, profileImage: true, role: true,
      status: true, universityId: true, lastLoginAt: true, passwordChangedAt: true, createdAt: true, updatedAt: true,
      university: { select: { name: true, code: true, dpoName: true, dpoEmail: true, dpoPhone: true } },
      employeeDetails: true,
      studentLogin: true,
      userSettings: true,
      nominee: true,
      researchProfileIdentity: true,
    },
  });
  if (!user) throw new NotFoundError('User');

  const [consents, requests, contributions, authorship, ipr, iprContributions, grants, grantInvestigations, notifications, auditEntries] = await Promise.all([
    prisma.consentRecord.findMany({ where: { userId }, include: { notice: { select: { version: true, title: true, language: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.dataPrincipalRequest.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.researchContribution.findMany({
      where: { applicantUserId: userId },
      select: { id: true, applicationNumber: true, title: true, publicationType: true, status: true, createdAt: true, updatedAt: true },
      take: EXPORT_CAP.contributions,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.researchContributionAuthor.findMany({
      where: { userId },
      select: { researchContributionId: true, name: true, email: true, authorType: true },
      take: EXPORT_CAP.authorship,
    }),
    prisma.iprApplication.findMany({
      where: { applicantUserId: userId },
      select: { id: true, applicationNumber: true, title: true, status: true, createdAt: true, updatedAt: true },
      take: EXPORT_CAP.contributions,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.iprContributor.findMany({ where: { userId }, select: { iprApplicationId: true, name: true, email: true, role: true }, take: EXPORT_CAP.authorship }),
    prisma.grantApplication.findMany({
      where: { applicantUserId: userId },
      select: { id: true, applicationNumber: true, title: true, status: true, createdAt: true, updatedAt: true },
      take: EXPORT_CAP.contributions,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.grantInvestigator.findMany({ where: { userId }, select: { grantApplicationId: true, name: true, email: true }, take: EXPORT_CAP.authorship }),
    prisma.notification.findMany({
      where: { userId },
      select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true },
      take: EXPORT_CAP.notifications,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.findMany({
      where: { actorId: userId },
      select: { id: true, action: true, actionType: true, module: true, requestPath: true, ipAddress: true, userAgent: true, createdAt: true },
      take: EXPORT_CAP.audit,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const { university, ...account } = user;
  return {
    generatedAt: new Date().toISOString(),
    legalBasis: 'Digital Personal Data Protection Act, 2023, section 11 (right to access information about personal data)',
    dataFiduciary: university ? { name: university.name, code: university.code, dpo: { name: university.dpoName, email: university.dpoEmail, phone: university.dpoPhone } } : null,
    limits: { note: 'Long lists are capped; ask your Data Protection Officer for the complete set.', caps: EXPORT_CAP },
    account,
    consents,
    dataPrincipalRequests: requests,
    research: { contributions, authorship },
    ipr: { applications: ipr, contributions: iprContributions },
    grants: { applications: grants, investigatorRoles: grantInvestigations },
    notifications,
    activityLog: auditEntries,
  };
};

/** GET /export/me: build + audit. */
const exportForUser = async ({ req, userId }) => {
  const data = await buildExport(userId);
  await dpdpAudit({
    req,
    action: 'DPDP personal data export downloaded',
    actionType: AuditActionType.EXPORT,
    category: 'access',
    targetTable: 'user_login',
    targetId: userId,
    details: {
      counts: {
        consents: data.consents.length,
        requests: data.dataPrincipalRequests.length,
        contributions: data.research.contributions.length,
        notifications: data.notifications.length,
        activityLog: data.activityLog.length,
      },
    },
  });
  return data;
};

// ── nominee (s. 14) ──────────────────────────────────────────────────────────

const getNominee = (userId) => prisma.dataPrincipalNominee.findUnique({ where: { userId } });

const upsertNominee = async ({ req, userId, name, email, phone, relation }) => {
  const data = { name, email: email || null, phone: phone || null, relation: relation || null };
  const existing = await prisma.dataPrincipalNominee.findUnique({ where: { userId }, select: { id: true } });
  const nominee = existing
    ? await prisma.dataPrincipalNominee.update({ where: { id: existing.id }, data })
    : await prisma.dataPrincipalNominee.create({ data: { userId, ...data } });
  await dpdpAudit({
    req,
    action: existing ? 'DPDP nominee updated' : 'DPDP nominee added',
    actionType: existing ? AuditActionType.UPDATE : AuditActionType.CREATE,
    category: 'nomination',
    targetTable: 'data_principal_nominees',
    targetId: nominee.id,
  });
  return nominee;
};

const deleteNominee = async ({ req, userId }) => {
  const { count } = await prisma.dataPrincipalNominee.deleteMany({ where: { userId } });
  if (count) {
    await dpdpAudit({
      req, action: 'DPDP nominee removed', actionType: AuditActionType.DELETE, category: 'nomination', targetTable: 'data_principal_nominees',
    });
  }
  return null;
};

/** Run fn in the tenant of a user (for callers outside a request). */
const inUserTenant = (universityId, fn) => (universityId ? tenantContext.runForTenant(universityId, fn) : fn());

module.exports = {
  OPEN_WORKFLOW_STATUSES,
  displayNameOf,
  listMyRequests,
  createRequest,
  listRequests,
  updateRequest,
  fulfilRequest,
  findOpenWorkflowItems,
  applyCorrection,
  anonymiseUser,
  buildExport,
  exportForUser,
  getNominee,
  upsertNominee,
  deleteNominee,
  inUserTenant,
};
