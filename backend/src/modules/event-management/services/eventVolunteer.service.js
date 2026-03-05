/**
 * Event Volunteer Service
 *
 * Handles volunteer assignment, QR code scanning for event entry/exit,
 * and volunteer activity tracking.
 *
 * Split from event.service.js for Single Responsibility Principle.
 */

const prisma = require("../../../shared/config/database");
const crypto = require("crypto");
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} = require("../../../shared/utils/AppError");
const { ERRORS } = require("../constants/event.constants");
const {
  getEventById,
  getEventLean,
  isEventVolunteer,
  validateQRCodeAndGetRegistration,
} = require("../utils/eventHelpers");

/**
 * Assign volunteer to event
 *
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID being assigned as volunteer
 * @param {Object} volunteerData - Volunteer role/gate assignment
 * @param {string} assignedBy - User ID of the assigner (must be event creator)
 * @returns {Object} Created volunteer record with user details
 */
const assignVolunteer = async (eventId, userId, volunteerData, assignedBy) => {
  const event = await getEventById(prisma, eventId);

  // Verify user is the event creator
  if (event.createdById !== assignedBy) {
    throw new ForbiddenError("Only the event creator can assign volunteers");
  }

  // Check if volunteer already assigned
  const existing = await prisma.eventVolunteer.findFirst({
    where: {
      eventId,
      userId,
    },
  });

  if (existing) {
    throw new ValidationError(
      "User is already assigned as a volunteer for this event",
    );
  }

  // Create volunteer assignment
  const volunteer = await prisma.eventVolunteer.create({
    data: {
      id: crypto.randomUUID(), // Generate UUID for primary key
      eventId,
      userId,
      role: volunteerData.role,
      canScanQr:
        volunteerData.canScanQr !== undefined ? volunteerData.canScanQr : true,
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
 * Remove a volunteer from an event
 *
 * @param {string} eventId - Event ID
 * @param {string} volunteerId - EventVolunteer record ID
 * @param {string} removedBy - User ID performing the removal (must be event creator/manager)
 */
const removeVolunteer = async (eventId, volunteerId, removedBy) => {
  const event = await getEventLean(prisma, eventId);
  if (!event) throw new NotFoundError('Event');

  const volunteer = await prisma.eventVolunteer.findFirst({
    where: { id: volunteerId, eventId },
  });

  if (!volunteer) {
    throw new NotFoundError('Volunteer assignment not found for this event');
  }

  // Protect auto-assigned event managers (club chairpersons) from removal
  if (volunteer.role === 'event_manager') {
    throw new ForbiddenError('Cannot remove an Event Manager (club chairperson). They are auto-assigned and cannot be deleted.');
  }

  await prisma.eventVolunteer.delete({ where: { id: volunteerId } });
};

/**
 * Update a volunteer assignment (role, gate, QR permission)
 *
 * @param {string} eventId - Event ID
 * @param {string} volunteerId - EventVolunteer record ID
 * @param {Object} updateData - Fields to update
 * @param {string} updatedBy - User ID performing the update
 * @returns {Object} Updated volunteer record
 */
const updateVolunteer = async (eventId, volunteerId, updateData, updatedBy) => {
  const event = await getEventLean(prisma, eventId);
  if (!event) throw new NotFoundError('Event');

  const volunteer = await prisma.eventVolunteer.findFirst({
    where: { id: volunteerId, eventId },
  });

  if (!volunteer) {
    throw new NotFoundError('Volunteer assignment not found for this event');
  }

  // Only allow updating safe fields
  const allowed = {};
  if (updateData.role !== undefined) allowed.role = updateData.role;
  if (updateData.canScanQr !== undefined) allowed.canScanQr = Boolean(updateData.canScanQr);
  if (updateData.assignedGate !== undefined) allowed.assignedGate = updateData.assignedGate;

  const updated = await prisma.eventVolunteer.update({
    where: { id: volunteerId },
    data: allowed,
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
          studentLogin: {
            select: { firstName: true, lastName: true, displayName: true },
          },
        },
      },
    },
  });

  return updated;
};

/**
 * Scan QR code for event entry/exit
 *
 * @param {string} eventId - Event ID
 * @param {string} qrCode - QR code string to scan
 * @param {string} entryType - 'entry' or 'exit'
 * @param {string} volunteerId - User ID of the scanning volunteer
 * @param {Object} scanData - Gate location and remarks
 * @returns {Object} Entry log with registration and volunteer details
 */
const scanQRCode = async (
  eventId,
  qrCode,
  entryType,
  volunteerId,
  scanData,
) => {
  // Verify volunteer authorization
  const canScan = await isEventVolunteer(prisma, eventId, volunteerId);
  if (!canScan) {
    throw new ForbiddenError(ERRORS.NOT_A_VOLUNTEER);
  }

  // Validate QR code and get registration
  const registration = await validateQRCodeAndGetRegistration(
    prisma,
    qrCode,
    eventId,
  );

  // Entry: block if already checked in (must checkout first)
  if (entryType === "entry" && registration.hasEntered) {
    throw new ValidationError(ERRORS.ALREADY_ENTERED);
  }
  // Exit: block if not checked in (must checkin first)
  if (entryType === "exit" && !registration.hasEntered) {
    throw new ValidationError(ERRORS.NOT_CHECKED_IN);
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
    if (entryType === "entry") {
      await tx.eventRegistration.update({
        where: { id: registration.id },
        data: {
          hasEntered: true,
          enteredAt: new Date(),
        },
      });
    } else if (entryType === "exit") {
      await tx.eventRegistration.update({
        where: { id: registration.id },
        data: {
          hasEntered: false,
        },
      });
    }

    return entryLog;
  });

  return entry;
};

/**
 * Get events where the current user is assigned as a volunteer
 *
 * @param {string} userId - User ID
 * @returns {Array} Volunteer assignments with event details
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
    orderBy: { assignedAt: "desc" },
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
 *
 * @param {string} userId - User ID
 * @param {Object} filters - Pagination and filter options
 * @returns {{ entries: Array, pagination: Object }}
 */
const getMyVolunteerActivity = async (userId, filters = {}) => {
  const { page = 1, limit = 30, eventId, search, startDate, endDate } = filters;

  // First get volunteer IDs for this user
  const volunteerRecords = await prisma.eventVolunteer.findMany({
    where: { userId },
    select: { id: true, eventId: true },
  });

  if (volunteerRecords.length === 0) {
    return {
      entries: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
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
      orderBy: { scannedAt: "desc" },
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
      `${empDetails?.firstName || ""} ${empDetails?.lastName || ""}`.trim() ||
      studentDetails?.displayName ||
      `${studentDetails?.firstName || ""} ${studentDetails?.lastName || ""}`.trim() ||
      userLogin?.uid ||
      "Unknown";

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

/**
 * Get volunteer activity for a specific volunteer (event creator view)
 *
 * @param {string} eventId - Event ID
 * @param {string} volunteerId - Volunteer record ID
 * @param {string} userId - Requesting user ID (must be event creator)
 * @param {Object} filters - Pagination and date filters
 * @returns {{ volunteer: Object, event: Object, entries: Array, pagination: Object }}
 */
const getVolunteerActivity = async (
  eventId,
  volunteerId,
  userId,
  filters = {},
) => {
  const event = await getEventLean(prisma, eventId);
  if (event.createdById !== userId) {
    throw new ForbiddenError(
      "Only the event creator can view volunteer activity",
    );
  }

  const volunteer = await prisma.eventVolunteer.findFirst({
    where: { id: volunteerId, eventId },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
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
  });

  if (!volunteer) {
    throw new NotFoundError("Volunteer not found for this event");
  }

  const { page = 1, limit = 50, startDate, endDate } = filters;
  const where = { eventId, volunteerId };

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
      },
      orderBy: { scannedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.eventEntry.count({ where }),
  ]);

  const ul = volunteer.user_login;
  const emp = ul?.employeeDetails;
  const stu = ul?.studentLogin;
  const volunteerName =
    emp?.displayName ||
    (emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : null) ||
    stu?.displayName ||
    (stu ? `${stu.firstName || ""} ${stu.lastName || ""}`.trim() : null) ||
    ul?.uid ||
    "Unknown";

  const formattedEntries = entries.map((e) => {
    const userLogin = e.EventRegistration?.user_login;
    const empDetails = userLogin?.employeeDetails;
    const studentDetails = userLogin?.studentLogin;
    const userName =
      empDetails?.displayName ||
      `${empDetails?.firstName || ""} ${empDetails?.lastName || ""}`.trim() ||
      studentDetails?.displayName ||
      `${studentDetails?.firstName || ""} ${studentDetails?.lastName || ""}`.trim() ||
      userLogin?.uid ||
      "Unknown";

    return {
      id: e.id,
      eventId: e.eventId,
      registrationId: e.registrationId,
      entryType: e.entryType,
      scannedAt: e.scannedAt,
      gateLocation: e.gateLocation,
      remarks: e.remarks,
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
    volunteer: {
      id: volunteer.id,
      role: volunteer.role,
      assignedGate: volunteer.assignedGate,
      canScanQr: volunteer.canScanQr,
      assignedAt: volunteer.assignedAt,
      user: ul
        ? { id: ul.id, uid: ul.uid, email: ul.email, name: volunteerName }
        : null,
    },
    event: {
      id: event.id,
      eventId: event.eventId,
      name: event.name,
      venue: event.venue,
      startDate: event.startDate,
      endDate: event.endDate,
    },
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
  assignVolunteer,
  removeVolunteer,
  updateVolunteer,
  scanQRCode,
  getMyVolunteerAssignments,
  getMyVolunteerActivity,
  getVolunteerActivity,
};
