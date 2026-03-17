const prisma = require("../../../shared/config/database");
const cache = require("../../../shared/config/redis");

const userSelect = {
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

const approvalUserSelect = {
  id: true,
  uid: true,
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
    },
  },
};

const eventAdminSummarySelect = {
  id: true,
  eventId: true,
  name: true,
  eventType: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  notingId: true,
  notingEventType: true,
  venue: true,
  paymentType: true,
  participationType: true,
  registrationFee: true,
  teamRegistrationFee: true,
  bannerImageUrl: true,
  logoImageUrl: true,
  user_login: {
    select: userSelect,
  },
  note: {
    select: {
      id: true,
      notingId: true,
      status: true,
      category: true,
      subcategory: true,
      currentFlowIndex: true,
      reportingChainHistory: true,
      currentHolder: {
        select: approvalUserSelect,
      },
      attachments: {
        select: {
          id: true,
          fileName: true,
          filePath: true,
          fileDescription: true,
        },
        take: 5,
      },
      history: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          action: true,
          remarks: true,
          createdAt: true,
          performedBy: {
            select: approvalUserSelect,
          },
          nextHolder: {
            select: approvalUserSelect,
          },
        },
      },
      _count: {
        select: {
          attachments: true,
          history: true,
        },
      },
    },
  },
  _count: {
    select: {
      EventRegistration: true,
      EventVolunteer: true,
      EventPrize: true,
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
    return null;
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

function mapApprovalUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    uid: user.uid,
    displayName: getDisplayName(user),
  };
}

function getLifecycleStage(event) {
  if (!event) return "unknown";
  if (event.status === "cancelled") return "cancelled";

  const now = new Date();
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return event.status;
  }
  if (end < now) return "completed";
  if (start > now) return "upcoming";
  return "ongoing";
}

function mapApprovalStage(item) {
  return {
    id: item.id,
    action: item.action,
    remarks: item.remarks || null,
    createdAt: item.createdAt,
    performedBy: mapApprovalUser(item.performedBy),
    nextHolder: mapApprovalUser(item.nextHolder),
  };
}

function mapEventSummary(event, confirmedRegistrationCount = 0) {
  return {
    id: event.id,
    eventId: event.eventId,
    name: event.name,
    eventType: event.eventType,
    status: event.status,
    lifecycleStage: getLifecycleStage(event),
    startDate: event.startDate,
    endDate: event.endDate,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    publishedAt: event.publishedAt,
    venue: event.venue,
    paymentType: event.paymentType,
    participationType: event.participationType,
    registrationFee: event.registrationFee,
    teamRegistrationFee: event.teamRegistrationFee,
    bannerImageUrl: event.bannerImageUrl,
    logoImageUrl: event.logoImageUrl,
    notingId: event.notingId,
    notingEventType: event.notingEventType || null,
    participantCount: event._count?.EventRegistration || 0,
    confirmedParticipantCount: confirmedRegistrationCount,
    volunteerCount: event._count?.EventVolunteer || 0,
    prizeCount: event._count?.EventPrize || 0,
    createdBy: mapUser(event.user_login),
    approval: event.note
      ? {
          noteId: event.note.id,
          notingId: event.note.notingId,
          status: event.note.status,
          category: event.note.category,
          subcategory: event.note.subcategory,
          currentFlowIndex: event.note.currentFlowIndex ?? null,
          currentLocation: mapApprovalUser(event.note.currentHolder),
          attachmentCount: event.note._count?.attachments || 0,
          historyCount: event.note._count?.history || 0,
          attachments: (event.note.attachments || []).map((attachment) => ({
            id: attachment.id,
            fileName: attachment.fileName,
            filePath: attachment.filePath,
            fileDescription: attachment.fileDescription || null,
          })),
          reportingChainHistory: Array.isArray(event.note.reportingChainHistory)
            ? event.note.reportingChainHistory
            : [],
          recentStages: (event.note.history || []).map(mapApprovalStage),
        }
      : null,
  };
}

async function getConfirmedRegistrationMap(eventIds) {
  if (!eventIds?.length) return new Map();

  const rows = await prisma.$queryRaw`
    SELECT "eventId", COUNT(*)::int AS cnt
    FROM "EventRegistration"
    WHERE "eventId" = ANY(${eventIds}::text[])
      AND status = 'confirmed'
    GROUP BY "eventId"
  `;

  return new Map(rows.map((row) => [row.eventId, Number(row.cnt) || 0]));
}

function buildEventWhere(filters = {}) {
  const { search, status, createdById, startDate, endDate, approvalStatus } = filters;
  const and = [];
  const dateWhere = buildInclusiveDateWhere(startDate, endDate, "createdAt");

  if (dateWhere) and.push(dateWhere);
  if (status) and.push({ status });
  if (createdById) and.push({ createdById });
  if (approvalStatus) {
    and.push({
      note: {
        is: {
          status: approvalStatus,
        },
      },
    });
  }
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { eventId: { contains: search, mode: "insensitive" } },
        {
          note: {
            is: {
              notingId: { contains: search, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { AND: and };
}

function aggregateTimeline(items, field = "createdAt") {
  const grouped = new Map();

  for (const item of items) {
    const value = item?.[field];
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    const day = date.toISOString().slice(0, 10);
    grouped.set(day, (grouped.get(day) || 0) + 1);
  }

  return Array.from(grouped.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, count]) => ({ date, count }));
}

async function getOverviewStats(filters = {}) {
  const { startDate, endDate } = filters;
  const cacheKey = `event:analytics:overview:${startDate || "all"}:${endDate || "all"}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const where = buildEventWhere({ startDate, endDate });

  const [
    totalEvents,
    statusRows,
    typeRows,
    timelineRows,
    phaseRows,
    creatorRows,
    totalParticipants,
    confirmedParticipants,
    eventsWithAttachments,
    totalAttachments,
    eventsFromNoting,
    approvalRows,
    recentEvents,
    approvalQueue,
  ] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
    }),
    prisma.event.groupBy({
      by: ["eventType"],
      where,
      _count: { id: true },
    }),
    prisma.event.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.event.findMany({
      where,
      select: { status: true, startDate: true, endDate: true },
    }),
    prisma.event.groupBy({
      by: ["createdById"],
      where,
      _count: { id: true },
    }),
    prisma.eventRegistration.count({
      where: {
        Event: { is: where },
      },
    }),
    prisma.eventRegistration.count({
      where: {
        status: "confirmed",
        Event: { is: where },
      },
    }),
    prisma.event.count({
      where: {
        ...where,
        note: {
          is: {
            attachments: { some: {} },
          },
        },
      },
    }),
    prisma.noteAttachment.count({
      where: {
        note: {
          Event: { some: where },
        },
      },
    }),
    prisma.event.count({
      where: {
        ...where,
        notingId: { not: null },
      },
    }),
    prisma.event.findMany({
      where,
      select: {
        note: { select: { status: true } },
      },
    }),
    prisma.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: eventAdminSummarySelect,
    }),
    prisma.event.findMany({
      where: {
        ...where,
        note: {
          is: {
            status: { in: ["draft", "pending", "rejected"] },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: eventAdminSummarySelect,
    }),
  ]);

  const allEventIds = [
    ...new Set([...recentEvents, ...approvalQueue].map((event) => event.id)),
  ];
  const confirmedMap = await getConfirmedRegistrationMap(allEventIds);

  const byStatus = statusRows.reduce((acc, row) => {
    acc[row.status] = row._count.id;
    return acc;
  }, {});

  const byType = typeRows
    .map((row) => ({
      key: row.eventType,
      label: row.eventType.replace(/_/g, " "),
      count: row._count.id,
    }))
    .sort((left, right) => right.count - left.count);

  const lifecycle = phaseRows.reduce(
    (acc, row) => {
      if (row.status === "draft") {
        acc.draft += 1;
        return acc;
      }
      const stage = getLifecycleStage(row);
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    },
    { upcoming: 0, ongoing: 0, completed: 0, cancelled: 0, draft: 0 },
  );

  const approvalStatus = approvalRows.reduce(
    (acc, row) => {
      const key = row.note?.status || "no_noting";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { approved: 0, pending: 0, draft: 0, rejected: 0, no_noting: 0 },
  );

  const result = {
    totalEvents,
    creatorCount: creatorRows.length,
    totalParticipants,
    confirmedParticipants,
    totalAttachments,
    eventsWithAttachments,
    eventsFromNoting,
    directEvents: totalEvents - eventsFromNoting,
    pendingApprovalCount:
      (approvalStatus.pending || 0) +
      (approvalStatus.draft || 0) +
      (approvalStatus.rejected || 0),
    byStatus,
    byLifecycle: lifecycle,
    byApprovalStatus: approvalStatus,
    byType,
    createdTimeline: aggregateTimeline(timelineRows),
    recentEvents: recentEvents.map((event) =>
      mapEventSummary(event, confirmedMap.get(event.id) || 0),
    ),
    approvalQueue: approvalQueue.map((event) =>
      mapEventSummary(event, confirmedMap.get(event.id) || 0),
    ),
  };

  await cache.set(cacheKey, result, 120);
  return result;
}

async function getUserStats(filters = {}) {
  const { startDate, endDate } = filters;
  const cacheKey = `event:analytics:users:${startDate || "all"}:${endDate || "all"}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const where = buildEventWhere({ startDate, endDate });
  const events = await prisma.event.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      eventId: true,
      name: true,
      status: true,
      eventType: true,
      createdAt: true,
      createdById: true,
      note: {
        select: {
          status: true,
          _count: {
            select: {
              attachments: true,
              history: true,
            },
          },
        },
      },
      _count: {
        select: {
          EventRegistration: true,
        },
      },
    },
  });

  const userIds = [...new Set(events.map((event) => event.createdById).filter(Boolean))];
  const users = userIds.length
    ? await prisma.userLogin.findMany({
        where: { id: { in: userIds } },
        select: userSelect,
      })
    : [];

  const userMap = new Map(users.map((user) => [user.id, user]));
  const grouped = new Map();

  for (const event of events) {
    const existing =
      grouped.get(event.createdById) ||
      {
        user: mapUser(userMap.get(event.createdById)),
        totalEvents: 0,
        totalParticipants: 0,
        totalAttachments: 0,
        totalApprovalActions: 0,
        pendingApprovalCount: 0,
        byStatus: {},
        byType: {},
        recentEvents: [],
        lastCreatedAt: null,
      };

    existing.totalEvents += 1;
    existing.totalParticipants += event._count?.EventRegistration || 0;
    existing.totalAttachments += event.note?._count?.attachments || 0;
    existing.totalApprovalActions += event.note?._count?.history || 0;
    if (event.note?.status && event.note.status !== "approved") {
      existing.pendingApprovalCount += 1;
    }
    existing.byStatus[event.status] = (existing.byStatus[event.status] || 0) + 1;
    existing.byType[event.eventType] = (existing.byType[event.eventType] || 0) + 1;
    existing.recentEvents.push({
      id: event.id,
      eventId: event.eventId,
      name: event.name,
      status: event.status,
      eventType: event.eventType,
      createdAt: event.createdAt,
      approvalStatus: event.note?.status || null,
    });
    if (!existing.lastCreatedAt || new Date(event.createdAt) > new Date(existing.lastCreatedAt)) {
      existing.lastCreatedAt = event.createdAt;
    }

    grouped.set(event.createdById, existing);
  }

  const creators = Array.from(grouped.values())
    .map((item) => ({
      ...item,
      recentEvents: item.recentEvents.slice(0, 3),
    }))
    .sort((left, right) => right.totalEvents - left.totalEvents);

  const result = {
    totalCreators: creators.length,
    creators,
  };

  await cache.set(cacheKey, result, 120);
  return result;
}

async function listAdminEvents(filters = {}) {
  const {
    page = 1,
    limit = 20,
    search,
    status,
    createdById,
    startDate,
    endDate,
    approvalStatus,
  } = filters;

  const where = buildEventWhere({
    search,
    status,
    createdById,
    startDate,
    endDate,
    approvalStatus,
  });

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: eventAdminSummarySelect,
    }),
    prisma.event.count({ where }),
  ]);

  const confirmedMap = await getConfirmedRegistrationMap(events.map((event) => event.id));

  return {
    events: events.map((event) =>
      mapEventSummary(event, confirmedMap.get(event.id) || 0),
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getActivityStats(filters = {}) {
  const { startDate, endDate, page = 1, limit = 20 } = filters;
  const where = {};
  const dateWhere = buildInclusiveDateWhere(startDate, endDate, "createdAt");
  if (dateWhere) Object.assign(where, dateWhere);
  where.note = {
    is: {
      Event: {
        some: {},
      },
    },
  };

  const [rows, total] = await Promise.all([
    prisma.noteHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        remarks: true,
        createdAt: true,
        performedBy: {
          select: approvalUserSelect,
        },
        nextHolder: {
          select: approvalUserSelect,
        },
        note: {
          select: {
            id: true,
            notingId: true,
            status: true,
            currentHolder: {
              select: approvalUserSelect,
            },
            Event: {
              take: 3,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                eventId: true,
                name: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
    prisma.noteHistory.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      remarks: row.remarks || null,
      createdAt: row.createdAt,
      performedBy: mapApprovalUser(row.performedBy),
      nextHolder: mapApprovalUser(row.nextHolder),
      note: row.note
        ? {
            id: row.note.id,
            notingId: row.note.notingId,
            status: row.note.status,
            currentLocation: mapApprovalUser(row.note.currentHolder),
          }
        : null,
      relatedEvents: (row.note?.Event || []).map((event) => ({
        id: event.id,
        eventId: event.eventId,
        name: event.name,
        status: event.status,
        createdAt: event.createdAt,
      })),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function invalidateEventAnalyticsCaches() {
  await Promise.all([
    cache.delPattern("event:analytics:overview:*"),
    cache.delPattern("event:analytics:users:*"),
  ]);
}

module.exports = {
  getOverviewStats,
  getUserStats,
  listAdminEvents,
  getActivityStats,
  invalidateEventAnalyticsCaches,
};
