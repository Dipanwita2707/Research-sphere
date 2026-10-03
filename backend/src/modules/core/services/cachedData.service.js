/**
 * Cached Data Service
 * Provides cached access to frequently accessed static/semi-static data
 * Reduces database hits significantly for schools, departments, policies, etc.
 */

const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const { policyWindowWhere } = require('../../research/utils/policyWindow');

/**
 * Get all active schools (cached for 1 hour)
 */
const getSchools = async (forceRefresh = false) => {
  const cacheKey = `${cache.CACHE_KEYS.SCHOOL}all`;
  
  if (forceRefresh) {
    await cache.del(cacheKey);
  }

  const { data } = await cache.getOrSet(
    cacheKey,
    async () => {
      return await prisma.facultySchoolList.findMany({
        where: { isActive: true },
        select: {
          id: true,
          facultyCode: true,
          facultyName: true,
          shortName: true,
        },
        orderBy: { facultyName: 'asc' }
      });
    },
    cache.CACHE_TTL.SCHOOLS
  );
  
  return data || [];
};

/**
 * Get all active departments (cached for 1 hour)
 */
const getDepartments = async (schoolId = null, forceRefresh = false) => {
  const cacheKey = schoolId 
    ? `${cache.CACHE_KEYS.DEPARTMENT}school:${schoolId}`
    : `${cache.CACHE_KEYS.DEPARTMENT}all`;
  
  if (forceRefresh) {
    await cache.del(cacheKey);
  }

  const { data } = await cache.getOrSet(
    cacheKey,
    async () => {
      const where = { isActive: true };
      if (schoolId) {
        where.facultyId = schoolId;
      }
      
      return await prisma.department.findMany({
        where,
        select: {
          id: true,
          departmentCode: true,
          departmentName: true,
          shortName: true,
          facultyId: true,
          faculty: {
            select: {
              id: true,
              facultyName: true,
              facultyCode: true
            }
          }
        },
        orderBy: { departmentName: 'asc' }
      });
    },
    cache.CACHE_TTL.DEPARTMENTS
  );
  
  return data || [];
};

/**
 * Get all central departments (cached for 1 hour)
 */
const getCentralDepartments = async (forceRefresh = false) => {
  const cacheKey = `${cache.CACHE_KEYS.DEPARTMENT}central:all`;
  
  if (forceRefresh) {
    await cache.del(cacheKey);
  }

  const { data } = await cache.getOrSet(
    cacheKey,
    async () => {
      return await prisma.centralDepartment.findMany({
        where: { isActive: true },
        select: {
          id: true,
          departmentCode: true,
          departmentName: true,
          departmentType: true,
        },
        orderBy: { departmentName: 'asc' }
      });
    },
    cache.CACHE_TTL.DEPARTMENTS
  );
  
  return data || [];
};

/**
 * Get all programs (cached for 1 hour)
 */
const getPrograms = async (departmentId = null, forceRefresh = false) => {
  const cacheKey = departmentId 
    ? `${cache.CACHE_KEYS.PROGRAM}dept:${departmentId}`
    : `${cache.CACHE_KEYS.PROGRAM}all`;
  
  if (forceRefresh) {
    await cache.del(cacheKey);
  }

  const { data } = await cache.getOrSet(
    cacheKey,
    async () => {
      const where = { isActive: true };
      if (departmentId) {
        where.departmentId = departmentId;
      }
      
      return await prisma.program.findMany({
        where,
        select: {
          id: true,
          programCode: true,
          programName: true,
          programType: true,
          departmentId: true,
        },
        orderBy: { programName: 'asc' }
      });
    },
    cache.CACHE_TTL.PROGRAMS
  );
  
  return data || [];
};

/**
 * Get active IPR incentive policy (cached for 30 min)
 */
const getIprPolicy = async (iprType, forceRefresh = false) => {
  const cacheKey = `${cache.CACHE_KEYS.POLICY}ipr:${iprType}`;
  
  if (forceRefresh) {
    await cache.del(cacheKey);
  }

  const { data } = await cache.getOrSet(
    cacheKey,
    async () => {
      return await prisma.incentivePolicy.findFirst({
        where: { iprType, ...policyWindowWhere(new Date()) },
        orderBy: { effectiveFrom: 'desc' }
      });
    },
    cache.CACHE_TTL.POLICIES
  );
  
  return data;
};

/**
 * Get active research incentive policy (cached for 30 min)
 */
const getResearchPolicy = async (publicationType, forceRefresh = false) => {
  const cacheKey = `${cache.CACHE_KEYS.POLICY}research:${publicationType}`;
  
  if (forceRefresh) {
    await cache.del(cacheKey);
  }

  const { data } = await cache.getOrSet(
    cacheKey,
    async () => {
      return await prisma.researchIncentivePolicy.findFirst({
        where: { publicationType, ...policyWindowWhere(new Date()) },
        orderBy: { effectiveFrom: 'desc' }
      });
    },
    cache.CACHE_TTL.POLICIES
  );
  
  return data;
};

/**
 * Get active conference policy (cached for 30 min)
 */
const getConferencePolicy = async (conferenceSubType, forceRefresh = false) => {
  const cacheKey = `${cache.CACHE_KEYS.POLICY}conference:${conferenceSubType || 'any'}`;
  
  if (forceRefresh) {
    await cache.del(cacheKey);
  }

  const { data } = await cache.getOrSet(
    cacheKey,
    async () => {
      const where = { ...policyWindowWhere(new Date()) };
      if (conferenceSubType) {
        where.conferenceSubType = conferenceSubType;
      }
      
      return await prisma.conferenceIncentivePolicy.findFirst({
        where,
        orderBy: { effectiveFrom: 'desc' }
      });
    },
    cache.CACHE_TTL.POLICIES
  );
  
  return data;
};

/**
 * Get user by ID (cached for 10 min)
 */
const getUserById = async (userId, forceRefresh = false) => {
  const cacheKey = `${cache.CACHE_KEYS.USER}id:${userId}`;
  
  if (forceRefresh) {
    await cache.del(cacheKey);
  }

  const { data } = await cache.getOrSet(
    cacheKey,
    async () => {
      return await prisma.userLogin.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          status: true,
          profileImage: true,
          employeeDetails: {
            select: {
              displayName: true,
              firstName: true,
              lastName: true,
              designation: true,
              empId: true,
              primaryDepartmentId: true,
              primarySchoolId: true,
            }
          },
          studentLogin: {
            select: {
              displayName: true,
              firstName: true,
              lastName: true,
              studentId: true,
              registrationNo: true,
            }
          }
        }
      });
    },
    cache.CACHE_TTL.USER_PROFILE
  );
  
  return data;
};

/**
 * Search user by UID (cached for 5 min)
 */
const searchUserByUid = async (uid) => {
  const cacheKey = `${cache.CACHE_KEYS.USER}search:${uid}`;

  const { data } = await cache.getOrSet(
    cacheKey,
    async () => {
      return await prisma.userLogin.findFirst({
        where: { uid },
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
              phoneNumber: true,
              email: true,
              primaryDepartment: {
                select: { departmentName: true }
              }
            }
          },
          studentLogin: {
            select: {
              displayName: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              currentSemester: true,
              program: {
                select: { programName: true }
              }
            }
          }
        }
      });
    },
    cache.CACHE_TTL.USER_SESSION
  );
  
  return data;
};

/**
 * Invalidate all school-related caches
 */
const invalidateSchoolCache = async () => {
  await cache.delPattern(`${cache.CACHE_KEYS.SCHOOL}*`);
};

/**
 * Invalidate all department-related caches
 */
const invalidateDepartmentCache = async () => {
  await cache.delPattern(`${cache.CACHE_KEYS.DEPARTMENT}*`);
};

/**
 * Invalidate all policy caches
 */
const invalidatePolicyCache = async () => {
  await cache.delPattern(`${cache.CACHE_KEYS.POLICY}*`);
};

/**
 * Invalidate user cache
 */
const invalidateUserCache = async (userId) => {
  await cache.delPattern(`${cache.CACHE_KEYS.USER}*${userId}*`);
  await cache.delPattern(`${cache.CACHE_KEYS.DASHBOARD}*${userId}*`);
};

module.exports = {
  getSchools,
  getDepartments,
  getCentralDepartments,
  getPrograms,
  getIprPolicy,
  getResearchPolicy,
  getConferencePolicy,
  getUserById,
  searchUserByUid,
  invalidateSchoolCache,
  invalidateDepartmentCache,
  invalidatePolicyCache,
  invalidateUserCache
};
