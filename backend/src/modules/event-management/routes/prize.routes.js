/**
 * Prize Management Routes
 *
 * Handles prize CRUD, reordering, and bulk operations for events.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const prizeController = require('../controllers/prize.controller');
const {
    validateEventId,
    validatePrizeCreate,
    validatePrizeUpdate,
    validatePrizeDelete,
    validatePrizeReorder,
    validatePrizeBulkUpsert,
    validatePrizeToggleEnabled,
} = require('../validators/event.validators');
const { checkAnyPermission } = require('../../../shared/middleware/auth');

const eventManagePerm = checkAnyPermission(
    ['event_manage_own', 'event_manage_all'],
    { checkDefaultPermissions: true }
);

// Get prizes for an event - any authenticated user
router.get('/:id/prizes', prizeController.getPrizes);

// Get specific prize
router.get('/:id/prizes/:prizeId', prizeController.getPrizeById);

// Create prize - require event management permission
router.post('/:id/prizes', validatePrizeCreate, eventManagePerm, prizeController.createPrize);

// Update prize
router.patch('/:id/prizes/:prizeId', validatePrizeUpdate, eventManagePerm, prizeController.updatePrize);

// Delete prize
router.delete('/:id/prizes/:prizeId', validatePrizeDelete, eventManagePerm, prizeController.deletePrize);

// Bulk upsert prizes
router.post('/:id/prizes/bulk', validatePrizeBulkUpsert, eventManagePerm, prizeController.bulkUpsertPrizes);

// Reorder prizes
router.patch('/:id/prizes/reorder', validatePrizeReorder, eventManagePerm, prizeController.reorderPrizes);

// Toggle prizes enabled
router.patch('/:id/prizes-enabled', validatePrizeToggleEnabled, eventManagePerm, prizeController.togglePrizesEnabled);

module.exports = router;
