/**
 * Round Management Routes
 *
 * Handles round CRUD and reordering for events.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const roundController = require('../controllers/round.controller');
const {
  validateEventId,
  validateRoundCreate,
  validateRoundUpdate,
  validateRoundDelete,
  validateRoundReorder,
} = require('../validators/event.validators');
const { checkAnyPermission } = require('../../../shared/middleware/auth');

const eventManagePerm = checkAnyPermission(
  ['event_manage_own', 'event_manage_all'],
  { checkDefaultPermissions: true }
);

// Get rounds for an event - any authenticated user
router.get('/:id/rounds', roundController.getRounds);

// Get specific round
router.get('/:id/rounds/:roundId', roundController.getRoundById);

// Create round - require event management permission
router.post('/:id/rounds', validateRoundCreate, eventManagePerm, roundController.createRound);

// Reorder rounds (must be before /:roundId to avoid matching "reorder" as roundId)
router.patch('/:id/rounds/reorder', validateRoundReorder, eventManagePerm, roundController.reorderRounds);

router.patch('/:id/rounds/:roundId', validateRoundUpdate, eventManagePerm, roundController.updateRound);

// Delete round
router.delete('/:id/rounds/:roundId', validateRoundDelete, eventManagePerm, roundController.deleteRound);

module.exports = router;
