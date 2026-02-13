/**
 * Event Management Service
 * 
 * This service handles all business logic related to events, registrations, and volunteers
 */

const prisma = require('../../../shared/config/database');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const { ERRORS, EVENT_STATUS, REGISTRATION_STATUS, PAYMENT_STATUS } = require('../constants/event.constants');
const {
  generateEventId,
  generateRegistrationId,
  getEventById,
  canRegisterForEvent,
  isEventVolunteer,
  validateQRCodeAndGetRegistration,
} = require('../utils/eventHelpers');
const { generateQRCode } = require('../utils/qrCodeGenerator');
const crypto = require('crypto');

/**
 * Create event from approved noting
 * This is called automatically when a noting is approved
 */
const createEventFromNoting = async (noteId, userId) => {
  // Get the noting with event details
  const noting = await prisma.note.findUnique({
    where: { id: noteId },
    include: {
      createdBy: true,
    },
  });
  
  if (!noting) {
    throw new NotFoundError('Noting not found');
  }
  
  // Verify noting is approved
  if (noting.status !== 'approved') {
    throw new ValidationError(ERRORS.NOTING_NOT_APPROVED);
  }
  
  // Check if event already exists for this noting (using noting's ID, not notingId string)
  const existingEvent = await prisma.event.findUnique({
    where: { notingId: noting.id }, // noting.id is the UUID
  });
  
  if (existingEvent) {
    throw new ValidationError(ERRORS.NOTING_ALREADY_HAS_EVENT);
  }
  
  // Validate event fields
  if (!noting.eventName || !noting.eventType || !noting.eventStartDate || !noting.eventEndDate || !noting.eventPaymentType) {
    throw new ValidationError('Noting must have all required event fields (name, type, dates, payment type)');
  }
  
  // Validate dates
  if (noting.eventEndDate < noting.eventStartDate) {
    throw new ValidationError(ERRORS.INVALID_EVENT_DATES);
  }
  
  // Generate event ID
  const eventId = await generateEventId(prisma);
  
  // Create event in DRAFT status (creator needs to add details and publish)
  const event = await prisma.event.create({
    data: {
      id: eventId, // Use generated eventId as primary key
      eventId,
      notingId: noting.id, // UUID reference to Note.id
      name: noting.eventName,
      eventType: noting.eventType,
      startDate: noting.eventStartDate,
      endDate: noting.eventEndDate,
      paymentType: noting.eventPaymentType,
      description: noting.description,
      status: 'draft', // Creator will add more details and then publish
      createdById: noting.createdById, // Event creator is the noting creator
      updatedAt: new Date(),
    },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
      note: true,
    },
  });
  
  return event;
};

/**
 * Get event by ID with full details
 */
const getEventDetails = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId, {
    EventRegistration: {
      select: {
        id: true,
        registrationId: true,
        status: true,
        hasEntered: true,
        userId: true,
      },
    },
    EventVolunteer: {
      include: {
        user_login: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    },
    EventCustomField: {
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        fieldName: true,
        fieldLabel: true,
        fieldType: true,
        isRequired: true,
        placeholder: true,
        helpText: true,
        options: true,
        sortOrder: true,
      },
    },
    EventPrize: {
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { position: 'asc' }],
      select: {
        id: true,
        position: true,
        rank: true,
        title: true,
        description: true,
        prizeType: true,
        prizeAmount: true,
        additionalPerks: true,
        sortOrder: true,
      },
    },
  });
  
  // Get current registrations count (only confirmed/completed registrations)
  const currentRegistrations = await prisma.eventRegistration.count({
    where: {
      eventId: event.id,
      status: 'confirmed',
    },
  });
  
  // Check if the current user has registered for this event
  const userRegistration = await prisma.eventRegistration.findFirst({
    where: {
      eventId: event.id,
      userId: userId,
    },
    select: {
      id: true,
      registrationId: true,
      qrCode: true,
      status: true,
      hasEntered: true,
      registeredAt: true,
    },
  });
  
  // Add current registrations count
  event.currentRegistrations = currentRegistrations;
  
  // Add user registration to event object
  event.userRegistration = userRegistration;
  
  return event;
};

/**
 * Update event details (only non-locked fields)
 */
const updateEvent = async (eventId, userId, updateData) => {
  const event = await getEventById(prisma, eventId);
  
  // Verify user is the event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can update the event');
  }
  
  // Locked fields cannot be updated (they come from the noting)
  const lockedFields = ['name', 'eventType', 'startDate', 'endDate', 'paymentType', 'isPaid', 'notingId'];
  lockedFields.forEach(field => {
    if (updateData.hasOwnProperty(field)) {
      delete updateData[field];
    }
  });
  
  // Validate registration dates if provided
  if (updateData.registrationStartDate || updateData.registrationEndDate) {
    const startDate = updateData.registrationStartDate ? new Date(updateData.registrationStartDate) : event.registrationStartDate;
    const endDate = updateData.registrationEndDate ? new Date(updateData.registrationEndDate) : event.registrationEndDate;
    
    if (startDate && endDate && endDate < startDate) {
      throw new ValidationError('Registration end date must be after start date');
    }
    
    // Ensure registration dates are before event start (registration opens before the event)
    if (startDate && startDate > event.startDate) {
      throw new ValidationError('Registration start date must be before the event starts');
    }
    if (endDate && endDate > event.startDate) {
      throw new ValidationError('Registration end date must be before the event starts');
    }
  }
  
  // Convert date strings to proper ISO DateTime for Prisma
  if (updateData.registrationStartDate) {
    updateData.registrationStartDate = new Date(updateData.registrationStartDate);
  }
  if (updateData.registrationEndDate) {
    updateData.registrationEndDate = new Date(updateData.registrationEndDate);
  }

  // Update event
  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
      note: true,
    },
  });
  
  return updatedEvent;
};

/**
 * Publish event (make it available for registration)
 */
const publishEvent = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId);
  
  // Verify user is the event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can publish the event');
  }
  
  // Allow publishing/republishing for draft and already published events
  // (published events can be republished after editing)
  if (event.status !== EVENT_STATUS.DRAFT && event.status !== EVENT_STATUS.PUBLISHED) {
    throw new ValidationError('Only draft or published events can be (re)published');
  }
  
  // Validate event has all required details
  if (!event.venue) {
    throw new ValidationError('Event must have a venue before publishing');
  }
  
  if (!event.registrationStartDate || !event.registrationEndDate) {
    throw new ValidationError('Event must have registration dates before publishing');
  }
  
  // Update event status and published timestamp
  const updateData = {
    status: EVENT_STATUS.PUBLISHED,
  };
  
  // Only set publishedAt on first publish (not on republish)
  if (event.status !== EVENT_STATUS.PUBLISHED) {
    updateData.publishedAt = new Date();
  }
  
  // Update event
  const publishedEvent = await prisma.event.update({
    where: { id: eventId },
    data: updateData,
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
      note: true,
    },
  });
  
  return publishedEvent;
};

/**
 * List events with filters and pagination
 */
const listEvents = async (filters, pagination, userId) => {
  const { page = 1, limit = 20 } = pagination;
  const { status, eventType, search, myEvents } = filters;
  
  const where = {};
  
  // Draft events are only visible to their creator
  // Published/Ongoing/Completed events are visible to everyone
  if (myEvents) {
    // When filtering by myEvents, show all events (including drafts) created by the user
    where.createdById = userId;
    if (status) {
      where.status = status;
    }
  } else {
    // For general listing, only show published/ongoing/completed events
    // OR draft events if the user is the creator
    where.OR = [
      {
        status: {
          in: ['published', 'ongoing', 'completed'],
        },
      },
      {
        AND: [
          { status: 'draft' },
          { createdById: userId },
        ],
      },
    ];
    
    // If status filter is provided, apply it
    if (status) {
      // If filtering for draft, only show user's own drafts
      if (status === 'draft') {
        where.AND = [
          { status: 'draft' },
          { createdById: userId },
        ];
        delete where.OR;
      } else {
        // For other statuses, show to everyone
        where.status = status;
        delete where.OR;
      }
    }
  }
  
  if (eventType) {
    where.eventType = eventType;
  }
  
  if (search) {
    where.OR = where.OR || [];
    const searchConditions = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { eventId: { contains: search, mode: 'insensitive' } },
    ];
    
    // If OR already exists (from status filtering), merge with AND
    if (where.OR.length > 0) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: searchConditions,
      });
    } else {
      where.OR = searchConditions;
    }
  }
  
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        user_login: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
        note: {
          select: {
            notingId: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);
  
  // Add currentRegistrations count to each event (only confirmed/completed registrations)
  const eventsWithCount = await Promise.all(
    events.map(async (event) => {
      const currentRegistrations = await prisma.eventRegistration.count({
        where: {
          eventId: event.id,
          status: 'confirmed',
        },
      });
      return {
        ...event,
        currentRegistrations,
      };
    })
  );
  
  return {
    events: eventsWithCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Register user for event
 */
const registerForEvent = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId);
  
  // Validate registration eligibility
  await canRegisterForEvent(prisma, event, userId);
  
  // Generate registration ID and QR code
  const registrationId = await generateRegistrationId(prisma, event.eventId);
  const qrCode = generateQRCode(event.eventId, userId);
  
  // Determine payment status
  const paymentStatus = event.isPaid ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.COMPLETED;
  const registrationStatus = event.isPaid ? REGISTRATION_STATUS.PENDING : REGISTRATION_STATUS.CONFIRMED;
  
  // Create registration
  const registration = await prisma.$transaction(async (tx) => {
    const reg = await tx.eventRegistration.create({
      data: {
        id: registrationId, // Use registrationId as primary key
        registrationId,
        eventId: event.id,
        userId,
        qrCode,
        status: registrationStatus,
        paymentStatus,
        updatedAt: new Date(),
      },
      include: {
        user_login: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                registrationNo: true,
                studentId: true,
              },
            },
          },
        },
        Event: {
          select: {
            id: true,
            eventId: true,
            name: true,
            eventType: true,
            startDate: true,
            endDate: true,
            venue: true,
          },
        },
      },
    });
    
    return reg;
  });
  
  return registration;
};

/**
 * Get user's registrations
 */
const getUserRegistrations = async (userId, filters, pagination) => {
  const { page = 1, limit = 20 } = pagination;
  const { status } = filters;
  
  const where = { userId };
  
  if (status) {
    where.status = status;
  }
  
  const [registrations, total] = await Promise.all([
    prisma.eventRegistration.findMany({
      where,
      include: {
        Event: {
          select: {
            id: true,
            eventId: true,
            name: true,
            eventType: true,
            startDate: true,
            endDate: true,
            venue: true,
            status: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.eventRegistration.count({ where }),
  ]);
  
  return {
    registrations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Assign volunteer to event
 */
const assignVolunteer = async (eventId, userId, volunteerData, assignedBy) => {
  const event = await getEventById(prisma, eventId);
  
  // Verify user is the event creator
  if (event.createdById !== assignedBy) {
    throw new ForbiddenError('Only the event creator can assign volunteers');
  }
  
  // Check if volunteer already assigned
  const existing = await prisma.eventVolunteer.findFirst({
    where: {
      eventId,
      userId,
    },
  });
  
  if (existing) {
    throw new ValidationError('User is already assigned as a volunteer for this event');
  }
  
  // Create volunteer assignment
  const volunteer = await prisma.eventVolunteer.create({
    data: {
      id: crypto.randomUUID(), // Generate UUID for primary key
      eventId,
      userId,
      role: volunteerData.role,
      canScanQr: volunteerData.canScanQr !== undefined ? volunteerData.canScanQr : true,
      assignedGate: volunteerData.assignedGate,
    },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
    },
  });
  
  return volunteer;
};

/**
 * Scan QR code for event entry/exit
 */
const scanQRCode = async (eventId, qrCode, entryType, volunteerId, scanData) => {
  // Verify volunteer authorization
  const canScan = await isEventVolunteer(prisma, eventId, volunteerId);
  if (!canScan) {
    throw new ForbiddenError(ERRORS.NOT_A_VOLUNTEER);
  }
  
  // Validate QR code and get registration
  const registration = await validateQRCodeAndGetRegistration(prisma, qrCode, eventId);
  
  // Check if already entered
  if (entryType === 'entry' && registration.hasEntered) {
    throw new ValidationError(ERRORS.ALREADY_ENTERED);
  }
  
  // Get volunteer details
  const volunteer = await prisma.eventVolunteer.findFirst({
    where: {
      eventId,
      userId: volunteerId,
    },
  });
  
  // Create entry log
  const entry = await prisma.$transaction(async (tx) => {
    const entryLog = await tx.eventEntry.create({
      data: {
        id: crypto.randomUUID(), // Generate UUID for primary key
        eventId,
        registrationId: registration.id,
        volunteerId: volunteer.id,
        entryType,
        gateLocation: scanData.gateLocation,
        remarks: scanData.remarks,
      },
      include: {
        EventRegistration: {
          include: {
            user_login: {
              select: {
                id: true,
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
                studentLogin: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    registrationNo: true,
                    studentId: true,
                  },
                },
              },
            },
          },
        },
        EventVolunteer: {
          include: {
            user_login: {
              select: {
                id: true,
                uid: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    
    // Update registration entry status
    if (entryType === 'entry') {
      await tx.eventRegistration.update({
        where: { id: registration.id },
        data: {
          hasEntered: true,
          enteredAt: new Date(),
        },
      });
    }
    
    return entryLog;
  });
  
  return entry;
};

/**
 * Get event statistics (comprehensive)
 */
const getEventStatistics = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId);
  
  // Verify user is the event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can view statistics');
  }
  
  const [
    totalRegistrations,
    confirmedRegistrations,
    pendingRegistrations,
    cancelledRegistrations,
    waitlistedRegistrations,
    attendedCount,
    volunteerCount,
    totalEntries,
    totalExits,
    revenueAgg,
    registrations,
    recentRegistrations,
  ] = await Promise.all([
    prisma.eventRegistration.count({
      where: { eventId },
    }),
    prisma.eventRegistration.count({
      where: { eventId, status: REGISTRATION_STATUS.CONFIRMED },
    }),
    prisma.eventRegistration.count({
      where: { eventId, status: REGISTRATION_STATUS.PENDING },
    }),
    prisma.eventRegistration.count({
      where: { eventId, status: REGISTRATION_STATUS.CANCELLED },
    }),
    prisma.eventRegistration.count({
      where: { eventId, status: REGISTRATION_STATUS.WAITLISTED },
    }),
    prisma.eventRegistration.count({
      where: { eventId, hasEntered: true },
    }),
    prisma.eventVolunteer.count({
      where: { eventId },
    }),
    prisma.eventEntry.count({
      where: { eventId, entryType: 'entry' },
    }),
    prisma.eventEntry.count({
      where: { eventId, entryType: 'exit' },
    }),
    prisma.eventRegistration.aggregate({
      where: { eventId, paymentStatus: PAYMENT_STATUS.COMPLETED },
      _sum: { amountPaid: true },
    }),
    // Get all registrations for date grouping
    prisma.eventRegistration.findMany({
      where: { eventId },
      select: { registeredAt: true },
      orderBy: { registeredAt: 'asc' },
    }),
    // Recent registrations with user info
    prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        user_login: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
      take: 50,
    }),
  ]);

  // Group registrations by date for trend chart
  const dateMap = {};
  registrations.forEach((reg) => {
    const date = new Date(reg.registeredAt).toISOString().split('T')[0];
    dateMap[date] = (dateMap[date] || 0) + 1;
  });
  const registrationsByDate = Object.entries(dateMap).map(([date, count]) => ({
    date,
    count,
  }));

  const currentlyInside = totalEntries - totalExits;
  const totalRevenue = revenueAgg._sum.amountPaid || 0;

  return {
    totalRegistrations,
    confirmedRegistrations,
    pendingRegistrations,
    cancelledRegistrations,
    waitlistedRegistrations,
    totalAttended: attendedCount,
    totalEntries,
    totalExits,
    currentlyInside: currentlyInside > 0 ? currentlyInside : 0,
    volunteerCount,
    totalRevenue,
    revenueCollected: totalRevenue,
    registrationsByDate,
    recentRegistrations: recentRegistrations.map((r) => ({
      id: r.id,
      registrationId: r.registrationId,
      status: r.status,
      paymentStatus: r.paymentStatus,
      amountPaid: r.amountPaid,
      hasEntered: r.hasEntered,
      registeredAt: r.registeredAt,
      user: r.user_login ? {
        id: r.user_login.id,
        uid: r.user_login.uid,
        email: r.user_login.email,
        name: r.user_login.employeeDetails?.displayName ||
              `${r.user_login.employeeDetails?.firstName || ''} ${r.user_login.employeeDetails?.lastName || ''}`.trim() ||
              r.user_login.uid,
      } : null,
    })),
  };
};

/**
 * Get events where the current user is assigned as a volunteer
 */
const getMyVolunteerAssignments = async (userId) => {
  const assignments = await prisma.eventVolunteer.findMany({
    where: { userId },
    include: {
      Event: {
        select: {
          id: true,
          eventId: true,
          name: true,
          eventType: true,
          description: true,
          startDate: true,
          endDate: true,
          venue: true,
          status: true,
          bannerImageUrl: true,
          maxCapacity: true,
          _count: {
            select: { EventRegistration: true },
          },
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });

  return assignments.map((a) => ({
    id: a.id,
    eventId: a.eventId,
    role: a.role,
    canScanQr: a.canScanQr,
    assignedGate: a.assignedGate,
    assignedAt: a.assignedAt,
    event: a.Event
      ? {
          id: a.Event.id,
          eventId: a.Event.eventId,
          name: a.Event.name,
          eventType: a.Event.eventType,
          description: a.Event.description,
          startDate: a.Event.startDate,
          endDate: a.Event.endDate,
          venue: a.Event.venue,
          status: a.Event.status,
          bannerImageUrl: a.Event.bannerImageUrl,
          currentRegistrations: a.Event._count?.EventRegistration || 0,
          maxCapacity: a.Event.maxCapacity,
        }
      : null,
  }));
};

/**
 * Get volunteer scan activity history for the current user
 */
const getMyVolunteerActivity = async (userId, filters = {}) => {
  const { page = 1, limit = 30, eventId, search, startDate, endDate } = filters;

  // First get volunteer IDs for this user
  const volunteerRecords = await prisma.eventVolunteer.findMany({
    where: { userId },
    select: { id: true, eventId: true },
  });

  if (volunteerRecords.length === 0) {
    return { entries: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  const volunteerIds = volunteerRecords.map((v) => v.id);
  const volunteerEventIds = volunteerRecords.map((v) => v.eventId);

  const where = {
    volunteerId: { in: volunteerIds },
  };

  if (eventId) {
    where.eventId = eventId;
  }

  if (startDate || endDate) {
    where.scannedAt = {};
    if (startDate) where.scannedAt.gte = new Date(startDate);
    if (endDate) where.scannedAt.lte = new Date(endDate);
  }

  const [entries, total] = await Promise.all([
    prisma.eventEntry.findMany({
      where,
      include: {
        EventRegistration: {
          include: {
            user_login: {
              select: {
                id: true,
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
                studentLogin: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    registrationNo: true,
                  },
                },
              },
            },
          },
        },
        Event: {
          select: {
            id: true,
            eventId: true,
            name: true,
            eventType: true,
            venue: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { scannedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.eventEntry.count({ where }),
  ]);

  // Format entries with user names
  const formattedEntries = entries.map((e) => {
    const userLogin = e.EventRegistration?.user_login;
    const empDetails = userLogin?.employeeDetails;
    const studentDetails = userLogin?.studentLogin;
    const userName =
      empDetails?.displayName ||
      `${empDetails?.firstName || ''} ${empDetails?.lastName || ''}`.trim() ||
      studentDetails?.displayName ||
      `${studentDetails?.firstName || ''} ${studentDetails?.lastName || ''}`.trim() ||
      userLogin?.uid ||
      'Unknown';

    return {
      id: e.id,
      eventId: e.eventId,
      registrationId: e.registrationId,
      entryType: e.entryType,
      scannedAt: e.scannedAt,
      gateLocation: e.gateLocation,
      remarks: e.remarks,
      event: e.Event
        ? {
            id: e.Event.id,
            eventId: e.Event.eventId,
            name: e.Event.name,
            eventType: e.Event.eventType,
            venue: e.Event.venue,
            startDate: e.Event.startDate,
            endDate: e.Event.endDate,
          }
        : null,
      participant: {
        id: userLogin?.id || null,
        uid: userLogin?.uid || null,
        email: userLogin?.email || null,
        name: userName,
        registrationNo: studentDetails?.registrationNo || null,
      },
    };
  });

  return {
    entries: formattedEntries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

module.exports = {
  createEventFromNoting,
  getEventDetails,
  updateEvent,
  publishEvent,
  listEvents,
  registerForEvent,
  getUserRegistrations,
  assignVolunteer,
  scanQRCode,
  getEventStatistics,
  getMyVolunteerAssignments,
  getMyVolunteerActivity,
};
