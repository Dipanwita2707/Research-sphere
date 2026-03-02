/**
 * Event Team Management Service
 * 
 * Handles team creation, invitations, join requests, and team management for team-based events
 */

const prisma = require('../../../shared/config/database');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const crypto = require('crypto');
const { generateQRCode } = require('../utils/qrCodeGenerator');

const TEAM_STATUS = {
  FORMING: 'forming',
  COMPLETE: 'complete',
  CONFIRMED: 'confirmed',
  DISQUALIFIED: 'disqualified',
  WITHDRAWN: 'withdrawn',
};

const MEMBER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REMOVED: 'removed',
  LEFT: 'left',
};

const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

const REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

/**
 * Generate unique team ID
 */
const generateTeamId = async (eventId) => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `TM-${timestamp}-${random}`.toUpperCase();
};

/**
 * Create a new team
 */
const createTeam = async (eventId, userId, teamName) => {
  // Get event
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  if (event.participationType !== 'team') {
    throw new ValidationError('This event does not support team registration');
  }

  // Check if user already has a team for this event
  const existingTeamMembership = await prisma.eventTeamMember.findFirst({
    where: {
      EventTeam: {
        eventId: event.id,
      },
      userId: userId,
      status: 'confirmed',
    },
  });

  if (existingTeamMembership) {
    throw new ValidationError('You are already part of a team for this event');
  }

  // Check if user has registered
  const registration = await prisma.eventRegistration.findFirst({
    where: {
      eventId: event.id,
      userId: userId,
    },
  });

  if (!registration) {
    throw new ValidationError('Please complete the registration form first');
  }

  // Check max team limit for event
  if (event.maxTeamLimit) {
    const teamCount = await prisma.eventTeam.count({
      where: {
        eventId: event.id,
        status: {
          notIn: ['withdrawn', 'disqualified'],
        },
      },
    });
    if (teamCount >= event.maxTeamLimit) {
      throw new ValidationError('Maximum number of teams for this event has been reached');
    }
  }

  // Check if team name is unique for this event
  const existingTeam = await prisma.eventTeam.findFirst({
    where: {
      eventId: event.id,
      name: {
        equals: teamName,
        mode: 'insensitive',
      },
    },
  });

  if (existingTeam) {
    throw new ValidationError('A team with this name already exists for this event');
  }

  // Generate team ID
  const teamId = await generateTeamId(event.id);

  // Check if minimum team size is met with just the leader
  const minTeamSize = event.minTeamSize || 1;
  const meetsMinimumRequirement = minTeamSize === 1;
  // For paid events, even if min size is met, don't auto-confirm — payment is required first
  const isPaidEvent = event.paymentType === 'paid';
  const shouldAutoComplete = meetsMinimumRequirement && !isPaidEvent;

  // Team should be visible (looking for members) if it can still accept more members
  const maxTeamSize = event.maxTeamSize || 999;
  const canAcceptMoreMembers = maxTeamSize > 1; // leader counts as 1 member

  // Create team and add creator as leader
  const team = await prisma.$transaction(async (tx) => {
    // Create team
    const newTeam = await tx.eventTeam.create({
      data: {
        eventId: event.id,
        teamId: teamId,
        name: teamName,
        leaderId: userId,
        status: meetsMinimumRequirement ? 'complete' : 'forming',
        lookingForMembers: canAcceptMoreMembers,
        isComplete: meetsMinimumRequirement,
        isLocked: false,
      },
    });

    // Add creator as team leader
    await tx.eventTeamMember.create({
      data: {
        teamId: newTeam.id,
        userId: userId,
        role: 'leader',
        status: 'confirmed',
      },
    });

    // Update registration with team info
    // For paid events: set to 'pending' (awaiting payment) even if team is complete
    // For free events: set to 'confirmed' if team meets min size, else 'incomplete_team'
    const regStatus = shouldAutoComplete
      ? 'confirmed'
      : meetsMinimumRequirement && isPaidEvent
        ? 'pending'
        : 'incomplete_team';

    await tx.eventRegistration.update({
      where: { id: registration.id },
      data: {
        teamId: newTeam.id,
        isTeamLeader: true,
        status: regStatus,
        paymentStatus: isPaidEvent ? 'pending' : undefined,
        updatedAt: new Date(),
      },
    });

    return newTeam;
  });

  // Get full team data
  return getTeamDetails(team.id, userId);
};

/**
 * Get team details
 */
const getTeamDetails = async (teamId, userId) => {
  const team = await prisma.eventTeam.findFirst({
    where: {
      OR: [
        { id: teamId },
        { teamId: teamId },
      ],
    },
    include: {
      Event: {
        select: {
          id: true,
          eventId: true,
          name: true,
          minTeamSize: true,
          maxTeamSize: true,
          interCollegeAllowed: true,
          teamRegistrationDeadline: true,
          paymentType: true,
          registrationFee: true,
          teamRegistrationFee: true,
        },
      },
      EventTeamMember: {
        where: { status: 'confirmed' },
        include: {
          // We can't directly include user data here since userId is just a string
          // We'll need to fetch it separately
        },
      },
      EventTeamInvitation: {
        where: { status: 'pending' },
      },
      EventTeamRequest: {
        where: { status: 'pending' },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  // Fetch member details
  const memberIds = team.EventTeamMember.map(m => m.userId);
  const memberUsers = await prisma.userLogin.findMany({
    where: { id: { in: memberIds } },
    select: {
      id: true,
      uid: true,
      email: true,
      phone: true,
      studentLogin: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          registrationNo: true,
        },
      },
      employeeDetails: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
        },
      },
    },
  });

  const memberMap = new Map(memberUsers.map(u => [u.id, u]));

  const members = team.EventTeamMember.map(member => {
    const user = memberMap.get(member.userId);
    const profile = user?.studentLogin || user?.employeeDetails;
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
      name: profile?.displayName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim(),
      email: user?.email,
      phone: user?.phone,
      uid: user?.uid,
    };
  });

  // Check if current user is team leader
  const isLeader = team.leaderId === userId;

  // Calculate team completion - use database value as source of truth
  const confirmedMemberCount = members.length;
  // Check if team meets minimum requirements (for UI display)
  const meetsMinimumRequirement = team.Event.minTeamSize ? confirmedMemberCount >= team.Event.minTeamSize : true;

  // Fetch the requesting user's own EventRegistration so each member sees their own QR
  let myRegistration = null;
  if (userId) {
    myRegistration = await prisma.eventRegistration.findFirst({
      where: { eventId: team.eventId, userId },
      select: {
        id: true,
        registrationId: true,
        status: true,
        paymentStatus: true,
        qrCode: true,
        amountPaid: true,
        isTeamLeader: true,
      },
    });
  }

  return {
    id: team.id,
    teamId: team.teamId,
    name: team.name,
    status: team.status,
    lookingForMembers: team.lookingForMembers,
    isComplete: team.isComplete, // Use database value
    meetsMinimumRequirement, // Add this for frontend to check if can finalize
    isLocked: team.isLocked,
    leaderId: team.leaderId,
    isLeader,
    event: team.Event,
    members,
    myRegistration, // Each user's own registration (with their unique QR code)
    memberCount: {
      current: confirmedMemberCount,
      min: team.Event.minTeamSize,
      max: team.Event.maxTeamSize,
    },
    pendingInvitations: isLeader ? team.EventTeamInvitation : [],
    pendingRequests: isLeader ? team.EventTeamRequest : [],
    createdAt: team.createdAt,
  };
};

/**
 * Search for users to invite (past teammates, suggested users from same institute)
 */
const searchUsersToInvite = async (eventId, userId, searchQuery) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Get current user's info
  const currentUser = await prisma.userLogin.findUnique({
    where: { id: userId },
    include: {
      studentLogin: {
        include: { program: true },
      },
      employeeDetails: {
        include: { primaryDepartment: true },
      },
    },
  });

  // Get user's current team for this event
  const currentTeam = await prisma.eventTeamMember.findFirst({
    where: {
      EventTeam: { eventId: event.id },
      userId: userId,
      status: 'confirmed',
    },
    include: { EventTeam: true },
  });

  // Search for users
  const whereClause = {
    id: { not: userId }, // Exclude self
    status: 'active',
  };

  // Add search conditions
  if (searchQuery) {
    whereClause.OR = [
      { uid: { contains: searchQuery, mode: 'insensitive' } },
      { email: { contains: searchQuery, mode: 'insensitive' } },
      {
        studentLogin: {
          OR: [
            { firstName: { contains: searchQuery, mode: 'insensitive' } },
            { lastName: { contains: searchQuery, mode: 'insensitive' } },
            { registrationNo: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
      },
      {
        employeeDetails: {
          OR: [
            { firstName: { contains: searchQuery, mode: 'insensitive' } },
            { lastName: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
      },
    ];
  }

  const users = await prisma.userLogin.findMany({
    where: whereClause,
    select: {
      id: true,
      uid: true,
      email: true,
      studentLogin: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          registrationNo: true,
          program: {
            select: {
              programName: true,
              department: {
                select: {
                  departmentName: true,
                  faculty: {
                    select: { facultyName: true },
                  },
                },
              },
            },
          },
        },
      },
      employeeDetails: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          primaryDepartment: {
            select: { departmentName: true },
          },
          primarySchool: {
            select: { facultyName: true },
          },
        },
      },
    },
    take: 20,
  });

  // Filter out users who are already in a team for this event
  const existingTeamMembers = await prisma.eventTeamMember.findMany({
    where: {
      EventTeam: { eventId: event.id },
      userId: { in: users.map(u => u.id) },
      status: 'confirmed',
    },
    select: { userId: true },
  });

  const existingMemberIds = new Set(existingTeamMembers.map(m => m.userId));

  // Filter out users who already have pending invitations from current team
  let pendingInviteeIds = new Set();
  if (currentTeam) {
    const pendingInvitations = await prisma.eventTeamInvitation.findMany({
      where: {
        teamId: currentTeam.EventTeam.id,
        status: 'pending',
      },
      select: { inviteeId: true },
    });
    pendingInviteeIds = new Set(pendingInvitations.map(i => i.inviteeId));
  }

  const availableUsers = users
    .filter(u => !existingMemberIds.has(u.id) && !pendingInviteeIds.has(u.id))
    .map(user => {
      const profile = user.studentLogin || user.employeeDetails;
      return {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: profile?.displayName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim(),
        institute: profile?.program?.department?.faculty?.facultyName || profile?.primarySchool?.facultyName || 'SGT University',
        department: profile?.program?.department?.departmentName || profile?.primaryDepartment?.departmentName,
        program: user.studentLogin?.program?.programName,
        userType: user.studentLogin ? 'student' : 'employee',
      };
    });

  return availableUsers;
};

/**
 * Invite a user to join team
 */
const inviteToTeam = async (teamId, inviterId, inviteeId, message) => {
  const team = await prisma.eventTeam.findFirst({
    where: {
      OR: [
        { id: teamId },
        { teamId: teamId },
      ],
    },
    include: {
      Event: true,
      EventTeamMember: {
        where: { status: 'confirmed' },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  // Verify inviter is team leader
  if (team.leaderId !== inviterId) {
    throw new ForbiddenError('Only the team leader can send invitations');
  }

  // Check if team is locked
  if (team.isLocked) {
    throw new ValidationError('Team is locked and cannot accept new members');
  }

  // Check team size limit
  if (team.Event.maxTeamSize && team.EventTeamMember.length >= team.Event.maxTeamSize) {
    throw new ValidationError('Team is already at maximum capacity');
  }

  // Check if invitee is already in a team for this event
  const existingMembership = await prisma.eventTeamMember.findFirst({
    where: {
      EventTeam: { eventId: team.eventId },
      userId: inviteeId,
      status: 'confirmed',
    },
  });

  if (existingMembership) {
    throw new ValidationError('User is already in a team for this event');
  }

  // Check for existing pending invitation
  const existingInvitation = await prisma.eventTeamInvitation.findFirst({
    where: {
      teamId: team.id,
      inviteeId: inviteeId,
      status: 'pending',
    },
  });

  if (existingInvitation) {
    throw new ValidationError('An invitation has already been sent to this user');
  }

  // Create invitation
  const invitation = await prisma.eventTeamInvitation.create({
    data: {
      teamId: team.id,
      inviterId: inviterId,
      inviteeId: inviteeId,
      status: 'pending',
      message: message,
      expiresAt: team.Event.teamRegistrationDeadline || team.Event.registrationEndDate,
    },
  });

  // TODO: Send notification to invitee

  return invitation;
};

/**
 * Respond to team invitation
 */
const respondToInvitation = async (invitationId, userId, accept) => {
  const invitation = await prisma.eventTeamInvitation.findUnique({
    where: { id: invitationId },
    include: {
      EventTeam: {
        include: {
          Event: true,
          EventTeamMember: {
            where: { status: 'confirmed' },
          },
        },
      },
    },
  });

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  if (invitation.inviteeId !== userId) {
    throw new ForbiddenError('This invitation is not for you');
  }

  if (invitation.status !== 'pending') {
    throw new ValidationError('This invitation is no longer pending');
  }

  // Check if invitation expired
  if (invitation.expiresAt && new Date() > new Date(invitation.expiresAt)) {
    await prisma.eventTeamInvitation.update({
      where: { id: invitationId },
      data: { status: 'expired' },
    });
    throw new ValidationError('This invitation has expired');
  }

  if (!accept) {
    // Decline invitation
    await prisma.eventTeamInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'declined',
        respondedAt: new Date(),
      },
    });
    return { message: 'Invitation declined' };
  }

  // Accept invitation
  const team = invitation.EventTeam;

  // Check if team is locked
  if (team.isLocked) {
    throw new ValidationError('Team is locked and cannot accept new members');
  }

  // Check team size
  if (team.Event.maxTeamSize && team.EventTeamMember.length >= team.Event.maxTeamSize) {
    throw new ValidationError('Team is already at maximum capacity');
  }

  // Check if user is already in a team
  const existingMembership = await prisma.eventTeamMember.findFirst({
    where: {
      EventTeam: { eventId: team.eventId },
      userId: userId,
      status: 'confirmed',
    },
  });

  if (existingMembership) {
    throw new ValidationError('You are already in a team for this event');
  }

  // Accept and add to team
  await prisma.$transaction(async (tx) => {
    // Update invitation
    await tx.eventTeamInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'accepted',
        respondedAt: new Date(),
      },
    });

    // Add as team member
    await tx.eventTeamMember.create({
      data: {
        teamId: team.id,
        userId: userId,
        role: 'member',
        status: 'confirmed',
      },
    });

    // Create or update registration for this user
    const existingReg = await tx.eventRegistration.findFirst({
      where: {
        eventId: team.eventId,
        userId: userId,
      },
    });

    if (existingReg) {
      await tx.eventRegistration.update({
        where: { id: existingReg.id },
        data: {
          teamId: team.id,
          isTeamLeader: false,
          status: 'incomplete_team',
          paymentStatus: team.Event.paymentType === 'paid' ? 'pending' : null,
          updatedAt: new Date(),
        },
      });
    } else {
      // Member has no prior registration — create one now so they get their own QR code
      const qrCode = generateQRCode(team.Event.eventId || team.eventId, userId);
      const regCount = await tx.eventRegistration.count({ where: { eventId: team.eventId } });
      const registrationId = `REG-${(team.Event.eventId || team.eventId).substring(0, 8).toUpperCase()}-${(regCount + 1).toString().padStart(4, '0')}`;
      await tx.eventRegistration.create({
        data: {
          id: crypto.randomUUID(),
          registrationId,
          eventId: team.eventId,
          userId,
          teamId: team.id,
          isTeamLeader: false,
          status: 'incomplete_team',
          paymentStatus: team.Event.paymentType === 'paid' ? 'pending' : null,
          qrCode,
          updatedAt: new Date(),
        },
      });
    }

    // Check and update team completion status
    const newMemberCount = team.EventTeamMember.length + 1;
    const isComplete = team.Event.minTeamSize ? newMemberCount >= team.Event.minTeamSize : true;

    if (isComplete) {
      await tx.eventTeam.update({
        where: { id: team.id },
        data: {
          isComplete: true,
          status: 'complete',
        },
      });

      // For paid events: set to 'pending' (awaiting payment), not 'confirmed'
      if (team.Event.paymentType === 'paid') {
        await tx.eventRegistration.updateMany({
          where: {
            teamId: team.id,
            status: { in: ['incomplete_team'] },
          },
          data: {
            status: 'pending',
            paymentStatus: 'pending',
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.eventRegistration.updateMany({
          where: { teamId: team.id },
          data: {
            status: 'confirmed',
            updatedAt: new Date(),
          },
        });
      }
    }

    // Cancel invitations to this user from other teams
    await tx.eventTeamInvitation.updateMany({
      where: {
        inviteeId: userId,
        EventTeam: { eventId: team.eventId },
        status: 'pending',
        id: { not: invitationId },
      },
      data: {
        status: 'cancelled',
        respondedAt: new Date(),
      },
    });

    // Cancel any requests this user sent
    await tx.eventTeamRequest.updateMany({
      where: {
        requesterId: userId,
        EventTeam: { eventId: team.eventId },
        status: 'pending',
      },
      data: {
        status: 'cancelled',
        respondedAt: new Date(),
      },
    });
  });

  return { message: 'Invitation accepted. You are now part of the team!' };
};

/**
 * Request to join a team
 */
const requestToJoinTeam = async (teamId, userId, message) => {
  const team = await prisma.eventTeam.findFirst({
    where: {
      OR: [
        { id: teamId },
        { teamId: teamId },
      ],
    },
    include: {
      Event: true,
      EventTeamMember: {
        where: { status: 'confirmed' },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  if (!team.lookingForMembers) {
    throw new ValidationError('This team is not looking for new members');
  }

  if (team.isLocked) {
    throw new ValidationError('This team is locked');
  }

  // Check team capacity
  if (team.Event.maxTeamSize && team.EventTeamMember.length >= team.Event.maxTeamSize) {
    throw new ValidationError('Team is at maximum capacity');
  }

  // Check if user is already in a team
  const existingMembership = await prisma.eventTeamMember.findFirst({
    where: {
      EventTeam: { eventId: team.eventId },
      userId: userId,
      status: 'confirmed',
    },
  });

  if (existingMembership) {
    throw new ValidationError('You are already in a team for this event');
  }

  // Check for existing pending request
  const existingRequest = await prisma.eventTeamRequest.findFirst({
    where: {
      teamId: team.id,
      requesterId: userId,
      status: 'pending',
    },
  });

  if (existingRequest) {
    throw new ValidationError('You have already sent a request to this team');
  }

  // Create request
  const request = await prisma.eventTeamRequest.create({
    data: {
      teamId: team.id,
      requesterId: userId,
      status: 'pending',
      message: message,
    },
  });

  // TODO: Send notification to team leader

  return request;
};

/**
 * Respond to join request (team leader)
 */
const respondToJoinRequest = async (requestId, leaderId, accept) => {
  const request = await prisma.eventTeamRequest.findUnique({
    where: { id: requestId },
    include: {
      EventTeam: {
        include: {
          Event: true,
          EventTeamMember: {
            where: { status: 'confirmed' },
          },
        },
      },
    },
  });

  if (!request) {
    throw new NotFoundError('Request not found');
  }

  if (request.EventTeam.leaderId !== leaderId) {
    throw new ForbiddenError('Only the team leader can respond to join requests');
  }

  if (request.status !== 'pending') {
    throw new ValidationError('This request is no longer pending');
  }

  const team = request.EventTeam;

  if (!accept) {
    await prisma.eventTeamRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        respondedById: leaderId,
        respondedAt: new Date(),
      },
    });
    return { message: 'Request rejected' };
  }

  // Check team capacity
  if (team.Event.maxTeamSize && team.EventTeamMember.length >= team.Event.maxTeamSize) {
    throw new ValidationError('Team is at maximum capacity');
  }

  // Check if requester is already in another team
  const existingMembership = await prisma.eventTeamMember.findFirst({
    where: {
      EventTeam: { eventId: team.eventId },
      userId: request.requesterId,
      status: 'confirmed',
    },
  });

  if (existingMembership) {
    throw new ValidationError('User is already in a team for this event');
  }

  // Accept and add to team
  await prisma.$transaction(async (tx) => {
    // Update request
    await tx.eventTeamRequest.update({
      where: { id: requestId },
      data: {
        status: 'accepted',
        respondedById: leaderId,
        respondedAt: new Date(),
      },
    });

    // Add as team member
    await tx.eventTeamMember.create({
      data: {
        teamId: team.id,
        userId: request.requesterId,
        role: 'member',
        status: 'confirmed',
      },
    });

    // Update user's registration
    const existingReg = await tx.eventRegistration.findFirst({
      where: {
        eventId: team.eventId,
        userId: request.requesterId,
      },
    });

    if (existingReg) {
      await tx.eventRegistration.update({
        where: { id: existingReg.id },
        data: {
          teamId: team.id,
          isTeamLeader: false,
          status: 'incomplete_team',
          paymentStatus: team.Event.paymentType === 'paid' ? 'pending' : null,
          updatedAt: new Date(),
        },
      });
    } else {
      // Member has no prior registration — create one now so they get their own QR code
      const qrCode = generateQRCode(team.Event.eventId || team.eventId, request.requesterId);
      const regCount = await tx.eventRegistration.count({ where: { eventId: team.eventId } });
      const registrationId = `REG-${(team.Event.eventId || team.eventId).substring(0, 8).toUpperCase()}-${(regCount + 1).toString().padStart(4, '0')}`;
      await tx.eventRegistration.create({
        data: {
          id: crypto.randomUUID(),
          registrationId,
          eventId: team.eventId,
          userId: request.requesterId,
          teamId: team.id,
          isTeamLeader: false,
          status: 'incomplete_team',
          paymentStatus: team.Event.paymentType === 'paid' ? 'pending' : null,
          qrCode,
          updatedAt: new Date(),
        },
      });
    }

    // Check and update team completion status
    const newMemberCount = team.EventTeamMember.length + 1;
    const isComplete = team.Event.minTeamSize ? newMemberCount >= team.Event.minTeamSize : true;

    if (isComplete) {
      await tx.eventTeam.update({
        where: { id: team.id },
        data: {
          isComplete: true,
          status: 'complete',
        },
      });

      // For paid events: set to 'pending' (awaiting payment), not 'confirmed'
      if (team.Event.paymentType === 'paid') {
        await tx.eventRegistration.updateMany({
          where: {
            teamId: team.id,
            status: { in: ['incomplete_team'] },
          },
          data: {
            status: 'pending',
            paymentStatus: 'pending',
            updatedAt: new Date(),
          },
        });
      } else {
        await tx.eventRegistration.updateMany({
          where: { teamId: team.id },
          data: {
            status: 'confirmed',
            updatedAt: new Date(),
          },
        });
      }
    }

    // Cancel other pending requests from this user
    await tx.eventTeamRequest.updateMany({
      where: {
        requesterId: request.requesterId,
        EventTeam: { eventId: team.eventId },
        status: 'pending',
        id: { not: requestId },
      },
      data: {
        status: 'cancelled',
        respondedAt: new Date(),
      },
    });
  });

  return { message: 'Request accepted. User added to team!' };
};

/**
 * Get teams looking for members
 */
const getTeamsLookingForMembers = async (eventId, userId) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const teams = await prisma.eventTeam.findMany({
    where: {
      eventId: event.id,
      lookingForMembers: true,
      isLocked: false,
      status: {
        in: ['forming', 'complete'],
      },
    },
    include: {
      EventTeamMember: {
        where: { status: 'confirmed' },
      },
      Event: {
        select: {
          minTeamSize: true,
          maxTeamSize: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Check if user has already sent requests
  const sentRequests = await prisma.eventTeamRequest.findMany({
    where: {
      requesterId: userId,
      EventTeam: { eventId: event.id },
      status: 'pending',
    },
    select: { teamId: true },
  });

  const requestedTeamIds = new Set(sentRequests.map(r => r.teamId));

  // Get leader information for each team
  const leaderIds = [...new Set(teams.map(t => t.leaderId))];
  const leaders = await prisma.userLogin.findMany({
    where: { id: { in: leaderIds } },
    select: {
      id: true,
      studentLogin: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          program: {
            select: {
              department: {
                select: {
                  faculty: { select: { facultyName: true } },
                },
              },
            },
          },
        },
      },
      employeeDetails: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          primarySchool: { select: { facultyName: true } },
        },
      },
    },
  });

  const leaderMap = new Map(leaders.map(l => [l.id, l]));

  return teams
    .filter(team => {
      // Filter out teams at capacity
      if (team.Event.maxTeamSize && team.EventTeamMember.length >= team.Event.maxTeamSize) {
        return false;
      }
      return true;
    })
    .map(team => {
      const leader = leaderMap.get(team.leaderId);
      const leaderProfile = leader?.studentLogin || leader?.employeeDetails;
      
      return {
        id: team.id,
        teamId: team.teamId,
        name: team.name,
        status: team.status,
        createdAt: team.createdAt,
        memberCount: {
          current: team.EventTeamMember.length,
          min: team.Event.minTeamSize,
          max: team.Event.maxTeamSize,
        },
        leader: {
          name: leaderProfile?.displayName || `${leaderProfile?.firstName || ''} ${leaderProfile?.lastName || ''}`.trim(),
          institute: leaderProfile?.program?.department?.school?.name || leaderProfile?.primarySchool?.name || 'SGT University',
        },
        hasRequestPending: requestedTeamIds.has(team.id),
      };
    });
};

/**
 * Get users looking for teammates
 */
const getUsersLookingForTeammates = async (eventId, userId) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: {
      eventId: event.id,
      lookingForTeammates: true,
      teamId: null, // Not part of a team yet
      userId: { not: userId },
    },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          studentLogin: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              program: {
                select: {
                  name: true,
                  department: {
                    select: {
                      name: true,
                      faculty: { select: { facultyName: true } },
                    },
                  },
                },
              },
            },
          },
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              primarySchool: { select: { facultyName: true } },
            },
          },
        },
      },
    },
  });

  return registrations.map(reg => {
    const profile = reg.user_login.studentLogin || reg.user_login.employeeDetails;
    return {
      userId: reg.userId,
      uid: reg.user_login.uid,
      email: reg.user_login.email,
      name: profile?.displayName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim(),
      institute: profile?.program?.department?.school?.name || profile?.primarySchool?.name || 'SGT University',
      department: profile?.program?.department?.name,
      program: reg.user_login.studentLogin?.program?.name,
    };
  });
};

/**
 * Toggle looking for teammates status
 */
const toggleLookingForTeammates = async (eventId, userId, looking) => {
  const registration = await prisma.eventRegistration.findFirst({
    where: {
      Event: {
        OR: [
          { id: eventId },
          { eventId: eventId },
        ],
      },
      userId: userId,
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration not found');
  }

  await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: {
      lookingForTeammates: looking,
      updatedAt: new Date(),
    },
  });

  return { lookingForTeammates: looking };
};

/**
 * Toggle team looking for members
 */
const toggleTeamLookingForMembers = async (teamId, userId, looking) => {
  const team = await prisma.eventTeam.findFirst({
    where: {
      OR: [
        { id: teamId },
        { teamId: teamId },
      ],
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  if (team.leaderId !== userId) {
    throw new ForbiddenError('Only the team leader can change this setting');
  }

  await prisma.eventTeam.update({
    where: { id: team.id },
    data: {
      lookingForMembers: looking,
      updatedAt: new Date(),
    },
  });

  return { lookingForMembers: looking };
};

/**
 * Remove member from team
 */
const removeMemberFromTeam = async (teamId, memberId, userId) => {
  const team = await prisma.eventTeam.findFirst({
    where: {
      OR: [
        { id: teamId },
        { teamId: teamId },
      ],
    },
    include: {
      EventTeamMember: true,
      Event: true,
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  // Check permission (only leader can remove, or member can remove self)
  if (team.leaderId !== userId && memberId !== userId) {
    throw new ForbiddenError('You do not have permission to remove this member');
  }

  // Leader cannot be removed
  const member = team.EventTeamMember.find(m => m.userId === memberId);
  if (member?.role === 'leader') {
    throw new ValidationError('Team leader cannot be removed. Please transfer leadership first.');
  }

  if (team.isLocked) {
    throw new ValidationError('Team is locked and members cannot be removed');
  }

  await prisma.$transaction(async (tx) => {
    // Update member status
    await tx.eventTeamMember.updateMany({
      where: {
        teamId: team.id,
        userId: memberId,
      },
      data: {
        status: userId === memberId ? 'left' : 'removed',
        leftAt: new Date(),
      },
    });

    // Update registration
    await tx.eventRegistration.updateMany({
      where: {
        eventId: team.eventId,
        userId: memberId,
      },
      data: {
        teamId: null,
        isTeamLeader: false,
        status: 'incomplete_team',
        updatedAt: new Date(),
      },
    });

    // Check if team still meets minimum size
    const remainingMembers = team.EventTeamMember.filter(
      m => m.userId !== memberId && m.status === 'confirmed'
    ).length;

    const isStillComplete = team.Event.minTeamSize 
      ? remainingMembers >= team.Event.minTeamSize 
      : true;

    if (!isStillComplete && team.isComplete) {
      await tx.eventTeam.update({
        where: { id: team.id },
        data: {
          isComplete: false,
          status: 'forming',
        },
      });

      // Update remaining members' registration status
      await tx.eventRegistration.updateMany({
        where: { teamId: team.id },
        data: {
          status: 'incomplete_team',
          updatedAt: new Date(),
        },
      });
    }
  });

  return { message: 'Member removed from team' };
};

/**
 * Cancel team (by leader)
 */
const cancelTeam = async (teamId, userId) => {
  const team = await prisma.eventTeam.findFirst({
    where: {
      OR: [
        { id: teamId },
        { teamId: teamId },
      ],
    },
    include: {
      EventTeamMember: true,
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  if (team.leaderId !== userId) {
    throw new ForbiddenError('Only the team leader can cancel the team');
  }

  if (team.isLocked) {
    throw new ValidationError('Team is locked and cannot be cancelled');
  }

  await prisma.$transaction(async (tx) => {
    // Update team status
    await tx.eventTeam.update({
      where: { id: team.id },
      data: { status: 'withdrawn' },
    });

    // Update all members
    await tx.eventTeamMember.updateMany({
      where: { teamId: team.id },
      data: {
        status: 'left',
        leftAt: new Date(),
      },
    });

    // Update registrations
    await tx.eventRegistration.updateMany({
      where: { teamId: team.id },
      data: {
        teamId: null,
        isTeamLeader: false,
        status: 'cancelled',
        updatedAt: new Date(),
      },
    });

    // Cancel all pending invitations
    await tx.eventTeamInvitation.updateMany({
      where: {
        teamId: team.id,
        status: 'pending',
      },
      data: { status: 'cancelled' },
    });

    // Reject all pending requests
    await tx.eventTeamRequest.updateMany({
      where: {
        teamId: team.id,
        status: 'pending',
      },
      data: {
        status: 'rejected',
        respondedAt: new Date(),
      },
    });
  });

  return { message: 'Team has been cancelled' };
};

/**
 * Get user's team for a specific event
 */
const getUserTeamForEvent = async (eventId, userId) => {
  // Get event
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Find user's team membership
  const teamMembership = await prisma.eventTeamMember.findFirst({
    where: {
      userId: userId,
      status: 'confirmed',
      EventTeam: {
        eventId: event.id,
      },
    },
    select: {
      EventTeam: { select: { id: true } },
    },
  });

  if (!teamMembership) {
    return null;
  }

  // Reuse getTeamDetails for consistent, complete response
  return getTeamDetails(teamMembership.EventTeam.id, userId);
};

/**
 * Finalize/Submit team registration
 * Allows team leader to complete registration when minimum requirements are met
 * @param {string} teamId - Team ID (uuid or custom teamId)
 * @param {string} userId - User ID
 * @returns {object} Updated team details
 */
const finalizeTeamRegistration = async (teamId, userId) => {
  // Get team with event details
  // Use teamId field for custom format (TM-xxx), or id for UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
  
  const team = await prisma.eventTeam.findFirst({
    where: isUUID ? { id: teamId } : { teamId: teamId },
    include: {
      Event: {
        select: {
          id: true,
          name: true,
          minTeamSize: true,
          maxTeamSize: true,
          teamRegistrationDeadline: true,
          paymentType: true,
        },
      },
      EventTeamMember: {
        where: { status: 'confirmed' },
        include: {
          user: {
            select: {
              id: true,
              uid: true,
            },
          },
        },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  // Verify user is the team leader
  if (team.leaderId !== userId) {
    throw new ForbiddenError('Only the team leader can finalize registration');
  }

  // Check if team is already complete
  if (team.isComplete) {
    return getTeamDetails(team.id, userId); // Return current details instead of error
  }

  // Check if minimum team size requirement is met
  const currentMemberCount = team.EventTeamMember.length;
  const minTeamSize = team.Event.minTeamSize || 1;

  console.log('Finalize Team Debug:', {
    teamId: team.teamId,
    currentMemberCount,
    minTeamSize,
    eventMinTeamSize: team.Event.minTeamSize,
    members: team.EventTeamMember.map(m => ({ id: m.id, userId: m.userId })),
  });

  if (currentMemberCount < minTeamSize) {
    throw new ValidationError(
      `Team needs at least ${minTeamSize} member(s) to complete registration. Currently ${currentMemberCount} confirmed member(s) in team. Please invite more members before finalizing.`
    );
  }

  // Check if registration deadline has passed
  if (team.Event.teamRegistrationDeadline) {
    const deadline = new Date(team.Event.teamRegistrationDeadline);
    if (deadline < new Date()) {
      throw new ValidationError('Team registration deadline has passed');
    }
  }

  // Check if event is paid — if so, don't confirm registrations yet (payment required first)
  const isPaidEvent = team.Event.paymentType === 'paid';

  // Check if team can still accept more members after finalization
  const maxTeamSize = team.Event.maxTeamSize || 999;
  const canStillAcceptMembers = currentMemberCount < maxTeamSize;

  // Finalize team registration
  await prisma.$transaction(async (tx) => {
    // Update team status
    await tx.eventTeam.update({
      where: { id: team.id },
      data: {
        isComplete: true,
        status: 'complete',
        lookingForMembers: canStillAcceptMembers,
        updatedAt: new Date(),
      },
    });

    if (isPaidEvent) {
      // For paid events: set registrations to 'pending' (awaiting payment)
      await tx.eventRegistration.updateMany({
        where: { 
          teamId: team.id,
          status: { in: ['incomplete_team'] },
        },
        data: {
          status: 'pending',
          paymentStatus: 'pending',
          updatedAt: new Date(),
        },
      });
    } else {
      // For free events: confirm registrations immediately
      await tx.eventRegistration.updateMany({
        where: { 
          teamId: team.id,
          status: { in: ['incomplete_team', 'pending'] },
        },
        data: {
          status: 'confirmed',
          updatedAt: new Date(),
        },
      });
    }
  });

  // Return updated team details
  return getTeamDetails(team.id, userId);
};

module.exports = {
  createTeam,
  getTeamDetails,
  searchUsersToInvite,
  inviteToTeam,
  respondToInvitation,
  requestToJoinTeam,
  respondToJoinRequest,
  getTeamsLookingForMembers,
  getUsersLookingForTeammates,
  toggleLookingForTeammates,
  toggleTeamLookingForMembers,
  removeMemberFromTeam,
  cancelTeam,
  getUserTeamForEvent,
  finalizeTeamRegistration,
  TEAM_STATUS,
  MEMBER_STATUS,
  INVITATION_STATUS,
  REQUEST_STATUS,
};
