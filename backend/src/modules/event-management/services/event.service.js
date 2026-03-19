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
  sanitizeDigits,
  sanitizeEmail,
  sanitizePlainText,
  sanitizeUrl,
} = require("../../../shared/utils/sanitize");
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
  isEventManager,
  validateQRCodeAndGetRegistration,
  invalidateResolveEventCache,
} = require("../utils/eventHelpers");
const { generateQRCode } = require("../utils/qrCodeGenerator");
const { buildVisibilityFilter, isRegistrationOpen } = require('./eventSettings.service');
const eventAnalyticsService = require("./eventAnalytics.service");
const crypto = require("crypto");
const log = require("../../../shared/utils/logger");

// ── Event cache invalidation helper ──────────────────────────────────────────
// Called by mutation functions (update, publish, register) to bust stale cache.
async function invalidateEventCaches(eventId) {
  invalidateResolveEventCache(eventId); // bust in-memory resolveEvent cache
  await Promise.all([
    cache.del(`event:detail:${eventId}`),
    cache.del(`event:stats:${eventId}`),
    cache.del(`event:regopen:${eventId}`),
    cache.del(`event:regform:${eventId}`),
    cache.delPattern('event:list:*'),          // bust all list caches (short TTL anyway)
    cache.delPattern(`event:canSee:${eventId}:*`), // bust visibility cache for this event
    eventAnalyticsService.invalidateEventAnalyticsCaches(),
  ]);
}

function sanitizeEventResources(resources) {
  if (!Array.isArray(resources)) return [];

  return resources
    .filter((resource) => resource && typeof resource === "object")
    .map((resource) => {
      const pricePerPiece =
        resource.pricePerPiece != null && resource.pricePerPiece !== ""
          ? Number(resource.pricePerPiece)
          : undefined;
      const quantity =
        resource.quantity != null && resource.quantity !== ""
          ? Number(resource.quantity)
          : undefined;
      const estimatedCost =
        resource.estimatedCost != null && resource.estimatedCost !== ""
          ? Number(resource.estimatedCost)
          : undefined;

      return {
        category:
          sanitizePlainText(resource.category || "internal", {
            maxLength: 32,
          }) || "internal",
        type: sanitizePlainText(resource.type || "", { maxLength: 256 }),
        description: sanitizePlainText(resource.description || "", {
          maxLength: 2000,
        }),
        pricePerPiece: Number.isFinite(pricePerPiece) ? pricePerPiece : undefined,
        quantity: Number.isFinite(quantity) ? quantity : undefined,
        estimatedCost: Number.isFinite(estimatedCost)
          ? estimatedCost
          : Number.isFinite(pricePerPiece) && Number.isFinite(quantity)
            ? pricePerPiece * quantity
            : undefined,
      };
    })
    .filter((resource) => resource.type || resource.description);
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
  // Get the noting with event details + optional club association
  const noting = await prisma.note.findUnique({
    where: { id: noteId },
    include: {
      createdBy: true,
      eventClub: {
        select: {
          id: true,
          chairpersonId: true,
          name: true,
          status: true,
        },
      },
    },
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
            sponsors: Array.isArray(v.eventSponsors)
              ? v.eventSponsors.map(s => ({
                  ...s,
                  id: s.id || require('crypto').randomUUID(),
                  originSource: s.originSource || 'noting',
                }))
              : null,
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

    // ── Auto-grant club chairperson for all festival sub-events ─────────────
    if (noting.eventClub && noting.eventClub.chairpersonId && createdEvents.length > 0) {
      try {
        const volunteerRows = createdEvents.map((ev) => ({
          id: crypto.randomUUID(),
          eventId: ev.id,
          userId: noting.eventClub.chairpersonId,
          role: "event_manager",
          canScanQr: true,
        }));
        await prisma.eventVolunteer.createMany({ data: volunteerRows });
        log.ok(
          `Auto-granted event management to chairperson ${noting.eventClub.chairpersonId} for ${createdEvents.length} festival sub-events (club: ${noting.eventClub.name})`,
        );
      } catch (err) {
        log.error(`Failed to auto-grant chairperson permissions for festival: ${err.message}`);
      }
    }

    // ── Seed EventVisibility for all festival sub-events from noting settings ──
    const festVs = noting.eventVisibilitySettings;
    if (festVs && typeof festVs === "object" && createdEvents.length > 0) {
      try {
        const VALID_ROLES = ["student", "faculty", "staff", "admin", "parent", "superadmin"];
        const roles = Array.isArray(festVs.visibleToRoles)
          ? festVs.visibleToRoles.filter((r) => VALID_ROLES.includes(r))
          : ["student", "faculty", "staff", "admin", "superadmin", "parent"];

        const visibilityRows = createdEvents.map((ev) => ({
          eventId: ev.id,
          isActive: true,
          visibleToRoles: roles,
          studentFilterType: festVs.studentFilterType === "custom" ? "custom" : "all",
          allowedSchoolIds: Array.isArray(festVs.allowedSchoolIds) ? festVs.allowedSchoolIds : [],
          allowedDepartmentIds: Array.isArray(festVs.allowedDepartmentIds) ? festVs.allowedDepartmentIds : [],
          allowedProgramIds: Array.isArray(festVs.allowedProgramIds) ? festVs.allowedProgramIds : [],
          allowedBatchYears: Array.isArray(festVs.allowedBatchYears) ? festVs.allowedBatchYears : [],
          allowedSectionIds: Array.isArray(festVs.allowedSectionIds) ? festVs.allowedSectionIds : [],
        }));
        await prisma.eventVisibility.createMany({ data: visibilityRows });

        if (festVs.allowExtraPasses) {
          const eventIds = createdEvents.map((ev) => ev.id);
          await prisma.event.updateMany({
            where: { id: { in: eventIds } },
            data: {
              allowExtraPasses: true,
              maxExtraPassesPerUser: Number(festVs.maxExtraPassesPerUser) || 1,
            },
          });
        }
        log.ok(`Seeded EventVisibility from noting settings for ${createdEvents.length} festival sub-events`);
      } catch (err) {
        log.error(`Failed to seed EventVisibility for festival sub-events: ${err.message}`);
      }
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
      sponsors: Array.isArray(noting.eventSponsors)
        ? noting.eventSponsors.map(s => ({
            ...s,
            id: s.id || require('crypto').randomUUID(),
            originSource: s.originSource || 'noting',
          }))
        : noting.eventSponsors ?? null,
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

  // ── Auto-grant club chairperson full event management permissions ────────
  // When the noting is associated with a club, add the chairperson as an
  // EventVolunteer with role 'event_manager' so they can manage the event.
  if (noting.eventClub && noting.eventClub.chairpersonId) {
    try {
      await prisma.eventVolunteer.create({
        data: {
          id: crypto.randomUUID(),
          eventId: event.id,
          userId: noting.eventClub.chairpersonId,
          role: "event_manager",
          canScanQr: true,
        },
      });
      log.ok(
        `Auto-granted event management to chairperson ${noting.eventClub.chairpersonId} for event ${event.eventId} (club: ${noting.eventClub.name})`,
      );
    } catch (err) {
      // Don't fail event creation if volunteer assignment fails (e.g. duplicate)
      log.error(`Failed to auto-grant chairperson permissions: ${err.message}`);
    }
  }

  // ── Seed EventVisibility from noting's event settings ────────────────────
  const vs = noting.eventVisibilitySettings;
  if (vs && typeof vs === "object") {
    try {
      const VALID_ROLES = ["student", "faculty", "staff", "admin", "parent", "superadmin"];
      const roles = Array.isArray(vs.visibleToRoles)
        ? vs.visibleToRoles.filter((r) => VALID_ROLES.includes(r))
        : ["student", "faculty", "staff", "admin", "superadmin", "parent"];

      await prisma.eventVisibility.create({
        data: {
          eventId: event.id,
          isActive: true,
          visibleToRoles: roles,
          studentFilterType: vs.studentFilterType === "custom" ? "custom" : "all",
          allowedSchoolIds: Array.isArray(vs.allowedSchoolIds) ? vs.allowedSchoolIds : [],
          allowedDepartmentIds: Array.isArray(vs.allowedDepartmentIds) ? vs.allowedDepartmentIds : [],
          allowedProgramIds: Array.isArray(vs.allowedProgramIds) ? vs.allowedProgramIds : [],
          allowedBatchYears: Array.isArray(vs.allowedBatchYears) ? vs.allowedBatchYears : [],
          allowedSectionIds: Array.isArray(vs.allowedSectionIds) ? vs.allowedSectionIds : [],
        },
      });
      // Set extra pass fields on event
      if (vs.allowExtraPasses) {
        await prisma.event.update({
          where: { id: event.id },
          data: {
            allowExtraPasses: true,
            maxExtraPassesPerUser: Number(vs.maxExtraPassesPerUser) || 1,
          },
        });
      }
      log.ok(`Seeded EventVisibility from noting settings for event ${event.eventId}`);
    } catch (err) {
      log.error(`Failed to seed EventVisibility from noting: ${err.message}`);
    }
  }

  return { isFestival: false, event };
};

/**
 * Get event by ID with full details
 * Caches the event base data per eventId (user-specific data always fetched fresh).
 */
const getEventDetails = async (eventId, userId) => {
  // Try cache for event base data (with stampede protection)
  const cacheKey = `event:detail:${eventId}`;
  const { data: event } = await cache.getOrSet(cacheKey, async () => {
    return await getEventById(prisma, eventId, {
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
  }, 300);

  // User-specific data: cache registration count (30s), always fresh user registration
  const regCountKey = `event:regcount:${eventId}`;
  const userRegKey = `event:userreg:${eventId}:${userId}`;

  const [cachedRegCount, cachedUserReg] = await Promise.all([
    cache.get(regCountKey),
    cache.get(userRegKey),
  ]);

  let currentRegistrations, userRegistration;

  if (cachedRegCount !== null && cachedUserReg !== null) {
    currentRegistrations = cachedRegCount;
    userRegistration = cachedUserReg;
  } else {
    // Fetch missing values in parallel
    const promises = [];
    if (cachedRegCount === null) {
      promises.push(
        prisma.eventRegistration.count({
          where: { eventId, status: "confirmed" },
        }).then(count => { currentRegistrations = count; cache.set(regCountKey, count, 120); })
      );
    } else {
      currentRegistrations = cachedRegCount;
    }
    if (cachedUserReg === null) {
      promises.push(
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
        }).then(reg => { userRegistration = reg; cache.set(userRegKey, reg || false, 300); })
      );
    } else {
      userRegistration = cachedUserReg === false ? null : cachedUserReg;
    }
    await Promise.all(promises);
  }
  // Normalize false back to null for API response
  if (userRegistration === false) userRegistration = null;

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

  // Verify user is the event creator or an assigned event manager (club chairperson)
  if (event.createdById !== userId) {
    const hasManagerAccess = await isEventManager(prisma, eventId, userId);
    if (!hasManagerAccess) {
      throw new ForbiddenError("Only the event creator or assigned manager can update the event");
    }
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
  // When event is from noting, also lock: fee fields, duty leave, resources. Capacity (approxCapacity) stays editable.
  // Sponsors are NOT fully locked — fulfillment-only updates are allowed (handled separately below).
  if (event.notingId) {
    lockedFields.push(
      "registrationFee",
      "teamRegistrationFee",
      "dutyLeaveAvailable",
      "dutyLeaveEligibility",
      "dutyLeaveRoleType",
      "hasSponsorship",
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
  if (updateData.description !== undefined) {
    updateData.description = sanitizePlainText(updateData.description || "", {
      maxLength: LIMITS.MAX_DESCRIPTION_LENGTH,
    });
  }
  if (updateData.longDescription !== undefined) {
    updateData.longDescription = sanitizeHtml(updateData.longDescription || "");
  }
  if (updateData.venue !== undefined) {
    updateData.venue = sanitizePlainText(updateData.venue || "", {
      maxLength: LIMITS.MAX_VENUE_LENGTH,
    });
  }
  if (updateData.contactPersonName !== undefined) {
    updateData.contactPersonName = sanitizePlainText(
      updateData.contactPersonName || "",
      { maxLength: LIMITS.MAX_CONTACT_NAME_LENGTH || 256 },
    );
  }
  if (updateData.contactEmail !== undefined) {
    updateData.contactEmail = sanitizeEmail(updateData.contactEmail || "");
  }
  if (updateData.contactMobile !== undefined) {
    updateData.contactMobile = sanitizeDigits(updateData.contactMobile || "", {
      maxLength: 10,
    });
  }
  if (updateData.alternateContact !== undefined) {
    updateData.alternateContact = sanitizePlainText(
      updateData.alternateContact || "",
      { maxLength: 32 },
    );
  }
  if (updateData.websiteUrl !== undefined) {
    updateData.websiteUrl = sanitizeUrl(updateData.websiteUrl || "");
  }
  if (updateData.eligibilityCriteria !== undefined) {
    updateData.eligibilityCriteria = sanitizePlainText(
      updateData.eligibilityCriteria || "",
      { maxLength: 10000 },
    );
  }
  if (updateData.rulesAndGuidelines !== undefined) {
    updateData.rulesAndGuidelines = sanitizePlainText(
      updateData.rulesAndGuidelines || "",
      { maxLength: 20000 },
    );
  }
  if (updateData.prizeDetails !== undefined) {
    updateData.prizeDetails = sanitizePlainText(updateData.prizeDetails || "", {
      maxLength: 10000,
    });
  }
  if (updateData.faqs !== undefined && Array.isArray(updateData.faqs)) {
    updateData.faqs = updateData.faqs
      .map((faq) => ({
        question: sanitizePlainText(faq?.question || "", { maxLength: 500 }),
        answer: sanitizePlainText(faq?.answer || "", { maxLength: 2000 }),
      }))
      .filter((faq) => faq.question && faq.answer);
  }
  if (
    updateData.socialMediaLinks !== undefined &&
    updateData.socialMediaLinks &&
    typeof updateData.socialMediaLinks === "object"
  ) {
    updateData.socialMediaLinks = Object.fromEntries(
      Object.entries(updateData.socialMediaLinks)
        .filter(([, value]) => value)
        .map(([key, value]) => [key, sanitizeUrl(value)])
        .filter(([, value]) => value),
    );
  }

  // Sanitize sponsors (Cash: amount, In-kind: notes/description)
  if (updateData.sponsors !== undefined) {
    updateData.sponsors =
      updateData.hasSponsorship === false
        ? null
        : sanitizeSponsors(updateData.sponsors || []);
  }
  if (updateData.resources !== undefined) {
    updateData.resources =
      updateData.hasResources === false
        ? null
        : sanitizeEventResources(updateData.resources || []);
  }

  // ── Sponsor field-level enforcement for noting-origin sponsors ──
  // For noting-backed events: noting-origin sponsors can only have fulfillment fields updated.
  // Base fields (name, type, contact, contribution type, etc.) are preserved from the existing data.
  const sponsorHistoryEntries = [];
  if (event.notingId && updateData.sponsors && Array.isArray(updateData.sponsors)) {
    const existingSponsors = Array.isArray(event.sponsors) ? event.sponsors : [];
    const existingById = {};
    for (const s of existingSponsors) {
      if (s.id) existingById[s.id] = s;
    }

    updateData.sponsors = updateData.sponsors.map((incoming) => {
      if (!incoming.id || !existingById[incoming.id]) return incoming; // new sponsor or no match
      const existing = existingById[incoming.id];

      // Saved (locked) sponsors are completely immutable — return existing data unchanged
      if (existing.savedAt) {
        return existing;
      }

      // Generate history for any fulfillment changes
      const changes = [];
      if (existing.paymentStatus !== incoming.paymentStatus) {
        changes.push({ field: 'paymentStatus', from: existing.paymentStatus, to: incoming.paymentStatus });
      }
      if (existing.cashAmount !== incoming.cashAmount) {
        changes.push({ field: 'cashAmount', from: existing.cashAmount, to: incoming.cashAmount });
      }
      if (existing.paymentMethod !== incoming.paymentMethod) {
        changes.push({ field: 'paymentMethod', from: existing.paymentMethod, to: incoming.paymentMethod });
      }
      if (existing.transactionId !== incoming.transactionId) {
        changes.push({ field: 'transactionId', from: existing.transactionId, to: incoming.transactionId });
      }
      // In-kind delivery status changes
      if (Array.isArray(incoming.inKindItems) && Array.isArray(existing.inKindItems)) {
        for (let k = 0; k < incoming.inKindItems.length && k < existing.inKindItems.length; k++) {
          if (existing.inKindItems[k].deliveryStatus !== incoming.inKindItems[k].deliveryStatus) {
            changes.push({ field: `inKindItems[${k}].deliveryStatus`, from: existing.inKindItems[k].deliveryStatus, to: incoming.inKindItems[k].deliveryStatus });
          }
        }
      }

      if (changes.length > 0) {
        const summaryParts = changes.map(c => `${c.field}: ${c.from || 'none'} → ${c.to || 'none'}`);
        sponsorHistoryEntries.push({
          eventId: event.id,
          sponsorId: incoming.id,
          changeType: changes.some(c => c.field === 'paymentStatus' || c.field.includes('deliveryStatus')) ? 'status_change' : 'payment_update',
          previousSnapshot: existing,
          newSnapshot: incoming,
          summary: summaryParts.join('; '),
          changedById: userId,
        });
      }

      // If noting-origin, enforce base field immutability
      if (existing.originSource === 'noting') {
        return {
          ...existing,
          // Allow fulfillment-only fields to be updated
          cashAmount: incoming.cashAmount !== undefined ? incoming.cashAmount : existing.cashAmount,
          paymentStatus: incoming.paymentStatus || existing.paymentStatus,
          paymentMethod: incoming.paymentMethod,
          paymentMethodOtherLabel: incoming.paymentMethodOtherLabel,
          transactionId: incoming.transactionId,
          receipt: incoming.receipt !== undefined ? incoming.receipt : existing.receipt,
          cashAssignedTo: incoming.cashAssignedTo !== undefined ? incoming.cashAssignedTo : existing.cashAssignedTo,
          // Preserve save/lock state from incoming
          savedAt: incoming.savedAt || existing.savedAt,
          originalSnapshot: incoming.originalSnapshot || existing.originalSnapshot,
          inKindItems: incoming.inKindItems !== undefined ? incoming.inKindItems.map((item, idx) => {
            const existingItem = existing.inKindItems && existing.inKindItems[idx];
            if (!existingItem) return item; // new item additions are allowed
            return {
              ...existingItem,
              // Allow fulfillment fields only
              deliveryStatus: item.deliveryStatus || existingItem.deliveryStatus,
              assignedTo: item.assignedTo !== undefined ? item.assignedTo : existingItem.assignedTo,
            };
          }) : existing.inKindItems,
        };
      }

      return incoming; // event-origin sponsors: fully editable
    });
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

  // Validate merged event data only when event is already published (for re-saves)
  // Draft events skip validation — it runs at publish time instead
  const merged = { ...event, ...updateData };
  if (event.status === 'published') {
    validateEventRequiredFields(merged);
  }

  // Update event (+ sponsor history if any)
  const updatePayload = {
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
  };

  let updatedEvent;
  if (sponsorHistoryEntries.length > 0) {
    updatedEvent = await prisma.$transaction(async (tx) => {
      const result = await tx.event.update(updatePayload);
      await tx.sponsorFulfillmentHistory.createMany({ data: sponsorHistoryEntries });
      return result;
    });
  } else {
    updatedEvent = await prisma.event.update(updatePayload);
  }

  await invalidateEventCaches(eventId);
  return updatedEvent;
};

/**
 * Publish event (make it available for registration)
 */
const publishEvent = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId);

  // Verify user is the event creator or an assigned event manager (club chairperson)
  if (event.createdById !== userId) {
    const hasManagerAccess = await isEventManager(prisma, eventId, userId);
    if (!hasManagerAccess) {
      throw new ForbiddenError("Only the event creator or assigned manager can publish the event");
    }
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
 * PERF: Results cached for 30s per unique filter+user combination
 */
const listEvents = async (filters, pagination, userId) => {
  const { page = 1, limit = 20 } = pagination;
  const LIST_CACHE_VERSION = 'v2';
  const {
    status,
    eventType,
    search,
    myEvents,
    filter: specialFilter,
    studentApply,
  } = filters;

  // ── Cache layer with stampede protection ───────────────────────────────
  // For public list (myEvents=false), use a shared cache key based on filters + 
  // visibility hash (same role+program → same cache). This prevents 150 separate 
  // cache entries for 150 users with identical query results.
  let cacheKey;
  if (myEvents) {
    // My events is user-specific
    cacheKey = `event:list:${LIST_CACHE_VERSION}:my:${userId}:${JSON.stringify({ page, limit, status, eventType, search })}`;
  } else {
    // Public list — build visibility filter first and hash it for the cache key
    const visFilter = await buildVisibilityFilter(userId);
    const crypto = require('crypto');
    const visHash = crypto.createHash('md5').update(JSON.stringify(visFilter)).digest('hex').slice(0, 8);
    cacheKey = `event:list:${LIST_CACHE_VERSION}:pub:${visHash}:${JSON.stringify({ page, limit, status, eventType, search, specialFilter, studentApply })}`;
  }

  const { data: result } = await cache.getOrSet(cacheKey, async () => {
    return await _fetchListFromDB(filters, pagination, userId);
  }, 120);

  return result;
};

/**
 * Internal: fetch event list from database (called on cache miss)
 */
const _fetchListFromDB = async (filters, pagination, userId) => {
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
    registrationStartDate: true,
    registrationEndDate: true,
    venue: true,
    paymentType: true,
    registrationFee: true,
    maxCapacity: true,
    createdById: true,
    createdAt: true,
    description: true,
    notingId: true,
    bannerImageUrl: true,
    logoImageUrl: true,
    participationType: true,
    hasStalls: true,
    prizesEnabled: true,
    certificateAvailable: true,
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
    const stallResult = {
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
    return stallResult;
  }

  const where = {};

  // Draft events are only visible to their creator
  // Published/Ongoing/Completed events are visible to everyone
  if (myEvents) {
    // Show events created by user OR where user is an assigned event_manager (club chairperson)
    where.OR = [
      { createdById: userId },
      { EventVolunteer: { some: { userId, role: "event_manager" } } },
    ];
    if (status) {
      where.status = status;
    }
  } else {
    where.OR = [
      { status: { in: ["published", "ongoing", "completed"] } },
      { AND: [{ status: "draft" }, { createdById: userId }] },
      { AND: [{ status: "draft" }, { EventVolunteer: { some: { userId, role: "event_manager" } } }] },
    ];

    if (status) {
      if (status === "draft") {
        where.OR = [
          { AND: [{ status: "draft" }, { createdById: userId }] },
          { AND: [{ status: "draft" }, { EventVolunteer: { some: { userId, role: "event_manager" } } }] },
        ];
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

  const listResult = {
    events: eventsWithCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
  return listResult;
};

/**
 * Register user for event
 */
const registerForEvent = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId);

  // Check if registration is open (via Event Settings toggle)
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
  const { status, search } = filters;
  const searchTerm = typeof search === 'string' ? search.trim() : '';

  const where = { userId };

  if (status) {
    where.status = status;
  }

  if (searchTerm) {
    where.OR = [
      {
        registrationId: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      {
        Event: {
          name: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      },
      {
        Event: {
          eventId: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      },
      {
        Event: {
          venue: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      },
    ];
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
            allowExtraPasses: true,
            maxExtraPassesPerUser: true,
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

  const registrationIds = registrations.map((r) => r.id);
  const guestRows = registrationIds.length
    ? await prisma.eventExtraPass.findMany({
      where: { registrationId: { in: registrationIds } },
      select: {
        id: true,
        registrationId: true,
        guestName: true,
        guestEmail: true,
        mobileNumber: true,
        relationship: true,
        createdAt: true,
      },
      orderBy: [{ registrationId: "asc" }, { createdAt: "asc" }],
    })
    : [];

  const guestsByRegistrationId = new Map();
  for (const guest of guestRows) {
    if (!guestsByRegistrationId.has(guest.registrationId)) {
      guestsByRegistrationId.set(guest.registrationId, []);
    }
    guestsByRegistrationId.get(guest.registrationId).push(guest);
  }

  const mappedRegistrations = registrations.map((registration) => {
    const guests = guestsByRegistrationId.get(registration.id) || [];
    const totalAllowedEntries = registration.totalAllowedEntries ?? 1;
    const checkedInCount = registration.checkedInCount ?? 0;
    const checkedOutCount = registration.checkedOutCount ?? 0;
    const currentlyInside = Math.max(0, checkedInCount - checkedOutCount);
    return {
      ...registration,
      guests,
      extraPassSummary: {
        extraPassCount: registration.extraPassCount ?? 0,
        totalAllowedEntries,
        checkedInCount,
        checkedOutCount,
        currentlyInside,
        availableEntrySlots: Math.max(0, totalAllowedEntries - currentlyInside),
        remainingEntries: Math.max(0, totalAllowedEntries - currentlyInside),
        studentInside: registration.studentInsideAssumed ?? currentlyInside > 0,
      },
    };
  });

  return {
    registrations: mappedRegistrations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get event statistics (comprehensive)
 * Optimized: Single raw SQL for counts + date grouping, separate query for recent registrations
 */
const getEventStatistics = async (eventId, userOrId) => {
  const event = await getEventLean(prisma, eventId);
  const userId =
    typeof userOrId === "string" ? userOrId : userOrId?.id;
  const roleName =
    typeof userOrId === "string"
      ? null
      : userOrId?.role?.name || userOrId?.role || userOrId?.userType || null;
  const isAdminRole = roleName === "admin";
  const isSuperadmin = roleName === "superadmin";
  const hasReportAccess =
    typeof userOrId === "object" &&
    (
      (userOrId?.centralDeptPermissions || []).some(
        (dp) =>
          dp.permissions &&
          (dp.permissions.event_manage_all === true ||
            dp.permissions.event_view_reports === true),
      ) ||
      (userOrId?.schoolDeptPermissions || []).some(
        (dp) =>
          dp.permissions &&
          (dp.permissions.event_manage_all === true ||
            dp.permissions.event_view_reports === true),
      )
    );

  // Allow event creator, superadmin, and admin/report users who already passed route permission.
  if (event.createdById !== userId && !isAdminRole && !isSuperadmin && !hasReportAccess) {
    throw new ForbiddenError("You do not have permission to view event statistics");
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
        (
          SELECT COALESCE(SUM("entryCount"), 0)::int
          FROM "EventEntry"
          WHERE "eventId" = ${eventId} AND "entryType" = 'entry'
        ) as "totalEntries",
        (
          SELECT COALESCE(SUM("entryCount"), 0)::int
          FROM "EventEntry"
          WHERE "eventId" = ${eventId} AND "entryType" = 'exit'
        ) as "totalExits"
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

// ── Re-export volunteer & feedback services (split for Single Responsibility) ──
const volunteerService = require('./eventVolunteer.service');
const feedbackService = require('./eventFeedback.service');

module.exports = {
  // Core event operations (this file)
  createEventFromNoting,
  getEventDetails,
  updateEvent,
  publishEvent,
  listEvents,
  registerForEvent,
  getUserRegistrations,
  getEventStatistics,
  // Re-exports from eventVolunteer.service.js
  ...volunteerService,
  // Re-exports from eventFeedback.service.js
  ...feedbackService,
};
