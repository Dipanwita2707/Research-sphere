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
  getEventLean,
  canRegisterForEvent,
  isEventVolunteer,
  validateQRCodeAndGetRegistration,
} = require("../utils/eventHelpers");
const { generateQRCode } = require("../utils/qrCodeGenerator");
const crypto = require("crypto");

// ── Event cache invalidation helper ──────────────────────────────────────────
// Called by mutation functions (update, publish, register) to bust stale cache.
async function invalidateEventCaches(eventId) {
  await Promise.all([
    cache.del(`event:detail:${eventId}`),
    cache.del(`event:stats:${eventId}`),
  ]);
}

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

  // ── FESTIVAL: create one event per sub-event inside a single transaction ──
  if (noting.notingEventType === "festival") {
    const subEvents = Array.isArray(noting.subEvents) ? noting.subEvents : [];
    if (subEvents.length === 0) {
      throw new ValidationError(
        "Festival noting has no sub-events to create events from",
      );
    }

    // Pre-generate all event IDs before the transaction
    // Generate the first ID from DB, then increment for subsequent sub-events
    // to avoid duplicate IDs (generateEventId queries DB which hasn't been updated yet)
    const subEventConfigs = [];
    let baseSequence = null;
    const year = new Date().getFullYear();
    const prefix = `EVT-${year}-`;

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

      let seEventId;
      if (baseSequence === null) {
        // First sub-event: query DB for the latest sequence
        seEventId = await generateEventId(prisma);
        baseSequence = parseInt(seEventId.split('-')[2]);
      } else {
        // Subsequent sub-events: just increment from the base
        baseSequence++;
        seEventId = `${prefix}${baseSequence.toString().padStart(4, '0')}`;
      }
      subEventConfigs.push({ se, v, seEventId });
    }

    // Wrap all sub-event creates in a single transaction for atomicity and performance
    const createdEvents = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const { se, v, seEventId } of subEventConfigs) {
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

        const seEvent = await tx.event.create({
          data: {
            id: seEventId,
            eventId: seEventId,
            notingId: noting.id,
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
            festivalMeta: noting.festivalMeta || null,
            festivalNotingId: noting.id,
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
          await tx.eventPrize.createMany({ data: prizeRows });
          await tx.event.update({
            where: { id: seEvent.id },
            data: { prizesEnabled: true },
          });
        }

        results.push(seEvent);
      }
      return results;
    });

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
 * Caches the event base data per eventId (user-specific data always fetched fresh).
 */
const getEventDetails = async (eventId, userId) => {
  // Try cache for event base data
  const cacheKey = `event:detail:${eventId}`;
  let event = await cache.get(cacheKey);

  if (!event) {
    // Cache miss — fetch from DB and cache
    event = await getEventById(prisma, eventId, {
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
    });
    // Cache event base data (2 min TTL)
    await cache.set(cacheKey, event, 120);
  }

  // User-specific data always fetched fresh (not cached)
  const [currentRegistrations, userRegistration] = await Promise.all([
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
  if (
    eventData.contactPersonName &&
    String(eventData.contactPersonName).trim().length < 2
  ) {
    throw new ValidationError(
      "Contact Person Name must be at least 2 characters.",
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
  // Fee validation for paid events — minimum ₹1, no zero or negative fees
  if (eventData.paymentType === "paid") {
    if (eventData.participationType === "team") {
      const fee = Number(eventData.teamRegistrationFee);
      if (eventData.teamRegistrationFee == null || isNaN(fee) || fee < 1) {
        throw new ValidationError("Participation fee must be at least \u20b91.");
      }
    } else {
      const fee = Number(eventData.registrationFee);
      if (eventData.registrationFee == null || isNaN(fee) || fee < 1) {
        throw new ValidationError("Participation fee must be at least \u20b91.");
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
  // When event is from noting, also lock: fee fields, sponsorship, duty leave, resources. Capacity (approxCapacity) stays editable.
  if (event.notingId) {
    lockedFields.push(
      "registrationFee",
      "teamRegistrationFee",
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

  await invalidateEventCaches(eventId);
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

  // Opportunity mode must be explicitly chosen before publishing
  const VALID_OPPORTUNITY_MODES = ['online', 'offline', 'hybrid'];
  if (!event.opportunityMode || !VALID_OPPORTUNITY_MODES.includes(event.opportunityMode)) {
    throw new ValidationError(
      "Please select a Mode of Opportunity (Online, Offline, or Hybrid) before publishing.",
    );
  }

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

  await invalidateEventCaches(eventId);
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
  // Use buildVisibilityFilter to push filtering to SQL instead of loading all records into memory
  if (!myEvents) {
    const { buildVisibilityFilter } = require('./eventSettings.service');
    const visibilityFilter = await buildVisibilityFilter(userId);
    // Merge visibility filter into the where clause
    if (visibilityFilter && Object.keys(visibilityFilter).length > 0) {
      where.AND = where.AND || [];
      where.AND.push(visibilityFilter);
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

  // Bust stats cache after new registration
  await invalidateEventCaches(event.id);
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
  const event = await getEventLean(prisma, eventId);

  // Verify user is the event creator
  if (event.createdById !== userId) {
    throw new ForbiddenError("Only the event creator can view statistics");
  }

  // Check cache first (1 min TTL — stats change frequently with registrations)
  const cacheKey = `event:stats:${eventId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // Single raw SQL for all registration counts + revenue (replaces 6 count + 1 aggregate queries)
  // Also includes volunteer count, entry/exit counts in one combined query
  const [statsResult, dateGroups, recentRegistrations] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM "EventRegistration" WHERE "eventId" = ${eventId}) as total,
        (SELECT COUNT(*)::int FROM "EventRegistration" WHERE "eventId" = ${eventId} AND status = 'confirmed') as confirmed,
        (SELECT COUNT(*)::int FROM "EventRegistration" WHERE "eventId" = ${eventId} AND status = 'pending') as pending,
        (SELECT COUNT(*)::int FROM "EventRegistration" WHERE "eventId" = ${eventId} AND status = 'cancelled') as cancelled,
        (SELECT COUNT(*)::int FROM "EventRegistration" WHERE "eventId" = ${eventId} AND status = 'waitlisted') as waitlisted,
        (SELECT COUNT(*)::int FROM "EventRegistration" WHERE "eventId" = ${eventId} AND "hasEntered" = true) as attended,
        (SELECT COALESCE(SUM("amountPaid"), 0)::float FROM "EventRegistration" WHERE "eventId" = ${eventId} AND "paymentStatus" = 'completed') as revenue,
        (SELECT COUNT(*)::int FROM "EventVolunteer" WHERE "eventId" = ${eventId}) as "volunteerCount",
        (SELECT COUNT(*)::int FROM "EventEntry" WHERE "eventId" = ${eventId} AND "entryType" = 'entry') as "totalEntries",
        (SELECT COUNT(*)::int FROM "EventEntry" WHERE "eventId" = ${eventId} AND "entryType" = 'exit') as "totalExits"
    `,
    // Date grouping via SQL (replaces full table scan findMany)
    prisma.$queryRaw`
      SELECT DATE("registeredAt")::text as date, COUNT(*)::int as count
      FROM "EventRegistration"
      WHERE "eventId" = ${eventId}
      GROUP BY DATE("registeredAt")
      ORDER BY date ASC
    `,
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

  const stats = statsResult[0] || {};
  const volunteerCount = stats.volunteerCount || 0;
  const totalEntries = stats.totalEntries || 0;
  const totalExits = stats.totalExits || 0;

  const registrationsByDate = dateGroups.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
  const currentlyInside = Math.max(0, (totalEntries || 0) - (totalExits || 0));
  const totalRevenue = Number(stats.revenue) || 0;

  const result = {
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

  // Cache the result (1 min TTL)
  await cache.set(cacheKey, result, 60);
  return result;
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
  const event = await getEventLean(prisma, eventId);
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
  const event = await getEventLean(prisma, eventId);

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
  const event = await getEventLean(prisma, eventId);
  if (event.status !== "published") {
    throw new NotFoundError("Event not found");
  }
  return { id: event.id, name: event.name };
};

/**
 * Get event feedback list (event creator only)
 */
const getEventFeedback = async (eventId, userId, { page = 1, limit = 20 }) => {
  const event = await getEventLean(prisma, eventId);
  if (event.createdById !== userId) {
    throw new ForbiddenError("Only the event creator can view feedback");
  }

  // Fetch paginated items, count, and average in parallel (single pass each)
  // Replaces the previous double table scan (findMany ALL → reduce in JS + redundant count)
  const [items, total, avgResult] = await Promise.all([
    prisma.eventFeedback.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.eventFeedback.count({ where: { eventId } }),
    // Use raw SQL to compute average of JSON array points in one pass
    // Each feedback has points: [1-10, 1-10, ...10 items], avg per feedback = sum/10
    prisma.$queryRaw`
      SELECT COALESCE(
        AVG(
          (SELECT SUM(val::float) / 10
           FROM jsonb_array_elements_text(points::jsonb) AS val)
        ), 0
      )::float AS "overallAvg"
      FROM "event_feedback"
      WHERE "eventId" = ${eventId}
    `,
  ]);

  const overallAvg = avgResult[0]?.overallAvg ?? 0;

  return {
    feedback: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalFeedback: total, // Reuse count instead of redundant second count()
      overallAvg: Number(overallAvg.toFixed(2)),
    },
  };
};

/**
 * Get stall info for feedback form (public - no auth)
 */
const getStallFeedbackFormInfo = async (eventId, stallId) => {
  const event = await getEventLean(prisma, eventId);
  if (event.status !== 'published') {
    throw new NotFoundError('Event not found');
  }
  const stall = await prisma.stall.findFirst({
    where: { stallId, eventId: event.id, isActive: true },
  });
  if (!stall) throw new NotFoundError('Stall not found');
  return { id: event.id, eventName: event.name, stallId: stall.stallId, stallName: stall.stallName };
};

/**
 * Submit stall feedback (public - no auth)
 */
const STALL_FEEDBACK_LABELS = [
  'Overall Experience', 'Product / Food Quality', 'Pricing & Value',
  'Staff Friendliness', 'Cleanliness', 'Presentation & Setup',
  'Wait Time', 'Variety', 'Packaging', 'Would Recommend',
];

const submitStallFeedback = async (eventId, stallId, { points, shortDescription }) => {
  const event = await getEventLean(prisma, eventId);

  const stall = await prisma.stall.findFirst({
    where: { stallId, eventId: event.id, isActive: true },
  });
  if (!stall) throw new NotFoundError('Stall not found');

  const pts = Array.isArray(points) ? points : [];
  if (pts.length !== 10) {
    throw new ValidationError('Please provide exactly 10 ratings (1-10) for each criterion.');
  }
  const valid = pts.every((p) => typeof p === 'number' && p >= 1 && p <= 10);
  if (!valid) throw new ValidationError('Each rating must be a number between 1 and 10.');

  const feedback = await prisma.stallFeedback.create({
    data: {
      eventId: event.id,
      stallId: stall.stallId,
      points: pts,
      shortDescription: shortDescription ? String(shortDescription).trim().slice(0, 2000) : null,
    },
  });
  return { id: feedback.id };
};

/**
 * Get stall feedback list (event creator only)
 */
const getStallFeedback = async (eventId, stallId, userId, { page = 1, limit = 20 }) => {
  const event = await getEventLean(prisma, eventId);
  if (event.createdById !== userId) throw new ForbiddenError('Only the event creator can view stall feedback');

  const stall = await prisma.stall.findFirst({ where: { stallId, eventId: event.id } });
  if (!stall) throw new NotFoundError('Stall not found');

  // Fetch paginated items, count, and average in parallel (single pass each)
  // Replaces the double table scan (findMany ALL → reduce in JS)
  const [items, total, avgResult] = await Promise.all([
    prisma.stallFeedback.findMany({
      where: { stallId, eventId: event.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stallFeedback.count({ where: { stallId, eventId: event.id } }),
    prisma.$queryRaw`
      SELECT COALESCE(
        AVG(
          (SELECT SUM(val::float) / 10
           FROM jsonb_array_elements_text(points::jsonb) AS val)
        ), 0
      )::float AS "overallAvg"
      FROM "stall_feedback"
      WHERE "stallId" = ${stallId} AND "eventId" = ${event.id}
    `,
  ]);

  const overallAvg = avgResult[0]?.overallAvg ?? 0;

  return {
    feedback: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: { totalFeedback: total, overallAvg: Number(overallAvg.toFixed(2)) },
  };
};

const getStallOwnerFeedback = async (eventId, stallId, userId, { page = 1, limit = 20 } = {}) => {
  const event = await getEventLean(prisma, eventId);
  if (!event) throw new NotFoundError('Event not found');

  // Verify the requesting user owns this stall (approved application)
  const application = await prisma.stallApplication.findFirst({
    where: { eventId: event.id, stallId, applicantId: userId, applicationStatus: 'approved' },
  });
  if (!application) throw new ForbiddenError('You do not own this stall');

  const where = { stallId, eventId: event.id };

  // Fetch paginated items, count, and per-criterion averages via raw SQL (single pass)
  // Replaces loading ALL feedback into memory for JS aggregation
  const [items, total, avgResult, perCriterionResult] = await Promise.all([
    prisma.stallFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stallFeedback.count({ where }),
    // Overall average
    prisma.$queryRaw`
      SELECT COALESCE(
        AVG(
          (SELECT SUM(val::float) / 10
           FROM jsonb_array_elements_text(points::jsonb) AS val)
        ), 0
      )::float AS "overallAvg"
      FROM "stall_feedback"
      WHERE "stall_id" = ${stallId} AND "event_id" = ${event.id}
    `,
    // Per-criterion averages via raw SQL
    prisma.$queryRaw`
      SELECT
        idx,
        COALESCE(AVG((points::jsonb->>idx::text)::float), 0)::float AS avg
      FROM "stall_feedback",
           generate_series(0, 9) AS idx
      WHERE "stall_id" = ${stallId} AND "event_id" = ${event.id}
      GROUP BY idx
      ORDER BY idx
    `,
  ]);

  const overallAvg = avgResult[0]?.overallAvg ?? 0;

  const perCriterion = STALL_FEEDBACK_LABELS.map((label, i) => {
    const row = perCriterionResult.find(r => r.idx === i);
    return {
      label,
      avg: row ? Number(row.avg.toFixed(2)) : 0,
    };
  });

  return {
    feedback: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: { totalFeedback: total, overallAvg: Number(overallAvg.toFixed(2)), perCriterion },
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
  getStallFeedbackFormInfo,
  submitStallFeedback,
  getStallFeedback,
  getStallOwnerFeedback,
};
