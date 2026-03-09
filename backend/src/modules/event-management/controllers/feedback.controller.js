/**
 * Event Feedback Controller
 */

const eventService = require('../services/event.service');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');

/**
 * Get minimal event info for feedback form (public - no auth, for QR scanner users)
 * @route GET /api/events/:id/feedback-info
 */
const getFeedbackFormInfo = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const info = await eventService.getEventFeedbackFormInfo(eventId);
  return ApiResponse.success(res, info, 'Event info fetched');
});

/**
 * Submit event feedback (public - no auth required for scanner users)
 * @route POST /api/events/:id/feedback
 */
const submitFeedback = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const { points, shortDescription } = req.body;
  const feedback = await eventService.submitEventFeedback(eventId, { points, shortDescription });
  return ApiResponse.success(res, feedback, 'Thank you for your feedback!');
});

/**
 * Get event feedback list (event creator only)
 * @route GET /api/events/:id/feedback
 */
const getFeedback = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const result = await eventService.getEventFeedback(eventId, userId, { page: parseInt(page), limit: parseInt(limit) });
  return ApiResponse.success(res, result, 'Feedback fetched successfully');
});

// ── Stall feedback ─────────────────────────────────────────────

/**
 * Get stall info for stall feedback form (public - no auth)
 * @route GET /api/events/:id/stalls/:stallId/feedback-info
 */
const getStallFeedbackFormInfo = asyncHandler(async (req, res) => {
  const { id: eventId, stallId } = req.params;
  const info = await eventService.getStallFeedbackFormInfo(eventId, stallId);
  return ApiResponse.success(res, info, 'Stall info fetched');
});

/**
 * Submit stall feedback (public - no auth required)
 * @route POST /api/events/:id/stalls/:stallId/feedback
 */
const submitStallFeedback = asyncHandler(async (req, res) => {
  const { id: eventId, stallId } = req.params;
  const { points, shortDescription } = req.body;
  const feedback = await eventService.submitStallFeedback(eventId, stallId, { points, shortDescription });
  return ApiResponse.success(res, feedback, 'Thank you for your feedback!');
});

/**
 * Get stall feedback list (event creator only)
 * @route GET /api/events/:id/stalls/:stallId/feedback
 */
const getStallFeedback = asyncHandler(async (req, res) => {
  const { id: eventId, stallId } = req.params;
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const result = await eventService.getStallFeedback(eventId, stallId, userId, { page: parseInt(page), limit: parseInt(limit) });
  return ApiResponse.success(res, result, 'Stall feedback fetched successfully');
});

/**
 * Get stall feedback for the stall owner (auth required, ownership verified)
 * @route GET /api/events/:id/stalls/:stallId/owner-feedback
 */
const getStallOwnerFeedback = asyncHandler(async (req, res) => {
  const { id: eventId, stallId } = req.params;
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  const result = await eventService.getStallOwnerFeedback(eventId, stallId, userId, {
    page: parseInt(page),
    limit: parseInt(limit),
  });
  return ApiResponse.success(res, result, 'Feedback fetched');
});

module.exports = {
  getFeedbackFormInfo,
  submitFeedback,
  getFeedback,
  getStallFeedbackFormInfo,
  submitStallFeedback,
  getStallFeedback,
  getStallOwnerFeedback,
};
