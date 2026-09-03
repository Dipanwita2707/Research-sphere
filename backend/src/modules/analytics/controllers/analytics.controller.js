const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');

/**
 * Get university overview statistics
 */
exports.getUniversityOverview = async (req, res) => {
  try {
    // Serve from cache when available (analytics data is acceptable to be 2min stale)
    const CACHE_KEY = `analytics:overview:${req.tenantId || 'global'}`;
    const cached = await cache.get(CACHE_KEY);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
    }

    // Batch queries to reduce concurrent connections
    // First batch: Schools and Departments
    const [
      totalSchools,
      activeSchools,
      totalDepartments,
      activeDepartments,
      uniInfo,
    ] = await Promise.all([
      prisma.facultySchoolList.count(),
      prisma.facultySchoolList.count({ where: { isActive: true } }),
      prisma.department.count(),
      prisma.department.count({ where: { isActive: true } }),
      req.tenantId ? prisma.university.findUnique({
        where: { id: req.tenantId },
        select: { name: true }
      }) : Promise.resolve(null),
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

    // Fourth batch: Research, Grants and Collaborations
    const [
      totalResearch,
      approvedResearch,
      totalGrants,
      approvedGrants,
      sumGrantsFunding,
      uniqueCollaborators,
    ] = await Promise.all([
      prisma.researchContribution.count(),
      prisma.researchContribution.count({ where: { status: 'approved' } }),
      prisma.grantApplication.count(),
      prisma.grantApplication.count({ where: { status: 'approved' } }),
      prisma.grantApplication.aggregate({
        where: { status: 'approved' },
        _sum: { submittedAmount: true },
      }),
      prisma.researchContributionAuthor.groupBy({
        by: ['name'],
      }),
    ]);

    // Fifth batch: category breakdowns (publicationType, iprType)
    const [byPublicationType, byIprType] = await Promise.all([
      prisma.researchContribution.groupBy({
        by: ['publicationType'],
        _count: { id: true },
      }),
      prisma.iprApplication.groupBy({
        by: ['iprType'],
        _count: { id: true },
      }),
    ]);

    const publicationTypeCounts = {};
    byPublicationType.forEach(item => {
      publicationTypeCounts[item.publicationType] = item._count.id;
    });

    const iprTypeCounts = {};
    byIprType.forEach(item => {
      iprTypeCounts[item.iprType] = item._count.id;
    });

    const overviewData = {
      university: {
        name: uniInfo ? uniInfo.name : 'University',
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
        byType: {
          patent: iprTypeCounts.patent || 0,
          copyright: iprTypeCounts.copyright || 0,
          trademark: iprTypeCounts.trademark || 0,
          design: iprTypeCounts.design || 0,
        },
      },
      research: {
        total: totalResearch,
        approved: approvedResearch,
      },
      grants: {
        total: totalGrants,
        approved: approvedGrants,
        totalFunding: sumGrantsFunding._sum.submittedAmount || 0,
      },
      collaborations: {
        total: uniqueCollaborators.length,
      },
      // Unified category breakdown across all research-output types, used by the
      // analytics dashboard to show Research Papers / Books / Chapters / Conferences
      // / Grants / IPR side-by-side instead of just raw IPR filings.
      categories: {
        researchPapers: publicationTypeCounts.research_paper || 0,
        books: publicationTypeCounts.book || 0,
        bookChapters: publicationTypeCounts.book_chapter || 0,
        conferencePapers: publicationTypeCounts.conference_paper || 0,
        grants: totalGrants,
        ipr: {
          total: totalIprApplications,
          patent: iprTypeCounts.patent || 0,
          copyright: iprTypeCounts.copyright || 0,
          trademark: iprTypeCounts.trademark || 0,
          design: iprTypeCounts.design || 0,
        },
      },
    };
    await cache.set(CACHE_KEY, JSON.stringify(overviewData), 120);
    return res.json({ success: true, data: overviewData });
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

    // Cache key includes all query params so filtered results are cached separately
    const CACHE_KEY = `analytics:schools:${dateFrom || ''}:${dateTo || ''}:${iprType || ''}`;
    const cached = await cache.get(CACHE_KEY);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached) });
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

    // Research/grant records use the same createdAt-range filter, but never
    // filter by iprType (that's IPR-specific).
    const dateOnlyWhere = {};
    if (dateFrom) {
      dateOnlyWhere.createdAt = { ...dateOnlyWhere.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      dateOnlyWhere.createdAt = { ...dateOnlyWhere.createdAt, lte: new Date(dateTo) };
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
        researchContributions: {
          where: dateOnlyWhere,
          select: {
            id: true,
            status: true,
            publicationType: true,
          },
        },
        grantApplications: {
          where: dateOnlyWhere,
          select: {
            id: true,
            status: true,
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

      const categories = {
        researchPapers: 0,
        books: 0,
        bookChapters: 0,
        conferencePapers: 0,
        grants: school.grantApplications.length,
        ipr: iprStats.total,
      };
      school.researchContributions.forEach(rc => {
        if (rc.publicationType === 'research_paper') categories.researchPapers++;
        else if (rc.publicationType === 'book') categories.books++;
        else if (rc.publicationType === 'book_chapter') categories.bookChapters++;
        else if (rc.publicationType === 'conference_paper') categories.conferencePapers++;
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
        categories,
      };
    });

    await cache.set(CACHE_KEY, JSON.stringify(schoolStats), 300); // 5 min TTL
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

    // Research/grant records use the same createdAt-range filter, but never
    // filter by iprType (that's IPR-specific).
    const dateOnlyWhere = {};
    if (dateFrom) {
      dateOnlyWhere.createdAt = { ...dateOnlyWhere.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      dateOnlyWhere.createdAt = { ...dateOnlyWhere.createdAt, lte: new Date(dateTo) };
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
        researchContributions: {
          where: dateOnlyWhere,
          select: {
            id: true,
            status: true,
            publicationType: true,
          },
        },
        grantApplications: {
          where: dateOnlyWhere,
          select: {
            id: true,
            status: true,
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

      const categories = {
        researchPapers: 0,
        books: 0,
        bookChapters: 0,
        conferencePapers: 0,
        grants: dept.grantApplications.length,
        ipr: iprStats.total,
      };
      dept.researchContributions.forEach(rc => {
        if (rc.publicationType === 'research_paper') categories.researchPapers++;
        else if (rc.publicationType === 'book') categories.books++;
        else if (rc.publicationType === 'book_chapter') categories.bookChapters++;
        else if (rc.publicationType === 'conference_paper') categories.conferencePapers++;
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
        categories,
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
      where.applicantType = userType;
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

      // Group by applicant type (field is on IprApplication, not IprApplicantDetails)
      prisma.iprApplication.groupBy({
        by: ['applicantType'],
        where,
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
          applicantType: true,
          status: true,
          createdAt: true,
          school: {
            select: { facultyCode: true, facultyName: true },
          },
          department: {
            select: { departmentCode: true, departmentName: true },
          },
          applicantDetails: {
            select: {
              uid: true,
              inventorName: true,
              externalName: true,
            },
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

    // Normalize recentApplications: derive a display name from available fields
    const normalizedRecent = recentApplications.map(app => ({
      ...app,
      applicantDisplayName:
        app.applicantDetails?.inventorName ||
        app.applicantDetails?.externalName ||
        app.applicantDetails?.uid ||
        'Unknown',
    }));

    res.json({
      success: true,
      data: {
        total: totalApplications,
        byStatus: statusCounts,
        byType: typeCounts,
        byUserType: userTypeCounts,
        recentApplications: normalizedRecent,
      },
    });
  } catch (error) {
    console.error('Get IPR analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch IPR analytics' });
  }
};

/**
 * Get research/grant category analytics (Research Papers, Books, Book Chapters,
 * Conference Papers, Grants) with the same filter shape as getIprAnalytics.
 */
exports.getCategoryAnalytics = async (req, res) => {
  try {
    const { schoolId, departmentId, dateFrom, dateTo, publicationType, status } = req.query;

    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;
    if (publicationType) where.publicationType = publicationType;
    if (status) where.status = status;
    if (dateFrom) {
      where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
    }

    const grantWhere = {};
    if (schoolId) grantWhere.schoolId = schoolId;
    if (departmentId) grantWhere.departmentId = departmentId;
    if (status) grantWhere.status = status;
    if (dateFrom) {
      grantWhere.createdAt = { ...grantWhere.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      grantWhere.createdAt = { ...grantWhere.createdAt, lte: new Date(dateTo) };
    }

    const [
      totalContributions,
      byPublicationType,
      byStatus,
      recentContributions,
      totalGrants,
      byGrantStatus,
      recentGrants,
    ] = await Promise.all([
      prisma.researchContribution.count({ where }),
      prisma.researchContribution.groupBy({
        by: ['publicationType'],
        where,
        _count: { id: true },
      }),
      prisma.researchContribution.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      prisma.researchContribution.findMany({
        where,
        select: {
          id: true,
          applicationNumber: true,
          title: true,
          publicationType: true,
          status: true,
          createdAt: true,
          school: { select: { facultyCode: true, facultyName: true } },
          department: { select: { departmentCode: true, departmentName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.grantApplication.count({ where: grantWhere }),
      prisma.grantApplication.groupBy({
        by: ['status'],
        where: grantWhere,
        _count: { id: true },
      }),
      prisma.grantApplication.findMany({
        where: grantWhere,
        select: {
          id: true,
          applicationNumber: true,
          title: true,
          status: true,
          submittedAmount: true,
          createdAt: true,
          school: { select: { facultyCode: true, facultyName: true } },
          department: { select: { departmentCode: true, departmentName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const publicationTypeCounts = {};
    byPublicationType.forEach(item => {
      publicationTypeCounts[item.publicationType] = item._count.id;
    });

    const statusCounts = {};
    byStatus.forEach(item => {
      statusCounts[item.status] = item._count.id;
    });

    const grantStatusCounts = {};
    byGrantStatus.forEach(item => {
      grantStatusCounts[item.status] = item._count.id;
    });

    res.json({
      success: true,
      data: {
        total: totalContributions + totalGrants,
        researchPapers: publicationTypeCounts.research_paper || 0,
        books: publicationTypeCounts.book || 0,
        bookChapters: publicationTypeCounts.book_chapter || 0,
        conferencePapers: publicationTypeCounts.conference_paper || 0,
        byPublicationType: publicationTypeCounts,
        byStatus: statusCounts,
        recentContributions,
        grants: {
          total: totalGrants,
          byStatus: grantStatusCounts,
          recent: recentGrants,
        },
      },
    });
  } catch (error) {
    console.error('Get category analytics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch category analytics' });
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
        applicantUserId: true,
        applicantType: true,
        status: true,
        applicantDetails: {
          select: {
            uid: true,
            inventorName: true,
            externalName: true,
          },
        },
      },
    });

    // Aggregate by user
    const userStats = new Map();
    applications.forEach(app => {
      if (!app.applicantUserId) return;
      const displayName =
        app.applicantDetails?.inventorName ||
        app.applicantDetails?.externalName ||
        app.applicantDetails?.uid ||
        'Unknown';
      if (!userStats.has(app.applicantUserId)) {
        userStats.set(app.applicantUserId, {
          userId: app.applicantUserId,
          name: displayName,
          type: app.applicantType || 'unknown',
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
        });
      }

      const stats = userStats.get(app.applicantUserId);
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

    const CACHE_KEY = `analytics:monthly:${year}:${schoolId || ''}:${departmentId || ''}`;
    const cached = await cache.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return res.json({ success: true, data: parsed.monthlyData, categoryTrend: parsed.categoryTrend });
    }

    // Build filter
    const where = {
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      },
    };
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;

    const researchWhere = {
      createdAt: where.createdAt,
    };
    if (schoolId) researchWhere.schoolId = schoolId;
    if (departmentId) researchWhere.departmentId = departmentId;

    const [applications, contributions, grants] = await Promise.all([
      prisma.iprApplication.findMany({
        where,
        select: {
          createdAt: true,
          status: true,
          iprType: true,
        },
      }),
      prisma.researchContribution.findMany({
        where: researchWhere,
        select: {
          createdAt: true,
          status: true,
          publicationType: true,
        },
      }),
      prisma.grantApplication.findMany({
        where: researchWhere,
        select: {
          createdAt: true,
          status: true,
        },
      }),
    ]);

    // Group by month
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(2000, i, 1).toLocaleString('default', { month: 'short' }),
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
    }));

    // Category trend: per-month counts for each research-output category, so
    // the dashboard can chart Research Papers / Books / Chapters / Conferences /
    // Grants / IPR side-by-side instead of just IPR filings.
    const categoryTrend = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: new Date(2000, i, 1).toLocaleString('default', { month: 'short' }),
      researchPapers: 0,
      books: 0,
      bookChapters: 0,
      conferencePapers: 0,
      grants: 0,
      ipr: 0,
    }));

    applications.forEach(app => {
      const month = new Date(app.createdAt).getMonth();
      monthlyData[month].total++;
      categoryTrend[month].ipr++;

      if (app.status === 'completed') {
        monthlyData[month].approved++;
      } else if (app.status === 'drd_rejected') {
        monthlyData[month].rejected++;
      } else {
        monthlyData[month].pending++;
      }
    });

    contributions.forEach(rc => {
      const month = new Date(rc.createdAt).getMonth();
      if (rc.publicationType === 'research_paper') categoryTrend[month].researchPapers++;
      else if (rc.publicationType === 'book') categoryTrend[month].books++;
      else if (rc.publicationType === 'book_chapter') categoryTrend[month].bookChapters++;
      else if (rc.publicationType === 'conference_paper') categoryTrend[month].conferencePapers++;
    });

    grants.forEach(g => {
      const month = new Date(g.createdAt).getMonth();
      categoryTrend[month].grants++;
    });

    const responseData = { monthlyData, categoryTrend };
    await cache.set(CACHE_KEY, JSON.stringify(responseData), 300); // 5 min TTL
    res.json({
      success: true,
      data: monthlyData,
      categoryTrend,
    });
  } catch (error) {
    console.error('Get monthly trend error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch monthly trend' });
  }
};
