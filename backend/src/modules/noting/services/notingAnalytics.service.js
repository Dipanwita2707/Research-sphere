const prisma = require("../../../shared/config/database");
const cache = require("../../../shared/config/redis");
const { CATEGORIES } = require("../config/noting.config");

const userAnalyticsSelect = {
  id: true,
  uid: true,
  role: true,
  employeeDetails: {
    select: {
      displayName: true,
      firstName: true,
      lastName: true,
      empId: true,
      primaryDepartment: { select: { departmentName: true } },
      primarySchool: { select: { facultyName: true } },
    },
  },
  studentLogin: {
    select: {
      displayName: true,
      studentId: true,
      program: {
        select: {
          department: {
            select: {
              departmentName: true,
              faculty: { select: { facultyName: true } },
            },
          },
        },
      },
    },
  },
};

const noteSummarySelect = {
  id: true,
  notingId: true,
  category: true,
  subcategory: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  approvalPeriod: true,
  amountRequired: true,
  amount: true,
  eventName: true,
  notingEventType: true,
  clubName: true,
  createdBy: { select: userAnalyticsSelect },
  currentHolder: {
    select: {
      id: true,
      uid: true,
      employeeDetails: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  _count: {
    select: {
      attachments: true,
      history: true,
    },
  },
};

function buildInclusiveDateWhere(startDate, endDate, field = "createdAt") {
  const range = {};
  if (startDate) {
    range.gte = new Date(startDate);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }

  if (Object.keys(range).length === 0) {
    return {};
  }

  return { [field]: range };
}

function getDisplayName(user) {
  if (!user) return null;

  return (
    user.employeeDetails?.displayName ||
    [user.employeeDetails?.firstName, user.employeeDetails?.lastName]
      .filter(Boolean)
      .join(" ") ||
    user.studentLogin?.displayName ||
    user.uid ||
    null
  );
}

function mapUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    uid: user.uid,
    role: user.role,
    displayName: getDisplayName(user),
    employeeIdOrStudentId:
      user.employeeDetails?.empId || user.studentLogin?.studentId || null,
    department:
      user.employeeDetails?.primaryDepartment?.departmentName ||
      user.studentLogin?.program?.department?.departmentName ||
      null,
    school:
      user.employeeDetails?.primarySchool?.facultyName ||
      user.studentLogin?.program?.department?.faculty?.facultyName ||
      null,
  };
}

function mapHolder(user) {
  if (!user) return null;

  return {
    id: user.id,
    uid: user.uid,
    displayName:
      user.employeeDetails?.displayName ||
      [user.employeeDetails?.firstName, user.employeeDetails?.lastName]
        .filter(Boolean)
        .join(" ") ||
      user.uid,
  };
}

function getCategoryLabel(category) {
  return CATEGORIES[category]?.label || category;
}

function getSubcategoryLabel(category, subcategory) {
  return (
    CATEGORIES[category]?.subcategories?.[subcategory]?.label || subcategory
  );
}

function mapNoteSummary(note) {
  return {
    id: note.id,
    notingId: note.notingId,
    category: note.category,
    categoryLabel: getCategoryLabel(note.category),
    subcategory: note.subcategory,
    subcategoryLabel: getSubcategoryLabel(note.category, note.subcategory),
    status: note.status,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    attachmentCount: note._count?.attachments || 0,
    historyCount: note._count?.history || 0,
    createdBy: mapUser(note.createdBy),
    currentHolder: mapHolder(note.currentHolder),
    metadata: {
      approvalPeriod: note.approvalPeriod,
      amountRequired: note.amountRequired,
      amount: note.amount != null ? Number(note.amount) : null,
      eventName: note.eventName || null,
      notingEventType: note.notingEventType || null,
      clubName: note.clubName || null,
    },
  };
}

async function getOverviewStats(filters = {}) {
  const { startDate, endDate } = filters;
  const cacheKey = `noting:analytics:overview:${startDate || "all"}:${endDate || "all"}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const noteWhere = buildInclusiveDateWhere(startDate, endDate);

  const [
    totalNotings,
    byStatusRows,
    byCategoryRows,
    bySubcategoryRows,
    notesWithFiles,
    totalAttachments,
    createdTimelineRows,
    recentNotes,
    moderationQueue,
  ] = await Promise.all([
    prisma.note.count({ where: noteWhere }),
    prisma.note.groupBy({
      by: ["status"],
      where: noteWhere,
      _count: { id: true },
    }),
    prisma.note.groupBy({
      by: ["category"],
      where: noteWhere,
      _count: { id: true },
    }),
    prisma.note.groupBy({
      by: ["category", "subcategory"],
      where: noteWhere,
      _count: { id: true },
    }),
    prisma.note.count({
      where: {
        ...noteWhere,
        attachments: { some: {} },
      },
    }),
    prisma.noteAttachment.count(
      Object.keys(noteWhere).length > 0
        ? {
            where: {
              note: {
                is: noteWhere,
              },
            },
          }
        : {},
    ),
    prisma.note.findMany({
      where: noteWhere,
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.note.findMany({
      where: noteWhere,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: noteSummarySelect,
    }),
    prisma.note.findMany({
      where: {
        ...noteWhere,
        status: { in: ["pending", "rejected", "reverted"] },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
      select: noteSummarySelect,
    }),
  ]);

  const byStatus = byStatusRows.reduce(
    (acc, row) => ({ ...acc, [row.status]: row._count.id }),
    {},
  );

  const byCategory = byCategoryRows
    .map((row) => ({
      key: row.category,
      label: getCategoryLabel(row.category),
      count: row._count.id,
    }))
    .sort((a, b) => b.count - a.count);

  const bySubcategory = bySubcategoryRows
    .map((row) => ({
      key: row.subcategory,
      category: row.category,
      categoryLabel: getCategoryLabel(row.category),
      label: getSubcategoryLabel(row.category, row.subcategory),
      count: row._count.id,
    }))
    .sort((a, b) => b.count - a.count);

  const timelineMap = createdTimelineRows.reduce((acc, row) => {
    const day = row.createdAt.toISOString().slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const createdTimeline = Object.entries(timelineMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);

  const result = {
    summary: {
      totalNotings,
      notesWithFiles,
      totalAttachments,
      pendingReview: byStatus.pending || 0,
      approved: byStatus.approved || 0,
      rejected: byStatus.rejected || 0,
      reverted: byStatus.reverted || 0,
      draft: byStatus.draft || 0,
    },
    byStatus,
    byCategory,
    bySubcategory,
    createdTimeline,
    recentNotes: recentNotes.map(mapNoteSummary),
    moderationQueue: moderationQueue.map(mapNoteSummary),
  };

  await cache.set(cacheKey, result, 60);
  return result;
}

async function getUserStats(filters = {}) {
  const { startDate, endDate } = filters;
  const cacheKey = `noting:analytics:users:${startDate || "all"}:${endDate || "all"}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const noteWhere = buildInclusiveDateWhere(startDate, endDate);

  const creatorRows = await prisma.note.groupBy({
    by: ["createdById"],
    where: noteWhere,
    _count: { id: true },
    _max: { createdAt: true },
    orderBy: {
      _count: { createdById: "desc" },
    },
  });

  const creatorIds = creatorRows.map((row) => row.createdById);

  const [statusRows, withFilesRows, users] = await Promise.all([
    creatorIds.length
      ? prisma.note.groupBy({
          by: ["createdById", "status"],
          where: noteWhere,
          _count: { id: true },
        })
      : [],
    creatorIds.length
      ? prisma.note.groupBy({
          by: ["createdById"],
          where: {
            ...noteWhere,
            attachments: { some: {} },
          },
          _count: { id: true },
        })
      : [],
    creatorIds.length
      ? prisma.userLogin.findMany({
          where: { id: { in: creatorIds } },
          select: userAnalyticsSelect,
        })
      : [],
  ]);

  const statusMap = new Map();
  statusRows.forEach((row) => {
    const current = statusMap.get(row.createdById) || {};
    current[row.status] = row._count.id;
    statusMap.set(row.createdById, current);
  });

  const filesMap = new Map(
    withFilesRows.map((row) => [row.createdById, row._count.id]),
  );
  const userMap = new Map(users.map((user) => [user.id, user]));

  const totalNotings = creatorRows.reduce((sum, row) => sum + row._count.id, 0);
  const mostRecentCreatedAt = creatorRows.reduce((latest, row) => {
    if (!row._max.createdAt) return latest;
    if (!latest) return row._max.createdAt;
    return row._max.createdAt > latest ? row._max.createdAt : latest;
  }, null);
  const creators = creatorRows.map((row) => ({
    user: mapUser(userMap.get(row.createdById)) || {
      id: row.createdById,
      uid: null,
      role: null,
      displayName: "Unknown user",
      employeeIdOrStudentId: null,
      department: null,
      school: null,
    },
    totalNotings: row._count.id,
    notesWithFiles: filesMap.get(row.createdById) || 0,
    latestCreatedAt: row._max.createdAt || null,
    byStatus: statusMap.get(row.createdById) || {},
  }));

  const result = {
    summary: {
      totalCreators: creators.length,
      totalNotings,
      averageNotesPerCreator:
        creators.length > 0
          ? Math.round((totalNotings / creators.length) * 10) / 10
          : 0,
      mostRecentCreatedAt,
    },
    creators,
  };

  await cache.set(cacheKey, result, 60);
  return result;
}

async function getActivityStats(filters = {}) {
  const { startDate, endDate, page = 1, limit = 20 } = filters;
  const cacheKey = `noting:analytics:activity:${startDate || "all"}:${endDate || "all"}:${page}:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const historyWhere = buildInclusiveDateWhere(startDate, endDate);
  const skip = (page - 1) * limit;

  const [totalActivities, byActionRows, items] = await Promise.all([
    prisma.noteHistory.count({ where: historyWhere }),
    prisma.noteHistory.groupBy({
      by: ["action"],
      where: historyWhere,
      _count: { id: true },
    }),
    prisma.noteHistory.findMany({
      where: historyWhere,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        action: true,
        remarks: true,
        createdAt: true,
        note: {
          select: {
            id: true,
            notingId: true,
            status: true,
            category: true,
            subcategory: true,
            createdAt: true,
            createdBy: { select: userAnalyticsSelect },
          },
        },
        performedBy: { select: userAnalyticsSelect },
        nextHolder: {
          select: {
            id: true,
            uid: true,
            employeeDetails: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const result = {
    summary: {
      totalActivities,
      byAction: byActionRows.reduce(
        (acc, row) => ({ ...acc, [row.action]: row._count.id }),
        {},
      ),
    },
    items: items.map((item) => ({
      id: item.id,
      action: item.action,
      remarks: item.remarks,
      createdAt: item.createdAt,
      note: {
        id: item.note.id,
        notingId: item.note.notingId,
        status: item.note.status,
        category: item.note.category,
        categoryLabel: getCategoryLabel(item.note.category),
        subcategory: item.note.subcategory,
        subcategoryLabel: getSubcategoryLabel(
          item.note.category,
          item.note.subcategory,
        ),
        createdAt: item.note.createdAt,
        createdBy: mapUser(item.note.createdBy),
      },
      performedBy: mapUser(item.performedBy),
      nextHolder: mapHolder(item.nextHolder),
    })),
    pagination: {
      page,
      limit,
      total: totalActivities,
      totalPages: Math.ceil(totalActivities / limit) || 1,
    },
  };

  await cache.set(cacheKey, result, 60);
  return result;
}

module.exports = {
  getOverviewStats,
  getUserStats,
  getActivityStats,
};
