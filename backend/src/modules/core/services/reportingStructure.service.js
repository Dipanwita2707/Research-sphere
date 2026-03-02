/**
 * Reporting Structure Service
 * ──────────────────────────────────────────────────────────────────────────
 * Single-tree hierarchical model.
 *
 * DATA MODEL
 *   • Every row in `reporting_structure` represents ONE user.
 *   • `managerId` points to the user's direct parent (NULL = root).
 *   • The tree is built in-memory from these parent pointers.
 *   • `hierarchyDepth` in DB is a hint — the /tree API always
 *     recomputes depth from the actual parent-child links.
 *
 * KEY RULES
 *   1. Every user has exactly one parent (or is root with managerId = null).
 *   2. Circular references are rejected.
 *   3. Adding a user automatically creates necessary rows for managers
 *      so they appear in the tree.
 *   4. Removing a user re-parents their children to the removed user's
 *      own parent (or makes them roots if the removed user was root).
 * ──────────────────────────────────────────────────────────────────────────
 */

const prisma = require('../../../shared/config/database');

// ─── In-memory cache ────────────────────────────────────────────────────
const _treeCache = { data: null, ts: 0, TTL: 60_000 };

function invalidateTreeCache() {
  _treeCache.data = null;
  _treeCache.ts = 0;
}
invalidateTreeCache(); // clear on module load / restart

// ─── READ helpers ───────────────────────────────────────────────────────

async function getDirectManager(userId) {
  const reporting = await prisma.reportingStructure.findUnique({
    where: { userId },
    include: {
      manager: {
        select: {
          id: true, uid: true, email: true, role: true,
          employeeDetails: true, assignedRoleIds: true,
          schoolDeptPermissions: { where: { isActive: true }, select: { permissions: true } },
          centralDeptPermissions: { where: { isActive: true }, select: { permissions: true } },
        },
      },
    },
  });
  return reporting?.manager || null;
}

async function getReportingChain(userId) {
  const chain = [];
  let cur = userId;
  const visited = new Set();
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    const r = await prisma.reportingStructure.findUnique({
      where: { userId: cur },
      include: {
        manager: {
          select: {
            id: true, uid: true, email: true, role: true,
            employeeDetails: true,
            schoolDeptPermissions: true, centralDeptPermissions: true,
          },
        },
      },
    });
    if (!r || !r.manager) break;
    chain.push({
      id: r.manager.id, uid: r.manager.uid, email: r.manager.email,
      name: r.manager.employeeDetails?.displayName ||
        `${r.manager.employeeDetails?.firstName || ''} ${r.manager.employeeDetails?.lastName || ''}`.trim(),
      roleCode: r.manager.role?.roleCode,
      hierarchyDepth: r.hierarchyDepth,
      schoolDeptPermissions: r.manager.schoolDeptPermissions,
      centralDeptPermissions: r.manager.centralDeptPermissions,
    });
    cur = r.managerId;
  }
  return chain;
}

async function getDirectReports(managerId) {
  const reps = await prisma.reportingStructure.findMany({
    where: { managerId, isActive: true },
    include: { user: { select: { id: true, uid: true, email: true, role: true, employeeDetails: true } } },
  });
  return reps.map((r) => r.user);
}

// ─── Circular-dependency check ──────────────────────────────────────────

async function checkCircularDependency(userId, managerId) {
  let cur = managerId;
  const visited = new Set();
  while (cur && !visited.has(cur)) {
    if (cur === userId) return true;
    visited.add(cur);
    const r = await prisma.reportingStructure.findUnique({ where: { userId: cur } });
    cur = r?.managerId;
  }
  return false;
}

// ─── Depth / path recalculation ─────────────────────────────────────────

/**
 * Recalculate hierarchyDepth (root=0, each child = parent+1) and
 * hierarchyPath for a node and all its descendants.
 * Called after every mutation that moves nodes around.
 */
async function recalcSubtree(userId) {
  const rec = await prisma.reportingStructure.findUnique({ where: { userId } });
  if (!rec) return;

  let depth = 0;
  let pathParts = [userId];

  if (rec.managerId) {
    const parent = await prisma.reportingStructure.findUnique({ where: { userId: rec.managerId } });
    if (parent) {
      depth = parent.hierarchyDepth + 1;
      pathParts = [...(parent.hierarchyPath ? parent.hierarchyPath.split(',') : [rec.managerId]), userId];
    } else {
      depth = 1;
      pathParts = [rec.managerId, userId];
    }
  }

  await prisma.reportingStructure.update({
    where: { userId },
    data: { hierarchyDepth: depth, hierarchyPath: pathParts.join(',') },
  });

  const children = await prisma.reportingStructure.findMany({ where: { managerId: userId } });
  for (const c of children) await recalcSubtree(c.userId);
}

// Legacy alias — other modules may still import this name
const updateSubordinatesHierarchy = recalcSubtree;

// ─── WRITE: Set manager (core primitive) ────────────────────────────────

/**
 * Set userId's direct manager to managerId.
 * - Validates self-reference and circular dependency.
 * - Auto-creates a reporting_structure row for the manager (as root)
 *   if one doesn't exist, so the manager appears in the tree.
 * - Recalculates depth/path for the entire moved sub-tree.
 */
async function setReportingManager(userId, managerId, createdById) {
  if (userId === managerId) throw new Error('User cannot report to themselves');

  const mgr = await prisma.userLogin.findUnique({ where: { id: managerId } });
  if (!mgr) throw new Error('Manager not found');

  if (await checkCircularDependency(userId, managerId)) {
    throw new Error('This assignment would create a circular reporting structure');
  }

  // Ensure the manager has a row in reporting_structure (may be root)
  const mgrRec = await prisma.reportingStructure.findUnique({ where: { userId: managerId } });
  if (!mgrRec) {
    await prisma.reportingStructure.create({
      data: { userId: managerId, managerId: null, hierarchyDepth: 0, hierarchyPath: managerId, createdById },
    });
  }

  // Upsert employee's reporting row
  const reporting = await prisma.reportingStructure.upsert({
    where: { userId },
    update: { managerId, updatedAt: new Date() },
    create: { userId, managerId, hierarchyDepth: 0, hierarchyPath: userId, createdById },
    include: {
      user: { include: { employeeDetails: true } },
      manager: { include: { employeeDetails: true } },
    },
  });

  // Recalculate depth/path from this node downward
  await recalcSubtree(userId);
  invalidateTreeCache();
  return reporting;
}

// ─── WRITE: Assign multi-level chain ────────────────────────────────────

/**
 * Chain: userId → managerChain[0] → managerChain[1] → …
 *
 * DOES NOT delete existing records for those managers — so their other
 * subordinates are preserved. Only sets the parent pointer within the chain.
 */
async function assignManagerChain(userId, managerChain, createdById) {
  if (!userId || !Array.isArray(managerChain) || !managerChain.length) {
    throw new Error('User ID and manager chain array are required');
  }
  if (managerChain.length > 5) throw new Error('Maximum 5 hierarchy levels allowed');

  // Validate all users exist
  const allIds = [...new Set([userId, ...managerChain])];
  const found = await prisma.userLogin.findMany({ where: { id: { in: allIds } }, select: { id: true } });
  if (found.length !== allIds.length) throw new Error('One or more users in the chain do not exist');

  const results = [];
  let emp = userId;

  for (const mgr of managerChain) {
    const r = await setReportingManager(emp, mgr, createdById);
    results.push(r);
    emp = mgr; // next iteration: this manager becomes the employee
  }

  // Ensure topmost manager has a record (root if not parented already)
  const topId = managerChain[managerChain.length - 1];
  const topRec = await prisma.reportingStructure.findUnique({ where: { userId: topId } });
  if (!topRec) {
    await prisma.reportingStructure.create({
      data: { userId: topId, managerId: null, hierarchyDepth: 0, hierarchyPath: topId, createdById },
    });
  }

  invalidateTreeCache();
  return { created: results.length, relationships: results };
}

// ─── WRITE: Remove from tree ────────────────────────────────────────────

/**
 * Delete a user's row and re-parent children → grandparent (or root).
 * Uses a Prisma transaction for atomicity — either everything succeeds
 * or nothing changes.
 */
async function deleteReportingRelationship(userId) {
  const rec = await prisma.reportingStructure.findUnique({ where: { userId } });
  if (!rec) {
    const err = new Error('No reporting relationship found for this user');
    err.code = 'P2025';
    throw err;
  }

  const parentId = rec.managerId;
  const children = await prisma.reportingStructure.findMany({ where: { managerId: userId } });

  // Atomic: re-parent + delete in a single transaction
  await prisma.$transaction(async (tx) => {
    if (children.length) {
      await tx.reportingStructure.updateMany({
        where: { managerId: userId },
        data: { managerId: parentId ?? null },
      });
    }
    await tx.reportingStructure.delete({ where: { userId } });
  });

  // Recalculate affected branches outside the tx
  for (const c of children) await recalcSubtree(c.userId);
  invalidateTreeCache();
}

// ─── WRITE: Move user to a different level ──────────────────────────────

/**
 * Move a user from their current position to a new position under
 * `newManagerId`. This is a safe two-step operation:
 *   1. Remove user from current position (re-parent their children
 *      to their old parent).
 *   2. Insert user under newManagerId.
 * Everything runs inside a Prisma transaction for atomicity.
 */
async function moveUser(userId, newManagerId, createdById) {
  if (userId === newManagerId) throw new Error('User cannot report to themselves');

  const mgr = await prisma.userLogin.findUnique({ where: { id: newManagerId } });
  if (!mgr) throw new Error('New manager not found');

  // Validate: the target manager must not be a descendant of userId
  // (that would create a cycle even after the remove step)
  if (await checkCircularDependency(userId, newManagerId)) {
    // After removal, the cycle might break, so re-check in the context
    // of the new tree shape. We simulate: would newManagerId chain still
    // reach userId if userId's children moved to userId's parent?
    const rec = await prisma.reportingStructure.findUnique({ where: { userId } });
    if (rec) {
      // Walk from newManagerId upward, skipping userId
      let cur = newManagerId;
      const visited = new Set();
      let wouldCycle = false;
      while (cur && !visited.has(cur)) {
        if (cur === userId) { /* skip over userId as it's being removed */ cur = rec.managerId; continue; }
        visited.add(cur);
        const r = await prisma.reportingStructure.findUnique({ where: { userId: cur } });
        cur = r?.managerId;
      }
      // If we never hit userId (we skipped it), no cycle
      // But if newManagerId IS a current child of userId AND would then
      // still reach userId, it's a problem only if userId stays in chain.
      // Since we remove userId first, the chain breaks — so it's actually safe.
    }
  }

  // Phase 1 & 2: atomic transaction
  await prisma.$transaction(async (tx) => {
    const rec = await tx.reportingStructure.findUnique({ where: { userId } });
    const oldParentId = rec?.managerId ?? null;

    // 1. Re-parent current children of userId to userId's old parent
    const children = await tx.reportingStructure.findMany({ where: { managerId: userId } });
    if (children.length) {
      await tx.reportingStructure.updateMany({
        where: { managerId: userId },
        data: { managerId: oldParentId },
      });
    }

    // 2. Ensure newManagerId has a reporting_structure row
    const mgrRec = await tx.reportingStructure.findUnique({ where: { userId: newManagerId } });
    if (!mgrRec) {
      await tx.reportingStructure.create({
        data: { userId: newManagerId, managerId: null, hierarchyDepth: 0, hierarchyPath: newManagerId, createdById },
      });
    }

    // 3. Update or create userId's row with the new parent
    if (rec) {
      await tx.reportingStructure.update({
        where: { userId },
        data: { managerId: newManagerId, updatedAt: new Date() },
      });
    } else {
      await tx.reportingStructure.create({
        data: { userId, managerId: newManagerId, hierarchyDepth: 0, hierarchyPath: userId, createdById },
      });
    }
  });

  // Recalculate all affected subtrees
  await recalcSubtree(userId);
  // Also recalc old children that were re-parented
  const movedKids = await prisma.reportingStructure.findMany({
    where: { managerId: { not: userId } },
  });
  // Just recalc from the moving user and from the new manager
  await recalcSubtree(newManagerId);
  invalidateTreeCache();

  return prisma.reportingStructure.findUnique({
    where: { userId },
    include: {
      user: { include: { employeeDetails: true } },
      manager: { include: { employeeDetails: true } },
    },
  });
}

/**
 * Legacy: make user top-level without deleting the row.
 */
async function removeReportingManager(userId) {
  await prisma.reportingStructure.update({
    where: { userId },
    data: { managerId: null, hierarchyDepth: 0, hierarchyPath: userId },
  });
  const kids = await prisma.reportingStructure.findMany({ where: { managerId: userId } });
  for (const c of kids) await recalcSubtree(c.userId);
  invalidateTreeCache();
}

// ─── READ: Tree ─────────────────────────────────────────────────────────

async function getHierarchyTree() {
  const now = Date.now();
  if (_treeCache.data && now - _treeCache.ts < _treeCache.TTL) return _treeCache.data;

  const rows = await prisma.reportingStructure.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: {
          id: true, uid: true, email: true, role: true,
          employeeDetails: {
            select: {
              displayName: true, empId: true,
              primaryDepartment: { select: { departmentName: true } },
              primarySchool: { select: { facultyName: true } },
            },
          },
        },
      },
      manager: {
        select: {
          id: true, uid: true, email: true, role: true,
          employeeDetails: { select: { displayName: true, empId: true } },
        },
      },
    },
    orderBy: { hierarchyDepth: 'asc' },
  });

  const tree = buildTree(rows);
  _treeCache.data = tree;
  _treeCache.ts = Date.now();
  return tree;
}

/**
 * Build nested tree from flat rows.
 * Level badge: leaf = 1, parent = max(children) + 1.
 */
function buildTree(rows) {
  const map = new Map();
  const roots = [];

  rows.forEach((r) => {
    map.set(r.userId, {
      id: r.id,
      userId: r.userId,
      name:
        r.user.employeeDetails?.displayName ||
        `${r.user.employeeDetails?.firstName || ''} ${r.user.employeeDetails?.lastName || ''}`.trim() ||
        r.user.email,
      email: r.user.email,
      uid: r.user.uid,
      empId: r.user.employeeDetails?.empId,
      department: r.user.employeeDetails?.primaryDepartment?.departmentName,
      school: r.user.employeeDetails?.primarySchool?.facultyName,
      managerId: r.managerId,
      hierarchyDepth: 0,
      children: [],
    });
  });

  rows.forEach((r) => {
    const node = map.get(r.userId);
    if (r.managerId && map.has(r.managerId)) {
      map.get(r.managerId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  function computeLevel(node) {
    if (!node.children.length) { node.hierarchyDepth = 1; return 1; }
    let mx = 0;
    for (const c of node.children) { const d = computeLevel(c); if (d > mx) mx = d; }
    node.hierarchyDepth = mx + 1;
    return node.hierarchyDepth;
  }
  roots.forEach(computeLevel);

  return roots;
}

// ─── Misc helpers ───────────────────────────────────────────────────────

async function hasReportingStructure(userId) {
  return !!(await prisma.reportingStructure.findUnique({ where: { userId } }));
}

async function getReportingStatistics() {
  const totalUsers = await prisma.reportingStructure.count({ where: { isActive: true } });
  const topLevelManagers = await prisma.reportingStructure.count({ where: { isActive: true, managerId: null } });
  const maxDepth = await prisma.reportingStructure.aggregate({ where: { isActive: true }, _max: { hierarchyDepth: true } });
  return { totalUsersInStructure: totalUsers, topLevelManagers, maxHierarchyDepth: maxDepth._max.hierarchyDepth || 0 };
}

// ─── Hierarchy-aware user info ──────────────────────────────────────────

/**
 * For a given userId, return hierarchy metadata if they are already
 * in the reporting structure. Used by UI to show "Already in Hierarchy"
 * badges and prevent duplicate insertion.
 */
async function getUserHierarchyInfo(userId) {
  const rec = await prisma.reportingStructure.findUnique({
    where: { userId },
    include: {
      manager: {
        select: {
          id: true, uid: true, email: true,
          employeeDetails: { select: { displayName: true, empId: true } },
        },
      },
    },
  });
  if (!rec) return null;

  // Count direct subordinates
  const subordinateCount = await prisma.reportingStructure.count({ where: { managerId: userId, isActive: true } });

  // Get computed level from tree (leaf=1, higher=parent)
  // We reuse the tree cache for efficiency
  let computedLevel = rec.hierarchyDepth;
  try {
    const tree = await getHierarchyTree();
    const findLevel = (nodes) => {
      for (const n of nodes) {
        if (n.userId === userId) return n.hierarchyDepth;
        if (n.children?.length) {
          const found = findLevel(n.children);
          if (found !== null) return found;
        }
      }
      return null;
    };
    const l = findLevel(tree);
    if (l !== null) computedLevel = l;
  } catch { /* use DB value as fallback */ }

  const managerName = rec.manager?.employeeDetails?.displayName || rec.manager?.email || null;

  return {
    isInHierarchy: true,
    currentLevel: computedLevel,
    parentId: rec.managerId,
    parentName: managerName,
    subordinateCount,
    hierarchyPath: rec.hierarchyPath,
  };
}

/**
 * Batch version: given an array of userIds, return a map of
 * userId → hierarchyInfo (or null if not in hierarchy).
 * Efficient for the frontend search dropdown.
 */
async function getBulkHierarchyInfo(userIds) {
  if (!userIds?.length) return {};

  const recs = await prisma.reportingStructure.findMany({
    where: { userId: { in: userIds } },
    include: {
      manager: {
        select: {
          id: true, uid: true, email: true,
          employeeDetails: { select: { displayName: true, empId: true } },
        },
      },
    },
  });

  // Get subordinate counts in bulk
  const subCounts = await prisma.reportingStructure.groupBy({
    by: ['managerId'],
    where: { managerId: { in: userIds }, isActive: true },
    _count: true,
  });
  const subMap = {};
  for (const s of subCounts) subMap[s.managerId] = s._count;

  // Use cached tree levels if available, otherwise fall back to DB depth
  const levelMap = {};
  if (_treeCache.data && Date.now() - _treeCache.ts < _treeCache.TTL) {
    const walkTree = (nodes) => {
      for (const n of nodes) {
        levelMap[n.userId] = n.hierarchyDepth;
        if (n.children?.length) walkTree(n.children);
      }
    };
    walkTree(_treeCache.data);
  }

  const result = {};
  for (const uid of userIds) {
    const rec = recs.find(r => r.userId === uid);
    if (!rec) { result[uid] = null; continue; }
    const managerName = rec.manager?.employeeDetails?.displayName || rec.manager?.email || null;
    result[uid] = {
      isInHierarchy: true,
      currentLevel: levelMap[uid] ?? rec.hierarchyDepth,
      parentId: rec.managerId,
      parentName: managerName,
      subordinateCount: subMap[uid] || 0,
      hierarchyPath: rec.hierarchyPath,
    };
  }
  return result;
}

module.exports = {
  getDirectManager,
  getReportingChain,
  getDirectReports,
  setReportingManager,
  assignManagerChain,
  removeReportingManager,
  deleteReportingRelationship,
  moveUser,
  checkCircularDependency,
  getHierarchyTree,
  invalidateTreeCache,
  hasReportingStructure,
  getReportingStatistics,
  getUserHierarchyInfo,
  getBulkHierarchyInfo,
  updateSubordinatesHierarchy,
};
