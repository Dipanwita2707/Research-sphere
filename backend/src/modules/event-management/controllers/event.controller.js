/**
 * Event Management Controllers
 * 
 * Handles HTTP requests for event management operations
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const eventService = require('../services/event.service');
const { formatEventResponse } = require('../utils/eventHelpers');

/**
 * Get list of events
 * 
 * @route GET /api/events
 * @access Protected
 */
const listEvents = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, status, eventType, search, myEvents } = req.query;
  
  const filters = {
    status,
    eventType,
    search,
    myEvents: myEvents === 'true',
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
 * Get event registrations (for event creator)
 * 
 * @route GET /api/events/:id/registrations
 * @access Protected (Event Creator only)
 */
const getEventRegistrations = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { page, limit, status, search } = req.query;
  
  const event = await eventService.getEventDetails(id, userId);
  
  // Verify user is event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can view registrations');
  }
  
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  
  const where = { eventId: id };
  if (status) where.status = status;
  
  const prisma = require('../../../shared/config/database');
  
  const [registrations, total] = await Promise.all([
    prisma.eventRegistration.findMany({
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
      orderBy: {
        registeredAt: 'desc',
      },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.eventRegistration.count({ where }),
  ]);
  
  return ApiResponse.success(res, {
    registrations,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  }, 'Registrations fetched successfully');
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
  
  const volunteers = event.volunteers || [];
  
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
  getEventVolunteers,
  getMyVolunteerAssignments,
  getMyVolunteerActivity,
};
