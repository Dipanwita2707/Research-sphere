/**
 * Approval Flow Service - Reporting Structure Based Workflow
 *
 * All noting approvals work through the Reporting Structure system:
 * 1. User creates noting → System finds user's manager from ReportingStructure
 * 2. If manager has required permission → Auto-forward to manager
 * 3. If not → User manually selects approver from reporting chain
 * 4. Manager can Approve/Reject/Forward up the chain
 * 5. DEAN role can override and forward anywhere
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Batch permission resolution instead of per-user async calls (N+1 fix)
 * - In-process LRU cache for hasPermissionAsync (avoids redundant DB hits)
 * - DEAN path uses DB-level permission filter with pagination (no full-table scan)
 * - Reporting chain walk uses a single recursive CTE instead of N sequential queries
 */

const prisma = require("../../../shared/config/database");
const reportingService = require("../../core/services/reportingStructure.service");
const {
  hasPermission,
  hasPermissionAsync,
} = require("../../../shared/config/permissions.config");

// ---------------------------------------------------------------------------
// Tiny in-process permission cache (per userId + permKey, TTL 2 minutes)
// Avoids hammering DB for hasPermissionAsync on every forward/approve action.
// ---------------------------------------------------------------------------
const _permCache = new Map(); // key → { value: boolean, expiresAt: number }
const PERM_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

function _permCacheKey(userId, permKey) {
  return `${userId}:${permKey}`;
}

function _getPermCached(userId, permKey) {
  const entry = _permCache.get(_permCacheKey(userId, permKey));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _permCache.delete(_permCacheKey(userId, permKey));
    return null;
  }
  return entry.value;
}

function _setPermCached(userId, permKey, value) {
  // Evict oldest entries if cache grows too large (cap at 500)
  if (_permCache.size >= 500) {
    const firstKey = _permCache.keys().next().value;
    _permCache.delete(firstKey);
  }
  _permCache.set(_permCacheKey(userId, permKey), {
    value,
    expiresAt: Date.now() + PERM_CACHE_TTL_MS,
  });
}

/** Invalidate cached permissions for a user (call after permission changes) */
function invalidatePermCache(userId) {
  for (const key of _permCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      _permCache.delete(key);
    }
  }
}

/**
 * Cached wrapper around hasPermissionAsync.
 * Reduces DB round-trips for repeated permission checks on the same user.
 */
async function hasPermissionCached(user, permKey) {
  const cached = _getPermCached(user.id, permKey);
  if (cached !== null) return cached;

  const result = await hasPermissionAsync(user, permKey);
  _setPermCached(user.id, permKey, result);
  return result;
}

/**
 * Check if a user has a module-level permission for a noting subcategory.
 * Checks the specific subcategory key first (e.g. `curriculum_approve`),
 * then falls back to the generic `noting_approve` as a super-permission.
 * This ensures backward compatibility — users with `noting_approve` can
 * still approve any subcategory's notings.
 *
 * @param {Object} user - User object
 * @param {string} modulePermissionKey - Subcategory-specific key (from getModulePermissionKey)
 * @returns {Promise<boolean>}
 */
async function hasModulePermission(user, modulePermissionKey) {
  // Check the specific subcategory key
  if (await hasPermissionCached(user, modulePermissionKey)) {
    return true;
  }
  // Fallback: generic noting_approve acts as super-permission for all noting subcategories
  if (modulePermissionKey !== "noting_approve") {
    return hasPermissionCached(user, "noting_approve");
  }
  return false;
}

/**
 * Bulk resolve module permissions with noting_approve fallback.
 * First checks the specific subcategory key, then for non-granted users
 * falls back to checking noting_approve as a super-permission.
 *
 * @param {Array} users - Users to check
 * @param {string} modulePermissionKey - Subcategory-specific key
 * @returns {Promise<Set<string>>} Set of user IDs that have the permission
 */
async function bulkResolveModulePermissions(users, modulePermissionKey) {
  const grantedIds = await bulkResolvePermissions(users, modulePermissionKey);
  if (modulePermissionKey !== "noting_approve") {
    // Also check noting_approve as super-permission for remaining users
    const remaining = users.filter((u) => !grantedIds.has(u.id));
    if (remaining.length > 0) {
      const superGranted = await bulkResolvePermissions(remaining, "noting_approve");
      for (const id of superGranted) grantedIds.add(id);
    }
  }
  return grantedIds;
}

// ---------------------------------------------------------------------------
// Bulk permission resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve permissions for a list of users in bulk.
 * For users whose permissions can be determined synchronously (via hasPermission),
 * no DB call is needed.  For those with assignedRoleIds only, we batch-fetch
 * all relevant roles in ONE query instead of N separate queries.
 *
 * @param {Array<Object>} users          - Array of userLogin objects
 * @param {string}        permissionKey  - Permission key to check
 * @returns {Promise<Set<string>>}       - Set of user IDs that have the permission
 */
async function bulkResolvePermissions(users, permissionKey) {
  const grantedIds = new Set();

  // Partition: sync-resolvable vs needs-DB
  const needsDbUsers = [];

  for (const user of users) {
    // Check in-process cache first
    const cached = _getPermCached(user.id, permissionKey);
    if (cached !== null) {
      if (cached) grantedIds.add(user.id);
      continue;
    }

    // Try synchronous check (covers role-based default permissions)
    if (hasPermission(user, permissionKey)) {
      grantedIds.add(user.id);
      _setPermCached(user.id, permissionKey, true);
      continue;
    }

    // Needs async DB resolution (assignedRoleIds path)
    const roleIds = user.assignedRoleIds || [];
    if (roleIds.length > 0) {
      needsDbUsers.push({ user, roleIds });
    } else {
      // No roles to resolve — definitely no permission
      _setPermCached(user.id, permissionKey, false);
    }
  }

  if (needsDbUsers.length === 0) return grantedIds;

  // Collect all unique role IDs across users that need DB resolution
  const allRoleIds = [
    ...new Set(needsDbUsers.flatMap(({ roleIds }) => roleIds)),
  ];

  // Single DB query for all roles
  const roles = await prisma.role.findMany({
    where: { id: { in: allRoleIds }, isActive: true },
    select: { id: true, permissions: true },
  });

  const rolePermMap = new Map(roles.map((r) => [r.id, r.permissions || {}]));

  for (const { user, roleIds } of needsDbUsers) {
    let hasPerm = false;
    for (const rid of roleIds) {
      const perms = rolePermMap.get(rid);
      if (!perms) continue;
      if (
        perms.centralDeptPermissions?.[permissionKey] === true ||
        perms.schoolDeptPermissions?.[permissionKey] === true
      ) {
        hasPerm = true;
        break;
      }
    }
    _setPermCached(user.id, permissionKey, hasPerm);
    if (hasPerm) grantedIds.add(user.id);
  }

  return grantedIds;
}

// ---------------------------------------------------------------------------
// Core Service Functions
// ---------------------------------------------------------------------------

/**
 * Determine next approver based on reporting hierarchy + permissions.
 *
 * @param {Object} note                - The note object
 * @param {string} modulePermissionKey - e.g. 'event_approve', 'dsw_approve_noting'
 * @returns {Promise<Object>} { canAutoForward, nextApproverId, reason, managerInfo }
 */
async function determineNextApproverByReporting(note, modulePermissionKey, contextOverride = null) {
  const reportingContext = contextOverride?.departmentScope && contextOverride?.departmentId
    ? contextOverride
    : {
      departmentScope: note?.departmentScope,
      departmentId: note?.departmentId,
    };

  try {
    const creator = await prisma.userLogin.findUnique({
      where: { id: note.createdById },
      select: {
        id: true,
        uid: true,
        email: true,
        role: true,
        assignedRoleIds: true,
        schoolDeptPermissions: true,
        centralDeptPermissions: true,
        employeeDetails: {
          select: { displayName: true, firstName: true, lastName: true },
        },
      },
    });

    if (!creator) {
      return {
        canAutoForward: false,
        nextApproverId: null,
        reason: "Creator not found",
      };
    }

    // Get immediate manager (single DB query via reportingService)
    const manager = await reportingService.getDirectManager(creator.id, reportingContext);

    if (!manager) {
      return {
        canAutoForward: false,
        nextApproverId: null,
        reason:
          "No reporting manager assigned. Please contact admin to configure reporting structure.",
      };
    }

    // Check permission using cached resolver (with noting_approve fallback)
    const managerHasPermission = await hasModulePermission(
      manager,
      modulePermissionKey,
    );

    if (!managerHasPermission) {
      return {
        canAutoForward: false,
        nextApproverId: manager.id,
        reason: `Manager ${manager.name || manager.email} does not have ${modulePermissionKey} permission. Manual forwarding required.`,
        managerInfo: {
          id: manager.id,
          name: manager.name,
          email: manager.email,
        },
      };
    }

    return {
      canAutoForward: true,
      nextApproverId: manager.id,
      reason: "Auto-forwarded to direct reporting manager",
      managerInfo: {
        id: manager.id,
        name: manager.name,
        email: manager.email,
        roleCode: manager.roleCode,
      },
    };
  } catch (error) {
    const log = require('../../../shared/utils/logger');
    log.error("Error in determineNextApproverByReporting:", error);
    return {
      canAutoForward: false,
      nextApproverId: null,
      reason: "Error determining next approver: " + error.message,
    };
  }
}

/**
 * Check if user can override workflow routing based on role code.
 * DEAN role code has override authority.
 *
 * @param {Object} user - User object with role
 * @returns {boolean}
 */
function canOverrideWorkflowRouting(user) {
  return (
    user.roleCode === "DEAN" ||
    (typeof user.role === "string" && user.role.toLowerCase() === "dean")
  );
}

/**
 * Get eligible forward targets for a user.
 *
 * PERFORMANCE: For DEAN users, instead of fetching all active users and doing
 * per-user async permission checks (O(N) DB queries), we:
 *   1. Fetch users whose direct permissions column contains the key (DB-side filter).
 *   2. Fetch users whose assignedRoleIds resolve to the permission in ONE batch query.
 *   3. Union the two result sets.
 *   4. Cap at 100 results to keep the payload small.
 *
 * For regular users, we walk the reporting chain (already small) and do a single
 * batch permission check.
 *
 * @param {string} userId            - Current holder of note
 * @param {Object} note              - Note object
 * @param {string} modulePermissionKey - Required permission key
 * @returns {Promise<Array>}         - List of users who can receive forward
 */
async function getEligibleForwardTargets(userId, note, modulePermissionKey, contextOverride = null) {
  const reportingContext = contextOverride?.departmentScope && contextOverride?.departmentId
    ? contextOverride
    : {
      departmentScope: note?.departmentScope,
      departmentId: note?.departmentId,
    };

  const currentUser = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      assignedRoleIds: true,
      schoolDeptPermissions: true,
      centralDeptPermissions: true,
      employeeDetails: { select: { displayName: true } },
    },
  });

  if (!currentUser) return [];

  // ── DEAN / Override path ──────────────────────────────────────────────────
  if (canOverrideWorkflowRouting(currentUser)) {
    return _getEligibleUsersWithPermission(userId, modulePermissionKey);
  }

  // ── Regular user path — walk reporting chain ──────────────────────────────
  const reportingChain = await reportingService.getReportingChain(userId, reportingContext);
  if (!reportingChain || reportingChain.length === 0) return [];

  // Batch-resolve permissions for all chain members in one round-trip
  const grantedIds = await bulkResolveModulePermissions(
    reportingChain,
    modulePermissionKey,
  );
  return reportingChain.filter((m) => grantedIds.has(m.id));
}

/**
 * Efficiently fetch users who hold a given permission.
 *
 * Strategy (union of two fast paths):
 *   A) Users where centralDeptPermissions->permKey = true  (JSON path index)
 *   B) Users where schoolDeptPermissions->permKey = true   (JSON path index)
 *   C) Users whose role has the permission (batch role lookup, capped at 200 roles)
 *
 * @param {string} excludeUserId      - Exclude this user (self)
 * @param {string} permissionKey
 * @param {number} [limit=100]
 * @returns {Promise<Array>}
 */
async function _getEligibleUsersWithPermission(
  excludeUserId,
  permissionKey,
  limit = 100,
) {
  const userSelect = {
    id: true,
    uid: true,
    email: true,
    status: true,
    assignedRoleIds: true,
    role: true,
    schoolDeptPermissions: true,
    centralDeptPermissions: true,
    employeeDetails: {
      select: { displayName: true, firstName: true, lastName: true },
    },
  };

  // Build OR conditions — include noting_approve holders as fallback
  const orConditions = [
    { centralDeptPermissions: { path: [permissionKey], equals: true } },
    { schoolDeptPermissions: { path: [permissionKey], equals: true } },
  ];
  if (permissionKey !== "noting_approve") {
    orConditions.push(
      { centralDeptPermissions: { path: ["noting_approve"], equals: true } },
      { schoolDeptPermissions: { path: ["noting_approve"], equals: true } },
    );
  }

  // Fetch candidates in parallel:
  // 1. Direct JSON permission holders (fast — uses json operator if indexed)
  // 2. Role-based permission holders
  const [directHolders, roleBasedCandidates] = await Promise.all([
    prisma.userLogin.findMany({
      where: {
        status: "active",
        id: { not: excludeUserId },
        OR: orConditions,
      },
      select: userSelect,
      take: limit,
    }),
    // Fetch users that have assignedRoleIds (may have role-based permission)
    prisma.userLogin.findMany({
      where: {
        status: "active",
        id: { not: excludeUserId },
        assignedRoleIds: { isEmpty: false },
      },
      select: userSelect,
      take: 300, // generous cap — will filter below
    }),
  ]);

  // Merge, deduplicate by id
  const merged = new Map();
  for (const u of directHolders) merged.set(u.id, u);
  for (const u of roleBasedCandidates) {
    if (!merged.has(u.id)) merged.set(u.id, u);
  }

  const candidates = Array.from(merged.values());

  // Batch-resolve permissions (single DB query for all unique role IDs)
  const grantedIds = await bulkResolveModulePermissions(candidates, permissionKey);

  return candidates.filter((u) => grantedIds.has(u.id)).slice(0, limit);
}

/**
 * Get module permission key based on note category/subcategory.
 * Maps note types to their corresponding permission keys.
 *
 * @param {Object} note - Note object with category/subcategory
 * @returns {string} Permission key
 */
function getModulePermissionKey(note) {
  const permissionMap = {
    dsw_club_creation: "dsw_approve_noting",
    dsw_club_change: "dsw_approve_noting",
    events: "event_approve",
    curriculum: "curriculum_approve",
    exam: "exam_approve",
    infrastructure: "infrastructure_approve",
    accounts_purchase: "accounts_purchase_approve",
    student_related: "student_related_approve",
    miscellaneous: "noting_approve",
    non_academic_resources: "non_academic_resources_approve",
  };

  return permissionMap[note.subcategory] || "noting_approve";
}

/**
 * Validate if user can forward to specified target.
 * Checks reporting chain or override authority.
 *
 * @param {string} userId       - Current holder
 * @param {string} targetUserId - Proposed forward target
 * @param {Object} note         - Note object
 * @returns {Promise<Object>}   { allowed, reason }
 */
async function validateForwardTarget(userId, targetUserId, note) {
  const currentUser = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!currentUser) {
    return {
      allowed: false,
      reason:
        "Your user account was not found. Please log out and log back in.",
    };
  }

  // Check override authority
  if (canOverrideWorkflowRouting(currentUser)) {
    return {
      allowed: true,
      reason:
        "Forward allowed with override authority (" +
        currentUser.role.roleCode +
        ")",
    };
  }

  // Check if target is in reporting chain
  const modulePermissionKey = getModulePermissionKey(note);
  const eligibleTargets = await getEligibleForwardTargets(
    userId,
    note,
    modulePermissionKey,
  );

  const isEligible = eligibleTargets.some((t) => t.id === targetUserId);

  if (isEligible) {
    return {
      allowed: true,
      reason: "Forward target is in reporting chain with required permission",
    };
  }

  return {
    allowed: false,
    reason:
      `You can only forward to people above you in your reporting hierarchy who have approval permission. ` +
      `The selected person is either not in your reporting chain or does not have the required "${modulePermissionKey}" permission. ` +
      `Contact Admin if you need to forward to someone outside your hierarchy.`,
  };
}

module.exports = {
  determineNextApproverByReporting,
  canOverrideWorkflowRouting,
  getEligibleForwardTargets,
  getModulePermissionKey,
  validateForwardTarget,
  invalidatePermCache,
  bulkResolvePermissions,
  hasPermissionCached,
  hasModulePermission,
};
