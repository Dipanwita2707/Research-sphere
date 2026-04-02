/**
 * Event Settings / Visibility Routes
 *
 * Handles event visibility configuration and registration toggle.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const eventSettingsController = require('../controllers/eventSettings.controller');
const { validateEventSettingsUpdate } = require('../validators/eventSettings.validators');
const { validateEventId } = require('../validators/event.validators');
const { checkAnyPermission } = require('../../../shared/middleware/auth');

const eventManagePerm = checkAnyPermission(
    ['event_manage_own', 'event_manage_all'],
    { checkDefaultPermissions: true }
);

// Get event settings
router.get('/:id/settings', validateEventId, eventManagePerm, eventSettingsController.getEventSettings);

// Update event settings
router.put('/:id/settings', validateEventId, eventManagePerm, validateEventSettingsUpdate, eventSettingsController.updateEventSettings);

// Toggle event active status (ON/OFF)
router.patch('/:id/settings/toggle-active', validateEventId, eventManagePerm, eventSettingsController.toggleEventActive);

module.exports = router;
