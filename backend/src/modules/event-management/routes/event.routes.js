/**
 * Event Management Routes
 * 
 * Defines all API endpoints for event management
 * Uses centralized permission system from permissions.config.js
 */

const express = require('express');
const router = express.Router();
const prisma = require('../../../shared/config/database');
const eventController = require('../controllers/event.controller');
const {
  validateEventUpdate,
  validateEventId,
  validateEventPublish,
  validateRegistration,
  validateQRScan,
  validateVolunteerAssignment,
  validateListQuery,
  validateFeedback,
} = require('../validators/event.validators');
const { 
  protect, 
  checkPermission, 
  checkAnyPermission,
  requireEventPermission 
} = require('../../../shared/middleware/auth');
const { getDefaultPermissions } = require('../../../shared/config/permissions.config');
const feedbackController = require('../controllers/feedback.controller');
const paymentController = require('../controllers/payment.controller');

// ============================================
// Razorpay Webhook — Public (verified via signature)
// Must use raw body parser for signature verification
// ============================================
router.post(
  '/payments/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

// Public: Submit event feedback (no auth - for QR scanner users)
router.post('/:id/feedback', validateEventId, validateFeedback, feedbackController.submitFeedback);

// Public: Get minimal event info for feedback form (no auth - for QR scanner users)
router.get('/:id/feedback-info', validateEventId, feedbackController.getFeedbackFormInfo);

// Public: Stall feedback (no auth - scanned by customers at the stall)
router.get('/:id/stalls/:stallId/feedback-info', feedbackController.getStallFeedbackFormInfo);
router.post('/:id/stalls/:stallId/feedback', feedbackController.submitStallFeedback);

// All routes require authentication
router.use(protect);

/**
 * Allow scan if user has event_manage_attendance OR is a volunteer with canScanQr for this event
 */
const allowEventScan = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Check 1: event_manage_attendance permission
    const defaultPerms = getDefaultPermissions(user.role);
    if (defaultPerms.event_manage_attendance === true) {
      return next();
    }
    const permissionVariants = ['event_manage_attendance', 'event_event_manage_attendance'];
    const hasExplicit = (user.centralDeptPermissions || []).some(d =>
      d.permissions && permissionVariants.some(v => d.permissions[v] === true)
    ) || (user.schoolDeptPermissions || []).some(d =>
      d.permissions && permissionVariants.some(v => d.permissions[v] === true)
    );
    if (hasExplicit) {
      return next();
    }

    // Check 2: volunteer with canScanQr for this event
    const eventId = req.params?.id;
    const userId = user.id;
    if (eventId && userId) {
      const volunteer = await prisma.eventVolunteer.findFirst({
        where: { eventId, userId, canScanQr: true },
      });
      if (volunteer) return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied - event_manage_attendance or volunteer with QR scan permission required',
    });
  } catch (e) {
    console.error('allowEventScan error:', e);
    return res.status(500).json({ success: false, message: 'Permission check failed' });
  }
};

/**
 * Event Routes
 */

// List events - anyone with event_view_all or event_manage_own can list
// (students can register, so they should be able to see events)
router.get(
  '/',
  validateListQuery,
  eventController.listEvents
);

// Get my registrations - any authenticated user
router.get(
  '/registrations/my',
  eventController.getMyRegistrations
);

// Get my volunteer assignments - any authenticated user
router.get(
  '/volunteers/my',
  eventController.getMyVolunteerAssignments
);

// Get my volunteer activity (scan history) - any authenticated user
router.get(
  '/volunteers/my/activity',
  eventController.getMyVolunteerActivity
);

// Stall opportunities - MUST be before /:id (static before param)
const stallController = require('../controllers/stall.controller');
router.get('/stall-opportunities', stallController.getStallOpportunities);

// Event Settings: hierarchy data for UI - MUST be before /:id
const eventSettingsController = require('../controllers/eventSettings.controller');
const { validateEventSettingsUpdate } = require('../validators/eventSettings.validators');
router.get('/hierarchy/data', eventSettingsController.getHierarchyData);

// Get event by ID - any authenticated user can view published events
router.get(
  '/:id',
  validateEventId,
  eventController.getEvent
);

// Update event - require event_manage_own or event_manage_all
router.patch(
  '/:id',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  validateEventUpdate,
  eventController.updateEvent
);

// Publish event - require event_publish
router.post(
  '/:id/publish',
  validateEventId,
  checkPermission('event_publish', { checkDefaultPermissions: true }),
  validateEventPublish,
  eventController.publishEvent
);

// Register for event - any authenticated user (students can register)
router.post(
  '/:id/register',
  validateEventId,
  eventController.registerForEvent
);

// Get event statistics - require event_view_reports or event_manage_own
router.get(
  '/:id/statistics',
  validateEventId,
  checkAnyPermission(['event_view_reports', 'event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  eventController.getEventStatistics
);

// Get registration filter options (distinct values from actual registrations)
router.get(
  '/:id/registrations/filter-options',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  eventController.getRegistrationFilterOptions
);

// Get event registrations (for event creator) - require event_manage_own or event_manage_all
router.get(
  '/:id/registrations',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  eventController.getEventRegistrations
);

// Assign volunteer to event - require event_assign_volunteers
router.post(
  '/:id/volunteers',
  validateEventId,
  checkPermission('event_assign_volunteers', { checkDefaultPermissions: true }),
  validateVolunteerAssignment,
  eventController.assignVolunteer
);

// Get volunteer activity (event creator view) - must be before /:id/volunteers
router.get(
  '/:id/volunteers/:volunteerId/activity',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  eventController.getVolunteerActivity
);

// Get event volunteers - require event_manage_own or event_manage_all
router.get(
  '/:id/volunteers',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  eventController.getEventVolunteers
);

// Scan QR code for entry/exit - allow event_manage_attendance OR volunteer with canScanQr
router.post(
  '/:id/scan',
  validateEventId,
  allowEventScan,
  validateQRScan,
  eventController.scanQRCode
);

// Get event feedback (event creator only)
router.get(
  '/:id/feedback',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  feedbackController.getFeedback
);

// Authed: get stall feedback list (event creator only)
router.get(
  '/:id/stalls/:stallId/feedback',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  feedbackController.getStallFeedback
);

// Authed: stall owner views their own feedback (no special permission needed)
router.get(
  '/:id/stalls/:stallId/owner-feedback',
  validateEventId,
  feedbackController.getStallOwnerFeedback
);

// ============================================
// Advanced Registration Routes
// ============================================

const registrationController = require('../controllers/registration.controller');
const teamController = require('../controllers/team.controller');
const customFieldController = require('../controllers/customField.controller');
const prizeController = require('../controllers/prize.controller');

// Registration form routes
router.get('/profile-data', registrationController.getProfileData);
router.get('/registration-dashboard', registrationController.getRegistrationDashboard);

// Team management routes - get user's team for an event
router.get('/:id/my-team', teamController.getMyTeam);
router.get('/:id/invitations/my', teamController.getMyEventInvitations);
router.get('/:id/requests/my', teamController.getMyEventRequests);

// Team invitation/request responses (event-specific)
router.post('/:id/invitations/:invitationId/respond', teamController.respondToInvitation);
router.post('/:id/requests/:requestId/respond', teamController.respondToJoinRequest);

// Team management routes
// Static routes MUST come before parameterized :teamId routes
router.get('/:id/teams/looking-for-members', teamController.getTeamsLookingForMembers);
router.post('/:id/teams/:teamId/finalize', teamController.finalizeTeamRegistration);
router.get('/:id/teams/:teamId', teamController.getTeamDetails);
router.patch('/:id/teams/:teamId/looking-for-members', teamController.toggleTeamLookingForMembers);
router.post('/:id/teams/:teamId/invite', teamController.inviteToTeam);
router.post('/:id/teams/:teamId/request-join', teamController.requestToJoinTeam);
router.delete('/:id/teams/:teamId/members/:memberId', teamController.removeMemberFromTeam);
router.delete('/:id/teams/:teamId', teamController.cancelTeam);

// Event-specific advanced registration routes
router.get('/:id/registration-form', registrationController.getRegistrationForm);
router.post('/:id/register-with-form', registrationController.submitRegistrationForm);
router.get('/:id/registration-settings', customFieldController.getRegistrationSettings);
router.patch(
  '/:id/registration-settings',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  customFieldController.updateRegistrationSettings
);
router.get('/:id/custom-fields', customFieldController.getCustomFields);
router.post(
  '/:id/custom-fields',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  customFieldController.createCustomField
);
router.patch(
  '/:id/custom-fields/:fieldId',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  customFieldController.updateCustomField
);
router.delete(
  '/:id/custom-fields/:fieldId',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  customFieldController.deleteCustomField
);
router.patch(
  '/:id/custom-fields/reorder',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  customFieldController.reorderCustomFields
);

// ============================================
// Payment Routes (Individual)
// ============================================
router.post('/:id/payments/individual/create-order', paymentController.createIndividualOrder);
router.post('/:id/payments/individual/verify', paymentController.verifyIndividualPayment);
router.get('/:id/payments/status', paymentController.getPaymentStatus);

// ============================================
// Team Payment Routes
// ============================================
router.post('/:id/teams/:teamId/payments/create-order', paymentController.createTeamOrder);
router.post('/:id/teams/:teamId/payments/verify', paymentController.verifyTeamPayment);

// Team routes for specific event
router.post('/:id/teams', teamController.createTeam);
router.get('/:id/users-looking-for-teammates', teamController.getUsersLookingForTeammates);
router.get('/:id/search-users', teamController.searchUsersToInvite);
router.patch('/:id/looking-for-teammates', teamController.toggleLookingForTeammates);

// ============================================
// Prize Management Routes
// ============================================

// Get prizes for an event - any authenticated user
router.get('/:id/prizes', prizeController.getPrizes);

// Get specific prize
router.get('/:id/prizes/:prizeId', prizeController.getPrizeById);

// Create prize - require event management permission
router.post(
  '/:id/prizes',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  prizeController.createPrize
);

// Update prize
router.patch(
  '/:id/prizes/:prizeId',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  prizeController.updatePrize
);

// Delete prize
router.delete(
  '/:id/prizes/:prizeId',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  prizeController.deletePrize
);

// Bulk upsert prizes
router.post(
  '/:id/prizes/bulk',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  prizeController.bulkUpsertPrizes
);

// Reorder prizes
router.patch(
  '/:id/prizes/reorder',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  prizeController.reorderPrizes
);

// Toggle prizes enabled
router.patch(
  '/:id/prizes-enabled',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  prizeController.togglePrizesEnabled
);

// ============================================
// Stall Management Routes
// ============================================
// (stallController & /stall-opportunities defined above, before /:id)

// My application for a specific event
router.get('/:id/stall-applications/my', validateEventId, stallController.getMyStallApplication);

// Bulk update applications
router.patch(
  '/:id/stall-applications/bulk',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  stallController.bulkUpdateStallApplications
);

// Submit stall application (any authenticated user / student)
router.post('/:id/stall-applications', validateEventId, stallController.submitStallApplication);

// Get all applications for an event (creator only)
router.get(
  '/:id/stall-applications',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  stallController.getStallApplications
);

// Toggle stall application portal open/closed (must be before /:appId)
router.patch(
  '/:id/stall-applications/toggle-open',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  stallController.toggleStallApplications
);

// Approve / reject a specific application
router.patch(
  '/:id/stall-applications/:appId',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  stallController.updateStallApplication
);

// Get all stalls for event (creator view)
router.get(
  '/:id/stalls',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  stallController.getStalls
);

// Creator adds a stall directly
router.post(
  '/:id/stalls',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  stallController.createStall
);

// Creator updates a stall
router.patch(
  '/:id/stalls/:stallId',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  stallController.updateStall
);

// Creator deletes a stall
router.delete(
  '/:id/stalls/:stallId',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  stallController.deleteStall
);

// ============================================
// Event Settings / Visibility Routes
// ============================================
// (eventSettingsController & validateEventSettingsUpdate imported above, before /:id)

// Get event settings
router.get(
  '/:id/settings',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  eventSettingsController.getEventSettings
);

// Update event settings
router.put(
  '/:id/settings',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  validateEventSettingsUpdate,
  eventSettingsController.updateEventSettings
);

// Toggle event active status (ON/OFF)
router.patch(
  '/:id/settings/toggle-active',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  eventSettingsController.toggleEventActive
);

module.exports = router;
