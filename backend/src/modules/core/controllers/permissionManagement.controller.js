const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const {
  getSchoolDeptPermissions,
  getCentralDeptPermissions,
  getAllCentralDeptPermissions,
} = require('../config/permissionDefinitions');
const { logPermissionChange, logDataExport, getIp } = require('../../../shared/utils/auditLogger');
const {
  getSupportedCentralDeptAnalyticsScopeFields,
  withSupportedAnalyticsScopeFields,
  pickSupportedAnalyticsScopeFields,
} = require('../../../shared/utils/centralDeptAnalyticsScopeSupport');

/**
 * Get available permission definitions
 */
exports.getPermissionDefinitions = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        schoolDepartments: getSchoolDeptPermissions(),
        centralDepartments: getAllCentralDeptPermissions(),
      },
    });
  } catch (error) {
    console.error('Get permission definitions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permission definitions',
    });
  }
};

/**
 * Get all permissions for a user (both school departments and central departments)
 */
exports.getUserAllPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check authorization
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these permissions',
      });
    }

    // Get user with assigned roles (role assignment feature not implemented)
    const userWithRoles = null;

    // Fetch direct permissions and employee details
    const [schoolDeptPerms, centralDeptPerms, employee] = await Promise.all([
      // School department permissions
      prisma.departmentPermission.findMany({
        where: { userId, isActive: true },
        include: {
          department: {
            select: {
              id: true,
              departmentCode: true,
              departmentName: true,
              shortName: true,
              faculty: {
                select: {
                  facultyCode: true,
                  facultyName: true,
                },
              },
            },
          },
          assignedByUser: {
            select: {
              uid: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      }),
      // Central department permissions (direct only)
      prisma.centralDepartmentPermission.findMany({
        where: { userId, isActive: true },
        include: {
          centralDept: {
            select: {
              id: true,
              departmentCode: true,
              departmentName: true,
              shortName: true,
              departmentType: true,
            },
          },
          assignedByUser: {
            select: {
              uid: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      }),
      // Employee details for primary department
      prisma.employeeDetails.findFirst({
        where: { userLoginId: userId },
        select: {
          primaryDepartmentId: true,
          primaryCentralDeptId: true,
          primaryDepartment: {
            select: {
              departmentCode: true,
              departmentName: true,
            },
          },
          primaryCentralDept: {
            select: {
              departmentCode: true,
              departmentName: true,
            },
          },
        },
      }),
    ]);

    // Fetch role-based permissions (role assignment feature not implemented)
    const roleIds = [];
    let rolesWithPermissions = [];
    
    if (Array.isArray(roleIds) && roleIds.length > 0) {
      rolesWithPermissions = await prisma.role.findMany({
        where: {
          id: { in: roleIds },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          roleCode: true,
          departmentType: true,
          permissions: true,
        },
      });
    }

    // Create virtual permission entries for role-based permissions
    const mergedCentralDeptPerms = [...centralDeptPerms];
    const mergedSchoolDeptPerms = [...schoolDeptPerms];

    rolesWithPermissions.forEach(role => {
      const rolePerms = role.permissions || {};
      
      // Add central department permissions from role
      if (rolePerms.centralDeptPermissions && Object.keys(rolePerms.centralDeptPermissions).length > 0) {
        mergedCentralDeptPerms.push({
          id: `role-${role.id}`,
          userId: userId,
          centralDeptId: `role-${role.id}`,
          permissions: rolePerms.centralDeptPermissions,
          isPrimary: false,
          isActive: true,
          assignedAt: null,
          assignedBy: null,
          centralDept: {
            id: `role-${role.id}`,
            departmentCode: role.roleCode || `ROLE-${role.id}`,
            departmentName: `From Role: ${role.name}`,
            shortName: role.roleCode || role.name,
            departmentType: role.departmentType || 'central_department',
          },
          assignedByUser: null,
          fromRole: true,
          roleName: role.name,
          roleCode: role.roleCode,
        });
      }

      // Add school department permissions from role
      if (rolePerms.schoolDeptPermissions && Object.keys(rolePerms.schoolDeptPermissions).length > 0) {
        mergedSchoolDeptPerms.push({
          id: `role-${role.id}`,
          userId: userId,
          departmentId: `role-${role.id}`,
          permissions: rolePerms.schoolDeptPermissions,
          isPrimary: false,
          isActive: true,
          assignedAt: null,
          assignedBy: null,
          department: {
            id: `role-${role.id}`,
            departmentCode: role.roleCode || `ROLE-${role.id}`,
            departmentName: `From Role: ${role.name}`,
            shortName: role.roleCode || role.name,
            faculty: null,
          },
          assignedByUser: null,
          fromRole: true,
          roleName: role.name,
          roleCode: role.roleCode,
        });
      }
    });

    res.json({
      success: true,
      data: {
        schoolDepartments: mergedSchoolDeptPerms,
        centralDepartments: mergedCentralDeptPerms,
        primaryDepartment: employee?.primaryDepartment || null,
        primaryCentralDepartment: employee?.primaryCentralDept || null,
      },
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch permissions',
    });
  }
};

/**
 * Grant school department permissions to a user
 */
exports.grantSchoolDeptPermissions = async (req, res) => {
  try {
    const { userId, departmentId, permissions, isPrimary } = req.body;

    if (!userId || !departmentId || !permissions) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userId, departmentId, and permissions',
      });
    }

    // Only admin can grant permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to grant permissions',
      });
    }

    // If setting as primary, unset other primary flags for this user
    if (isPrimary) {
      await prisma.departmentPermission.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });

      // Also update employee's primary department
      await prisma.employeeDetails.updateMany({
        where: { userLoginId: userId },
        data: {
          primaryDepartmentId: departmentId,
          primaryCentralDeptId: null,
        },
      });
    }

    const permission = await prisma.departmentPermission.upsert({
      where: {
        userId_departmentId: {
          userId,
          departmentId,
        },
      },
      update: {
        permissions,
        isPrimary: isPrimary || false,
        isActive: true,
        assignedBy: req.user.id,
        assignedAt: new Date(),
      },
      create: {
        userId,
        departmentId,
        permissions,
        isPrimary: isPrimary || false,
        isActive: true,
        assignedBy: req.user.id,
      },
      include: {
        department: {
          select: {
            departmentCode: true,
            departmentName: true,
          },
        },
      },
    });

    // Audit log - OLD METHOD (replace with comprehensive logging)
    // await prisma.auditLog.create({
    //   data: {
    //     actorId: req.user.id,
    //     action: 'GRANT_SCHOOL_DEPT_PERMISSIONS',
    //     targetTable: 'department_permission',
    //     targetId: permission.id,
    //     details: { userId, departmentId, permissions, isPrimary },
    //   },
    // });

    // === COMPREHENSIVE AUDIT LOGGING ===
    const targetUser = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: { 
        uid: true, 
        email: true,
        employeeDetails: { select: { displayName: true } }
      }
    });
    
    await logPermissionChange(
      targetUser,
      {
        type: 'school_department',
        departmentId,
        departmentName: permission.department?.departmentName,
        permissions,
        isPrimary
      },
      req.user.id,
      req
    );
    // === END AUDIT LOGGING ===

    // Invalidate user cache so new permissions take effect immediately
    await cache.invalidateUser(userId);

    res.json({
      success: true,
      message: 'School department permissions granted successfully',
      data: permission,
    });
  } catch (error) {
    console.error('Grant school dept permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grant permissions',
    });
  }
};

/**
 * Grant central department permissions to a user
 */
exports.grantCentralDeptPermissions = async (req, res) => {
  try {
    const supportedAnalyticsScopeFields = await getSupportedCentralDeptAnalyticsScopeFields(prisma);
    const { 
      userId, 
      centralDeptId, 
      permissions, 
      isPrimary,
      assignedMonthlyReportSchoolIds,
      assignedMonthlyReportDepartmentIds,
      assignedIprAnalyticsSchoolIds,
      assignedResearchAnalyticsSchoolIds,
      assignedBookAnalyticsSchoolIds,
      assignedConferenceAnalyticsSchoolIds,
      assignedGrantAnalyticsSchoolIds,
      assignedIprAnalyticsDepartmentIds,
      assignedResearchAnalyticsDepartmentIds,
      assignedBookAnalyticsDepartmentIds,
      assignedConferenceAnalyticsDepartmentIds,
      assignedGrantAnalyticsDepartmentIds,
      assignedDrdMemberAnalyticsSchoolIds,
      assignedDrdMemberAnalyticsDepartmentIds,
    } = req.body;

    if (!userId || !centralDeptId || !permissions) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userId, centralDeptId, and permissions',
      });
    }

    // Only admin can grant permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to grant permissions',
      });
    }

    // If setting as primary, unset other primary flags for this user
    if (isPrimary) {
      await prisma.centralDepartmentPermission.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });

      // Also update employee's primary central department
      await prisma.employeeDetails.updateMany({
        where: { userLoginId: userId },
        data: {
          primaryCentralDeptId: centralDeptId,
          primaryDepartmentId: null,
        },
      });
    }

    // Prepare data for upsert with optional monthly report scope fields
    const updateData = {
      permissions,
      isPrimary: isPrimary || false,
      isActive: true,
      assignedBy: req.user.id,
      assignedAt: new Date(),
    };

    const createData = {
      userId,
      centralDeptId,
      permissions,
      isPrimary: isPrimary || false,
      isActive: true,
      assignedBy: req.user.id,
    };

    // Add monthly report scope if provided
    if (assignedMonthlyReportSchoolIds !== undefined) {
      updateData.assignedMonthlyReportSchoolIds = assignedMonthlyReportSchoolIds || [];
      createData.assignedMonthlyReportSchoolIds = assignedMonthlyReportSchoolIds || [];
    }

    if (assignedMonthlyReportDepartmentIds !== undefined) {
      updateData.assignedMonthlyReportDepartmentIds = assignedMonthlyReportDepartmentIds || [];
      createData.assignedMonthlyReportDepartmentIds = assignedMonthlyReportDepartmentIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedIprAnalyticsSchoolIds') && assignedIprAnalyticsSchoolIds !== undefined) {
      updateData.assignedIprAnalyticsSchoolIds = assignedIprAnalyticsSchoolIds || [];
      createData.assignedIprAnalyticsSchoolIds = assignedIprAnalyticsSchoolIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedResearchAnalyticsSchoolIds') && assignedResearchAnalyticsSchoolIds !== undefined) {
      updateData.assignedResearchAnalyticsSchoolIds = assignedResearchAnalyticsSchoolIds || [];
      createData.assignedResearchAnalyticsSchoolIds = assignedResearchAnalyticsSchoolIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedBookAnalyticsSchoolIds') && assignedBookAnalyticsSchoolIds !== undefined) {
      updateData.assignedBookAnalyticsSchoolIds = assignedBookAnalyticsSchoolIds || [];
      createData.assignedBookAnalyticsSchoolIds = assignedBookAnalyticsSchoolIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedConferenceAnalyticsSchoolIds') && assignedConferenceAnalyticsSchoolIds !== undefined) {
      updateData.assignedConferenceAnalyticsSchoolIds = assignedConferenceAnalyticsSchoolIds || [];
      createData.assignedConferenceAnalyticsSchoolIds = assignedConferenceAnalyticsSchoolIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedGrantAnalyticsSchoolIds') && assignedGrantAnalyticsSchoolIds !== undefined) {
      updateData.assignedGrantAnalyticsSchoolIds = assignedGrantAnalyticsSchoolIds || [];
      createData.assignedGrantAnalyticsSchoolIds = assignedGrantAnalyticsSchoolIds || [];
    }

    // Per-category department scope arrays
    if (supportedAnalyticsScopeFields.includes('assignedIprAnalyticsDepartmentIds') && assignedIprAnalyticsDepartmentIds !== undefined) {
      updateData.assignedIprAnalyticsDepartmentIds = assignedIprAnalyticsDepartmentIds || [];
      createData.assignedIprAnalyticsDepartmentIds = assignedIprAnalyticsDepartmentIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedResearchAnalyticsDepartmentIds') && assignedResearchAnalyticsDepartmentIds !== undefined) {
      updateData.assignedResearchAnalyticsDepartmentIds = assignedResearchAnalyticsDepartmentIds || [];
      createData.assignedResearchAnalyticsDepartmentIds = assignedResearchAnalyticsDepartmentIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedBookAnalyticsDepartmentIds') && assignedBookAnalyticsDepartmentIds !== undefined) {
      updateData.assignedBookAnalyticsDepartmentIds = assignedBookAnalyticsDepartmentIds || [];
      createData.assignedBookAnalyticsDepartmentIds = assignedBookAnalyticsDepartmentIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedConferenceAnalyticsDepartmentIds') && assignedConferenceAnalyticsDepartmentIds !== undefined) {
      updateData.assignedConferenceAnalyticsDepartmentIds = assignedConferenceAnalyticsDepartmentIds || [];
      createData.assignedConferenceAnalyticsDepartmentIds = assignedConferenceAnalyticsDepartmentIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedGrantAnalyticsDepartmentIds') && assignedGrantAnalyticsDepartmentIds !== undefined) {
      updateData.assignedGrantAnalyticsDepartmentIds = assignedGrantAnalyticsDepartmentIds || [];
      createData.assignedGrantAnalyticsDepartmentIds = assignedGrantAnalyticsDepartmentIds || [];
    }

    // DRD member analytics scope
    if (supportedAnalyticsScopeFields.includes('assignedDrdMemberAnalyticsSchoolIds') && assignedDrdMemberAnalyticsSchoolIds !== undefined) {
      updateData.assignedDrdMemberAnalyticsSchoolIds = assignedDrdMemberAnalyticsSchoolIds || [];
      createData.assignedDrdMemberAnalyticsSchoolIds = assignedDrdMemberAnalyticsSchoolIds || [];
    }

    if (supportedAnalyticsScopeFields.includes('assignedDrdMemberAnalyticsDepartmentIds') && assignedDrdMemberAnalyticsDepartmentIds !== undefined) {
      updateData.assignedDrdMemberAnalyticsDepartmentIds = assignedDrdMemberAnalyticsDepartmentIds || [];
      createData.assignedDrdMemberAnalyticsDepartmentIds = assignedDrdMemberAnalyticsDepartmentIds || [];
    }

    const permission = await prisma.centralDepartmentPermission.upsert({
      where: {
        userId_centralDeptId: {
          userId,
          centralDeptId,
        },
      },
      update: updateData,
      create: createData,
      include: {
        centralDept: {
          select: {
            departmentCode: true,
            departmentName: true,
          },
        },
      },
    });

    // Audit log - OLD METHOD
    // await prisma.auditLog.create({
    //   data: {
    //     actorId: req.user.id,
    //     action: 'GRANT_CENTRAL_DEPT_PERMISSIONS',
    //     targetTable: 'central_department_permission',
    //     targetId: permission.id,
    //     details: { 
    //       userId, 
    //       centralDeptId, 
    //       permissions, 
    //       isPrimary,
    //       assignedMonthlyReportSchoolIds,
    //       assignedMonthlyReportDepartmentIds 
    //     },
    //   },
    // });

    // === COMPREHENSIVE AUDIT LOGGING ===
    const targetUser = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: { 
        uid: true, 
        email: true,
        employeeDetails: { select: { displayName: true } }
      }
    });
    
    await logPermissionChange(
      targetUser,
      {
        type: 'central_department',
        centralDeptId,
        departmentName: permission.centralDept?.departmentName,
        permissions,
        isPrimary,
        assignedMonthlyReportSchoolIds,
        assignedMonthlyReportDepartmentIds,
        assignedIprAnalyticsSchoolIds,
        assignedResearchAnalyticsSchoolIds,
        assignedBookAnalyticsSchoolIds,
        assignedConferenceAnalyticsSchoolIds,
        assignedGrantAnalyticsSchoolIds,
      },
      req.user.id,
      req
    );
    // === END AUDIT LOGGING ===

    // Invalidate user cache so new permissions take effect immediately
    await cache.invalidateUser(userId);

    res.json({
      success: true,
      message: 'Central department permissions granted successfully',
      data: permission,
    });
  } catch (error) {
    console.error('Grant central dept permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grant permissions',
    });
  }
};

/**
 * Revoke school department permissions
 */
exports.revokeSchoolDeptPermissions = async (req, res) => {
  try {
    const { userId, departmentId } = req.body;

    if (!userId || !departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userId and departmentId',
      });
    }

    // Only admin can revoke permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to revoke permissions',
      });
    }

    await prisma.departmentPermission.update({
      where: {
        userId_departmentId: {
          userId,
          departmentId,
        },
      },
      data: {
        isActive: false,
        isPrimary: false,
      },
    });

    // === COMPREHENSIVE AUDIT LOGGING ===
    const targetUser = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: { 
        uid: true, 
        email: true,
        employeeDetails: { select: { displayName: true } }
      }
    });
    
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { departmentName: true }
    });
    
    await logPermissionChange(
      targetUser,
      {
        type: 'school_department_revoked',
        departmentId,
        departmentName: dept?.departmentName,
        action: 'revoked'
      },
      req.user.id,
      req
    );
    // === END AUDIT LOGGING ===

    // Invalidate user cache so revoked permissions take effect immediately
    await cache.invalidateUser(userId);

    res.json({
      success: true,
      message: 'School department permissions revoked successfully',
    });
  } catch (error) {
    console.error('Revoke school dept permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke permissions',
    });
  }
};

/**
 * Revoke central department permissions
 */
exports.revokeCentralDeptPermissions = async (req, res) => {
  try {
    const { userId, centralDeptId } = req.body;

    if (!userId || !centralDeptId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userId and centralDeptId',
      });
    }

    // Only admin can revoke permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to revoke permissions',
      });
    }

    await prisma.centralDepartmentPermission.update({
      where: {
        userId_centralDeptId: {
          userId,
          centralDeptId,
        },
      },
      data: {
        isActive: false,
        isPrimary: false,
      },
    });

    // Audit log
    // await prisma.auditLog.create({
    //   data: {
    //     actorId: req.user.id,
    //     action: 'REVOKE_CENTRAL_DEPT_PERMISSIONS',
    //     targetTable: 'central_department_permission',
    //     details: { userId, centralDeptId },
    //   },
    // });

    // === COMPREHENSIVE AUDIT LOGGING ===
    const targetUser = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: { 
        uid: true, 
        email: true,
        employeeDetails: { select: { displayName: true } }
      }
    });
    
    const dept = await prisma.centralDepartment.findUnique({
      where: { id: centralDeptId },
      select: { departmentName: true }
    });
    
    await logPermissionChange(
      targetUser,
      {
        type: 'central_department_revoked',
        centralDeptId,
        departmentName: dept?.departmentName,
        action: 'revoked'
      },
      req.user.id,
      req
    );
    // === END AUDIT LOGGING ===

    // Invalidate user cache so revoked permissions take effect immediately
    await cache.invalidateUser(userId);

    res.json({
      success: true,
      message: 'Central department permissions revoked successfully',
    });
  } catch (error) {
    console.error('Revoke central dept permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke permissions',
    });
  }
};

/**
 * Check if user has a specific permission in any department
 */
exports.checkUserPermission = async (req, res) => {
  try {
    const { departmentId, centralDeptId, permissionKey } = req.query;

    if ((!departmentId && !centralDeptId) || !permissionKey) {
      return res.status(400).json({
        success: false,
        message: 'Please provide (departmentId or centralDeptId) and permissionKey',
      });
    }

    let hasPermission = false;

    if (departmentId) {
      const permission = await prisma.departmentPermission.findUnique({
        where: {
          userId_departmentId: {
            userId: req.user.id,
            departmentId,
          },
        },
      });

      hasPermission =
        permission &&
        permission.isActive &&
        permission.permissions &&
        permission.permissions[permissionKey] === true;
    } else if (centralDeptId) {
      const permission = await prisma.centralDepartmentPermission.findUnique({
        where: {
          userId_centralDeptId: {
            userId: req.user.id,
            centralDeptId,
          },
        },
      });

      hasPermission =
        permission &&
        permission.isActive &&
        permission.permissions &&
        permission.permissions[permissionKey] === true;
    }

    res.json({
      success: true,
      hasPermission,
    });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check permission',
    });
  }
};

/**
 * Get all users with their permissions (for admin panel)
 */
exports.getAllUsersWithPermissions = async (req, res) => {
  try {
    const supportedAnalyticsScopeFields = await getSupportedCentralDeptAnalyticsScopeFields(prisma);
    // Only admin can view all users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const users = await prisma.userLogin.findMany({
      where: {
        role: {
          in: ['faculty', 'staff'],
        },
      },
      select: {
        id: true,
        uid: true,
        email: true,
        role: true,
        employeeDetails: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            empId: true,
            designation: true,
            primaryDepartment: {
              select: {
                departmentCode: true,
                departmentName: true,
              },
            },
            primaryCentralDept: {
              select: {
                departmentCode: true,
                departmentName: true,
              },
            },
          },
        },
        schoolDeptPermissions: {
          where: { isActive: true },
          select: {
            id: true,
            departmentId: true,
            isPrimary: true,
            permissions: true,
            department: {
              select: {
                departmentCode: true,
                departmentName: true,
              },
            },
          },
        },
        centralDeptPermissions: {
          where: { isActive: true },
          select: withSupportedAnalyticsScopeFields({
            id: true,
            centralDeptId: true,
            isPrimary: true,
            permissions: true,
            assignedSchoolIds: true,
            assignedResearchSchoolIds: true,
            assignedBookSchoolIds: true,
            assignedConferenceSchoolIds: true,
            assignedGrantSchoolIds: true,
            centralDept: {
              select: {
                departmentCode: true,
                departmentName: true,
              },
            },
          }, supportedAnalyticsScopeFields),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });


    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Get all users with permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
    });
  }
};

/**
 * Assign schools to a DRD member
 * @body { userId, schoolIds: string[] }
 * Accessible by: admin OR DRD Head (users with ipr_approve permission)
 */
exports.assignDrdMemberSchools = async (req, res) => {
  try {
    const { userId, schoolIds } = req.body;

    // Check if user is authorized (admin, DRD Head, or has ipr_assign_school permission)
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.ipr_approve === true || 
             p.permissions?.drd_ipr_approve === true ||
             p.permissions?.ipr_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign schools to DRD members',
      });
    }

    if (!userId || !Array.isArray(schoolIds)) {
      return res.status(400).json({
        success: false,
        message: 'userId and schoolIds array are required',
      });
    }

    // Find the DRD department (search by code, name, or shortName)
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.status(404).json({
        success: false,
        message: 'DRD department not found. Please create a Central Department with code or name containing "DRD".',
      });
    }

    // Find or create the user's DRD permission record
    let drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId,
        centralDeptId: drdDept.id,
      },
    });

    if (drdPermission) {
      // Update existing permission with school assignments
      drdPermission = await prisma.centralDepartmentPermission.update({
        where: { id: drdPermission.id },
        data: {
          assignedSchoolIds: schoolIds,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Create new permission record with school assignments
      drdPermission = await prisma.centralDepartmentPermission.create({
        data: {
          userId,
          centralDeptId: drdDept.id,
          permissions: { ipr_review: true },
          assignedSchoolIds: schoolIds,
          isPrimary: false,
          isActive: true,
          assignedBy: req.user.id,
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'ASSIGN_DRD_MEMBER_SCHOOLS',
        targetTable: 'central_department_permission',
        targetId: drdPermission.id,
        details: { userId, schoolIds },
      },
    });

    res.json({
      success: true,
      message: 'Schools assigned to DRD member successfully',
      data: drdPermission,
    });
  } catch (error) {
    console.error('Assign DRD member schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign schools',
      error: error.message,
    });
  }
};

/**
 * Get all DRD members with their assigned schools
 * Accessible by: admin OR DRD Head (users with ipr_approve permission)
 */
exports.getDrdMembersWithSchools = async (req, res) => {
  try {
    const supportedAnalyticsScopeFields = await getSupportedCentralDeptAnalyticsScopeFields(prisma);
    // Check if user is authorized (admin, DRD Head, or has ipr_assign_school permission)
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.ipr_approve === true || 
             p.permissions?.drd_ipr_approve === true ||
             p.permissions?.ipr_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view DRD member school assignments',
      });
    }

    // Find the DRD department (search by code, name, or shortName)
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      // Return empty list instead of 404 for better UX
      return res.json({
        success: true,
        data: {
          members: [],
          allSchools: [],
        },
        message: 'DRD department not found. Please create a Central Department with code or name containing "DRD".',
      });
    }

    // Get all users with DIRECT DRD permissions
    const directDrdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
      },
      select: withSupportedAnalyticsScopeFields({
        id: true,
        userId: true,
        permissions: true,
        assignedSchoolIds: true,
        assignedResearchSchoolIds: true,
        assignedBookSchoolIds: true,
        assignedConferenceSchoolIds: true,
        assignedGrantSchoolIds: true,
        assignedAt: true,
        user: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                designation: true,
                primaryDepartment: {
                  select: {
                    departmentName: true,
                  },
                },
              },
            },
          },
        },
      }, supportedAnalyticsScopeFields),
    });

    // Get all active roles with DRD permissions
    const rolesWithDrdPerms = await prisma.role.findMany({
      where: {
        isActive: true,
        OR: [
          { departmentType: 'CENTRAL' },
          { departmentType: 'BOTH' },
        ],
      },
    });

    // Filter roles that have any DRD permissions
    const drdRoleIds = rolesWithDrdPerms
      .filter(role => {
        const centralPerms = role.permissions?.centralDeptPermissions || {};
        return Object.keys(centralPerms).some(key => 
          key.includes('ipr_') || key.includes('research_') || key.includes('book_') || 
          key.includes('conference_') || key.includes('grant_')
        );
      })
      .map(role => role.id);

    // Get all users with roles that have DRD permissions
    let usersWithDrdRoles = [];
    
    if (drdRoleIds.length > 0) {
      // Fetch all users and filter in JavaScript since Prisma's JSON array queries can be tricky
      const allUsers = await prisma.userLogin.findMany({
        where: {
          status: 'active',
        },
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              designation: true,
              primaryDepartment: {
                select: {
                  departmentName: true,
                },
              },
            },
          },
        },
      });
      
      // Filter users who have at least one DRD role assigned (role assignment not implemented)
      usersWithDrdRoles = [];
    }

    // Combine both lists (direct permissions + role-based permissions)
    const allDrdUsers = new Map();
    
    // Add direct permission users
    directDrdMembers.forEach(member => {
      allDrdUsers.set(member.userId, {
        directPermission: member,
        user: member.user,
      });
    });
    
    // Add role-based permission users
    usersWithDrdRoles.forEach(user => {
      if (!allDrdUsers.has(user.id)) {
        allDrdUsers.set(user.id, {
          directPermission: null,
          user: user,
        });
      }
    });

    const drdMembers = Array.from(allDrdUsers.values());

    // Get all schools for reference
    const schools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Map DRD members with their assigned school names
    const membersWithSchools = drdMembers.map((memberData) => {
      const { directPermission, user } = memberData;
      
      // Get permissions from direct assignment (if exists)
      const directPerms = directPermission?.permissions || {};
      
      // Get permissions from assigned roles (role assignment not implemented)
      const userRoleIds = [];
      const rolePerms = {};
      
      if (Array.isArray(userRoleIds) && userRoleIds.length > 0) {
        rolesWithDrdPerms.forEach(role => {
          if (userRoleIds.includes(role.id)) {
            const centralPerms = role.permissions?.centralDeptPermissions || {};
            // Merge role permissions
            Object.assign(rolePerms, centralPerms);
          }
        });
      }
      
      // Merge direct and role permissions (direct permissions take precedence)
      const mergedPermissions = { ...rolePerms, ...directPerms };
      
      // Get assigned school IDs from direct permission (if exists) for ALL modules
      const assignedSchoolIds = directPermission?.assignedSchoolIds || [];
      const assignedResearchSchoolIds = directPermission?.assignedResearchSchoolIds || [];
      const assignedBookSchoolIds = directPermission?.assignedBookSchoolIds || [];
      const assignedConferenceSchoolIds = directPermission?.assignedConferenceSchoolIds || [];
      const assignedGrantSchoolIds = directPermission?.assignedGrantSchoolIds || [];
      const supportedAnalyticsFields = pickSupportedAnalyticsScopeFields(
        directPermission,
        supportedAnalyticsScopeFields
      );
      
      // Get school objects for each type
      const assignedSchools = schools.filter((s) => assignedSchoolIds.includes(s.id));

      return {
        id: directPermission?.id || `role-based-${user.id}`,
        userId: user.id,
        user: user,
        permissions: mergedPermissions,
        isDrdHead: mergedPermissions.ipr_approve === true || mergedPermissions.research_approve === true,
        isDrdMember: mergedPermissions.ipr_review === true || mergedPermissions.research_review === true,
        // Include ALL school assignment fields
        assignedSchoolIds,
        assignedResearchSchoolIds,
        assignedBookSchoolIds,
        assignedConferenceSchoolIds,
        assignedGrantSchoolIds,
        ...supportedAnalyticsFields,
        assignedSchools,
        assignedAt: directPermission?.assignedAt || null,
        fromRole: !directPermission, // Flag to indicate this user has DRD perms only from roles
      };
    });

    res.json({
      success: true,
      data: {
        members: membersWithSchools,
        allSchools: schools,
      },
    });
  } catch (error) {
    console.error('Get DRD members with schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DRD members',
      error: error.message,
    });
  }
};

/**
 * Get assigned schools for the currently logged-in DRD member
 */
exports.getMyAssignedSchools = async (req, res) => {
  try {
    // Find the DRD department (search by code, name, or shortName)
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: [],
        message: 'DRD department not found',
      });
    }

    // Get the user's DRD permission
    const drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId: req.user.id,
        centralDeptId: drdDept.id,
        isActive: true,
      },
    });

    if (!drdPermission) {
      return res.json({
        success: true,
        data: [],
        message: 'User is not a DRD member',
      });
    }

    const assignedSchoolIds = drdPermission.assignedSchoolIds || [];

    // Get the school details for assigned schools
    const assignedSchools = await prisma.facultySchoolList.findMany({
      where: {
        id: { in: assignedSchoolIds },
        isActive: true,
      },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    res.json({
      success: true,
      data: assignedSchools,
      permissions: drdPermission.permissions,
    });
  } catch (error) {
    console.error('Get my assigned schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned schools',
      error: error.message,
    });
  }
};

/**
 * Get schools with their assigned DRD members
 * Accessible by: admin OR users with ipr_assign_school or ipr_approve permission
 */
exports.getSchoolsWithAssignedMembers = async (req, res) => {
  try {
    // Check if user is authorized (admin, DRD Head, or has ipr_assign_school permission)
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.ipr_approve === true || 
             p.permissions?.drd_ipr_approve === true ||
             p.permissions?.ipr_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view school member assignments',
      });
    }

    // Get all active schools
    const schools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Find the DRD department (search by code, name, or shortName)
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      // Return schools without members
      return res.json({
        success: true,
        data: schools.map((school) => ({
          ...school,
          assignedMembers: [],
        })),
      });
    }

    // Get all DRD members
    const drdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Map schools with their assigned members
    const schoolsWithMembers = schools.map((school) => {
      const assignedMembers = drdMembers
        .filter((member) => {
          const assignedSchoolIds = member.assignedSchoolIds || [];
          return assignedSchoolIds.includes(school.id);
        })
        .map((member) => ({
          userId: member.userId,
          uid: member.user.uid,
          displayName: member.user.employeeDetails?.displayName || member.user.uid,
          permissions: member.permissions,
        }));

      return {
        ...school,
        assignedMembers,
        hasAssignedMember: assignedMembers.length > 0,
      };
    });

    res.json({
      success: true,
      data: schoolsWithMembers,
    });
  } catch (error) {
    console.error('Get schools with DRD members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schools with members',
      error: error.message,
    });
  }
};

// ===================================
// RESEARCH SCHOOL ASSIGNMENT FUNCTIONS
// ===================================
/**
 * Assign schools to a DRD member for RESEARCH review
 * @body { userId, schoolIds: string[] }
 * Accessible by: admin OR DRD Head (users with research_approve permission)
 */
exports.assignResearchMemberSchools = async (req, res) => {
  try {
    const { userId, schoolIds } = req.body;

    // Check if user is authorized (admin, DRD Head, or has research_assign_school permission)
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.research_approve === true || 
             p.permissions?.research_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign research schools to DRD members',
      });
    }

    if (!userId || !Array.isArray(schoolIds)) {
      return res.status(400).json({
        success: false,
        message: 'userId and schoolIds array are required',
      });
    }

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.status(404).json({
        success: false,
        message: 'DRD department not found. Please create a Central Department with code or name containing "DRD".',
      });
    }

    // Find or create the user's DRD permission record
    let drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId,
        centralDeptId: drdDept.id,
      },
    });

    if (drdPermission) {
      // Update existing permission with research school assignments
      drdPermission = await prisma.centralDepartmentPermission.update({
        where: { id: drdPermission.id },
        data: {
          assignedResearchSchoolIds: schoolIds,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Create new permission record with research school assignments
      drdPermission = await prisma.centralDepartmentPermission.create({
        data: {
          userId,
          centralDeptId: drdDept.id,
          permissions: { research_review: true },
          assignedResearchSchoolIds: schoolIds,
          isPrimary: false,
          isActive: true,
          assignedBy: req.user.id,
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'ASSIGN_RESEARCH_MEMBER_SCHOOLS',
        targetTable: 'central_department_permission',
        targetId: drdPermission.id,
        details: { userId, schoolIds },
      },
    });

    res.json({
      success: true,
      message: 'Research schools assigned to DRD member successfully',
      data: drdPermission,
    });
  } catch (error) {
    console.error('Assign research member schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign research schools',
      error: error.message,
    });
  }
};

/**
 * Get all DRD members with their assigned RESEARCH schools
 * Accessible by: admin OR DRD Head (users with research_approve permission)
 */
exports.getDrdMembersWithResearchSchools = async (req, res) => {
  try {
    // Check if user is authorized
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.research_approve === true || 
             p.permissions?.research_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view research school assignments',
      });
    }

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: {
          members: [],
          allSchools: [],
        },
        message: 'DRD department not found.',
      });
    }

    // Get all users with DRD permissions
    const drdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
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
                designation: true,
              },
            },
          },
        },
      },
    });

    // Get all schools
    const allSchools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Format the response
    const membersWithSchools = drdMembers.map((member) => ({
      userId: member.userId,
      uid: member.user.uid,
      email: member.user.email,
      role: member.user.role,
      displayName: member.user.employeeDetails?.displayName || member.user.uid,
      designation: member.user.employeeDetails?.designation,
      permissions: member.permissions,
      assignedResearchSchoolIds: member.assignedResearchSchoolIds || [],
      assignedResearchSchools: allSchools.filter((school) =>
        (member.assignedResearchSchoolIds || []).includes(school.id)
      ),
    }));

    res.json({
      success: true,
      data: {
        members: membersWithSchools,
        allSchools,
      },
    });
  } catch (error) {
    console.error('Get DRD members with research schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members with research schools',
      error: error.message,
    });
  }
};

/**
 * Get my assigned RESEARCH schools (for DRD members)
 */
exports.getMyAssignedResearchSchools = async (req, res) => {
  try {
    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: [],
        message: 'DRD department not found',
      });
    }

    // Get the user's DRD permission
    const drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId: req.user.id,
        centralDeptId: drdDept.id,
        isActive: true,
      },
    });

    if (!drdPermission) {
      return res.json({
        success: true,
        data: [],
        message: 'User is not a DRD member',
      });
    }

    const assignedResearchSchoolIds = drdPermission.assignedResearchSchoolIds || [];

    // Get the school details for assigned research schools
    const assignedSchools = await prisma.facultySchoolList.findMany({
      where: {
        id: { in: assignedResearchSchoolIds },
        isActive: true,
      },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    res.json({
      success: true,
      data: assignedSchools,
      permissions: drdPermission.permissions,
    });
  } catch (error) {
    console.error('Get my assigned research schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned research schools',
      error: error.message,
    });
  }
};

/**
 * Get schools with their assigned RESEARCH DRD members
 */
exports.getSchoolsWithResearchMembers = async (req, res) => {
  try {
    // Check if user is authorized
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.research_approve === true || 
             p.permissions?.research_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view research school assignments',
      });
    }

    // Get all schools
    const schools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: schools.map((school) => ({
          ...school,
          assignedMembers: [],
          hasAssignedMember: false,
        })),
      });
    }

    // Get all DRD members with research schools
    const drdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Map schools with their assigned research members
    const schoolsWithMembers = schools.map((school) => {
      const assignedMembers = drdMembers
        .filter((member) => {
          const assignedResearchSchoolIds = member.assignedResearchSchoolIds || [];
          return assignedResearchSchoolIds.includes(school.id);
        })
        .map((member) => ({
          userId: member.userId,
          uid: member.user.uid,
          displayName: member.user.employeeDetails?.displayName || member.user.uid,
          permissions: member.permissions,
        }));

      return {
        ...school,
        assignedMembers,
        hasAssignedMember: assignedMembers.length > 0,
      };
    });

    res.json({
      success: true,
      data: schoolsWithMembers,
    });
  } catch (error) {
    console.error('Get schools with research members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schools with research members',
      error: error.message,
    });
  }
};

// ===================================
// BOOK SCHOOL ASSIGNMENT FUNCTIONS
// ===================================
/**
 * Assign schools to a DRD member for BOOK/BOOK CHAPTER review
 * @body { userId, schoolIds: string[] }
 * Accessible by: admin OR DRD Head (users with book_approve permission)
 */
exports.assignBookMemberSchools = async (req, res) => {
  try {
    const { userId, schoolIds } = req.body;

    // Check if user is authorized (admin, DRD Head, or has book_assign_school permission)
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.book_approve === true || 
             p.permissions?.book_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign book schools to DRD members',
      });
    }

    if (!userId || !Array.isArray(schoolIds)) {
      return res.status(400).json({
        success: false,
        message: 'userId and schoolIds array are required',
      });
    }

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.status(404).json({
        success: false,
        message: 'DRD department not found. Please create a Central Department with code or name containing "DRD".',
      });
    }

    // Find or create the user's DRD permission record
    let drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId,
        centralDeptId: drdDept.id,
      },
    });

    if (drdPermission) {
      // Update existing permission with book school assignments
      drdPermission = await prisma.centralDepartmentPermission.update({
        where: { id: drdPermission.id },
        data: {
          assignedBookSchoolIds: schoolIds,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Create new permission record with book school assignments
      drdPermission = await prisma.centralDepartmentPermission.create({
        data: {
          userId,
          centralDeptId: drdDept.id,
          permissions: { book_review: true },
          assignedBookSchoolIds: schoolIds,
          isPrimary: false,
          isActive: true,
          assignedBy: req.user.id,
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'ASSIGN_BOOK_MEMBER_SCHOOLS',
        targetTable: 'central_department_permission',
        targetId: drdPermission.id,
        details: { userId, schoolIds },
      },
    });

    res.json({
      success: true,
      message: 'Book schools assigned to DRD member successfully',
      data: drdPermission,
    });
  } catch (error) {
    console.error('Assign book member schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign book schools',
      error: error.message,
    });
  }
};

/**
 * Get all DRD members with their assigned BOOK schools
 * Accessible by: admin OR DRD Head (users with book_approve permission)
 */
exports.getDrdMembersWithBookSchools = async (req, res) => {
  try {
    // Check if user is authorized
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.book_approve === true || 
             p.permissions?.book_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view book school assignments',
      });
    }

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: {
          members: [],
          allSchools: [],
        },
        message: 'DRD department not found.',
      });
    }

    // Get all users with DRD permissions
    const drdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
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
                designation: true,
                primaryDepartment: {
                  select: {
                    departmentName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get all schools
    const allSchools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Transform member data
    const members = drdMembers.map((member) => ({
      userId: member.userId,
      uid: member.user.uid,
      email: member.user.email,
      user: member.user,
      permissions: member.permissions || {},
      assignedBookSchoolIds: member.assignedBookSchoolIds || [],
      assignedBookSchools: allSchools.filter((s) =>
        (member.assignedBookSchoolIds || []).includes(s.id)
      ),
    }));

    res.json({
      success: true,
      data: {
        members,
        allSchools,
      },
    });
  } catch (error) {
    console.error('Get DRD members with book schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DRD members with book schools',
      error: error.message,
    });
  }
};

/**
 * Get schools with their assigned BOOK members
 * Accessible by: admin OR DRD Head (users with book_approve permission)
 */
exports.getSchoolsWithBookMembers = async (req, res) => {
  try {
    // Check if user is authorized
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.book_approve === true || 
             p.permissions?.book_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view book school assignments',
      });
    }

    // Get all schools
    const schools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: schools.map((school) => ({
          ...school,
          assignedMembers: [],
          hasAssignedMember: false,
        })),
      });
    }

    // Get all DRD members with book schools
    const drdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Map schools with their assigned book members
    const schoolsWithMembers = schools.map((school) => {
      const assignedMembers = drdMembers
        .filter((member) => {
          const assignedBookSchoolIds = member.assignedBookSchoolIds || [];
          return assignedBookSchoolIds.includes(school.id);
        })
        .map((member) => ({
          userId: member.userId,
          uid: member.user.uid,
          displayName: member.user.employeeDetails?.displayName || member.user.uid,
          permissions: member.permissions,
        }));

      return {
        ...school,
        assignedMembers,
        hasAssignedMember: assignedMembers.length > 0,
      };
    });

    res.json({
      success: true,
      data: schoolsWithMembers,
    });
  } catch (error) {
    console.error('Get schools with book members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schools with book members',
      error: error.message,
    });
  }
};

/**
 * Get my assigned BOOK schools (for current user)
 */
exports.getMyAssignedBookSchools = async (req, res) => {
  try {
    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: {
          assignedBookSchoolIds: [],
          assignedBookSchools: [],
        },
      });
    }

    // Get user's DRD permission
    const drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId: req.user.id,
        centralDeptId: drdDept.id,
        isActive: true,
      },
    });

    if (!drdPermission) {
      return res.json({
        success: true,
        data: {
          assignedBookSchoolIds: [],
          assignedBookSchools: [],
        },
      });
    }

    const assignedBookSchoolIds = drdPermission.assignedBookSchoolIds || [];

    // Get school details
    const assignedBookSchools = await prisma.facultySchoolList.findMany({
      where: {
        id: { in: assignedBookSchoolIds },
        isActive: true,
      },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
    });

    res.json({
      success: true,
      data: {
        assignedBookSchoolIds,
        assignedBookSchools,
      },
    });
  } catch (error) {
    console.error('Get my assigned book schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned book schools',
      error: error.message,
    });
  }
};

// ========== CONFERENCE School Assignment Functions ===
/**
 * Assign schools to a DRD member for CONFERENCE review
 * @body { userId, schoolIds: string[] }
 * Accessible by: admin OR DRD Head (users with conference_approve permission)
 */
exports.assignConferenceMemberSchools = async (req, res) => {
  try {
    const { userId, schoolIds } = req.body;

    // Check if user is authorized (admin, DRD Head, or has conference_assign_school permission)
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.conference_approve === true || 
             p.permissions?.conference_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign conference schools to DRD members',
      });
    }

    if (!userId || !Array.isArray(schoolIds)) {
      return res.status(400).json({
        success: false,
        message: 'userId and schoolIds array are required',
      });
    }

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.status(404).json({
        success: false,
        message: 'DRD department not found. Please create a Central Department with code or name containing "DRD".',
      });
    }

    // Find or create the user's DRD permission record
    let drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId,
        centralDeptId: drdDept.id,
      },
    });

    if (drdPermission) {
      // Update existing permission with conference school assignments
      drdPermission = await prisma.centralDepartmentPermission.update({
        where: { id: drdPermission.id },
        data: {
          assignedConferenceSchoolIds: schoolIds,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Create new permission record with conference school assignments
      drdPermission = await prisma.centralDepartmentPermission.create({
        data: {
          userId,
          centralDeptId: drdDept.id,
          permissions: { conference_review: true },
          assignedConferenceSchoolIds: schoolIds,
          isPrimary: false,
          isActive: true,
          assignedBy: req.user.id,
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'ASSIGN_CONFERENCE_MEMBER_SCHOOLS',
        targetTable: 'central_department_permission',
        targetId: drdPermission.id,
        details: { userId, schoolIds },
      },
    });

    res.json({
      success: true,
      message: 'Conference schools assigned to DRD member successfully',
      data: drdPermission,
    });
  } catch (error) {
    console.error('Assign conference member schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign conference schools',
      error: error.message,
    });
  }
};

/**
 * Get all DRD members with their assigned CONFERENCE schools
 * Accessible by: admin OR DRD Head (users with conference_approve permission)
 */
exports.getDrdMembersWithConferenceSchools = async (req, res) => {
  try {
    // Check if user is authorized
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.conference_approve === true || 
             p.permissions?.conference_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view conference school assignments',
      });
    }

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: {
          members: [],
          allSchools: [],
        },
        message: 'DRD department not found.',
      });
    }

    // Get all users with DRD permissions
    const drdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
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
                designation: true,
                primaryDepartment: {
                  select: {
                    departmentName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get all schools
    const allSchools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Transform member data
    const members = drdMembers.map((member) => ({
      userId: member.userId,
      uid: member.user.uid,
      email: member.user.email,
      user: member.user,
      permissions: member.permissions || {},
      assignedConferenceSchoolIds: member.assignedConferenceSchoolIds || [],
      assignedConferenceSchools: allSchools.filter((s) =>
        (member.assignedConferenceSchoolIds || []).includes(s.id)
      ),
    }));

    res.json({
      success: true,
      data: {
        members,
        allSchools,
      },
    });
  } catch (error) {
    console.error('Get DRD members with conference schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DRD members with conference schools',
      error: error.message,
    });
  }
};

/**
 * Get schools with their assigned CONFERENCE members
 * Accessible by: admin OR DRD Head (users with conference_approve permission)
 */
exports.getSchoolsWithConferenceMembers = async (req, res) => {
  try {
    // Check if user is authorized
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.conference_approve === true || 
             p.permissions?.conference_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view conference school assignments',
      });
    }

    // Get all schools
    const schools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: schools.map((school) => ({
          ...school,
          assignedMembers: [],
          hasAssignedMember: false,
        })),
      });
    }

    // Get all DRD members with conference schools
    const drdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Map schools with their assigned conference members
    const schoolsWithMembers = schools.map((school) => {
      const assignedMembers = drdMembers
        .filter((member) => {
          const assignedConferenceSchoolIds = member.assignedConferenceSchoolIds || [];
          return assignedConferenceSchoolIds.includes(school.id);
        })
        .map((member) => ({
          userId: member.userId,
          uid: member.user.uid,
          displayName: member.user.employeeDetails?.displayName || member.user.uid,
          permissions: member.permissions,
        }));

      return {
        ...school,
        assignedMembers,
        hasAssignedMember: assignedMembers.length > 0,
      };
    });

    res.json({
      success: true,
      data: schoolsWithMembers,
    });
  } catch (error) {
    console.error('Get schools with conference members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schools with conference members',
      error: error.message,
    });
  }
};

/**
 * Get my assigned CONFERENCE schools (for current user)
 */
exports.getMyAssignedConferenceSchools = async (req, res) => {
  try {
    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: {
          assignedConferenceSchoolIds: [],
          assignedConferenceSchools: [],
        },
      });
    }

    // Get user's DRD permission
    const drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId: req.user.id,
        centralDeptId: drdDept.id,
        isActive: true,
      },
    });

    if (!drdPermission) {
      return res.json({
        success: true,
        data: {
          assignedConferenceSchoolIds: [],
          assignedConferenceSchools: [],
        },
      });
    }

    const assignedConferenceSchoolIds = drdPermission.assignedConferenceSchoolIds || [];

    // Get school details
    const assignedConferenceSchools = await prisma.facultySchoolList.findMany({
      where: {
        id: { in: assignedConferenceSchoolIds },
        isActive: true,
      },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
    });

    res.json({
      success: true,
      data: {
        assignedConferenceSchoolIds,
        assignedConferenceSchools,
      },
    });
  } catch (error) {
    console.error('Get my assigned conference schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned conference schools',
      error: error.message,
    });
  }
};

/**
 * Assign schools to a DRD member for GRANT review
 * @body { userId, schoolIds: string[] }
 * Accessible by: admin OR DRD Head (users with grant_approve permission)
 */
exports.assignGrantMemberSchools = async (req, res) => {
  try {
    const { userId, schoolIds } = req.body;

    // Check if user is authorized (admin, DRD Head, or has grant_assign_school permission)
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.grant_approve === true || 
             p.permissions?.grant_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign grant schools to DRD members',
      });
    }

    if (!userId || !Array.isArray(schoolIds)) {
      return res.status(400).json({
        success: false,
        message: 'userId and schoolIds array are required',
      });
    }

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.status(404).json({
        success: false,
        message: 'DRD department not found. Please create a Central Department with code or name containing "DRD".',
      });
    }

    // Find or create the user's DRD permission record
    let drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId,
        centralDeptId: drdDept.id,
      },
    });

    if (drdPermission) {
      // Update existing permission with grant school assignments
      drdPermission = await prisma.centralDepartmentPermission.update({
        where: { id: drdPermission.id },
        data: {
          assignedGrantSchoolIds: schoolIds,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Create new permission record with grant school assignments
      drdPermission = await prisma.centralDepartmentPermission.create({
        data: {
          userId,
          centralDeptId: drdDept.id,
          permissions: { grant_review: true },
          assignedGrantSchoolIds: schoolIds,
          isPrimary: false,
          isActive: true,
          assignedBy: req.user.id,
        },
        include: {
          user: {
            select: {
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'ASSIGN_GRANT_MEMBER_SCHOOLS',
        targetTable: 'central_department_permission',
        targetId: drdPermission.id,
        details: { userId, schoolIds },
      },
    });

    res.json({
      success: true,
      message: 'Grant schools assigned to DRD member successfully',
      data: drdPermission,
    });
  } catch (error) {
    console.error('Assign grant member schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign grant schools',
      error: error.message,
    });
  }
};

/**
 * Get all DRD members with their assigned GRANT schools
 * Accessible by: admin OR DRD Head (users with grant_approve permission)
 */
exports.getDrdMembersWithGrantSchools = async (req, res) => {
  try {
    // Check if user is authorized
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.grant_approve === true || 
             p.permissions?.grant_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view grant school assignments',
      });
    }

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: {
          members: [],
          allSchools: [],
        },
        message: 'DRD department not found.',
      });
    }

    // Get all users with DRD permissions
    const drdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
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
                designation: true,
                primaryDepartment: {
                  select: {
                    departmentName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get all schools
    const allSchools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Transform member data
    const members = drdMembers.map((member) => ({
      userId: member.userId,
      uid: member.user.uid,
      email: member.user.email,
      user: member.user,
      permissions: member.permissions || {},
      assignedGrantSchoolIds: member.assignedGrantSchoolIds || [],
      assignedGrantSchools: allSchools.filter((s) =>
        (member.assignedGrantSchoolIds || []).includes(s.id)
      ),
    }));

    res.json({
      success: true,
      data: {
        members,
        allSchools,
      },
    });
  } catch (error) {
    console.error('Get DRD members with grant schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch DRD members with grant schools',
      error: error.message,
    });
  }
};

/**
 * Get schools with their assigned GRANT members
 * Accessible by: admin OR DRD Head (users with grant_approve permission)
 */
exports.getSchoolsWithGrantMembers = async (req, res) => {
  try {
    // Check if user is authorized
    const isAdmin = req.user.role === 'admin';
    const canAssignSchools = req.user.centralDeptPermissions?.some(
      (p) => p.permissions?.grant_approve === true || 
             p.permissions?.grant_assign_school === true
    );

    if (!isAdmin && !canAssignSchools) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view grant school assignments',
      });
    }

    // Get all schools
    const schools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
      orderBy: { facultyName: 'asc' },
    });

    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: schools.map((school) => ({
          ...school,
          assignedMembers: [],
          hasAssignedMember: false,
        })),
      });
    }

    // Get all DRD members with grant schools
    const drdMembers = await prisma.centralDepartmentPermission.findMany({
      where: {
        centralDeptId: drdDept.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    // Map schools with their assigned grant members
    const schoolsWithMembers = schools.map((school) => {
      const assignedMembers = drdMembers
        .filter((member) => {
          const assignedGrantSchoolIds = member.assignedGrantSchoolIds || [];
          return assignedGrantSchoolIds.includes(school.id);
        })
        .map((member) => ({
          userId: member.userId,
          uid: member.user.uid,
          displayName: member.user.employeeDetails?.displayName || member.user.uid,
          permissions: member.permissions,
        }));

      return {
        ...school,
        assignedMembers,
        hasAssignedMember: assignedMembers.length > 0,
      };
    });

    res.json({
      success: true,
      data: schoolsWithMembers,
    });
  } catch (error) {
    console.error('Get schools with grant members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schools with grant members',
      error: error.message,
    });
  }
};

/**
 * Get my assigned GRANT schools (for current user)
 */
exports.getMyAssignedGrantSchools = async (req, res) => {
  try {
    // Find the DRD department
    const drdDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentCode: 'DRD' },
          { departmentCode: { contains: 'DRD', mode: 'insensitive' } },
          { departmentName: { contains: 'DRD', mode: 'insensitive' } },
          { shortName: 'DRD' },
          { departmentName: { contains: 'Development', mode: 'insensitive' } },
          { departmentName: { contains: 'Research', mode: 'insensitive' } },
        ],
      },
    });

    if (!drdDept) {
      return res.json({
        success: true,
        data: {
          assignedGrantSchoolIds: [],
          assignedGrantSchools: [],
        },
      });
    }

    // Get user's DRD permission
    const drdPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId: req.user.id,
        centralDeptId: drdDept.id,
        isActive: true,
      },
    });

    if (!drdPermission) {
      return res.json({
        success: true,
        data: {
          assignedGrantSchoolIds: [],
          assignedGrantSchools: [],
        },
      });
    }

    const assignedGrantSchoolIds = drdPermission.assignedGrantSchoolIds || [];

    // Get school details
    const assignedGrantSchools = await prisma.facultySchoolList.findMany({
      where: {
        id: { in: assignedGrantSchoolIds },
        isActive: true,
      },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
      },
    });

    res.json({
      success: true,
      data: {
        assignedGrantSchoolIds,
        assignedGrantSchools,
      },
    });
  } catch (error) {
    console.error('Get my assigned grant schools error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned grant schools',
      error: error.message,
    });
  }
};

/**
 * Assign roles to a user
 */
exports.assignRolesToUser = async (req, res) => {
  try {
    const { userId, roleIds } = req.body;

    if (!userId || !Array.isArray(roleIds)) {
      return res.status(400).json({
        success: false,
        message: 'User ID and role IDs array are required',
      });
    }

    // Check authorization - only admin can assign roles
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to assign roles',
      });
    }

    // Verify all roles exist
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
    });

    if (roles.length !== roleIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more invalid role IDs',
      });
    }

    // Update user with assigned role IDs
    const updatedUser = await prisma.userLogin.update({
      where: { id: userId },
      data: {
        assignedRoleIds: roleIds,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        uid: true,
        email: true,
        role: true,
        assignedRoleIds: true,
      },
    });

    // Log audit
    await logPermissionChange(
      updatedUser,
      {
        type: 'role_assignment',
        roleIds,
        roleNames: roles.map(r => r.name)
      },
      req.user.id,
      req
    );

    // Invalidate user cache so new role permissions take effect immediately
    await cache.invalidateUser(userId);

    res.json({
      success: true,
      message: 'Roles assigned successfully',
      data: {
        userId: updatedUser.id,
        assignedRoleIds: updatedUser.assignedRoleIds,
        roleNames: roles.map(r => r.name),
      },
    });
  } catch (error) {
    console.error('Assign roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign roles',
      error: error.message,
    });
  }
};
