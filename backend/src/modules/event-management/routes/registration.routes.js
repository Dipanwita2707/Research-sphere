/**
 * Advanced Registration Routes
 * 
 * Routes for dynamic registration forms, teams, and advanced registration workflows
 */

const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registration.controller');
const teamController = require('../controllers/team.controller');
const { protect } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// ============================================
// Registration Form Routes
// ============================================

// Get user's profile data for auto-fill
router.get('/profile-data', registrationController.getProfileData);

// Get registration dashboard
router.get('/registration-dashboard', registrationController.getRegistrationDashboard);

// Get registration form for an event
router.get('/:id/registration-form', registrationController.getRegistrationForm);

// Submit registration form
router.post('/:id/register-with-form', registrationController.submitRegistrationForm);

// ============================================
// Team Management Routes
// ============================================

// Get user's pending invitations
router.get('/my-invitations', teamController.getMyInvitations);

// Get user's sent requests
router.get('/my-requests', teamController.getMyRequests);

// Response to team invitation
router.post('/invitations/:invitationId/respond', teamController.respondToInvitation);

// Respond to join request
router.post('/requests/:requestId/respond', teamController.respondToJoinRequest);

// Get team details
router.get('/teams/:teamId', teamController.getTeamDetails);

// Finalize/Submit team registration
router.post('/teams/:teamId/finalize', teamController.finalizeTeamRegistration);

// Toggle team looking for members
router.patch('/teams/:teamId/looking-for-members', teamController.toggleTeamLookingForMembers);

// Invite user to team
router.post('/teams/:teamId/invite', teamController.inviteToTeam);

// Request to join a team
router.post('/teams/:teamId/request-join', teamController.requestToJoinTeam);

// Remove member from team
router.delete('/teams/:teamId/members/:memberId', teamController.removeMemberFromTeam);

// Cancel team
router.delete('/teams/:teamId', teamController.cancelTeam);

// ============================================
// Event-specific Team Routes
// ============================================

// Create a team for an event
router.post('/:id/teams', teamController.createTeam);

// Get teams looking for members
router.get('/:id/teams/looking-for-members', teamController.getTeamsLookingForMembers);

// Get users looking for teammates
router.get('/:id/users-looking-for-teammates', teamController.getUsersLookingForTeammates);

// Search users to invite
router.get('/:id/search-users', teamController.searchUsersToInvite);

// Toggle looking for teammates
router.patch('/:id/looking-for-teammates', teamController.toggleLookingForTeammates);

module.exports = router;
