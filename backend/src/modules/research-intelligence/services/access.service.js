/**
 * Research Intelligence access control — user-wise.
 *
 * Two layers:
 *   1. University — the platform superadmin enables the module per university
 *                   (UniversityModule, key "research_intelligence"). Independent of the
 *                   subscription plan. Disabled by default.
 *   2. User       — inside an enabled university:
 *                     - administrators (role admin / superadmin) hold every capability;
 *                     - everyone else holds exactly the rip_* keys granted to them
 *                       individually (RipUserAccess), until the grant's optional end date.
 *                   There are no role-wide or department-wide grants.
 */

'use strict';

const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const { ALL_RIP_PERMISSION_KEYS, RIP_PERMISSION_DEFINITIONS, RIP_PRESETS } = require('../config/ripPermissions');
const { RESEARCHER_SELECT, displayName } = require('./researchData');

const MODULE_KEY = 'research_intelligence';
const CACHE_TTL_MS = 60 * 1000;
const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const FILTERABLE_ROLES = ['faculty', 'staff', 'student', 'admin'];
const MAX_BULK = 200;

// Module state per tenant, cached briefly (per process; changes apply within a minute everywhere).
const moduleCache = new Map();

const invalidate = (universityId) => moduleCache.delete(universityId);

async function getModuleState(universityId) {
  const hit = moduleCache.get(universityId);
  if (hit && hit.at > Date.now() - CACHE_TTL_MS) return hit.state;
  const row = await tenantContext.runAsSystem(async () =>
    prisma.universityModule.findFirst({ where: { universityId, moduleKey: MODULE_KEY } })
  );
  const state = { enabled: !!row?.enabled, enabledAt: row?.enabledAt || null };
  moduleCache.set(universityId, { at: Date.now(), state });
  return state;
}

const noAccess = () => Object.fromEntries(ALL_RIP_PERMISSION_KEYS.map((k) => [k, false]));

/**
 * Effective Research Intelligence access for a user in a university.
 * @returns {Promise<{ enabled: boolean, permissions: Record<string, boolean>, source: 'admin'|'grant'|'none' }>}
 */
async function resolveAccess(user, universityId) {
  const mod = await getModuleState(universityId);
  if (!mod.enabled) return { enabled: false, permissions: noAccess(), source: 'none' };

  if (ADMIN_ROLES.has(user.role)) {
    return { enabled: true, permissions: Object.fromEntries(ALL_RIP_PERMISSION_KEYS.map((k) => [k, true])), source: 'admin' };
  }
  const grant = await prisma.ripUserAccess.findFirst({ where: { userId: user.id }, select: { permissions: true, expiresAt: true } });
  const active = grant && (!grant.expiresAt || grant.expiresAt > new Date());
  const held = new Set(active ? grant.permissions : []);
  return {
    enabled: true,
    permissions: Object.fromEntries(ALL_RIP_PERMISSION_KEYS.map((k) => [k, held.has(k)])),
    source: held.size ? 'grant' : 'none',
  };
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/** Resolve access once per request; 403 when the university does not have the module. */
const requireModule = async (req, res, next) => {
  try {
    req.ripAccess = await resolveAccess(req.user, req.tenantId);
    if (!req.ripAccess.enabled) {
      return res.status(403).json({
        success: false,
        code: 'RIP_MODULE_DISABLED',
        message: 'Research Intelligence is not enabled for your university. Please contact the platform administrator.',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

const requireCapability = (key) => (req, res, next) => {
  if (req.ripAccess?.permissions?.[key]) return next();
  return res.status(403).json({
    success: false,
    code: 'RIP_PERMISSION_REQUIRED',
    requiredPermission: key,
    message: 'You do not have access to this part of Research Intelligence. Ask your university administrator to grant it.',
  });
};

// ─── University administration (tenant scope) ────────────────────────────────

const cleanKeys = (keys) => {
  if (!Array.isArray(keys)) throw new ValidationError('permissions must be an array');
  const bad = keys.filter((k) => !ALL_RIP_PERMISSION_KEYS.includes(k));
  if (bad.length) throw new ValidationError(`Unknown permissions: ${bad.join(', ')}`);
  return [...new Set(keys)];
};

const parseExpiry = (expiresAt) => {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime()) || d < new Date()) throw new ValidationError('The end date must be in the future');
  return d;
};

const assertMayGrant = (actor, keys) => {
  if (keys.includes('rip_manage_access') && !ADMIN_ROLES.has(actor.role)) {
    throw new ForbiddenError('Only university administrators can grant access management.');
  }
};

/** Light summary for the access screen header. */
async function getOverview(universityId) {
  const mod = await getModuleState(universityId);
  const now = new Date();
  const [withAccess, expired, admins] = await Promise.all([
    prisma.ripUserAccess.count({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    prisma.ripUserAccess.count({ where: { expiresAt: { lte: now } } }),
    prisma.userLogin.count({ where: { status: 'active', role: { in: ['admin'] } } }),
  ]);
  return {
    enabled: mod.enabled,
    enabledAt: mod.enabledAt,
    summary: { withAccess, expired, admins },
    capabilities: RIP_PERMISSION_DEFINITIONS,
    presets: RIP_PRESETS,
    roles: FILTERABLE_ROLES,
  };
}

const personName = (u) => {
  if (u.employeeDetails) return displayName(u);
  const s = u.studentLogin;
  return (s && (s.displayName || [s.firstName, s.lastName].filter(Boolean).join(' '))) || u.uid;
};

/**
 * Users of the university with their Research Intelligence access, for the management table.
 * @param {{ q?: string, role?: string, access?: 'all'|'with'|'without'|'expired', page?: number, pageSize?: number }} f
 */
async function listUsers({ q, role, access = 'all', page = 1, pageSize = 20 } = {}) {
  const take = Math.max(1, Math.min(Number(pageSize) || 20, 100));
  const pageNo = Math.max(1, Number(page) || 1);
  const now = new Date();
  const and = [{ status: 'active' }, { role: { in: FILTERABLE_ROLES } }];
  if (role && FILTERABLE_ROLES.includes(role)) and.push({ role });
  const text = String(q || '').trim();
  if (text.length >= 2) {
    const name = (field) => ({ [field]: { is: { OR: [{ displayName: { contains: text, mode: 'insensitive' } }, { firstName: { contains: text, mode: 'insensitive' } }, { lastName: { contains: text, mode: 'insensitive' } }] } } });
    and.push({ OR: [{ uid: { contains: text, mode: 'insensitive' } }, { email: { contains: text, mode: 'insensitive' } }, name('employeeDetails'), name('studentLogin')] });
  }
  if (access === 'with') and.push({ ripAccess: { is: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } });
  else if (access === 'expired') and.push({ ripAccess: { is: { expiresAt: { lte: now } } } });
  else if (access === 'without') and.push({ OR: [{ ripAccess: { is: null } }, { ripAccess: { is: { expiresAt: { lte: now } } } }] });

  const where = { AND: and };
  const [total, rows] = await Promise.all([
    prisma.userLogin.count({ where }),
    prisma.userLogin.findMany({
      where,
      orderBy: [{ role: 'asc' }, { uid: 'asc' }],
      skip: (pageNo - 1) * take,
      take,
      select: {
        ...RESEARCHER_SELECT,
        email: true,
        role: true,
        studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
        ripAccess: { select: { permissions: true, expiresAt: true, note: true, updatedAt: true, grantedById: true } },
      },
    }),
  ]);
  const granterIds = [...new Set(rows.map((r) => r.ripAccess?.grantedById).filter(Boolean))];
  const granters = granterIds.length ? await prisma.userLogin.findMany({ where: { id: { in: granterIds } }, select: RESEARCHER_SELECT }) : [];
  const granterName = new Map(granters.map((g) => [g.id, displayName(g)]));

  return {
    total,
    page: pageNo,
    pageSize: take,
    items: rows.map((u) => {
      const g = u.ripAccess;
      const isAdmin = ADMIN_ROLES.has(u.role);
      const expired = !!(g?.expiresAt && g.expiresAt <= now);
      return {
        userId: u.id,
        name: personName(u),
        uid: u.uid,
        email: u.email,
        role: u.role,
        department: u.employeeDetails?.primaryDepartment?.departmentName || null,
        designation: u.employeeDetails?.designation || null,
        isAdmin,
        permissions: isAdmin ? ALL_RIP_PERMISSION_KEYS : expired ? [] : g?.permissions || [],
        grantedPermissions: g?.permissions || [],
        expiresAt: g?.expiresAt || null,
        expired,
        note: g?.note || null,
        grantedBy: g?.grantedById ? granterName.get(g.grantedById) || null : null,
        updatedAt: g?.updatedAt || null,
      };
    }),
  };
}

/** Create, replace or clear one user's grant. Returns the saved state. */
async function setGrant(actor, userId, { permissions, expiresAt, note } = {}) {
  const keys = cleanKeys(permissions || []);
  assertMayGrant(actor, keys);
  const user = await prisma.userLogin.findFirst({ where: { id: userId }, select: { id: true, uid: true, email: true, role: true } });
  if (!user) throw new NotFoundError('User not found in this university');
  if (ADMIN_ROLES.has(user.role)) throw new ValidationError('Administrators already have full access; grants are not needed.');

  if (!keys.length) {
    await prisma.ripUserAccess.deleteMany({ where: { userId } });
    return { user, permissions: [], expiresAt: null };
  }
  const data = { permissions: keys, expiresAt: parseExpiry(expiresAt), note: note ? String(note).slice(0, 256) : null, grantedById: actor.id };
  const existing = await prisma.ripUserAccess.findFirst({ where: { userId }, select: { id: true } });
  const row = existing
    ? await prisma.ripUserAccess.update({ where: { id: existing.id }, data })
    : await prisma.ripUserAccess.create({ data: { userId, ...data } });
  return { user, permissions: row.permissions, expiresAt: row.expiresAt };
}

/**
 * Apply one change to many users.
 * @param {'replace'|'add'|'remove'} mode replace = set exactly these keys; add = union; remove = subtract
 * @returns {Promise<{ updated: object[], skipped: { userId: string, reason: string }[] }>}
 */
async function bulkSet(actor, { userIds, permissions, mode = 'add', expiresAt, note } = {}) {
  if (!Array.isArray(userIds) || !userIds.length) throw new ValidationError('Select at least one user');
  if (userIds.length > MAX_BULK) throw new ValidationError(`You can change at most ${MAX_BULK} users at once`);
  if (!['replace', 'add', 'remove'].includes(mode)) throw new ValidationError('mode must be replace, add or remove');
  const keys = cleanKeys(permissions || []);
  if (mode !== 'replace' && !keys.length) throw new ValidationError('Choose at least one capability');
  assertMayGrant(actor, keys);
  const expires = parseExpiry(expiresAt);

  const users = await prisma.userLogin.findMany({
    where: { id: { in: userIds } },
    select: { id: true, uid: true, email: true, role: true, ripAccess: { select: { id: true, permissions: true, expiresAt: true } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const updated = [];
  const skipped = [];
  for (const id of userIds) {
    const u = byId.get(id);
    if (!u) { skipped.push({ userId: id, reason: 'Not found' }); continue; }
    if (ADMIN_ROLES.has(u.role)) { skipped.push({ userId: id, reason: 'Administrator (already full access)' }); continue; }
    const g = u.ripAccess;
    const live = g && (!g.expiresAt || g.expiresAt > new Date()) ? g.permissions : [];
    const next = mode === 'replace' ? keys : mode === 'add' ? [...new Set([...live, ...keys])] : live.filter((k) => !keys.includes(k));
    if (!next.length) {
      if (g) await prisma.ripUserAccess.deleteMany({ where: { userId: id } });
      updated.push({ user: u, permissions: [], expiresAt: null });
      continue;
    }
    const data = { permissions: next, grantedById: actor.id, ...(mode === 'remove' ? { expiresAt: g?.expiresAt || null } : { expiresAt: expires }), ...(note ? { note: String(note).slice(0, 256) } : {}) };
    const row = g
      ? await prisma.ripUserAccess.update({ where: { id: g.id }, data })
      : await prisma.ripUserAccess.create({ data: { userId: id, ...data } });
    updated.push({ user: u, permissions: row.permissions, expiresAt: row.expiresAt });
  }
  return { updated, skipped };
}

// ─── Platform administration (superadmin, cross-tenant) ───────────────────────

async function listUniversityModules() {
  return tenantContext.runAsSystem(async () => {
    const [universities, modules, grantCounts] = await Promise.all([
      prisma.university.findMany({ select: { id: true, code: true, name: true, isActive: true }, orderBy: { name: 'asc' } }),
      prisma.universityModule.findMany({ where: { moduleKey: MODULE_KEY } }),
      prisma.ripUserAccess.groupBy({ by: ['universityId'], _count: { _all: true } }),
    ]);
    const modBy = new Map(modules.map((m) => [m.universityId, m]));
    const grantsBy = new Map(grantCounts.map((g) => [g.universityId, g._count._all]));
    return universities.map((u) => {
      const m = modBy.get(u.id);
      return {
        universityId: u.id,
        code: u.code,
        name: u.name,
        universityActive: u.isActive,
        enabled: !!m?.enabled,
        enabledAt: m?.enabledAt || null,
        disabledAt: m?.disabledAt || null,
        notes: m?.notes || null,
        userGrants: grantsBy.get(u.id) || 0,
      };
    });
  });
}

async function setUniversityModule(actor, universityId, { enabled, notes }) {
  if (typeof enabled !== 'boolean') throw new ValidationError('enabled must be true or false');
  const result = await tenantContext.runAsSystem(async () => {
    const uni = await prisma.university.findFirst({ where: { id: universityId }, select: { id: true, name: true } });
    if (!uni) throw new NotFoundError('University not found');
    const now = new Date();
    const data = {
      enabled,
      notes: notes !== undefined ? (notes ? String(notes).slice(0, 512) : null) : undefined,
      ...(enabled ? { enabledAt: now, enabledById: actor.id, disabledAt: null } : { disabledAt: now }),
    };
    const row = await prisma.universityModule.upsert({
      where: { universityId_moduleKey: { universityId, moduleKey: MODULE_KEY } },
      update: data,
      create: { universityId, moduleKey: MODULE_KEY, ...data },
    });
    return { university: uni, module: row };
  });
  invalidate(universityId);
  return result;
}

/** Ids of universities with the module enabled (for nightly jobs). */
const enabledUniversityIds = () =>
  tenantContext.runAsSystem(async () =>
    (await prisma.universityModule.findMany({ where: { moduleKey: MODULE_KEY, enabled: true }, select: { universityId: true } })).map((m) => m.universityId)
  );

module.exports = {
  MODULE_KEY,
  resolveAccess,
  getModuleState,
  requireModule,
  requireCapability,
  getOverview,
  listUsers,
  setGrant,
  bulkSet,
  listUniversityModules,
  setUniversityModule,
  enabledUniversityIds,
  invalidate,
};
