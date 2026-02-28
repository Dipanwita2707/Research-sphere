/**
 * TMS Admin Controller
 * HTTP handlers for admin analytics and dashboard
 */
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const analyticsService = require('../services/analytics.service');

/**
 * GET /tms/admin/analytics/overview
 * Get overview dashboard statistics
 */
const getOverviewAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const result = await analyticsService.getOverviewStats({ startDate, endDate });
  return ApiResponse.success(res, result, 'Overview analytics fetched successfully');
});

/**
 * GET /tms/admin/analytics/employees
 * Get per-employee performance statistics
 */
const getEmployeeAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const result = await analyticsService.getEmployeeStats({ startDate, endDate });
  return ApiResponse.success(res, result, 'Employee analytics fetched successfully');
});

/**
 * GET /tms/admin/analytics/categories
 * Get per-category distribution statistics
 */
const getCategoryAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const result = await analyticsService.getCategoryStats({ startDate, endDate });
  return ApiResponse.success(res, result, 'Category analytics fetched successfully');
});

/**
 * GET /tms/admin/tickets
 * Admin lists all tickets with comprehensive filtering
 */
const listAllTickets = asyncHandler(async (req, res) => {
  const {
    page, limit, status, messageType, priority,
    masterCategoryId, categoryId, assignedToId, createdById,
    currentLevel, search, startDate, endDate, sortBy, sortOrder,
  } = req.query;

  const result = await analyticsService.listAllTickets({
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    messageType,
    priority,
    masterCategoryId,
    categoryId,
    assignedToId,
    createdById,
    currentLevel,
    search,
    startDate,
    endDate,
    sortBy,
    sortOrder,
  });

  return ApiResponse.success(res, result, 'All tickets fetched successfully');
});

module.exports = {
  getOverviewAnalytics,
  getEmployeeAnalytics,
  getCategoryAnalytics,
  listAllTickets,
};
