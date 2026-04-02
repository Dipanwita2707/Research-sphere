/**
 * TMS Ticket Service
 * Core business logic for ticket CRUD, escalation, and resolution
 */
const prisma = require('../../../shared/config/database');
const { TICKET_STATUS, ESCALATION_LEVEL, TIMELINE_ACTION, LIMITS, ERROR_MESSAGES } = require('../constants/tms.constants');

// Prisma select fragments for consistent queries
const userBrief = {
  id: true,
  uid: true,
  role: true,
  employeeDetails: {
    select: {
      displayName: true,
      empId: true,
      designation: true,
      primaryDepartment: { select: { departmentName: true } },
      primarySchool: { select: { facultyName: true } },
    },
  },
  studentLogin: {
    select: {
      displayName: true,
      registrationNo: true,
      studentId: true,
      program: {
        select: {
          programName: true,
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

const ticketInclude = {
  masterCategory: { select: { id: true, name: true, isAcademic: true } },
  category: { select: { id: true, name: true } },
  subCategory: { select: { id: true, name: true } },
  createdBy: { select: userBrief },
  assignedTo: { select: userBrief },
  timeline: {
    select: {
      id: true,
      action: true,
      fromLevel: true,
      toLevel: true,
      remarks: true,
      isAutomatic: true,
      metadata: true,
      createdAt: true,
      performedBy: { select: userBrief },
    },
    orderBy: { createdAt: 'asc' },
  },
  rating: {
    select: { id: true, rating: true, feedback: true, createdAt: true },
  },
};

/**
 * Generate unique request ID: TMS-YYYY-XXXXX
 */
async function generateRequestId() {
  const year = new Date().getFullYear();
  const prefix = `TMS-${year}-`;

  const lastTicket = await prisma.tmsTicket.findFirst({
    where: { requestId: { startsWith: prefix } },
    orderBy: { requestId: 'desc' },
    select: { requestId: true },
  });

  let seq = 1;
  if (lastTicket) {
    const lastSeq = parseInt(lastTicket.requestId.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(5, '0')}`;
}

/**
 * Create a new ticket
 */
async function createTicket(data, userId) {
  // Verify category hierarchy exists and is active
  const subCategory = await prisma.tmsSubCategory.findUnique({
    where: { id: data.subCategoryId },
    include: {
      category: {
        include: { masterCategory: true },
      },
      employee: { select: userBrief },
    },
  });

  if (!subCategory || !subCategory.isActive) {
    throw new Error(ERROR_MESSAGES.SUB_CATEGORY_NOT_FOUND);
  }
  if (subCategory.categoryId !== data.categoryId) {
    throw new Error('Sub-category does not belong to the selected category');
  }
  if (subCategory.category.masterCategoryId !== data.masterCategoryId) {
    throw new Error('Category does not belong to the selected master category');
  }

  const requestId = await generateRequestId();
  const assignedToId = subCategory.employeeId;

  // Create ticket + initial timeline in a transaction
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.tmsTicket.create({
      data: {
        requestId,
        messageType: data.messageType,
        subject: data.subject,
        masterCategoryId: data.masterCategoryId,
        categoryId: data.categoryId,
        subCategoryId: data.subCategoryId,
        contactNumber: data.contactNumber,
        description: data.description,
        documentPath: data.documentPath || null,
        documentName: data.documentName || null,
        priority: data.priority || 'medium',
        status: TICKET_STATUS.OPEN,
        currentLevel: ESCALATION_LEVEL.SUB_CATEGORY,
        createdById: userId,
        assignedToId,
        escalationDeadline: assignedToId
          ? new Date(Date.now() + LIMITS.AUTO_ESCALATION_HOURS * 60 * 60 * 1000)
          : null,
      },
      include: ticketInclude,
    });

    // Timeline: Created
    await tx.tmsTimeline.create({
      data: {
        ticketId: created.id,
        action: TIMELINE_ACTION.CREATED,
        remarks: 'Ticket submitted by student',
        performedById: userId,
        metadata: { messageType: data.messageType },
      },
    });

    // Timeline: Assigned — performedBy should be the *assigned employee*, not the student
    if (assignedToId) {
      await tx.tmsTimeline.create({
        data: {
          ticketId: created.id,
          action: TIMELINE_ACTION.ASSIGNED,
          toLevel: ESCALATION_LEVEL.SUB_CATEGORY,
          remarks: `Assigned to dealing person (Sub-Category level)`,
          performedById: assignedToId,
          metadata: { assignedToId },
        },
      });
    }

    return created;
  });

  // Re-fetch with full includes (timeline was added after creation)
  return prisma.tmsTicket.findUnique({
    where: { id: ticket.id },
    include: ticketInclude,
  });
}

/**
 * Get ticket by ID
 */
async function getTicketById(ticketId) {
  const ticket = await prisma.tmsTicket.findUnique({
    where: { id: ticketId },
    include: ticketInclude,
  });

  if (!ticket) throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
  return ticket;
}

/**
 * List tickets for a student (their own tickets)
 */
async function listStudentTickets(userId, filters = {}) {
  const { page = 1, limit = LIMITS.DEFAULT_PAGE_SIZE, status, messageType, priority, search } = filters;
  const skip = (page - 1) * limit;

  const where = { createdById: userId };
  if (status) where.status = status;
  if (messageType) where.messageType = messageType;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { requestId: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.tmsTicket.findMany({
      where,
      include: {
        masterCategory: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        assignedTo: { select: userBrief },
        rating: { select: { rating: true } },
        _count: { select: { timeline: true } },
      },
      orderBy: { createdAt: 'desc' },
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

/**
 * List tickets assigned to an employee
 */
async function listEmployeeTickets(userId, filters = {}) {
  const { page = 1, limit = LIMITS.DEFAULT_PAGE_SIZE, status, messageType, priority, search } = filters;
  const skip = (page - 1) * limit;

  const where = { assignedToId: userId };
  if (status) where.status = status;
  if (messageType) where.messageType = messageType;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { requestId: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.tmsTicket.findMany({
      where,
      include: {
        masterCategory: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        createdBy: { select: userBrief },
        rating: { select: { rating: true } },
        _count: { select: { timeline: true } },
      },
      orderBy: { createdAt: 'desc' },
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

/**
 * Add a remark / update to a ticket
 */
async function addRemark(ticketId, userId, remarks) {
  const ticket = await prisma.tmsTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);

  await prisma.tmsTimeline.create({
    data: {
      ticketId,
      action: TIMELINE_ACTION.REMARKED,
      remarks,
      performedById: userId,
    },
  });

  // If status is open, move to in_progress
  if (ticket.status === TICKET_STATUS.OPEN) {
    await prisma.tmsTicket.update({
      where: { id: ticketId },
      data: { status: TICKET_STATUS.IN_PROGRESS },
    });

    await prisma.tmsTimeline.create({
      data: {
        ticketId,
        action: TIMELINE_ACTION.STATUS_CHANGED,
        remarks: 'Status changed to In Progress',
        performedById: userId,
        metadata: { from: TICKET_STATUS.OPEN, to: TICKET_STATUS.IN_PROGRESS },
      },
    });
  }

  return getTicketById(ticketId);
}

/**
 * Resolve a ticket
 */
async function resolveTicket(ticketId, userId, remarks) {
  const ticket = await prisma.tmsTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
  if (ticket.status === TICKET_STATUS.CLOSED) throw new Error(ERROR_MESSAGES.ALREADY_CLOSED);
  if (ticket.status === TICKET_STATUS.RESOLVED) throw new Error(ERROR_MESSAGES.ALREADY_RESOLVED);

  await prisma.$transaction(async (tx) => {
    await tx.tmsTicket.update({
      where: { id: ticketId },
      data: {
        status: TICKET_STATUS.RESOLVED,
        resolvedAt: new Date(),
        closureRemarks: remarks,
        escalationDeadline: null,
      },
    });

    await tx.tmsTimeline.create({
      data: {
        ticketId,
        action: TIMELINE_ACTION.RESOLVED,
        remarks,
        performedById: userId,
        metadata: { previousStatus: ticket.status },
      },
    });
  });

  return getTicketById(ticketId);
}

/**
 * Close a ticket (by student or admin after resolution)
 */
async function closeTicket(ticketId, userId, remarks) {
  const ticket = await prisma.tmsTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
  if (ticket.status === TICKET_STATUS.CLOSED) throw new Error(ERROR_MESSAGES.ALREADY_CLOSED);

  await prisma.$transaction(async (tx) => {
    await tx.tmsTicket.update({
      where: { id: ticketId },
      data: {
        status: TICKET_STATUS.CLOSED,
        closedAt: new Date(),
        closureRemarks: remarks || ticket.closureRemarks,
        escalationDeadline: null,
      },
    });

    await tx.tmsTimeline.create({
      data: {
        ticketId,
        action: TIMELINE_ACTION.CLOSED,
        remarks: remarks || 'Ticket closed',
        performedById: userId,
      },
    });
  });

  return getTicketById(ticketId);
}

/**
 * Rate a resolved/closed ticket
 */
async function rateTicket(ticketId, userId, rating, feedback) {
  const ticket = await prisma.tmsTicket.findUnique({
    where: { id: ticketId },
    include: { rating: true },
  });

  if (!ticket) throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
  if (ticket.createdById !== userId) throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
  if (ticket.status !== TICKET_STATUS.RESOLVED && ticket.status !== TICKET_STATUS.CLOSED) {
    throw new Error(ERROR_MESSAGES.CANNOT_RATE);
  }
  if (ticket.rating) throw new Error(ERROR_MESSAGES.ALREADY_RATED);

  await prisma.$transaction(async (tx) => {
    await tx.tmsRating.create({
      data: {
        ticketId,
        rating,
        feedback: feedback || null,
        ratedById: userId,
      },
    });

    await tx.tmsTimeline.create({
      data: {
        ticketId,
        action: TIMELINE_ACTION.RATED,
        remarks: `Rated ${rating}/5${feedback ? `: ${feedback}` : ''}`,
        performedById: userId,
        metadata: { rating, feedback },
      },
    });

    // Auto-close if resolved
    if (ticket.status === TICKET_STATUS.RESOLVED) {
      await tx.tmsTicket.update({
        where: { id: ticketId },
        data: { status: TICKET_STATUS.CLOSED, closedAt: new Date() },
      });
    }
  });

  return getTicketById(ticketId);
}

/**
 * List history of tickets an employee has acted on (resolved, closed, escalated, remarked)
 * Shows tickets where the employee performed any action — even if the ticket
 * was later reassigned to someone else after escalation.
 */
async function listEmployeeHistory(userId, filters = {}) {
  const { page = 1, limit = LIMITS.DEFAULT_PAGE_SIZE, status, messageType, priority, search, action } = filters;
  const skip = (page - 1) * limit;

  // Find ticket IDs where employee performed an action
  const timelineWhere = { performedById: userId };
  if (action) timelineWhere.action = action;

  const actedTicketIds = await prisma.tmsTimeline.findMany({
    where: timelineWhere,
    select: { ticketId: true },
    distinct: ['ticketId'],
  });

  const ticketIds = actedTicketIds.map((t) => t.ticketId);
  if (ticketIds.length === 0) {
    return { tickets: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  const where = { id: { in: ticketIds } };
  if (status) where.status = status;
  if (messageType) where.messageType = messageType;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { requestId: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.tmsTicket.findMany({
      where,
      include: {
        masterCategory: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        subCategory: { select: { id: true, name: true } },
        createdBy: { select: userBrief },
        assignedTo: { select: userBrief },
        rating: { select: { rating: true } },
        timeline: {
          where: { performedById: userId },
          select: {
            id: true,
            action: true,
            remarks: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { timeline: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.tmsTicket.count({ where }),
  ]);

  // Compute summary for each ticket: last action taken by this employee, action date
  const enriched = tickets.map((t) => {
    const myActions = t.timeline || [];
    const lastAction = myActions[0] || null;
    return {
      ...t,
      myLastAction: lastAction?.action || null,
      myLastActionAt: lastAction?.createdAt || null,
      myActionCount: myActions.length,
    };
  });

  return {
    tickets: enriched,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  generateRequestId,
  createTicket,
  getTicketById,
  listStudentTickets,
  listEmployeeTickets,
  listEmployeeHistory,
  addRemark,
  resolveTicket,
  closeTicket,
  rateTicket,
  ticketInclude,
  userBrief,
};
