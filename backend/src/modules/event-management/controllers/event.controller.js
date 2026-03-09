/**
 * Event Management Controllers
 * 
 * Handles HTTP requests for event management operations
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const prisma = require('../../../shared/config/database');
const eventService = require('../services/event.service');
const { formatEventResponse, canManageEvent } = require('../utils/eventHelpers');
const { canUserSeeEvent, assertEventOwner } = require('../services/eventSettings.service');
const { ForbiddenError } = require('../../../shared/utils/AppError');

/**
 * Get list of events
 * 
 * @route GET /api/events
 * @access Protected
 */
const listEvents = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, status, eventType, search, myEvents, filter, studentApply } = req.query;

  // ── Access guard for myEvents=true ─────────────────────────────────────
  // Only faculty, staff, admin/superadmin, and students who are a club
  // chairperson of an active/approved club may request their own event list.
  if (myEvents === 'true') {
    const role = req.user.role;
    const isPrivileged = role === 'faculty' || role === 'staff' || role === 'admin' || role === 'superadmin';
    const isChairperson = role === 'student' && !!req.user._chairpersonClub;
    if (!isPrivileged && !isChairperson) {
      return res.status(403).json({
        success: false,
        message: 'Access denied — only faculty, admins, and club chairpersons can view created events',
      });
    }
  }

  const filters = {
    status,
    eventType,
    search,
    myEvents: myEvents === 'true',
    filter,
    studentApply,
  };
  
  const pagination = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  };
  
  const result = await eventService.listEvents(filters, pagination, userId);
  
  const formattedEvents = result.events.map(formatEventResponse);
  
  return ApiResponse.success(res, {
    events: formattedEvents,
    pagination: result.pagination,
  }, 'Events fetched successfully');
});

/**
 * Get event details by ID
 * 
 * @route GET /api/events/:id
 * @access Protected
 */
const getEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const event = await eventService.getEventDetails(id, userId);

  // ── Visibility enforcement: check if user is allowed to see this event ──
  // Event creators and superadmins bypass visibility checks
  if (event.createdById !== userId && req.user.role !== 'superadmin') {
    const canSee = await canUserSeeEvent(event.id, userId);
    if (!canSee) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this event',
      });
    }
  }

  // ── Add canManage flag so frontend can guard manage pages ──
  const isSuperadmin = req.user.role === 'superadmin';
  const isCreator = event.createdById === userId;
  const hasManageAll = (req.user.centralDeptPermissions || []).some(
    dp => dp.permissions && dp.permissions.event_manage_all === true
  );
  const canManage = isSuperadmin || isCreator || hasManageAll || await canManageEvent(prisma, event.id, userId);

  const formatted = formatEventResponse(event);
  formatted.canManage = canManage;

  return ApiResponse.success(res, formatted, 'Event fetched successfully');
});

/**
 * Update event details
 * 
 * @route PATCH /api/events/:id
 * @access Protected (Event Creator only)
 */
const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const updateData = req.body;
  
  const event = await eventService.updateEvent(id, userId, updateData);
  
  return ApiResponse.success(res, formatEventResponse(event), 'Event updated successfully');
});

/**
 * Publish event (make it available for registration)
 * 
 * @route POST /api/events/:id/publish
 * @access Protected (Event Creator only)
 */
const publishEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const event = await eventService.publishEvent(id, userId);
  
  return ApiResponse.success(res, formatEventResponse(event), 'Event published successfully');
});

/**
 * Register for an event
 * 
 * @route POST /api/events/:id/register
 * @access Protected
 */
const registerForEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const registration = await eventService.registerForEvent(id, userId);
  
  return ApiResponse.success(res, registration, 'Successfully registered for event');
});

/**
 * Get user's registrations
 * 
 * @route GET /api/events/registrations/my
 * @access Protected
 */
const getMyRegistrations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, status, search } = req.query;
  
  const filters = { status, search };
  const pagination = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  };
  
  const result = await eventService.getUserRegistrations(userId, filters, pagination);
  
  return ApiResponse.success(res, result, 'Registrations fetched successfully');
});

/**
 * Get event statistics
 * 
 * @route GET /api/events/:id/statistics
 * @access Protected (Event Creator only)
 */
const getEventStatistics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const statistics = await eventService.getEventStatistics(id, userId);
  
  return ApiResponse.success(res, statistics, 'Event statistics fetched successfully');
});

/**
 * Assign volunteer to event
 * 
 * @route POST /api/events/:id/volunteers
 * @access Protected (Event Creator only)
 */
const assignVolunteer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { userId: volunteerId, role, canScanQr, assignedGate } = req.body;
  
  const volunteer = await eventService.assignVolunteer(
    id,
    volunteerId,
    { role, canScanQr, assignedGate },
    userId
  );
  
  return ApiResponse.success(res, volunteer, 'Volunteer assigned successfully');
});

/**
 * Scan QR code for event entry
 * 
 * @route POST /api/events/:id/scan
 * @access Protected (Volunteers only)
 */
const previewQRScan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { qrCode, entryType = 'entry' } = req.body;

  const preview = await eventService.previewQRScan(id, qrCode, entryType, userId);
  return ApiResponse.success(res, preview, 'Pass info retrieved');
});

const scanQRCode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const {
    qrCode,
    entryType = 'entry',
    entriesToCheckIn,
    peopleCount,
    markStudentExit,
    gateLocation,
    remarks,
  } = req.body;
  
  const entry = await eventService.scanQRCode(
    id,
    qrCode,
    entryType,
    userId,
    { gateLocation, remarks, entriesToCheckIn, peopleCount, markStudentExit }
  );
  
  return ApiResponse.success(res, entry, `QR code scanned successfully - ${entryType}`);
});

/**
 * Get event registrations (for event creator) — with advanced server-side filters
 * 
 * @route GET /api/events/:id/registrations
 * @access Protected (Event Creator only)
 *
 * Query params:
 *   page, limit, status, search,
 *   role        – "student" | "faculty" | "staff" | "admin" | "superadmin" | "parent"
 *   gender      – e.g. "Male", "Female"
 *   schoolId    – UUID of FacultySchoolList
 *   departmentId – UUID of Department
 *   programId   – UUID of Program
 *   passOutYear – graduation year (integer)
 *   uid         – UID / REGNO search (students)
 *   empId       – EMPID search (employees)
 */
const getEventRegistrations = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const {
    page, limit, status, search,
    role, gender, schoolId, departmentId, programId, passOutYear,
    uid, empId, paymentStatus, teamSearch,
  } = req.query;
  
  // Lightweight ownership check instead of full getEventDetails
  await assertEventOwner(id, userId, req.user);
  
  const isExport = req.query.export === 'true';
  const pageNum = isExport ? 1 : (parseInt(page) || 1);
  const limitNum = isExport ? undefined : Math.min(parseInt(limit) || 20, 100);

  // ── Build WHERE clause ──────────────────────────────────────
  const where = { eventId: id };
  if (status && status !== 'all') where.status = status;
  if (paymentStatus && paymentStatus !== 'all') where.paymentStatus = paymentStatus;

  // Build user_login relation filter
  const userFilter = {};

  // Role filter
  if (role) userFilter.role = role;

  // UID / REGNO search (works on user uid OR student registrationNo / studentId)
  if (uid) {
    const uidSearch = uid.trim();
    userFilter.OR = [
      { uid: { contains: uidSearch, mode: 'insensitive' } },
      { studentLogin: { studentId: { contains: uidSearch, mode: 'insensitive' } } },
      { studentLogin: { registrationNo: { contains: uidSearch, mode: 'insensitive' } } },
    ];
  }

  // EMPID search
  if (empId) {
    const empSearch = empId.trim();
    // combine with existing OR if already present? No — empId and uid are mutually exclusive
    userFilter.employeeDetails = { empId: { contains: empSearch, mode: 'insensitive' } };
  }

  // Gender filter — student gender or employee metadata
  if (gender) {
    // Students store gender directly; employees don't have a gender field in DB
    // We filter on StudentDetails.gender
    if (!userFilter.studentLogin) userFilter.studentLogin = {};
    userFilter.studentLogin.gender = { equals: gender, mode: 'insensitive' };
  }

  // School filter (student → program → department → school OR employee → primarySchool)
  if (schoolId) {
    userFilter.OR = [
      ...(userFilter.OR || []),
      { studentLogin: { program: { department: { facultyId: schoolId } } } },
      { employeeDetails: { primarySchoolId: schoolId } },
    ];
  }

  // Department filter
  if (departmentId) {
    userFilter.OR = [
      ...(userFilter.OR || []),
      { studentLogin: { program: { departmentId } } },
      { employeeDetails: { primaryDepartmentId: departmentId } },
    ];
  }

  // Program filter (student only)
  if (programId) {
    if (!userFilter.studentLogin) userFilter.studentLogin = {};
    userFilter.studentLogin.programId = programId;
  }

  // Pass-out year (graduation year)
  if (passOutYear) {
    const year = parseInt(passOutYear);
    if (!isNaN(year)) {
      if (!userFilter.studentLogin) userFilter.studentLogin = {};
      userFilter.studentLogin.graduationDate = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }
  }

  // General text search (name, email, uid, registrationId, team name, transaction ID)
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { registrationId: { contains: q, mode: 'insensitive' } },
      { user_login: { uid: { contains: q, mode: 'insensitive' } } },
      { user_login: { email: { contains: q, mode: 'insensitive' } } },
      { user_login: { studentLogin: { firstName: { contains: q, mode: 'insensitive' } } } },
      { user_login: { studentLogin: { lastName: { contains: q, mode: 'insensitive' } } } },
      { user_login: { employeeDetails: { firstName: { contains: q, mode: 'insensitive' } } } },
      { user_login: { employeeDetails: { lastName: { contains: q, mode: 'insensitive' } } } },
      { EventTeam: { name: { contains: q, mode: 'insensitive' } } },
      { EventTeam: { teamId: { contains: q, mode: 'insensitive' } } },
      // Search by Razorpay payment ID or order ID (transaction search)
      { Payment: { some: { razorpayPaymentId: { contains: q, mode: 'insensitive' } } } },
      { Payment: { some: { razorpayOrderId: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  // Team name filter (dedicated, for chip/input filter)
  if (teamSearch && teamSearch.trim()) {
    const tq = teamSearch.trim();
    where.EventTeam = {
      OR: [
        { name: { contains: tq, mode: 'insensitive' } },
        { teamId: { contains: tq, mode: 'insensitive' } },
      ],
    };
  }

  // Apply user relation filter only if we have conditions
  if (Object.keys(userFilter).length > 0) {
    where.user_login = userFilter;
  }

  // ── Execute Query ───────────────────────────────────────────
  const [registrations, total] = await Promise.all([
    prisma.eventRegistration.findMany({
      where,
      include: {
        user_login: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                empId: true,
                primarySchoolId: true,
                primaryDepartmentId: true,
                primarySchool: { select: { id: true, facultyName: true } },
                primaryDepartment: { select: { id: true, departmentName: true } },
              },
            },
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                registrationNo: true,
                studentId: true,
                gender: true,
                graduationDate: true,
                programId: true,
                program: {
                  select: {
                    id: true,
                    programName: true,
                    department: {
                      select: {
                        id: true,
                        departmentName: true,
                        faculty: { select: { id: true, facultyName: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        // Include team info
        EventTeam: {
          select: {
            id: true,
            teamId: true,
            name: true,
            status: true,
            isComplete: true,
            isLocked: true,
            leaderId: true,
          },
        },
        // Include latest successful payment
        Payment: {
          where: { status: { in: ['captured', 'authorized'] } },
          select: {
            razorpayPaymentId: true,
            razorpayOrderId: true,
            amount: true,
            status: true,
            paidAt: true,
            paymentFor: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        EventExtraPass: {
          select: {
            id: true,
            guestName: true,
            guestEmail: true,
            mobileNumber: true,
            relationship: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [
        // Group by team (null teamId last), then by team id, then by registeredAt
        { teamId: 'asc' },
        { registeredAt: 'asc' },
      ],
      ...(isExport ? {} : { skip: (pageNum - 1) * limitNum, take: limitNum }),
    }),
    prisma.eventRegistration.count({ where }),
  ]);
  
  // Flatten payment array to single object for easier frontend consumption
  const flatRegistrations = registrations.map(r => ({
    ...r,
    team: r.EventTeam || null,
    latestPayment: r.Payment?.[0] || null,
    guests: r.EventExtraPass || [],
    extraPassSummary: {
      extraPassCount: r.extraPassCount ?? 0,
      totalAllowedEntries: r.totalAllowedEntries ?? 1,
      checkedInCount: r.checkedInCount ?? 0,
      checkedOutCount: r.checkedOutCount ?? 0,
      currentlyInside: Math.max(0, (r.checkedInCount ?? 0) - (r.checkedOutCount ?? 0)),
      availableEntrySlots: Math.max(
        0,
        (r.totalAllowedEntries ?? 1) - Math.max(0, (r.checkedInCount ?? 0) - (r.checkedOutCount ?? 0)),
      ),
      remainingEntries: Math.max(
        0,
        (r.totalAllowedEntries ?? 1) - Math.max(0, (r.checkedInCount ?? 0) - (r.checkedOutCount ?? 0)),
      ),
      studentInside: r.studentInsideAssumed ?? Math.max(0, (r.checkedInCount ?? 0) - (r.checkedOutCount ?? 0)) > 0,
    },
    Payment: undefined,
    EventTeam: undefined,
    EventExtraPass: undefined,
  }));

  return ApiResponse.success(res, {
    registrations: flatRegistrations,
    pagination: {
      page: pageNum,
      limit: isExport ? flatRegistrations.length : limitNum,
      total,
      totalPages: isExport ? 1 : Math.ceil(total / limitNum),
    },
  }, 'Registrations fetched successfully');
});

/**
 * Get detailed registration info (admin-only) — includes full payment records,
 * coupon usage, form data, team members, entry logs.
 * 
 * @route GET /api/events/:id/registrations/:regId/details
 * @access Protected (Event Creator only)
 */
const getRegistrationDetails = asyncHandler(async (req, res) => {
  const { id: eventId, regId } = req.params;
  const userId = req.user.id;

  // Lightweight ownership check instead of full getEventDetails
  await assertEventOwner(eventId, userId, req.user);

  const registration = await prisma.eventRegistration.findFirst({
    where: { id: regId, eventId },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          phone: true,
          employeeDetails: {
            select: {
              firstName: true, lastName: true, displayName: true, empId: true,
              primarySchool: { select: { id: true, facultyName: true } },
              primaryDepartment: { select: { id: true, departmentName: true } },
            },
          },
          studentLogin: {
            select: {
              firstName: true, lastName: true, displayName: true,
              registrationNo: true, studentId: true, gender: true, graduationDate: true,
              program: {
                select: {
                  id: true, programName: true,
                  department: {
                    select: {
                      id: true, departmentName: true,
                      faculty: { select: { id: true, facultyName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // All payment records (not just latest successful)
      Payment: {
        select: {
          id: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
          razorpaySignature: true,
          amount: true,
          currency: true,
          status: true,
          paymentFor: true,
          receipt: true,
          attempts: true,
          paidAt: true,
          failedAt: true,
          refundedAt: true,
          webhookVerified: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      // Team info + members (via EventRegistration for registration-level details)
      EventTeam: {
        select: {
          id: true,
          teamId: true,
          name: true,
          status: true,
          isComplete: true,
          isLocked: true,
          leaderId: true,
          EventRegistration: {
            select: {
              id: true,
              registrationId: true,
              status: true,
              paymentStatus: true,
              amountPaid: true,
              isTeamLeader: true,
              registeredAt: true,
              user_login: {
                select: {
                  id: true, uid: true, email: true, role: true,
                  studentLogin: { select: { firstName: true, lastName: true, displayName: true, registrationNo: true, studentId: true } },
                  employeeDetails: { select: { firstName: true, lastName: true, displayName: true, empId: true } },
                },
              },
            },
          },
        },
      },
      // Entry/exit logs
      EventEntry: {
        select: {
          id: true,
          entryType: true,
          gateLocation: true,
          scannedAt: true,
          remarks: true,
          EventVolunteer: {
            select: {
              user_login: { select: { uid: true, email: true } },
            },
          },
        },
        orderBy: { scannedAt: 'desc' },
        take: 20,
      },
      // Custom form field responses
      EventFieldResponse: {
        include: {
          EventCustomField: {
            select: { id: true, fieldLabel: true, fieldName: true, fieldType: true, sortOrder: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      EventExtraPass: {
        select: {
          id: true,
          guestName: true,
          guestEmail: true,
          mobileNumber: true,
          relationship: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!registration) {
    return res.status(404).json({ success: false, message: 'Registration not found' });
  }

  // Flatten team members from EventRegistration
  const teamData = registration.EventTeam
    ? {
        ...registration.EventTeam,
        members: registration.EventTeam.EventRegistration || [],
        EventRegistration: undefined,
      }
    : null;

  // Collect payments: individual (linked via registrationId) + team (linked via teamId)
  let payments = registration.Payment || [];
  if (payments.length === 0 && registration.teamId) {
    // Team payments are linked to the team, not individual registrations
    const teamPayments = await prisma.payment.findMany({
      where: { teamId: registration.teamId, eventId },
      select: {
        id: true, razorpayOrderId: true, razorpayPaymentId: true, razorpaySignature: true,
        amount: true, currency: true, status: true, paymentFor: true, receipt: true,
        attempts: true, paidAt: true, failedAt: true, refundedAt: true,
        webhookVerified: true, metadata: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    payments = teamPayments;
  }

  // Fetch coupon usage if couponId is present; fall back to team payment metadata when needed.
  let couponDetails = null;
  if (registration.couponId) {
    const couponUsage = await prisma.couponUsage.findUnique({
      where: { registrationId: registration.id },
      include: {
        coupon: {
          select: { id: true, code: true, discountType: true, discountValue: true, isActive: true },
        },
      },
    });
    couponDetails = couponUsage
      ? {
          ...couponUsage.coupon,
          usedAt: couponUsage.usedAt,
          discountAmount: couponUsage.discountAmount,
          originalAmount: couponUsage.originalAmount,
          finalAmount: couponUsage.finalAmount,
        }
      : { id: registration.couponId };
  }

  if (!couponDetails) {
    const paymentCouponMeta = payments.find((payment) => payment?.metadata?.coupon)?.metadata?.coupon;
    if (paymentCouponMeta) {
      couponDetails = {
        id: paymentCouponMeta.couponId,
        code: paymentCouponMeta.code,
        discountAmount: paymentCouponMeta.discountAmount,
        originalAmount: paymentCouponMeta.originalAmount,
        finalAmount: Math.max(0, (paymentCouponMeta.originalAmount || 0) - (paymentCouponMeta.discountAmount || 0)),
      };
    }
  }

  // Map field responses to label+value pairs for easy display
  const formFields = (registration.EventFieldResponse || [])
    .sort((a, b) => (a.EventCustomField?.sortOrder ?? 0) - (b.EventCustomField?.sortOrder ?? 0))
    .map(r => ({
      fieldId: r.fieldId,
      label: r.EventCustomField?.fieldLabel || r.EventCustomField?.fieldName || r.fieldId,
      fieldType: r.EventCustomField?.fieldType || 'text',
      value: r.value || null,
      fileUrl: r.fileUrl || null,
    }));

  return ApiResponse.success(res, {
    ...registration,
    originalAmount: registration.originalAmount ?? couponDetails?.originalAmount ?? null,
    discountAmount: registration.discountAmount ?? couponDetails?.discountAmount ?? null,
    guests: registration.EventExtraPass || [],
    extraPassSummary: {
      extraPassCount: registration.extraPassCount ?? 0,
      totalAllowedEntries: registration.totalAllowedEntries ?? 1,
      checkedInCount: registration.checkedInCount ?? 0,
      checkedOutCount: registration.checkedOutCount ?? 0,
      currentlyInside: Math.max(0, (registration.checkedInCount ?? 0) - (registration.checkedOutCount ?? 0)),
      availableEntrySlots: Math.max(
        0,
        (registration.totalAllowedEntries ?? 1) - Math.max(0, (registration.checkedInCount ?? 0) - (registration.checkedOutCount ?? 0)),
      ),
      // Legacy alias for existing UI consumers.
      remainingEntries: Math.max(
        0,
        (registration.totalAllowedEntries ?? 1) - Math.max(0, (registration.checkedInCount ?? 0) - (registration.checkedOutCount ?? 0)),
      ),
      studentInside: registration.studentInsideAssumed ?? Math.max(0, (registration.checkedInCount ?? 0) - (registration.checkedOutCount ?? 0)) > 0,
    },
    team: teamData,
    payments,
    formFields,
    entries: (registration.EventEntry || []).map(e => ({
      id: e.id,
      entryType: e.entryType,
      gateLocation: e.gateLocation,
      scannedAt: e.scannedAt,
      remarks: e.remarks,
      scannedBy: e.EventVolunteer?.user_login || null,
    })),
    couponDetails,
    EventTeam: undefined,
    Payment: undefined,
    EventEntry: undefined,
    EventExtraPass: undefined,
    EventFieldResponse: undefined,
  }, 'Registration details fetched successfully');
});

/**
 * Get dynamic filter options for event registrations.
 * Returns distinct values that actually exist in the registration data.
 * 
 * @route GET /api/events/:id/registrations/filter-options
 * @access Protected (Event Creator only)
 */
const getRegistrationFilterOptions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Lightweight ownership check instead of full getEventDetails
  await assertEventOwner(id, userId, req.user);

  // Use raw SQL DISTINCT queries instead of loading 5000+ users into memory
  // NOTE: Table/column names use @@map values from schema (snake_case), not Prisma model names
  const [roles, genders, schools, departments, programs, passOutYears] = await Promise.all([
    // Distinct roles
    prisma.$queryRaw`
      SELECT DISTINCT ul."role"
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      WHERE er."eventId" = ${id}
      ORDER BY ul."role"
    `,
    // Distinct genders (students only)
    prisma.$queryRaw`
      SELECT DISTINCT sd."gender"
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      JOIN "student_details" sd ON sd."user_login_id" = ul.id
      WHERE er."eventId" = ${id} AND sd."gender" IS NOT NULL
      ORDER BY sd."gender"
    `,
    // Distinct schools
    prisma.$queryRaw`
      SELECT DISTINCT f.id, f."faculty_name" as name
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      LEFT JOIN "student_details" sd ON sd."user_login_id" = ul.id
      LEFT JOIN "program" p ON p.id = sd."program_id"
      LEFT JOIN "department" d ON d.id = p."department_id"
      LEFT JOIN "faculty_school_list" f ON f.id = d."faculty_id"
      LEFT JOIN "employee_details" ed ON ed."user_login_id" = ul.id
      LEFT JOIN "faculty_school_list" f2 ON f2.id = ed."primary_school_id"
      WHERE er."eventId" = ${id} AND (f.id IS NOT NULL OR f2.id IS NOT NULL)
    `,
    // Distinct departments
    prisma.$queryRaw`
      SELECT DISTINCT d2.id, d2."department_name" as name
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      LEFT JOIN "student_details" sd ON sd."user_login_id" = ul.id
      LEFT JOIN "program" p ON p.id = sd."program_id"
      LEFT JOIN "department" d2 ON d2.id = p."department_id"
      LEFT JOIN "employee_details" ed ON ed."user_login_id" = ul.id
      LEFT JOIN "department" d3 ON d3.id = ed."primary_department_id"
      WHERE er."eventId" = ${id} AND (d2.id IS NOT NULL OR d3.id IS NOT NULL)
    `,
    // Distinct programs (students only)
    prisma.$queryRaw`
      SELECT DISTINCT p.id, p."program_name" as name
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      JOIN "student_details" sd ON sd."user_login_id" = ul.id
      JOIN "program" p ON p.id = sd."program_id"
      WHERE er."eventId" = ${id}
      ORDER BY p."program_name"
    `,
    // Distinct pass-out years (students only)
    prisma.$queryRaw`
      SELECT DISTINCT EXTRACT(YEAR FROM sd."graduation_date")::int as year
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      JOIN "student_details" sd ON sd."user_login_id" = ul.id
      WHERE er."eventId" = ${id} AND sd."graduation_date" IS NOT NULL
      ORDER BY year DESC
    `,
  ]);

  // Merge school results (student schools + employee schools)
  const schoolsMap = new Map();
  for (const s of schools) {
    if (s.id && s.name) schoolsMap.set(s.id, { id: s.id, name: s.name });
  }

  // Merge department results (student depts + employee depts)
  const departmentsMap = new Map();
  for (const d of departments) {
    if (d.id && d.name) departmentsMap.set(d.id, { id: d.id, name: d.name });
  }

  return ApiResponse.success(res, {
    roles: roles.map(r => r.role).filter(Boolean).sort(),
    genders: genders.map(g => g.gender).filter(Boolean).sort(),
    schools: [...schoolsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    departments: [...departmentsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    programs: programs.map(p => ({ id: p.id, name: p.name })).filter(p => p.id),
    passOutYears: passOutYears.map(p => p.year).filter(Boolean),
  }, 'Filter options fetched');
});

/**
 * Get event volunteers (for event creator)
 * 
 * @route GET /api/events/:id/volunteers
 * @access Protected (Event Creator only)
 */
const getEventVolunteers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Lightweight ownership check
  await assertEventOwner(id, userId, req.user);
  
  // Fetch volunteers directly instead of loading entire event
  const rawVolunteers = await prisma.eventVolunteer.findMany({
    where: { eventId: id },
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
  
  const volunteers = rawVolunteers.map((v) => {
    const ul = v.user_login;
    const emp = ul?.employeeDetails;
    const stu = ul?.studentLogin;
    const name = emp?.displayName ||
      (emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : null) ||
      stu?.displayName ||
      (stu ? `${stu.firstName || ''} ${stu.lastName || ''}`.trim() : null) ||
      ul?.uid ||
      'Unknown User';
    return {
      ...v,
      user: ul ? { id: ul.id, uid: ul.uid, email: ul.email, name } : null,
    };
  });

  return ApiResponse.success(res, volunteers, 'Volunteers fetched successfully');
});

/**
 * Remove volunteer from event
 *
 * @route DELETE /api/events/:id/volunteers/:volunteerId
 * @access Protected (Event Manager)
 */
const removeVolunteerHandler = asyncHandler(async (req, res) => {
  const { id, volunteerId } = req.params;
  const userId = req.user.id;

  await assertEventOwner(id, userId, req.user);
  await eventService.removeVolunteer(id, volunteerId, userId);

  return ApiResponse.success(res, null, 'Volunteer removed successfully');
});

/**
 * Update volunteer details (role, gate, QR permission)
 *
 * @route PATCH /api/events/:id/volunteers/:volunteerId
 * @access Protected (Event Manager)
 */
const updateVolunteerHandler = asyncHandler(async (req, res) => {
  const { id, volunteerId } = req.params;
  const userId = req.user.id;

  await assertEventOwner(id, userId, req.user);
  const updated = await eventService.updateVolunteer(id, volunteerId, req.body, userId);

  return ApiResponse.success(res, updated, 'Volunteer updated successfully');
});

/**
 * Get club members for an event's associated club.
 * Returns active members (excluding those already assigned as volunteers).
 *
 * @route GET /api/events/:id/club-members
 * @access Protected (Event Manager)
 */
const getClubMembers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Ownership / manage permission check
  await assertEventOwner(id, userId, req.user);

  // Get event → note → club chain (include chairpersonId to exclude from member list)
  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      notingId: true,
      note: {
        select: {
          eventClubId: true,
          eventClub: {
            select: { id: true, name: true, clubId: true, chairpersonId: true },
          },
        },
      },
    },
  });

  if (!event?.note?.eventClubId) {
    return ApiResponse.success(res, { club: null, members: [] }, 'Event has no associated club');
  }

  const clubUuid = event.note.eventClubId;
  const chairpersonId = event.note.eventClub?.chairpersonId;

  // Get existing volunteer userIds for this event (to mark already-assigned)
  const existingVolunteers = await prisma.eventVolunteer.findMany({
    where: { eventId: id },
    select: { userId: true },
  });
  const assignedSet = new Set(existingVolunteers.map((v) => v.userId));

  // Fetch active club members (exclude chairperson — they're auto-assigned as event_manager)
  const clubMembers = await prisma.clubMember.findMany({
    where: {
      clubId: clubUuid,
      isActive: true,
      ...(chairpersonId ? { studentId: { not: chairpersonId } } : {}),
    },
    orderBy: { joinedAt: 'asc' },
    include: {
      student: {
        select: {
          id: true,
          uid: true,
          email: true,
          studentLogin: {
            select: { firstName: true, lastName: true, displayName: true },
          },
        },
      },
    },
  });

  const members = clubMembers.map((m) => {
    const stu = m.student?.studentLogin;
    const name = stu?.displayName ||
      (stu ? `${stu.firstName || ''} ${stu.lastName || ''}`.trim() : null) ||
      m.student?.uid || 'Unknown';
    return {
      id: m.student.id,
      uid: m.student.uid,
      email: m.student.email,
      name,
      alreadyAssigned: assignedSet.has(m.student.id),
    };
  });

  return ApiResponse.success(res, {
    club: {
      id: event.note.eventClub.id,
      clubId: event.note.eventClub.clubId,
      name: event.note.eventClub.name,
    },
    members,
  }, 'Club members fetched successfully');
});

/**
 * Get my volunteer assignments (events where user is a volunteer)
 * 
 * @route GET /api/events/volunteers/my
 * @access Protected
 */
const getMyVolunteerAssignments = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const assignments = await eventService.getMyVolunteerAssignments(userId);
  
  return ApiResponse.success(res, assignments, 'Volunteer assignments fetched successfully');
});

/**
 * Get my volunteer activity (scan history)
 * 
 * @route GET /api/events/volunteers/my/activity
 * @access Protected
 */
const getMyVolunteerActivity = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, eventId, search, startDate, endDate } = req.query;
  
  const filters = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 30,
    eventId,
    search,
    startDate,
    endDate,
  };
  
  const result = await eventService.getMyVolunteerActivity(userId, filters);
  
  return ApiResponse.success(res, result, 'Volunteer activity fetched successfully');
});

/**
 * Get volunteer activity for a specific volunteer (event creator view)
 * 
 * @route GET /api/events/:id/volunteers/:volunteerId/activity
 * @access Protected (Event Creator only)
 */
const getVolunteerActivity = asyncHandler(async (req, res) => {
  const { id: eventId, volunteerId } = req.params;
  const userId = req.user.id;
  const { page, limit, startDate, endDate } = req.query;
  
  const filters = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    startDate,
    endDate,
  };
  
  const result = await eventService.getVolunteerActivity(eventId, volunteerId, userId, filters);
  
  return ApiResponse.success(res, result, 'Volunteer activity fetched successfully');
});

module.exports = {
  listEvents,
  getEvent,
  updateEvent,
  publishEvent,
  registerForEvent,
  getMyRegistrations,
  getEventStatistics,
  assignVolunteer,
  previewQRScan,
  scanQRCode,
  getEventRegistrations,
  getRegistrationDetails,
  getRegistrationFilterOptions,
  getEventVolunteers,
  getClubMembers,
  removeVolunteerHandler,
  updateVolunteerHandler,
  getMyVolunteerAssignments,
  getMyVolunteerActivity,
  getVolunteerActivity,
};
