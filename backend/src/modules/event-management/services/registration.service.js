/**
 * Advanced Event Registration Service
 * 
 * Handles dynamic registration forms, team management, and advanced registration workflows
 */

const prisma = require('../../../shared/config/database');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const { generateRegistrationId, generateQRCode, canRegisterForEvent } = require('../utils/eventHelpers');
const crypto = require('crypto');

const REGISTRATION_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  WAITLISTED: 'waitlisted',
  REJECTED: 'rejected',
  INCOMPLETE_TEAM: 'incomplete_team',
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

/**
 * Get registration form for an event (includes custom fields and user profile data)
 */
const getRegistrationForm = async (eventId, userId) => {
  // Get event with custom fields
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
    include: {
      EventCustomField: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Get user profile data for auto-fill
  const userProfile = await getUserProfileData(userId);

  // Build profileFields map — indicates which fields have data from the user's profile
  // Frontend uses this to hide fields that are already known (silent auto-fill)
  const profileFields = {
    uid: !!userProfile.uid,
    registrationNo: !!userProfile.registrationNo,
    studentId: !!userProfile.studentId,
    employeeId: !!userProfile.employeeId,
    gender: !!userProfile.gender,
    school: !!userProfile.school,
    department: !!userProfile.department,
    program: !!userProfile.program,
    passOutYear: !!userProfile.passOutYear,
  };

  // Check if user already registered
  const existingRegistration = await prisma.eventRegistration.findFirst({
    where: {
      eventId: event.id,
      userId: userId,
    },
    include: {
      EventFieldResponse: {
        include: {
          EventCustomField: true,
        },
      },
      EventTeam: {
        include: {
          EventTeamMember: true,
        },
      },
    },
  });

  return {
    event: {
      id: event.id,
      eventId: event.eventId,
      name: event.name,
      participationType: event.participationType,
      minTeamSize: event.minTeamSize,
      maxTeamSize: event.maxTeamSize,
      interCollegeAllowed: event.interCollegeAllowed,
      requireFormSubmission: event.requireFormSubmission,
      paymentType: event.paymentType,
      registrationFee: event.registrationFee,
    },
    customFields: event.EventCustomField.map(field => ({
      id: field.id,
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      placeholder: field.placeholder,
      helpText: field.helpText,
      options: field.options,
      validationRules: field.validationRules,
      defaultValue: field.defaultValue,
    })),
    userProfile,
    profileFields,
    existingRegistration: existingRegistration ? {
      id: existingRegistration.id,
      registrationId: existingRegistration.registrationId,
      status: existingRegistration.status,
      formData: existingRegistration.formData,
      teamId: existingRegistration.teamId,
      isTeamLeader: existingRegistration.isTeamLeader,
      team: existingRegistration.EventTeam,
    } : null,
  };
};

/**
 * Get user profile data for auto-filling registration form
 */
const getUserProfileData = async (userId) => {
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    include: {
      studentLogin: {
        include: {
          program: {
            include: {
              department: {
                include: {
                  faculty: true,
                },
              },
            },
          },
        },
      },
      employeeDetails: {
        include: {
          primaryDepartment: {
            include: {
              faculty: true,
            },
          },
          primarySchool: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Build profile data based on user type
  const isStudent = !!user.studentLogin;
  const profile = isStudent ? user.studentLogin : user.employeeDetails;

  // Extract pass-out year from graduation date
  const passOutYear = isStudent && profile?.graduationDate
    ? new Date(profile.graduationDate).getFullYear().toString()
    : null;

  return {
    userId: user.id,
    uid: user.uid,
    email: user.email,
    phone: user.phone,
    userType: isStudent ? 'student' : 'employee',
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    displayName: profile?.displayName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim(),
    registrationNo: isStudent ? profile?.registrationNo || profile?.studentId : null,
    studentId: isStudent ? profile?.studentId : null,
    employeeId: !isStudent ? profile?.empId : null,
    gender: isStudent ? profile?.gender || null : null,
    department: isStudent 
      ? profile?.program?.department?.departmentName || null
      : profile?.primaryDepartment?.departmentName || null,
    program: isStudent ? profile?.program?.programName || null : null,
    school: isStudent 
      ? profile?.program?.department?.faculty?.facultyName || null
      : profile?.primarySchool?.facultyName || null,
    passOutYear,
    institute: 'SGT University', // Can be made dynamic
    location: profile?.address || '',
  };
};

/**
 * Submit registration form (Step 1 of registration)
 */
const submitRegistrationForm = async (eventId, userId, formData) => {
  // Get event
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: eventId },
        { eventId: eventId },
      ],
    },
    include: {
      EventCustomField: {
        where: { isActive: true },
      },
    },
  });

  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Validate event is open for registration
  if (event.status !== 'published') {
    throw new ValidationError('Event is not open for registration');
  }

  const now = new Date();
  if (event.registrationStartDate && now < new Date(event.registrationStartDate)) {
    throw new ValidationError('Registration has not started yet');
  }
  if (event.registrationEndDate && now > new Date(event.registrationEndDate)) {
    throw new ValidationError('Registration deadline has passed');
  }

  // Check for existing registration
  const existingRegistration = await prisma.eventRegistration.findFirst({
    where: {
      eventId: event.id,
      userId: userId,
    },
    include: {
      Event: {
        select: {
          id: true,
          eventId: true,
          name: true,
          participationType: true,
          minTeamSize: true,
          maxTeamSize: true,
        },
      },
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
        },
      },
    },
  });

  // If user already has a non-draft registration
  if (existingRegistration && existingRegistration.status !== 'draft') {
    // For team events with INCOMPLETE_TEAM status, allow them to proceed to team setup
    if (event.participationType === 'team' && existingRegistration.status === REGISTRATION_STATUS.INCOMPLETE_TEAM) {
      return {
        registration: existingRegistration,
        nextStep: 'team_management',
        message: 'You have already submitted the form. Please create or join a team to complete registration.',
      };
    }
    // For other cases, they've already completed registration
    throw new ValidationError('You have already registered for this event');
  }

  // Validate required custom fields
  for (const field of event.EventCustomField) {
    if (field.isRequired && !formData[field.fieldName]) {
      throw new ValidationError(`${field.fieldLabel} is required`);
    }
  }

  // Validate capacity
  if (event.maxCapacity) {
    const currentRegistrations = await prisma.eventRegistration.count({
      where: {
        eventId: event.id,
        status: {
          in: ['pending', 'confirmed'],
        },
      },
    });
    if (currentRegistrations >= event.maxCapacity) {
      throw new ValidationError('Event is at full capacity');
    }
  }

  // Fetch user profile data and merge into formData
  // Profile fields take precedence to ensure data integrity
  const userProfile = await getUserProfileData(userId);
  const mergedFormData = {
    ...formData,
    // Always include profile data (overrides user input for profile-sourced fields)
    firstName: userProfile.firstName || formData.firstName,
    lastName: userProfile.lastName || formData.lastName,
    email: userProfile.email || formData.email,
    institute: userProfile.institute || formData.institute,
    // Silently merge profile fields that frontend may have hidden
    uid: userProfile.uid || formData.uid || null,
    registrationNo: userProfile.registrationNo || formData.registrationNo || null,
    studentId: userProfile.studentId || formData.studentId || null,
    employeeId: userProfile.employeeId || formData.employeeId || null,
    gender: userProfile.gender || formData.gender || null,
    school: userProfile.school || formData.school || null,
    department: userProfile.department || formData.department || null,
    program: userProfile.program || formData.program || null,
    passOutYear: userProfile.passOutYear || formData.passOutYear || null,
    userType: userProfile.userType,
  };

  // Determine initial status (auto-approve: free→confirmed, paid→pending)
  let initialStatus;
  if (event.participationType === 'team') {
    initialStatus = REGISTRATION_STATUS.INCOMPLETE_TEAM;
  } else {
    initialStatus = event.paymentType === 'paid' ? REGISTRATION_STATUS.PENDING : REGISTRATION_STATUS.CONFIRMED;
  }

  // Generate IDs
  const registrationId = await generateRegistrationId(prisma, event.eventId);
  const qrCode = generateQRCode(event.eventId, userId);

  // Create or update registration
  const registration = await prisma.$transaction(async (tx) => {
    let reg;
    
    if (existingRegistration) {
      // Update existing draft registration
      reg = await tx.eventRegistration.update({
        where: { id: existingRegistration.id },
        data: {
          status: initialStatus,
          formData: mergedFormData,
          formSubmittedAt: new Date(),
          paymentStatus: event.paymentType === 'paid' ? PAYMENT_STATUS.PENDING : null,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new registration
      reg = await tx.eventRegistration.create({
        data: {
          id: registrationId,
          registrationId,
          eventId: event.id,
          userId,
          qrCode,
          status: initialStatus,
          formData: mergedFormData,
          formSubmittedAt: new Date(),
          paymentStatus: event.paymentType === 'paid' ? PAYMENT_STATUS.PENDING : null,
          updatedAt: new Date(),
        },
      });
    }

    // Save custom field responses
    for (const field of event.EventCustomField) {
      if (formData[field.fieldName] !== undefined) {
        await tx.eventFieldResponse.upsert({
          where: {
            registrationId_fieldId: {
              registrationId: reg.id,
              fieldId: field.id,
            },
          },
          create: {
            registrationId: reg.id,
            fieldId: field.id,
            value: typeof formData[field.fieldName] === 'string' 
              ? formData[field.fieldName] 
              : JSON.stringify(formData[field.fieldName]),
          },
          update: {
            value: typeof formData[field.fieldName] === 'string' 
              ? formData[field.fieldName] 
              : JSON.stringify(formData[field.fieldName]),
            updatedAt: new Date(),
          },
        });
      }
    }

    return reg;
  });

  // Get full registration with relationships
  const fullRegistration = await prisma.eventRegistration.findUnique({
    where: { id: registration.id },
    include: {
      Event: {
        select: {
          id: true,
          eventId: true,
          name: true,
          participationType: true,
          minTeamSize: true,
          maxTeamSize: true,
        },
      },
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
        },
      },
    },
  });

  return {
    registration: fullRegistration,
    nextStep: event.participationType === 'team' ? 'team_management' : 'complete',
    message: event.participationType === 'team' 
      ? 'Form submitted. Please create or join a team to complete registration.'
      : 'Registration successful!',
  };
};

/**
 * Get user's registration dashboard data
 */
const getRegistrationDashboard = async (userId) => {
  // Parallelize all 3 independent queries — registrations, invitations, requests
  const [registrations, pendingInvitations, sentRequests] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: { userId },
      include: {
        Event: {
          select: {
            id: true,
            eventId: true,
            name: true,
            eventType: true,
            startDate: true,
            endDate: true,
            venue: true,
            participationType: true,
            status: true,
          },
        },
        EventTeam: {
          include: {
            EventTeamMember: true,
            Event: {
              select: {
                minTeamSize: true,
                maxTeamSize: true,
              },
            },
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
    }),
    prisma.eventTeamInvitation.findMany({
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
              },
            },
            EventTeamMember: true,
          },
        },
      },
    }),
    prisma.eventTeamRequest.findMany({
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
    }),
  ]);

  return {
    registrations: registrations.map(reg => ({
      ...reg,
      teamCompletion: reg.EventTeam 
        ? {
            current: reg.EventTeam.EventTeamMember.filter(m => m.status === 'confirmed').length,
            min: reg.EventTeam.Event.minTeamSize,
            max: reg.EventTeam.Event.maxTeamSize,
            isComplete: reg.EventTeam.isComplete,
          }
        : null,
    })),
    pendingInvitations,
    sentRequests,
    summary: {
      totalRegistrations: registrations.length,
      confirmedRegistrations: registrations.filter(r => r.status === 'confirmed').length,
      pendingRegistrations: registrations.filter(r => r.status === 'pending').length,
      incompleteTeams: registrations.filter(r => r.status === 'incomplete_team').length,
      pendingInvitationsCount: pendingInvitations.length,
      sentRequestsCount: sentRequests.length,
    },
  };
};

module.exports = {
  getRegistrationForm,
  getUserProfileData,
  submitRegistrationForm,
  getRegistrationDashboard,
  REGISTRATION_STATUS,
  PAYMENT_STATUS,
};
