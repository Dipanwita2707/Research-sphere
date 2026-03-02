/**
 * TMS Ticket Controller
 * HTTP handlers for student ticket submission and employee ticket management
 */
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const ticketService = require('../services/ticket.service');
const escalationService = require('../services/escalation.service');
const { SUCCESS_MESSAGES } = require('../constants/tms.constants');

// ============================================
// STUDENT ENDPOINTS
// ============================================

/**
 * POST /tms/tickets
 * Student submits a new ticket (grievance/assistance/enquiry/feedback)
 */
const createTicket = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    messageType,
    priority,
    masterCategoryId,
    categoryId,
    subCategoryId,
    subject,
    description,
    contactNumber,
    documentPath,
    documentName,
  } = req.body;

  const ticket = await ticketService.createTicket({
    messageType,
    priority,
    masterCategoryId,
    categoryId,
    subCategoryId,
    subject,
    description,
    contactNumber,
    documentPath,
    documentName,
  }, userId);

  return ApiResponse.success(res, ticket, SUCCESS_MESSAGES.TICKET_CREATED, 201);
});

/**
 * GET /tms/tickets/my
 * Student views their submitted tickets
 */
const getMyTickets = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, status, messageType, priority } = req.query;

  const result = await ticketService.listStudentTickets(userId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    messageType,
    priority,
  });

  return ApiResponse.success(res, result, 'Tickets fetched successfully');
});

/**
 * GET /tms/tickets/:id
 * View a specific ticket (student or assigned employee)
 */
const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await ticketService.getTicketById(req.params.id);
  return ApiResponse.success(res, ticket, 'Ticket fetched successfully');
});

/**
 * POST /tms/tickets/:id/rate
 * Student rates a resolved ticket
 */
const rateTicket = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { rating, feedback } = req.body;

  const result = await ticketService.rateTicket(id, userId, rating, feedback);

  return ApiResponse.success(res, result, SUCCESS_MESSAGES.TICKET_RATED);
});

// ============================================
// EMPLOYEE ENDPOINTS
// ============================================

/**
 * GET /tms/tickets/assigned
 * Employee views tickets assigned to them
 */
const getAssignedTickets = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, status, messageType, priority } = req.query;

  const result = await ticketService.listEmployeeTickets(userId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    messageType,
    priority,
  });

  return ApiResponse.success(res, result, 'Assigned tickets fetched successfully');
});

/**
 * POST /tms/tickets/:id/remark
 * Employee adds a remark/response to a ticket
 */
const addRemark = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  const result = await ticketService.addRemark(id, userId, remarks);

  return ApiResponse.success(res, result, SUCCESS_MESSAGES.REMARK_ADDED);
});

/**
 * POST /tms/tickets/:id/escalate
 * Employee manually escalates a ticket to the next level
 */
const escalateTicket = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  const result = await escalationService.escalateTicket(id, userId, remarks);

  return ApiResponse.success(res, result, SUCCESS_MESSAGES.TICKET_ESCALATED);
});

/**
 * POST /tms/tickets/:id/resolve
 * Employee resolves a ticket with resolution remarks
 */
const resolveTicket = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  const result = await ticketService.resolveTicket(id, userId, remarks);

  return ApiResponse.success(res, result, SUCCESS_MESSAGES.TICKET_RESOLVED);
});

/**
 * POST /tms/tickets/:id/close
 * Employee or admin closes a ticket
 */
const closeTicket = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  const result = await ticketService.closeTicket(id, userId, remarks);

  return ApiResponse.success(res, result, SUCCESS_MESSAGES.TICKET_CLOSED);
});

/**
 * GET /tms/tickets/history
 * Employee views their action history (tickets they've resolved, closed, escalated, remarked on)
 */
const getMyHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, status, messageType, priority, search, action } = req.query;

  const result = await ticketService.listEmployeeHistory(userId, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    messageType,
    priority,
    search,
    action,
  });

  return ApiResponse.success(res, result, 'Request history fetched successfully');
});

module.exports = {
  createTicket,
  getMyTickets,
  getTicketById,
  rateTicket,
  getAssignedTickets,
  getMyHistory,
  addRemark,
  escalateTicket,
  resolveTicket,
  closeTicket,
};
