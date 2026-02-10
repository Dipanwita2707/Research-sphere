const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');

// Get student dashboard data - OPTIMIZED WITH CACHING
exports.getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `${cache.CACHE_KEYS.DASHBOARD}student:${userId}`;

    // Try cache first
    const { data: cachedData, fromCache } = await cache.getOrSet(
      cacheKey,
      async () => {
        // OPTIMIZED: Only select needed fields - flatten nested includes
        const user = await prisma.userLogin.findUnique({
          where: { id: userId },
          select: {
            id: true,
            uid: true,
            email: true,
            studentLogin: {
              select: {
                cgpa: true,
                attendancePercentage: true,
                currentSemester: true,
                program: {
                  select: {
                    programName: true
                  }
                }
              }
            }
          }
        });

        if (!user || !user.studentLogin) {
          return null;
        }

        const student = user.studentLogin;

        // Prepare student dashboard data
        return {
          cgpa: parseFloat(student.cgpa) || 0,
          attendance: parseFloat(student.attendancePercentage) || 0,
          semester: student.currentSemester || 0,
          program: student.program?.programName || 'N/A',
          enrolledCourses: 0,
          completedCredits: 0,
          pendingAssignments: 0,
          upcomingExams: 0
        };
      },
      cache.CACHE_TTL.DASHBOARD
    );

    if (!cachedData) {
      return res.status(404).json({
        success: false,
        message: 'Student data not found'
      });
    }

    res.status(200).json({
      success: true,
      data: cachedData,
      cached: fromCache
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching student dashboard data'
    });
  }
};

// Get staff dashboard data - OPTIMIZED WITH CACHING
exports.getStaffDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `${cache.CACHE_KEYS.DASHBOARD}staff:${userId}`;

    // Try cache first
    const { data: cachedData, fromCache } = await cache.getOrSet(
      cacheKey,
      async () => {
        // Use merged permissions from req.user (includes role-based permissions)
        // req.user already has centralDeptPermissions and schoolDeptPermissions merged with role-based perms
        const schoolDeptPerms = req.user?.schoolDeptPermissions || [];
        const centralDeptPerms = req.user?.centralDeptPermissions || [];
        
        // Fetch basic user info with employee details
        const user = await prisma.userLogin.findUnique({
          where: { id: userId },
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
                select: {
                  designation: true,
                  primaryDepartmentId: true,
                  primaryDepartment: {
                    select: {
                      departmentName: true,
                      faculty: {
                        select: { facultyName: true }
                      }
                    }
                  },
                  primaryCentralDept: {
                    select: { departmentName: true }
                  }
                }
              }
            }
        });

        if (!user) {
          return null;
        }

        // Prepare staff dashboard data
        const dashboardData = {
          department: user.employeeDetails?.primaryDepartment?.departmentName || 
                     user.employeeDetails?.primaryCentralDept?.departmentName || 'N/A',
          designation: user.employeeDetails?.designation || 'N/A',
          faculty: user.employeeDetails?.primaryDepartment?.faculty?.facultyName || 'Central Department',
          permissions: [],
          activeStudents: 0,
          coursesAssigned: 0,
          pendingApprovals: 0,
          departmentStrength: 0
        };

        // Format permissions by category
        const permissionsByCategory = {};
        
        // Process school department permissions
        schoolDeptPerms.forEach(dp => {
          if (dp.permissions) {
            const category = dp.department?.departmentName || 'Department';
            if (!permissionsByCategory[category]) {
              permissionsByCategory[category] = [];
            }
            const perms = typeof dp.permissions === 'string' 
              ? JSON.parse(dp.permissions) 
              : dp.permissions;
            
            if (Array.isArray(perms)) {
              permissionsByCategory[category].push(...perms);
            } else if (typeof perms === 'object' && perms !== null) {
              Object.keys(perms).forEach(key => {
                if (perms[key] === true) {
                  permissionsByCategory[category].push(key);
                }
              });
            }
          }
        });
        
        // Process central department permissions
        centralDeptPerms.forEach(cp => {
          if (cp.permissions) {
            const category = cp.centralDept?.departmentName || 'Central Department';
            if (!permissionsByCategory[category]) {
              permissionsByCategory[category] = [];
            }
            const perms = typeof cp.permissions === 'string' 
              ? JSON.parse(cp.permissions) 
              : cp.permissions;
            
            if (Array.isArray(perms)) {
              permissionsByCategory[category].push(...perms);
            } else if (typeof perms === 'object' && perms !== null) {
              Object.keys(perms).forEach(key => {
                if (perms[key] === true) {
                  permissionsByCategory[category].push(key);
                }
              });
            }
          }
        });

        dashboardData.permissions = Object.entries(permissionsByCategory).map(([category, perms]) => ({
          category,
          permissions: perms
        }));

        // Get department strength
        if (user.employeeDetails?.primaryDepartmentId) {
          const deptCount = await prisma.employeeDetails.count({
            where: {
              primaryDepartmentId: user.employeeDetails.primaryDepartmentId,
              isActive: true
            }
          });
          dashboardData.departmentStrength = deptCount;
        }

        return dashboardData;
      },
      cache.CACHE_TTL.DASHBOARD
    );

    if (!cachedData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: cachedData,
      cached: fromCache
    });
  } catch (error) {
    console.error('Staff dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching staff dashboard data'
    });
  }
};
