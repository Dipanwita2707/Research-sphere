/**
 * @module reviewScope
 * @description School scope of a DRD reviewer, per review category.
 *
 * The user's DRD CentralDepartmentPermission row carries one school list per category:
 *   research   → assignedResearchSchoolIds   (research_paper)
 *   book       → assignedBookSchoolIds       (book, book_chapter)
 *   conference → assignedConferenceSchoolIds (conference_paper)
 *   grant      → assignedGrantSchoolIds      (grant applications)
 *   ipr        → assignedSchoolIds           (IPR applications)
 *
 * Semantics (same for queues, counts, detail views and every DRD action):
 *   - an EMPTY list means the reviewer covers ALL schools;
 *   - a non-empty list restricts the reviewer to those schools, and items without a
 *     school (schoolId null) are then out of scope;
 *   - admins and superadmins cover all schools.
 * Role templates grant capabilities only; school lists always come from the direct DRD
 * row, so a user without one covers all schools.
 *
 * The row is cached per (tenant, user) for SCOPE_TTL_MS. Every permission/assignment
 * write path calls cache.invalidateUser(userId), which drops the entry on this process
 * and bumps a version stamp in the shared cache; other processes compare that stamp on
 * each hit (Redis) or expire the entry within SCOPE_TTL_MS (in-memory fallback).
 */

const cache = require('../../../shared/config/redis');
const tenantContext = require('../../../shared/tenancy/tenantContext');

const OUT_OF_SCOPE_CODE = 'OUT_OF_ASSIGNED_SCHOOLS';
const SCOPE_TTL_MS = 10_000;
const MAX_ENTRIES = 2000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORY_FIELDS = Object.freeze({
  research: 'assignedResearchSchoolIds',
  book: 'assignedBookSchoolIds',
  conference: 'assignedConferenceSchoolIds',
  grant: 'assignedGrantSchoolIds',
  ipr: 'assignedSchoolIds',
});

const CATEGORY_LABELS = Object.freeze({
  research: 'research paper',
  book: 'book / book chapter',
  conference: 'conference paper',
  grant: 'grant',
  ipr: 'IPR',
});

/** Publication types each research-workflow category covers. */
const CATEGORY_PUBLICATION_TYPES = Object.freeze({
  research: ['research_paper'],
  book: ['book', 'book_chapter'],
  conference: ['conference_paper'],
});

const _entries = new Map(); // `${tenant}:${userId}` → { data, loadedAt }

const getPrisma = () => require('../../../shared/config/database');
const tenantKey = () => tenantContext.getTenantId() || 'global';
const versionKey = (userId) => `drdscope:ver:${userId}`;

/** Map a research contribution publicationType (or 'grant_proposal') to its category. */
function categoryForPublicationType(publicationType) {
  if (publicationType === 'research_paper') return 'research';
  if (publicationType === 'book' || publicationType === 'book_chapter') return 'book';
  if (publicationType === 'conference_paper') return 'conference';
  if (publicationType === 'grant_proposal' || publicationType === 'grant') return 'grant';
  return 'research';
}

/** JSON column → array of distinct non-empty string ids. */
function normalizeIds(value) {
  let list = value;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))];
}

const isUniversityWide = (user) => user?.role === 'admin' || user?.role === 'superadmin';

/** Drop cached scope for one user (all tenants) on this process. */
function invalidateUser(userId) {
  if (!userId) return;
  const suffix = `:${userId}`;
  for (const key of _entries.keys()) if (key.endsWith(suffix)) _entries.delete(key);
}

/** Drop every cached scope on this process (tests). */
function clearCache() {
  _entries.clear();
}

if (typeof cache.onUserInvalidated === 'function') {
  cache.onUserInvalidated(async (userId) => {
    invalidateUser(userId);
    // Version stamp for other processes sharing Redis
    if (userId) await cache.set(versionKey(userId), Date.now(), 120);
  });
}

async function _isStale(userId, loadedAt) {
  if (Date.now() - loadedAt >= SCOPE_TTL_MS) return true;
  try {
    const stamp = await cache.get(versionKey(userId));
    return typeof stamp === 'number' && stamp >= loadedAt;
  } catch {
    return false;
  }
}

/**
 * The user's DRD permission row (permissions + per-category school lists), cached.
 * @param {string} userId
 * @param {{ db?: object }} [options] - prisma client to use (defaults to the shared one)
 * @returns {Promise<null|{permissions: object, assignedSchoolIds: string[], assignedResearchSchoolIds: string[],
 *   assignedBookSchoolIds: string[], assignedConferenceSchoolIds: string[], assignedGrantSchoolIds: string[]}>}
 */
async function loadDrdAssignment(userId, { db } = {}) {
  if (!userId) return null;
  const key = `${tenantKey()}:${userId}`;
  const hit = _entries.get(key);
  if (hit && !(await _isStale(userId, hit.loadedAt))) return hit.data;

  const client = db || getPrisma();
  const loadedAt = Date.now();
  let data = null;
  const drdDept = await client.centralDepartment.findFirst({
    where: { OR: [{ departmentCode: 'DRD' }, { departmentCode: 'drd' }, { shortName: 'DRD' }] },
    select: { id: true },
  });
  if (drdDept) {
    const row = await client.centralDepartmentPermission.findFirst({
      where: { userId, isActive: true, centralDeptId: drdDept.id },
      select: {
        permissions: true,
        assignedSchoolIds: true,
        assignedResearchSchoolIds: true,
        assignedBookSchoolIds: true,
        assignedConferenceSchoolIds: true,
        assignedGrantSchoolIds: true,
      },
    });
    if (row) {
      data = { permissions: row.permissions || {} };
      Object.values(CATEGORY_FIELDS).forEach((field) => { data[field] = normalizeIds(row[field]); });
    }
  }

  if (_entries.size >= MAX_ENTRIES) {
    const cutoff = Date.now() - SCOPE_TTL_MS;
    for (const [k, v] of _entries) if (v.loadedAt < cutoff) _entries.delete(k);
    if (_entries.size >= MAX_ENTRIES) _entries.clear();
  }
  _entries.set(key, { data, loadedAt });
  return data;
}

/** Scope of one category given an already-loaded assignment row (sync). */
function scopeFromAssignment(assignment, category) {
  const field = CATEGORY_FIELDS[category];
  if (!field) throw new Error(`Unknown review category: ${category}`);
  const schoolIds = normalizeIds(assignment?.[field]);
  return schoolIds.length > 0 ? { all: false, schoolIds } : { all: true, schoolIds: [] };
}

/**
 * The user's school scope for a category: { all: true } or { all: false, schoolIds }.
 * @param {object} user - req.user (needs id and role)
 * @param {'research'|'book'|'conference'|'grant'|'ipr'} category
 * @param {{ db?: object }} [options]
 */
async function getSchoolScope(user, category, options = {}) {
  if (!CATEGORY_FIELDS[category]) throw new Error(`Unknown review category: ${category}`);
  if (isUniversityWide(user)) return { all: true, schoolIds: [] };
  const assignment = await loadDrdAssignment(user?.id, options);
  return scopeFromAssignment(assignment, category);
}

function isSchoolInScope(scope, schoolId) {
  if (scope.all) return true;
  return schoolId != null && scope.schoolIds.includes(schoolId);
}

/** Prisma filter for a scope, or null when the scope covers all schools. */
function scopeWhere(scope, field = 'schoolId') {
  return scope.all ? null : { [field]: { in: scope.schoolIds } };
}

function outOfScopeError(category) {
  const err = new Error(`This ${CATEGORY_LABELS[category] || category} item belongs to a school outside your assigned schools`);
  err.statusCode = 403;
  err.code = OUT_OF_SCOPE_CODE;
  err.isOperational = true;
  return err;
}

/**
 * Throw 403 OUT_OF_ASSIGNED_SCHOOLS unless the user may act on an item of `schoolId`
 * in `category`.
 * @returns {Promise<object>} the scope, when allowed
 */
async function assertCanActOnSchool(user, category, schoolId, options = {}) {
  const scope = await getSchoolScope(user, category, options);
  if (!isSchoolInScope(scope, schoolId)) throw outOfScopeError(category);
  return scope;
}

/** Permissions whose holders view records university-wide (not DRD reviewer capabilities). */
const UNSCOPED_VIEW_PERMISSIONS = [
  'finance_review', 'finance_approve', 'finance_manage',
  'research_assign_school', 'book_assign_school', 'conference_assign_school', 'grant_assign_school', 'ipr_assign_school',
  'ipr_all_dashboard', 'ipr_edit_all',
];

/**
 * Detail views: a reviewer may open an item by id only inside their assigned schools.
 * Participants (applicant, authors/investigators/inventors, mentor, current or past
 * reviewer), admins, and finance / school-assignment / all-IPR-dashboard staff keep access.
 * Throws 404 (objectAccess convention: never disclose another school's record).
 * @param {object} user - req.user
 * @param {'research'|'book'|'conference'|'grant'|'ipr'} category
 * @param {string|null} schoolId
 * @param {{ participant?: boolean, notFoundMessage?: string }} [options]
 */
async function assertCanViewInScope(user, category, schoolId, { participant = false, notFoundMessage = 'Not found' } = {}) {
  if (participant || isUniversityWide(user)) return;
  const { hasAnyPermission, notFound } = require('../utils/objectAccess');
  if (hasAnyPermission(user, UNSCOPED_VIEW_PERMISSIONS)) return;
  const scope = await getSchoolScope(user, category);
  if (!isSchoolInScope(scope, schoolId)) throw notFound(notFoundMessage);
}

/**
 * Per-category scopes for the research workflow, turned into one Prisma condition:
 * OR over the categories in `categories` of (publicationType in category AND school in
 * scope). Returns null when every listed category covers all schools.
 */
function researchCategoriesWhere(assignment, categories, user = null) {
  if (isUniversityWide(user)) return null;
  const scopes = categories.map((category) => ({ category, scope: scopeFromAssignment(assignment, category) }));
  if (scopes.every(({ scope }) => scope.all)) return null;
  return {
    OR: scopes.map(({ category, scope }) => {
      const typeCond = CATEGORY_PUBLICATION_TYPES[category].length === 1
        ? { publicationType: CATEGORY_PUBLICATION_TYPES[category][0] }
        : { publicationType: { in: CATEGORY_PUBLICATION_TYPES[category] } };
      return scope.all ? typeCond : { AND: [typeCond, { schoolId: { in: scope.schoolIds } }] };
    }),
  };
}

// ─── Per-category permissions ──────────────────────────────────────────────

/** Permission keys per category and capability. */
const CATEGORY_PERMISSION_KEYS = Object.freeze({
  research: { review: 'research_review', approve: 'research_approve' },
  book: { review: 'book_review', approve: 'book_approve' },
  conference: { review: 'conference_review', approve: 'conference_approve' },
  grant: { review: 'grant_review', approve: 'grant_approve' },
  ipr: { review: 'ipr_review', approve: 'ipr_approve' },
});

/**
 * DEPRECATED fallback: before per-category gating, research_review / research_approve
 * covered books, book chapters and conference papers (and grants on the grant routes).
 * Every DRD reviewer in the dev DB still holds only research_*, so the fallback stays,
 * logged once per user/category/capability per process, until rows are migrated.
 */
const LEGACY_FALLBACK_CATEGORY = Object.freeze({ book: 'research', conference: 'research', grant: 'research' });

/** Merge every central-department permission entry on req.user (direct rows + role templates). */
function mergedPermissions(user) {
  const out = {};
  for (const entry of user?.centralDeptPermissions || []) {
    const perms = entry?.permissions;
    if (!perms || typeof perms !== 'object') continue;
    for (const [key, value] of Object.entries(perms)) if (value === true) out[key] = true;
  }
  return out;
}

const holds = (perms, key) => perms?.[key] === true || perms?.[`drd_${key}`] === true;

/**
 * May a holder of `perms` perform `action` on items of `category`?
 * @param {object} perms - merged permission map
 * @param {'research'|'book'|'conference'|'grant'|'ipr'} category
 * @param {'review'|'approve'|'any'} action - 'any' = review or approve
 * @returns {{ allowed: boolean, viaFallback: boolean }}
 */
function categoryAccess(perms, category, action) {
  const keys = CATEGORY_PERMISSION_KEYS[category];
  if (!keys) return { allowed: false, viaFallback: false };
  const actions = action === 'any' ? ['review', 'approve'] : [action];
  if (actions.some((a) => holds(perms, keys[a]))) return { allowed: true, viaFallback: false };
  const fallback = LEGACY_FALLBACK_CATEGORY[category];
  if (fallback && actions.some((a) => holds(perms, CATEGORY_PERMISSION_KEYS[fallback][a]))) {
    return { allowed: true, viaFallback: true };
  }
  return { allowed: false, viaFallback: false };
}

const _fallbackWarned = new Set();
function warnLegacyFallback(userId, category, action) {
  const key = `${userId}:${category}:${action}`;
  if (_fallbackWarned.has(key)) return;
  _fallbackWarned.add(key);
  try {
    const wanted = CATEGORY_PERMISSION_KEYS[category][action === 'approve' ? 'approve' : 'review'];
    require('../../../shared/utils/logger').warn(
      `[DEPRECATION] user ${userId} used research_* permissions for a ${category} item (${action}); ` +
      `grant ${wanted} explicitly - the research_* fallback will be removed`
    );
  } catch { /* logging must never block a request */ }
}

/** Effective per-category flags (with the deprecated research_* fallback) for queues and UIs. */
function effectiveCategoryFlags(perms) {
  const flag = (category, action) => categoryAccess(perms, category, action).allowed;
  return {
    hasResearchReview: flag('research', 'review'),
    hasResearchApprove: flag('research', 'approve'),
    hasBookReview: flag('book', 'review'),
    hasBookApprove: flag('book', 'approve'),
    hasConferenceReview: flag('conference', 'review'),
    hasConferenceApprove: flag('conference', 'approve'),
  };
}

// ─── Item resolution (route middleware) ────────────────────────────────────

/** IPR application id from the route: :id, :iprApplicationId, :updateId, :sessionId or body.iprApplicationId. */
async function _iprIdFrom(req, db) {
  const p = req.params || {};
  if (req._scopeItemId) return req._scopeItemId;
  if (p.id) return p.id;
  if (p.iprApplicationId) return p.iprApplicationId;
  if (p.updateId && UUID_RE.test(p.updateId)) {
    const update = await db.iprStatusUpdate.findUnique({ where: { id: p.updateId }, select: { iprApplicationId: true } });
    return update?.iprApplicationId || null;
  }
  if (p.sessionId && UUID_RE.test(p.sessionId)) {
    const session = await db.iprCollaborativeSession.findUnique({ where: { id: p.sessionId }, select: { iprApplicationId: true } });
    return session?.iprApplicationId || null;
  }
  if (typeof req.body?.iprApplicationId === 'string') return req.body.iprApplicationId;
  return null;
}

/**
 * Load the item a DRD route works on, with the relations the participant checks need.
 * Cached on req so permission, scope and view middleware share one lookup.
 * @returns {Promise<null|{ category: string, schoolId: string|null, record: object, participant: boolean }>}
 */
async function _resolveItem(kind, req) {
  const cacheKey = `_reviewItem_${kind}`;
  if (req[cacheKey] !== undefined) return req[cacheKey];
  const db = getPrisma();
  const access = require('../utils/objectAccess');
  let item = null;
  if (kind === 'ipr') {
    const id = await _iprIdFrom(req, db);
    if (id && UUID_RE.test(id)) {
      const app = await db.iprApplication.findUnique({ where: { id }, include: access.IPR_ACCESS_INCLUDE });
      if (app) item = { category: 'ipr', schoolId: app.schoolId, record: app, participant: access.isIprParticipant(req.user, app) };
    }
  } else {
    const id = req._scopeItemId || req.params?.id || req.params?.contributionId;
    if (id && UUID_RE.test(id)) {
      if (kind === 'research') {
        const c = await db.researchContribution.findUnique({ where: { id }, include: access.CONTRIBUTION_ACCESS_INCLUDE });
        if (c) item = { category: categoryForPublicationType(c.publicationType), schoolId: c.schoolId, record: c, participant: access.isContributionParticipant(req.user, c) };
      }
      // /research/:id/review/start also starts grant reviews
      if (!item) {
        const g = await db.grantApplication.findUnique({ where: { id }, include: access.GRANT_ACCESS_INCLUDE });
        if (g) item = { category: 'grant', schoolId: g.schoolId, record: g, participant: access.isGrantParticipant(req.user, g) };
      }
    }
  }
  req[cacheKey] = item;
  return item;
}

const _fail = (res, error) => {
  if (error.code === OUT_OF_SCOPE_CODE) {
    return res.status(403).json({ success: false, code: OUT_OF_SCOPE_CODE, message: error.message });
  }
  if (error.statusCode === 404) return res.status(404).json({ success: false, message: error.message });
  console.error('Review scope check error:', error);
  return res.status(500).json({ success: false, message: 'Failed to verify review scope' });
};

/**
 * Express middleware for DRD actions: 403 OUT_OF_ASSIGNED_SCHOOLS when the item is outside
 * the user's assigned schools for its category. Unknown ids fall through so the handler
 * answers 404 as before.
 * @param {'research'|'grant'|'ipr'} kind - 'research' covers research/book/conference
 *   contributions and falls back to grants (shared /research/:id/review/start).
 */
function requireSchoolScope(kind) {
  return async (req, res, next) => {
    try {
      if (!req.user) return next();
      const item = await _resolveItem(kind, req);
      if (!item) return next();
      // IPR reviewers are assigned explicitly by the DRD Head (assign/:id): honour that.
      if (item.category === 'ipr' && item.record.currentReviewerId && item.record.currentReviewerId === req.user.id) return next();
      await assertCanActOnSchool(req.user, item.category, item.schoolId);
      return next();
    } catch (error) {
      return _fail(res, error);
    }
  };
}

/**
 * Express middleware for DRD actions on research-workflow items: requires the permission of
 * the item's own category (research_paper → research_*, book/book_chapter → book_*,
 * conference_paper → conference_*, grant → grant_*), with the deprecated research_* fallback.
 * For an unknown id the user needs the capability in some category; the handler then 404s.
 * @param {'research'|'grant'|'ipr'} kind
 * @param {'review'|'approve'|'any'} action
 */
function requireReviewAccess(kind, action) {
  const deny = (res) => res.status(403).json({ success: false, message: 'Access denied - insufficient permissions' });
  return async (req, res, next) => {
    try {
      if (!req.user) return deny(res);
      const perms = mergedPermissions(req.user);
      const item = await _resolveItem(kind, req);
      if (!item) {
        const categories = kind === 'research' ? ['research', 'book', 'conference', 'grant'] : [kind];
        return categories.some((c) => categoryAccess(perms, c, action).allowed) ? next() : deny(res);
      }
      const result = categoryAccess(perms, item.category, action);
      if (!result.allowed) return deny(res);
      if (result.viaFallback) warnLegacyFallback(req.user.id, item.category, action);
      return next();
    } catch (error) {
      return _fail(res, error);
    }
  };
}

/**
 * Express middleware for reads of one item (files, history, suggestions, status updates):
 * participants (applicant, authors/investigators/inventors, mentor, current or past reviewer),
 * admins and finance / school-assignment / all-IPR-dashboard staff pass; DRD reviewers only
 * inside their assigned schools. Out of scope → 404, like a missing record.
 * @param {'research'|'grant'|'ipr'} kind
 */
function requireViewScope(kind) {
  return async (req, res, next) => {
    try {
      if (!req.user) return next();
      const item = await _resolveItem(kind, req);
      if (!item) return next();
      await assertCanViewInScope(req.user, item.category, item.schoolId, { participant: item.participant, notFoundMessage: 'Not found' });
      return next();
    } catch (error) {
      return _fail(res, error);
    }
  };
}

/** Async view check usable from controllers/services (false instead of throwing). */
async function canViewInScope(user, category, schoolId, participant) {
  try {
    await assertCanViewInScope(user, category, schoolId, { participant });
    return true;
  } catch (error) {
    if (error.statusCode === 404) return false;
    throw error;
  }
}

/**
 * School scope a viewer's LIST queries must apply for a category: all schools for admins and
 * finance / school-assignment / all-IPR-dashboard staff; otherwise the reviewer scope.
 */
async function getViewScope(user, category) {
  const { hasAnyPermission } = require('../utils/objectAccess');
  if (isUniversityWide(user) || hasAnyPermission(user, UNSCOPED_VIEW_PERMISSIONS)) return { all: true, schoolIds: [] };
  return getSchoolScope(user, category);
}

/**
 * May the caller read a stored upload key that belongs to a DRD item? Files are linked to IPR
 * applications (annexure / prototype / supporting docs), grants (proposal / supporting docs)
 * and research contributions (manuscript / supporting docs). Keys linked to no item keep the
 * generic tenant-level rule (returns true).
 * @param {object} user - req.user
 * @param {string} key - "<folder...>/<uploaderUserId>/<file>"
 */
async function canReadLinkedFile(user, key) {
  if (!user || !key) return false;
  if (isUniversityWide(user)) return true;
  const db = getPrisma();
  const access = require('../utils/objectAccess');
  const ipr = await db.iprApplication.findFirst({
    where: { OR: [{ annexureFilePath: { endsWith: key } }, { prototypeFilePath: { endsWith: key } }, { supportingDocsFilePaths: { array_contains: [key] } }] },
    include: access.IPR_ACCESS_INCLUDE,
  });
  if (ipr) {
    return access.canViewIpr(user, ipr) && canViewInScope(user, 'ipr', ipr.schoolId, access.isIprParticipant(user, ipr));
  }
  const grant = await db.grantApplication.findFirst({
    where: { OR: [{ proposalFilePath: { endsWith: key } }, { supportingDocsFilePaths: { array_contains: [key] } }] },
    include: access.GRANT_ACCESS_INCLUDE,
  });
  if (grant) {
    return access.canViewGrant(user, grant) && canViewInScope(user, 'grant', grant.schoolId, access.isGrantParticipant(user, grant));
  }
  const contribution = await db.researchContribution.findFirst({
    where: { OR: [{ manuscriptFilePath: { contains: key } }, { supportingDocsFilePaths: { path: ['files'], array_contains: [{ s3Key: key }] } }] },
    include: access.CONTRIBUTION_ACCESS_INCLUDE,
  });
  if (contribution) {
    return access.canViewContribution(user, contribution)
      && canViewInScope(user, categoryForPublicationType(contribution.publicationType), contribution.schoolId, access.isContributionParticipant(user, contribution));
  }
  return true;
}

// ─── Legacy IPR register (/ipr-management, model IPR) ──────────────────────
// Legacy items carry no school; their school is the creator's (EmployeeDetails.primarySchoolId,
// else the primary department's school). Managers are scoped by the IPR list; creators and
// approvers keep access.

/** Prisma filter for legacy IPR items whose creator belongs to one of `schoolIds`. */
function legacyIprSchoolWhere(schoolIds) {
  return {
    createdBy: {
      employeeDetails: {
        is: { OR: [{ primarySchoolId: { in: schoolIds } }, { primaryDepartment: { is: { facultyId: { in: schoolIds } } } }] },
      },
    },
  };
}

async function legacyIprSchoolId(item) {
  if (!item?.createdById) return null;
  const user = await getPrisma().userLogin.findUnique({
    where: { id: item.createdById },
    select: { employeeDetails: { select: { primarySchoolId: true, primaryDepartment: { select: { facultyId: true } } } } },
  });
  const emp = user?.employeeDetails;
  return emp?.primarySchoolId || emp?.primaryDepartment?.facultyId || null;
}

/** School-wise access to a legacy IPR item (role/ownership checks stay in the routes). */
async function canAccessLegacyIpr(user, item) {
  if (!item) return false;
  if (isUniversityWide(user) || item.createdById === user?.id || item.approvedById === user?.id) return true;
  const scope = await getViewScope(user, 'ipr');
  if (scope.all) return true;
  return isSchoolInScope(scope, await legacyIprSchoolId(item));
}

module.exports = {
  OUT_OF_SCOPE_CODE,
  SCOPE_TTL_MS,
  CATEGORY_FIELDS,
  CATEGORY_PUBLICATION_TYPES,
  CATEGORY_PERMISSION_KEYS,
  LEGACY_FALLBACK_CATEGORY,
  categoryForPublicationType,
  normalizeIds,
  isUniversityWide,
  loadDrdAssignment,
  scopeFromAssignment,
  getSchoolScope,
  getViewScope,
  isSchoolInScope,
  scopeWhere,
  researchCategoriesWhere,
  assertCanActOnSchool,
  assertCanViewInScope,
  canViewInScope,
  canReadLinkedFile,
  UNSCOPED_VIEW_PERMISSIONS,
  outOfScopeError,
  mergedPermissions,
  categoryAccess,
  effectiveCategoryFlags,
  warnLegacyFallback,
  requireSchoolScope,
  requireReviewAccess,
  requireViewScope,
  legacyIprSchoolWhere,
  legacyIprSchoolId,
  canAccessLegacyIpr,
  invalidateUser,
  clearCache,
};
