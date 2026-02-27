/**
 * Recipient Service
 * Handles UID resolution, group expansion (dept/school/central dept),
 * and student restriction enforcement
 */
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');

// Common user select fields for mail display
const USER_SELECT = {
  id: true,
  uid: true,
  email: true,
  role: true,
  profileImage: true,
  profileImageFilePath: true,
  employeeDetails: {
    select: {
      firstName: true,
      lastName: true,
      displayName: true,
      designation: true,
      primaryDepartment: { select: { departmentName: true } },
      primarySchool: { select: { facultyName: true } },
      primaryCentralDept: { select: { departmentName: true } },
    },
  },
  studentLogin: {
    select: {
      firstName: true,
      lastName: true,
      displayName: true,
      currentSemester: true,
      program: { select: { programName: true } },
    },
  },
};

/**
 * Get display name for a user
 */
const getDisplayName = (user) => {
  if (!user) return 'Unknown';
  if (user.employeeDetails) {
    return (
      user.employeeDetails.displayName ||
      `${user.employeeDetails.firstName || ''} ${user.employeeDetails.lastName || ''}`.trim() ||
      user.uid
    );
  }
  if (user.studentLogin) {
    return (
      user.studentLogin.displayName ||
      `${user.studentLogin.firstName || ''} ${user.studentLogin.lastName || ''}`.trim() ||
      user.uid
    );
  }
  return user.uid;
};

/**
 * Resolve a UID to a user object
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
const resolveUser = async (uid) => {
  // Check cache first
  const cacheKey = `mail:user:${uid}`;
  const { data: cached } = await cache.getOrSet(
    cacheKey,
    async () => {
      const user = await prisma.userLogin.findUnique({
        where: { uid },
        select: USER_SELECT,
      });
      return user;
    },
    300 // 5 min cache
  );
  return cached;
};

/**
 * Resolve multiple UIDs to user objects
 * @param {string[]} uids
 * @returns {Promise<object[]>}
 */
const resolveUsers = async (uids) => {
  if (!uids || uids.length === 0) return [];

  const users = await prisma.userLogin.findMany({
    where: { uid: { in: uids }, status: 'active' },
    select: USER_SELECT,
  });

  return users;
};

/**
 * Expand a central department to all its employees
 * Returns employee UserLogin records
 * @param {string} centralDeptId - UUID of the central department
 * @returns {Promise<object[]>}
 */
const expandCentralDepartment = async (centralDeptId) => {
  const cacheKey = `mail:cdept:${centralDeptId}`;
  const { data: cached } = await cache.getOrSet(
    cacheKey,
    async () => {
      // Get employees by primary assignment
      const primaryEmployees = await prisma.employeeDetails.findMany({
        where: {
          primaryCentralDeptId: centralDeptId,
          isActive: true,
        },
        include: {
          userLogin: { select: USER_SELECT },
        },
      });

      // Get employees via CentralDepartmentPermission
      const permissionUsers = await prisma.centralDepartmentPermission.findMany({
        where: {
          centralDeptId,
          isActive: true,
        },
        include: {
          user: { select: USER_SELECT },
        },
      });

      // Combine and deduplicate by user id
      const userMap = new Map();
      primaryEmployees.forEach((emp) => {
        if (emp.userLogin) userMap.set(emp.userLogin.id, emp.userLogin);
      });
      permissionUsers.forEach((perm) => {
        if (perm.user) userMap.set(perm.user.id, perm.user);
      });

      return Array.from(userMap.values());
    },
    1800 // 30 min cache
  );

  return cached || [];
};

/**
 * Expand a school (faculty) to all its employees
 * Includes both directly assigned and department-linked employees
 * @param {string} schoolId - UUID of the FacultySchoolList
 * @returns {Promise<object[]>}
 */
const expandSchool = async (schoolId) => {
  const cacheKey = `mail:school:${schoolId}`;
  const { data: cached } = await cache.getOrSet(
    cacheKey,
    async () => {
      const employees = await prisma.employeeDetails.findMany({
        where: {
          OR: [
            { primarySchoolId: schoolId },
            { primaryDepartment: { facultyId: schoolId } },
          ],
          isActive: true,
        },
        include: {
          userLogin: { select: USER_SELECT },
        },
      });

      const userMap = new Map();
      employees.forEach((emp) => {
        if (emp.userLogin) userMap.set(emp.userLogin.id, emp.userLogin);
      });

      return Array.from(userMap.values());
    },
    1800 // 30 min cache
  );

  return cached || [];
};

/**
 * Expand a department to all its employees
 * @param {string} departmentId - UUID of the Department
 * @returns {Promise<object[]>}
 */
const expandDepartment = async (departmentId) => {
  const cacheKey = `mail:dept:${departmentId}`;
  const { data: cached } = await cache.getOrSet(
    cacheKey,
    async () => {
      const employees = await prisma.employeeDetails.findMany({
        where: {
          primaryDepartmentId: departmentId,
          isActive: true,
        },
        include: {
          userLogin: { select: USER_SELECT },
        },
      });

      return employees
        .filter((emp) => emp.userLogin)
        .map((emp) => emp.userLogin);
    },
    1800 // 30 min cache
  );

  return cached || [];
};

/**
 * Expand a list of recipient identifiers to individual user IDs
 * Handles group prefixes: cdept:UUID, school:UUID, dept:UUID
 * @param {string[]} recipientList - Array of UIDs or group:id strings
 * @returns {Promise<string[]>} Array of user IDs
 */
const expandRecipientList = async (recipientList = []) => {
  const userIds = new Set();

  for (const recipient of recipientList) {
    if (recipient.startsWith('cdept:')) {
      const deptId = recipient.replace('cdept:', '');
      const users = await expandCentralDepartment(deptId);
      users.forEach((u) => userIds.add(u.id));
    } else if (recipient.startsWith('school:')) {
      const schoolId = recipient.replace('school:', '');
      const users = await expandSchool(schoolId);
      users.forEach((u) => userIds.add(u.id));
    } else if (recipient.startsWith('dept:')) {
      const deptId = recipient.replace('dept:', '');
      const users = await expandDepartment(deptId);
      users.forEach((u) => userIds.add(u.id));
    } else {
      // Individual UID -> resolve to user ID
      const user = await resolveUser(recipient);
      if (user) userIds.add(user.id);
    }
  }

  return Array.from(userIds);
};

/**
 * Get the admin user for auto-CC on student mails
 * @returns {Promise<object|null>}
 */
const getAdminForAutoCC = async () => {
  const cacheKey = 'mail:admin-autocc';
  const { data: cached } = await cache.getOrSet(
    cacheKey,
    async () => {
      // Prefer specific admin UID
      let admin = await prisma.userLogin.findUnique({
        where: { uid: 'admin' },
        select: { id: true, uid: true, email: true, role: true },
      });

      if (!admin || admin.status === 'inactive') {
        // Fallback: first active admin/superadmin
        admin = await prisma.userLogin.findFirst({
          where: {
            role: { in: ['admin', 'superadmin'] },
            status: 'active',
          },
          select: { id: true, uid: true, email: true, role: true },
        });
      }

      return admin;
    },
    3600 // 1 hour cache
  );

  return cached;
};

/**
 * Search users for mail recipient selection
 * Fast typeahead search by UID, name, email
 * For employees, also returns groups (central depts, schools, departments)
 * @param {string} query - Search term (min 2 chars)
 * @param {string} userRole - Role of the searcher
 * @param {boolean} includeGroups - Whether to include group options
 * @returns {Promise<object[]>}
 */
const searchUsersForMail = async (query, userRole, includeGroups = false) => {
  if (!query || query.length < 2) return [];

  const results = [];

  // Search users by UID, employee name, student name
  const users = await prisma.userLogin.findMany({
    where: {
      AND: [
        { status: 'active' },
        {
          OR: [
            { uid: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            {
              employeeDetails: {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { displayName: { contains: query, mode: 'insensitive' } },
                ],
              },
            },
            {
              studentLogin: {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { displayName: { contains: query, mode: 'insensitive' } },
                  { studentId: { contains: query, mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
      ],
    },
    take: 15,
    select: USER_SELECT,
  });

  users.forEach((user) => {
    const displayName = getDisplayName(user);
    results.push({
      id: user.id,
      uid: user.uid,
      displayName: displayName,
      displayLabel: displayName,
      email: user.email || `${user.uid}@ums.sgtu`,
      role: user.role,
      designation:
        user.employeeDetails?.designation ||
        (user.studentLogin
          ? `Student - Sem ${user.studentLogin.currentSemester || '?'}`
          : ''),
      department:
        user.employeeDetails?.primaryDepartment?.departmentName ||
        user.employeeDetails?.primarySchool?.facultyName ||
        user.employeeDetails?.primaryCentralDept?.departmentName ||
        user.studentLogin?.program?.programName ||
        '',
      profileImage: user.profileImage || user.profileImageFilePath,
      type: 'user',
    });
  });

  // For employees, include group options (central depts, schools, departments)
  if (includeGroups && userRole !== 'student') {
    // Search central departments
    const centralDepts = await prisma.centralDepartment.findMany({
      where: {
        OR: [
          { departmentName: { contains: query, mode: 'insensitive' } },
          { departmentCode: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, departmentName: true, departmentCode: true },
    });

    centralDepts.forEach((dept) => {
      const displayName = `${dept.departmentName} (All Staff)`;
      results.push({
        id: dept.id,
        uid: `cdept:${dept.id}`,
        displayName: displayName,
        displayLabel: displayName,
        email: `cdept:${dept.id}`,
        role: 'group',
        designation: 'Central Department',
        department: dept.departmentCode,
        type: 'central_department',
      });
    });

    // Search schools
    const schools = await prisma.facultySchoolList.findMany({
      where: {
        OR: [
          { facultyName: { contains: query, mode: 'insensitive' } },
          { facultyCode: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, facultyName: true, facultyCode: true },
    });

    schools.forEach((school) => {
      const displayName = `${school.facultyName} (All Faculty & Staff)`;
      results.push({
        id: school.id,
        uid: `school:${school.id}`,
        displayName: displayName,
        displayLabel: displayName,
        email: `school:${school.id}`,
        role: 'group',
        designation: 'School',
        department: school.facultyCode,
        type: 'school',
      });
    });

    // Search departments (under schools)
    const departments = await prisma.department.findMany({
      where: {
        OR: [
          { departmentName: { contains: query, mode: 'insensitive' } },
          { departmentCode: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: {
        id: true,
        departmentName: true,
        departmentCode: true,
        faculty: { select: { facultyName: true } },
      },
    });

    departments.forEach((dept) => {
      const displayName = `${dept.departmentName} (All Staff)`;
      results.push({
        id: dept.id,
        uid: `dept:${dept.id}`,
        displayName: displayName,
        displayLabel: displayName,
        email: `dept:${dept.id}`,
        role: 'group',
        designation: 'Department',
        department: dept.faculty?.facultyName || dept.departmentCode,
        type: 'department',
      });
    });
  }

  return results;
};

module.exports = {
  USER_SELECT,
  getDisplayName,
  resolveUser,
  resolveUsers,
  expandCentralDepartment,
  expandSchool,
  expandDepartment,
  expandRecipientList,
  getAdminForAutoCC,
  searchUsersForMail,
  getAllMailGroups,
};

/**
 * Get all departments, schools, and central departments for group mail browsing.
 * Used by the "Browse Groups" panel in the compose recipient selector.
 * @returns {Promise<{ centralDepts: object[], schools: object[], departments: object[] }>}
 */
async function getAllMailGroups() {
  const cacheKey = 'mail:all-groups';
  const { data: cached } = await cache.getOrSet(
    cacheKey,
    async () => {
      const [centralDepts, schools, departments] = await Promise.all([
        prisma.centralDepartment.findMany({
          orderBy: { departmentName: 'asc' },
          select: { id: true, departmentName: true, departmentCode: true },
        }),
        prisma.facultySchoolList.findMany({
          orderBy: { facultyName: 'asc' },
          select: { id: true, facultyName: true, facultyCode: true },
        }),
        prisma.department.findMany({
          orderBy: { departmentName: 'asc' },
          select: {
            id: true,
            departmentName: true,
            departmentCode: true,
            faculty: { select: { id: true, facultyName: true } },
          },
        }),
      ]);

      return {
        centralDepts: centralDepts.map((d) => ({
          id: d.id,
          uid: `cdept:${d.id}`,
          displayName: d.departmentName,
          displayLabel: `${d.departmentName} (All Staff)`,
          code: d.departmentCode,
          type: 'central_department',
        })),
        schools: schools.map((s) => ({
          id: s.id,
          uid: `school:${s.id}`,
          displayName: s.facultyName,
          displayLabel: `${s.facultyName} (All Staff)`,
          code: s.facultyCode,
          type: 'school',
        })),
        departments: departments.map((d) => ({
          id: d.id,
          uid: `dept:${d.id}`,
          displayName: d.departmentName,
          displayLabel: `${d.departmentName} (All Staff)`,
          code: d.departmentCode,
          schoolName: d.faculty?.facultyName || '',
          schoolId: d.faculty?.id || null,
          type: 'department',
        })),
      };
    },
    1800 // 30 min cache
  );

  return cached;
}
