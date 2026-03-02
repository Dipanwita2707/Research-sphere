/**
 * TMS Analytics Service
 * Admin dashboard analytics and reporting
 */
const prisma = require('../../../shared/config/database');
const { TICKET_STATUS } = require('../constants/tms.constants');

/**
 * Get overview statistics for the admin dashboard
 */
async function getOverviewStats(filters = {}) {
  const { startDate, endDate } = filters;
  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  const where = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  const [
    totalRequests,
    byStatus,
    byMessageType,
    byPriority,
    byEscalationLevel,
    avgRating,
    escalationCount,
  ] = await Promise.all([
    prisma.tmsTicket.count({ where }),
    prisma.tmsTicket.groupBy({ by: ['status'], where, _count: { id: true } }),
    prisma.tmsTicket.groupBy({ by: ['messageType'], where, _count: { id: true } }),
    prisma.tmsTicket.groupBy({ by: ['priority'], where, _count: { id: true } }),
    prisma.tmsTicket.groupBy({ by: ['currentLevel'], where, _count: { id: true } }),
    prisma.tmsRating.aggregate({ _avg: { rating: true }, _count: { id: true } }),
    prisma.tmsTimeline.count({
      where: {
        action: { in: ['escalated', 'auto_escalated'] },
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
    }),
  ]);

  // Resolution time metrics
  const resolvedTickets = await prisma.tmsTicket.findMany({
    where: {
      ...where,
      resolvedAt: { not: null },
    },
    select: { createdAt: true, resolvedAt: true },
  });

  let avgResolutionHours = 0;
  if (resolvedTickets.length > 0) {
    const totalHours = resolvedTickets.reduce((sum, t) => {
      return sum + (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
    }, 0);
    avgResolutionHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
  }

  return {
    totalRequests,
    byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
    byMessageType: byMessageType.reduce((acc, m) => ({ ...acc, [m.messageType]: m._count.id }), {}),
    byPriority: byPriority.reduce((acc, p) => ({ ...acc, [p.priority]: p._count.id }), {}),
    byEscalationLevel: byEscalationLevel.reduce((acc, l) => ({ ...acc, [l.currentLevel]: l._count.id }), {}),
    ratings: {
      average: avgRating._avg.rating ? Math.round(avgRating._avg.rating * 10) / 10 : null,
      totalRatings: avgRating._count.id,
    },
    escalations: escalationCount,
    resolution: {
      totalResolved: resolvedTickets.length,
      avgResolutionHours,
    },
  };
}

/**
 * Get per-employee statistics
 */
async function getEmployeeStats(filters = {}) {
  const { startDate, endDate } = filters;
  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  const where = {
    assignedToId: { not: null },
    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
  };

  const byEmployee = await prisma.tmsTicket.groupBy({
    by: ['assignedToId'],
    where,
    _count: { id: true },
  });

  // Enrich with user details, status breakdown, and ratings
  const enriched = await Promise.all(
    byEmployee.map(async (entry) => {
      const [user, statusBreakdown, ratingAgg] = await Promise.all([
        prisma.userLogin.findUnique({
          where: { id: entry.assignedToId },
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
                empId: true,
                designation: true,
              },
            },
          },
        }),
        prisma.tmsTicket.groupBy({
          by: ['status'],
          where: { ...where, assignedToId: entry.assignedToId },
          _count: { id: true },
        }),
        prisma.tmsRating.aggregate({
          where: {
            ticket: { assignedToId: entry.assignedToId },
          },
          _avg: { rating: true },
          _count: { id: true },
        }),
      ]);

      return {
        employee: user,
        totalAssigned: entry._count.id,
        byStatus: statusBreakdown.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
        avgRating: ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
        totalRatings: ratingAgg._count.id,
      };
    })
  );

  return enriched;
}

/**
 * Get per-category statistics (detailed)
 */
async function getCategoryStats(filters = {}) {
  const { startDate, endDate } = filters;
  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);
  const where = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  const [byMaster, byCategory, bySubCategory, totalTickets] = await Promise.all([
    prisma.tmsTicket.groupBy({
      by: ['masterCategoryId'],
      where,
      _count: { id: true },
    }),
    prisma.tmsTicket.groupBy({
      by: ['categoryId'],
      where,
      _count: { id: true },
    }),
    prisma.tmsTicket.groupBy({
      by: ['subCategoryId'],
      where,
      _count: { id: true },
    }),
    prisma.tmsTicket.count({ where }),
  ]);

  // Enrich with category names
  const masterIds = byMaster.map((m) => m.masterCategoryId);
  const catIds = byCategory.map((c) => c.categoryId);
  const subCatIds = bySubCategory.map((s) => s.subCategoryId);

  const [masters, cats, subCats] = await Promise.all([
    prisma.tmsMasterCategory.findMany({
      where: { id: { in: masterIds } },
      select: { id: true, name: true, isAcademic: true },
    }),
    prisma.tmsCategory.findMany({
      where: { id: { in: catIds } },
      select: { id: true, name: true, masterCategory: { select: { id: true, name: true } } },
    }),
    prisma.tmsSubCategory.findMany({
      where: { id: { in: subCatIds } },
      select: { id: true, name: true, category: { select: { id: true, name: true, masterCategory: { select: { name: true } } } } },
    }),
  ]);

  const masterMap = Object.fromEntries(masters.map((m) => [m.id, { name: m.name, isAcademic: m.isAcademic }]));
  const catMap = Object.fromEntries(cats.map((c) => [c.id, { name: c.name, masterCategory: c.masterCategory.name, masterCategoryId: c.masterCategory.id }]));
  const subCatMap = Object.fromEntries(subCats.map((s) => [s.id, { name: s.name, category: s.category.name, categoryId: s.category.id, masterCategory: s.category.masterCategory.name }]));

  // Per-master-category: status breakdown, priority breakdown, avg resolution, escalation count
  const masterEnriched = await Promise.all(
    byMaster.map(async (m) => {
      const mcWhere = { ...where, masterCategoryId: m.masterCategoryId };
      const [statuses, priorities, resolvedTickets, escalations, ratings] = await Promise.all([
        prisma.tmsTicket.groupBy({
          by: ['status'],
          where: mcWhere,
          _count: { id: true },
        }),
        prisma.tmsTicket.groupBy({
          by: ['priority'],
          where: mcWhere,
          _count: { id: true },
        }),
        prisma.tmsTicket.findMany({
          where: { ...mcWhere, resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
        }),
        prisma.tmsTimeline.count({
          where: {
            action: { in: ['escalated', 'auto_escalated'] },
            ticket: mcWhere,
          },
        }),
        prisma.tmsRating.aggregate({
          where: { ticket: mcWhere },
          _avg: { rating: true },
          _count: { id: true },
        }),
      ]);

      let avgResolutionHours = 0;
      if (resolvedTickets.length > 0) {
        const totalHours = resolvedTickets.reduce((sum, t) => {
          return sum + (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0);
        avgResolutionHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
      }

      return {
        id: m.masterCategoryId,
        name: masterMap[m.masterCategoryId]?.name || 'Unknown',
        isAcademic: masterMap[m.masterCategoryId]?.isAcademic || false,
        count: m._count.id,
        byStatus: statuses.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
        byPriority: priorities.reduce((acc, p) => ({ ...acc, [p.priority]: p._count.id }), {}),
        resolved: resolvedTickets.length,
        avgResolutionHours,
        escalations,
        avgRating: ratings._avg.rating ? Math.round(ratings._avg.rating * 10) / 10 : null,
        totalRatings: ratings._count.id,
      };
    })
  );

  // Per-category: status breakdown, avg resolution
  const categoryEnriched = await Promise.all(
    byCategory.map(async (c) => {
      const cWhere = { ...where, categoryId: c.categoryId };
      const [statuses, resolvedTickets] = await Promise.all([
        prisma.tmsTicket.groupBy({
          by: ['status'],
          where: cWhere,
          _count: { id: true },
        }),
        prisma.tmsTicket.findMany({
          where: { ...cWhere, resolvedAt: { not: null } },
          select: { createdAt: true, resolvedAt: true },
        }),
      ]);

      let avgResolutionHours = 0;
      if (resolvedTickets.length > 0) {
        const totalHours = resolvedTickets.reduce((sum, t) => {
          return sum + (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
        }, 0);
        avgResolutionHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
      }

      return {
        id: c.categoryId,
        name: catMap[c.categoryId]?.name || 'Unknown',
        masterCategory: catMap[c.categoryId]?.masterCategory || 'Unknown',
        count: c._count.id,
        byStatus: statuses.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
        resolved: resolvedTickets.length,
        avgResolutionHours,
      };
    })
  );

  // Per-sub-category: status breakdown
  const subCategoryEnriched = await Promise.all(
    bySubCategory.map(async (s) => {
      const sWhere = { ...where, subCategoryId: s.subCategoryId };
      const statuses = await prisma.tmsTicket.groupBy({
        by: ['status'],
        where: sWhere,
        _count: { id: true },
      });

      return {
        id: s.subCategoryId,
        name: subCatMap[s.subCategoryId]?.name || 'Unknown',
        category: subCatMap[s.subCategoryId]?.category || 'Unknown',
        masterCategory: subCatMap[s.subCategoryId]?.masterCategory || 'Unknown',
        count: s._count.id,
        byStatus: statuses.reduce((acc, st) => ({ ...acc, [st.status]: st._count.id }), {}),
      };
    })
  );

  // Summary totals
  const totalResolved = masterEnriched.reduce((s, m) => s + m.resolved, 0);
  const totalEscalations = masterEnriched.reduce((s, m) => s + m.escalations, 0);
  const academicCount = masterEnriched.filter((m) => m.isAcademic).reduce((s, m) => s + m.count, 0);
  const nonAcademicCount = masterEnriched.filter((m) => !m.isAcademic).reduce((s, m) => s + m.count, 0);

  return {
    summary: {
      totalTickets,
      totalCategories: catIds.length,
      totalSubCategories: subCatIds.length,
      totalMasterCategories: masterIds.length,
      totalResolved,
      totalEscalations,
      academicCount,
      nonAcademicCount,
    },
    byMasterCategory: masterEnriched,
    byCategory: categoryEnriched,
    bySubCategory: subCategoryEnriched,
  };
}

/**
 * List all tickets (admin view) with comprehensive filtering
 */
async function listAllTickets(filters = {}) {
  const {
    page = 1,
    limit = 20,
    status,
    messageType,
    priority,
    masterCategoryId,
    categoryId,
    assignedToId,
    createdById,
    currentLevel,
    search,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (messageType) where.messageType = messageType;
  if (priority) where.priority = priority;
  if (masterCategoryId) where.masterCategoryId = masterCategoryId;
  if (categoryId) where.categoryId = categoryId;
  if (filters.subCategoryId) where.subCategoryId = filters.subCategoryId;
  if (assignedToId) where.assignedToId = assignedToId;
  if (createdById) where.createdById = createdById;
  if (currentLevel) where.currentLevel = currentLevel;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  if (search) {
    where.OR = [
      { requestId: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy = { [sortBy]: sortOrder };

  const [tickets, total] = await Promise.all([
    prisma.tmsTicket.findMany({
      where,
      include: {
        masterCategory: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        createdBy: {
          select: {
            id: true,
            uid: true,
            studentLogin: {
              select: { displayName: true, registrationNo: true },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true, empId: true } },
          },
        },
        rating: { select: { rating: true } },
        _count: { select: { timeline: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.tmsTicket.count({ where }),
  ]);

  return {
    tickets,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  getOverviewStats,
  getEmployeeStats,
  getCategoryStats,
  listAllTickets,
};
