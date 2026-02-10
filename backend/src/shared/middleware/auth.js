const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config/app.config');
const cache = require('../config/redis');

// Protect routes - verify JWT token (OPTIMIZED WITH CACHING)
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret);
      const cacheKey = `${cache.CACHE_KEYS.USER}auth:${decoded.id}`;

      // Try cache first for faster auth
      const { data: user } = await cache.getOrSet(
        cacheKey,
        async () => {
          // Get user from database with permissions
          const userData = await prisma.userLogin.findUnique({
            where: { id: decoded.id },
            select: {
              id: true,
              uid: true,
              email: true,
              role: true,
              status: true,
              assignedRoleIds: true,
              centralDeptPermissions: {
                where: { isActive: true },
                select: {
                  centralDeptId: true,
                  permissions: true,
                  isPrimary: true,
                  centralDept: {
                    select: {
                      departmentCode: true,
                      departmentName: true
                    }
                  }
                }
              },
              schoolDeptPermissions: {
                where: { isActive: true },
                select: {
                  departmentId: true,
                  permissions: true,
                  isPrimary: true
                }
              }
            }
          });

          if (!userData) return null;

          // Get assigned roles with permissions
          const roleIds = userData.assignedRoleIds || [];
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
                permissions: true,
                departmentType: true,
              },
            });
          }

          // Merge role-based permissions with direct permissions
          const mergedCentralPerms = [...(userData.centralDeptPermissions || [])];
          const mergedSchoolPerms = [...(userData.schoolDeptPermissions || [])];

          // Process each role's permissions
          rolesWithPermissions.forEach(role => {
            const rolePerms = role.permissions || {};
            
            // Merge central department permissions from roles
            if (rolePerms.centralDeptPermissions && Object.keys(rolePerms.centralDeptPermissions).length > 0) {
              // Add as a virtual central department permission entry
              mergedCentralPerms.push({
                centralDeptId: `role-${role.id}`,
                permissions: rolePerms.centralDeptPermissions,
                isPrimary: false,
                centralDept: {
                  departmentCode: `ROLE-${role.name}`,
                  departmentName: `From Role: ${role.name}`,
                },
                fromRole: true,
                roleName: role.name,
              });
            }

            // Merge school department permissions from roles
            if (rolePerms.schoolDeptPermissions && Object.keys(rolePerms.schoolDeptPermissions).length > 0) {
              mergedSchoolPerms.push({
                departmentId: `role-${role.id}`,
                permissions: rolePerms.schoolDeptPermissions,
                isPrimary: false,
                fromRole: true,
                roleName: role.name,
              });
            }
          });

          return {
            ...userData,
            centralDeptPermissions: mergedCentralPerms,
            schoolDeptPermissions: mergedSchoolPerms,
          };
        },
        cache.CACHE_TTL.USER_SESSION
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

// Restrict to specific user roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

// Check department permission
const checkDepartmentPermission = (department, permissionKey) => {
  return async (req, res, next) => {
    try {
      const permission = await prisma.userDepartmentPermission.findUnique({
        where: {
          userId_department: {
            userId: req.user.id,
            department
          }
        }
      });

      if (!permission || !permission.isActive) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this department'
        });
      }

      if (permissionKey && (!permission.permissions || !permission.permissions[permissionKey])) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during permission check'
      });
    }
  };
};

// Check if user has specific permission for a module
const requirePermission = (departmentType, permissionName) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - user not found'
        });
      }

      let hasPermission = false;

      // Support both naming conventions (e.g., 'ipr_review' and 'drd_ipr_review')
      const permissionVariants = [
        permissionName,
        `drd_${permissionName}`,
        permissionName.replace('drd_', '')
      ];

      if (departmentType === 'central-department') {
        // Check central department permissions
        hasPermission = user.centralDeptPermissions?.some(deptPerm => 
          deptPerm.permissions && permissionVariants.some(variant =>
            deptPerm.permissions[variant] === true
          )
        );
      } else if (departmentType === 'school-department') {
        // Check school department permissions
        hasPermission = user.schoolDeptPermissions?.some(deptPerm => 
          deptPerm.permissions && permissionVariants.some(variant =>
            deptPerm.permissions[variant] === true
          )
        );
      }

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied - ${permissionName} permission required for ${departmentType}`,
          requiredPermission: permissionName,
          checkedVariants: permissionVariants
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

// Check if user has any of the specified permissions
const requireAnyPermission = (departmentType, permissionNames) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - user not found'
        });
      }

      let hasAnyPermission = false;

      // Expand permission names to include both naming conventions
      const expandedPermissionNames = permissionNames.flatMap(name => [
        name,
        `drd_${name}`,
        name.replace('drd_', '')
      ]);

      if (departmentType === 'central-department') {
        // Check central department permissions
        hasAnyPermission = user.centralDeptPermissions?.some(deptPerm => 
          deptPerm.permissions && expandedPermissionNames.some(permName => 
            deptPerm.permissions[permName] === true
          )
        );
      } else if (departmentType === 'school-department') {
        // Check school department permissions
        hasAnyPermission = user.schoolDeptPermissions?.some(deptPerm => 
          deptPerm.permissions && expandedPermissionNames.some(permName => 
            deptPerm.permissions[permName] === true
          )
        );
      }

      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied - one of [${permissionNames.join(', ')}] permissions required for ${departmentType}`,
          requiredPermissions: permissionNames,
          checkedVariants: [...new Set(expandedPermissionNames)]
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

/**
 * Check IPR file permission based on role
 * - Faculty: Can file IPR by default (inherent right as researcher)
 * - Student: Can file IPR by default (fixed permission for student projects)
 * - Staff/Admin: Requires explicit ipr_file_new permission from admin checkbox
 * 
 * NOTE: Admin is IT head - manages users/permissions/analytics, NOT IPR operations
 */
const checkIprFilePermission = (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - user not found'
      });
    }

    const role = user.role;

    // Faculty and Student can file IPR by default (inherent rights)
    if (role === 'faculty' || role === 'student') {
      return next();
    }

    // For Staff AND Admin: Check if they have ipr_file_new permission from checkbox
    // Admin is IT head - manages users/permissions, NOT IPR operations
    if (role === 'staff' || role === 'admin') {
      const permissionVariants = ['ipr_file_new', 'drd_ipr_file', 'ipr_file'];
      
      // Check central department permissions for ipr_file_new
      const hasFilePermission = user.centralDeptPermissions?.some(deptPerm => 
        deptPerm.permissions && permissionVariants.some(variant =>
          deptPerm.permissions[variant] === true
        )
      );

      if (hasFilePermission) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied - You require IPR filing permission from administrator. Please contact admin to enable "File New IPR Applications" permission.',
        requiredPermission: 'ipr_file_new'
      });
    }

    // Default deny for unknown roles
    return res.status(403).json({
      success: false,
      message: 'Access denied - You do not have permission to file IPR applications'
    });
  } catch (error) {
    console.error('IPR file permission check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check failed'
    });
  }
};

const checkResearchFilePermission = (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - user not found'
      });
    }

    const role = user.role;

    // Faculty and Student can file Research Contributions by default (inherent rights)
    if (role === 'faculty' || role === 'student') {
      return next();
    }

    // For Staff AND Admin: Check if they have research_file_new permission from checkbox
    // Admin is IT head - manages users/permissions, NOT research operations
    if (role === 'staff' || role === 'admin') {
      const permissionVariants = ['research_file_new', 'drd_research_file', 'research_file'];
      
      // Check central department permissions for research_file_new
      const hasFilePermission = user.centralDeptPermissions?.some(deptPerm => 
        deptPerm.permissions && permissionVariants.some(variant =>
          deptPerm.permissions[variant] === true
        )
      );

      if (hasFilePermission) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied - You require Research filing permission from administrator. Please contact admin to enable "File New Research Contributions" permission.',
        requiredPermission: 'research_file_new'
      });
    }

    // Default deny for unknown roles
    return res.status(403).json({
      success: false,
      message: 'Access denied - You do not have permission to file Research Contributions'
    });
  } catch (error) {
    console.error('Research file permission check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check failed'
    });
  }
};

module.exports = {
  protect,
  restrictTo,
  checkDepartmentPermission,
  requirePermission,
  requireAnyPermission,
  checkIprFilePermission,
  checkResearchFilePermission
};
