/**
 * Stall Management Routes
 *
 * Handles stall applications, approval, and stall CRUD for events.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const stallController = require('../controllers/stall.controller');
const { validateEventId } = require('../validators/event.validators');
const { checkAnyPermission } = require('../../../shared/middleware/auth');

const eventManagePerm = checkAnyPermission(
    ['event_manage_own', 'event_manage_all'],
    { checkDefaultPermissions: true }
);

// ── Stall Applications ─────────────────────────────────────────────

// My application for a specific event
router.get('/:id/stall-applications/my', validateEventId, stallController.getMyStallApplication);

// Bulk update applications
router.patch(
    '/:id/stall-applications/bulk',
    validateEventId,
    eventManagePerm,
    stallController.bulkUpdateStallApplications
);

// Submit stall application (any authenticated user / student)
router.post('/:id/stall-applications', validateEventId, stallController.submitStallApplication);

// Get all applications for an event (creator only)
router.get(
    '/:id/stall-applications',
    validateEventId,
    eventManagePerm,
    stallController.getStallApplications
);

// Toggle stall application portal open/closed (must be before /:appId)
router.patch(
    '/:id/stall-applications/toggle-open',
    validateEventId,
    eventManagePerm,
    stallController.toggleStallApplications
);

// Approve / reject a specific application
router.patch(
    '/:id/stall-applications/:appId',
    validateEventId,
    eventManagePerm,
    stallController.updateStallApplication
);

// ── Stall CRUD ──────────────────────────────────────────────────────

// Get all stalls for event (creator view)
router.get('/:id/stalls', validateEventId, eventManagePerm, stallController.getStalls);

// Creator adds a stall directly
router.post('/:id/stalls', validateEventId, eventManagePerm, stallController.createStall);

// Creator updates a stall
router.patch('/:id/stalls/:stallId', validateEventId, eventManagePerm, stallController.updateStall);

// Creator deletes a stall
router.delete('/:id/stalls/:stallId', validateEventId, eventManagePerm, stallController.deleteStall);

module.exports = router;
