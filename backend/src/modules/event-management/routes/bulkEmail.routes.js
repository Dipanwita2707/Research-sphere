/**
 * Bulk Email Routes
 *
 * Handles sending bulk emails to event registrants, tracking opens,
 * and email analytics.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const bulkEmailController = require('../controllers/bulkEmail.controller');
const { validateEventId } = require('../validators/event.validators');
const { checkAnyPermission } = require('../../../shared/middleware/auth');

const eventManagePerm = checkAnyPermission(
    ['event_manage_own', 'event_manage_all'],
    { checkDefaultPermissions: true }
);

// Tracking pixel (NOTE: this is called by email clients under auth context here,
// but the original PUBLIC version without auth is in the main event.routes.js)
router.get('/emails/track/:recipientLogId/open.png', bulkEmailController.trackEmailOpen);

// Get current email credit balance for an event
router.get('/:id/emails/credits', validateEventId, eventManagePerm, bulkEmailController.getEmailCredits);

// Get recipient counts per status filter
router.get('/:id/emails/recipients-count', validateEventId, eventManagePerm, bulkEmailController.getRecipientsCount);

// Send bulk email to registrants
router.post('/:id/emails/send', validateEventId, eventManagePerm, bulkEmailController.sendBulkEmail);

// Get email sending history for an event
router.get('/:id/emails/history', validateEventId, eventManagePerm, bulkEmailController.getEmailHistory);

// Get aggregated email analytics for an event
router.get('/:id/emails/analytics', validateEventId, eventManagePerm, bulkEmailController.getEmailAnalytics);

// Cancel a scheduled email
router.delete('/:id/emails/scheduled/:logId', validateEventId, eventManagePerm, bulkEmailController.cancelScheduledEmail);

module.exports = router;
