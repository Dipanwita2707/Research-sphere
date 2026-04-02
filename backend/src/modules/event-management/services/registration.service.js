/**
 * Advanced Event Registration Service
 * 
 * Handles dynamic registration forms, team management, and advanced registration workflows
 */

const prisma = require('../../../shared/config/database');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const { generateRegistrationId, generateQRCode, canRegisterForEvent, resolveEvent } = require('../utils/eventHelpers');
const crypto = require('crypto');
const { applyCouponInTransaction } = require('./coupon.service');
const { REGISTRATION_STATUS, PAYMENT_STATUS } = require('../constants/event.constants');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[0-9]{10}$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_REGEX = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isMissingCustomFieldValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim().length === 0) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function normalizeCustomFieldOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];

  return rawOptions
    .map((option) => {
      if (typeof option === 'string') return option;
      if (isPlainObject(option) && typeof option.value === 'string') return option.value;
      return null;
    })
    .filter((option) => typeof option === 'string' && option.trim().length > 0)
    .map((option) => option.trim());
}

function validateStringRules(fieldLabel, value, rules = {}) {
  if (typeof rules.minLength === 'number' && value.length < rules.minLength) {
    throw new ValidationError(
      `${fieldLabel} validation failed: Must be at least ${rules.minLength} characters long.`,
    );
  }

  if (typeof rules.maxLength === 'number' && value.length > rules.maxLength) {
    throw new ValidationError(
      `${fieldLabel} validation failed: Must not exceed ${rules.maxLength} characters.`,
    );
  }

  if (typeof rules.pattern === 'string' && rules.pattern.trim().length > 0) {
    try {
      const pattern = new RegExp(rules.pattern);
      if (!pattern.test(value)) {
        throw new ValidationError(
          `${fieldLabel} validation failed: Enter a valid value.`,
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      // Ignore malformed custom patterns to avoid breaking active forms.
    }
  }
}

function validateCustomFieldValue(field, submittedValue) {
  const fieldLabel = field.fieldLabel || field.fieldName || 'Field';
  const fieldType = String(field.fieldType || '').toLowerCase();
  const rules = isPlainObject(field.validationRules) ? field.validationRules : {};
  const options = new Set(normalizeCustomFieldOptions(field.options));
  const missingValue = isMissingCustomFieldValue(submittedValue);

  if (field.isRequired && missingValue) {
    throw new ValidationError(`${fieldLabel} validation failed: ${fieldLabel} is required.`);
  }

  if (missingValue) {
    return;
  }

  switch (fieldType) {
    case 'text':
    case 'textarea': {
      if (typeof submittedValue !== 'string') {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid text value.`);
      }
      validateStringRules(fieldLabel, submittedValue.trim(), rules);
      return;
    }

    case 'number': {
      const numericValue = Number(submittedValue);
      if (!Number.isFinite(numericValue)) {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid number.`);
      }
      if (typeof rules.min === 'number' && numericValue < rules.min) {
        throw new ValidationError(`${fieldLabel} validation failed: Must be at least ${rules.min}.`);
      }
      if (typeof rules.max === 'number' && numericValue > rules.max) {
        throw new ValidationError(`${fieldLabel} validation failed: Must be at most ${rules.max}.`);
      }
      return;
    }

    case 'email': {
      if (typeof submittedValue !== 'string' || !EMAIL_REGEX.test(submittedValue.trim())) {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid email address.`);
      }
      validateStringRules(fieldLabel, submittedValue.trim(), rules);
      return;
    }

    case 'phone': {
      const digits = String(submittedValue).replace(/\D/g, '');
      if (!MOBILE_REGEX.test(digits)) {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid 10-digit mobile number.`);
      }
      return;
    }

    case 'url': {
      if (typeof submittedValue !== 'string') {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid URL.`);
      }
      const trimmed = submittedValue.trim();
      try {
        const parsed = new URL(trimmed);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid URL.`);
      }
      validateStringRules(fieldLabel, trimmed, rules);
      return;
    }

    case 'date': {
      if (typeof submittedValue !== 'string' || !DATE_ONLY_REGEX.test(submittedValue.trim())) {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid date (YYYY-MM-DD).`);
      }
      const parsedDate = new Date(`${submittedValue.trim()}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid date (YYYY-MM-DD).`);
      }
      return;
    }

    case 'time': {
      if (typeof submittedValue !== 'string' || !TIME_ONLY_REGEX.test(submittedValue.trim())) {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid time (HH:mm).`);
      }
      return;
    }

    case 'datetime': {
      if (typeof submittedValue !== 'string' || Number.isNaN(new Date(submittedValue).getTime())) {
        throw new ValidationError(`${fieldLabel} validation failed: Enter a valid date and time.`);
      }
      return;
    }

    case 'dropdown':
    case 'radio': {
      if (typeof submittedValue !== 'string' || submittedValue.trim().length === 0) {
        throw new ValidationError(`${fieldLabel} validation failed: Select a valid option.`);
      }
      if (options.size > 0 && !options.has(submittedValue.trim())) {
        throw new ValidationError(`${fieldLabel} validation failed: Selected option is invalid.`);
      }
      return;
    }

    case 'checkbox': {
      if (!Array.isArray(submittedValue)) {
        throw new ValidationError(`${fieldLabel} validation failed: Select at least one valid option.`);
      }
      const values = submittedValue.map((item) => String(item).trim()).filter(Boolean);
      if (field.isRequired && values.length === 0) {
        throw new ValidationError(`${fieldLabel} validation failed: Select at least one option.`);
      }
      if (options.size > 0 && values.some((value) => !options.has(value))) {
        throw new ValidationError(`${fieldLabel} validation failed: One or more selected options are invalid.`);
      }
      return;
    }

    case 'file':
    case 'image': {
      const isStringValue = typeof submittedValue === 'string' && submittedValue.trim().length > 0;
      const objectPath = isPlainObject(submittedValue)
        ? submittedValue.filePath || submittedValue.url || submittedValue.path || submittedValue.fileName
        : null;
      const isObjectValue = typeof objectPath === 'string' && objectPath.trim().length > 0;

      if (!isStringValue && !isObjectValue) {
        throw new ValidationError(`${fieldLabel} validation failed: Upload a valid file.`);
      }

      const candidate = isStringValue ? submittedValue.trim() : String(objectPath).trim();
      validateStringRules(fieldLabel, candidate, rules);
      return;
    }

    default:
      return;
  }
}

function validateCustomFieldResponses(customFields = [], formData = {}) {
  for (const field of customFields) {
    validateCustomFieldValue(field, formData[field.fieldName]);
  }
}

const buildExtraPassSummary = (registration) => {
  const totalAllowedEntries = registration?.totalAllowedEntries ?? 1;
  const checkedInCount = registration?.checkedInCount ?? 0;
  const checkedOutCount = registration?.checkedOutCount ?? 0;
  const currentlyInside = Math.max(0, checkedInCount - checkedOutCount);
  return {
    extraPassCount: registration?.extraPassCount ?? 0,
    totalAllowedEntries,
    checkedInCount,
    checkedOutCount,
    currentlyInside,
    availableEntrySlots: Math.max(0, totalAllowedEntries - currentlyInside),
    // Keep legacy alias for older clients.
    remainingEntries: Math.max(0, totalAllowedEntries - currentlyInside),
    studentInside: registration?.studentInsideAssumed ?? currentlyInside > 0,
  };
};

/**
 * Get registration form for an event (includes custom fields and user profile data)
 */
const getRegistrationForm = async (eventId, userId) => {
  const cache = require('../../../shared/config/redis');

  // PERF: Cache event+customFields with stampede protection (shared across all users, 60s TTL)
  const eventCacheKey = `event:regform:${eventId}`;
  const { data: event } = await cache.getOrSet(eventCacheKey, async () => {
    return await resolveEvent(eventId, {
      include: {
        EventCustomField: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }, 60);

  // User-specific data: profile + existing registration (parallel, cached)
  const userProfileCacheKey = `user:profile:${userId}`;
  const existRegCacheKey = `event:existreg:${event.id}:${userId}`;

  let [cachedProfile, cachedExistReg] = await Promise.all([
    cache.get(userProfileCacheKey),
    cache.get(existRegCacheKey),
  ]);

  const promises = [];
  if (cachedProfile === null) {
    promises.push(
      getUserProfileData(userId).then(p => { cachedProfile = p; cache.set(userProfileCacheKey, p, 120); })
    );
  }
  if (cachedExistReg === null) {
    promises.push(
      prisma.eventRegistration.findFirst({
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
      }).then(reg => { cachedExistReg = reg || false; cache.set(existRegCacheKey, reg || false, 30); })
    );
  }
  if (promises.length > 0) await Promise.all(promises);

  const userProfile = cachedProfile;
  const existingRegistration = cachedExistReg === false ? null : cachedExistReg;

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
      allowExtraPasses: event.allowExtraPasses,
      maxExtraPassesPerUser: event.maxExtraPassesPerUser,
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
      paymentStatus: existingRegistration.paymentStatus,
      qrCode: existingRegistration.qrCode,
      amountPaid: existingRegistration.amountPaid,
      formData: existingRegistration.formData,
      teamId: existingRegistration.teamId,
      isTeamLeader: existingRegistration.isTeamLeader,
      team: existingRegistration.EventTeam,
    } : null,
  };
};

/**
 * Get minimal payment context for the current user's registration page.
 */
const getPaymentContext = async (eventId, userId) => {
  const [event, existingRegistration] = await Promise.all([
    resolveEvent(eventId, {
      select: {
        id: true,
        name: true,
        paymentType: true,
        participationType: true,
        registrationFee: true,
      },
    }),
    prisma.eventRegistration.findFirst({
      where: {
        eventId,
        userId,
      },
      select: {
        id: true,
        registrationId: true,
        status: true,
        paymentStatus: true,
        amountPaid: true,
      },
    }),
  ]);

  return {
    event,
    existingRegistration,
  };
};

/**
 * Get user profile data for auto-filling registration form
 */
const getUserProfileData = async (userId) => {
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
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
          studentId: true,
          gender: true,
          graduationDate: true,
          address: true,
          programId: true,
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
          empId: true,
          primaryDepartment: {
            select: {
              departmentName: true,
              faculty: {
                select: { facultyName: true },
              },
            },
          },
          primarySchool: {
            select: { facultyName: true },
          },
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
    location: isStudent ? profile?.address || '' : '',
  };
};

/**
 * Submit registration form (Step 1 of registration)
 */
const submitRegistrationForm = async (eventId, userId, formData) => {
  // Extract coupon code from body before passing to mergedFormData
  const { couponCode, ...restFormData } = formData;
  // Get event
  const event = await resolveEvent(eventId, {
    include: {
      EventCustomField: {
        where: { isActive: true },
      },
    },
  });

  // Validate coupon if provided (preview check — actual lock happens in transaction)
  let couponPreview = null;
  if (couponCode && event.paymentType === 'paid') {
    const { validateCoupon } = require('./coupon.service');
    const registrationAmount = event.registrationFee || 0;
    couponPreview = await validateCoupon(event.id, couponCode, userId, registrationAmount);
  }

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

  // Validate custom fields by type and rules
  validateCustomFieldResponses(event.EventCustomField, restFormData);

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
    ...restFormData,
    // Always include profile data (overrides user input for profile-sourced fields)
    firstName: userProfile.firstName || restFormData.firstName,
    lastName: userProfile.lastName || restFormData.lastName,
    email: userProfile.email || restFormData.email,
    institute: userProfile.institute || restFormData.institute,
    // Silently merge profile fields that frontend may have hidden
    uid: userProfile.uid || restFormData.uid || null,
    registrationNo: userProfile.registrationNo || restFormData.registrationNo || null,
    studentId: userProfile.studentId || restFormData.studentId || null,
    employeeId: userProfile.employeeId || restFormData.employeeId || null,
    gender: userProfile.gender || restFormData.gender || null,
    school: userProfile.school || restFormData.school || null,
    department: userProfile.department || restFormData.department || null,
    program: userProfile.program || restFormData.program || null,
    passOutYear: userProfile.passOutYear || restFormData.passOutYear || null,
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

  // Pre-compute coupon amounts from preview (already validated above)
  const baseAmount = event.registrationFee || 0;
  let couponId = null;
  let discountAmount = null;
  let originalAmount = null;
  let finalAmount = baseAmount;

  if (couponPreview && event.paymentType === 'paid') {
    couponId = couponPreview.couponId;
    discountAmount = couponPreview.discountAmount;
    originalAmount = couponPreview.originalAmount;
    finalAmount = couponPreview.finalAmount;
  }

  // If coupon covers the full amount → auto-confirm without payment step
  const isCouponFullyFree = couponPreview && event.paymentType === 'paid' && finalAmount === 0;
  if (isCouponFullyFree && event.participationType !== 'team') {
    initialStatus = REGISTRATION_STATUS.CONFIRMED;
  }

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
          paymentStatus: event.paymentType === 'paid'
            ? (isCouponFullyFree ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.PENDING)
            : null,
          couponId: couponId ?? undefined,
          discountAmount: discountAmount ?? undefined,
          originalAmount: originalAmount ?? undefined,
          amountPaid: event.paymentType === 'paid' ? finalAmount : null,
          extraPassCount: existingRegistration.extraPassCount ?? 0,
          totalAllowedEntries: existingRegistration.totalAllowedEntries ?? 1,
          checkedInCount: existingRegistration.checkedInCount ?? 0,
          checkedOutCount: existingRegistration.checkedOutCount ?? 0,
          studentInsideAssumed: existingRegistration.studentInsideAssumed ?? false,
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
          paymentStatus: event.paymentType === 'paid'
            ? (isCouponFullyFree ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.PENDING)
            : null,
          couponId: couponId ?? undefined,
          discountAmount: discountAmount ?? undefined,
          originalAmount: originalAmount ?? undefined,
          amountPaid: event.paymentType === 'paid' ? finalAmount : null,
          extraPassCount: 0,
          totalAllowedEntries: 1,
          checkedInCount: 0,
          checkedOutCount: 0,
          studentInsideAssumed: false,
          updatedAt: new Date(),
        },
      });
    }

    // Apply coupon AFTER registration row exists (FK requires registration to exist first)
    // Only record usage for 100% coupons (auto-confirmed) — partial coupons are recorded on payment verification
    const alreadyHadCoupon = existingRegistration && existingRegistration.couponId;
    if (isCouponFullyFree && couponPreview && !alreadyHadCoupon) {
      await applyCouponInTransaction(tx, couponId, reg.id, userId, baseAmount);
    }

    // Replace field responses in bulk to avoid row-by-row upserts.
    const fieldResponses = event.EventCustomField
      .filter((field) => restFormData[field.fieldName] !== undefined)
      .map((field) => ({
        registrationId: reg.id,
        fieldId: field.id,
        value: typeof restFormData[field.fieldName] === 'string'
          ? restFormData[field.fieldName]
          : JSON.stringify(restFormData[field.fieldName]),
      }));

    if (fieldResponses.length > 0) {
      await tx.eventFieldResponse.deleteMany({
        where: { registrationId: reg.id },
      });
      await tx.eventFieldResponse.createMany({
        data: fieldResponses,
      });
    } else if (existingRegistration) {
      await tx.eventFieldResponse.deleteMany({
        where: { registrationId: reg.id },
      });
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
    message: isCouponFullyFree
      ? 'Registration complete! Coupon covered the full amount.'
      : event.participationType === 'team'
        ? 'Form submitted. Please create or join a team to complete registration.'
        : 'Registration successful!',
    couponFullyFree: !!isCouponFullyFree,
    couponApplied: couponPreview ? {
      code: couponPreview.code,
      discountAmount: couponPreview.discountAmount,
      originalAmount: couponPreview.originalAmount,
      finalAmount: couponPreview.finalAmount,
      discountType: couponPreview.discountType,
      discountValue: couponPreview.discountValue,
    } : null,
  };
};

/**
 * Create an extra pass (guest) under current user's registration
 */
const createExtraPass = async (eventId, userId, guestData) => {
  const event = await resolveEvent(eventId, {
    select: {
      id: true,
      allowExtraPasses: true,
      maxExtraPassesPerUser: true,
      status: true,
    },
  });

  if (!event.allowExtraPasses) {
    throw new ValidationError('Extra passes are not enabled for this event');
  }

  const registration = await prisma.eventRegistration.findFirst({
    where: {
      eventId: event.id,
      userId,
      status: {
        in: [
          REGISTRATION_STATUS.PENDING,
          REGISTRATION_STATUS.CONFIRMED,
          REGISTRATION_STATUS.INCOMPLETE_TEAM,
        ],
      },
    },
  });

  if (!registration) {
    throw new ValidationError('You must register for this event before adding extra passes');
  }

  const guestName = String(guestData?.guestName || '').trim();
  const guestEmail = String(guestData?.guestEmail || '').trim().toLowerCase();
  const mobileNumber = String(guestData?.mobileNumber || '').trim();
  const relationship = String(guestData?.relationship || '').trim();

  if (!guestName || !guestEmail || !mobileNumber || !relationship) {
    throw new ValidationError('guestName, guestEmail, mobileNumber, and relationship are required');
  }
  if (!EMAIL_REGEX.test(guestEmail)) {
    throw new ValidationError('Guest email is invalid');
  }
  if (!MOBILE_REGEX.test(mobileNumber)) {
    throw new ValidationError('Mobile number must be a valid 10-digit number');
  }

  const maxExtra = event.maxExtraPassesPerUser ?? 0;
  if (registration.extraPassCount >= maxExtra) {
    throw new ValidationError(`Extra pass limit reached. Maximum allowed: ${maxExtra}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const nextExtraPassCount = registration.extraPassCount + 1;
    const updatedRegistration = await tx.eventRegistration.update({
      where: { id: registration.id },
      data: {
        extraPassCount: { increment: 1 },
        totalAllowedEntries: 1 + nextExtraPassCount,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        registrationId: true,
        extraPassCount: true,
        totalAllowedEntries: true,
        checkedInCount: true,
        checkedOutCount: true,
        studentInsideAssumed: true,
      },
    });

    const extraPass = await tx.eventExtraPass.create({
      data: {
        id: crypto.randomUUID(),
        eventId: event.id,
        registrationId: registration.id,
        createdById: userId,
        guestName,
        guestEmail,
        mobileNumber,
        relationship,
        updatedAt: new Date(),
      },
    });

    return {
      extraPass,
      registration: updatedRegistration,
    };
  });

  return {
    extraPass: result.extraPass,
    summary: buildExtraPassSummary(result.registration),
  };
};

/**
 * Get current user's extra passes for an event
 */
const getMyExtraPasses = async (eventId, userId) => {
  const event = await resolveEvent(eventId, {
    select: { id: true, allowExtraPasses: true, maxExtraPassesPerUser: true },
  });

  const registration = await prisma.eventRegistration.findFirst({
    where: { eventId: event.id, userId },
    include: {
      EventExtraPass: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!registration) {
    throw new NotFoundError('Registration not found for this event');
  }

  return {
    allowExtraPasses: event.allowExtraPasses,
    maxExtraPassesPerUser: event.maxExtraPassesPerUser,
    registrationId: registration.registrationId,
    guests: registration.EventExtraPass,
    summary: buildExtraPassSummary(registration),
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
      take: 50, // Limit dashboard to most recent 50 registrations
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
  getPaymentContext,
  getUserProfileData,
  submitRegistrationForm,
  createExtraPass,
  getMyExtraPasses,
  getRegistrationDashboard,
  REGISTRATION_STATUS,
  PAYMENT_STATUS,
};
