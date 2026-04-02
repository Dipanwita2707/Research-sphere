/**
 * Prize Controller
 * Controller for managing event prizes
 *
 * Uses asyncHandler to delegate all errors to the global Express error middleware.
 * Service layer throws typed AppError subclasses (NotFoundError, ForbiddenError, etc.)
 * so the error handler can set the correct HTTP status automatically.
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const prizeService = require('../services/prize.service');

/** @route GET /api/events/:id/prizes */
const getPrizes = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const prizes = await prizeService.getPrizes(eventId);
  return ApiResponse.success(res, prizes, 'Prizes retrieved');
});

/** @route GET /api/events/:id/prizes/:prizeId */
const getPrizeById = asyncHandler(async (req, res) => {
  const { prizeId } = req.params;
  const prize = await prizeService.getPrizeById(prizeId);
  return ApiResponse.success(res, prize, 'Prize retrieved');
});

/** @route POST /api/events/:id/prizes */
const createPrize = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;
  const prize = await prizeService.createPrize(eventId, req.body, userId);
  return ApiResponse.created(res, prize, 'Prize created successfully');
});

/** @route PUT /api/events/:id/prizes/:prizeId */
const updatePrize = asyncHandler(async (req, res) => {
  const { prizeId } = req.params;
  const userId = req.user.id;
  const prize = await prizeService.updatePrize(prizeId, req.body, userId);
  return ApiResponse.success(res, prize, 'Prize updated successfully');
});

/** @route DELETE /api/events/:id/prizes/:prizeId */
const deletePrize = asyncHandler(async (req, res) => {
  const { prizeId } = req.params;
  const userId = req.user.id;
  await prizeService.deletePrize(prizeId, userId);
  return ApiResponse.success(res, null, 'Prize deleted successfully');
});

/** @route PUT /api/events/:id/prizes/reorder */
const reorderPrizes = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const { prizeOrders } = req.body;
  const userId = req.user.id;
  const prizes = await prizeService.reorderPrizes(eventId, prizeOrders, userId);
  return ApiResponse.success(res, prizes, 'Prizes reordered');
});

/** @route PUT /api/events/:id/prizes/bulk */
const bulkUpsertPrizes = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const { prizes } = req.body;
  const userId = req.user.id;
  const result = await prizeService.bulkUpsertPrizes(eventId, prizes, userId);
  return ApiResponse.success(res, result, 'Prizes saved');
});

/** @route PUT /api/events/:id/prizes/toggle */
const togglePrizesEnabled = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const { enabled } = req.body;
  const userId = req.user.id;
  const event = await prizeService.togglePrizesEnabled(eventId, enabled, userId);
  return ApiResponse.success(res, event, `Prizes ${enabled ? 'enabled' : 'disabled'}`);
});

module.exports = {
  getPrizes,
  getPrizeById,
  createPrize,
  updatePrize,
  deletePrize,
  reorderPrizes,
  bulkUpsertPrizes,
  togglePrizesEnabled,
};
