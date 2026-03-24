/**
 * Round Controller
 * Controller for managing event rounds/phases
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const roundService = require('../services/round.service');

/** @route GET /api/events/:id/rounds */
const getRounds = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const rounds = await roundService.getRounds(eventId);
  return ApiResponse.success(res, rounds, 'Rounds retrieved');
});

/** @route GET /api/events/:id/rounds/:roundId */
const getRoundById = asyncHandler(async (req, res) => {
  const { roundId } = req.params;
  const round = await roundService.getRoundById(roundId);
  return ApiResponse.success(res, round, 'Round retrieved');
});

/** @route POST /api/events/:id/rounds */
const createRound = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const userId = req.user.id;
  const round = await roundService.createRound(eventId, req.body, userId);
  return ApiResponse.created(res, round, 'Round created successfully');
});

/** @route PATCH /api/events/:id/rounds/:roundId */
const updateRound = asyncHandler(async (req, res) => {
  const { roundId } = req.params;
  const userId = req.user.id;
  const round = await roundService.updateRound(roundId, req.body, userId);
  return ApiResponse.success(res, round, 'Round updated successfully');
});

/** @route DELETE /api/events/:id/rounds/:roundId */
const deleteRound = asyncHandler(async (req, res) => {
  const { roundId } = req.params;
  const userId = req.user.id;
  await roundService.deleteRound(roundId, userId);
  return ApiResponse.success(res, null, 'Round deleted successfully');
});

/** @route PATCH /api/events/:id/rounds/reorder */
const reorderRounds = asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const { roundOrders } = req.body;
  const userId = req.user.id;
  const rounds = await roundService.reorderRounds(eventId, roundOrders, userId);
  return ApiResponse.success(res, rounds, 'Rounds reordered');
});

module.exports = {
  getRounds,
  getRoundById,
  createRound,
  updateRound,
  deleteRound,
  reorderRounds,
};
