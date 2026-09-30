/**
 * @module dpdp/services/consent
 * @description Notices (DPDP s. 5), consent (s. 6) and verifiable guardian consent
 * for children (s. 9).
 *
 * Consent state per (user, notice, purpose) is one ConsentRecord row that is updated
 * on grant/withdrawal and never deleted; every change is also written to the audit
 * log, which keeps the full history of decisions.
 */
const jwt = require('jsonwebtoken');
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const config = require('../../../shared/config/app.config');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { AppError, ValidationError, NotFoundError } = require('../../../shared/utils/AppError');
const { getIp } = require('../../../shared/utils/auditLogger');
const {
  DEFAULT_NOTICE,
  CONSENT_CACHE_PREFIX,
  CONSENT_CACHE_TTL,
  GUARDIAN_TOKEN_AUDIENCE,
  GUARDIAN_TOKEN_TTL,
  MINOR_FORBIDDEN_PURPOSES,
} = require('../dpdp.constants');
const {
  isMinor,
  computeConsentState,
  normalizeDecisions,
  noticePurposes,
  renderNoticeContent,
  escapeHtml,
  safeIp,
} = require('../dpdp.utils');
const { dpdpAudit, AuditActionType } = require('./dpdpAudit.service');

const log = createModuleLogger('dpdp');

// ── notices ──────────────────────────────────────────────────────────────────

/** Shape a ConsentNotice row for API responses. */
const toNoticeDto = (notice, university = null, { raw = false } = {}) => (notice ? {
  id: notice.id,
  universityId: notice.universityId,
  isPlatformDefault: notice.universityId === null,
  version: notice.version,
  language: notice.language,
  title: notice.title,
  content: raw ? notice.content : renderNoticeContent(notice.content, university),
  ...(raw ? { renderedContent: renderNoticeContent(notice.content, university) } : {}),
  purposes: noticePurposes(notice),
  isActive: notice.isActive,
  effectiveFrom: notice.effectiveFrom,
  createdAt: notice.createdAt,
} : null);

/**
 * The notice that applies to a university: its own active notice, else the active platform default.
 * Filters explicitly, so it is correct inside or outside a tenant context.
 * @param {string|null} universityId
 * @param {string} [language]
 */
const getActiveNotice = async (universityId, language = 'en') => {
  const notices = await prisma.consentNotice.findMany({
    where: {
      isActive: true,
      language,
      OR: universityId ? [{ universityId }, { universityId: null }] : [{ universityId: null }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  return notices.find((n) => universityId && n.universityId === universityId)
    || notices.find((n) => n.universityId === null)
    || null;
};

/**
 * Create the platform default notice (universityId null) if no platform notice exists yet.
 * Idempotent; safe to call on every startup. Nothing else is seeded.
 * @returns {Promise<object>} the platform notice
 */
const ensureDefaultNotice = () => tenantContext.runAsSystem(async () => {
  const existing = await prisma.consentNotice.findFirst({
    where: { universityId: null, language: DEFAULT_NOTICE.language },
    orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }],
  });
  if (existing) return existing;
  const created = await prisma.consentNotice.create({
    data: {
      universityId: null,
      version: DEFAULT_NOTICE.version,
      language: DEFAULT_NOTICE.language,
      title: DEFAULT_NOTICE.title,
      content: DEFAULT_NOTICE.content,
      purposes: DEFAULT_NOTICE.purposes,
      isActive: true,
    },
  });
  log.info('Created platform default DPDP privacy notice', { noticeId: created.id, version: created.version });
  return created;
});

// ── consent state ────────────────────────────────────────────────────────────

const consentCacheKey = (userId) => `${CONSENT_CACHE_PREFIX}${userId}`;

/** Load what the consent decision needs about a user. */
const loadPrincipal = (userId) => prisma.userLogin.findUnique({
  where: { id: userId },
  select: {
    id: true,
    role: true,
    universityId: true,
    university: { select: { id: true, name: true, dpoName: true, dpoEmail: true, dpoPhone: true, requireGuardianConsentForMinors: true } },
    studentLogin: { select: { dateOfBirth: true, firstName: true, displayName: true } },
  },
});

/**
 * Full consent picture for a user (uncached).
 * @param {string} userId
 */
const computeConsentForUser = async (userId) => {
  const user = await loadPrincipal(userId);
  if (!user) throw new NotFoundError('User');
  const notice = await getActiveNotice(user.universityId);
  const records = notice
    ? await prisma.consentRecord.findMany({ where: { userId, noticeId: notice.id }, orderBy: { purpose: 'asc' } })
    : [];
  const minor = user.role === 'student' && isMinor(user.studentLogin?.dateOfBirth);
  const guardianRequiredByTenant = user.university ? user.university.requireGuardianConsentForMinors !== false : false;
  const state = computeConsentState({ notice, records, isMinor: minor, guardianRequiredByTenant });
  return { user, notice, records, state };
};

/**
 * Cached gate state ({ blocked, needsConsent, guardianPending, ... }) for the middleware.
 * Must run inside the user's tenant context so the cache key is tenant-prefixed.
 */
const getCachedConsentState = async (userId) => {
  const { data } = await cache.getOrSet(consentCacheKey(userId), async () => {
    const { state } = await computeConsentForUser(userId);
    return state;
  }, CONSENT_CACHE_TTL);
  return data;
};

/** Drop the cached gate state of a user (call inside the user's tenant context, or pass universityId). */
const invalidateConsentCache = async (userId, universityId = null) => {
  const run = () => cache.del(consentCacheKey(userId));
  const ctxTenant = tenantContext.getTenantId();
  if (universityId && universityId !== ctxTenant) return tenantContext.runForTenant(universityId, run);
  return run();
};

/** Drop every cached gate state of the current tenant (e.g. guardian policy changed). */
const invalidateTenantConsentCache = () => cache.delPattern(`${CONSENT_CACHE_PREFIX}*`);

/** Payload of GET /dpdp/consents/me. */
const getMyConsents = async (userId) => {
  const { user, notice, records, state } = await computeConsentForUser(userId);
  return {
    notice: toNoticeDto(notice, user.university),
    records: records.map(toRecordDto),
    needsConsent: state.needsConsent,
    isMinor: state.isMinor,
    requiresGuardian: state.requiresGuardian,
    guardianPending: state.guardianPending,
    minorRestrictedPurposes: state.isMinor ? MINOR_FORBIDDEN_PURPOSES : [],
  };
};

const toRecordDto = (r) => ({
  id: r.id,
  noticeId: r.noticeId,
  purpose: r.purpose,
  granted: r.granted,
  grantedAt: r.grantedAt,
  withdrawnAt: r.withdrawnAt,
  givenBy: r.givenBy,
  guardianName: r.guardianName,
  guardianEmail: r.guardianEmail,
  guardianRelation: r.guardianRelation,
  guardianVerifiedAt: r.guardianVerifiedAt,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const requestMeta = (req) => ({
  ipAddress: safeIp(getIp(req)),
  userAgent: String(req.headers?.['user-agent'] || '').slice(0, 512) || null,
});

// ── guardian verification ────────────────────────────────────────────────────

const signGuardianToken = ({ recordIds, userId, universityId }) => jwt.sign(
  { rids: recordIds, uid: userId, uni: universityId || null },
  config.jwt.secret,
  { audience: GUARDIAN_TOKEN_AUDIENCE, expiresIn: GUARDIAN_TOKEN_TTL, algorithm: 'HS256' },
);

const verifyGuardianToken = (token) => {
  try {
    const payload = jwt.verify(token, config.jwt.secret, { audience: GUARDIAN_TOKEN_AUDIENCE, algorithms: ['HS256'] });
    if (!Array.isArray(payload.rids) || !payload.rids.length || !payload.uid) throw new Error('bad payload');
    return payload;
  } catch (e) {
    throw new AppError('This consent link is invalid or has expired. Ask the student to send a new one.', 400);
  }
};

const guardianLink = (token) => {
  const base = process.env.DPDP_GUARDIAN_CONSENT_URL
    || `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '')}/guardian-consent`;
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(token)}`;
};

const sendGuardianEmail = async ({ guardian, studentName, universityName, token, purposes }) => {
  const { emailService } = require('../../core/services/email.service');
  const link = guardianLink(token);
  const list = purposes.map((p) => `<li><strong>${escapeHtml(p.label || p.key)}</strong>${p.required ? ' (required)' : ''}: ${escapeHtml(p.description || '')}</li>`).join('');
  const subject = `Consent needed for ${studentName} to use ${universityName} ResearchSphere`;
  const text = [
    `Dear ${guardian.name},`,
    '',
    `${studentName} has asked to use ResearchSphere, the research and academic platform of ${universityName}.`,
    'Because they are under 18, Indian law (Digital Personal Data Protection Act, 2023, section 9) requires the verifiable consent of a parent or lawful guardian before their personal data is processed.',
    '',
    `Review and respond here (link valid for 7 days): ${link}`,
    '',
    'If you do not know this student or did not expect this email, you can ignore it.',
  ].join('\n');
  const html = `<p>Dear ${escapeHtml(guardian.name)},</p>
<p>${escapeHtml(studentName)} has asked to use ResearchSphere, the research and academic platform of ${escapeHtml(universityName)}.
Because they are under 18, the Digital Personal Data Protection Act, 2023 (section 9) requires the verifiable consent of a parent or lawful guardian before their personal data is processed.</p>
<p>They asked for these purposes:</p><ul>${list}</ul>
<p><a href="${escapeHtml(link)}">Review and respond</a> (link valid for 7 days).</p>
<p>If you do not know this student or did not expect this email, you can ignore it.</p>`;
  const result = await emailService.sendEmail({ to: guardian.email, subject, text, html });
  if (!result?.success) log.warn('Guardian consent email not sent', { error: result?.error });
  return !!result?.success;
};

// ── grant / withdraw ─────────────────────────────────────────────────────────

/**
 * Record a user's decisions for the active notice (POST /dpdp/consents).
 * @param {object} p
 * @param {import('express').Request} p.req
 * @param {string} p.userId
 * @param {string} p.noticeId
 * @param {Array<{purpose, granted}>} p.decisions
 * @param {{name,email,relation}} [p.guardian]
 */
const recordConsent = async ({ req, userId, noticeId, decisions: rawDecisions, guardian }) => {
  const { user, notice, records, state } = await computeConsentForUser(userId);
  if (!notice) throw new AppError('No privacy notice is active, so there is nothing to consent to.', 409);
  if (notice.id !== noticeId) {
    throw new AppError('The privacy notice has changed. Reload the page and review the current notice.', 409);
  }
  const { decisions, forcedOff, errors } = normalizeDecisions(notice, rawDecisions, { isMinor: state.isMinor });
  if (errors.length) throw new ValidationError(errors.join('; '));
  if (state.requiresGuardian && !guardian) {
    throw new ValidationError('Because you are under 18, a parent or guardian must give consent. Enter their name, email and relationship.');
  }

  const now = new Date();
  const meta = requestMeta(req);
  const existing = new Map(records.map((r) => [r.purpose, r]));
  const guardianEmail = guardian?.email ? String(guardian.email).trim().toLowerCase() : null;

  const saved = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const d of decisions) {
      const prev = existing.get(d.purpose);
      const guardianFields = state.requiresGuardian ? {
        givenBy: 'guardian',
        guardianName: guardian.name,
        guardianEmail,
        guardianRelation: guardian.relation || null,
        // keep an earlier verification only if the same guardian already approved and the decision is unchanged
        guardianVerifiedAt: prev && prev.guardianVerifiedAt && prev.guardianEmail === guardianEmail && prev.granted === d.granted
          ? prev.guardianVerifiedAt : null,
      } : { givenBy: 'self', guardianName: null, guardianEmail: null, guardianRelation: null, guardianVerifiedAt: null };
      const grantChanged = !prev || prev.granted !== d.granted || (d.granted && prev.withdrawnAt);
      const data = {
        granted: d.granted,
        grantedAt: d.granted ? (grantChanged ? now : prev.grantedAt || now) : prev?.grantedAt || null,
        withdrawnAt: d.granted ? null : (prev?.granted && !prev.withdrawnAt ? now : prev?.withdrawnAt || null),
        ...guardianFields,
        ...meta,
      };
      const row = prev
        ? await tx.consentRecord.update({ where: { id: prev.id }, data })
        : await tx.consentRecord.create({ data: { userId, noticeId: notice.id, purpose: d.purpose, ...data } });
      out.push(row);
    }
    return out;
  });

  await invalidateConsentCache(userId);

  let guardianEmailSent = null;
  if (state.requiresGuardian) {
    const needVerification = saved.filter((r) => !r.guardianVerifiedAt);
    if (needVerification.length) {
      const token = signGuardianToken({ recordIds: needVerification.map((r) => r.id), userId, universityId: user.universityId });
      guardianEmailSent = await sendGuardianEmail({
        guardian: { ...guardian, email: guardianEmail },
        studentName: user.studentLogin?.displayName || user.studentLogin?.firstName || 'A student',
        universityName: user.university?.name || 'your university',
        token,
        purposes: noticePurposes(notice).filter((p) => decisions.find((d) => d.purpose === p.key && d.granted)),
      });
    }
  }

  await dpdpAudit({
    req,
    action: 'DPDP consent recorded',
    actionType: AuditActionType.UPDATE,
    category: 'consent',
    targetTable: 'consent_records',
    targetId: notice.id,
    details: {
      noticeId: notice.id,
      noticeVersion: notice.version,
      decisions: decisions.map((d) => ({ purpose: d.purpose, granted: d.granted })),
      forcedOffForMinor: forcedOff,
      guardianRequired: state.requiresGuardian,
      guardianEmailSent,
    },
  });

  const payload = await getMyConsents(userId);
  return { ...payload, guardianEmailSent, forcedOffForMinor: forcedOff };
};

/**
 * Withdraw one purpose (POST /dpdp/consents/:purpose/withdraw). As easy as giving it:
 * one call, no reason needed. Recorded, never deleted.
 */
const withdrawConsent = async ({ req, userId, purpose }) => {
  const { notice, records } = await computeConsentForUser(userId);
  if (!notice) throw new AppError('No privacy notice is active.', 409);
  const def = noticePurposes(notice).find((p) => p.key === purpose);
  if (!def) throw new NotFoundError(`Purpose "${purpose}"`);
  const now = new Date();
  const meta = requestMeta(req);
  const prev = records.find((r) => r.purpose === purpose);
  if (prev) {
    await prisma.consentRecord.update({
      where: { id: prev.id },
      data: { granted: false, withdrawnAt: prev.granted && !prev.withdrawnAt ? now : prev.withdrawnAt || now, ...meta },
    });
  } else {
    await prisma.consentRecord.create({
      data: { userId, noticeId: notice.id, purpose, granted: false, withdrawnAt: now, ...meta },
    });
  }
  await invalidateConsentCache(userId);
  await dpdpAudit({
    req,
    action: 'DPDP consent withdrawn',
    actionType: AuditActionType.UPDATE,
    category: 'consent',
    targetTable: 'consent_records',
    targetId: notice.id,
    details: { noticeId: notice.id, purpose, required: !!def.required },
  });
  const payload = await getMyConsents(userId);
  return {
    ...payload,
    message: def.required
      ? `Consent for "${def.label || purpose}" was withdrawn. Features that depend on it can no longer be used until you give consent again. You can also ask for your data to be erased.`
      : `Consent for "${def.label || purpose}" was withdrawn.`,
  };
};

// ── public guardian endpoints ────────────────────────────────────────────────

/** Records referenced by a guardian token (public endpoint: no tenant context). */
const loadGuardianRecords = async (payload) => tenantContext.runAsSystem(() => prisma.consentRecord.findMany({
  where: { id: { in: payload.rids }, userId: payload.uid },
  include: {
    notice: true,
    university: { select: { name: true } },
    user: { select: { studentLogin: { select: { displayName: true, firstName: true } } } },
  },
}));

/** GET /dpdp/public/guardian-consent/:token */
const getGuardianRequest = async (token) => {
  const payload = verifyGuardianToken(token);
  const records = await loadGuardianRecords(payload);
  if (!records.length) throw new AppError('This consent request no longer exists.', 404);
  const first = records[0];
  const defs = new Map(noticePurposes(first.notice).map((p) => [p.key, p]));
  return {
    studentName: first.user?.studentLogin?.displayName || first.user?.studentLogin?.firstName || 'Student',
    universityName: first.university?.name || '',
    purposes: records.map((r) => ({
      key: r.purpose,
      label: defs.get(r.purpose)?.label || r.purpose,
      description: defs.get(r.purpose)?.description || '',
      required: !!defs.get(r.purpose)?.required,
      granted: r.granted,
    })),
    guardianName: first.guardianName,
    alreadyVerified: records.every((r) => !!r.guardianVerifiedAt),
  };
};

/** POST /dpdp/public/guardian-consent/:token { approve } */
const respondGuardianRequest = async ({ req, token, approve }) => {
  const payload = verifyGuardianToken(token);
  const records = await loadGuardianRecords(payload);
  if (!records.length) throw new AppError('This consent request no longer exists.', 404);
  const universityId = records[0].universityId;
  const now = new Date();
  const meta = requestMeta(req);
  const ids = records.map((r) => r.id);

  const apply = async () => {
    if (approve) {
      await prisma.consentRecord.updateMany({
        where: { id: { in: ids }, userId: payload.uid, guardianEmail: { not: null } },
        data: { guardianVerifiedAt: now },
      });
    } else {
      await prisma.consentRecord.updateMany({
        where: { id: { in: ids }, userId: payload.uid },
        data: { granted: false, withdrawnAt: now, guardianVerifiedAt: null },
      });
    }
  };
  if (universityId) await tenantContext.runForTenant(universityId, apply);
  else await tenantContext.runAsSystem(apply);

  await invalidateConsentCache(payload.uid, universityId);
  await dpdpAudit({
    req,
    actorId: null,
    universityId,
    action: approve ? 'DPDP guardian consent verified' : 'DPDP guardian consent declined',
    actionType: approve ? AuditActionType.APPROVE : AuditActionType.REJECT,
    category: 'guardian_consent',
    targetTable: 'consent_records',
    targetId: payload.uid,
    details: { recordIds: ids, principalUserId: payload.uid, ipRecorded: !!meta.ipAddress },
  });
  return { verified: !!approve };
};

module.exports = {
  toNoticeDto,
  getActiveNotice,
  ensureDefaultNotice,
  computeConsentForUser,
  getCachedConsentState,
  invalidateConsentCache,
  invalidateTenantConsentCache,
  getMyConsents,
  recordConsent,
  withdrawConsent,
  getGuardianRequest,
  respondGuardianRequest,
  signGuardianToken,
  verifyGuardianToken,
  consentCacheKey,
};
