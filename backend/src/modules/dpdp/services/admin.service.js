/**
 * @module dpdp/services/admin
 * @description DPO/admin functions: notices, overview, DPO contact, public privacy page.
 */
const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { AppError, NotFoundError } = require('../../../shared/utils/AppError');
const { OPEN_REQUEST_STATUSES, DEFAULT_NOTICE } = require('../dpdp.constants');
const { noticePurposes } = require('../dpdp.utils');
const { dpdpAudit, AuditActionType } = require('./dpdpAudit.service');
const consentService = require('./consent.service');

const CONTACT_SELECT = { id: true, name: true, slug: true, dpoName: true, dpoEmail: true, dpoPhone: true, requireGuardianConsentForMinors: true };

// ── notices ──────────────────────────────────────────────────────────────────

const loadUniversity = (tenantId) => (tenantId
  ? prisma.university.findUnique({ where: { id: tenantId }, select: CONTACT_SELECT })
  : null);

/** Tenant notices + platform notices (both visible to a tenant). */
const listNotices = async (tenantId) => {
  const rows = await prisma.consentNotice.findMany({
    where: tenantId ? { OR: [{ universityId: tenantId }, { universityId: null }] } : { universityId: null },
    orderBy: [{ universityId: 'asc' }, { createdAt: 'desc' }],
  });
  const university = await loadUniversity(tenantId);
  return rows.map((n) => consentService.toNoticeDto(n, university, { raw: true }));
};

const createNotice = async ({ req, tenantId, version, language = 'en', title, content, purposes }) => {
  const keys = purposes.map((p) => p.key);
  if (new Set(keys).size !== keys.length) throw new AppError('Purpose keys must be unique', 400);
  if (!purposes.some((p) => p.required)) throw new AppError('At least one purpose must be required (the core service)', 400);
  const dup = await prisma.consentNotice.findFirst({ where: { universityId: tenantId || null, version, language }, select: { id: true } });
  if (dup) throw new AppError(`Notice version ${version} (${language}) already exists`, 409);
  const notice = await prisma.consentNotice.create({
    data: {
      universityId: tenantId || null,
      version,
      language,
      title,
      content,
      purposes: purposes.map((p) => ({ key: p.key, label: p.label, description: p.description || '', required: !!p.required })),
      isActive: false,
      createdById: req.user.id,
    },
  });
  await dpdpAudit({
    req,
    action: 'DPDP privacy notice created',
    actionType: AuditActionType.CREATE,
    category: 'notice',
    targetTable: 'consent_notices',
    targetId: notice.id,
    details: { version, language, scope: tenantId ? 'university' : 'platform', purposes: keys },
  });
  return consentService.toNoticeDto(notice, await loadUniversity(tenantId));
};

/** Activate a notice; others of the same scope + language are deactivated. Users must re-consent. */
const activateNotice = async ({ req, tenantId, id }) => {
  const notice = await prisma.consentNotice.findFirst({ where: { id, universityId: tenantId || null } });
  if (!notice) throw new NotFoundError('Notice (only notices of your own university can be activated)');
  const activated = await prisma.$transaction(async (tx) => {
    await tx.consentNotice.updateMany({
      where: { universityId: notice.universityId, language: notice.language, isActive: true, NOT: { id } },
      data: { isActive: false },
    });
    return tx.consentNotice.update({ where: { id }, data: { isActive: true, effectiveFrom: new Date() } });
  });
  // every user of this tenant (or every tenant, for a platform notice) must see the new notice
  if (tenantId) await consentService.invalidateTenantConsentCache();
  else await tenantContext.runAsSystem(() => require('../../../shared/config/redis').delPattern('t:*:dpdp:consent:*'));
  await dpdpAudit({
    req,
    action: 'DPDP privacy notice activated',
    actionType: AuditActionType.STATUS_CHANGE,
    category: 'notice',
    targetTable: 'consent_notices',
    targetId: id,
    details: { version: activated.version, language: activated.language, scope: tenantId ? 'university' : 'platform' },
  });
  return consentService.toNoticeDto(activated, await loadUniversity(tenantId));
};

// ── overview ─────────────────────────────────────────────────────────────────

const getOverview = async (tenantId) => {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600 * 1000);
  const notice = await consentService.getActiveNotice(tenantId);
  const required = noticePurposes(notice).filter((p) => p.required).map((p) => p.key);

  const [openRequests, overdueRequests, openBreaches, breachesDueSoon, users, grantGroups] = await Promise.all([
    prisma.dataPrincipalRequest.count({ where: { status: { in: OPEN_REQUEST_STATUSES } } }),
    prisma.dataPrincipalRequest.count({ where: { status: { in: OPEN_REQUEST_STATUSES }, dueAt: { lt: now } } }),
    prisma.dataBreachIncident.count({ where: { status: { not: 'closed' } } }),
    prisma.dataBreachIncident.count({ where: { status: { not: 'closed' }, boardNotifiedAt: null, boardReportDueAt: { lt: soon } } }),
    prisma.userLogin.count({ where: { status: 'active', anonymizedAt: null, role: { not: 'superadmin' } } }),
    notice && required.length
      ? prisma.consentRecord.groupBy({
        by: ['userId'],
        where: { noticeId: notice.id, purpose: { in: required }, granted: true, withdrawnAt: null },
        _count: { _all: true },
      })
      : Promise.resolve([]),
  ]);
  const consented = grantGroups.filter((g) => g._count._all >= required.length).length;
  return {
    openRequests,
    overdueRequests,
    openBreaches,
    breachesDueSoon,
    consentCoverage: { users, consented },
    activeNotice: notice ? { id: notice.id, version: notice.version, title: notice.title, isPlatformDefault: notice.universityId === null } : null,
    scope: tenantId ? 'university' : 'platform',
  };
};

// ── contact ──────────────────────────────────────────────────────────────────

const toContactDto = (u) => ({
  universityId: u?.id || null,
  universityName: u?.name || null,
  universitySlug: u?.slug || null,
  dpoName: u?.dpoName || null,
  dpoEmail: u?.dpoEmail || null,
  dpoPhone: u?.dpoPhone || null,
  requireGuardianConsentForMinors: u ? u.requireGuardianConsentForMinors !== false : true,
});

const getContact = async (tenantId) => toContactDto(await loadUniversity(tenantId));

const updateContact = async ({ req, tenantId, dpoName, dpoEmail, dpoPhone, requireGuardianConsentForMinors }) => {
  if (!tenantId) throw new AppError('Select a university first (X-University-Id) to set its DPO contact', 400);
  const data = {};
  if (dpoName !== undefined) data.dpoName = dpoName || null;
  if (dpoEmail !== undefined) data.dpoEmail = dpoEmail || null;
  if (dpoPhone !== undefined) data.dpoPhone = dpoPhone || null;
  if (requireGuardianConsentForMinors !== undefined) data.requireGuardianConsentForMinors = requireGuardianConsentForMinors;
  const updated = await prisma.university.update({ where: { id: tenantId }, data, select: CONTACT_SELECT });
  if (requireGuardianConsentForMinors !== undefined) await consentService.invalidateTenantConsentCache();
  await dpdpAudit({
    req,
    action: 'DPDP DPO contact / guardian policy updated',
    actionType: AuditActionType.CONFIG_CHANGE,
    category: 'contact',
    targetTable: 'universities',
    targetId: tenantId,
    details: { fields: Object.keys(data), requireGuardianConsentForMinors },
  });
  return toContactDto(updated);
};

/** Public privacy page by slug (no auth, no tenant context). */
const getPublicPrivacy = async (slug) => {
  const university = await prisma.university.findUnique({ where: { slug }, select: { ...CONTACT_SELECT, isActive: true } });
  if (!university || !university.isActive) throw new NotFoundError('University');
  const notice = await consentService.getActiveNotice(university.id);
  return {
    universityName: university.name,
    notice: consentService.toNoticeDto(notice, university),
    dpo: { name: university.dpoName || null, email: university.dpoEmail || null, phone: university.dpoPhone || null },
    requireGuardianConsentForMinors: university.requireGuardianConsentForMinors !== false,
  };
};

module.exports = {
  DEFAULT_NOTICE,
  listNotices,
  createNotice,
  activateNotice,
  getOverview,
  getContact,
  updateContact,
  getPublicPrivacy,
};
