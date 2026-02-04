const prisma = require('../../../shared/config/database');

/**
 * Get university overview statistics
 */
exports.getUniversityOverview = async (req, res) => {
  try {
    // Batch queries to reduce concurrent connections
    // First batch: Schools and Departments
    const [
      totalSchools,
      activeSchools,
      totalDepartments,
      activeDepartments,
    ] = await Promise.all([
      prisma.facultySchoolList.count(),
      prisma.facultySchoolList.count({ where: { isActive: true } }),
      prisma.department.count(),
      prisma.department.count({ where: { isActive: true } }),
    ]);

    // Second batch: Programs and Employees
    const [
      totalProgrammes,
      totalEmployees,
      activeEmployees,
    ] = await Promise.all([
      prisma.program.count(),
      prisma.employeeDetails.count(),
      prisma.employeeDetails.count({ where: { isActive: true } }),
    ]);

    // Third batch: Students and IPR
    const [
      totalStudents,
      activeStudents,
      totalIprApplications,
      approvedIpr,
      pendingIpr,
    ] = await Promise.all([
      prisma.studentDetails.count(),
      prisma.studentDetails.count({ where: { isActive: true } }),
      prisma.iprApplication.count(),
      prisma.iprApplication.count({ where: { status: 'completed' } }),
      prisma.iprApplication.count({
        where: {
          status: {
            in: ['submitted', 'under_drd_review', 'recommended_to_head'],
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        university: {
          schools: { total: totalSchools, active: activeSchools },
          departments: { total: totalDepartments, active: activeDepartments },
          programmes: { total: totalProgrammes },
        },
        users: {
          employees: { total: totalEmployees, active: activeEmployees },
          students: { total: totalStudents, active: activeStudents },
        },
        ipr: {
          total: totalIprApplications,
          approved: approvedIpr,
          pending: pendingIpr,
        },
      },
    });
  } catch (error) {
    console.error('Get university overview error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch overview statistics' });
  }
};

/**
 * Get school-wise statistics
 */
exports.getSchoolWiseStats = async (req, res) => {
  try {
    const { dateFrom, dateTo, iprType } = req.query;

    // Build IPR filter
    const iprWhere = {};
    if (dateFrom) {
      iprWhere.createdAt = { ...iprWhere.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      iprWhere.createdAt = { ...iprWhere.createdAt, lte: new Date(dateTo) };
    }
    if (iprType) {
      iprWhere.iprType = iprType;
    }

    const schools = await prisma.facultySchoolList.findMany({
      where: { isActive: true },
      select: {
        id: true,
        facultyCode: true,
        facultyName: true,
        shortName: true,
        _count: {
          select: {
            departments: true,
          },
        },
        departments: {
          select: {
            id: true,
            _count: {
              select: {
                primaryEmployees: true,
                programs: true,
              },
            },
          },
        },
        iprApplications: {
          where: iprWhere,
          select: {
            id: true,
            status: true,
            iprType: true,
          },
        },
      },
      orderBy: { facultyName: 'asc' },
    });

    // Transform data
    const schoolStats = schools.map(school => {
      const totalEmployees = school.departments.reduce(
        (sum, dept) => sum + dept._count.primaryEmployees,
        0
      );
      const totalProgrammes = school.departments.reduce(
        (sum, dept) => sum + dept._count.programs,
        0
      );

      const iprStats = {
        total: school.iprApplications.length,
        byStatus: {},
        byType: {},
      };

      school.iprApplications.forEach(ipr => {
        // Count by status
        iprStats.byStatus[ipr.status] = (iprStats.byStatus[ipr.status] || 0) + 1;
        // Count by type
        iprStats.byType[ipr.iprType] = (iprStats.byType[ipr.iprType] || 0) + 1;
      });

      return {
        id: school.id,
        code: school.facultyCode,
        name: school.facultyName,
        shortName: school.shortName,
        departments: school._count.departments,
        employees: totalEmployees,
        programmes: totalProgrammes,
        ipr: iprStats,
      };
    });

    res.json({
      success: true,
      data: schoolStats,
    });
  } catch (error) {
    console.error('Get school-wise stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch school-wise statistics' });
  }
};

/**
 * Get department-wise statistics
 */
exports.getDepartmentWiseStats = async (req, res) => {
  try {
    const { schoolId, dateFrom, dateTo, iprType } = req.query;

    // Build department filter
    const deptWhere = { isActive: true };
    if (schoolId) {
      deptWhere.facultyId = schoolId;
    }

    // Build IPR filter
    const iprWhere = {};
    if (dateFrom) {
      iprWhere.createdAt = { ...iprWhere.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      iprWhere.createdAt = { ...iprWhere.createdAt, lte: new Date(dateTo) };
    }
    if (iprType) {
      iprWhere.iprType = iprType;
    }

    const departments = await prisma.department.findMany({
      where: deptWhere,
      select: {
        id: true,
        departmentCode: true,
        departmentName: true,
        shortName: true,
        faculty: {
          select: {
            id: true,
            facultyCode: true,
            facultyName: true,
          },
        },
        _count: {
          select: {
            primaryEmployees: true,
            programs: true,
          },
        },
        iprApplications: {
          where: iprWhere,
          select: {
            id: true,
            status: true,
            iprType: true,
          },
        },
      },
      orderBy: [{ faculty: { facultyName: 'asc' } }, { departmentName: 'asc' }],
    });

    // Transform data
    const deptStats = departments.map(dept => {
      const iprStats = {
        total: dept.iprApplications.length,
        byStatus: {},
        byType: {},
      };

      dept.iprApplications.forEach(ipr => {
        iprStats.byStatus[ipr.status] = (iprStats.byStatus[ipr.status] || 0) + 1;
        iprStats.byType[ipr.iprType] = (iprStats.byType[ipr.iprType] || 0) + 1;
      });

      return {
        id: dept.id,
        code: dept.departmentCode,
        name: dept.departmentName,
        shortName: dept.shortName,
        school: {
          id: dept.faculty.id,
          code: dept.faculty.facultyCode,
          name: dept.faculty.facultyName,
        },
        employees: dept._count.primaryEmployees,
        programmes: dept._count.programs,
        ipr: iprStats,
      };
    });

    res.json({
      success: true,
      data: deptStats,
    });
  } catch (error) {
    console.error('Get department-wise stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch department-wise statistics' });
  }
};

/**
 * Get IPR analytics with filters
 */
exports.getIprAnalytics = async (req, res) => {
  try {
    const { schoolId, departmentId, userType, dateFrom, dateTo, iprType, status } = req.query;

    // Build filter
    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;
    if (iprType) where.iprType = iprType;
    if (status) where.status = status;
    if (dateFrom) {
      where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
    }

    // Get applicant details filter if userType specified
    if (userType) {
      where.applicantDetails = {
        applicantType: userType,
      };
    }

    // Get total counts
    const [
      totalApplications,
      byStatus,
      byType,
      byUserType,
      recentApplications,
    ] = await Promise.all([
      // Total count
      prisma.iprApplication.count({ where }),

      // Group by status
      prisma.iprApplication.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),

      // Group by type
      prisma.iprApplication.groupBy({
        by: ['iprType'],
        where,
        _count: { id: true },
      }),

      // Group by applicant type
      prisma.iprApplicantDetails.groupBy({
        by: ['applicantType'],
        where: where.applicantDetails || {},
        _count: { id: true },
      }),

      // Recent applications
      prisma.iprApplication.findMany({
        where,
        select: {
          id: true,
          applicationNumber: true,
          title: true,
          iprType: true,
          status: true,
          createdAt: true,
          school: {
            select: { facultyCode: true, facultyName: true },
          },
          department: {
            select: { departmentCode: true, departmentName: true },
          },
          applicantDetails: {
            select: { applicantName: true, applicantType: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Transform grouped data
    const statusCounts = {};
    byStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    const typeCounts = {};
    byType.forEach(item => {
      typeCounts[item.iprType] = item._count.id;
    });

    const userTypeCounts = {};
    byUserType.forEach(item => {
      userTypeCounts[item.applicantType] = item._count.id;
    });

    res.json({
      success: true,
      data: {
        total: totalApplications,
        byStatus: statusCounts,
        byType: typeCounts,
        byUserType: userTypeCounts,
        recentApplications,
      },
    });
  } catch (error) {
    console.error('Get IPR analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch IPR analytics' });
  }
};

/**
 * Get top performers (users with most IPR filings)
 */
exports.getTopPerformers = async (req, res) => {
  try {
    const { schoolId, departmentId, dateFrom, dateTo, limit = 10 } = req.query;

    // Build filter
    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;
    if (dateFrom) {
      where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
    }

    // Get applications grouped by user
    const applications = await prisma.iprApplication.findMany({
      where,
      select: {
        userId: true,
        status: true,
        applicantDetails: {
          select: {
            applicantName: true,
            applicantType: true,
          },
        },
      },
    });

    // Aggregate by user
    const userStats = new Map();
    applications.forEach(app => {
      if (!app.userId) return;
      
      if (!userStats.has(app.userId)) {
        userStats.set(app.userId, {
          userId: app.userId,
          name: app.applicantDetails?.applicantName || 'Unknown',
          type: app.applicantDetails?.applicantType || 'unknown',
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
        });
      }

      const stats = userStats.get(app.userId);
      stats.total++;

      if (app.status === 'completed') {
        stats.approved++;
      } else if (app.status === 'drd_rejected') {
        stats.rejected++;
      } else {
        stats.pending++;
      }
    });

    // Sort by total filings and take top N
    const topPerformers = Array.from(userStats.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: topPerformers,
    });
  } catch (error) {
    console.error('Get top performers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch top performers' });
  }
};

/**
 * Get monthly trend data
 */
exports.getMonthlyTrend = async (req, res) => {
  try {
    const { schoolId, departmentId, year = new Date().getFullYear() } = req.query;

    // Build filter
    const where = {
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      },
    };
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;

    const applications = await prisma.iprApplication.findMany({
      where,
      select: {
        createdAt: true,
        status: true,
        iprType: true,
      },
    });

    // Group by month
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(2000, i, 1).toLocaleString('default', { month: 'short' }),
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
    }));

    applications.forEach(app => {
      const month = new Date(app.createdAt).getMonth();
      monthlyData[month].total++;

      if (app.status === 'completed') {
        monthlyData[month].approved++;
      } else if (app.status === 'drd_rejected') {
        monthlyData[month].rejected++;
      } else {
        monthlyData[month].pending++;
      }
    });

    res.json({
      success: true,
      data: monthlyData,
    });
  } catch (error) {
    console.error('Get monthly trend error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly trend' });
  }
};
