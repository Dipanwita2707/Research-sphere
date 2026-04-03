/**
 * Team Management Routes
 *
 * Handles team creation, invitations, join requests, and team management
 * for team-based events.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const teamController = require('../controllers/team.controller');
const {
	validateEventId,
	validateTeamCreate,
	validateEventTeamParams,
	validateEventTeamMemberParams,
	validateTeamInvite,
	validateInvitationResponse,
	validateJoinRequestResponse,
	validateTeamRequestJoin,
	validateToggleLookingForTeammates,
	validateToggleTeamLookingForMembers,
} = require('../validators/event.validators');

// ── User-facing team routes ─────────────────────────────────────────

// Get user's team for an event
router.get('/:id/my-team', validateEventId, teamController.getMyTeam);
router.get('/:id/invitations/my', validateEventId, teamController.getMyEventInvitations);
router.get('/:id/requests/my', validateEventId, teamController.getMyEventRequests);

// Team invitation/request responses (event-specific)
router.post('/:id/invitations/:invitationId/respond', validateInvitationResponse, teamController.respondToInvitation);
router.post('/:id/requests/:requestId/respond', validateJoinRequestResponse, teamController.respondToJoinRequest);

// Static routes MUST come before parameterized :teamId routes
router.get('/:id/teams/looking-for-members', validateEventId, teamController.getTeamsLookingForMembers);
router.post('/:id/teams/:teamId/finalize', validateEventTeamParams, teamController.finalizeTeamRegistration);
router.get('/:id/teams/:teamId', validateEventTeamParams, teamController.getTeamDetails);
router.patch('/:id/teams/:teamId/looking-for-members', validateToggleTeamLookingForMembers, teamController.toggleTeamLookingForMembers);
router.post('/:id/teams/:teamId/invite', validateTeamInvite, teamController.inviteToTeam);
router.post('/:id/teams/:teamId/request-join', validateTeamRequestJoin, teamController.requestToJoinTeam);
router.delete('/:id/teams/:teamId/members/:memberId', validateEventTeamMemberParams, teamController.removeMemberFromTeam);
router.delete('/:id/teams/:teamId', validateEventTeamParams, teamController.cancelTeam);

// ── Team creation & discovery ───────────────────────────────────────

router.post('/:id/teams', validateTeamCreate, teamController.createTeam);
router.get('/:id/users-looking-for-teammates', validateEventId, teamController.getUsersLookingForTeammates);
router.get('/:id/search-users', validateEventId, teamController.searchUsersToInvite);
router.patch('/:id/looking-for-teammates', validateToggleLookingForTeammates, teamController.toggleLookingForTeammates);

module.exports = router;
