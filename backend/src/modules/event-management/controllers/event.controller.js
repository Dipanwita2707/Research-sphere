/**
 * Event Management Controllers
 * 
 * Handles HTTP requests for event management operations
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const eventService = require('../services/event.service');
const { formatEventResponse } = require('../utils/eventHelpers');
const { canUserSeeEvent } = require('../services/eventSettings.service');

/**
 * Get list of events
 * 
 * @route GET /api/events
 * @access Protected
 */
const listEvents = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, status, eventType, search, myEvents, filter, studentApply } = req.query;

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
  
  return ApiResponse.success(res, formatEventResponse(event), 'Event fetched successfully');
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
  const { page, limit, status } = req.query;
  
  const filters = { status };
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
const scanQRCode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { qrCode, entryType, gateLocation, remarks } = req.body;
  
  const entry = await eventService.scanQRCode(
    id,
    qrCode,
    entryType,
    userId,
    { gateLocation, remarks }
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
  
  const event = await eventService.getEventDetails(id, userId);
  
  // Verify user is event creator or has manage_all
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can view registrations');
  }
  
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  
  const prisma = require('../../../shared/config/database');

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

  // General text search (name, email, uid, registrationId, team name)
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
      },
      orderBy: [
        // Group by team (null teamId last), then by team id, then by registeredAt
        { teamId: 'asc' },
        { registeredAt: 'asc' },
      ],
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.eventRegistration.count({ where }),
  ]);
  
  // Flatten payment array to single object for easier frontend consumption
  const flatRegistrations = registrations.map(r => ({
    ...r,
    team: r.EventTeam || null,
    latestPayment: r.Payment?.[0] || null,
    Payment: undefined,
    EventTeam: undefined,
  }));

  return ApiResponse.success(res, {
    registrations: flatRegistrations,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }, 'Registrations fetched successfully');
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

  const event = await eventService.getEventDetails(id, userId);
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can view registration filter options');
  }

  const prisma = require('../../../shared/config/database');

  // Get all user IDs registered for this event (bounded to prevent unbounded queries)
  const MAX_FILTER_USERS = 5000;
  const registrations = await prisma.eventRegistration.findMany({
    where: { eventId: id },
    select: { userId: true },
    take: MAX_FILTER_USERS,
  });
  const userIds = registrations.map(r => r.userId);

  if (userIds.length === 0) {
    return ApiResponse.success(res, {
      roles: [],
      genders: [],
      schools: [],
      departments: [],
      programs: [],
      passOutYears: [],
    }, 'Filter options fetched');
  }

  // Fetch all relevant user data in one go
  const users = await prisma.userLogin.findMany({
    where: { id: { in: userIds } },
    select: {
      role: true,
      studentLogin: {
        select: {
          gender: true,
          graduationDate: true,
          programId: true,
          program: {
            select: {
              id: true,
              programName: true,
              departmentId: true,
              department: {
                select: {
                  id: true,
                  departmentName: true,
                  facultyId: true,
                  faculty: { select: { id: true, facultyName: true } },
                },
              },
            },
          },
        },
      },
      employeeDetails: {
        select: {
          primarySchoolId: true,
          primaryDepartmentId: true,
          primarySchool: { select: { id: true, facultyName: true } },
          primaryDepartment: { select: { id: true, departmentName: true } },
        },
      },
    },
  });

  // Extract distinct values
  const rolesSet = new Set();
  const gendersSet = new Set();
  const schoolsMap = new Map();
  const departmentsMap = new Map();
  const programsMap = new Map();
  const passOutYearsSet = new Set();

  for (const u of users) {
    rolesSet.add(u.role);

    // Student data
    if (u.studentLogin) {
      const s = u.studentLogin;
      if (s.gender) gendersSet.add(s.gender);
      if (s.graduationDate) {
        passOutYearsSet.add(new Date(s.graduationDate).getFullYear());
      }
      if (s.program) {
        programsMap.set(s.program.id, { id: s.program.id, name: s.program.programName });
        if (s.program.department) {
          const d = s.program.department;
          departmentsMap.set(d.id, { id: d.id, name: d.departmentName });
          if (d.faculty) {
            schoolsMap.set(d.faculty.id, { id: d.faculty.id, name: d.faculty.facultyName });
          }
        }
      }
    }

    // Employee data
    if (u.employeeDetails) {
      const e = u.employeeDetails;
      if (e.primarySchool) {
        schoolsMap.set(e.primarySchool.id, { id: e.primarySchool.id, name: e.primarySchool.facultyName });
      }
      if (e.primaryDepartment) {
        departmentsMap.set(e.primaryDepartment.id, { id: e.primaryDepartment.id, name: e.primaryDepartment.departmentName });
      }
    }
  }

  return ApiResponse.success(res, {
    roles: [...rolesSet].sort(),
    genders: [...gendersSet].sort(),
    schools: [...schoolsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    departments: [...departmentsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    programs: [...programsMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    passOutYears: [...passOutYearsSet].sort((a, b) => b - a),
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
  
  const event = await eventService.getEventDetails(id, userId);
  
  // Verify user is event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can view volunteers');
  }
  
  const rawVolunteers = event.EventVolunteer || [];
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
  scanQRCode,
  getEventRegistrations,
  getRegistrationFilterOptions,
  getEventVolunteers,
  getMyVolunteerAssignments,
  getMyVolunteerActivity,
  getVolunteerActivity,
};
