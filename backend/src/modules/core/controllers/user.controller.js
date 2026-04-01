const prisma = require('../../../shared/config/database');
const { logPermissionChange, logDataExport, getIp } = require('../../../shared/utils/auditLogger');

/**
 * Get all users (for permission management)
 * Admin only - will be transferred to HR module
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, search } = req.query;

    const where = {
      role: {
        in: ['faculty', 'staff', 'admin']
      }
    };

    if (role && role !== 'all') {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { uid: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        {
          employeeDetails: {
            is: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } }
              ]
            }
          }
        }
      ];
    }

    const users = await prisma.userLogin.findMany({
      where,
      include: {
        employeeDetails: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            designation: true,
            empId: true,
            primaryDepartment: {
              select: {
                id: true,
                departmentName: true,
                departmentCode: true,
              }
            },
            primaryCentralDept: {
              select: {
                id: true,
                departmentName: true,
                departmentCode: true,
                departmentType: true,
              }
            },
            primarySchool: {
              select: { facultyName: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
};

/**
 * Get user by ID
 */
exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.userLogin.findUnique({
      where: { id: userId },
      include: {
        employeeDetails: true,
        userDepartmentPermissions: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
};

/**
 * Search users by partial UID for auto-suggest (returns list of matching users)
 */
exports.searchUsersByPartialUid = async (req, res) => {
  try {
    const { query } = req.params;
    const { role } = req.query; // Optional filter: 'faculty', 'student', 'staff'

    console.log('Searching users with query:', query, 'role filter:', role);

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    // If searching for students, search in studentDetails (only those with login access)
    if (role === 'student') {
      console.log('🔍 Searching students with query:', query);

      const students = await prisma.studentDetails.findMany({
        where: {
          OR: [
            { studentId: { contains: query, mode: 'insensitive' } },
            { registrationNo: { contains: query, mode: 'insensitive' } },
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
          isActive: true,
          userLoginId: { not: null }, // Only students with login (can be volunteers)
        },
        take: 10,
        include: {
          program: {
            select: {
              programName: true,
            },
          },
        },
      });

      console.log('📋 Found students:', students.length);

      const suggestions = students.map(student => ({
        uid: student.studentId,
        id: student.userLoginId, // UserLogin id required for EventVolunteer
        name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        role: 'student',
        department: student.program?.programName || 'N/A',
        designation: `Semester ${student.currentSemester}`,
        email: student.email,
        registrationNo: student.registrationNo,
      }));

      return res.status(200).json({
        success: true,
        data: suggestions,
      });
    }

    // For non-student roles, search in userLogin
    const whereClause = {
      uid: {
        contains: query,
        mode: 'insensitive'
      }
    };

    // Filter by role if specified (for mentor search - only faculty)
    // Don't add role filter if role is 'all'
    if (role && role !== 'all') {
      whereClause.role = role;
    }

    const users = await prisma.userLogin.findMany({
      where: whereClause,
      take: 10, // Limit results
      include: {
        employeeDetails: {
          select: {
            firstName: true,
            lastName: true,
            designation: true,
            primaryDepartment: {
              select: {
                departmentName: true
              }
            }
          }
        }
      }
    });

    const suggestions = users.map(user => ({
      uid: user.uid,
      id: user.id,
      name: user.employeeDetails ?
        `${user.employeeDetails.firstName || ''} ${user.employeeDetails.lastName || ''}`.trim() :
        user.email?.split('@')[0] || 'Unknown',
      role: user.role,
      department: user.employeeDetails?.primaryDepartment?.departmentName || 'N/A',
      designation: user.employeeDetails?.designation || ''
    }));

    res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
};

/**
 * Search user by UID or Registration Number for auto-fill functionality
 */
exports.searchUserByUid = async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('Searching for UID:', uid);

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'UID is required'
      });
    }

    const user = await prisma.userLogin.findFirst({
      where: {
        uid: uid
      },
      include: {
        employeeDetails: {
          select: {
            firstName: true,
            lastName: true,
            designation: true,
            empId: true,
            email: true,
            phoneNumber: true,
            primaryDepartment: {
              select: {
                departmentName: true,
                departmentCode: true,
                faculty: {
                  select: {
                    facultyName: true,
                    facultyCode: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this UID'
      });
    }

    // Return relevant data for auto-fill
    const userData = {
      uid: user.uid,
      email: user.employeeDetails?.email || user.email,
      phone: user.employeeDetails?.phoneNumber || user.phone,
      role: user.role,
      employeeType: user.employeeDetails?.designation || 'Student',
      name: user.employeeDetails ?
        `${user.employeeDetails.firstName || ''} ${user.employeeDetails.lastName || ''}`.trim() :
        user.email?.split('@')[0], // Fallback to email prefix
      department: user.employeeDetails?.primaryDepartment?.departmentName || null,
      faculty: user.employeeDetails?.primaryDepartment?.faculty?.facultyName || null,
      empId: user.employeeDetails?.empId || null
    };

    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Error searching user by UID:', error);
    console.error('Full error details:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to search user',
      error: error.message
    });
  }
};

/**
 * Get IPR Permissions Configuration
 * Returns all available permissions for the admin checkbox UI
 */
exports.getIprPermissionsConfig = async (req, res) => {
  try {
    const { getPermissionsForUI } = require('../../../shared/config/permissions.config');
    const permissions = getPermissionsForUI();

    res.status(200).json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('Error getting IPR permissions config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get permissions configuration'
    });
  }
};

/**
 * Get user's current permissions (all permissions including IPR)
 */
exports.getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        id: true,
        uid: true,
        role: true,
        centralDeptPermissions: {
          where: { isActive: true },
          select: {
            id: true,
            centralDeptId: true,
            permissions: true,
            centralDept: {
              select: {
                departmentCode: true,
                departmentName: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Combine all permissions from all department assignments
    let allPermissions = {};
    user.centralDeptPermissions.forEach(deptPerm => {
      if (deptPerm.permissions) {
        Object.assign(allPermissions, deptPerm.permissions);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        uid: user.uid,
        role: user.role,
        permissions: allPermissions,
        centralDeptPermissions: user.centralDeptPermissions
      }
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user permissions'
    });
  }
};

/**
 * Get user's current IPR permissions
 */
exports.getUserIprPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        id: true,
        uid: true,
        role: true,
        centralDeptPermissions: {
          where: { isActive: true },
          select: {
            id: true,
            centralDeptId: true,
            permissions: true,
            centralDept: {
              select: {
                departmentCode: true,
                departmentName: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Extract IPR-related permissions
    let iprPermissions = {};
    user.centralDeptPermissions.forEach(deptPerm => {
      if (deptPerm.permissions) {
        Object.assign(iprPermissions, deptPerm.permissions);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        uid: user.uid,
        role: user.role,
        permissions: iprPermissions,
        centralDeptPermissions: user.centralDeptPermissions
      }
    });
  } catch (error) {
    console.error('Error getting user IPR permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user permissions'
    });
  }
};

/**
 * Update user's IPR permissions
 * @body { permissions: { permission_key: boolean, ... }, centralDeptId: string }
 */
exports.updateUserIprPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions, centralDeptId } = req.body;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Permissions object is required'
      });
    }

    // Find or create central department permission record
    let deptPermission = await prisma.centralDepartmentPermission.findFirst({
      where: {
        userId,
        centralDeptId: centralDeptId || undefined
      }
    });

    if (deptPermission) {
      // Update existing permissions
      const updatedPermissions = {
        ...deptPermission.permissions,
        ...permissions
      };

      deptPermission = await prisma.centralDepartmentPermission.update({
        where: { id: deptPermission.id },
        data: {
          permissions: updatedPermissions,
          updatedAt: new Date()
        }
      });
    } else {
      // Need a central department to assign permissions
      // Find DRD department flexibly
      let drdDept = await prisma.centralDepartment.findFirst({
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
        return res.status(400).json({
          success: false,
          message: 'DRD department not found. Please create a Central Department with code or name containing "DRD".'
        });
      }

      deptPermission = await prisma.centralDepartmentPermission.create({
        data: {
          userId,
          centralDeptId: drdDept.id,
          permissions,
          isActive: true,
          isPrimary: true,
          assignedById: req.user.id
        }
      });
    }

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
        type: 'ipr_permissions',
        permissions,
        centralDeptId: deptPermission.centralDeptId
      },
      req.user.id,
      req
    );
    // === END AUDIT LOGGING ===

    res.status(200).json({
      success: true,
      message: 'Permissions updated successfully',
      data: deptPermission
    });
  } catch (error) {
    console.error('Error updating user IPR permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update permissions',
      error: error.message
    });
  }
};
