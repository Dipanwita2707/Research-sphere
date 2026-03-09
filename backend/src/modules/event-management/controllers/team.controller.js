/**
 * Team Management Controller
 * 
 * Handles HTTP requests for team-based event registration operations
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const prisma = require('../../../shared/config/database');
const teamService = require('../services/team.service');

/**
 * Create a new team
 * 
 * @route POST /api/events/:id/teams
 * @access Protected
 */
const createTeam = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { teamName } = req.body;
  
  if (!teamName || teamName.trim().length === 0) {
    return ApiResponse.error(res, 'Team name is required', 400);
  }
  
  const team = await teamService.createTeam(id, userId, teamName.trim());
  
  return ApiResponse.success(res, team, 'Team created successfully');
});

/**
 * Get team details
 * 
 * @route GET /api/events/teams/:teamId
 * @access Protected
 */
const getTeamDetails = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;
  
  const team = await teamService.getTeamDetails(teamId, userId);
  
  return ApiResponse.success(res, team, 'Team details fetched successfully');
});

/**
 * Get teams looking for members
 * 
 * @route GET /api/events/:id/teams/looking-for-members
 * @access Protected
 */
const getTeamsLookingForMembers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const teams = await teamService.getTeamsLookingForMembers(id, userId);
  
  return ApiResponse.success(res, teams, 'Teams fetched successfully');
});

/**
 * Get users looking for teammates
 * 
 * @route GET /api/events/:id/users-looking-for-teammates
 * @access Protected
 */
const getUsersLookingForTeammates = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const users = await teamService.getUsersLookingForTeammates(id, userId);
  
  return ApiResponse.success(res, users, 'Users fetched successfully');
});

/**
 * Search users to invite
 * 
 * @route GET /api/events/:id/search-users
 * @access Protected
 */
const searchUsersToInvite = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { q } = req.query;
  
  const users = await teamService.searchUsersToInvite(id, userId, q);
  
  return ApiResponse.success(res, users, 'Users fetched successfully');
});

/**
 * Invite user to team
 * 
 * @route POST /api/events/teams/:teamId/invite
 * @access Protected (Team Leader only)
 */
const inviteToTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;
  const { inviteeId, message } = req.body;
  
  if (!inviteeId) {
    return ApiResponse.error(res, 'Invitee ID is required', 400);
  }
  
  const invitation = await teamService.inviteToTeam(teamId, userId, inviteeId, message);
  
  return ApiResponse.success(res, invitation, 'Invitation sent successfully');
});

/**
 * Respond to team invitation
 * 
 * @route POST /api/events/invitations/:invitationId/respond
 * @access Protected
 */
const respondToInvitation = asyncHandler(async (req, res) => {
  const { invitationId } = req.params;
  const userId = req.user.id;
  const { accept } = req.body;
  
  const result = await teamService.respondToInvitation(invitationId, userId, accept);
  
  return ApiResponse.success(res, result, result.message);
});

/**
 * Request to join a team
 * 
 * @route POST /api/events/teams/:teamId/request-join
 * @access Protected
 */
const requestToJoinTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;
  const { message } = req.body;
  
  const request = await teamService.requestToJoinTeam(teamId, userId, message);
  
  return ApiResponse.success(res, request, 'Join request sent successfully');
});

/**
 * Respond to join request (team leader)
 * 
 * @route POST /api/events/requests/:requestId/respond
 * @access Protected (Team Leader only)
 */
const respondToJoinRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user.id;
  const { accept } = req.body;
  
  const result = await teamService.respondToJoinRequest(requestId, userId, accept);
  
  return ApiResponse.success(res, result, result.message);
});

/**
 * Toggle looking for teammates
 * 
 * @route PATCH /api/events/:id/looking-for-teammates
 * @access Protected
 */
const toggleLookingForTeammates = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { looking } = req.body;
  
  const result = await teamService.toggleLookingForTeammates(id, userId, looking);
  
  return ApiResponse.success(res, result, 'Setting updated successfully');
});

/**
 * Toggle team looking for members
 * 
 * @route PATCH /api/events/teams/:teamId/looking-for-members
 * @access Protected (Team Leader only)
 */
const toggleTeamLookingForMembers = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;
  const { looking } = req.body;
  
  const result = await teamService.toggleTeamLookingForMembers(teamId, userId, looking);
  
  return ApiResponse.success(res, result, 'Setting updated successfully');
});

/**
 * Remove member from team
 * 
 * @route DELETE /api/events/teams/:teamId/members/:memberId
 * @access Protected (Team Leader or self)
 */
const removeMemberFromTeam = asyncHandler(async (req, res) => {
  const { teamId, memberId } = req.params;
  const userId = req.user.id;
  
  const result = await teamService.removeMemberFromTeam(teamId, memberId, userId);
  
  return ApiResponse.success(res, result, result.message);
});

/**
 * Cancel team
 * 
 * @route DELETE /api/events/teams/:teamId
 * @access Protected (Team Leader only)
 */
const cancelTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;
  
  const result = await teamService.cancelTeam(teamId, userId);
  
  return ApiResponse.success(res, result, result.message);
});

/**
 * Get user's pending invitations
 * 
 * @route GET /api/events/my-invitations
 * @access Protected
 */
const getMyInvitations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const invitations = await require('../../../shared/config/database').eventTeamInvitation.findMany({
    where: {
      inviteeId: userId,
      status: 'pending',
    },
    include: {
      EventTeam: {
        include: {
          Event: {
            select: {
              id: true,
              eventId: true,
              name: true,
              minTeamSize: true,
              maxTeamSize: true,
            },
          },
          EventTeamMember: {
            where: { status: 'confirmed' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  return ApiResponse.success(res, invitations, 'Invitations fetched successfully');
});

/**
 * Get user's sent requests
 * 
 * @route GET /api/events/my-requests
 * @access Protected
 */
const getMyRequests = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const requests = await require('../../../shared/config/database').eventTeamRequest.findMany({
    where: {
      requesterId: userId,
      status: 'pending',
    },
    include: {
      EventTeam: {
        include: {
          Event: {
            select: {
              id: true,
              eventId: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  return ApiResponse.success(res, requests, 'Requests fetched successfully');
});

/**
 * Get user's team for a specific event
 * 
 * @route GET /api/events/:id/my-team
 * @access Protected
 */
const getMyTeam = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  const team = await teamService.getUserTeamForEvent(id, userId);
  
  return ApiResponse.success(res, team, 'Team fetched successfully');
});

/**
 * Get user's invitations for a specific event
 * 
 * @route GET /api/events/:id/invitations/my
 * @access Protected
 */
const getMyEventInvitations = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Get received invitations
  const received = await prisma.eventTeamInvitation.findMany({
    where: {
      inviteeId: userId,
      EventTeam: {
        eventId: id,
      },
    },
    include: {
      inviter: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
          studentLogin: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
      EventTeam: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  // Get sent invitations (if user is team leader)
  const sent = await prisma.eventTeamInvitation.findMany({
    where: {
      inviterId: userId,
      EventTeam: {
        eventId: id,
      },
    },
    include: {
      invitee: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
          studentLogin: { select: { firstName: true, lastName: true, displayName: true } },
        },
      },
      EventTeam: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  const flattenUser = (user) => {
    if (!user) return null;
    const profile = user.studentLogin || user.employeeDetails;
    return {
      id: user.id,
      uid: user.uid,
      email: user.email,
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      displayName: profile?.displayName || profile?.firstName || '',
    };
  };

  const formattedReceived = received.map(inv => ({
    ...inv,
    inviter: flattenUser(inv.inviter),
  }));

  const formattedSent = sent.map(inv => ({
    ...inv,
    invitee: flattenUser(inv.invitee),
  }));

  return ApiResponse.success(res, { received: formattedReceived, sent: formattedSent }, 'Invitations fetched successfully');
});

/**
 * Get user's requests for a specific event
 * 
 * @route GET /api/events/:id/requests/my
 * @access Protected
 */
const getMyEventRequests = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  // Get sent requests (requests made by the user)
  const sent = await prisma.eventTeamRequest.findMany({
    where: {
      requesterId: userId,
      EventTeam: {
        eventId: id,
      },
    },
    include: {
      EventTeam: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  // Get received requests (if user is team leader)
  const userTeam = await prisma.eventTeamMember.findFirst({
    where: {
      userId: userId,
      role: 'leader',
      EventTeam: {
        eventId: id,
      },
    },
    select: {
      teamId: true,
    },
  });
  
  let received = [];
  if (userTeam) {
    received = await prisma.eventTeamRequest.findMany({
      where: {
        teamId: userTeam.teamId,
      },
      include: {
        requester: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
            studentLogin: { select: { firstName: true, lastName: true, displayName: true } },
          },
        },
        EventTeam: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  
  const formattedReceived = received.map(req => ({
    ...req,
    requester: (() => {
      if (!req.requester) return null;
      const profile = req.requester.studentLogin || req.requester.employeeDetails;
      return {
        id: req.requester.id,
        uid: req.requester.uid,
        email: req.requester.email,
        firstName: profile?.firstName || '',
        lastName: profile?.lastName || '',
        displayName: profile?.displayName || profile?.firstName || '',
      };
    })(),
  }));

  return ApiResponse.success(res, { received: formattedReceived, sent }, 'Requests fetched successfully');
});

/**
 * Finalize/Submit team registration
 * 
 * @route POST /api/events/teams/:teamId/finalize
 * @access Protected (Team Leader only)
 */
const finalizeTeamRegistration = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;
  
  const team = await teamService.finalizeTeamRegistration(teamId, userId);
  
  return ApiResponse.success(res, team, 'Team registration completed successfully');
});

module.exports = {
  createTeam,
  getTeamDetails,
  getTeamsLookingForMembers,
  getUsersLookingForTeammates,
  searchUsersToInvite,
  inviteToTeam,
  respondToInvitation,
  requestToJoinTeam,
  respondToJoinRequest,
  toggleLookingForTeammates,
  toggleTeamLookingForMembers,
  removeMemberFromTeam,
  cancelTeam,
  getMyInvitations,
  getMyRequests,
  getMyTeam,
  getMyEventInvitations,
  getMyEventRequests,
  finalizeTeamRegistration,
};
