/**
 * @module auth
 * @description Authentication & authorization middleware for Express routes.
 *
 * Provides JWT verification (protect), role gating (restrictTo), and
 * fine-grained permission checks for all modules: DSW, Noting, Events,
 * IPR, Research, Gate-Entry, and DRD.
 *
 * Usage patterns:
 *   router.get('/secure', protect, handler)
 *   router.post('/admin', protect, restrictTo('admin'), handler)
 *   router.put('/event', protect, requireEventPermission('event_publish'), handler)
 */
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const config = require('../config/app.config');
const cache = require('../config/redis');
const log = require('../utils/logger');
const { logAuthenticationFailure } = require('../../modules/bug-reports/utils/securityLogger');

/**
 * Authenticate incoming request by verifying JWT token.
 * Extracts token from Authorization header (Bearer) or cookies.
 * Populates req.user with cached user data (roles, permissions, dept access).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void} Calls next() on success, 401 on missing/invalid token
 */
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
      // Verify token â€” pin algorithm to prevent algorithm-switching attacks
      const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
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
              universityId: true,
              assignedRoleIds: true,
              employeeDetails: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                },
              },
              studentLogin: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                },
              },
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
          const mergedSeminarHallBlockIds = new Set();

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

            if (Array.isArray(rolePerms.seminarHallBlockIds)) {
              rolePerms.seminarHallBlockIds
                .filter((blockId) => typeof blockId === 'string' && blockId.trim())
                .forEach((blockId) => mergedSeminarHallBlockIds.add(blockId.trim()));
            }
          });

          // PERF FIX: Pre-cache chairperson club lookup for student users.
          // This avoids a DB query on EVERY request in checkAnyPermission and
          // getMyNotingPermissions — both of which do prisma.club.findFirst()
          // for students who have no default noting permissions.
          let chairpersonClubData = null;
          if (userData.role === 'student') {
            try {
              const chairClub = await prisma.club.findFirst({
                where: {
                  chairpersonId: userData.id,
                  status: { in: ['approved', 'active'] },
                },
                select: { id: true, name: true, facultyFacilitatorId: true },
              });
              if (chairClub) {
                chairpersonClubData = chairClub;
              }
            } catch (err) {
              // Non-critical — fall through gracefully
            }
          }

          return {
            ...userData,
            centralDeptPermissions: mergedCentralPerms,
            schoolDeptPermissions: mergedSchoolPerms,
            seminarHallBlockIds: Array.from(mergedSeminarHallBlockIds),
            // Cached chairperson info — avoids DB hit per request
            _chairpersonClub: chairpersonClubData,
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

      // Resolve Tenant context
      if (user.role === 'superadmin') {
        const headerUniversityId = req.headers['x-university-id'];
        req.tenantId = headerUniversityId || null;
        req.isSuperadmin = true;
      } else {
        if (!user.universityId) {
          return res.status(403).json({
            success: false,
            message: 'User is not associated with any university/tenant.'
          });
        }
        req.tenantId = user.universityId;
        req.isSuperadmin = false;
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    log.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

/**
 * Restrict route to specific user roles (e.g. 'admin', 'faculty').
 * Must be used after protect() middleware.
 * @param {...string} roles - Allowed roles (OR logic)
 * @returns {import('express').RequestHandler} 403 if user role not in list
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      // Log authentication failure for admin endpoints
      if (roles.includes('admin') || roles.includes('superadmin')) {
        logAuthenticationFailure({
          endpoint: req.originalUrl || req.url,
          method: req.method,
          userId: req.user?.id,
          userRole: req.user?.role,
          ip: req.ip,
          reason: `User role '${req.user?.role}' not authorized. Required roles: ${roles.join(', ')}`,
        });
      }
      
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

/**
 * Check if user holds an active permission for a specific department.
 * Queries UserDepartmentPermission table directly.
 * @param {string} department - Department identifier to check against
 * @param {string} [permissionKey] - Specific permission key within the department (optional)
 * @returns {import('express').RequestHandler} 403 if permission missing
 */
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
      log.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during permission check'
      });
    }
  };
};

/**
 * Require a specific permission for a module, checking both naming conventions
 * (e.g. 'ipr_review' and 'drd_ipr_review'). Checks central or school department.
 * @param {'central-department'|'school-department'} departmentType - Department type to search
 * @param {string} permissionName - Permission key to verify
 * @returns {import('express').RequestHandler} 403 with details if denied
 */
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
          message: 'Access denied - insufficient permissions',
        });
      }

      next();
    } catch (error) {
      log.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

/**
 * Require ANY of the specified permissions (OR logic), checking both naming conventions.
 * @param {'central-department'|'school-department'} departmentType - Department type to search
 * @param {string[]} permissionNames - Array of permission keys (user needs at least one)
 * @returns {import('express').RequestHandler} 403 with details if none match
 */
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
          message: 'Access denied - insufficient permissions',
        });
      }

      next();
    } catch (error) {
      log.error('Permission check error:', error);
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
    log.error('IPR file permission check error:', error);
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
    log.error('Research file permission check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check failed'
    });
  }
};

// ====================================
// CENTRALIZED PERMISSION MIDDLEWARE
// Unified permission checks for all modules: DSW, Noting, Events, DRD
// ====================================
const {
  getDefaultPermissions,
  getPermissionKeyVariants,
} = require('../config/permissions.config');

/**
 * Check if user has a specific permission - combines default (inherent) + explicit permissions
 * @param {string} permissionKey - The permission key to check (e.g., 'dsw_create_club_noting')
 * @param {Object} options - Options for permission check
 * @param {boolean} options.checkDefaultPermissions - Whether to check role-based defaults (default: true)
 * @param {string} options.departmentType - 'central-department' or 'school-department' (default: 'central-department')
 * @param {string} options.errorMessage - Custom error message
 */
const checkPermission = (permissionKey, options = {}) => {
  const {
    checkDefaultPermissions = true,
    departmentType = 'central-department',
    errorMessage = null
  } = options;

  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const permissionVariants = getPermissionKeyVariants(permissionKey);

      // Check 1: Role-based default permissions (inherent rights)
      if (checkDefaultPermissions) {
        const defaultPerms = getDefaultPermissions(user.role);
        if (permissionVariants.some((variant) => defaultPerms[variant] === true)) {
          return next();
        }
      }

      // Check 2: Explicit permissions from central/school department assignments
      let hasExplicitPermission = false;

      if (departmentType === 'central-department') {
        hasExplicitPermission = user.centralDeptPermissions?.some(deptPerm =>
          deptPerm.permissions && permissionVariants.some(variant =>
            deptPerm.permissions[variant] === true
          )
        );
      } else if (departmentType === 'school-department') {
        hasExplicitPermission = user.schoolDeptPermissions?.some(deptPerm =>
          deptPerm.permissions && permissionVariants.some(variant =>
            deptPerm.permissions[variant] === true
          )
        );
      }

      if (hasExplicitPermission) {
        return next();
      }

      // Check 3: Club chairperson override for noting + event permissions
      // Students who are chairpersons of active/approved clubs can create notings
      // and manage their own events (created from approved notings)
      const CHAIRPERSON_ALLOWED_PERMISSIONS = [
        'noting_create', 'noting_view_own',
        'event_manage_own', 'event_publish', 'event_cancel',
      ];
      if (user.role === 'student' && CHAIRPERSON_ALLOWED_PERMISSIONS.includes(permissionKey)) {
        try {
          const chairpersonClub = await prisma.club.findFirst({
            where: {
              chairpersonId: user.id,
              status: { in: ['approved', 'active'] },
            },
            select: { id: true },
          });
          if (chairpersonClub) {
            req.chairpersonClubId = chairpersonClub.id;
            return next();
          }
        } catch (clubErr) {
          log.error('Chairperson club check error:', clubErr);
        }
      }

      // Access denied
      return res.status(403).json({
        success: false,
        message: errorMessage || 'Access denied - insufficient permissions',
      });
    } catch (error) {
      log.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

/**
 * Check if user has any of the specified permissions
 * @param {string[]} permissionKeys - Array of permission keys (OR logic)
 * @param {Object} options - Same options as checkPermission
 */
const checkAnyPermission = (permissionKeys, options = {}) => {
  const {
    checkDefaultPermissions = true,
    departmentType = 'central-department',
    errorMessage = null
  } = options;

  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const allVariants = Array.from(new Set(permissionKeys.flatMap((key) => getPermissionKeyVariants(key))));

      // Check 1: Role-based default permissions
      if (checkDefaultPermissions) {
        const defaultPerms = getDefaultPermissions(user.role);
        const hasDefaultPerm = allVariants.some((key) => defaultPerms[key] === true);
        if (hasDefaultPerm) {
          return next();
        }
      }

      // Check 2: Explicit permissions
      let hasExplicitPermission = false;
      if (departmentType === 'central-department') {
        hasExplicitPermission = user.centralDeptPermissions?.some(deptPerm =>
          deptPerm.permissions && allVariants.some(variant =>
            deptPerm.permissions[variant] === true
          )
        );
      } else if (departmentType === 'school-department') {
        hasExplicitPermission = user.schoolDeptPermissions?.some(deptPerm =>
          deptPerm.permissions && allVariants.some(variant =>
            deptPerm.permissions[variant] === true
          )
        );
      }

      if (hasExplicitPermission) {
        return next();
      }

      // Check 3: Club chairperson override for noting + event permissions
      if (user.role === 'student') {
        const CHAIRPERSON_ALLOWED_PERMISSIONS = [
          'noting_create', 'noting_view_own',
          'event_manage_own', 'event_publish', 'event_cancel',
        ];
        const hasChairpersonKey = allVariants.some((k) => CHAIRPERSON_ALLOWED_PERMISSIONS.includes(k));
        if (hasChairpersonKey) {
          // PERF FIX: Use pre-cached chairperson club from protect middleware
          // instead of doing prisma.club.findFirst on every request.
          if (user._chairpersonClub) {
            req.chairpersonClubId = user._chairpersonClub.id;
            return next();
          }
        }
      }

      return res.status(403).json({
        success: false,
        message: errorMessage || 'Access denied - insufficient permissions',
      });
    } catch (error) {
      log.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
};

/**
 * DSW Permission Middleware
 * Checks DSW-specific permissions with role defaults
 */
const requireDSWPermission = (permissionKey) => {
  return checkPermission(permissionKey, {
    checkDefaultPermissions: true,
    departmentType: 'central-department',
    errorMessage: 'DSW access denied - insufficient permissions'
  });
};

/**
 * Noting Permission Middleware
 * Checks noting-specific permissions - NO defaults except for faculty
 */
const requireNotingPermission = (permissionKey) => {
  return checkPermission(permissionKey, {
    checkDefaultPermissions: false,
    departmentType: 'central-department',
    errorMessage: 'Noting access denied - insufficient permissions'
  });
};

/**
 * Event Permission Middleware
 * Checks event-specific permissions
 */
const requireEventPermission = (permissionKey) => {
  return checkPermission(permissionKey, {
    checkDefaultPermissions: true,
    departmentType: 'central-department',
    errorMessage: 'Event access denied - insufficient permissions'
  });
};

/**
 * Combined ownership + permission check
 * First checks if user owns the resource, then falls back to permission check
 * @param {Function} ownershipCheck - Async function that returns true if user owns resource
 * @param {string} permissionKey - Fallback permission to check if not owner
 */
const requireOwnershipOrPermission = (ownershipCheck, permissionKey, options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check 1: Ownership
      const isOwner = await ownershipCheck(req, user);
      if (isOwner) {
        req.isResourceOwner = true;
        return next();
      }

      // Check 2: Permission fallback
      const permissionMiddleware = checkPermission(permissionKey, options);
      return permissionMiddleware(req, res, next);
    } catch (error) {
      log.error('Ownership/permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

/**
 * Check Gate Entry access based on user designation
 * Admin & Guard: Full access (all features including verify)
 * Student: No access (blocked completely)
 * Others: Limited access (create & view only, no verify)
 * @param {boolean} requireVerifyAccess - If true, only Admin/Guard allowed
 */
const checkGateEntryAccess = (requireVerifyAccess = false) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get user with role and employee details
      const user = await prisma.userLogin.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          employeeDetails: {
            select: {
              designation: true
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

      const role = user.role?.toLowerCase() || '';
      const designation = user.employeeDetails?.designation?.toLowerCase() || '';
      
      const isAdmin = role === 'admin';
      const isStudent = role === 'student';
      const isGuard = designation.includes('guard') || designation.includes('security');

      // If verify access is required, only Admin and Guard allowed
      // Students and other roles cannot verify passes
      if (requireVerifyAccess) {
        if (!isAdmin && !isGuard) {
          return res.status(403).json({
            success: false,
            message: isStudent 
              ? 'Students can only create passes, not verify them'
              : 'Only Admin and Security Guards can verify passes'
          });
        }
      }

      // All users (including students) can access basic features (create pass, view own passes)
      next();
    } catch (error) {
      log.error('Gate Entry access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Access verification failed'
      });
    }
  };
};

/**
 * Middleware to check if the requested IPR application belongs to the same university as the logged-in user.
 */
const checkIprTenantAccess = async (req, res, next) => {
  try {
    const { id, updateId } = req.params;
    const tenantId = req.tenantId;

    // If no tenant context is resolved or user is superadmin (impersonating is resolved to tenantId), skip checks
    if (!tenantId) {
      return next();
    }

    let targetIprId = id;
    if (updateId) {
      const updateRecord = await prisma.iprStatusUpdate.findUnique({
        where: { id: updateId },
        select: { iprApplicationId: true }
      });
      if (updateRecord) {
        targetIprId = updateRecord.iprApplicationId;
      }
    }

    if (!targetIprId) {
      return next();
    }

    // Find the IPR application and get the applicant user's universityId
    const application = await prisma.iprApplication.findUnique({
      where: { id: targetIprId },
      select: {
        applicantUser: {
          select: {
            universityId: true
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'IPR application not found'
      });
    }

    if (application.applicantUser?.universityId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This IPR application does not belong to your university.'
      });
    }

    next();
  } catch (error) {
    log.error('IPR tenant access check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify tenant access'
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
  checkResearchFilePermission,
  checkGateEntryAccess,
  checkIprTenantAccess,
  // New centralized permission middleware
  checkPermission,
  checkAnyPermission,
  requireDSWPermission,
  requireNotingPermission,
  requireEventPermission,
  requireOwnershipOrPermission
};
