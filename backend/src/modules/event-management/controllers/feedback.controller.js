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

module.exports = {
  getFeedbackFormInfo,
  submitFeedback,
  getFeedback,
};
