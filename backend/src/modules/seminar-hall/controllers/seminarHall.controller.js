const prisma = require('../../../shared/config/database');
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
  const { status, requestKind, requesterEmail, roomId } = req.query;

  const where = {};

  if (typeof status === 'string' && status.trim()) {
    where.status = status.trim();
  }

  if (typeof requestKind === 'string' && requestKind.trim()) {
    where.requestKind = requestKind.trim();
  }

  if (typeof requesterEmail === 'string' && requesterEmail.trim()) {
    where.requesterEmail = requesterEmail.trim().toLowerCase();
  }

  if (typeof roomId === 'string' && roomId.trim()) {
    where.roomId = roomId.trim();
  }

  const bookings = await prisma.seminarHallBookingRequest.findMany({
    where,
    include: bookingInclude,
    orderBy: [
      { createdAt: 'desc' },
      { bookingDate: 'desc' },
    ],
  });

  return ApiResponse.success(res, bookings, 'Seminar hall booking requests fetched successfully');
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
      status: {
        in: ['pending', 'approved', 'reschedule_pending'],
      },
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

  const createdBooking = await prisma.$transaction(async (tx) => {
    const requestId = await buildRequestId(tx);

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
      },
    });

    return booking;
  });

  return ApiResponse.created(res, createdBooking, 'Seminar hall booking request created successfully');
});