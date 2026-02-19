/**
 * Auth cache pre-warm utility
 * Pre-caches user auth data on login so first request after login doesn't hit DB
 */
const prisma = require('../config/database');
const cache = require('../config/redis');

/**
 * Fetch full auth user data (same structure as protect middleware)
 */
async function fetchAuthUserData(userId) {
  const userData = await prisma.userLogin.findUnique({
    where: { id: userId },
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
              departmentName: true,
            },
          },
        },
      },
      schoolDeptPermissions: {
        where: { isActive: true },
        select: {
          departmentId: true,
          permissions: true,
          isPrimary: true,
        },
      },
    },
  });

  if (!userData) return null;

  const roleIds = userData.assignedRoleIds || [];
  let rolesWithPermissions = [];
  if (Array.isArray(roleIds) && roleIds.length > 0) {
    rolesWithPermissions = await prisma.role.findMany({
      where: { id: { in: roleIds }, isActive: true },
      select: {
        id: true,
        name: true,
        permissions: true,
        departmentType: true,
      },
    });
  }

  const mergedCentralPerms = [...(userData.centralDeptPermissions || [])];
  const mergedSchoolPerms = [...(userData.schoolDeptPermissions || [])];

  rolesWithPermissions.forEach((role) => {
    const rolePerms = role.permissions || {};
    if (rolePerms.centralDeptPermissions && Object.keys(rolePerms.centralDeptPermissions).length > 0) {
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
}

/**
 * Pre-warm auth cache on login - avoids DB hit on first request after login
 */
async function prewarmAuthCache(userId) {
  try {
    const userData = await fetchAuthUserData(userId);
    if (userData) {
      const cacheKey = `${cache.CACHE_KEYS.USER}auth:${userId}`;
      await cache.set(cacheKey, userData, cache.CACHE_TTL.USER_SESSION);
    }
  } catch (err) {
    console.warn('Auth cache pre-warm failed:', err.message);
  }
}

module.exports = { prewarmAuthCache, fetchAuthUserData };
