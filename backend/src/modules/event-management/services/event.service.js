/**
 * Event Management Service
 *
 * This service handles all business logic related to events, registrations, and volunteers
 */

const prisma = require("../../../shared/config/database");
const cache = require("../../../shared/config/redis");
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} = require("../../../shared/utils/AppError");
const {
  sanitizeSponsors,
  sanitizeHtml,
  isValidMobile,
  isValidUrl,
} = require("../../../shared/utils/validators");
const {
  ERRORS,
  EVENT_STATUS,
  REGISTRATION_STATUS,
  PAYMENT_STATUS,
  LIMITS,
  EMAIL_REGEX,
} = require("../constants/event.constants");
const {
  generateEventId,
  generateRegistrationId,
  getEventById,
  canRegisterForEvent,
  isEventVolunteer,
  validateQRCodeAndGetRegistration,
} = require("../utils/eventHelpers");
const { generateQRCode } = require("../utils/qrCodeGenerator");
const crypto = require("crypto");

/**
 * Create event from approved noting
 * This is called automatically when a noting is approved.
 *
 * For festival notings: creates one Event per sub-event (not a single festival event).
 * For venue/stall notings: creates a single event as before.
 *
 * Returns:
 *   - festival: { isFestival: true, events: Event[] }
 *   - venue/stall: { isFestival: false, event: Event }
 */
const createEventFromNoting = async (noteId, userId) => {
  // Get the noting with event details
  const noting = await prisma.note.findUnique({
    where: { id: noteId },
    include: { createdBy: true },
  });

  if (!noting) throw new NotFoundError("Noting not found");
  if (noting.status !== "approved")
    throw new ValidationError(ERRORS.NOTING_NOT_APPROVED);

  // Check if events already exist for this noting
  const existingEvents = await prisma.event.findMany({
    where: { notingId: noting.id },
  });
  if (existingEvents.length > 0)
    throw new ValidationError(ERRORS.NOTING_ALREADY_HAS_EVENT);

  // ── FESTIVAL: create one event per sub-event ──────────────────────────────
  if (noting.notingEventType === "festival") {
    const subEvents = Array.isArray(noting.subEvents) ? noting.subEvents : [];
    if (subEvents.length === 0) {
      throw new ValidationError(
        "Festival noting has no sub-events to create events from",
      );
    }

    const createdEvents = [];
    for (const se of subEvents) {
      const v = se.venueFormData || {};
      if (
        !v.eventName ||
        !v.eventType ||
        !v.eventStartDate ||
        !v.eventEndDate ||
        !v.eventPaymentType
      ) {
        continue; // skip incomplete sub-events
      }

      const seEventId = await generateEventId(prisma);
      const seParticipationType = v.eventParticipationType || "individual";
      const seRegistrationFee =
        v.eventPaymentType === "paid"
          ? seParticipationType === "team"
            ? (v.eventRegistrationFeeTeam ?? null)
            : (v.eventRegistrationFeeIndividual ?? null)
          : null;
      const seTeamRegistrationFee =
        v.eventPaymentType === "paid" && seParticipationType === "team"
          ? (v.eventRegistrationFeeTeam ?? null)
          : null;

      const seEvent = await prisma.event.create({
        data: {
          id: seEventId,
          eventId: seEventId,
          notingId: noting.id, // all sub-events linked to same noting
          name: v.eventName,
          eventType: v.eventType,
          startDate: new Date(v.eventStartDate),
          endDate: new Date(v.eventEndDate),
          paymentType: v.eventPaymentType,
          participationType: seParticipationType,
          registrationFee: seRegistrationFee,
          teamRegistrationFee: seTeamRegistrationFee,
          approxCapacity: v.eventApproxCapacity ?? null,
          dutyLeaveAvailable: v.eventDutyLeaveAvailable ?? null,
          dutyLeaveEligibility: Array.isArray(v.eventDutyLeaveEligibility)
            ? v.eventDutyLeaveEligibility
            : null,
          dutyLeaveRoleType: v.eventDutyLeaveRoleType ?? null,
          hasSponsorship: v.eventHasSponsorship ?? null,
          sponsors: Array.isArray(v.eventSponsors) ? v.eventSponsors : null,
          hasResources: v.eventHasResources ?? null,
          resources: Array.isArray(v.eventResources) ? v.eventResources : null,
          certificateAvailable: v.eventCertification ?? false,
          description: null,
          longDescription: null,
          status: "draft",
          createdById: noting.createdById,
          updatedAt: new Date(),
          notingEventType: se.eventType === "stall" ? "stall" : "venue",
          stallConfig:
            se.eventType === "stall" && se.stallConfig ? se.stallConfig : null,
          hasStalls: !!(se.eventType === "stall" && se.stallConfig),
          // Store festival context on each sub-event
          festivalMeta: noting.festivalMeta || null,
          festivalNotingId: noting.id, // group identifier — all sub-events share this
        },
      });

      // Create prizes for this sub-event
      if (
        Array.isArray(v.eventPrizesAwards) &&
        v.eventPrizesAwards.length > 0
      ) {
        const prizeRows = v.eventPrizesAwards.map((p, idx) => ({
          eventId: seEvent.id,
          position: p.position ?? idx + 1,
          rank: p.rank || `Position ${idx + 1}`,
          title: p.title || "",
          description: null,
          prizeType: p.prizeType || "certificate",
          prizeAmount: p.prizeAmount ?? null,
          additionalPerks: Array.isArray(p.additionalPerks)
            ? p.additionalPerks
            : null,
          sortOrder: p.sortOrder ?? idx,
          isActive: true,
        }));
        await prisma.eventPrize.createMany({ data: prizeRows });
        await prisma.event.update({
          where: { id: seEvent.id },
          data: { prizesEnabled: true },
        });
      }

      createdEvents.push(seEvent);
    }

    return { isFestival: true, events: createdEvents };
  }

  // ── VENUE / STALL: create single event (existing logic) ───────────────────
  if (
    !noting.eventName ||
    !noting.eventType ||
    !noting.eventStartDate ||
    !noting.eventEndDate ||
    !noting.eventPaymentType
  ) {
    throw new ValidationError(
      "Noting must have all required event fields (name, type, dates, payment type)",
    );
  }
  if (noting.eventEndDate < noting.eventStartDate)
    throw new ValidationError(ERRORS.INVALID_EVENT_DATES);

  const participationType = noting.eventParticipationType || "individual";
  const registrationFee =
    noting.eventPaymentType === "paid"
      ? participationType === "team"
        ? noting.eventRegistrationFeeTeam
        : noting.eventRegistrationFeeIndividual
      : null;
  const teamRegistrationFee =
    noting.eventPaymentType === "paid" && participationType === "team"
      ? noting.eventRegistrationFeeTeam
      : null;

  const eventId = await generateEventId(prisma);

  const event = await prisma.event.create({
    data: {
      id: eventId,
      eventId,
      notingId: noting.id,
      name: noting.eventName,
      eventType: noting.eventType,
      startDate: noting.eventStartDate,
      endDate: noting.eventEndDate,
      paymentType: noting.eventPaymentType,
      participationType,
      registrationFee: registrationFee ?? null,
      teamRegistrationFee: teamRegistrationFee ?? null,
      approxCapacity: noting.eventApproxCapacity ?? null,
      dutyLeaveAvailable: noting.eventDutyLeaveAvailable ?? null,
      dutyLeaveEligibility: noting.eventDutyLeaveEligibility ?? null,
      dutyLeaveRoleType: noting.eventDutyLeaveRoleType ?? null,
      hasSponsorship: noting.eventHasSponsorship ?? null,
      sponsors: noting.eventSponsors ?? null,
      hasResources: noting.eventHasResources ?? null,
      resources: noting.eventResources ?? null,
      certificateAvailable: noting.eventCertification ?? false,
      capacityFixed: noting.eventCapacityFixed ?? null,
      description: null,
      longDescription: null,
      status: "draft",
      createdById: noting.createdById,
      updatedAt: new Date(),
      notingEventType: noting.notingEventType || "venue",
      stallConfig: noting.stallConfig || null,
      hasStalls: !!(noting.stallConfig && noting.notingEventType === "stall"),
    },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
        },
      },
      note: true,
    },
  });

  if (
    Array.isArray(noting.eventPrizesAwards) &&
    noting.eventPrizesAwards.length > 0
  ) {
    const prizeRows = noting.eventPrizesAwards.map((p, idx) => ({
      eventId: event.id,
      position: p.position ?? idx + 1,
      rank: p.rank || `Position ${idx + 1}`,
      title: p.title || "",
      description: p.description || null,
      prizeType: p.prizeType || "certificate",
      prizeAmount: p.prizeAmount ?? null,
      additionalPerks: Array.isArray(p.additionalPerks)
        ? p.additionalPerks
        : null,
      sortOrder: p.sortOrder ?? idx,
      isActive: true,
    }));
    await prisma.eventPrize.createMany({ data: prizeRows });
    await prisma.event.update({
      where: { id: event.id },
      data: { prizesEnabled: true },
    });
  }

  return { isFestival: false, event };
};

/**
 * Get event by ID with full details
 */
const getEventDetails = async (eventId, userId) => {
  // Don't include ALL EventRegistration - detail view only needs count + user's own registration
  const [event, currentRegistrations, userRegistration] = await Promise.all([
    getEventById(prisma, eventId, {
      EventVolunteer: {
        take: 20,
        include: {
          user_login: {
            select: {
              id: true,
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
              studentLogin: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
        },
      },
      EventCustomField: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          fieldName: true,
          fieldLabel: true,
          fieldType: true,
          isRequired: true,
          placeholder: true,
          helpText: true,
          options: true,
          sortOrder: true,
        },
      },
      EventPrize: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { position: "asc" }],
        select: {
          id: true,
          position: true,
          rank: true,
          title: true,
          description: true,
          prizeType: true,
          prizeAmount: true,
          additionalPerks: true,
          sortOrder: true,
        },
      },
    }),
    prisma.eventRegistration.count({
      where: { eventId, status: "confirmed" },
    }),
    prisma.eventRegistration.findFirst({
      where: { eventId, userId },
      select: {
        id: true,
        registrationId: true,
        qrCode: true,
        status: true,
        hasEntered: true,
        registeredAt: true,
      },
    }),
  ]);

  event.currentRegistrations = currentRegistrations;
  event.userRegistration = userRegistration;
  return event;
};

/**
 * Validate event has all required fields for save/publish
 * @param {Object} eventData - Event object (or merged event + updateData)
 * @throws {ValidationError} If any required field is missing or invalid
 */
const validateEventRequiredFields = (eventData) => {
  if (!eventData.logoImageUrl || !String(eventData.logoImageUrl).trim()) {
    throw new ValidationError("Please upload an Event Logo.");
  }
  if (!eventData.description || !String(eventData.description).trim()) {
    throw new ValidationError("Please enter a Short Description.");
  }
  const longDesc = eventData.longDescription || "";
  const longDescPlain = String(longDesc)
    .replace(/<[^>]*>/g, "")
    .trim();
  if (!longDescPlain) {
    throw new ValidationError("Please enter a Detailed Description.");
  }
  if (!eventData.registrationStartDate || !eventData.registrationEndDate) {
    throw new ValidationError(
      "Please select both Registration Start and End dates.",
    );
  }
  if (
    !eventData.contactPersonName ||
    !String(eventData.contactPersonName).trim()
  ) {
    throw new ValidationError("Please enter Contact Person Name.");
  }
  if (!eventData.contactEmail || !String(eventData.contactEmail).trim()) {
    throw new ValidationError("Please enter Contact Email.");
  }
  if (!EMAIL_REGEX.test(String(eventData.contactEmail).trim())) {
    throw new ValidationError("Please enter a valid Contact Email address.");
  }
  if (!eventData.venue || !String(eventData.venue).trim()) {
    throw new ValidationError("Venue is required.");
  }
  // Short description: max 10 words
  if (eventData.description) {
    const words = String(eventData.description)
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    if (words > 10) {
      throw new ValidationError("Short Description must be at most 10 words.");
    }
  }
  if (
    eventData.longDescription &&
    eventData.longDescription.length >
      (LIMITS.MAX_LONG_DESCRIPTION_LENGTH || 50000)
  ) {
    throw new ValidationError("Detailed Description exceeds maximum length.");
  }
  if (
    eventData.contactPersonName &&
    eventData.contactPersonName.length > (LIMITS.MAX_CONTACT_NAME_LENGTH || 256)
  ) {
    throw new ValidationError(
      "Contact Person Name must not exceed 256 characters.",
    );
  }
  // Contact mobile - 10 digits when provided
  if (
    eventData.contactMobile &&
    String(eventData.contactMobile).trim() &&
    !isValidMobile(eventData.contactMobile)
  ) {
    throw new ValidationError("Please enter a valid 10-digit mobile number.");
  }
  // Registration cap - 1 to 100000 when set
  if (eventData.registrationCap != null && eventData.registrationCap !== "") {
    const cap = Number(eventData.registrationCap);
    if (
      Number.isNaN(cap) ||
      cap < (LIMITS.REGISTRATION_CAP_MIN ?? 1) ||
      cap > (LIMITS.REGISTRATION_CAP_MAX ?? 100000)
    ) {
      throw new ValidationError(
        `Registration cap must be between ${LIMITS.REGISTRATION_CAP_MIN ?? 1} and ${LIMITS.REGISTRATION_CAP_MAX ?? 100000}.`,
      );
    }
  }
  // Website URL - valid format when provided
  if (
    eventData.websiteUrl &&
    String(eventData.websiteUrl).trim() &&
    !isValidUrl(eventData.websiteUrl)
  ) {
    throw new ValidationError("Please enter a valid website URL.");
  }
  // Social media links - valid URLs when provided
  if (
    eventData.socialMediaLinks &&
    typeof eventData.socialMediaLinks === "object"
  ) {
    for (const [key, val] of Object.entries(eventData.socialMediaLinks)) {
      if (val && String(val).trim() && !isValidUrl(val)) {
        throw new ValidationError(
          `Invalid URL for ${key}. Please enter a valid link.`,
        );
      }
    }
  }
  // Sponsors - when hasSponsorship is true, require at least one sponsor with name
  if (eventData.hasSponsorship === true) {
    const sponsors = Array.isArray(eventData.sponsors)
      ? eventData.sponsors
      : [];
    const validSponsors = sponsors.filter(
      (s) => s && String(s.name || "").trim(),
    );
    if (validSponsors.length === 0) {
      throw new ValidationError(
        "Please add at least one sponsor with a name when Sponsorship is enabled.",
      );
    }
  }
  // Resources - when hasResources is true, require at least one resource
  if (eventData.hasResources === true) {
    const resources = Array.isArray(eventData.resources)
      ? eventData.resources
      : [];
    const validResources = resources.filter(
      (r) =>
        r &&
        (String(r.type || "").trim() || String(r.description || "").trim()),
    );
    if (validResources.length === 0) {
      throw new ValidationError(
        "Please add at least one resource when Resources are enabled.",
      );
    }
  }
  // FAQs - when FAQs exist, each must have question and answer
  if (Array.isArray(eventData.faqs) && eventData.faqs.length > 0) {
    for (let i = 0; i < eventData.faqs.length; i++) {
      const faq = eventData.faqs[i];
      if (!faq || !String(faq.question || "").trim()) {
        throw new ValidationError(`FAQ #${i + 1}: Please enter a question.`);
      }
      if (!faq || !String(faq.answer || "").trim()) {
        throw new ValidationError(`FAQ #${i + 1}: Please enter an answer.`);
      }
    }
  }
};

/**
 * Update event details (only non-locked fields)
 */
const updateEvent = async (eventId, userId, updateData) => {
  const event = await getEventById(prisma, eventId);

  // Verify user is the event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError("Only the event creator can update the event");
  }

  // Locked fields cannot be updated (they come from the noting)
  const lockedFields = [
    "name",
    "eventType",
    "startDate",
    "endDate",
    "paymentType",
    "participationType",
    "isPaid",
    "notingId",
  ];
  // When event is from noting, also lock: sponsorship, duty leave, resources. Capacity (approxCapacity) stays editable.
  if (event.notingId) {
    lockedFields.push(
      "dutyLeaveAvailable",
      "dutyLeaveEligibility",
      "dutyLeaveRoleType",
      "hasSponsorship",
      "sponsors",
      "hasResources",
      "resources",
      "certificateAvailable",
      "capacityFixed",
      "prizesEnabled",
    );
  }
  lockedFields.forEach((field) => {
    if (updateData.hasOwnProperty(field)) {
      delete updateData[field];
    }
  });

  // Validate registration dates if provided
  if (updateData.registrationStartDate || updateData.registrationEndDate) {
    const startDate = updateData.registrationStartDate
      ? new Date(updateData.registrationStartDate)
      : event.registrationStartDate;
    const endDate = updateData.registrationEndDate
      ? new Date(updateData.registrationEndDate)
      : event.registrationEndDate;

    if (startDate && endDate && endDate < startDate) {
      throw new ValidationError(
        "Registration end date must be after start date",
      );
    }

    // Ensure registration dates are before event start (registration opens before the event)
    if (startDate && startDate > event.startDate) {
      throw new ValidationError(
        "Registration start date must be before the event starts",
      );
    }
    if (endDate && endDate > event.startDate) {
      throw new ValidationError(
        "Registration end date must be before the event starts",
      );
    }
  }

  // Convert date strings to proper ISO DateTime for Prisma
  if (updateData.registrationStartDate) {
    updateData.registrationStartDate = new Date(
      updateData.registrationStartDate,
    );
  }
  if (updateData.registrationEndDate) {
    updateData.registrationEndDate = new Date(updateData.registrationEndDate);
  }

  // Sanitize HTML in longDescription to prevent XSS
  if (updateData.longDescription !== undefined) {
    updateData.longDescription = sanitizeHtml(updateData.longDescription || "");
  }

  // Sanitize sponsors (Cash: amount, In-kind: notes/description)
  if (updateData.sponsors !== undefined) {
    updateData.sponsors =
      updateData.hasSponsorship === false
        ? null
        : sanitizeSponsors(updateData.sponsors || []);
  }

  // Prisma rejects null for required Boolean fields - omit them so existing value is kept
  const requiredBooleanFields = [
    "lookingForTeammatesEnabled",
    "allowCrossInstituteTeams",
    "allowTeamEditAfterSubmission",
    "autoApproveTeams",
    "lockTeamAfterDeadline",
    "allowPublicTeamListing",
    "allowJoinRequests",
    "allowInviteSystem",
    "prizesEnabled",
    "requireFormSubmission",
  ];
  requiredBooleanFields.forEach((key) => {
    if (updateData[key] === null) delete updateData[key];
  });

  // Validate merged event data (existing + updates) has all required fields
  const merged = { ...event, ...updateData };
  validateEventRequiredFields(merged);

  // Update event
  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
      note: true,
    },
  });

  return updatedEvent;
};

/**
 * Publish event (make it available for registration)
 */
const publishEvent = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId);

  // Verify user is the event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError("Only the event creator can publish the event");
  }

  // Allow publishing/republishing for draft and already published events
  // (published events can be republished after editing)
  if (
    event.status !== EVENT_STATUS.DRAFT &&
    event.status !== EVENT_STATUS.PUBLISHED
  ) {
    throw new ValidationError(
      "Only draft or published events can be (re)published",
    );
  }

  // Validate event has all required details before publishing
  validateEventRequiredFields(event);

  // Update event status and published timestamp
  const updateData = {
    status: EVENT_STATUS.PUBLISHED,
  };

  // Only set publishedAt on first publish (not on republish)
  if (event.status !== EVENT_STATUS.PUBLISHED) {
    updateData.publishedAt = new Date();
  }

  // Update event
  const publishedEvent = await prisma.event.update({
    where: { id: eventId },
    data: updateData,
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
      note: true,
    },
  });

  return publishedEvent;
};

/**
 * List events with filters and pagination
 */
const listEvents = async (filters, pagination, userId) => {
  const { page = 1, limit = 20 } = pagination;
  const {
    status,
    eventType,
    search,
    myEvents,
    filter: specialFilter,
    studentApply,
  } = filters;

  // ── Lean SELECT for list view (no heavy include) ─────────────────────────
  // Instead of include: { user_login: { ... } } which triggers an extra JOIN on
  // every row, we use a lean select projection. The creator name is rarely
  // shown on list cards, but if needed it is resolved cheaply below.
  const EVENT_LIST_SELECT = {
    id: true,
    eventId: true,
    name: true,
    eventType: true,
    status: true,
    startDate: true,
    endDate: true,
    venue: true,
    paymentType: true,
    registrationFee: true,
    teamRegistrationFee: true,
    maxCapacity: true,
    approxCapacity: true,
    createdById: true,
    createdAt: true,
    updatedAt: true,
    description: true,
    notingId: true,
    festivalNotingId: true,
    festivalMeta: true,
    hasStalls: true,
    stallConfig: true,
    bannerImageUrl: true,
    participationType: true,
    capacityFixed: true,
    prizesEnabled: true,
  };

  // Special stall-open filter: return events open for student stall applications
  if (specialFilter === "stall-open" || studentApply === "true") {
    const where = {
      hasStalls: true,
      status: { in: ["published", "ongoing"] },
    };
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        select: {
          ...EVENT_LIST_SELECT,
          user_login: {
            select: {
              id: true,
              uid: true,
              email: true,
              employeeDetails: { select: { firstName: true, lastName: true } },
            },
          },
          _count: {
            select: {
              StallApplication: {
                where: { applicationStatus: { in: ["pending", "approved"] } },
              },
            },
          },
        },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { startDate: "asc" },
      }),
      prisma.event.count({ where }),
    ]);
    return {
      events: events.map((e) => ({
        ...e,
        currentRegistrations: 0,
        isPaid: e.paymentType === "paid",
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  const where = {};

  // Draft events are only visible to their creator
  // Published/Ongoing/Completed events are visible to everyone
  if (myEvents) {
    where.createdById = userId;
    if (status) {
      where.status = status;
    }
  } else {
    where.OR = [
      { status: { in: ["published", "ongoing", "completed"] } },
      { AND: [{ status: "draft" }, { createdById: userId }] },
    ];

    if (status) {
      if (status === "draft") {
        where.AND = [{ status: "draft" }, { createdById: userId }];
        delete where.OR;
      } else {
        where.status = status;
        delete where.OR;
      }
    }
  }

  if (eventType) {
    where.eventType = eventType;
  }

  if (search) {
    where.OR = where.OR || [];
    const searchConditions = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { eventId: { contains: search, mode: "insensitive" } },
    ];

    if (where.OR.length > 0) {
      where.AND = where.AND || [];
      where.AND.push({ OR: searchConditions });
    } else {
      where.OR = searchConditions;
    }
  }

  // ── Visibility filter: exclude events user cannot see ─────────────────
  // We do this by finding event IDs that are explicitly hidden from this user,
  // then excluding them. Events without visibility config remain visible (legacy).
  const userForVisibility = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: {
      role: true,
      studentLogin: {
        select: {
          programId: true,
          sectionId: true,
          program: {
            select: {
              id: true,
              departmentId: true,
              department: { select: { id: true, facultyId: true } },
            },
          },
          section: { select: { id: true, batchYear: true } },
        },
      },
    },
  });

  // Only apply visibility filter if not a superadmin (superadmin sees all)
  if (userForVisibility && userForVisibility.role !== 'superadmin' && !myEvents) {
    // Get all visibility records for events that are either inactive or exclude this role
    const allVisibility = await prisma.eventVisibility.findMany({
      select: {
        eventId: true,
        isActive: true,
        visibleToRoles: true,
        studentFilterType: true,
        allowedSchoolIds: true,
        allowedDepartmentIds: true,
        allowedProgramIds: true,
        allowedBatchYears: true,
        allowedSectionIds: true,
      },
    });

    const hiddenEventIds = [];
    const role = userForVisibility.role;
    const student = userForVisibility.studentLogin;

    for (const v of allVisibility) {
      // NOTE: isActive controls registration open/close, NOT visibility.
      // So we do NOT hide events based on isActive — only role/student filters.

      const roles = Array.isArray(v.visibleToRoles) ? v.visibleToRoles : [];
      if (!roles.includes(role)) { hiddenEventIds.push(v.eventId); continue; }

      // Student granular filtering
      if (role === 'student' && v.studentFilterType === 'custom' && student) {
        const schools = Array.isArray(v.allowedSchoolIds) ? v.allowedSchoolIds : [];
        const depts = Array.isArray(v.allowedDepartmentIds) ? v.allowedDepartmentIds : [];
        const progs = Array.isArray(v.allowedProgramIds) ? v.allowedProgramIds : [];
        const batches = Array.isArray(v.allowedBatchYears) ? v.allowedBatchYears : [];
        const sects = Array.isArray(v.allowedSectionIds) ? v.allowedSectionIds : [];

        const hasAnyFilter = schools.length + depts.length + progs.length + batches.length + sects.length > 0;
        if (hasAnyFilter) {
          let matched = false;
          if (sects.length > 0 && student.sectionId && sects.includes(student.sectionId)) matched = true;
          if (!matched && batches.length > 0 && student.section?.batchYear && batches.includes(student.section.batchYear)) matched = true;
          if (!matched && progs.length > 0 && student.programId && progs.includes(student.programId)) matched = true;
          if (!matched && depts.length > 0 && student.program?.departmentId && depts.includes(student.program.departmentId)) matched = true;
          if (!matched && schools.length > 0 && student.program?.department?.facultyId && schools.includes(student.program.department.facultyId)) matched = true;
          if (!matched) hiddenEventIds.push(v.eventId);
        }
      } else if (role === 'student' && v.studentFilterType === 'custom' && !student) {
        hiddenEventIds.push(v.eventId);
      }
    }

    if (hiddenEventIds.length > 0) {
      where.NOT = { ...(where.NOT || {}), id: { in: hiddenEventIds } };
    }
  }

  // ── Parallel fetch: page of events + total count ─────────────────────────
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      // Use lean select instead of full include — avoids JOIN on every list row
      select: {
        ...EVENT_LIST_SELECT,
        user_login: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: { firstName: true, lastName: true, displayName: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  // ── Batch registration counts via raw SQL (single round-trip) ────────────
  // ORM groupBy fires one query per eventId internally in some Prisma versions.
  // A single raw aggregation with conditional COUNT is always one query.
  let countMap = new Map();
  if (events.length > 0) {
    const eventIds = events.map((e) => e.id);
    const rows = await prisma.$queryRaw`
      SELECT "eventId", COUNT(*)::int AS cnt
      FROM "EventRegistration"
      WHERE "eventId" = ANY(${eventIds}::text[])
        AND status = 'confirmed'
      GROUP BY "eventId"
    `;
    countMap = new Map(rows.map((r) => [r.eventId, r.cnt]));
  }

  const eventsWithCount = events.map((event) => ({
    ...event,
    currentRegistrations: countMap.get(event.id) ?? 0,
  }));

  return {
    events: eventsWithCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Register user for event
 */
const registerForEvent = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId);

  // Check if registration is open (via Event Settings toggle)
  const { isRegistrationOpen } = require('./eventSettings.service');
  const regOpen = await isRegistrationOpen(event.id);
  if (!regOpen) {
    throw new ValidationError('Registration is currently closed for this event');
  }

  // Validate registration eligibility
  await canRegisterForEvent(prisma, event, userId);

  // Generate registration ID and QR code
  const registrationId = await generateRegistrationId(prisma, event.eventId);
  const qrCode = generateQRCode(event.eventId, userId);

  // Determine payment status
  const paymentStatus = event.isPaid
    ? PAYMENT_STATUS.PENDING
    : PAYMENT_STATUS.COMPLETED;
  const registrationStatus = event.isPaid
    ? REGISTRATION_STATUS.PENDING
    : REGISTRATION_STATUS.CONFIRMED;

  // Create registration
  const registration = await prisma.$transaction(async (tx) => {
    const reg = await tx.eventRegistration.create({
      data: {
        id: registrationId, // Use registrationId as primary key
        registrationId,
        eventId: event.id,
        userId,
        qrCode,
        status: registrationStatus,
        paymentStatus,
        updatedAt: new Date(),
      },
      include: {
        user_login: {
          select: {
            id: true,
            uid: true,
            email: true,
            employeeDetails: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
            studentLogin: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
                registrationNo: true,
                studentId: true,
              },
            },
          },
        },
        Event: {
          select: {
            id: true,
            eventId: true,
            name: true,
            eventType: true,
            startDate: true,
            endDate: true,
            venue: true,
          },
        },
      },
    });

    return reg;
  });

  return registration;
};

/**
 * Get user's registrations
 */
const getUserRegistrations = async (userId, filters, pagination) => {
  const { page = 1, limit = 20 } = pagination;
  const { status } = filters;

  const where = { userId };

  if (status) {
    where.status = status;
  }

  const [registrations, total] = await Promise.all([
    prisma.eventRegistration.findMany({
      where,
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
            status: true,
          },
        },
      },
      orderBy: {
        registeredAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.eventRegistration.count({ where }),
  ]);

  return {
    registrations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Assign volunteer to event
 */
const assignVolunteer = async (eventId, userId, volunteerData, assignedBy) => {
  const event = await getEventById(prisma, eventId);

  // Verify user is the event creator
  if (event.createdById !== assignedBy) {
    throw new ForbiddenError("Only the event creator can assign volunteers");
  }

  // Check if volunteer already assigned
  const existing = await prisma.eventVolunteer.findFirst({
    where: {
      eventId,
      userId,
    },
  });

  if (existing) {
    throw new ValidationError(
      "User is already assigned as a volunteer for this event",
    );
  }

  // Create volunteer assignment
  const volunteer = await prisma.eventVolunteer.create({
    data: {
      id: crypto.randomUUID(), // Generate UUID for primary key
      eventId,
      userId,
      role: volunteerData.role,
      canScanQr:
        volunteerData.canScanQr !== undefined ? volunteerData.canScanQr : true,
      assignedGate: volunteerData.assignedGate,
    },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  return volunteer;
};

/**
 * Scan QR code for event entry/exit
 */
const scanQRCode = async (
  eventId,
  qrCode,
  entryType,
  volunteerId,
  scanData,
) => {
  // Verify volunteer authorization
  const canScan = await isEventVolunteer(prisma, eventId, volunteerId);
  if (!canScan) {
    throw new ForbiddenError(ERRORS.NOT_A_VOLUNTEER);
  }

  // Validate QR code and get registration
  const registration = await validateQRCodeAndGetRegistration(
    prisma,
    qrCode,
    eventId,
  );

  // Entry: block if already checked in (must checkout first)
  if (entryType === "entry" && registration.hasEntered) {
    throw new ValidationError(ERRORS.ALREADY_ENTERED);
  }
  // Exit: block if not checked in (must checkin first)
  if (entryType === "exit" && !registration.hasEntered) {
    throw new ValidationError(ERRORS.NOT_CHECKED_IN);
  }

  // Get volunteer details
  const volunteer = await prisma.eventVolunteer.findFirst({
    where: {
      eventId,
      userId: volunteerId,
    },
  });

  // Create entry log
  const entry = await prisma.$transaction(async (tx) => {
    const entryLog = await tx.eventEntry.create({
      data: {
        id: crypto.randomUUID(), // Generate UUID for primary key
        eventId,
        registrationId: registration.id,
        volunteerId: volunteer.id,
        entryType,
        gateLocation: scanData.gateLocation,
        remarks: scanData.remarks,
      },
      include: {
        EventRegistration: {
          include: {
            user_login: {
              select: {
                id: true,
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
                studentLogin: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    registrationNo: true,
                    studentId: true,
                  },
                },
              },
            },
          },
        },
        EventVolunteer: {
          include: {
            user_login: {
              select: {
                id: true,
                uid: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Update registration entry status
    if (entryType === "entry") {
      await tx.eventRegistration.update({
        where: { id: registration.id },
        data: {
          hasEntered: true,
          enteredAt: new Date(),
        },
      });
    } else if (entryType === "exit") {
      await tx.eventRegistration.update({
        where: { id: registration.id },
        data: {
          hasEntered: false,
        },
      });
    }

    return entryLog;
  });

  return entry;
};

/**
 * Get event statistics (comprehensive)
 * Optimized: Single raw SQL for counts + date grouping, separate query for recent registrations
 */
const getEventStatistics = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId);

  // Verify user is the event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError("Only the event creator can view statistics");
  }

  // Single raw SQL for all registration counts + revenue (replaces 6 count + 1 aggregate queries)
  const statsResult = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int as confirmed,
      COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled,
      COUNT(*) FILTER (WHERE status = 'waitlisted')::int as waitlisted,
      COUNT(*) FILTER (WHERE "hasEntered" = true)::int as attended,
      COALESCE(SUM("amountPaid") FILTER (WHERE "paymentStatus" = 'completed'), 0)::float as revenue
    FROM "EventRegistration"
    WHERE "eventId" = ${eventId}
  `;
  const stats = statsResult[0] || {};

  // Date grouping via SQL (replaces full table scan findMany)
  const dateGroups = await prisma.$queryRaw`
    SELECT DATE("registeredAt")::text as date, COUNT(*)::int as count
    FROM "EventRegistration"
    WHERE "eventId" = ${eventId}
    GROUP BY DATE("registeredAt")
    ORDER BY date ASC
  `;

  const [volunteerCount, totalEntries, totalExits, recentRegistrations] =
    await Promise.all([
      prisma.eventVolunteer.count({ where: { eventId } }),
      prisma.eventEntry.count({ where: { eventId, entryType: "entry" } }),
      prisma.eventEntry.count({ where: { eventId, entryType: "exit" } }),
      prisma.eventRegistration.findMany({
        where: { eventId },
        include: {
          user_login: {
            select: {
              id: true,
              uid: true,
              email: true,
              employeeDetails: {
                select: {
                  firstName: true,
                  lastName: true,
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: { registeredAt: "desc" },
        take: 50,
      }),
    ]);

  const registrationsByDate = dateGroups.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
  const currentlyInside = Math.max(0, (totalEntries || 0) - (totalExits || 0));
  const totalRevenue = Number(stats.revenue) || 0;

  return {
    totalRegistrations: stats.total || 0,
    confirmedRegistrations: stats.confirmed || 0,
    pendingRegistrations: stats.pending || 0,
    cancelledRegistrations: stats.cancelled || 0,
    waitlistedRegistrations: stats.waitlisted || 0,
    totalAttended: stats.attended || 0,
    totalEntries,
    totalExits,
    currentlyInside,
    volunteerCount,
    totalRevenue,
    revenueCollected: totalRevenue,
    registrationsByDate,
    recentRegistrations: recentRegistrations.map((r) => ({
      id: r.id,
      registrationId: r.registrationId,
      status: r.status,
      paymentStatus: r.paymentStatus,
      amountPaid: r.amountPaid,
      hasEntered: r.hasEntered,
      registeredAt: r.registeredAt,
      user: r.user_login
        ? {
            id: r.user_login.id,
            uid: r.user_login.uid,
            email: r.user_login.email,
            name:
              r.user_login.employeeDetails?.displayName ||
              `${r.user_login.employeeDetails?.firstName || ""} ${r.user_login.employeeDetails?.lastName || ""}`.trim() ||
              r.user_login.uid,
          }
        : null,
    })),
  };
};

/**
 * Get events where the current user is assigned as a volunteer
 */
const getMyVolunteerAssignments = async (userId) => {
  const assignments = await prisma.eventVolunteer.findMany({
    where: { userId },
    include: {
      Event: {
        select: {
          id: true,
          eventId: true,
          name: true,
          eventType: true,
          description: true,
          startDate: true,
          endDate: true,
          venue: true,
          status: true,
          bannerImageUrl: true,
          maxCapacity: true,
          _count: {
            select: { EventRegistration: true },
          },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  return assignments.map((a) => ({
    id: a.id,
    eventId: a.eventId,
    role: a.role,
    canScanQr: a.canScanQr,
    assignedGate: a.assignedGate,
    assignedAt: a.assignedAt,
    event: a.Event
      ? {
          id: a.Event.id,
          eventId: a.Event.eventId,
          name: a.Event.name,
          eventType: a.Event.eventType,
          description: a.Event.description,
          startDate: a.Event.startDate,
          endDate: a.Event.endDate,
          venue: a.Event.venue,
          status: a.Event.status,
          bannerImageUrl: a.Event.bannerImageUrl,
          currentRegistrations: a.Event._count?.EventRegistration || 0,
          maxCapacity: a.Event.maxCapacity,
        }
      : null,
  }));
};

/**
 * Get volunteer scan activity history for the current user
 */
const getMyVolunteerActivity = async (userId, filters = {}) => {
  const { page = 1, limit = 30, eventId, search, startDate, endDate } = filters;

  // First get volunteer IDs for this user
  const volunteerRecords = await prisma.eventVolunteer.findMany({
    where: { userId },
    select: { id: true, eventId: true },
  });

  if (volunteerRecords.length === 0) {
    return {
      entries: [],
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  const volunteerIds = volunteerRecords.map((v) => v.id);
  const volunteerEventIds = volunteerRecords.map((v) => v.eventId);

  const where = {
    volunteerId: { in: volunteerIds },
  };

  if (eventId) {
    where.eventId = eventId;
  }

  if (startDate || endDate) {
    where.scannedAt = {};
    if (startDate) where.scannedAt.gte = new Date(startDate);
    if (endDate) where.scannedAt.lte = new Date(endDate);
  }

  const [entries, total] = await Promise.all([
    prisma.eventEntry.findMany({
      where,
      include: {
        EventRegistration: {
          include: {
            user_login: {
              select: {
                id: true,
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
                studentLogin: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    registrationNo: true,
                  },
                },
              },
            },
          },
        },
        Event: {
          select: {
            id: true,
            eventId: true,
            name: true,
            eventType: true,
            venue: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { scannedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.eventEntry.count({ where }),
  ]);

  // Format entries with user names
  const formattedEntries = entries.map((e) => {
    const userLogin = e.EventRegistration?.user_login;
    const empDetails = userLogin?.employeeDetails;
    const studentDetails = userLogin?.studentLogin;
    const userName =
      empDetails?.displayName ||
      `${empDetails?.firstName || ""} ${empDetails?.lastName || ""}`.trim() ||
      studentDetails?.displayName ||
      `${studentDetails?.firstName || ""} ${studentDetails?.lastName || ""}`.trim() ||
      userLogin?.uid ||
      "Unknown";

    return {
      id: e.id,
      eventId: e.eventId,
      registrationId: e.registrationId,
      entryType: e.entryType,
      scannedAt: e.scannedAt,
      gateLocation: e.gateLocation,
      remarks: e.remarks,
      event: e.Event
        ? {
            id: e.Event.id,
            eventId: e.Event.eventId,
            name: e.Event.name,
            eventType: e.Event.eventType,
            venue: e.Event.venue,
            startDate: e.Event.startDate,
            endDate: e.Event.endDate,
          }
        : null,
      participant: {
        id: userLogin?.id || null,
        uid: userLogin?.uid || null,
        email: userLogin?.email || null,
        name: userName,
        registrationNo: studentDetails?.registrationNo || null,
      },
    };
  });

  return {
    entries: formattedEntries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get volunteer activity for a specific volunteer (event creator view)
 */
const getVolunteerActivity = async (
  eventId,
  volunteerId,
  userId,
  filters = {},
) => {
  const event = await getEventById(prisma, eventId);
  if (event.createdById !== userId) {
    throw new ForbiddenError(
      "Only the event creator can view volunteer activity",
    );
  }

  const volunteer = await prisma.eventVolunteer.findFirst({
    where: { id: volunteerId, eventId },
    include: {
      user_login: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
          studentLogin: {
            select: {
              firstName: true,
              lastName: true,
              displayName: true,
              registrationNo: true,
            },
          },
        },
      },
    },
  });

  if (!volunteer) {
    throw new NotFoundError("Volunteer not found for this event");
  }

  const { page = 1, limit = 50, startDate, endDate } = filters;
  const where = { eventId, volunteerId };

  if (startDate || endDate) {
    where.scannedAt = {};
    if (startDate) where.scannedAt.gte = new Date(startDate);
    if (endDate) where.scannedAt.lte = new Date(endDate);
  }

  const [entries, total] = await Promise.all([
    prisma.eventEntry.findMany({
      where,
      include: {
        EventRegistration: {
          include: {
            user_login: {
              select: {
                id: true,
                uid: true,
                email: true,
                employeeDetails: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                  },
                },
                studentLogin: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    registrationNo: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { scannedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.eventEntry.count({ where }),
  ]);

  const ul = volunteer.user_login;
  const emp = ul?.employeeDetails;
  const stu = ul?.studentLogin;
  const volunteerName =
    emp?.displayName ||
    (emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : null) ||
    stu?.displayName ||
    (stu ? `${stu.firstName || ""} ${stu.lastName || ""}`.trim() : null) ||
    ul?.uid ||
    "Unknown";

  const formattedEntries = entries.map((e) => {
    const userLogin = e.EventRegistration?.user_login;
    const empDetails = userLogin?.employeeDetails;
    const studentDetails = userLogin?.studentLogin;
    const userName =
      empDetails?.displayName ||
      `${empDetails?.firstName || ""} ${empDetails?.lastName || ""}`.trim() ||
      studentDetails?.displayName ||
      `${studentDetails?.firstName || ""} ${studentDetails?.lastName || ""}`.trim() ||
      userLogin?.uid ||
      "Unknown";

    return {
      id: e.id,
      eventId: e.eventId,
      registrationId: e.registrationId,
      entryType: e.entryType,
      scannedAt: e.scannedAt,
      gateLocation: e.gateLocation,
      remarks: e.remarks,
      participant: {
        id: userLogin?.id || null,
        uid: userLogin?.uid || null,
        email: userLogin?.email || null,
        name: userName,
        registrationNo: studentDetails?.registrationNo || null,
      },
    };
  });

  return {
    volunteer: {
      id: volunteer.id,
      role: volunteer.role,
      assignedGate: volunteer.assignedGate,
      canScanQr: volunteer.canScanQr,
      assignedAt: volunteer.assignedAt,
      user: ul
        ? { id: ul.id, uid: ul.uid, email: ul.email, name: volunteerName }
        : null,
    },
    event: {
      id: event.id,
      eventId: event.eventId,
      name: event.name,
      venue: event.venue,
      startDate: event.startDate,
      endDate: event.endDate,
    },
    entries: formattedEntries,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Submit event feedback (10 points 1-10 + short description)
 * Public - no auth required
 */
const submitEventFeedback = async (eventId, { points, shortDescription }) => {
  const event = await getEventById(prisma, eventId);
  if (!event) throw new NotFoundError("Event not found");

  const pts = Array.isArray(points) ? points : [];
  if (pts.length !== 10) {
    throw new ValidationError(
      "Please provide exactly 10 ratings (1-10) for each point.",
    );
  }
  const valid = pts.every((p) => typeof p === "number" && p >= 1 && p <= 10);
  if (!valid) {
    throw new ValidationError("Each point must be a number between 1 and 10.");
  }

  const feedback = await prisma.eventFeedback.create({
    data: {
      eventId,
      points: pts,
      shortDescription: shortDescription
        ? String(shortDescription).trim().slice(0, 2000)
        : null,
    },
  });
  return feedback;
};

/**
 * Get minimal event info for feedback form (public - no auth, for QR scanner users)
 */
const getEventFeedbackFormInfo = async (eventId) => {
  const event = await getEventById(prisma, eventId);
  if (!event || event.status !== "published") {
    throw new NotFoundError("Event not found");
  }
  return { id: event.id, name: event.name };
};

/**
 * Get event feedback list (event creator only)
 */
const getEventFeedback = async (eventId, userId, { page = 1, limit = 20 }) => {
  const event = await getEventById(prisma, eventId);
  if (!event) throw new NotFoundError("Event not found");
  if (event.createdById !== userId) {
    throw new ForbiddenError("Only the event creator can view feedback");
  }

  const [items, total] = await Promise.all([
    prisma.eventFeedback.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.eventFeedback.count({ where: { eventId } }),
  ]);

  const allFeedback = await prisma.eventFeedback.findMany({
    where: { eventId },
    select: { points: true },
  });
  const overallAvg =
    allFeedback.length > 0
      ? allFeedback.reduce(
          (sum, f) =>
            sum +
            (Array.isArray(f.points)
              ? f.points.reduce((a, b) => a + b, 0) / 10
              : 0),
          0,
        ) / allFeedback.length
      : 0;

  return {
    feedback: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalFeedback: await prisma.eventFeedback.count({ where: { eventId } }),
      overallAvg: Number(overallAvg.toFixed(2)),
    },
  };
};

module.exports = {
  createEventFromNoting,
  getEventDetails,
  updateEvent,
  publishEvent,
  listEvents,
  registerForEvent,
  getUserRegistrations,
  assignVolunteer,
  scanQRCode,
  getEventStatistics,
  getMyVolunteerAssignments,
  getMyVolunteerActivity,
  getVolunteerActivity,
  submitEventFeedback,
  getEventFeedback,
  getEventFeedbackFormInfo,
};
