/**
 * Event Management Routes
 * 
 * Defines all API endpoints for event management
 * Uses centralized permission system from permissions.config.js
 */

const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const {
  validateEventUpdate,
  validateEventId,
  validateEventPublish,
  validateRegistration,
  validateQRScan,
  validateVolunteerAssignment,
  validateListQuery,
} = require('../validators/event.validators');
const { 
  protect, 
  checkPermission, 
  checkAnyPermission,
  requireEventPermission 
} = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

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

// Get event volunteers - require event_manage_own or event_manage_all
router.get(
  '/:id/volunteers',
  validateEventId,
  checkAnyPermission(['event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }),
  eventController.getEventVolunteers
);

// Scan QR code for entry/exit - require event_manage_attendance
router.post(
  '/:id/scan',
  validateEventId,
  checkPermission('event_manage_attendance', { checkDefaultPermissions: true }),
  validateQRScan,
  eventController.scanQRCode
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

module.exports = router;
