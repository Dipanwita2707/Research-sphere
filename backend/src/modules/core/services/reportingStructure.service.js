const prisma = require('../../../shared/config/database');

const CACHE_TTL_MS = 60_000;
const _treeCache = new Map();

function invalidateTreeCache() {
  _treeCache.clear();
}

function normalizeDepartmentContext(input, { required = false } = {}) {
  const rawScope = typeof input?.departmentScope === 'string'
    ? input.departmentScope.trim().toLowerCase()
    : '';
  const rawDepartmentId = typeof input?.departmentId === 'string'
    ? input.departmentId.trim()
    : '';

  const hasScope = rawScope.length > 0;
  const hasDepartmentId = rawDepartmentId.length > 0;

  if (!hasScope && !hasDepartmentId) {
    if (required) {
      throw new Error('departmentScope and departmentId are required');
    }
    return null;
  }

  if (hasScope !== hasDepartmentId) {
    throw new Error('departmentScope and departmentId must be provided together');
  }

  if (!['school', 'central'].includes(rawScope)) {
    throw new Error('departmentScope must be either "school" or "central"');
  }

  return {
    departmentScope: rawScope,
    departmentId: rawDepartmentId,
  };
}

function contextWhere(context) {
  if (!context) return {};
  return {
    departmentScope: context.departmentScope,
    departmentId: context.departmentId,
  };
}

function contextCacheKey(context) {
  if (!context) return 'all';
  return `${context.departmentScope}:${context.departmentId}`;
}

function nodeKey(userId, context) {
  const scope = context?.departmentScope || 'unknown';
  const id = context?.departmentId || 'unknown';
  return `${userId}|${scope}|${id}`;
}

async function inferDepartmentContext(userId, tx = prisma) {
  const details = await tx.employeeDetails.findUnique({
    where: { userLoginId: userId },
    select: {
      primaryDepartmentId: true,
      primaryCentralDeptId: true,
    },
  });

  if (details?.primaryDepartmentId) {
    return { departmentScope: 'school', departmentId: details.primaryDepartmentId };
  }

  if (details?.primaryCentralDeptId) {
    return { departmentScope: 'central', departmentId: details.primaryCentralDeptId };
  }

  return null;
}

async function resolveDepartmentContext(userId, inputContext, {
  tx = prisma,
  requireContext = false,
  allowInference = true,
} = {}) {
  const normalized = normalizeDepartmentContext(inputContext, { required: false });
  if (normalized) return normalized;

  if (requireContext) {
    throw new Error('Department context is required');
  }

  if (!allowInference) return null;

  return inferDepartmentContext(userId, tx);
}

async function findReportingRecord(userId, context, {
  tx = prisma,
  include,
  select,
  activeOnly = true,
} = {}) {
  const where = {
    userId,
    ...contextWhere(context),
  };

  if (activeOnly) {
    where.isActive = true;
  }

  const query = {
    where,
    orderBy: { updatedAt: 'desc' },
  };

  if (include) query.include = include;
  if (select) query.select = select;

  return tx.reportingStructure.findFirst(query);
}

async function ensureManagerRow(tx, managerId, createdById, context) {
  const existing = await findReportingRecord(managerId, context, {
    tx,
    activeOnly: false,
  });

  if (!existing) {
    await tx.reportingStructure.create({
      data: {
        userId: managerId,
        departmentScope: context.departmentScope,
        departmentId: context.departmentId,
        managerId: null,
        hierarchyDepth: 0,
        hierarchyPath: managerId,
        createdById,
        isActive: true,
      },
    });
    return;
  }

  if (!existing.isActive) {
    await tx.reportingStructure.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
  }
}

async function checkCircularDependency(userId, managerId, contextInput) {
  const context = normalizeDepartmentContext(contextInput, { required: false });
  let current = managerId;
  const visited = new Set();

  while (current && !visited.has(current)) {
    if (current === userId) return true;

    visited.add(current);

    const row = await findReportingRecord(current, context, {
      activeOnly: false,
    });

    current = row?.managerId || null;
  }

  return false;
}

async function recalcSubtree(userId, contextInput, tx = prisma) {
  const context = normalizeDepartmentContext(contextInput, { required: false });

  const record = await findReportingRecord(userId, context, {
    tx,
    activeOnly: false,
  });

  if (!record) return;

  let depth = 0;
  let path = [userId];

  if (record.managerId) {
    const parent = await findReportingRecord(record.managerId, context, {
      tx,
      activeOnly: false,
    });

    if (parent) {
      depth = parent.hierarchyDepth + 1;
      path = [
        ...(parent.hierarchyPath ? parent.hierarchyPath.split(',') : [record.managerId]),
        userId,
      ];
    } else {
      depth = 1;
      path = [record.managerId, userId];
    }
  }

  await tx.reportingStructure.update({
    where: { id: record.id },
    data: {
      hierarchyDepth: depth,
      hierarchyPath: path.join(','),
    },
  });

  const children = await tx.reportingStructure.findMany({
    where: {
      managerId: userId,
      ...contextWhere(context),
      isActive: true,
    },
    select: { userId: true },
  });

  for (const child of children) {
    await recalcSubtree(child.userId, context, tx);
  }
}

const updateSubordinatesHierarchy = recalcSubtree;

function managerInclude() {
  return {
    manager: {
      select: {
        id: true,
        uid: true,
        email: true,
        role: true,
        assignedRoleIds: true,
        employeeDetails: true,
        schoolDeptPermissions: {
          where: { isActive: true },
          select: { permissions: true },
        },
        centralDeptPermissions: {
          where: { isActive: true },
          select: { permissions: true },
        },
      },
    },
  };
}

async function getDirectManager(userId, contextInput = null) {
  let context = await resolveDepartmentContext(userId, contextInput, {
    requireContext: false,
    allowInference: true,
  });

  let row = await findReportingRecord(userId, context, {
    include: managerInclude(),
    activeOnly: true,
  });

  if (!row && !contextInput) {
    row = await findReportingRecord(userId, null, {
      include: managerInclude(),
      activeOnly: true,
    });
  }

  return row?.manager || null;
}

async function getReportingChain(userId, contextInput = null) {
  const chain = [];
  const visited = new Set();

  let context = await resolveDepartmentContext(userId, contextInput, {
    requireContext: false,
    allowInference: true,
  });

  let currentUserId = userId;

  while (currentUserId && !visited.has(currentUserId)) {
    visited.add(currentUserId);

    let row = await findReportingRecord(currentUserId, context, {
      include: {
        manager: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
            employeeDetails: true,
            schoolDeptPermissions: true,
            centralDeptPermissions: true,
          },
        },
      },
      activeOnly: true,
    });

    if (!row && !contextInput) {
      row = await findReportingRecord(currentUserId, null, {
        include: {
          manager: {
            select: {
              id: true,
              uid: true,
              email: true,
              role: true,
              employeeDetails: true,
              schoolDeptPermissions: true,
              centralDeptPermissions: true,
            },
          },
        },
        activeOnly: true,
      });
    }

    if (!row || !row.manager) break;

    const manager = row.manager;

    chain.push({
      id: manager.id,
      uid: manager.uid,
      email: manager.email,
      name: manager.employeeDetails?.displayName
        || `${manager.employeeDetails?.firstName || ''} ${manager.employeeDetails?.lastName || ''}`.trim(),
      roleCode: manager.role?.roleCode,
      hierarchyDepth: row.hierarchyDepth,
      schoolDeptPermissions: manager.schoolDeptPermissions,
      centralDeptPermissions: manager.centralDeptPermissions,
    });

    currentUserId = row.managerId;
  }

  return chain;
}

async function getDirectReports(managerId, contextInput = null) {
  const context = await resolveDepartmentContext(managerId, contextInput, {
    requireContext: false,
    allowInference: true,
  });

  const rows = await prisma.reportingStructure.findMany({
    where: {
      managerId,
      ...contextWhere(context),
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          employeeDetails: true,
        },
      },
    },
  });

  return rows.map((row) => row.user);
}

async function setReportingManagerInternal(tx, userId, managerId, createdById, context) {
  if (userId === managerId) {
    throw new Error('User cannot report to themselves');
  }

  const managerExists = await tx.userLogin.findUnique({ where: { id: managerId } });
  if (!managerExists) {
    throw new Error('Manager not found');
  }

  const hasCircularDependency = await checkCircularDependency(userId, managerId, context);
  if (hasCircularDependency) {
    throw new Error('This assignment would create a circular reporting structure');
  }

  await ensureManagerRow(tx, managerId, createdById, context);

  const existing = await findReportingRecord(userId, context, {
    tx,
    activeOnly: false,
  });

  if (!existing) {
    await tx.reportingStructure.create({
      data: {
        userId,
        departmentScope: context.departmentScope,
        departmentId: context.departmentId,
        managerId,
        hierarchyDepth: 0,
        hierarchyPath: userId,
        createdById,
        isActive: true,
      },
    });
  } else {
    await tx.reportingStructure.update({
      where: { id: existing.id },
      data: {
        managerId,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  }

  await recalcSubtree(userId, context, tx);
}

async function setReportingManager(userId, managerId, createdById, contextInput) {
  const context = await resolveDepartmentContext(userId, contextInput, {
    requireContext: true,
    allowInference: false,
  });

  await prisma.$transaction(async (tx) => {
    await setReportingManagerInternal(tx, userId, managerId, createdById, context);
  });

  invalidateTreeCache();

  return findReportingRecord(userId, context, {
    include: {
      user: { include: { employeeDetails: true } },
      manager: { include: { employeeDetails: true } },
    },
    activeOnly: false,
  });
}

async function assignManagerChain(userId, managerChain, createdById, contextInput) {
  if (!userId || !Array.isArray(managerChain) || managerChain.length === 0) {
    throw new Error('User ID and manager chain array are required');
  }

  if (managerChain.length > 5) {
    throw new Error('Maximum 5 hierarchy levels allowed');
  }

  const context = await resolveDepartmentContext(userId, contextInput, {
    requireContext: true,
    allowInference: false,
  });

  const allIds = [...new Set([userId, ...managerChain])];
  const users = await prisma.userLogin.findMany({
    where: { id: { in: allIds } },
    select: { id: true },
  });

  if (users.length !== allIds.length) {
    throw new Error('One or more users in the chain do not exist');
  }

  const relationships = [];

  await prisma.$transaction(async (tx) => {
    let currentUserId = userId;

    for (const managerId of managerChain) {
      await setReportingManagerInternal(tx, currentUserId, managerId, createdById, context);
      const row = await findReportingRecord(currentUserId, context, {
        tx,
        activeOnly: false,
      });
      relationships.push(row);
      currentUserId = managerId;
    }

    await ensureManagerRow(tx, managerChain[managerChain.length - 1], createdById, context);
  });

  invalidateTreeCache();

  return {
    created: relationships.length,
    relationships,
  };
}

async function deleteReportingRelationship(userId, contextInput) {
  const context = await resolveDepartmentContext(userId, contextInput, {
    requireContext: true,
    allowInference: false,
  });

  const row = await findReportingRecord(userId, context, {
    activeOnly: false,
  });

  if (!row) {
    const error = new Error('No reporting relationship found for this user');
    error.code = 'P2025';
    throw error;
  }

  const children = await prisma.reportingStructure.findMany({
    where: {
      managerId: userId,
      ...contextWhere(context),
      isActive: true,
    },
    select: { userId: true },
  });

  const parentId = row.managerId;

  await prisma.$transaction(async (tx) => {
    if (children.length > 0) {
      await tx.reportingStructure.updateMany({
        where: {
          managerId: userId,
          ...contextWhere(context),
          isActive: true,
        },
        data: {
          managerId: parentId || null,
        },
      });
    }

    await tx.reportingStructure.delete({ where: { id: row.id } });
  });

  for (const child of children) {
    await recalcSubtree(child.userId, context);
  }

  invalidateTreeCache();
}

async function moveUser(userId, newManagerId, createdById, contextInput) {
  if (userId === newManagerId) {
    throw new Error('User cannot report to themselves');
  }

  const context = await resolveDepartmentContext(userId, contextInput, {
    requireContext: true,
    allowInference: false,
  });

  const managerExists = await prisma.userLogin.findUnique({ where: { id: newManagerId } });
  if (!managerExists) {
    throw new Error('New manager not found');
  }

  const hasCircularDependency = await checkCircularDependency(userId, newManagerId, context);
  if (hasCircularDependency) {
    throw new Error('This assignment would create a circular reporting structure');
  }

  let oldParentId = null;

  await prisma.$transaction(async (tx) => {
    const currentRow = await findReportingRecord(userId, context, {
      tx,
      activeOnly: false,
    });

    oldParentId = currentRow?.managerId || null;

    await tx.reportingStructure.updateMany({
      where: {
        managerId: userId,
        ...contextWhere(context),
        isActive: true,
      },
      data: {
        managerId: oldParentId,
      },
    });

    await ensureManagerRow(tx, newManagerId, createdById, context);

    if (!currentRow) {
      await tx.reportingStructure.create({
        data: {
          userId,
          departmentScope: context.departmentScope,
          departmentId: context.departmentId,
          managerId: newManagerId,
          hierarchyDepth: 0,
          hierarchyPath: userId,
          createdById,
          isActive: true,
        },
      });
    } else {
      await tx.reportingStructure.update({
        where: { id: currentRow.id },
        data: {
          managerId: newManagerId,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }

    await recalcSubtree(userId, context, tx);
    if (oldParentId) {
      await recalcSubtree(oldParentId, context, tx);
    }
  });

  invalidateTreeCache();

  return findReportingRecord(userId, context, {
    include: {
      user: { include: { employeeDetails: true } },
      manager: { include: { employeeDetails: true } },
    },
    activeOnly: false,
  });
}

async function removeReportingManager(userId, contextInput = null) {
  const context = await resolveDepartmentContext(userId, contextInput, {
    requireContext: false,
    allowInference: true,
  });

  const row = await findReportingRecord(userId, context, {
    activeOnly: false,
  });

  if (!row) return;

  await prisma.reportingStructure.update({
    where: { id: row.id },
    data: {
      managerId: null,
      hierarchyDepth: 0,
      hierarchyPath: userId,
    },
  });

  const children = await prisma.reportingStructure.findMany({
    where: {
      managerId: userId,
      ...contextWhere(context),
      isActive: true,
    },
    select: { userId: true },
  });

  for (const child of children) {
    await recalcSubtree(child.userId, context);
  }

  invalidateTreeCache();
}

async function loadDepartmentMaps(rows) {
  const schoolIds = new Set();
  const centralIds = new Set();

  for (const row of rows) {
    if (row.departmentScope === 'school' && row.departmentId) {
      schoolIds.add(row.departmentId);
    }

    if (row.departmentScope === 'central' && row.departmentId) {
      centralIds.add(row.departmentId);
    }
  }

  const [schoolDepartments, centralDepartments] = await Promise.all([
    schoolIds.size > 0
      ? prisma.department.findMany({
        where: { id: { in: [...schoolIds] } },
        select: {
          id: true,
          departmentName: true,
          departmentCode: true,
        },
      })
      : [],
    centralIds.size > 0
      ? prisma.centralDepartment.findMany({
        where: { id: { in: [...centralIds] } },
        select: {
          id: true,
          departmentName: true,
          departmentCode: true,
          departmentType: true,
        },
      })
      : [],
  ]);

  const map = new Map();

  for (const item of schoolDepartments) {
    map.set(`school:${item.id}`, {
      name: item.departmentName,
      code: item.departmentCode || null,
      type: null,
    });
  }

  for (const item of centralDepartments) {
    map.set(`central:${item.id}`, {
      name: item.departmentName,
      code: item.departmentCode || null,
      type: item.departmentType || null,
    });
  }

  return map;
}

function resolveRowContext(row) {
  if (row.departmentScope && row.departmentId) {
    return {
      departmentScope: row.departmentScope,
      departmentId: row.departmentId,
    };
  }

  const schoolId = row.user?.employeeDetails?.primaryDepartment?.id;
  if (schoolId) {
    return {
      departmentScope: 'school',
      departmentId: schoolId,
    };
  }

  const centralId = row.user?.employeeDetails?.primaryCentralDept?.id;
  if (centralId) {
    return {
      departmentScope: 'central',
      departmentId: centralId,
    };
  }

  return null;
}

function buildTree(rows, departmentMap) {
  const nodeMap = new Map();
  const roots = [];

  for (const row of rows) {
    const rowContext = resolveRowContext(row);
    const key = nodeKey(row.userId, rowContext);

    const meta = rowContext
      ? departmentMap.get(`${rowContext.departmentScope}:${rowContext.departmentId}`)
      : null;

    const schoolDepartment = row.user?.employeeDetails?.primaryDepartment;
    const centralDepartment = row.user?.employeeDetails?.primaryCentralDept;

    const fallbackDepartmentName = schoolDepartment?.departmentName || centralDepartment?.departmentName || null;
    const fallbackDepartmentCode = schoolDepartment?.departmentCode || centralDepartment?.departmentCode || null;

    nodeMap.set(key, {
      id: row.id,
      userId: row.userId,
      name: row.user?.employeeDetails?.displayName
        || `${row.user?.employeeDetails?.firstName || ''} ${row.user?.employeeDetails?.lastName || ''}`.trim()
        || row.user?.email,
      email: row.user?.email,
      uid: row.user?.uid,
      empId: row.user?.employeeDetails?.empId,
      department: meta?.name || fallbackDepartmentName,
      departmentId: rowContext?.departmentId || null,
      departmentScope: rowContext?.departmentScope || null,
      departmentCode: meta?.code || fallbackDepartmentCode,
      departmentType: meta?.type || centralDepartment?.departmentType || null,
      school: row.user?.employeeDetails?.primarySchool?.facultyName,
      managerId: row.managerId,
      hierarchyDepth: row.hierarchyDepth || 0,
      children: [],
      _ctx: rowContext,
    });
  }

  for (const row of rows) {
    const rowContext = resolveRowContext(row);
    const key = nodeKey(row.userId, rowContext);
    const node = nodeMap.get(key);

    if (!node) continue;

    if (row.managerId) {
      const parentKey = nodeKey(row.managerId, rowContext);
      const parent = nodeMap.get(parentKey);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  function assignTreeDepth(node, depth = 0) {
    node.hierarchyDepth = depth;
    for (const child of node.children) {
      assignTreeDepth(child, depth + 1);
    }
  }

  for (const root of roots) {
    assignTreeDepth(root, 0);
  }

  function stripPrivate(node) {
    return {
      id: node.id,
      userId: node.userId,
      name: node.name,
      email: node.email,
      uid: node.uid,
      empId: node.empId,
      department: node.department,
      departmentId: node.departmentId,
      departmentScope: node.departmentScope,
      departmentCode: node.departmentCode,
      departmentType: node.departmentType,
      school: node.school,
      managerId: node.managerId,
      hierarchyDepth: node.hierarchyDepth,
      children: node.children.map(stripPrivate),
    };
  }

  return roots.map(stripPrivate);
}

async function getHierarchyTree(contextInput = null) {
  const context = normalizeDepartmentContext(contextInput, { required: false });
  const key = contextCacheKey(context);

  const cached = _treeCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const rows = await prisma.reportingStructure.findMany({
    where: {
      isActive: true,
      ...contextWhere(context),
    },
    include: {
      user: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          employeeDetails: {
            select: {
              displayName: true,
              firstName: true,
              lastName: true,
              empId: true,
              primaryDepartment: {
                select: {
                  id: true,
                  departmentName: true,
                  departmentCode: true,
                },
              },
              primaryCentralDept: {
                select: {
                  id: true,
                  departmentName: true,
                  departmentCode: true,
                  departmentType: true,
                },
              },
              primarySchool: {
                select: {
                  facultyName: true,
                },
              },
            },
          },
        },
      },
      manager: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          employeeDetails: {
            select: {
              displayName: true,
              empId: true,
            },
          },
        },
      },
    },
    orderBy: [
      { hierarchyDepth: 'asc' },
      { updatedAt: 'desc' },
    ],
  });

  const departmentMap = await loadDepartmentMaps(rows);
  const tree = buildTree(rows, departmentMap);

  _treeCache.set(key, {
    data: tree,
    ts: Date.now(),
  });

  return tree;
}

async function hasReportingStructure(userId, contextInput = null) {
  const context = await resolveDepartmentContext(userId, contextInput, {
    requireContext: false,
    allowInference: true,
  });

  const row = await findReportingRecord(userId, context, {
    activeOnly: true,
  });

  if (row) return true;

  if (!contextInput) {
    return !!(await findReportingRecord(userId, null, { activeOnly: true }));
  }

  return false;
}

async function getReportingStatistics(contextInput = null) {
  const context = normalizeDepartmentContext(contextInput, { required: false });

  const where = {
    isActive: true,
    ...contextWhere(context),
  };

  const [totalUsers, topLevelManagers, maxDepth] = await Promise.all([
    prisma.reportingStructure.count({ where }),
    prisma.reportingStructure.count({ where: { ...where, managerId: null } }),
    prisma.reportingStructure.aggregate({
      where,
      _max: { hierarchyDepth: true },
    }),
  ]);

  return {
    totalUsersInStructure: totalUsers,
    topLevelManagers,
    maxHierarchyDepth: maxDepth._max.hierarchyDepth || 0,
  };
}

function findNodeLevel(nodes, userId, context) {
  for (const node of nodes) {
    const sameUser = node.userId === userId;
    const sameContext = !context
      || (
        node.departmentScope === context.departmentScope
        && node.departmentId === context.departmentId
      );

    if (sameUser && sameContext) {
      return node.hierarchyDepth;
    }

    if (node.children?.length) {
      const found = findNodeLevel(node.children, userId, context);
      if (found !== null) return found;
    }
  }

  return null;
}

async function getUserHierarchyInfo(userId, contextInput = null) {
  const context = await resolveDepartmentContext(userId, contextInput, {
    requireContext: false,
    allowInference: true,
  });

  const row = await findReportingRecord(userId, context, {
    include: {
      manager: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              displayName: true,
              empId: true,
            },
          },
        },
      },
    },
    activeOnly: true,
  });

  if (!row && !contextInput) {
    return getUserHierarchyInfo(userId, {
      departmentScope: context?.departmentScope,
      departmentId: context?.departmentId,
    });
  }

  if (!row) return null;

  const effectiveContext = {
    departmentScope: row.departmentScope,
    departmentId: row.departmentId,
  };

  const subordinateCount = await prisma.reportingStructure.count({
    where: {
      managerId: userId,
      ...contextWhere(effectiveContext),
      isActive: true,
    },
  });

  let currentLevel = row.hierarchyDepth;
  try {
    const tree = await getHierarchyTree(effectiveContext);
    const found = findNodeLevel(tree, userId, effectiveContext);
    if (found !== null) currentLevel = found;
  } catch {
    // keep db depth fallback
  }

  const managerName = row.manager?.employeeDetails?.displayName || row.manager?.email || null;

  return {
    isInHierarchy: true,
    currentLevel,
    parentId: row.managerId,
    parentName: managerName,
    subordinateCount,
    hierarchyPath: row.hierarchyPath,
  };
}

async function getBulkHierarchyInfo(userIds, contextInput = null) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return {};
  }

  const context = normalizeDepartmentContext(contextInput, { required: false });

  const rows = await prisma.reportingStructure.findMany({
    where: {
      userId: { in: userIds },
      ...contextWhere(context),
      isActive: true,
    },
    include: {
      manager: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              displayName: true,
              empId: true,
            },
          },
        },
      },
    },
  });

  const subordinateCounts = await prisma.reportingStructure.groupBy({
    by: ['managerId'],
    where: {
      managerId: { in: userIds },
      ...contextWhere(context),
      isActive: true,
    },
    _count: true,
  });

  const subordinateMap = {};
  for (const item of subordinateCounts) {
    subordinateMap[item.managerId] = item._count;
  }

  const levelMap = {};
  try {
    const tree = await getHierarchyTree(context);
    const walk = (nodes) => {
      for (const node of nodes) {
        const key = context
          ? nodeKey(node.userId, context)
          : nodeKey(node.userId, {
            departmentScope: node.departmentScope,
            departmentId: node.departmentId,
          });

        if (!(key in levelMap)) {
          levelMap[key] = node.hierarchyDepth;
        }

        if (node.children?.length) {
          walk(node.children);
        }
      }
    };

    walk(tree);
  } catch {
    // no-op fallback to db depth
  }

  const result = {};
  for (const userId of userIds) {
    const row = rows.find((item) => item.userId === userId);

    if (!row) {
      result[userId] = null;
      continue;
    }

    const key = context
      ? nodeKey(userId, context)
      : nodeKey(userId, {
        departmentScope: row.departmentScope,
        departmentId: row.departmentId,
      });

    result[userId] = {
      isInHierarchy: true,
      currentLevel: levelMap[key] ?? row.hierarchyDepth,
      parentId: row.managerId,
      parentName: row.manager?.employeeDetails?.displayName || row.manager?.email || null,
      subordinateCount: subordinateMap[userId] || 0,
      hierarchyPath: row.hierarchyPath,
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