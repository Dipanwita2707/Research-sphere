/**
 * Event Management Helper Functions
 */

const { NotFoundError, ValidationError } = require('../../../shared/utils/AppError');
const { ERRORS } = require('../constants/event.constants');
const { generateQRCode } = require('./qrCodeGenerator');
const prisma = require('../../../shared/config/database');

// ── In-memory event cache (reduces ~500ms DB roundtrip per request) ──────────
// Only caches full-row lookups (no custom select/include). TTL = 2 minutes.
const _eventCache = new Map();
const _eventCacheTTL = new Map();
const EVENT_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Invalidate the in-memory resolveEvent cache for a specific event.
 * Call this after any event mutation (update, publish, delete, toggle-active).
 */
const invalidateResolveEventCache = (eventId) => {
  for (const [key, val] of _eventCache.entries()) {
    if (key === eventId || val?.eventId === eventId || val?.id === eventId) {
      _eventCache.delete(key);
      _eventCacheTTL.delete(key);
    }
  }
};

/**
 * Resolve an event by UUID or human-readable eventId.
 * Throws NotFoundError if no match. Accepts optional Prisma `select` or `include`.
 *
 * PERF: Full-row lookups (no options) are cached in-memory for 2 minutes,
 * saving ~500ms per request on remote databases like Neon.
 *
 * @param {string} eventId - UUID or human-readable event ID (e.g. EVT-2026-0001)
 * @param {Object} [options]
 * @param {Object} [options.select]  - Prisma select clause
 * @param {Object} [options.include] - Prisma include clause
 * @returns {Promise<Object>} Resolved event record
 * @throws {NotFoundError}
 */
const resolveEvent = async (eventId, options = {}) => {
  const hasCustomProjection = options.select || options.include;

  // Check in-memory cache for full-row lookups
  if (!hasCustomProjection) {
    const ttl = _eventCacheTTL.get(eventId);
    if (ttl && Date.now() < ttl) {
      const cached = _eventCache.get(eventId);
      if (cached) return { ...cached }; // return copy to prevent mutation
    } else if (ttl) {
      _eventCache.delete(eventId);
      _eventCacheTTL.delete(eventId);
    }
  }

  // Detect UUID vs human-readable ID and use findUnique when possible (index-only scan)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
  let event;
  if (isUUID) {
    const query = { where: { id: eventId } };
    if (options.select) query.select = options.select;
    if (options.include) query.include = options.include;
    event = await prisma.event.findUnique(query);
  } else {
    const query = { where: { eventId } };
    if (options.select) query.select = options.select;
    if (options.include) query.include = options.include;
    event = await prisma.event.findUnique(query);
  }
  if (!event) throw new NotFoundError('Event not found');

  // Cache full-row lookups
  if (!hasCustomProjection) {
    _eventCache.set(eventId, event);
    _eventCacheTTL.set(eventId, Date.now() + EVENT_CACHE_TTL_MS);
    // Also index by the other identifier for faster lookup
    if (event.id !== eventId) {
      _eventCache.set(event.id, event);
      _eventCacheTTL.set(event.id, Date.now() + EVENT_CACHE_TTL_MS);
    }
    if (event.eventId && event.eventId !== eventId) {
      _eventCache.set(event.eventId, event);
      _eventCacheTTL.set(event.eventId, Date.now() + EVENT_CACHE_TTL_MS);
    }
  }

  return event;
};

/**
 * Generate unique Event ID
 * Format: EVT-YYYY-XXXX
 */
const generateEventId = async (prisma) => {
  const year = new Date().getFullYear();
  const prefix = `EVT-${year}-`;

  // Get the highest sequence number for this year using raw query
  // to avoid ordering by createdAt which can return wrong results
  const result = await prisma.$queryRawUnsafe(
    `SELECT "eventId" FROM "public"."Event"
     WHERE "eventId" LIKE $1
     ORDER BY "eventId" DESC
     LIMIT 1`,
    `${prefix}%`
  );

  let sequence = 1;
  if (result.length > 0) {
    const lastSequence = parseInt(result[0].eventId.split('-')[2]);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`;
};

/**
 * Generate unique Registration ID (race-condition-safe)
 * Format: REG-EVENTID-XXXX-RAND
 *
 * Uses MAX(registrationId) + 1 for human-readable sequence,
 * plus a 4-char random hex suffix to guarantee uniqueness
 * even when two requests read the same MAX value simultaneously.
 */
const generateRegistrationId = async (prisma, eventId) => {
  const prefix = `REG-${eventId}-`;
  const crypto = require('crypto');

  // Get the highest existing sequence number for this event
  const result = await prisma.$queryRawUnsafe(
    `SELECT "registrationId" FROM "EventRegistration"
     WHERE "registrationId" LIKE $1
     ORDER BY "registrationId" DESC
     LIMIT 1`,
    `${prefix}%`
  );

  let sequence = 1;
  if (result.length > 0) {
    const lastId = result[0].registrationId;
    // Extract sequence number (second-to-last segment, before the random suffix)
    const parts = lastId.replace(prefix, '').split('-');
    const lastSeq = parseInt(parts[0], 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  // Append random suffix to prevent collisions under concurrency
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${prefix}${sequence.toString().padStart(4, '0')}-${suffix}`;
};

/**
 * Lightweight event lookup — returns only ownership / status fields.
 * Use this for authorization checks instead of the heavy getEventById.
 */
const getEventLean = async (prisma, eventId) => {
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: eventId }, { eventId }] },
    select: {
      id: true,
      eventId: true,
      name: true,
      status: true,
      createdById: true,
      paymentType: true,
      participationType: true,
    },
  });
  if (!event) throw new NotFoundError('Event not found');
  return event;
};

/**
 * Validate event exists and return it with related data
 */
const getEventById = async (prisma, eventId, include = {}) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
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
      note: {
        select: {
          notingId: true,
          status: true,
          category: true,
          subcategory: true,
          eventSponsors: true,
          eventResources: true,
          eventHasSponsorship: true,
          eventHasResources: true,
          eventDutyLeaveAvailable: true,
          eventDutyLeaveEligibility: true,
          eventDutyLeaveRoleType: true,
          subEvents: true, // For festival: sponsors/resources live in subEvents[].venueFormData
          eventClubId: true,
          eventClub: {
            select: { id: true, clubId: true, name: true },
          },
        },
      },
      ...include,
    },
  });

  if (!event) {
    throw new NotFoundError('Event');
  }

  return event;
};

/**
 * Check if user can register for event
 */
const canRegisterForEvent = async (prisma, event, userId) => {
  // Check if event is published
  if (event.status !== 'published') {
    throw new ValidationError(ERRORS.EVENT_NOT_PUBLISHED);
  }

  // Check if event is team-based
  if (event.participationType === 'team') {
    throw new ValidationError('This is a team-based event. You must create or join a team to participate.');
  }

  // Check registration start date
  const now = new Date();
  if (event.registrationStartDate && now < event.registrationStartDate) {
    throw new ValidationError('Registration has not started yet');
  }
  // NOTE: registrationEndDate expiry does NOT hard-block registration here.
  // The toggle (isActive) is the sole gate. Date expiry only triggers an
  // automatic OFF via isRegistrationOpen(), which admin can override.

  // Check if already registered
  const existingRegistration = await prisma.eventRegistration.findFirst({
    where: {
      eventId: event.id,
      userId,
    },
  });

  if (existingRegistration) {
    throw new ValidationError(ERRORS.ALREADY_REGISTERED);
  }

  // Check capacity
  if (event.maxCapacity && event.currentRegistrations >= event.maxCapacity) {
    throw new ValidationError(ERRORS.EVENT_FULL);
  }

  return true;
};

/**
 * Check if user is a volunteer for the event
 */
const isEventVolunteer = async (prisma, eventId, userId) => {
  const volunteer = await prisma.eventVolunteer.findFirst({
    where: {
      eventId,
      userId,
      canScanQr: true,
    },
  });

  return !!volunteer;
};

/**
 * Check if a user is an event manager (assigned via EventVolunteer with role 'event_manager').
 * This is used to grant club chairpersons full management permissions for events
 * created from notings associated with their club.
 *
 * @param {PrismaClient} prisma
 * @param {string} eventId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
const isEventManager = async (prisma, eventId, userId) => {
  // PERF: Cache result for 120s — called on every GET /events/:id
  const cache = require('../../../shared/config/redis');
  const cacheKey = `event:isManager:${eventId}:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached !== null) return cached;

  const manager = await prisma.eventVolunteer.findFirst({
    where: {
      eventId,
      userId,
      role: "event_manager",
    },
  });
  const result = !!manager;
  await cache.set(cacheKey, result, 600);
  return result;
};

/**
 * Check if a user can manage an event (either creator or event_manager volunteer).
 *
 * @param {PrismaClient} prisma
 * @param {string} eventId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
const canManageEvent = async (prisma, eventId, userId) => {
  // Check if creator first (cheap — just read event)
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { createdById: true },
  });
  if (!event) return false;
  if (event.createdById === userId) return true;
  // Fallback: check event_manager volunteer role
  return isEventManager(prisma, eventId, userId);
};

/**
 * Validate QR code and get registration
 */
const validateQRCodeAndGetRegistration = async (prisma, qrCode, eventId) => {
  const registration = await prisma.eventRegistration.findFirst({
    where: {
      qrCode,
      eventId,
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
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  if (!registration) {
    throw new NotFoundError(ERRORS.INVALID_QR_CODE);
  }

  if (registration.status !== 'confirmed') {
    throw new ValidationError('Registration is not confirmed');
  }

  return registration;
};

// ── Response Formatting Helpers ────────────────────────────────────────────

/**
 * Find matching sub-event from a festival noting (matches by name or start date)
 * @param {Object|null} note - The parent noting object
 * @param {Object} event - The event to match against
 * @returns {Object|null} The matched sub-event's venueFormData or the sub-event itself
 */
const findFestivalSubEvent = (note, event) => {
  if (!note?.subEvents || !Array.isArray(note.subEvents)) return null;
  const match = note.subEvents.find((se) => {
    const v = se?.venueFormData || se;
    return v?.eventName === event.name ||
      (v?.eventStartDate && new Date(v.eventStartDate).getTime() === new Date(event.startDate).getTime());
  });
  return match?.venueFormData || match || null;
};

/**
 * Resolve and normalize sponsor data from event → noting → festival sub-event
 * @param {Object} event - Event with optional sponsors array
 * @param {Object|null} note - Parent noting with optional eventSponsors
 * @returns {{ sponsors: Array, hasSponsorship: boolean|null }}
 */
const resolveSponsorData = (event, note) => {
  let rawSponsors = (Array.isArray(event.sponsors) && event.sponsors.length > 0)
    ? event.sponsors
    : (Array.isArray(note?.eventSponsors) && note.eventSponsors.length > 0)
      ? note.eventSponsors
      : [];

  if (rawSponsors.length === 0) {
    const subEvent = findFestivalSubEvent(note, event);
    if (Array.isArray(subEvent?.eventSponsors) && subEvent.eventSponsors.length > 0) {
      rawSponsors = subEvent.eventSponsors;
    }
  }

  const sponsors = rawSponsors.map((s) => {
    const name = String(s?.name ?? s?.company ?? s?.sponsorName ?? '').trim();
    // New-format sponsors (have contributionType) — pass through all fields
    if (s && s.contributionType) {
      return { ...s, name };
    }
    // Legacy sponsors — convert to minimal shape
    return {
      name,
      amount: typeof s?.amount === 'number' ? s.amount : Number(s?.amount) || 0,
      type: s?.type === 'in_kind' ? 'in_kind' : 'cash',
      notes: s?.notes != null ? String(s.notes).trim() : undefined,
    };
  }).filter((s) => s.name);

  const hasSponsorship = sponsors.length > 0 ? true : (event.hasSponsorship ?? note?.eventHasSponsorship ?? null);
  return { sponsors, hasSponsorship };
};

/**
 * Resolve and normalize resource data with cost computation from event → noting → festival
 * @param {Object} event - Event with optional resources array
 * @param {Object|null} note - Parent noting with optional eventResources
 * @returns {{ resources: Array, hasResources: boolean|null }}
 */
const resolveResourceData = (event, note) => {
  let rawResources = (Array.isArray(event.resources) && event.resources.length > 0)
    ? event.resources
    : (Array.isArray(note?.eventResources) && note.eventResources.length > 0)
      ? note.eventResources
      : [];

  if (rawResources.length === 0) {
    const subEvent = findFestivalSubEvent(note, event);
    if (Array.isArray(subEvent?.eventResources) && subEvent.eventResources.length > 0) {
      rawResources = subEvent.eventResources;
    }
  }

  const resources = rawResources.map((r) => {
    const type = String(r?.type ?? '').trim();
    const description = String(r?.description ?? '').trim();
    let pricePerPiece = r?.pricePerPiece != null && r?.pricePerPiece !== '' ? Number(r.pricePerPiece) : null;
    let quantity = r?.quantity != null && r?.quantity !== '' ? Number(r.quantity) : null;
    const estimatedCost = typeof r?.estimatedCost === 'number' ? r.estimatedCost
      : (r?.estimatedCost ? Number(r.estimatedCost) : null);
    let computedCost = (estimatedCost == null && pricePerPiece != null && quantity != null)
      ? pricePerPiece * quantity
      : estimatedCost;
    if (computedCost != null && (pricePerPiece == null || quantity == null)) {
      pricePerPiece = pricePerPiece ?? computedCost;
      quantity = quantity ?? 1;
    }
    return {
      category: String(r?.category ?? 'internal').trim() || 'internal',
      type,
      description,
      pricePerPiece: pricePerPiece ?? undefined,
      quantity: quantity ?? undefined,
      estimatedCost: computedCost ?? undefined,
    };
  });

  const hasResources = event.hasResources ?? note?.eventHasResources ?? (resources.length > 0 ? true : null);
  return { resources, hasResources };
};

/**
 * Resolve duty leave data from event → noting fallback
 * @param {Object} event
 * @param {Object|null} note
 * @returns {{ dutyLeaveAvailable: boolean|null, dutyLeaveEligibility: Array|null, dutyLeaveRoleType: string|null }}
 */
const resolveDutyLeaveData = (event, note) => {
  const dutyLeaveAvailable = event.dutyLeaveAvailable ?? note?.eventDutyLeaveAvailable ?? null;
  const dutyLeaveEligibility = (Array.isArray(event.dutyLeaveEligibility) && event.dutyLeaveEligibility.length > 0)
    ? event.dutyLeaveEligibility
    : (Array.isArray(note?.eventDutyLeaveEligibility) && note.eventDutyLeaveEligibility.length > 0)
      ? note.eventDutyLeaveEligibility
      : null;
  const dutyLeaveRoleType = event.dutyLeaveRoleType ?? note?.eventDutyLeaveRoleType ?? null;
  return { dutyLeaveAvailable, dutyLeaveEligibility, dutyLeaveRoleType };
};

/**
 * Lean formatter for list cards — only the fields the frontend list/grid needs.
 * Dramatically smaller payload (~2KB vs ~5KB per event) to reduce JSON serialization cost.
 */
const formatEventListItem = (event) => {
  const note = event.note;
  return {
    id: event.id,
    eventId: event.eventId,
    name: event.name,
    eventType: event.eventType,
    status: event.status,
    startDate: event.startDate,
    endDate: event.endDate,
    registrationStartDate: event.registrationStartDate,
    registrationEndDate: event.registrationEndDate,
    venue: event.venue,
    paymentType: event.paymentType,
    registrationFee: event.registrationFee,
    maxCapacity: event.maxCapacity,
    currentRegistrations: event.currentRegistrations ?? 0,
    bannerImageUrl: event.bannerImageUrl,
    logoImageUrl: event.logoImageUrl,
    participationType: event.participationType,
    hasStalls: event.hasStalls,
    prizesEnabled: event.prizesEnabled,
    certificateAvailable: event.certificateAvailable,
    description: event.description
      ? (event.description.length > 200 ? event.description.slice(0, 200) + '…' : event.description)
      : null,
    createdBy: event.user_login ? {
      id: event.user_login.id,
      name: event.user_login.employeeDetails?.displayName ||
        `${event.user_login.employeeDetails?.firstName || ''} ${event.user_login.employeeDetails?.lastName || ''}`.trim(),
    } : null,
    notingId: event.notingId,
    createdAt: event.createdAt,
  };
};

/**
 * Format event for API response
 * When event is from noting, falls back to note's data if event fields are empty
 * (ensures sponsorship/resources display correctly)
 *
 * @param {Object} event - Full event object with relations
 * @returns {Object} Formatted event response
 */
const formatEventResponse = (event) => {
  const note = event.note;
  const { sponsors, hasSponsorship } = resolveSponsorData(event, note);
  const { resources, hasResources } = resolveResourceData(event, note);
  const { dutyLeaveAvailable, dutyLeaveEligibility, dutyLeaveRoleType } = resolveDutyLeaveData(event, note);

  return {
    id: event.id,
    eventId: event.eventId,
    name: event.name,
    eventType: event.eventType,
    description: event.description,
    longDescription: event.longDescription,
    startDate: event.startDate,
    endDate: event.endDate,
    paymentType: event.paymentType,
    registrationFee: event.registrationFee,
    status: event.status,
    venue: event.venue,
    maxCapacity: event.maxCapacity,
    approxCapacity: event.approxCapacity,
    teamRegistrationFee: event.teamRegistrationFee,
    dutyLeaveAvailable,
    dutyLeaveEligibility,
    dutyLeaveRoleType,
    hasSponsorship,
    sponsors: sponsors.length > 0 ? sponsors : null,
    showSponsorshipPublicly: event.showSponsorshipPublicly ?? false,
    hasResources,
    resources: resources.length > 0 ? resources : null,
    currentRegistrations: event.currentRegistrations,
    isPaid: event.isPaid,
    registrationStartDate: event.registrationStartDate,
    registrationEndDate: event.registrationEndDate,
    publishedAt: event.publishedAt,
    // Event Branding
    bannerImageUrl: event.bannerImageUrl,
    logoImageUrl: event.logoImageUrl,
    // Opportunity Mode & Participation
    opportunityMode: event.opportunityMode,
    participationType: event.participationType,
    minTeamSize: event.minTeamSize,
    maxTeamSize: event.maxTeamSize,
    interCollegeAllowed: event.interCollegeAllowed,
    interSpecializationAllowed: event.interSpecializationAllowed,
    // Contact Details
    contactPersonName: event.contactPersonName,
    contactEmail: event.contactEmail,
    contactMobile: event.contactMobile,
    alternateContact: event.alternateContact,
    websiteUrl: event.websiteUrl,
    socialMediaLinks: event.socialMediaLinks,
    // Additional Information
    eligibilityCriteria: event.eligibilityCriteria,
    eligibilityDisplayFormat: event.eligibilityDisplayFormat || 'paragraph',
    rulesAndGuidelines: event.rulesAndGuidelines,
    rulesDisplayFormat: event.rulesDisplayFormat || 'paragraph',
    prizeDetails: event.prizeDetails,
    certificateAvailable: event.certificateAvailable,
    faqs: event.faqs,
    // Advanced Registration Settings
    maxTeamLimit: event.maxTeamLimit,
    teamRegistrationDeadline: event.teamRegistrationDeadline,
    requireFormSubmission: event.requireFormSubmission,
    lookingForTeammatesEnabled: event.lookingForTeammatesEnabled,
    allowCrossInstituteTeams: event.allowCrossInstituteTeams,
    allowTeamEditAfterSubmission: event.allowTeamEditAfterSubmission,
    autoApproveTeams: event.autoApproveTeams,
    registrationCap: event.registrationCap,
    lockTeamAfterDeadline: event.lockTeamAfterDeadline,
    allowPublicTeamListing: event.allowPublicTeamListing,
    allowJoinRequests: event.allowJoinRequests,
    allowInviteSystem: event.allowInviteSystem,
    prizesEnabled: event.prizesEnabled,
    // Stall & Festival fields
    notingEventType: event.notingEventType,
    stallConfig: event.stallConfig,
    hasStalls: event.hasStalls,
    applicationDeadline: event.applicationDeadline,
    festivalMeta: event.festivalMeta,
    festivalNotingId: event.festivalNotingId,
    // Dynamic data (included when queried)
    customFields: event.EventCustomField || [],
    prizes: event.EventPrize || [],
    rounds: event.EventRound || [],
    // Metadata
    notingId: event.notingId,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    createdBy: event.user_login ? {
      id: event.user_login.id,
      uid: event.user_login.uid,
      email: event.user_login.email,
      name: event.user_login.employeeDetails?.displayName ||
        `${event.user_login.employeeDetails?.firstName || ''} ${event.user_login.employeeDetails?.lastName || ''}`.trim(),
    } : null,
    note: event.note ? {
      notingId: event.note.notingId,
      status: event.note.status,
      category: event.note.category,
      subcategory: event.note.subcategory,
    } : null,
    // Club association (from noting)
    club: event.note?.eventClub ? {
      id: event.note.eventClub.id,
      clubId: event.note.eventClub.clubId,
      name: event.note.eventClub.name,
    } : null,
    userRegistration: event.userRegistration || null,
  };
};

module.exports = {
  generateEventId,
  generateRegistrationId,
  resolveEvent,
  invalidateResolveEventCache,
  generateQRCode,
  getEventById,
  getEventLean,
  canRegisterForEvent,
  isEventVolunteer,
  isEventManager,
  canManageEvent,
  validateQRCodeAndGetRegistration,
  formatEventResponse,
  formatEventListItem,
};
