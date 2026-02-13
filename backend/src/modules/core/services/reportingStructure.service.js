/**
 * Reporting Structure Service
 * Manages hierarchical reporting relationships for noting workflow
 */

const prisma = require('../../../shared/config/database');

/**
 * Get user's direct manager
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Manager user object or null
 */
async function getDirectManager(userId) {
  const reporting = await prisma.reportingStructure.findUnique({
    where: { userId },
    include: {
      manager: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          employeeDetails: true,
          assignedRoleIds: true,
          schoolDeptPermissions: {
            where: { isActive: true },
            select: {
              permissions: true
            }
          },
          centralDeptPermissions: {
            where: { isActive: true },
            select: {
              permissions: true
            }
          }
        }
      }
    }
  });
  
  return reporting?.manager || null;
}

/**
 * Get full reporting chain (bottom to top)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of managers from immediate to top level
 */
async function getReportingChain(userId) {
  const chain = [];
  let currentUserId = userId;
  const visited = new Set(); // Prevent infinite loops
  
  while (currentUserId && !visited.has(currentUserId)) {
    visited.add(currentUserId);
    
    const reporting = await prisma.reportingStructure.findUnique({
      where: { userId: currentUserId },
      include: {
        manager: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
            employeeDetails: true,
            schoolDeptPermissions: true,
            centralDeptPermissions: true
          }
        }
      }
    });
    
    if (!reporting || !reporting.manager) break;
    
    chain.push({
      id: reporting.manager.id,
      uid: reporting.manager.uid,
      email: reporting.manager.email,
      name: reporting.manager.employeeDetails?.displayName || 
            `${reporting.manager.employeeDetails?.firstName || ''} ${reporting.manager.employeeDetails?.lastName || ''}`.trim(),
      roleCode: reporting.manager.role?.roleCode,
      hierarchyDepth: reporting.hierarchyDepth,
      schoolDeptPermissions: reporting.manager.schoolDeptPermissions,
      centralDeptPermissions: reporting.manager.centralDeptPermissions
    });
    
    currentUserId = reporting.managerId;
  }
  
  return chain; // [immediate manager, grand manager, ...]
}

/**
 * Get all direct reports of a manager
 * @param {string} managerId - Manager's user ID
 * @returns {Promise<Array>} Array of direct report users
 */
async function getDirectReports(managerId) {
  const reports = await prisma.reportingStructure.findMany({
    where: { 
      managerId,
      isActive: true
    },
    include: {
      user: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          employeeDetails: true
        }
      }
    }
  });
  
  return reports.map(r => r.user);
}

/**
 * Set reporting relationship
 * Validates: no circular dependency, manager exists
 * @param {string} userId - Employee user ID
 * @param {string} managerId - Manager user ID
 * @param {string} createdById - User creating the relationship
 * @returns {Promise<Object>} Created/updated reporting structure
 */
async function setReportingManager(userId, managerId, createdById) {
  // Validation 1: Can't report to self
  if (userId === managerId) {
    throw new Error('User cannot report to themselves');
  }
  
  // Validation 2: Check if manager exists
  const manager = await prisma.userLogin.findUnique({
    where: { id: managerId }
  });
  
  if (!manager) {
    throw new Error('Manager not found');
  }
  
  // Validation 3: Check for circular dependency
  const wouldCreateCircular = await checkCircularDependency(userId, managerId);
  if (wouldCreateCircular) {
    throw new Error('This assignment would create a circular reporting structure');
  }
  
  // Calculate hierarchy depth
  const managerReporting = await prisma.reportingStructure.findUnique({
    where: { userId: managerId }
  });
  
  const hierarchyDepth = managerReporting ? managerReporting.hierarchyDepth + 1 : 1;
  
  // Calculate hierarchy path
  const managerPath = managerReporting?.hierarchyPath || managerId;
  const hierarchyPath = `${userId},${managerPath}`;
  
  console.log('📊 Creating reporting structure:', {
    userId,
    managerId,
    hierarchyDepth,
    hierarchyPath,
    createdById
  });
  
  // Upsert reporting structure
  const reporting = await prisma.reportingStructure.upsert({
    where: { userId },
    update: {
      managerId,
      hierarchyDepth,
      hierarchyPath,
      updatedAt: new Date()
    },
    create: {
      userId,
      managerId,
      hierarchyDepth,
      hierarchyPath,
      createdById
    },
    include: {
      user: {
        include: {
          employeeDetails: true
        }
      },
      manager: {
        include: {
          employeeDetails: true
        }
      }
    }
  });
  
  console.log('✅ Reporting structure saved:', {
    id: reporting.id,
    userId: reporting.userId,
    managerId: reporting.managerId,
    hierarchyDepth: reporting.hierarchyDepth
  });
  
  // Update all subordinates' hierarchy depth and path
  await updateSubordinatesHierarchy(userId);
  
  return reporting;
}

/**
 * Assign multi-level manager chain (up to 5 levels)
 * Creates complete reporting hierarchy in one operation
 * Example: Employee → Manager1 → Manager2 → Manager3
 * 
 * @param {string} userId - Employee user ID (bottom of hierarchy)
 * @param {string[]} managerChain - Array of manager IDs [Level1, Level2, Level3, ...]
 * @param {string} createdById - User creating the relationships
 * @returns {Promise<Object>} Summary of created relationships
 */
async function assignManagerChain(userId, managerChain, createdById) {
  // Validate inputs
  if (!userId || !Array.isArray(managerChain) || managerChain.length === 0) {
    throw new Error('User ID and manager chain array are required');
  }

  if (managerChain.length > 5) {
    throw new Error('Maximum 5 hierarchy levels allowed');
  }

  // Check all users exist
  const allUserIds = [userId, ...managerChain];
  const users = await prisma.userLogin.findMany({
    where: { id: { in: allUserIds } },
    select: { id: true }
  });

  if (users.length !== allUserIds.length) {
    throw new Error('One or more users in the chain do not exist');
  }

  // Check for circular dependencies across the chain
  for (let i = 0; i < managerChain.length; i++) {
    for (let j = i + 1; j < managerChain.length; j++) {
      // Check if higher level manager is already reporting to lower level
      const wouldCreateCircular = await checkCircularDependency(managerChain[j], managerChain[i]);
      if (wouldCreateCircular) {
        throw new Error(`Circular dependency detected: Level ${j + 1} cannot report to Level ${i + 1}`);
      }
    }
  }

  const createdRelationships = [];

  // Create relationships from bottom to top
  // Level 1: Employee → Manager1
  // Level 2: Manager1 → Manager2
  // Level 3: Manager2 → Manager3
  // etc.

  let currentEmployee = userId;
  
  for (let level = 0; level < managerChain.length; level++) {
    const currentManager = managerChain[level];
    const hierarchyDepth = level + 1;
    
    // Build hierarchy path
    // For Employee: [userId, manager1, manager2, ...]
    // For Manager1: [manager1, manager2, manager3, ...]
    const pathArray = [currentEmployee, ...managerChain.slice(level)];
    const hierarchyPath = pathArray.join(',');

    console.log(`📊 Creating Level ${level + 1} relationship:`, {
      employee: currentEmployee,
      manager: currentManager,
      depth: hierarchyDepth,
      path: hierarchyPath
    });

    // Upsert reporting structure
    const reporting = await prisma.reportingStructure.upsert({
      where: { userId: currentEmployee },
      update: {
        managerId: currentManager,
        hierarchyDepth,
        hierarchyPath,
        updatedAt: new Date()
      },
      create: {
        userId: currentEmployee,
        managerId: currentManager,
        hierarchyDepth,
        hierarchyPath,
        createdById
      },
      include: {
        user: {
          include: {
            employeeDetails: true
          }
        },
        manager: {
          include: {
            employeeDetails: true
          }
        }
      }
    });

    createdRelationships.push(reporting);

    console.log(`✅ Level ${level + 1} relationship created:`, {
      id: reporting.id,
      employee: currentEmployee,
      manager: currentManager
    });

    // Move up the chain: next iteration will set Manager1's manager to Manager2
    currentEmployee = currentManager;
  }

  // Update subordinates for the bottom employee
  await updateSubordinatesHierarchy(userId);

  return {
    created: createdRelationships.length,
    relationships: createdRelationships
  };
}

/**
 * Update hierarchy depth and path for all subordinates recursively
 * @param {string} userId - User whose subordinates need updating
 */
async function updateSubordinatesHierarchy(userId) {
  const directReports = await prisma.reportingStructure.findMany({
    where: { managerId: userId }
  });
  
  for (const report of directReports) {
    const userReporting = await prisma.reportingStructure.findUnique({
      where: { userId: report.userId }
    });
    
    if (!userReporting) continue;
    
    const managerReporting = await prisma.reportingStructure.findUnique({
      where: { userId }
    });
    
    const newDepth = managerReporting ? managerReporting.hierarchyDepth + 1 : 1;
    const newPath = managerReporting?.hierarchyPath 
      ? `${report.userId},${managerReporting.hierarchyPath}`
      : `${report.userId},${userId}`;
    
    await prisma.reportingStructure.update({
      where: { userId: report.userId },
      data: {
        hierarchyDepth: newDepth,
        hierarchyPath: newPath
      }
    });
    
    // Recursively update this user's subordinates
    await updateSubordinatesHierarchy(report.userId);
  }
}

/**
 * Check if assignment would create circular dependency
 * @param {string} userId - Employee user ID
 * @param {string} managerId - Proposed manager user ID
 * @returns {Promise<boolean>} True if circular, false otherwise
 */
async function checkCircularDependency(userId, managerId) {
  // Walk up manager's chain - if we encounter userId, it's circular
  let currentManagerId = managerId;
  const visited = new Set();
  
  while (currentManagerId && !visited.has(currentManagerId)) {
    if (currentManagerId === userId) {
      return true; // Circular!
    }
    
    visited.add(currentManagerId);
    
    const reporting = await prisma.reportingStructure.findUnique({
      where: { userId: currentManagerId }
    });
    
    currentManagerId = reporting?.managerId;
  }
  
  return false;
}

/**
 * Remove reporting relationship (make user top-level)
 * @param {string} userId - User ID
 */
async function removeReportingManager(userId) {
  await prisma.reportingStructure.update({
    where: { userId },
    data: {
      managerId: null,
      hierarchyDepth: 0,
      hierarchyPath: userId
    }
  });
  
  // Update all subordinates
  await updateSubordinatesHierarchy(userId);
}

/**
 * Get hierarchy tree for visualization
 * @returns {Promise<Array>} Tree structure with nested children
 */
async function getHierarchyTree() {
  const allReporting = await prisma.reportingStructure.findMany({
    where: { isActive: true },
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
              empId: true,
              primaryDepartment: {
                select: {
                  departmentName: true
                }
              },
              primarySchool: {
                select: {
                  facultyName: true
                }
              }
            }
          }
        }
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
              empId: true
            }
          }
        }
      }
    },
    orderBy: { hierarchyDepth: 'asc' }
  });
  
  // Build tree structure
  const tree = buildTree(allReporting);
  
  return tree;
}

/**
 * Build tree structure from flat reporting list
 * @param {Array} reportingList - Flat list of reporting structures
 * @returns {Array} Tree roots
 */
function buildTree(reportingList) {
  const nodeMap = new Map();
  const roots = [];
  
  // Create nodes
  reportingList.forEach(r => {
    nodeMap.set(r.userId, {
      id: r.id,
      userId: r.userId,
      name: r.user.employeeDetails?.displayName || 
            `${r.user.employeeDetails?.firstName || ''} ${r.user.employeeDetails?.lastName || ''}`.trim() ||
            r.user.email,
      email: r.user.email,
      uid: r.user.uid,
      empId: r.user.employeeDetails?.empId,
      department: r.user.employeeDetails?.primaryDepartment?.departmentName,
      school: r.user.employeeDetails?.primarySchool?.facultyName,
      managerId: r.managerId,
      hierarchyDepth: r.hierarchyDepth,
      children: []
    });
  });
  
  // Link children to parents
  reportingList.forEach(r => {
    const node = nodeMap.get(r.userId);
    if (r.managerId && nodeMap.has(r.managerId)) {
      nodeMap.get(r.managerId).children.push(node);
    } else {
      roots.push(node); // No manager = root
    }
  });
  
  return roots;
}

/**
 * Check if user has reporting structure configured
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
async function hasReportingStructure(userId) {
  const reporting = await prisma.reportingStructure.findUnique({
    where: { userId }
  });
  
  return !!reporting;
}

/**
 * Get reporting statistics
 * @returns {Promise<Object>} Statistics object
 */
async function getReportingStatistics() {
  const totalUsers = await prisma.reportingStructure.count({
    where: { isActive: true }
  });
  
  const topLevelManagers = await prisma.reportingStructure.count({
    where: {
      isActive: true,
      managerId: null
    }
  });
  
  const maxDepth = await prisma.reportingStructure.aggregate({
    where: { isActive: true },
    _max: {
      hierarchyDepth: true
    }
  });
  
  return {
    totalUsersInStructure: totalUsers,
    topLevelManagers,
    maxHierarchyDepth: maxDepth._max.hierarchyDepth || 0
  };
}

module.exports = {
  getDirectManager,
  getReportingChain,
  getDirectReports,
  setReportingManager,
  assignManagerChain,
  removeReportingManager,
  checkCircularDependency,
  getHierarchyTree,
  hasReportingStructure,
  getReportingStatistics,
  updateSubordinatesHierarchy
};
