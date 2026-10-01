/**
 * Research Intelligence access control — role-based, with individual exceptions.
 *
 * Two layers:
 *   1. University — the platform superadmin enables the module per university
 *                   (UniversityModule, key "research_intelligence"). Independent of the
 *                   subscription plan. Disabled by default.
 *   2. People     — inside an enabled university a user holds a capability (rip_* key) when:
 *                     - they are an administrator (everything), or
 *                     - a Role assigned to them contains the key. Roles are the university's
 *                       reusable permission templates (Roles page); they are assigned to
 *                       employees through user.assignedRoleIds like every other role, or
 *                     - they hold an individual extra grant (RipUserAccess), optionally
 *                       time-limited. Meant for exceptions, not as the main mechanism.
 *
 * This module only ever assigns roles that contain Research Intelligence keys and nothing else
 * ("assignable" roles), so holding rip_manage_access cannot be used to hand out other privileges.
 */

'use strict';

const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { ValidationError, ForbiddenError, NotFoundError, ConflictError } = require('../../../shared/utils/AppError');
const { ALL_RIP_PERMISSION_KEYS, RIP_PERMISSION_DEFINITIONS, RIP_TEMPLATES } = require('../config/ripPermissions');
const { RESEARCHER_SELECT, displayName } = require('./researchData');

const MODULE_KEY = 'research_intelligence';
const CACHE_TTL_MS = 60 * 1000;
const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const FILTERABLE_ROLES = ['faculty', 'staff', 'student', 'admin'];
const MAX_BULK = 200;
const RIP_KEYS = new Set(ALL_RIP_PERMISSION_KEYS);

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
const allAccess = () => Object.fromEntries(ALL_RIP_PERMISSION_KEYS.map((k) => [k, true]));

const trueKeys = (obj) => Object.keys(obj || {}).filter((k) => obj[k] === true);
const ripKeysOf = (perms) => trueKeys(perms).filter((k) => RIP_KEYS.has(k));

/**
 * Effective Research Intelligence access for a signed-in user (req.user already carries the
 * permissions of their assigned roles as department-permission entries; see middleware/auth.js).
 * @returns {Promise<{ enabled: boolean, permissions: Record<string, boolean>, source: 'admin'|'role'|'grant'|'none', roles: string[] }>}
 */
async function resolveAccess(user, universityId) {
  const mod = await getModuleState(universityId);
  if (!mod.enabled) return { enabled: false, permissions: noAccess(), source: 'none', roles: [] };
  if (ADMIN_ROLES.has(user.role)) return { enabled: true, permissions: allAccess(), source: 'admin', roles: [] };

  const held = new Set();
  const roleNames = new Set();
  for (const entry of [...(user.centralDeptPermissions || []), ...(user.schoolDeptPermissions || [])]) {
    const keys = ripKeysOf(entry.permissions);
    keys.forEach((k) => held.add(k));
    if (keys.length && entry.fromRole && entry.roleName) roleNames.add(entry.roleName);
  }
  const viaRole = held.size > 0;

  const grant = await prisma.ripUserAccess.findFirst({ where: { userId: user.id }, select: { permissions: true, expiresAt: true } });
  const grantActive = grant && (!grant.expiresAt || grant.expiresAt > new Date());
  if (grantActive) grant.permissions.forEach((k) => RIP_KEYS.has(k) && held.add(k));

  return {
    enabled: true,
    permissions: Object.fromEntries(ALL_RIP_PERMISSION_KEYS.map((k) => [k, held.has(k)])),
    source: viaRole ? 'role' : held.size ? 'grant' : 'none',
    roles: [...roleNames],
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

// ─── Roles (the reusable templates) ───────────────────────────────────────────

/**
 * Active roles of the university that grant at least one Research Intelligence key.
 * `assignable` = the role contains Research Intelligence keys and nothing else.
 */
async function loadRipRoles() {
  const roles = await prisma.role.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  return roles
    .map((r) => {
      const p = r.permissions || {};
      const central = trueKeys(p.centralDeptPermissions);
      const school = trueKeys(p.schoolDeptPermissions);
      const rip = [...new Set([...central, ...school].filter((k) => RIP_KEYS.has(k)))];
      const other = [...central, ...school].filter((k) => !RIP_KEYS.has(k));
      return { id: r.id, name: r.name, roleCode: r.roleCode, description: r.description || null, permissions: rip, otherPermissionCount: other.length, assignable: rip.length > 0 && other.length === 0 };
    })
    .filter((r) => r.permissions.length > 0);
}

const sameSet = (a, b) => a.length === b.length && a.every((k) => b.includes(k));

/** Summary for the access screen: counts, capability catalog, role templates and existing roles. */
async function getOverview(universityId) {
  const mod = await getModuleState(universityId);
  const now = new Date();
  const roles = await loadRipRoles();
  const [extraActive, extraExpired, admins, ...counts] = await Promise.all([
    prisma.ripUserAccess.count({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    prisma.ripUserAccess.count({ where: { expiresAt: { lte: now } } }),
    prisma.userLogin.count({ where: { status: 'active', role: 'admin' } }),
    ...roles.map((r) => prisma.userLogin.count({ where: { status: 'active', assignedRoleIds: { array_contains: r.id } } })),
  ]);
  const withRoles = roles.map((r, i) => ({ ...r, assignedCount: counts[i] }));
  return {
    enabled: mod.enabled,
    enabledAt: mod.enabledAt,
    summary: { extraGrants: extraActive, extraExpired, admins, assigned: withRoles.reduce((s, r) => s + r.assignedCount, 0) },
    capabilities: RIP_PERMISSION_DEFINITIONS,
    templates: RIP_TEMPLATES.map((t) => ({ ...t, existingRoleId: withRoles.find((r) => r.assignable && sameSet(r.permissions, t.permissions))?.id || null })),
    roles: withRoles,
    filterRoles: FILTERABLE_ROLES,
  };
}

/** Create a real, editable Role from a template (administrators only). Reuses an identical role if one exists. */
async function createRoleFromTemplate(actor, templateKey) {
  if (!ADMIN_ROLES.has(actor.role)) throw new ForbiddenError('Only administrators can create roles.');
  const tpl = RIP_TEMPLATES.find((t) => t.key === templateKey);
  if (!tpl) throw new ValidationError('Unknown template');
  const existing = (await loadRipRoles()).find((r) => r.assignable && sameSet(r.permissions, tpl.permissions));
  if (existing) return { role: existing, created: false };

  const base = `RI_${tpl.key.toUpperCase()}`;
  for (let n = 0; n < 5; n++) {
    const roleCode = n ? `${base}_${n + 1}` : base;
    const name = n ? `Research Intelligence – ${tpl.label} (${n + 1})` : `Research Intelligence – ${tpl.label}`;
    const clash = await prisma.role.findFirst({ where: { OR: [{ roleCode }, { name }] }, select: { id: true } });
    if (clash) continue;
    const row = await prisma.role.create({
      data: {
        roleCode,
        name,
        description: tpl.description,
        departmentType: 'CENTRAL',
        requiresDepartmentAssignment: false,
        createdBy: actor.id,
        permissions: { centralDeptPermissions: Object.fromEntries(tpl.permissions.map((k) => [k, true])), schoolDeptPermissions: {} },
      },
    });
    return { role: { id: row.id, name: row.name, roleCode: row.roleCode, description: row.description, permissions: tpl.permissions, otherPermissionCount: 0, assignable: true }, created: true };
  }
  throw new ConflictError('Could not find a free name for this role. Create it from the Roles page instead.');
}

// ─── People ───────────────────────────────────────────────────────────────────

const personName = (u) => {
  if (u.employeeDetails) return displayName(u);
  const s = u.studentLogin;
  return (s && (s.displayName || [s.firstName, s.lastName].filter(Boolean).join(' '))) || u.uid;
};

const asIds = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/**
 * Users of the university with where their Research Intelligence access comes from.
 * @param {{ q?: string, role?: string, roleId?: string, access?: 'all'|'with'|'without'|'expired', page?: number, pageSize?: number }} f
 */
async function listUsers({ q, role, roleId, access = 'all', page = 1, pageSize = 20 } = {}) {
  const take = Math.max(1, Math.min(Number(pageSize) || 20, 100));
  const pageNo = Math.max(1, Number(page) || 1);
  const now = new Date();
  const ripRoles = await loadRipRoles();
  const roleById = new Map(ripRoles.map((r) => [r.id, r]));

  const and = [{ status: 'active' }, { role: { in: FILTERABLE_ROLES } }];
  if (role && FILTERABLE_ROLES.includes(role)) and.push({ role });
  const text = String(q || '').trim();
  if (text.length >= 2) {
    const name = (field) => ({ [field]: { is: { OR: [{ displayName: { contains: text, mode: 'insensitive' } }, { firstName: { contains: text, mode: 'insensitive' } }, { lastName: { contains: text, mode: 'insensitive' } }] } } });
    and.push({ OR: [{ uid: { contains: text, mode: 'insensitive' } }, { email: { contains: text, mode: 'insensitive' } }, name('employeeDetails'), name('studentLogin')] });
  }
  if (roleId) {
    if (!roleById.has(roleId)) throw new ValidationError('Unknown role');
    and.push({ assignedRoleIds: { array_contains: roleId } });
  }
  const holdsRole = ripRoles.map((r) => ({ assignedRoleIds: { array_contains: r.id } }));
  const grantActive = { ripAccess: { is: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } } };
  if (access === 'with') and.push({ OR: [...holdsRole, grantActive] });
  else if (access === 'without') and.push({ NOT: { OR: [...holdsRole, grantActive] } });
  else if (access === 'expired') and.push({ ripAccess: { is: { expiresAt: { lte: now } } } });

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
        assignedRoleIds: true,
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
      const heldRoles = asIds(u.assignedRoleIds).map((id) => roleById.get(id)).filter(Boolean);
      const keys = new Set(heldRoles.flatMap((r) => r.permissions));
      if (g && !expired) g.permissions.forEach((k) => keys.add(k));
      return {
        userId: u.id,
        name: personName(u),
        uid: u.uid,
        email: u.email,
        role: u.role,
        department: u.employeeDetails?.primaryDepartment?.departmentName || null,
        designation: u.employeeDetails?.designation || null,
        isAdmin,
        roles: heldRoles.map((r) => ({ id: r.id, name: r.name, assignable: r.assignable })),
        permissions: isAdmin ? ALL_RIP_PERMISSION_KEYS : [...keys],
        extra: g
          ? { permissions: g.permissions, expiresAt: g.expiresAt, expired, note: g.note || null, grantedBy: g.grantedById ? granterName.get(g.grantedById) || null : null, updatedAt: g.updatedAt }
          : null,
      };
    }),
  };
}

const bustAuthCache = async (userId) => {
  try {
    await cache.invalidateUser(userId);
  } catch {
    // cache is best-effort; role changes still apply once the cached entry expires
  }
};

/**
 * Compute and save a user's role list: keep everything that is not an assignable Research
 * Intelligence role, then add `riRoleIds`. Other roles an administrator gave them are untouched.
 */
async function applyRoleChange(userId, nextFor) {
  const ripRoles = await loadRipRoles();
  const assignableIds = new Set(ripRoles.filter((r) => r.assignable).map((r) => r.id));
  const user = await prisma.userLogin.findFirst({ where: { id: userId }, select: { id: true, uid: true, email: true, role: true, assignedRoleIds: true } });
  if (!user) return { skipped: 'Not found' };
  if (ADMIN_ROLES.has(user.role)) return { skipped: 'Administrator (already full access)' };
  const current = asIds(user.assignedRoleIds);
  const currentRi = current.filter((id) => assignableIds.has(id));
  const nextRi = [...new Set(nextFor(currentRi))].filter((id) => assignableIds.has(id));
  const next = [...current.filter((id) => !assignableIds.has(id)), ...nextRi];
  if (sameSet(current, next)) return { user, roleIds: nextRi, unchanged: true };
  await prisma.userLogin.update({ where: { id: userId }, data: { assignedRoleIds: next, updatedAt: new Date() } });
  await bustAuthCache(userId);
  return { user, roleIds: nextRi, roleNames: ripRoles.filter((r) => nextRi.includes(r.id)).map((r) => r.name) };
}

const assertAssignable = async (roleIds) => {
  const assignable = new Map((await loadRipRoles()).filter((r) => r.assignable).map((r) => [r.id, r]));
  const bad = roleIds.filter((id) => !assignable.has(id));
  if (bad.length) throw new ValidationError('Only roles that contain Research Intelligence permissions and nothing else can be assigned here.');
};

/** Set exactly which Research Intelligence roles one person holds. */
async function setUserRoles(userId, roleIds) {
  const ids = asIds(roleIds);
  await assertAssignable(ids);
  const r = await applyRoleChange(userId, () => ids);
  if (r.skipped === 'Not found') throw new NotFoundError('User not found in this university');
  if (r.skipped) throw new ValidationError(r.skipped);
  return r;
}

/**
 * Add or remove one role for many people.
 * @returns {Promise<{ updated: object[], skipped: { userId: string, reason: string }[] }>}
 */
async function bulkRole({ userIds, roleId, mode = 'add' } = {}) {
  if (!Array.isArray(userIds) || !userIds.length) throw new ValidationError('Select at least one user');
  if (userIds.length > MAX_BULK) throw new ValidationError(`You can change at most ${MAX_BULK} users at once`);
  if (!['add', 'remove'].includes(mode)) throw new ValidationError('mode must be add or remove');
  await assertAssignable([roleId]);
  const updated = [];
  const skipped = [];
  for (const id of userIds) {
    const r = await applyRoleChange(id, (cur) => (mode === 'add' ? [...cur, roleId] : cur.filter((x) => x !== roleId)));
    if (r.skipped) skipped.push({ userId: id, reason: r.skipped });
    else updated.push(r);
  }
  return { updated, skipped };
}

// ─── Individual extra access (exceptions) ─────────────────────────────────────

const cleanKeys = (keys) => {
  if (!Array.isArray(keys)) throw new ValidationError('permissions must be an array');
  const bad = keys.filter((k) => !RIP_KEYS.has(k));
  if (bad.length) throw new ValidationError(`Unknown permissions: ${bad.join(', ')}`);
  return [...new Set(keys)];
};

const parseExpiry = (expiresAt) => {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime()) || d < new Date()) throw new ValidationError('The end date must be in the future');
  return d;
};

/** Create, replace or clear one user's extra grant. */
async function setGrant(actor, userId, { permissions, expiresAt, note } = {}) {
  const keys = cleanKeys(permissions || []);
  if (keys.includes('rip_manage_access') && !ADMIN_ROLES.has(actor.role)) {
    throw new ForbiddenError('Only university administrators can grant access management.');
  }
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
  loadRipRoles,
  createRoleFromTemplate,
  listUsers,
  setUserRoles,
  bulkRole,
  setGrant,
  listUniversityModules,
  setUniversityModule,
  enabledUniversityIds,
  invalidate,
};
