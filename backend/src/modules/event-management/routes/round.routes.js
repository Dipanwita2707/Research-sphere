/**
 * Round Management Routes
 *
 * Handles round CRUD and reordering for events.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const roundController = require('../controllers/round.controller');
const { validateEventId } = require('../validators/event.validators');
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
router.post('/:id/rounds', validateEventId, eventManagePerm, roundController.createRound);

// Reorder rounds (must be before /:roundId to avoid matching "reorder" as roundId)
router.patch('/:id/rounds/reorder', validateEventId, eventManagePerm, roundController.reorderRounds);

// Update round (no validateEventId — it strips roundId from params)
router.patch('/:id/rounds/:roundId', eventManagePerm, roundController.updateRound);

// Delete round
router.delete('/:id/rounds/:roundId', eventManagePerm, roundController.deleteRound);

module.exports = router;
