const prisma = require('../../../shared/config/database');
const { SeminarHallBookingStatusEnum } = require('@prisma/client');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const { ConflictError, NotFoundError, ValidationError } = require('../../../shared/utils/AppError');
const asyncHandler = require('../../../shared/utils/asyncHandler');

const parseBoolean = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const buildRequesterProfile = (userRecord) => {
  const employeeDetails = userRecord?.employeeDetails;
  const fullName = [employeeDetails?.firstName, employeeDetails?.lastName].filter(Boolean).join(' ').trim();
  const requesterName = employeeDetails?.displayName?.trim() || fullName || userRecord?.uid?.trim() || '';
  const requesterEmail = employeeDetails?.email?.trim().toLowerCase() || userRecord?.email?.trim().toLowerCase() || '';
  const requesterPhone = employeeDetails?.phoneNumber?.trim() || userRecord?.phone?.trim() || '';
  const department = employeeDetails?.primaryDepartment?.departmentName?.trim() || '';

  return {
    requesterName,
    requesterEmail,
    requesterPhone,
    department,
  };
};

const buildRequestId = async (tx) => {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  const latestRequest = await tx.seminarHallBookingRequest.findFirst({
    where: {
      requestId: {
        startsWith: prefix,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      requestId: true,
    },
  });

  const latestSequence = latestRequest?.requestId ? Number(latestRequest.requestId.slice(prefix.length)) : 0;
  const nextSequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1;

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
};

const createBookingRequestWithRetry = async (dataFactory) => {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const requestId = await buildRequestId(tx);
        return dataFactory(tx, requestId);
      });
    } catch (error) {
      const isDuplicateRequestId = error?.code === 'P2002'
        && Array.isArray(error?.meta?.target)
        && error.meta.target.includes('request_id');

      if (!isDuplicateRequestId || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw new Error('Unable to allocate a unique request ID');
};

const bookingInclude = {
  room: {
    include: {
      block: {
        select: {
          id: true,
          name: true,
        },
      },
      floor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

exports.getRooms = asyncHandler(async (req, res) => {
  const { blockId, floorId, type, search, isActive } = req.query;

  const where = {};
  const activeFilter = parseBoolean(isActive);

  if (blockId) {
    where.blockId = blockId;
  }

  if (floorId) {
    where.floorId = floorId;
  }

  if (type) {
    where.type = type;
  }

  if (activeFilter !== undefined) {
    where.isActive = activeFilter;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { roomNumber: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { block: { name: { contains: search, mode: 'insensitive' } } },
      { floor: { name: { contains: search, mode: 'insensitive' } } },
      {
        facilities: {
          some: {
            facility: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
      },
    ];
  }

  const rooms = await prisma.seminarHallRoom.findMany({
    where,
    include: {
      block: {
        select: {
          id: true,
          name: true,
          blockNumber: true,
        },
      },
      floor: {
        select: {
          id: true,
          name: true,
          floorNumber: true,
        },
      },
      facilities: {
        select: {
          quantity: true,
          notes: true,
          facility: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: {
          facility: {
            name: 'asc',
          },
        },
      },
      _count: {
        select: {
          bookingRequests: true,
        },
      },
    },
    orderBy: [
      { block: { name: 'asc' } },
      { floor: { floorNumber: 'asc' } },
      { name: 'asc' },
    ],
  });

  return ApiResponse.success(res, rooms, 'Seminar hall rooms fetched successfully');
});

exports.getBookings = asyncHandler(async (req, res) => {
  try {
    const { status, requestKind, requesterEmail, roomId } = req.query;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

    console.log('[SEMINAR_HALL] getBookings called by user:', {
      userId: req.user?.id,
      userRole: req.user?.role,
      isAdmin,
      queryParams: { status, requestKind, requesterEmail, roomId },
    });

    // Build the where clause based on user role
    const where = {};

    // Build the base filter
    const andConditions = [];

    // Non-admin users can only see:
    // 1. Approved and completed bookings (public)
    // 2. Their own pending/rejected bookings
    if (!isAdmin) {
      andConditions.push({
        OR: [
          // Public bookings (approved/completed)
          { status: SeminarHallBookingStatusEnum.approved },
          { status: SeminarHallBookingStatusEnum.completed },
          // User's own bookings
          {
            requesterEmail: req.user?.email?.toLowerCase(),
          },
        ],
      });
    }

    // Apply optional filters (only for admins, or non-admins viewing their own bookings)
    if (typeof status === 'string' && status.trim()) {
      andConditions.push({
        status: status.trim(),
      });
    }

    if (typeof requestKind === 'string' && requestKind.trim()) {
      andConditions.push({
        requestKind: requestKind.trim(),
      });
    }

    if (typeof requesterEmail === 'string' && requesterEmail.trim()) {
      andConditions.push({
        requesterEmail: requesterEmail.trim().toLowerCase(),
      });
    }

    if (typeof roomId === 'string' && roomId.trim()) {
      andConditions.push({
        roomId: roomId.trim(),
      });
    }

    // Combine all conditions with AND
    if (andConditions.length === 0) {
      // No additional filters
    } else if (andConditions.length === 1) {
      where.AND = andConditions;
    } else {
      where.AND = andConditions;
    }

    console.log('[SEMINAR_HALL] Query filters:', { where });

    const bookings = await prisma.seminarHallBookingRequest.findMany({
      where,
      include: bookingInclude,
      orderBy: [
        { createdAt: 'desc' },
        { bookingDate: 'desc' },
      ],
    });

    console.log('[SEMINAR_HALL] Found', bookings.length, 'bookings');

    return ApiResponse.success(res, bookings, 'Seminar hall booking requests fetched successfully');
  } catch (error) {
    console.error('[SEMINAR_HALL] Error in getBookings:', error);
    // Return empty array instead of throwing error (silent fail)
    return ApiResponse.success(res, [], 'Seminar hall booking requests fetched successfully');
  }
});

exports.getAvailabilityBookings = asyncHandler(async (req, res) => {
  const { roomId, bookingDate } = req.query;

  const where = {
    OR: [
      { status: SeminarHallBookingStatusEnum.approved },
    ],
  };

  if (typeof roomId === 'string' && roomId.trim()) {
    where.roomId = roomId.trim();
  }

  if (typeof bookingDate === 'string' && bookingDate.trim()) {
    where.bookingDate = new Date(`${bookingDate.trim()}T00:00:00.000Z`);
  }

  const bookings = await prisma.seminarHallBookingRequest.findMany({
    where,
    include: bookingInclude,
    orderBy: [
      { bookingDate: 'asc' },
      { startTime: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  const terminalActionRequests = await prisma.seminarHallBookingRequest.findMany({
    where: {
      requestKind: {
        in: ['cancel_request', 'reschedule_request'],
      },
      status: {
        in: ['cancelled', 'rescheduled'],
      },
    },
    select: {
      roomId: true,
      requesterEmail: true,
      requestKind: true,
      bookingDate: true,
      startTime: true,
      endTime: true,
      originalBookingDate: true,
      originalStartTime: true,
      originalEndTime: true,
    },
  });

  const blockedSlotKeys = new Set(
    terminalActionRequests.map((request) => {
      const sourceBookingDate = request.requestKind === 'reschedule_request' && request.originalBookingDate
        ? request.originalBookingDate
        : request.bookingDate;
      const sourceStartTime = request.requestKind === 'reschedule_request' && request.originalStartTime
        ? request.originalStartTime
        : request.startTime;
      const sourceEndTime = request.requestKind === 'reschedule_request' && request.originalEndTime
        ? request.originalEndTime
        : request.endTime;

      return [
        request.roomId,
        request.requesterEmail?.trim().toLowerCase(),
        new Date(sourceBookingDate).toISOString().slice(0, 10),
        sourceStartTime,
        sourceEndTime,
      ].join('|');
    }),
  );

  const visibleBookings = bookings.filter((booking) => {
    const bookingKey = [
      booking.roomId,
      booking.requesterEmail?.trim().toLowerCase(),
      new Date(booking.bookingDate).toISOString().slice(0, 10),
      booking.startTime,
      booking.endTime,
    ].join('|');

    return !blockedSlotKeys.has(bookingKey);
  });

  return ApiResponse.success(res, visibleBookings, 'Seminar hall availability bookings fetched successfully');
});

exports.updateBookingStatus = asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

  if (!isAdmin) {
    throw new ValidationError('Only administrators can update booking status');
  }

  const bookingId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const nextStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
  const adminRemark = typeof req.body?.adminRemark === 'string' ? req.body.adminRemark.trim() : '';

  if (!bookingId) {
    throw new ValidationError('Booking id is required');
  }

  if (!['approved', 'rejected', 'cancelled', 'rescheduled'].includes(nextStatus)) {
    throw new ValidationError('Invalid booking status update');
  }

  const existingBooking = await prisma.seminarHallBookingRequest.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });

  if (!existingBooking) {
    throw new NotFoundError('Seminar hall booking request');
  }

  if (nextStatus === 'approved' || (nextStatus === 'rescheduled' && existingBooking.requestKind !== 'reschedule_request')) {
    // For reschedule requests, check against REQUESTED times, not original times
    const checkBookingDate = existingBooking.requestKind === 'reschedule_request' && existingBooking.requestedBookingDate
      ? existingBooking.requestedBookingDate
      : existingBooking.bookingDate;
    const checkStartTime = existingBooking.requestKind === 'reschedule_request' && existingBooking.requestedStartTime
      ? existingBooking.requestedStartTime
      : existingBooking.startTime;
    const checkEndTime = existingBooking.requestKind === 'reschedule_request' && existingBooking.requestedEndTime
      ? existingBooking.requestedEndTime
      : existingBooking.endTime;

    const overlappingBooking = await prisma.seminarHallBookingRequest.findFirst({
      where: {
        id: { not: existingBooking.id },
        roomId: existingBooking.roomId,
        bookingDate: checkBookingDate,
        OR: [
          { status: SeminarHallBookingStatusEnum.approved },
        ],
        AND: [
          {
            startTime: {
              lt: checkEndTime,
            },
          },
          {
            endTime: {
              gt: checkStartTime,
            },
          },
        ],
      },
      select: {
        id: true,
        requestId: true,
      },
    });

    if (overlappingBooking) {
      throw new ConflictError('Another approved booking already exists for this room and time slot');
    }
  }

  const updatedBooking = await prisma.$transaction(async (tx) => {
    const booking = await tx.seminarHallBookingRequest.update({
      where: { id: existingBooking.id },
      data: {
        status: nextStatus,
      },
      include: bookingInclude,
    });

    if (existingBooking.requestKind === 'cancel_request' && nextStatus === 'cancelled') {
      const originalBookingDateKey = new Date(existingBooking.originalBookingDate || existingBooking.bookingDate).toISOString().slice(0, 10);
      const originalStartTime = existingBooking.originalStartTime || existingBooking.startTime;
      const originalEndTime = existingBooking.originalEndTime || existingBooking.endTime;

      const originalApprovedBooking = await tx.seminarHallBookingRequest.findFirst({
        where: {
          roomId: existingBooking.roomId,
          requesterEmail: existingBooking.requesterEmail,
          requestKind: 'new_booking',
          status: SeminarHallBookingStatusEnum.approved,
          bookingDate: existingBooking.originalBookingDate || existingBooking.bookingDate,
          startTime: originalStartTime,
          endTime: originalEndTime,
        },
        select: {
          id: true,
          requestId: true,
        },
      });

      if (!originalApprovedBooking) {
        throw new ConflictError('Original approved booking not found for cancellation approval');
      }

      console.log('[SEMINAR_HALL] Cancel approval - marking original booking cancelled:', {
        cancelRequestId: existingBooking.id,
        originalBookingId: originalApprovedBooking.id,
        originalBookingDateKey,
        originalStartTime,
        originalEndTime,
      });

      await tx.seminarHallBookingRequest.update({
        where: { id: originalApprovedBooking.id },
        data: {
          status: SeminarHallBookingStatusEnum.cancelled,
        },
      });
    }

    // If this is a reschedule request being approved, deactivate the original approved booking
    if (existingBooking.requestKind === 'reschedule_request' && nextStatus === 'rescheduled' && existingBooking.requestedBookingDate) {
      console.log('[SEMINAR_HALL] Reschedule approval - deactivating original booking:', {
        rescheduleRequestId: existingBooking.id,
        roomId: existingBooking.roomId,
        requesterEmail: existingBooking.requesterEmail,
        originalDate: existingBooking.originalBookingDate || existingBooking.bookingDate,
        originalStartTime: existingBooking.originalStartTime || existingBooking.startTime,
        originalEndTime: existingBooking.originalEndTime || existingBooking.endTime,
        requestedDate: existingBooking.requestedBookingDate,
        requestedStartTime: existingBooking.requestedStartTime,
        requestedEndTime: existingBooking.requestedEndTime,
      });

      const approvedRoomBookings = await tx.seminarHallBookingRequest.findMany({
        where: {
          roomId: existingBooking.roomId,
          requesterEmail: existingBooking.requesterEmail,
          requestKind: 'new_booking',
          status: SeminarHallBookingStatusEnum.approved,
        },
        select: {
          id: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          requestId: true,
        },
      });

      const originalBookingDateKey = new Date(existingBooking.originalBookingDate || existingBooking.bookingDate).toISOString().slice(0, 10);
      const originalStartTime = existingBooking.originalStartTime || existingBooking.startTime;
      const originalEndTime = existingBooking.originalEndTime || existingBooking.endTime;

      let originalApprovedBooking = approvedRoomBookings.find((booking) => {
        const bookingDateKey = new Date(booking.bookingDate).toISOString().slice(0, 10);
        return bookingDateKey === originalBookingDateKey
          && booking.startTime === originalStartTime
          && booking.endTime === originalEndTime;
      }) || approvedRoomBookings.find((booking) => {
        const bookingDateKey = new Date(booking.bookingDate).toISOString().slice(0, 10);
        return bookingDateKey === originalBookingDateKey;
      });

      console.log('[SEMINAR_HALL] Found original approved booking:', originalApprovedBooking ? { id: originalApprovedBooking.id, requestId: originalApprovedBooking.requestId } : null);

      if (!originalApprovedBooking) {
        // Fallback: search for ANY approved booking with the same room and requester on the same date
        console.log('[SEMINAR_HALL] Original booking not found by time match, searching by date only...');
        const fallbackBooking = await tx.seminarHallBookingRequest.findFirst({
          where: {
            roomId: existingBooking.roomId,
            requesterEmail: existingBooking.requesterEmail,
            requestKind: 'new_booking',
            status: SeminarHallBookingStatusEnum.approved,
            bookingDate: existingBooking.originalBookingDate || existingBooking.bookingDate,
            id: { not: existingBooking.id },
          },
        });

        console.log('[SEMINAR_HALL] Found fallback booking:', fallbackBooking ? { id: fallbackBooking.id, startTime: fallbackBooking.startTime, endTime: fallbackBooking.endTime } : null);

        if (fallbackBooking) {
          console.log('[SEMINAR_HALL] Using fallback booking as original booking target:', fallbackBooking.id);
          originalApprovedBooking = fallbackBooking;
        }
      }

      if (!originalApprovedBooking) {
        throw new ConflictError('Original approved booking not found for reschedule approval');
      }

      const movedBookingDate = existingBooking.requestedBookingDate || existingBooking.bookingDate;
      const movedStartTime = existingBooking.requestedStartTime || existingBooking.startTime;
      const movedEndTime = existingBooking.requestedEndTime || existingBooking.endTime;

      console.log('[SEMINAR_HALL] Updating original booking to rescheduled slot:', {
        bookingId: originalApprovedBooking.id,
        movedBookingDate,
        movedStartTime,
        movedEndTime,
      });

      await tx.seminarHallBookingRequest.update({
        where: { id: originalApprovedBooking.id },
        data: {
          bookingDate: movedBookingDate,
          startTime: movedStartTime,
          endTime: movedEndTime,
          timeSlot: `${movedStartTime} - ${movedEndTime}`,
        },
      });
    }

    await tx.seminarHallBookingHistory.create({
      data: {
        bookingRequestId: booking.id,
        oldStatus: existingBooking.status,
        newStatus: booking.status,
        action: 'status_updated',
        actionDetails: adminRemark || `Booking ${booking.requestId} status updated to ${booking.status}`,
        changedBy: req.user?.id || null,
      },
    });

    return booking;
  });

  return ApiResponse.success(res, updatedBooking, 'Seminar hall booking status updated successfully');
});

exports.createBooking = asyncHandler(async (req, res) => {
  const {
    roomId,
    bookingDate,
    startTime,
    endTime,
    timeSlot,
    purpose,
    additionalRequirements,
  } = req.body;

  const normalizedPayload = {
    roomId: typeof roomId === 'string' ? roomId.trim() : '',
    bookingDate: typeof bookingDate === 'string' ? bookingDate.trim() : '',
    startTime: typeof startTime === 'string' ? startTime.trim() : '',
    endTime: typeof endTime === 'string' ? endTime.trim() : '',
    timeSlot: typeof timeSlot === 'string' ? timeSlot.trim() : '',
    purpose: typeof purpose === 'string' ? purpose.trim() : '',
    additionalRequirements: typeof additionalRequirements === 'string' ? additionalRequirements.trim() : '',
  };

  if (!normalizedPayload.roomId) {
    throw new ValidationError('Room is required');
  }

  if (!req.user?.id) {
    throw new ValidationError('Authenticated user is required to create a booking');
  }

  if (!normalizedPayload.bookingDate) {
    throw new ValidationError('Booking date is required');
  }

  if (!isValidTime(normalizedPayload.startTime) || !isValidTime(normalizedPayload.endTime)) {
    throw new ValidationError('Start time and end time must be in HH:MM format');
  }

  if (normalizedPayload.startTime >= normalizedPayload.endTime) {
    throw new ValidationError('End time must be after start time');
  }

  if (!normalizedPayload.timeSlot) {
    throw new ValidationError('Time slot is required');
  }

  if (!normalizedPayload.purpose) {
    throw new ValidationError('Purpose is required');
  }

  const parsedBookingDate = new Date(`${normalizedPayload.bookingDate}T00:00:00.000Z`);

  if (Number.isNaN(parsedBookingDate.getTime())) {
    throw new ValidationError('Booking date is invalid');
  }

  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  if (parsedBookingDate < todayStart) {
    throw new ValidationError('Booking date cannot be in the past');
  }

  const currentDateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentTimeKey = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  if (normalizedPayload.bookingDate === currentDateKey && normalizedPayload.startTime < currentTimeKey) {
    throw new ValidationError('Booking start time cannot be in the past for today');
  }

  const requesterUser = await prisma.userLogin.findUnique({
    where: {
      id: req.user.id,
    },
    select: {
      id: true,
      uid: true,
      email: true,
      phone: true,
      employeeDetails: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          phoneNumber: true,
          primaryDepartment: {
            select: {
              departmentName: true,
            },
          },
        },
      },
    },
  });

  const requesterProfile = buildRequesterProfile(requesterUser);

  if (!requesterProfile.requesterName) {
    throw new ValidationError('Requester name is missing. Please ensure your employee profile is complete.');
  }

  if (!requesterProfile.requesterEmail || !isValidEmail(requesterProfile.requesterEmail)) {
    throw new ValidationError('Requester email is missing or invalid. Please ensure your employee profile is complete.');
  }

  const room = await prisma.seminarHallRoom.findUnique({
    where: {
      id: normalizedPayload.roomId,
    },
    include: {
      block: {
        select: {
          id: true,
          name: true,
        },
      },
      floor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!room || !room.isActive) {
    throw new NotFoundError('Seminar hall room');
  }

  const overlappingBooking = await prisma.seminarHallBookingRequest.findFirst({
    where: {
      roomId: normalizedPayload.roomId,
      bookingDate: parsedBookingDate,
      OR: [
        { status: SeminarHallBookingStatusEnum.approved },
      ],
      AND: [
        {
          startTime: {
            lt: normalizedPayload.endTime,
          },
        },
        {
          endTime: {
            gt: normalizedPayload.startTime,
          },
        },
      ],
    },
    select: {
      id: true,
      requestId: true,
    },
  });

  if (overlappingBooking) {
    throw new ConflictError('This room is already requested for the selected date and time slot');
  }

  const createdBooking = await createBookingRequestWithRetry(async (tx, requestId) => {

    const booking = await tx.seminarHallBookingRequest.create({
      data: {
        requestId,
        roomId: normalizedPayload.roomId,
          requesterName: requesterProfile.requesterName,
          requesterEmail: requesterProfile.requesterEmail,
          requesterPhone: requesterProfile.requesterPhone || null,
          department: requesterProfile.department,
        bookingDate: parsedBookingDate,
        startTime: normalizedPayload.startTime,
        endTime: normalizedPayload.endTime,
        timeSlot: normalizedPayload.timeSlot,
        purpose: normalizedPayload.purpose,
        additionalRequirements: normalizedPayload.additionalRequirements || null,
      },
      include: bookingInclude,
    });

    await tx.seminarHallBookingHistory.create({
      data: {
        bookingRequestId: booking.id,
        newStatus: booking.status,
        action: 'created',
        actionDetails: `Booking request ${booking.requestId} created for ${booking.timeSlot}`,
        changedBy: req.user?.id || null,
      },
    });

    return booking;
  });

  return ApiResponse.created(res, createdBooking, 'Seminar hall booking request created successfully');
});

exports.createBookingActionRequest = asyncHandler(async (req, res) => {
  const { bookingId, kind, reason, requestedBookingDate, requestedStartTime, requestedEndTime } = req.body;

  if (!bookingId) {
    throw new ValidationError('Booking ID is required');
  }

  if (!kind || !['cancel_request', 'reschedule_request'].includes(kind)) {
    throw new ValidationError('Kind must be either cancel_request or reschedule_request');
  }

  if (!req.user?.id) {
    throw new ValidationError('Authenticated user is required');
  }

  // Fetch current user to get their email
  const requesterUser = await prisma.userLogin.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      uid: true,
      email: true,
      phone: true,
      employeeDetails: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          phoneNumber: true,
          primaryDepartment: {
            select: {
              departmentName: true,
            },
          },
        },
      },
    },
  });

  if (!requesterUser) {
    throw new ValidationError('User profile not found');
  }

  const requesterProfile = buildRequesterProfile(requesterUser);
  const currentUserEmail = requesterProfile.requesterEmail.trim().toLowerCase();
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';

  const existingBooking = await prisma.seminarHallBookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      requestId: true,
      requesterEmail: true,
      status: true,
      roomId: true,
      bookingDate: true,
      startTime: true,
      endTime: true,
      timeSlot: true,
      purpose: true,
    },
  });

  if (!existingBooking) {
    throw new NotFoundError('Seminar hall booking request');
  }

  if (existingBooking.status !== 'approved') {
    throw new ValidationError('Action requests can only be created for active approved bookings');
  }

  // Only the original booker or an admin can create a change request for a booking.
  const bookerEmail = existingBooking.requesterEmail.trim().toLowerCase();

  if (!isAdmin && currentUserEmail !== bookerEmail) {
    throw new ValidationError('Only the person who created this booking or an admin can request changes to it');
  }

  const duplicatePendingRequest = await prisma.seminarHallBookingRequest.findFirst({
    where: {
      roomId: existingBooking.roomId,
      requesterEmail: bookerEmail,
      requestKind: kind,
      status: kind === 'cancel_request' ? 'cancel_pending' : 'reschedule_pending',
      bookingDate: existingBooking.bookingDate,
      startTime: existingBooking.startTime,
      endTime: existingBooking.endTime,
    },
    select: {
      id: true,
      requestId: true,
      status: true,
    },
  });

  if (duplicatePendingRequest) {
    throw new ValidationError(
      kind === 'cancel_request'
        ? 'You have already sent a cancellation request for this booking'
        : 'You have already sent a reschedule request for this booking',
    );
  }

  // Validate reschedule request fields
  if (kind === 'reschedule_request') {
    if (!requestedBookingDate || !requestedStartTime || !requestedEndTime) {
      throw new ValidationError('Reschedule request requires requested booking date, start time, and end time');
    }

    if (requestedStartTime >= requestedEndTime) {
      throw new ValidationError('Requested end time must be after start time');
    }

    const parsedRequestedBookingDate = new Date(`${requestedBookingDate}T00:00:00.000Z`);
    const existingBookingDateKey = new Date(existingBooking.bookingDate).toISOString().slice(0, 10);
    const requestedBookingDateKey = parsedRequestedBookingDate.toISOString().slice(0, 10);

    if (Number.isNaN(parsedRequestedBookingDate.getTime())) {
      throw new ValidationError('Requested booking date is invalid');
    }

    if (requestedBookingDateKey < existingBookingDateKey) {
      throw new ValidationError('Reschedule date must be the same as or after the current booking date');
    }

    if (requestedBookingDateKey === existingBookingDateKey && requestedStartTime < existingBooking.endTime) {
      throw new ValidationError('Reschedule time must be after the current booking end time');
    }

    const currentTime = new Date();
    const currentDateKey = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
    const currentTimeKey = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;

    if (requestedBookingDateKey < currentDateKey) {
      throw new ValidationError('Requested reschedule date cannot be in the past');
    }

    if (requestedBookingDateKey === currentDateKey && requestedStartTime < currentTimeKey) {
      throw new ValidationError('Requested reschedule start time cannot be in the past for today');
    }
  }

  // Build new timeSlot label if reschedule
  let newTimeSlot = existingBooking.timeSlot;
  if (kind === 'reschedule_request' && requestedStartTime && requestedEndTime) {
    // Simple time slot label (can be enhanced based on your logic)
    const hours = parseInt(requestedStartTime.split(':')[0], 10);
    if (hours >= 8 && hours < 12) {
      newTimeSlot = 'AM';
    } else if (hours >= 12 && hours < 18) {
      newTimeSlot = 'PM';
    } else {
      newTimeSlot = 'EVENING';
    }
  }

  const createdRequest = await createBookingRequestWithRetry(async (tx, requestId) => {
    const actionRequest = await tx.seminarHallBookingRequest.create({
      data: {
        requestId,
        requestKind: kind,
        roomId: existingBooking.roomId,
        bookingDate: existingBooking.bookingDate,
        startTime: existingBooking.startTime,
        endTime: existingBooking.endTime,
        timeSlot: existingBooking.timeSlot,
        purpose: existingBooking.purpose,
        status: kind === 'cancel_request' ? 'cancel_pending' : 'reschedule_pending',
        requesterName: requesterProfile.requesterName,
        requesterEmail: requesterProfile.requesterEmail,
        requesterPhone: requesterProfile.requesterPhone || null,
        department: requesterProfile.department,
        // Store original booking details
        originalBookingDate: existingBooking.bookingDate,
        originalTimeSlot: existingBooking.timeSlot,
        originalStartTime: existingBooking.startTime,
        originalEndTime: existingBooking.endTime,
        // Store requested new details for reschedule
        ...(kind === 'reschedule_request' && {
          requestedBookingDate: new Date(`${requestedBookingDate}T00:00:00.000Z`),
          requestedTimeSlot: newTimeSlot,
          requestedStartTime: requestedStartTime,
          requestedEndTime: requestedEndTime,
        }),
      },
      include: bookingInclude,
    });

    await tx.seminarHallBookingHistory.create({
      data: {
        bookingRequestId: actionRequest.id,
        newStatus: actionRequest.status,
        action: kind === 'cancel_request' ? 'cancel_requested' : 'reschedule_requested',
        actionDetails: reason || `${kind === 'cancel_request' ? 'Cancellation' : 'Reschedule'} request for booking ${existingBooking.requestId}`,
        changedBy: req.user.id,
      },
    });

    return actionRequest;
  });

  return ApiResponse.created(res, createdRequest, `${kind === 'cancel_request' ? 'Cancellation' : 'Reschedule'} request created successfully`);
});