/**
 * Team Management Routes
 *
 * Handles team creation, invitations, join requests, and team management
 * for team-based events.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const teamController = require('../controllers/team.controller');

// ── User-facing team routes ─────────────────────────────────────────

// Get user's team for an event
router.get('/:id/my-team', teamController.getMyTeam);
router.get('/:id/invitations/my', teamController.getMyEventInvitations);
router.get('/:id/requests/my', teamController.getMyEventRequests);

// Team invitation/request responses (event-specific)
router.post('/:id/invitations/:invitationId/respond', teamController.respondToInvitation);
router.post('/:id/requests/:requestId/respond', teamController.respondToJoinRequest);

// Static routes MUST come before parameterized :teamId routes
router.get('/:id/teams/looking-for-members', teamController.getTeamsLookingForMembers);
router.post('/:id/teams/:teamId/finalize', teamController.finalizeTeamRegistration);
router.get('/:id/teams/:teamId', teamController.getTeamDetails);
router.patch('/:id/teams/:teamId/looking-for-members', teamController.toggleTeamLookingForMembers);
router.post('/:id/teams/:teamId/invite', teamController.inviteToTeam);
router.post('/:id/teams/:teamId/request-join', teamController.requestToJoinTeam);
router.delete('/:id/teams/:teamId/members/:memberId', teamController.removeMemberFromTeam);
router.delete('/:id/teams/:teamId', teamController.cancelTeam);

// ── Team creation & discovery ───────────────────────────────────────

router.post('/:id/teams', teamController.createTeam);
router.get('/:id/users-looking-for-teammates', teamController.getUsersLookingForTeammates);
router.get('/:id/search-users', teamController.searchUsersToInvite);
router.patch('/:id/looking-for-teammates', teamController.toggleLookingForTeammates);

module.exports = router;
