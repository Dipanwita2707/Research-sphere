/**
 * Research Intelligence access control.
 *
 * Two layers:
 *   1. University  — the platform superadmin enables the module per university
 *                    (UniversityModule, key "research_intelligence"). Independent of the
 *                    subscription plan. Disabled by default.
 *   2. User        — inside an enabled university a user holds a capability (rip_* key) if any of:
 *                      - role admin / superadmin
 *                      - a direct per-user grant (RipUserAccess), not expired
 *                      - an existing DRD central-department or role permission assignment
 *                      - the university's role defaults (module settings.roleDefaults[role])
 */

'use strict';

const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { getDefaultPermissions, getPermissionKeyVariants } = require('../../../shared/config/permissions.config');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const { ALL_RIP_PERMISSION_KEYS, RIP_ROLE_DEFAULTABLE_KEYS } = require('../config/ripPermissions');
const { RESEARCHER_SELECT, displayName } = require('./researchData');

const MODULE_KEY = 'research_intelligence';
const CACHE_TTL_MS = 60 * 1000;
const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const DEFAULTABLE_ROLES = ['faculty', 'staff', 'student'];

// Module state per tenant, cached briefly (per process; changes apply within a minute everywhere).
const moduleCache = new Map();

const invalidate = (universityId) => moduleCache.delete(universityId);

async function getModuleState(universityId) {
  const hit = moduleCache.get(universityId);
  if (hit && hit.at > Date.now() - CACHE_TTL_MS) return hit.state;
  const row = await tenantContext.runAsSystem(() =>
    prisma.universityModule.findFirst({ where: { universityId, moduleKey: MODULE_KEY } })
  );
  const state = {
    enabled: !!row?.enabled,
    settings: row?.settings && typeof row.settings === 'object' ? row.settings : {},
    enabledAt: row?.enabledAt || null,
  };
  moduleCache.set(universityId, { at: Date.now(), state });
  return state;
}

const noAccess = () => Object.fromEntries(ALL_RIP_PERMISSION_KEYS.map((k) => [k, false]));

/** Existing permission sources: role defaults from config + DRD/school/role assignments. */
const hasAssignedPermission = (user, key) => {
  const variants = getPermissionKeyVariants(key);
  const defaults = getDefaultPermissions(user.role);
  if (variants.some((v) => defaults[v] === true)) return true;
  return [...(user.centralDeptPermissions || []), ...(user.schoolDeptPermissions || [])].some(
    (d) => d.permissions && variants.some((v) => d.permissions[v] === true)
  );
};

/**
 * Effective Research Intelligence access for a user in a university.
 * @returns {Promise<{ enabled: boolean, permissions: Record<string, boolean>, sources: Record<string, string[]> }>}
 */
async function resolveAccess(user, universityId) {
  const mod = await getModuleState(universityId);
  if (!mod.enabled) return { enabled: false, permissions: noAccess(), sources: {} };

  const sources = {};
  const add = (key, source) => {
    if (!ALL_RIP_PERMISSION_KEYS.includes(key)) return;
    (sources[key] = sources[key] || []).push(source);
  };

  if (ADMIN_ROLES.has(user.role)) ALL_RIP_PERMISSION_KEYS.forEach((k) => add(k, 'admin'));

  const grant = await prisma.ripUserAccess.findFirst({ where: { userId: user.id }, select: { permissions: true, expiresAt: true } });
  if (grant && (!grant.expiresAt || grant.expiresAt > new Date())) grant.permissions.forEach((k) => add(k, 'grant'));

  for (const k of ALL_RIP_PERMISSION_KEYS) if (!ADMIN_ROLES.has(user.role) && hasAssignedPermission(user, k)) add(k, 'assignment');

  const roleDefaults = mod.settings.roleDefaults?.[user.role];
  if (Array.isArray(roleDefaults)) roleDefaults.filter((k) => RIP_ROLE_DEFAULTABLE_KEYS.includes(k)).forEach((k) => add(k, 'role_default'));

  return {
    enabled: true,
    permissions: Object.fromEntries(ALL_RIP_PERMISSION_KEYS.map((k) => [k, !!sources[k]])),
    sources,
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

const cleanKeys = (keys, allowed) => {
  if (!Array.isArray(keys)) throw new ValidationError('permissions must be an array');
  const bad = keys.filter((k) => !allowed.includes(k));
  if (bad.length) throw new ValidationError(`Unknown or non-grantable permissions: ${bad.join(', ')}`);
  return [...new Set(keys)];
};

async function listGrants() {
  const rows = await prisma.ripUserAccess.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { user: { select: { ...RESEARCHER_SELECT, email: true, role: true } } },
  });
  const granterIds = [...new Set(rows.map((r) => r.grantedById).filter(Boolean))];
  const granters = granterIds.length ? await prisma.userLogin.findMany({ where: { id: { in: granterIds } }, select: RESEARCHER_SELECT }) : [];
  const granterName = new Map(granters.map((g) => [g.id, displayName(g)]));
  return rows.map((r) => ({
    userId: r.userId,
    name: displayName(r.user),
    uid: r.user.uid,
    email: r.user.email,
    role: r.user.role,
    department: r.user.employeeDetails?.primaryDepartment?.departmentName || null,
    permissions: r.permissions,
    expiresAt: r.expiresAt,
    expired: !!(r.expiresAt && r.expiresAt < new Date()),
    note: r.note,
    grantedBy: r.grantedById ? granterName.get(r.grantedById) || null : null,
    updatedAt: r.updatedAt,
  }));
}

/** Users of the university matching a search, for the grant picker. */
async function searchCandidates(q, take = 15) {
  const t = String(q || '').trim();
  if (t.length < 2) return [];
  const users = await prisma.userLogin.findMany({
    where: {
      status: 'active',
      OR: [
        { uid: { contains: t, mode: 'insensitive' } },
        { email: { contains: t, mode: 'insensitive' } },
        { employeeDetails: { is: { OR: [{ displayName: { contains: t, mode: 'insensitive' } }, { firstName: { contains: t, mode: 'insensitive' } }, { lastName: { contains: t, mode: 'insensitive' } }] } } },
        { studentLogin: { is: { OR: [{ displayName: { contains: t, mode: 'insensitive' } }, { firstName: { contains: t, mode: 'insensitive' } }, { lastName: { contains: t, mode: 'insensitive' } }] } } },
      ],
    },
    select: {
      ...RESEARCHER_SELECT,
      email: true,
      role: true,
      studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
      ripAccess: { select: { permissions: true } },
    },
    take,
  });
  return users.map((u) => {
    const s = u.studentLogin;
    const studentName = s ? s.displayName || [s.firstName, s.lastName].filter(Boolean).join(' ') : null;
    return {
      userId: u.id,
      name: u.employeeDetails ? displayName(u) : studentName || u.uid,
      uid: u.uid,
      email: u.email,
      role: u.role,
      department: u.employeeDetails?.primaryDepartment?.departmentName || null,
      currentPermissions: u.ripAccess?.permissions || [],
    };
  });
}

/**
 * Create, replace or clear a user's direct grant. Only admins may hand out rip_manage_access.
 * @param {object} actor  req.user
 */
async function setGrant(actor, userId, { permissions, expiresAt, note } = {}) {
  const keys = cleanKeys(permissions || [], ALL_RIP_PERMISSION_KEYS);
  if (keys.includes('rip_manage_access') && !ADMIN_ROLES.has(actor.role)) {
    throw new ForbiddenError('Only university administrators can grant access management.');
  }
  const user = await prisma.userLogin.findFirst({ where: { id: userId }, select: { id: true, uid: true, email: true } });
  if (!user) throw new NotFoundError('User not found in this university');

  if (!keys.length) {
    await prisma.ripUserAccess.deleteMany({ where: { userId } });
    return { user, permissions: [] };
  }
  let expires = null;
  if (expiresAt) {
    expires = new Date(expiresAt);
    if (Number.isNaN(expires.getTime()) || expires < new Date()) throw new ValidationError('expiresAt must be a future date');
  }
  const data = { permissions: keys, expiresAt: expires, note: note ? String(note).slice(0, 256) : null, grantedById: actor.id };
  const existing = await prisma.ripUserAccess.findFirst({ where: { userId }, select: { id: true } });
  const row = existing
    ? await prisma.ripUserAccess.update({ where: { id: existing.id }, data })
    : await prisma.ripUserAccess.create({ data: { userId, ...data } });
  return { user, permissions: row.permissions, expiresAt: row.expiresAt };
}

async function getSettings(universityId) {
  const mod = await getModuleState(universityId);
  return { enabled: mod.enabled, enabledAt: mod.enabledAt, roleDefaults: mod.settings.roleDefaults || {} };
}

async function updateRoleDefaults(universityId, roleDefaults) {
  if (!roleDefaults || typeof roleDefaults !== 'object') throw new ValidationError('roleDefaults must be an object');
  const clean = {};
  for (const role of DEFAULTABLE_ROLES) {
    if (roleDefaults[role] !== undefined) clean[role] = cleanKeys(roleDefaults[role], RIP_ROLE_DEFAULTABLE_KEYS);
  }
  const row = await prisma.universityModule.findFirst({ where: { universityId, moduleKey: MODULE_KEY } });
  if (!row?.enabled) throw new ForbiddenError('Research Intelligence is not enabled for this university');
  await prisma.universityModule.update({ where: { id: row.id }, data: { settings: { ...(row.settings || {}), roleDefaults: clean } } });
  invalidate(universityId);
  return { roleDefaults: clean };
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
  DEFAULTABLE_ROLES,
  resolveAccess,
  getModuleState,
  requireModule,
  requireCapability,
  listGrants,
  searchCandidates,
  setGrant,
  getSettings,
  updateRoleDefaults,
  listUniversityModules,
  setUniversityModule,
  enabledUniversityIds,
  invalidate,
};
