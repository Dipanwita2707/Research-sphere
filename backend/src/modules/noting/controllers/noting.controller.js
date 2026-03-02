/**
 * Noting & Approval System Controller
 *
 * WORKFLOW SYSTEM:
 * All noting approvals work through the Reporting Structure system:
 *
 * 1. CREATE NOTING:
 *    - User creates noting (any category/subcategory)
 *    - System checks user's manager from ReportingStructure table
 *    - If manager has required permission → Auto-forward to manager
 *    - If not → User must manually select approver from reporting chain
 *
 * 2. APPROVE/REJECT:
 *    - Current holder can approve → Note status becomes APPROVED (workflow ends)
 *    - Current holder can reject → Note status becomes REJECTED (workflow ends)
 *
 * 3. FORWARD:
 *    - Manual: Forward to user in reporting chain with required permission
 *    - DEAN role can override and forward to anyone
 *
 * 4. PERMISSIONS:
 *    - dsw_approve_noting: DSW-related notings
 *    - event_approve: Event approvals
 *    - noting_approve: General noting approvals
 */

const { Prisma } = require("@prisma/client");
const prisma = require("../../../shared/config/database");
const cache = require("../../../shared/config/redis");
const asyncHandler = require("../../../shared/utils/asyncHandler");
const ApiResponse = require("../../../shared/utils/ApiResponse");
const {
  ValidationError,
  ForbiddenError,
} = require("../../../shared/utils/AppError");
const {
  getDefaultPermissions,
} = require("../../../shared/config/permissions.config");

const { generateNotingId } = require("../services/notingId.service");
const approvalFlowService = require("../services/approvalFlow.service");

// Cross-module services (moved to top-level to avoid repeated inline require() calls)
const eventService = require("../../event-management/services/event.service");
const dswNotingService = require("../../dsw/services/notingIntegrationService");

// ── Centralized cache invalidation helper ────────────────────────────────────
// Every state-changing handler (approve/reject/revert/forward/recommend/
// sendCopy/replyCopy/forwardCopy/completeCopy/create/submit/delete) MUST call
// this to bust stale cache for the affected note + all user-scoped list caches.
async function invalidateNoteCaches(noteId) {
  await Promise.all([
    cache.del(`noting:detail:${noteId}`),
    cache.delPattern("noting:counts:*"),
    cache.delPattern("noting:list:*"),
    cache.delPattern("noting:mycopies:*"),
  ]);
}

const { CATEGORIES } = require("../config/noting.config");
const {
  NOTE_STATUS,
  NOTE_ACTIONS,
  LIMITS,
} = require("../constants/noting.constants");
const {
  getPaginationParams,
  createPaginationMeta,
  getCursorPaginationParams,
  buildCursorArgs,
  createCursorPaginationMeta,
} = require("../utils/pagination");
const {
  validateDescription,
  validateCategory,
  validateNoteForSubmission,
  sanitizeAttachments,
  sanitizePoints,
  parsePolicyCompliance,
  sanitizeEventSponsors,
} = require("../utils/validators");
const {
  getNoteById,
  getNoteWithDetails,
  verifyCanEditDraft,
  verifyCanEditNote,
  verifyCanDeleteNote,
  verifyNotePending,
  verifyCanActOnNote,
} = require("../utils/noteHelpers");
const {
  getFullNoteInclude,
  getListNoteInclude,
  getFullNoteSelect,
  getListNoteSelect,
  noteFieldsForList,
  userForList,
  userBasic,
} = require("../utils/selectFragments");

/**
 * Get configuration for frontend
 * Returns categories, subcategories, and dropdown options
 *
 * @route GET /api/noting/config
 * @access Protected
 */
// Config is completely static — cache it for 24 hours so repeated page loads
// do not compute + serialize the same object on every request.
const NOTING_CONFIG_CACHE_KEY = "noting:config:v1";

const getConfig = asyncHandler(async (req, res) => {
  // Try cache first
  const cached = await cache.get(NOTING_CONFIG_CACHE_KEY);
  if (cached) {
    return ApiResponse.success(
      res,
      cached,
      "Configuration fetched successfully",
    );
  }

  const configData = {
    categories: Object.entries(CATEGORIES).map(([key, val]) => ({
      value: key,
      label: val.label,
      subcategories: Object.entries(val.subcategories).map(([k, v]) => ({
        value: k,
        label: v.label,
        idCode: v.idCode,
      })),
    })),
    approvalPeriodOptions: [
      { value: "one_time", label: "One-time" },
      { value: "recurring", label: "Recurring" },
    ],
    recurringFrequencyOptions: [
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
      { value: "quarterly", label: "Quarterly" },
      { value: "half_yearly", label: "Half-Yearly" },
      { value: "annually", label: "Annually" },
    ],
    eventTypeOptions: [
      { value: "seminar", label: "Seminar" },
      { value: "workshop", label: "Workshop" },
      { value: "fest", label: "Fest" },
      { value: "conference", label: "Conference" },
      { value: "competition", label: "Competition" },
      { value: "cultural", label: "Cultural" },
      { value: "technical", label: "Technical" },
      { value: "sports", label: "Sports" },
      { value: "other", label: "Other" },
    ],
    eventPaymentTypeOptions: [
      { value: "free", label: "Free" },
      { value: "paid", label: "Paid" },
    ],
  };

  // Cache for 24 hours (config never changes at runtime)
  await cache.set(NOTING_CONFIG_CACHE_KEY, configData, cache.CACHE_TTL.CONFIG);

  return ApiResponse.success(
    res,
    configData,
    "Configuration fetched successfully",
  );
});

/**
 * Generate preview Noting ID
 * Shows user what ID will be generated before submission
 *
 * @route GET /api/noting/preview-id?category=academic&subcategory=events
 * @access Protected
 */
const previewNotingId = asyncHandler(async (req, res) => {
  const { category, subcategory } = req.query;

  // Validation is handled by validator middleware
  const notingId = generateNotingId(category, subcategory);

  return ApiResponse.success(res, { notingId }, "Noting ID generated");
});

/**
 * Create a new note (draft or submit directly)
 *
 * @route POST /api/noting
 * @access Protected
 */
const create = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    category,
    subcategory,
    description,
    approvalPeriod,
    recurringFrequency,
    policyCompliance,
    policyWithinSgtu,
    policyOutsideSgtu,
    policyBoth,
    policyJustification,
    amountRequired,
    amount,
    points = [],
    attachments: attachmentsPayload = [],
    submit = false,
    // Event-specific fields
    eventName,
    eventType,
    eventStartDate,
    eventEndDate,
    eventPaymentType,
    eventParticipationType,
    eventRegistrationFeeIndividual,
    eventRegistrationFeeTeam,
    eventApproxCapacity,
    eventDutyLeaveAvailable,
    eventDutyLeaveEligibility,
    eventDutyLeaveRoleType,
    eventHasSponsorship,
    eventSponsors,
    eventHasResources,
    eventResources,
    eventCertification,
    eventCapacityFixed,
    eventPrizesAwards,
    // Stall & Festival noting fields
    notingEventType,
    stallConfig,
    festivalMeta,
    subEvents,
  } = req.body;

  // Validate category and subcategory
  validateCategory(category, subcategory);

  // ── Chairperson restriction: students can only create event notings ─────
  if (req.user.role === "student") {
    if (subcategory !== "events") {
      throw new ValidationError(
        "As a Club Chairperson, you can only create event-type notings.",
      );
    }
  }

  // Validate description (required only if submitting)
  const descriptionValue = validateDescription(description, submit);
  if (submit && !descriptionValue) {
    throw new ValidationError(
      "Please add a description explaining your request before submitting.",
    );
  }

  // Validate event fields if provided
  if (
    eventName ||
    eventType ||
    eventStartDate ||
    eventEndDate ||
    eventPaymentType
  ) {
    if (
      !eventName ||
      !eventType ||
      !eventStartDate ||
      !eventEndDate ||
      !eventPaymentType
    ) {
      throw new ValidationError(
        "Please fill in all event details: Event Name, Event Type, Start Date, End Date, and Payment Type.",
      );
    }

    // Validate dates
    const startDate = new Date(eventStartDate);
    const endDate = new Date(eventEndDate);

    if (endDate < startDate) {
      throw new ValidationError(
        "Event End Date should be after Start Date. Please correct the dates.",
      );
    }

    // Validate fee for paid events — minimum ₹1
    if (eventPaymentType === "paid") {
      const isTeam = eventParticipationType === "team";
      if (
        isTeam &&
        (eventRegistrationFeeTeam == null || eventRegistrationFeeTeam === '' || Number(eventRegistrationFeeTeam) < 1)
      ) {
        throw new ValidationError("Participation fee must be at least \u20b91.");
      }
      if (
        !isTeam &&
        (eventRegistrationFeeIndividual == null ||
          eventRegistrationFeeIndividual === '' || Number(eventRegistrationFeeIndividual) < 1)
      ) {
        throw new ValidationError("Participation fee must be at least \u20b91.");
      }
    }
  }

  // Parse policy compliance and sanitize points (used for validation and create)
  const policyCompliant = parsePolicyCompliance(policyCompliance);
  const validPoints = sanitizePoints(points);
  const validAttachments = sanitizeAttachments(attachmentsPayload);

  // Full submission validation (policy, points, amount, recurring, event/festival)
  if (submit) {
    validateNoteForSubmission({
      subcategory: subcategory || "",
      policyCompliant,
      points: validPoints,
      approvalPeriod: approvalPeriod || "one_time",
      recurringFrequency: recurringFrequency || null,
      amountRequired: amountRequired === true,
      amount: amountRequired ? amount : null,
      notingEventType: notingEventType || null,
      festivalMeta: festivalMeta || null,
      subEvents: Array.isArray(subEvents) ? subEvents : null,
      eventName: eventName || null,
      eventType: eventType || null,
      eventStartDate: eventStartDate || null,
      eventEndDate: eventEndDate || null,
      eventPaymentType: eventPaymentType || null,
      eventParticipationType: eventParticipationType || null,
      eventRegistrationFeeIndividual: eventRegistrationFeeIndividual ?? null,
      eventRegistrationFeeTeam: eventRegistrationFeeTeam ?? null,
    });
  }

  // Generate unique noting ID
  const notingId = generateNotingId(category, subcategory);
  const status = submit ? NOTE_STATUS.PENDING : NOTE_STATUS.DRAFT;

  // ── Pre-validate reporting manager BEFORE writing to DB ────────────────────
  // This avoids the wasteful pattern of: create note → check fails → delete note.
  // Validation only applies to submissions (drafts need no manager).
  let preValidatedManagerId = null;
  if (submit) {
    // ── Chairperson override: route to Faculty Facilitator ──────────────────
    if (req.user.role === "student") {
      const chairClub = await prisma.club.findFirst({
        where: {
          chairpersonId: userId,
          status: { in: ["approved", "active"] },
        },
        select: { id: true, facultyFacilitatorId: true },
      });
      if (!chairClub || !chairClub.facultyFacilitatorId) {
        throw new ValidationError(
          "Your club does not have a Faculty Facilitator assigned. Please contact DSW to assign one before submitting notes.",
        );
      }
      // Verify the facilitator has the event_approve permission
      const modulePermissionKey = approvalFlowService.getModulePermissionKey({
        subcategory: subcategory || "",
      });
      const facilitator = await prisma.userLogin.findUnique({
        where: { id: chairClub.facultyFacilitatorId },
        select: { id: true, email: true, employeeDetails: { select: { displayName: true } } },
      });
      if (!facilitator) {
        throw new ValidationError(
          "Your club's Faculty Facilitator account was not found. Please contact DSW.",
        );
      }
      const { hasModulePermission } = approvalFlowService;
      const facHasPerm = await hasModulePermission(facilitator, modulePermissionKey);
      if (!facHasPerm) {
        const facName = facilitator.employeeDetails?.displayName || facilitator.email || "Faculty Facilitator";
        throw new ValidationError(
          `${facName} does not have approval permission (${modulePermissionKey}). Please contact Admin to grant this permission.`,
        );
      }
      preValidatedManagerId = facilitator.id;
    } else {
      // ── Normal flow: use reporting manager ──────────────────────────────────
      const modulePermissionKey = approvalFlowService.getModulePermissionKey({
        subcategory: subcategory || "",
      });
      const reportingService = require("../../core/services/reportingStructure.service");
      const manager = await reportingService.getDirectManager(userId);

      if (!manager) {
        throw new ValidationError(
          "You do not have a reporting manager assigned. Please contact Admin to set up your reporting structure before submitting notes.",
        );
      }

      const { hasModulePermission } = approvalFlowService;
      const managerHasPerm = await hasModulePermission(
        manager,
        modulePermissionKey,
      );
      if (!managerHasPerm) {
        const managerName =
          manager.employeeDetails?.displayName ||
          manager.name ||
          manager.email ||
          "Your manager";
        throw new ValidationError(
          `${managerName} does not have approval permission (${modulePermissionKey}). Please contact Admin to grant this permission before you can submit notes.`,
        );
      }

      preValidatedManagerId = manager.id;
    }
  }

  // Determine initial holder if submitting - already validated above
  let currentHolderId = null;

  // ── PERF: Single interactive transaction replaces 3 sequential round-trips ──
  // Old: create → update (auto-forward) → history.create → findUnique
  // New: $transaction(async) does create + conditional update + history in 1 RT,
  //      then a single findUnique with full includes for the response.
  const noteData = {
      notingId,
      category,
      subcategory,
      description: descriptionValue || "",
      approvalPeriod: approvalPeriod || "one_time",
      recurringFrequency: recurringFrequency || null,
      policyCompliant,
      policyWithinSgtu: policyWithinSgtu ?? null,
      policyOutsideSgtu: policyOutsideSgtu ?? null,
      policyBoth: policyBoth ?? null,
      policyJustification: policyJustification || null,
      amountRequired: amountRequired === true,
      amount: amountRequired && amount != null ? amount : null,
      // Event fields
      eventName: eventName || null,
      eventType: eventType || null,
      eventStartDate: eventStartDate ? new Date(eventStartDate) : null,
      eventEndDate: eventEndDate ? new Date(eventEndDate) : null,
      eventPaymentType: eventPaymentType || null,
      eventParticipationType: eventParticipationType || null,
      eventRegistrationFeeIndividual:
        eventPaymentType === "paid" && eventRegistrationFeeIndividual != null
          ? parseFloat(eventRegistrationFeeIndividual)
          : null,
      eventRegistrationFeeTeam:
        eventPaymentType === "paid" &&
          eventParticipationType === "team" &&
          eventRegistrationFeeTeam != null
          ? parseFloat(eventRegistrationFeeTeam)
          : null,
      eventApproxCapacity:
        eventApproxCapacity != null ? parseInt(eventApproxCapacity, 10) : null,
      eventDutyLeaveAvailable:
        eventDutyLeaveAvailable != null ? !!eventDutyLeaveAvailable : null,
      eventDutyLeaveEligibility: eventDutyLeaveAvailable
        ? Array.isArray(eventDutyLeaveEligibility) &&
          eventDutyLeaveEligibility.length > 0
          ? eventDutyLeaveEligibility
          : ["ug", "pg", "phd"]
        : null,
      eventDutyLeaveRoleType:
        eventDutyLeaveAvailable && eventDutyLeaveRoleType
          ? eventDutyLeaveRoleType
          : null,
      eventHasSponsorship:
        eventHasSponsorship != null ? !!eventHasSponsorship : null,
      eventSponsors: eventHasSponsorship
        ? sanitizeEventSponsors(eventSponsors)
        : null,
      eventHasResources: eventHasResources != null ? !!eventHasResources : null,
      eventResources: Array.isArray(eventResources) ? eventResources : null,
      eventCertification:
        eventCertification != null ? !!eventCertification : null,
      eventCapacityFixed:
        eventCapacityFixed != null ? parseInt(eventCapacityFixed, 10) : null,
      eventPrizesAwards: Array.isArray(eventPrizesAwards)
        ? eventPrizesAwards
        : null,
      // Stall & Festival fields
      notingEventType: notingEventType || null,
      stallConfig: stallConfig || null,
      festivalMeta: festivalMeta || null,
      subEvents: Array.isArray(subEvents) ? subEvents : null,
      status,
      createdById: userId,
      currentHolderId: submit && preValidatedManagerId ? preValidatedManagerId : currentHolderId,
      autoForwardedToManager: submit && preValidatedManagerId ? true : undefined,
      reportingChainHistory: submit && preValidatedManagerId
        ? [{
            timestamp: new Date().toISOString(),
            fromUserId: userId,
            toUserId: preValidatedManagerId,
            reason: "Auto-forwarded to direct reporting manager",
          }]
        : undefined,
      points: validPoints.length ? { create: validPoints } : undefined,
      attachments: validAttachments.length
        ? { create: validAttachments }
        : undefined,
  };

  const noteId_created = await prisma.$transaction(async (tx) => {
    const note = await tx.note.create({ data: noteData });

    // Create history entry if submitted (inside same transaction)
    if (submit && (preValidatedManagerId || currentHolderId)) {
      await tx.noteHistory.create({
        data: {
          noteId: note.id,
          action: NOTE_ACTIONS.FORWARDED,
          performedById: userId,
          remarks: "Auto-forwarded to manager based on reporting hierarchy",
          nextHolderId: preValidatedManagerId || currentHolderId,
        },
      });
    }

    return note.id;
  });

  // Single fetch with full relations at the end — uses select + JOIN strategy
  const finalNote = await prisma.note.findUnique({
    where: { id: noteId_created },
    ...getFullNoteSelect(),
  });

  // Invalidate all noting caches since a new note was created
  await invalidateNoteCaches(noteId_created);

  return ApiResponse.created(
    res,
    finalNote,
    submit
      ? "Note submitted and forwarded to your manager successfully"
      : "Draft saved successfully",
  );
});

/**
 * Update a note
 * Only creator can update, and only before any approver takes action
 *
 * @route PATCH /api/noting/:id
 * @access Protected - Creator only, no approver actions yet
 */
const updateDraft = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const {
    description,
    approvalPeriod,
    recurringFrequency,
    policyCompliance,
    amountRequired,
    amount,
    points = [],
    attachments: attachmentsPayload = [],
    // Event-specific fields
    eventName,
    eventType,
    eventStartDate,
    eventEndDate,
    eventPaymentType,
    eventParticipationType,
    eventRegistrationFeeIndividual,
    eventRegistrationFeeTeam,
    eventApproxCapacity,
    eventDutyLeaveAvailable,
    eventDutyLeaveEligibility,
    eventDutyLeaveRoleType,
    eventHasSponsorship,
    eventSponsors,
    eventHasResources,
    eventResources,
    eventCertification,
    eventCapacityFixed,
    eventPrizesAwards,
    // Stall & Festival noting fields
    notingEventType,
    stallConfig,
    festivalMeta,
    subEvents,
  } = req.body;

  // Load note with history to check if approver has acted
  const note = await getNoteById(id, {
    include: {
      points: true,
      attachments: true,
      history: {
        select: { performedById: true },
      },
    },
  });

  // Verify creator can still edit (no approver actions yet)
  await verifyCanEditNote(note, userId);

  // Validate description if provided
  let descriptionValue;
  if (description !== undefined) {
    descriptionValue = validateDescription(description, false);
  }

  // Parse policy compliance
  const policyCompliant =
    policyCompliance !== undefined
      ? parsePolicyCompliance(policyCompliance)
      : note.policyCompliant;

  // Sanitize attachments and points
  const validAttachments = sanitizeAttachments(attachmentsPayload);
  const validPoints = sanitizePoints(points);

  // Fee validation for paid events — minimum ₹1
  // Use effective values: from this request, or fall back to what's already saved
  const effectivePaymentType = eventPaymentType !== undefined ? eventPaymentType : note.eventPaymentType;
  const effectiveParticipationType = eventParticipationType !== undefined ? eventParticipationType : note.eventParticipationType;
  if (effectivePaymentType === 'paid') {
    const isTeam = effectiveParticipationType === 'team';
    if (isTeam && eventRegistrationFeeTeam !== undefined) {
      if (eventRegistrationFeeTeam == null || eventRegistrationFeeTeam === '' || Number(eventRegistrationFeeTeam) < 1) {
        throw new ValidationError('Participation fee must be at least \u20b91.');
      }
    }
    if (!isTeam && eventRegistrationFeeIndividual !== undefined) {
      if (eventRegistrationFeeIndividual == null || eventRegistrationFeeIndividual === '' || Number(eventRegistrationFeeIndividual) < 1) {
        throw new ValidationError('Participation fee must be at least \u20b91.');
      }
    }
  }

  // Prepare update data
  const updateData = {};
  if (descriptionValue !== undefined) updateData.description = descriptionValue;
  if (approvalPeriod !== undefined)
    updateData.approvalPeriod = approvalPeriod || "one_time";
  if (recurringFrequency !== undefined)
    updateData.recurringFrequency = recurringFrequency || null;
  if (policyCompliant !== undefined && policyCompliant !== null)
    updateData.policyCompliant = policyCompliant;
  if (amountRequired !== undefined) {
    updateData.amountRequired = amountRequired === true;
    if (amountRequired === true && amount != null) {
      updateData.amount = amount;
    } else if (amountRequired === false) {
      updateData.amount = null;
    }
  }

  // Update event fields if provided
  if (eventName !== undefined) updateData.eventName = eventName || null;
  if (eventType !== undefined) updateData.eventType = eventType || null;
  if (eventStartDate !== undefined)
    updateData.eventStartDate = eventStartDate
      ? new Date(eventStartDate)
      : null;
  if (eventEndDate !== undefined)
    updateData.eventEndDate = eventEndDate ? new Date(eventEndDate) : null;
  if (eventPaymentType !== undefined)
    updateData.eventPaymentType = eventPaymentType || null;
  if (eventParticipationType !== undefined)
    updateData.eventParticipationType = eventParticipationType || null;
  if (eventRegistrationFeeIndividual !== undefined)
    updateData.eventRegistrationFeeIndividual =
      eventPaymentType === "paid" && eventRegistrationFeeIndividual != null
        ? parseFloat(eventRegistrationFeeIndividual)
        : null;
  if (eventRegistrationFeeTeam !== undefined)
    updateData.eventRegistrationFeeTeam =
      eventPaymentType === "paid" &&
        eventParticipationType === "team" &&
        eventRegistrationFeeTeam != null
        ? parseFloat(eventRegistrationFeeTeam)
        : null;
  if (eventApproxCapacity !== undefined)
    updateData.eventApproxCapacity =
      eventApproxCapacity != null ? parseInt(eventApproxCapacity, 10) : null;
  if (eventDutyLeaveAvailable !== undefined) {
    updateData.eventDutyLeaveAvailable =
      eventDutyLeaveAvailable != null ? !!eventDutyLeaveAvailable : null;
    if (eventDutyLeaveAvailable === false) {
      updateData.eventDutyLeaveEligibility = null;
      updateData.eventDutyLeaveRoleType = null;
    } else if (
      eventDutyLeaveAvailable === true &&
      Array.isArray(eventDutyLeaveEligibility) &&
      eventDutyLeaveEligibility.length > 0
    ) {
      updateData.eventDutyLeaveEligibility = eventDutyLeaveEligibility;
    }
  }
  if (eventDutyLeaveRoleType !== undefined)
    updateData.eventDutyLeaveRoleType = eventDutyLeaveRoleType || null;
  if (eventHasSponsorship !== undefined)
    updateData.eventHasSponsorship =
      eventHasSponsorship != null ? !!eventHasSponsorship : null;
  if (eventSponsors !== undefined)
    updateData.eventSponsors =
      eventHasSponsorship === false
        ? null
        : sanitizeEventSponsors(eventSponsors || []);
  if (eventHasResources !== undefined)
    updateData.eventHasResources =
      eventHasResources != null ? !!eventHasResources : null;
  if (eventResources !== undefined)
    updateData.eventResources = Array.isArray(eventResources)
      ? eventResources
      : null;
  if (eventCertification !== undefined)
    updateData.eventCertification =
      eventCertification != null ? !!eventCertification : null;
  if (eventCapacityFixed !== undefined)
    updateData.eventCapacityFixed =
      eventCapacityFixed != null ? parseInt(eventCapacityFixed, 10) : null;
  if (eventPrizesAwards !== undefined)
    updateData.eventPrizesAwards = Array.isArray(eventPrizesAwards)
      ? eventPrizesAwards
      : null;
  // Stall & Festival fields
  if (notingEventType !== undefined)
    updateData.notingEventType = notingEventType || null;
  if (stallConfig !== undefined) updateData.stallConfig = stallConfig || null;
  if (festivalMeta !== undefined)
    updateData.festivalMeta = festivalMeta || null;
  if (subEvents !== undefined)
    updateData.subEvents = Array.isArray(subEvents) ? subEvents : null;

  // Update in transaction
  await prisma.$transaction(async (tx) => {
    // Update points if provided
    if (Array.isArray(points)) {
      await tx.notePoint.deleteMany({ where: { noteId: id } });
      if (validPoints.length) {
        await tx.notePoint.createMany({
          data: validPoints.map((p) => ({ noteId: id, ...p })),
        });
      }
    }

    // Update attachments if provided
    if (attachmentsPayload !== undefined) {
      await tx.noteAttachment.deleteMany({ where: { noteId: id } });
      if (validAttachments.length) {
        await tx.noteAttachment.createMany({
          data: validAttachments.map((a) => ({ noteId: id, ...a })),
        });
      }
    }

    // Update note
    if (Object.keys(updateData).length) {
      await tx.note.update({ where: { id }, data: updateData });
    }
  });

  // Fetch updated note
  const updated = await prisma.note.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
      points: { orderBy: { sortOrder: "asc" } },
      attachments: true,
    },
  });

  return ApiResponse.success(res, updated, "Draft updated successfully");
});

/**
 * Delete a note
 * Only creator can delete, and only if no actions have been taken
 * Once submitted/forwarded/approved/rejected, note cannot be deleted
 *
 * @route DELETE /api/noting/:id
 * @access Protected - Creator only, no actions taken
 */
const deleteDraft = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  // Load note with history to check for actions
  const note = await getNoteById(id, {
    include: {
      history: {
        select: { id: true, performedById: true },
      },
    },
  });

  // Verify user is creator and no actions have been taken
  await verifyCanDeleteNote(note, userId);

  // Delete note (cascades to points, attachments, history)
  await prisma.note.delete({ where: { id } });

  await invalidateNoteCaches(id);

  return ApiResponse.success(res, null, "Note deleted successfully");
});

/**
 * Submit draft for approval
 * Only creator can submit, only when status is draft
 *
 * @route POST /api/noting/:id/submit
 * @access Protected - Creator only
 */
const submitDraft = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  // Load note with all fields needed for validation
  const note = await getNoteById(id, { include: { points: true } });

  // Verify permissions (allows draft or reverted status)
  verifyCanEditDraft(note, userId);

  // Validate description is present
  if (!String(note.description || "").trim()) {
    throw new ValidationError(
      "Please add a description explaining your request before submitting.",
    );
  }

  // Full submission validation (policy, points, amount, recurring, event/festival)
  validateNoteForSubmission(note);

  // Determine if this is a resubmission after revert
  const isResubmission = note.status === NOTE_STATUS.REVERTED;
  const action = isResubmission
    ? NOTE_ACTIONS.RESUBMITTED
    : NOTE_ACTIONS.SUBMITTED;
  const actionMessage = isResubmission
    ? "Note resubmitted after modifications"
    : "Note submitted for approval";

  // Get module permission key
  const modulePermissionKey = approvalFlowService.getModulePermissionKey(note);

  let currentHolderId = null;

  // ── Chairperson override: route to Faculty Facilitator ──────────────────
  if (req.user.role === "student") {
    const chairClub = await prisma.club.findFirst({
      where: {
        chairpersonId: userId,
        status: { in: ["approved", "active"] },
      },
      select: { id: true, facultyFacilitatorId: true },
    });
    if (!chairClub || !chairClub.facultyFacilitatorId) {
      throw new ValidationError(
        "Your club does not have a Faculty Facilitator assigned. Please contact DSW to assign one before submitting notes.",
      );
    }
    const facilitator = await prisma.userLogin.findUnique({
      where: { id: chairClub.facultyFacilitatorId },
      select: { id: true, email: true, employeeDetails: { select: { displayName: true } } },
    });
    if (!facilitator) {
      throw new ValidationError(
        "Your club's Faculty Facilitator account was not found. Please contact DSW.",
      );
    }
    const { hasModulePermission } = approvalFlowService;
    const facHasPerm = await hasModulePermission(facilitator, modulePermissionKey);
    if (!facHasPerm) {
      const facName = facilitator.employeeDetails?.displayName || facilitator.email || "Faculty Facilitator";
      throw new ValidationError(
        `${facName} does not have approval permission (${modulePermissionKey}). Please contact Admin to grant this permission.`,
      );
    }
    currentHolderId = facilitator.id;
  } else {
    // ── Normal flow: use reporting structure ──────────────────────────────
    // Check reporting structure for auto-forward
    const autoForwardResult =
      await approvalFlowService.determineNextApproverByReporting(
        note,
        modulePermissionKey,
      );

    // CASE 1: No manager assigned - REJECT submission
    if (!autoForwardResult.nextApproverId) {
      throw new ValidationError(
        "You do not have a reporting manager assigned. Please contact Admin to set up your reporting structure before submitting notes.",
      );
    }

    // CASE 2: Manager doesn't have approval permission - REJECT submission
    if (!autoForwardResult.canAutoForward) {
      const managerName =
        autoForwardResult.managerInfo?.name ||
        autoForwardResult.managerInfo?.email ||
        "Your manager";
      throw new ValidationError(
        `${managerName} does not have approval permission (${modulePermissionKey}). Please contact Admin to grant this permission before you can submit notes.`,
      );
    }

    // CASE 3: Manager has permission - Forward to manager
    currentHolderId = autoForwardResult.nextApproverId;
  }

  // Update note and create history in transaction
  await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: id,
        action: action,
        performedById: userId,
        remarks: `${actionMessage} - Auto-forwarded to manager`,
        nextHolderId: currentHolderId,
      },
    }),
    prisma.note.update({
      where: { id },
      data: {
        status: NOTE_STATUS.PENDING,
        currentHolderId,
        autoForwardedToManager: true,
      },
    }),
  ]);

  // Fetch updated note
  const updated = await prisma.note.findUnique({
    where: { id },
    include: {
      currentHolder: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
    },
  });

  await invalidateNoteCaches(id);

  return ApiResponse.success(
    res,
    updated,
    isResubmission
      ? "Note resubmitted successfully"
      : "Note submitted for approval",
  );
});

/**
 * Get note by ID with full details
 * Includes creator, current holder, points, history, and attachments
 *
 * @route GET /api/noting/:id
 * @access Protected
 */
const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ── PERF: Cache note detail for 120s ────────────────────────────────────
  // With select{} + relationLoadStrategy:"join", queries are faster but
  // caching still avoids Neon round-trips. invalidateNoteCaches() busts
  // the cache on any state change, so 120s is safe.
  const cacheKey = `noting:detail:${id}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return ApiResponse.success(res, cached, "Note details retrieved successfully");
  }

  // Fetch note with full details
  const note = await getNoteWithDetails(id);

  // Cache for 120 seconds (invalidated on state changes)
  await cache.set(cacheKey, note, 120);

  return ApiResponse.success(res, note, "Note details retrieved successfully");
});

/**
 * List notes with filtering and pagination
 * Filters: mine (created by me), pending (current holder / DSW/Central), handled (approved/rejected/forwarded by me)
 *
 * @route GET /api/noting?filter=mine&status=draft&page=1&limit=20
 * @access Protected
 */
const list = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    filter = "mine",
    status,
    category,
    search, // Search by notingId or description
    createdById, // Filter by creator ID
    startDate, // Date range start
    endDate, // Date range end
    includeCounts, // When true, include mine/pending/handled counts in response
    cursor, // Cursor-based pagination (pass last item ID)
    handledAction, // When filter=handled: 'approved' | 'rejected' to sub-filter by action type
  } = req.query;
  const { page, limit, skip } = getPaginationParams(req.query);
  const useCursor = !!cursor;
  const wantCounts = includeCounts === "true" || includeCounts === true;

  // ── PERF: Cache list results per-user per-params for 30s ────────────────
  // The list endpoint runs 2-5 DB queries (findMany + count + optional counts).
  // On Neon serverless, each round-trip adds latency. 30s cache covers rapid
  // tab-switching & filter changes while invalidateNoteCaches() busts stale data.
  const paginationKey = useCursor ? `c:${cursor}:${limit}` : `${page}:${limit}`;
  const listCacheKey = `noting:list:${userId}:${filter}:${paginationKey}:${status || ""}:${category || ""}:${search || ""}:${createdById || ""}:${startDate || ""}:${endDate || ""}:${wantCounts}:${handledAction || ""}`;
  const cachedList = await cache.get(listCacheKey);
  if (cachedList) {
    return res.status(200).json(cachedList);
  }

  // ── PERF: Use select{} + relationLoadStrategy:"join" instead of include{} ──
  // This reduces round-trips from 5+ to 1 and only loads needed columns.
  const listSelectOpts = getListNoteSelect();

  let notes;
  let total;

  if (filter === "handled") {
    // Get notes current user has acted on - use efficient paginated subquery instead of loading all history
    // handledAction sub-filter: 'approved' → approved+recommended, 'rejected' → rejected+not_recommended
    let actions;
    if (handledAction === "approved") {
      actions = [NOTE_ACTIONS.APPROVED, NOTE_ACTIONS.RECOMMENDED];
    } else if (handledAction === "rejected") {
      actions = [NOTE_ACTIONS.REJECTED, NOTE_ACTIONS.NOT_RECOMMENDED];
    } else {
      actions = [
        NOTE_ACTIONS.APPROVED,
        NOTE_ACTIONS.REJECTED,
        NOTE_ACTIONS.FORWARDED,
        NOTE_ACTIONS.REVERTED,
        NOTE_ACTIONS.RECOMMENDED,
        NOTE_ACTIONS.NOT_RECOMMENDED,
      ];
    }
    const actionParams = Prisma.join(actions.map((a) => Prisma.sql`${a}`));
    const [totalResult, pageRows] = await Promise.all([
      prisma.$queryRaw(Prisma.sql`SELECT COUNT(*)::int as cnt FROM (
        SELECT DISTINCT note_id FROM note_history
        WHERE performed_by_id = ${userId}::uuid AND action IN (${actionParams})
      ) sub`),
      prisma.$queryRaw(Prisma.sql`
        SELECT note_id as "noteId", action, created_at as "performedAt"
        FROM (
          SELECT note_id, action, created_at,
            ROW_NUMBER() OVER (PARTITION BY note_id ORDER BY created_at DESC) as rn
          FROM note_history
          WHERE performed_by_id = ${userId}::uuid AND action IN (${actionParams})
        ) sub
        WHERE rn = 1
        ORDER BY "performedAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `),
    ]);

    total = totalResult?.[0]?.cnt ?? 0;
    const noteIds = pageRows.map((r) => r.noteId);

    if (noteIds.length > 0) {
      const fetched = await prisma.note.findMany({
        where: { id: { in: noteIds } },
        ...listSelectOpts,
      });
      const noteMap = new Map(fetched.map((n) => [n.id, n]));
      notes = pageRows
        .map(({ noteId, action, performedAt }) => {
          const note = noteMap.get(noteId);
          if (!note) return null;
          return { ...note, myAction: { action, performedAt } };
        })
        .filter(Boolean);
    } else {
      notes = [];
    }
  } else {
    // Build where clause
    let where = {};

    if (filter === "mine") {
      where.createdById = userId;
    } else if (filter === "pending") {
      where = {
        status: NOTE_STATUS.PENDING,
        currentHolderId: userId,
      };
    }

    // Apply additional filters
    if (status) where.status = status;
    if (category) where.category = category;
    if (createdById) where.createdById = createdById;

    // Search by notingId or description
    if (search) {
      where.OR = [
        { notingId: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        where.createdAt.lte = end;
      }
    }

    // ── PERF: Use select{} + relationLoadStrategy:"join" + cursor pagination ──
    // Standard query with pagination (cursor or offset)
    const cursorArgs = useCursor
      ? { take: limit, skip: 1, cursor: { id: cursor } }
      : { skip, take: limit };

    [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        ...listSelectOpts,
        orderBy: { updatedAt: "desc" },
        ...cursorArgs,
      }),
      // Only compute total on first page (offset) or when not using cursor
      useCursor ? null : prisma.note.count({ where }),
    ]);
  }

  // ── Build pagination metadata (supports both offset & cursor modes) ─────
  const pagination = useCursor
    ? createCursorPaginationMeta(notes, limit, total)
    : createPaginationMeta(page, limit, total);

  if (wantCounts) {
    // ── PERF: Cache counts per-user in Redis (30s TTL) ─────────────────────
    // Counts rarely change between page navigations. Caching prevents 3 extra
    // DB round-trips on every filter/page change.
    const countsCacheKey = `noting:counts:${userId}`;
    let counts = await cache.get(countsCacheKey);

    if (!counts) {
      const actions = [
        NOTE_ACTIONS.APPROVED,
        NOTE_ACTIONS.REJECTED,
        NOTE_ACTIONS.FORWARDED,
        NOTE_ACTIONS.REVERTED,
      ];
      const actionParams = Prisma.join(actions.map((a) => Prisma.sql`${a}`));
      const [mineCount, handledResult, pendingCount] = await Promise.all([
        prisma.note.count({ where: { createdById: userId } }),
        prisma.$queryRaw(Prisma.sql`
          SELECT COUNT(DISTINCT note_id)::int as cnt FROM note_history
          WHERE performed_by_id = ${userId}::uuid AND action IN (${actionParams})
        `),
        prisma.note.count({
          where: {
            status: NOTE_STATUS.PENDING,
            currentHolderId: userId,
          },
        }),
      ]);
      const handledCount = handledResult?.[0]?.cnt ?? 0;
      counts = { mine: mineCount, pending: pendingCount, handled: handledCount };
      // Cache for 60 seconds (invalidated on state changes)
      await cache.set(countsCacheKey, counts, 60);
    }

    const responseBody = {
      success: true,
      message: "Notes fetched successfully",
      data: notes,
      pagination,
      counts,
    };
    await cache.set(listCacheKey, responseBody, 60);
    return res.status(200).json(responseBody);
  }

  // Cache non-counts response too
  const paginatedResponse = {
    success: true,
    message: "Notes fetched successfully",
    data: notes,
    pagination,
  };
  await cache.set(listCacheKey, paginatedResponse, 60);
  return res.status(200).json(paginatedResponse);
});

/**
 * Get counts for badge display
 * Returns counts for: mine (all created by me), pending (awaiting my action), handled (I've acted on)
 *
 * @route GET /api/noting/counts
 * @access Protected
 */
const getCounts = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // ── PERF: Check cache first (same key as list handler uses) ─────────────
  const countsCacheKey = `noting:counts:${userId}`;
  const cached = await cache.get(countsCacheKey);
  if (cached) {
    return ApiResponse.success(res, cached, "Counts fetched successfully");
  }

  const actions = [
    NOTE_ACTIONS.APPROVED,
    NOTE_ACTIONS.REJECTED,
    NOTE_ACTIONS.FORWARDED,
    NOTE_ACTIONS.REVERTED,
  ];
  const actionParams = Prisma.join(actions.map((a) => Prisma.sql`${a}`));

  const [mineCount, handledResult, pendingCount] = await Promise.all([
    prisma.note.count({ where: { createdById: userId } }),
    prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(DISTINCT note_id)::int as cnt FROM note_history
      WHERE performed_by_id = ${userId}::uuid AND action IN (${actionParams})
    `),
    prisma.note.count({
      where: {
        status: NOTE_STATUS.PENDING,
        currentHolderId: userId,
      },
    }),
  ]);

  const handledCount = handledResult?.[0]?.cnt ?? 0;
  const counts = { mine: mineCount, pending: pendingCount, handled: handledCount };

  // Cache for 60 seconds (invalidated on state changes)
  await cache.set(countsCacheKey, counts, 60);

  return ApiResponse.success(res, counts, "Counts fetched successfully");
});

/**
 * Approve a pending note and move to next approver
 * DSW/Central Team: any member can act
 *
 * @route POST /api/noting/:id/approve
 * @access Protected - Current approver only
 */
const approve = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  // Load note
  const note = await getNoteById(id);
  verifyNotePending(note);
  await verifyCanActOnNote(note, userId);

  // Approve = Final endpoint, workflow ends here
  // Update note and create history in transaction, return updated note directly
  const [, updated] = await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.APPROVED,
        performedById: userId,
        remarks: remarks || null,
        nextHolderId: null,
      },
    }),
    prisma.note.update({
      where: { id },
      data: {
        currentHolderId: null,
        status: NOTE_STATUS.APPROVED,
      },
      include: {
        currentHolder: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } },
          },
        },
      },
    }),
  ]);

  // Auto-create event(s) if this is an event noting
  let eventCreated = false;
  let eventId = null; // single event (venue/stall)
  let eventIds = null; // multiple events (festival sub-events)
  let isFestivalNoting = false;
  try {
    const isFestival = updated.notingEventType === "festival";
    const hasBasicEventFields =
      updated.eventName &&
      updated.eventType &&
      updated.eventStartDate &&
      updated.eventEndDate &&
      updated.eventPaymentType;
    const hasFestivalSubEvents =
      isFestival &&
      Array.isArray(updated.subEvents) &&
      updated.subEvents.length > 0;

    if (hasFestivalSubEvents || hasBasicEventFields) {
      const result = await eventService.createEventFromNoting(
        updated.id,
        userId,
      );
      eventCreated = true;
      isFestivalNoting = result.isFestival;

      if (result.isFestival) {
        eventIds = result.events.map((e) => e.eventId);
        console.log(
          `✅ Auto-created ${result.events.length} DRAFT sub-event(s) for festival noting ${updated.notingId}: [${eventIds.join(", ")}]`,
        );
      } else {
        eventId = result.event.eventId;
        console.log(
          `✅ Auto-created DRAFT event ${eventId} for noting ${updated.notingId}`,
        );
      }
    }
  } catch (error) {
    // Log error but don't fail the approval
    console.error("❌ Failed to auto-create event:", error.message);
  }

  // Auto-create club if this is a DSW club creation noting
  let clubCreated = false;
  let clubId = null;
  try {
    if (
      updated.category === "administrative" &&
      updated.subcategory === "dsw_club_creation"
    ) {
      const club = await dswNotingService.processApprovedClubCreationNoting(
        updated,
        userId,
      );
      clubCreated = true;
      clubId = club.clubId;
      console.log(
        `✅ Auto-created club ${club.clubId} for noting ${updated.notingId}`,
      );
    }
  } catch (error) {
    // Log error but don't fail the approval
    console.error("❌ Failed to auto-create club:", error.message);
  }

  let successMessage = "Note approved successfully";
  if (eventCreated && isFestivalNoting && eventIds) {
    successMessage = `Note approved successfully. ${eventIds.length} sub-event(s) created in DRAFT status. The creator can now add details and publish them.`;
  } else if (eventCreated && eventId) {
    successMessage = `Note approved successfully. Event ${eventId} created in DRAFT status. The creator can now add details and publish it.`;
  }
  if (clubCreated && clubId) {
    successMessage = `Note approved successfully. Club ${clubId} has been created and is now ACTIVE.`;
  }

  // Invalidate all noting caches for affected users
  await invalidateNoteCaches(id);

  return ApiResponse.success(
    res,
    {
      ...updated,
      eventCreated,
      eventId,
      eventIds,
      isFestivalNoting,
      clubCreated,
      clubId,
    },
    successMessage,
  );
});

/**
 * Reject a pending note
 * Remarks are mandatory for rejection
 * DSW/Central Team: any member can act
 *
 * @route POST /api/noting/:id/reject
 * @access Protected - Current approver only
 */
const reject = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  // Validation is handled by validator middleware

  // Load note
  const note = await getNoteById(id);
  verifyNotePending(note);
  await verifyCanActOnNote(note, userId);

  // Update note and create history in transaction
  await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.REJECTED,
        performedById: userId,
        remarks: String(remarks).trim(),
      },
    }),
    prisma.note.update({
      where: { id },
      data: {
        status: NOTE_STATUS.REJECTED,
        currentHolderId: null,
      },
    }),
  ]);

  await invalidateNoteCaches(id);
  return ApiResponse.success(res, null, "Note rejected successfully");
});

/**
 * Revert note back to creator for modifications
 * Approver sends note back to original creator (not step-by-step) with remarks
 * Creator can then edit and resubmit
 *
 * @route POST /api/noting/:id/revert
 * @access Protected - Current approver only
 */
const revert = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  // Validation is handled by validator middleware

  // Load note
  const note = await getNoteById(id);
  verifyNotePending(note);
  await verifyCanActOnNote(note, userId);

  // Update note and create history in transaction
  await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.REVERTED,
        performedById: userId,
        remarks: String(remarks).trim(),
        nextHolderId: note.createdById, // Always back to original creator
      },
    }),
    prisma.note.update({
      where: { id },
      data: {
        status: NOTE_STATUS.REVERTED,
        currentHolderId: note.createdById, // Set creator as current holder
      },
    }),
  ]);

  await invalidateNoteCaches(id);

  return ApiResponse.success(
    res,
    null,
    "Note reverted back to creator successfully",
  );
});

/**
 * Forward note to another authority
 * Manual: Forward to user in reporting chain with required permission
 * DEAN role can override and forward to anyone
 *
 * @route POST /api/noting/:id/forward
 * @access Protected - Current approver only
 */
const forward = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { nextHolderId, remarks } = req.body;

  // Load note with creator details
  const note = await getNoteById(id, {
    include: {
      createdBy: {
        select: {
          id: true,
          role: true,
        },
      },
    },
  });
  verifyNotePending(note);
  await verifyCanActOnNote(note, userId);

  // Manual forward - allow forwarding to any employee (no hierarchy restriction)
  if (!nextHolderId || !String(nextHolderId).trim()) {
    throw new ValidationError(
      "Please select a person to forward this note to.",
    );
  }
  const targetHolderId = String(nextHolderId).trim();

  // Verify target user exists and is active
  const targetUser = await prisma.userLogin.findUnique({
    where: { id: targetHolderId },
    select: {
      id: true,
      uid: true,
      status: true,
      employeeDetails: { select: { displayName: true } },
    },
  });

  if (!targetUser) {
    throw new ValidationError("Selected user not found.");
  }

  if (targetUser.status !== "active") {
    throw new ValidationError(
      `${targetUser.employeeDetails?.displayName || targetUser.uid} is not an active user.`,
    );
  }

  if (targetHolderId === userId) {
    throw new ValidationError("You cannot forward a note to yourself.");
  }

  // Update note and create history in transaction, return updated note directly
  const [, updated] = await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.FORWARDED,
        performedById: userId,
        remarks: String(remarks || "").trim(),
        nextHolderId: targetHolderId,
      },
    }),
    prisma.note.update({
      where: { id },
      data: {
        currentHolderId: targetHolderId,
        reportingChainHistory: {
          push: {
            timestamp: new Date().toISOString(),
            fromUserId: userId,
            toUserId: targetHolderId,
            reason: remarks || "Manual forward",
          },
        },
      },
      include: {
        currentHolder: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } },
          },
        },
      },
    }),
  ]);

  await invalidateNoteCaches(id);
  return ApiResponse.success(res, updated, "Note forwarded successfully");
});

/**
 * Get creator info for logged-in user
 * Used to display "Created By" section in frontend
 *
 * @route GET /api/noting/my-creator-info
 * @access Protected
 */
const getMyCreatorInfo = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: {
      id: true,
      uid: true,
      email: true,
      role: true,
      employeeDetails: {
        select: {
          firstName: true,
          lastName: true,
          displayName: true,
          empId: true,
          primaryDepartment: { select: { departmentName: true } },
          primarySchool: { select: { facultyName: true } },
        },
      },
      studentLogin: {
        select: {
          studentId: true,
          displayName: true,
          program: {
            select: {
              programName: true,
              department: {
                select: {
                  departmentName: true,
                  faculty: { select: { facultyName: true } },
                },
              },
            },
          },
          section: { select: { sectionCode: true } },
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError("User");
  }

  // Build display name
  const name =
    user.employeeDetails?.displayName ||
    [user.employeeDetails?.firstName, user.employeeDetails?.lastName]
      .filter(Boolean)
      .join(" ") ||
    user.studentLogin?.displayName ||
    user.uid;

  const employeeId =
    user.employeeDetails?.empId ?? user.studentLogin?.studentId ?? null;

  // Get department and school
  let department =
    user.employeeDetails?.primaryDepartment?.departmentName ?? null;
  let school = user.employeeDetails?.primarySchool?.facultyName ?? null;

  if (user.role === "student" && user.studentLogin?.program?.department) {
    department = user.studentLogin.program.department.departmentName ?? null;
    school = user.studentLogin.program.department.faculty?.facultyName ?? null;
  }

  return ApiResponse.success(res, {
    name,
    employeeIdOrStudentId: employeeId,
    role: user.role,
    department,
    school,
  });
});

/**
 * Get programs by department (for manual forward dropdown)
 *
 * @route GET /api/noting/forward-options/programs?departmentId=uuid
 * @access Protected
 */
const getForwardPrograms = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;

  // Validation handled by validator middleware

  const programs = await prisma.program.findMany({
    where: {
      departmentId: String(departmentId),
      isActive: true,
    },
    select: {
      id: true,
      programName: true,
      programCode: true,
    },
    orderBy: { programName: "asc" },
  });

  return ApiResponse.success(res, programs);
});

/**
 * Get users in department (for manual forward dropdown)
 *
 * @route GET /api/noting/forward-options/users?departmentId=uuid
 * @access Protected
 */
const getForwardUsers = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;

  // Validation handled by validator middleware

  const users = await prisma.userLogin.findMany({
    where: {
      role: { in: ["faculty", "staff"] },
      employeeDetails: {
        is: { primaryDepartmentId: String(departmentId) },
      },
    },
    select: {
      id: true,
      uid: true,
      role: true,
      employeeDetails: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          empId: true,
        },
      },
    },
    orderBy: { uid: "asc" },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    uid: u.uid,
    role: u.role,
    displayName:
      u.employeeDetails?.displayName ||
      [u.employeeDetails?.firstName, u.employeeDetails?.lastName]
        .filter(Boolean)
        .join(" ") ||
      u.uid,
  }));

  return ApiResponse.success(res, formattedUsers);
});

/**
 * Search employees by UID or name (for manual forward)
 *
 * @route GET /api/noting/search-employees?q=searchterm
 * @access Protected
 */
const searchEmployees = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || String(q).trim().length < 2) {
    return ApiResponse.success(res, []);
  }

  const searchTerm = String(q).trim();

  const users = await prisma.userLogin.findMany({
    where: {
      role: "faculty",
      status: "active",
      OR: [
        { uid: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        {
          employeeDetails: {
            displayName: { contains: searchTerm, mode: "insensitive" },
          },
        },
        {
          employeeDetails: {
            firstName: { contains: searchTerm, mode: "insensitive" },
          },
        },
        {
          employeeDetails: {
            lastName: { contains: searchTerm, mode: "insensitive" },
          },
        },
        {
          employeeDetails: {
            empId: { contains: searchTerm, mode: "insensitive" },
          },
        },
      ],
    },
    select: {
      id: true,
      uid: true,
      role: true,
      employeeDetails: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          empId: true,
          primaryDepartment: { select: { departmentName: true } },
          primarySchool: { select: { facultyName: true } },
        },
      },
    },
    take: 15,
    orderBy: { uid: "asc" },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    uid: u.uid,
    role: u.role,
    displayName:
      u.employeeDetails?.displayName ||
      [u.employeeDetails?.firstName, u.employeeDetails?.lastName]
        .filter(Boolean)
        .join(" ") ||
      u.uid,
    empId: u.employeeDetails?.empId || "",
    department: u.employeeDetails?.primaryDepartment?.departmentName || "",
    school: u.employeeDetails?.primarySchool?.facultyName || "",
  }));

  return ApiResponse.success(res, formattedUsers);
});

/**
 * Get reporting manager info for preview
 *
 * @route GET /api/noting/my-manager
 * @access Protected
 */
const getMyManager = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const reportingService = require("../../core/services/reportingStructure.service");
  const manager = await reportingService.getDirectManager(userId);

  if (!manager) {
    return ApiResponse.success(res, null, "No reporting manager found");
  }

  const managerInfo = {
    id: manager.id,
    uid: manager.uid,
    displayName:
      manager.employeeDetails?.displayName ||
      manager.employeeDetails?.firstName ||
      manager.uid,
    empId: manager.employeeDetails?.empId || "",
    department:
      manager.employeeDetails?.primaryDepartment?.departmentName || "",
    school: manager.employeeDetails?.primarySchool?.facultyName || "",
  };

  return ApiResponse.success(res, managerInfo);
});

/**
 * Auto-forward note to immediate reporting manager
 *
 * @route POST /api/noting/:id/auto-forward
 * @access Protected
 */
const autoForward = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  // Load note
  const note = await getNoteById(id);
  verifyNotePending(note);
  await verifyCanActOnNote(note, userId);

  // Get module permission key
  const modulePermissionKey = approvalFlowService.getModulePermissionKey(note);

  // Get immediate manager
  const reportingService = require("../../core/services/reportingStructure.service");
  const manager = await reportingService.getDirectManager(userId);

  if (!manager) {
    throw new ValidationError(
      "You do not have a reporting manager assigned. Please contact Admin to set up your reporting structure.",
    );
  }

  // Update note and create history, return updated note directly
  const [, updated] = await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.FORWARDED,
        performedById: userId,
        remarks: String(
          remarks || "Auto-forwarded to reporting manager",
        ).trim(),
        nextHolderId: manager.id,
      },
    }),
    prisma.note.update({
      where: { id },
      data: {
        currentHolderId: manager.id,
        reportingChainHistory: {
          push: {
            timestamp: new Date().toISOString(),
            fromUserId: userId,
            toUserId: manager.id,
            reason: remarks || "Auto-forwarded to reporting manager",
          },
        },
      },
      include: {
        currentHolder: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } },
          },
        },
      },
    }),
  ]);

  const managerName =
    manager.employeeDetails?.displayName || manager.uid || manager.email;
  await invalidateNoteCaches(id);
  return ApiResponse.success(
    res,
    updated,
    `Note forwarded to ${managerName} (your reporting manager)`,
  );
});

// ===================================================================
// RECOMMEND / NOT RECOMMEND
// ===================================================================

/**
 * Recommend a pending note and forward to next approver
 * Works similar to forward, but records action as "recommended"
 *
 * @route POST /api/noting/:id/recommend
 */
const recommend = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  if (!remarks || !remarks.trim()) {
    throw new ValidationError("Remarks are mandatory for recommendation");
  }

  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw new NotFoundError("Note");
  if (note.status !== "pending") {
    throw new ValidationError("Only pending notes can be recommended");
  }
  if (note.currentHolderId !== userId) {
    throw new ForbiddenError("Only the current holder can recommend this note");
  }

  // Subcategory permission check — no noting_approve fallback
  const isPrivileged = ['admin', 'superadmin', 'dean'].includes(req.user.role) || req.user.roleCode === 'DEAN';
  if (!isPrivileged) {
    const modulePermKey = approvalFlowService.getModulePermissionKey(note);
    const { hasPermissionAsync } = require('../../../shared/config/permissions.config');
    const hasSubcatPerm = await hasPermissionAsync(req.user, modulePermKey);
    if (!hasSubcatPerm) {
      const subcatLabel = (note.subcategory || 'unknown').replace(/_/g, ' ');
      throw new ForbiddenError(
        `You do not have the Subcategory Approval permission for "${subcatLabel}" notings. Required: ${modulePermKey}`
      );
    }
  }

  // Get the next person in chain using the canonical reporting service
  const reportingService = require("../../core/services/reportingStructure.service");
  const manager = await reportingService.getDirectManager(userId);
  if (!manager || !manager.id) {
    throw new ValidationError(
      "No reporting manager found to forward recommendation",
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.note.update({
      where: { id },
      data: { currentHolderId: manager.id },
      include: {
        createdBy: {
          select: { id: true, uid: true, employeeDetails: { select: { displayName: true } } },
        },
        currentHolder: {
          select: { id: true, uid: true, employeeDetails: { select: { displayName: true } } },
        },
      },
    }),
    prisma.noteHistory.create({
      data: {
        noteId: id,
        action: "recommended",
        performedById: userId,
        remarks: remarks.trim(),
        nextHolderId: manager.id,
      },
    }),
  ]);

  await invalidateNoteCaches(id);

  return ApiResponse.success(
    res,
    updated,
    "Note recommended and forwarded to next authority",
  );
});

/**
 * Not Recommend a pending note — forwards to reporting manager with
 * "not_recommended" label so the next authority can see the previous
 * holder did NOT recommend it. Works exactly like recommend() but
 * records the action as "not_recommended".
 *
 * @route POST /api/noting/:id/not-recommend
 */
const notRecommend = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  if (!remarks || !remarks.trim()) {
    throw new ValidationError("Remarks are mandatory when not recommending");
  }

  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw new NotFoundError("Note");
  if (note.status !== "pending") {
    throw new ValidationError("Only pending notes can be acted upon");
  }
  if (note.currentHolderId !== userId) {
    throw new ForbiddenError("Only the current holder can act on this note");
  }

  // Subcategory permission check — no noting_approve fallback
  const isPrivileged = ['admin', 'superadmin', 'dean'].includes(req.user.role) || req.user.roleCode === 'DEAN';
  if (!isPrivileged) {
    const modulePermKey = approvalFlowService.getModulePermissionKey(note);
    const { hasPermissionAsync } = require('../../../shared/config/permissions.config');
    const hasSubcatPerm = await hasPermissionAsync(req.user, modulePermKey);
    if (!hasSubcatPerm) {
      const subcatLabel = (note.subcategory || 'unknown').replace(/_/g, ' ');
      throw new ForbiddenError(
        `You do not have the Subcategory Approval permission for "${subcatLabel}" notings. Required: ${modulePermKey}`
      );
    }
  }

  // Get the next person in chain using the canonical reporting service
  const reportingService = require("../../core/services/reportingStructure.service");
  const manager = await reportingService.getDirectManager(userId);
  if (!manager || !manager.id) {
    throw new ValidationError(
      "No reporting manager found to forward the note",
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.note.update({
      where: { id },
      data: { currentHolderId: manager.id },
      include: {
        createdBy: {
          select: { id: true, uid: true, employeeDetails: { select: { displayName: true } } },
        },
        currentHolder: {
          select: { id: true, uid: true, employeeDetails: { select: { displayName: true } } },
        },
      },
    }),
    prisma.noteHistory.create({
      data: {
        noteId: id,
        action: "not_recommended",
        performedById: userId,
        remarks: remarks.trim(),
        nextHolderId: manager.id,
      },
    }),
  ]);

  await invalidateNoteCaches(id);
  return ApiResponse.success(
    res,
    updated,
    "Note not recommended and forwarded to next authority",
  );
});

// ===================================================================
// POST-APPROVAL COPY SHARING + ESCALATION
// ===================================================================

/**
 * Send copies of an approved note to multiple users
 * Only the creator can send copies after approval
 *
 * @route POST /api/noting/:id/send-copy
 */
const sendCopy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { userIds, remarks } = req.body;

  if (!remarks || !remarks.trim()) {
    throw new ValidationError("Remarks are mandatory when sending copies");
  }

  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw new NotFoundError("Note");
  if (note.status !== "approved") {
    throw new ValidationError("Copies can only be sent for approved notes");
  }
  if (note.createdById !== userId) {
    throw new ForbiddenError(
      "Only the creator can send copies of the approved note",
    );
  }

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError("Please select at least one user");
  }

  // Validate all user IDs exist
  const users = await prisma.userLogin.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      uid: true,
      employeeDetails: { select: { displayName: true } },
    },
  });
  if (users.length !== userIds.length) {
    throw new ValidationError("One or more selected users do not exist");
  }

  // Prevent duplicate: check if any of these users already have a root copy for this note
  const existingCopies = await prisma.noteCopy.findMany({
    where: {
      noteId: id,
      assignedToId: { in: userIds },
      rootCopyId: { not: null },
    },
    select: {
      assignedToId: true,
      assignedTo: {
        select: {
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
    },
    distinct: ["assignedToId"],
  });
  if (existingCopies.length > 0) {
    const names = existingCopies
      .map(
        (c) => c.assignedTo?.employeeDetails?.displayName || c.assignedTo?.uid,
      )
      .join(", ");
    throw new ValidationError(
      `Copy already sent to: ${names}. Cannot send duplicate copies to the same user.`,
    );
  }

  // Create a copy for each user; each is root of its own chain
  const copies = await prisma.$transaction(
    userIds.map((uid) =>
      prisma.noteCopy.create({
        data: {
          noteId: id,
          sentById: userId,
          assignedToId: uid,
          remarks: remarks.trim(),
          status: "pending",
          escalationLevel: 0,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              uid: true,
              employeeDetails: {
                select: { displayName: true, firstName: true, lastName: true },
              },
            },
          },
        },
      }),
    ),
  );

  // Set rootCopyId = self for each new copy (chain root)
  await prisma.$transaction(
    copies.map((c) =>
      prisma.noteCopy.update({
        where: { id: c.id },
        data: { rootCopyId: c.id },
      }),
    ),
  );

  // Record in note history
  await prisma.noteHistory.create({
    data: {
      noteId: id,
      action: "copy_sent",
      performedById: userId,
      remarks: `Copy sent to ${users.map((u) => u.employeeDetails?.displayName || u.uid).join(", ")}: ${remarks.trim()}`,
    },
  });

  await invalidateNoteCaches(id);
  return ApiResponse.success(
    res,
    copies,
    `Copy sent to ${copies.length} user(s) successfully`,
  );
});

/**
 * Reply to an assigned copy (by the assigned user)
 * Remarks mandatory, attachments optional
 *
 * @route POST /api/noting/copy/:copyId/reply
 */
const replyCopy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { copyId } = req.params;
  const { remarks, attachments } = req.body;

  if (!remarks || !remarks.trim()) {
    throw new ValidationError("Remarks are mandatory when replying");
  }

  const copy = await prisma.noteCopy.findUnique({
    where: { id: copyId },
    include: { note: true },
  });
  if (!copy) throw new NotFoundError("Copy");
  if (copy.assignedToId !== userId) {
    throw new ForbiddenError("Only the assigned user can reply to this copy");
  }
  if (copy.status === "replied") {
    throw new ValidationError(
      "You have already replied. Wait for the noting creator to take action (complete or forward).",
    );
  }

  const [reply] = await prisma.$transaction([
    prisma.noteCopyReply.create({
      data: {
        copyId,
        repliedById: userId,
        remarks: remarks.trim(),
        attachments: attachments || [],
      },
      include: {
        repliedBy: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.noteCopy.update({
      where: { id: copyId },
      data: { status: "replied" },
    }),
  ]);

  await invalidateNoteCaches(copy.note.id);
  return ApiResponse.success(res, reply, "Reply submitted successfully");
});

/**
 * Forward (re-send) a copy back to the assigned user when work is not complete
 * Triggers escalation:
 *   - 1st re-forward: auto-notifies the assigned user's boss
 *   - 2nd re-forward: auto-notifies the boss's boss
 *   - Continues up the chain
 *
 * @route POST /api/noting/copy/:copyId/forward
 */
const forwardCopy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { copyId } = req.params;
  const { remarks } = req.body;

  if (!remarks || !remarks.trim()) {
    throw new ValidationError("Remarks are mandatory when forwarding a copy");
  }

  const copy = await prisma.noteCopy.findUnique({
    where: { id: copyId },
    include: {
      note: {
        include: {
          createdBy: {
            select: {
              id: true,
              uid: true,
              employeeDetails: { select: { displayName: true } },
            },
          },
        },
      },
      assignedTo: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
      sentBy: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
    },
  });
  if (!copy) throw new NotFoundError("Copy");
  if (copy.sentById !== userId) {
    throw new ForbiddenError(
      "Only the original sender can forward a copy back",
    );
  }
  if (copy.status !== "replied") {
    throw new ValidationError(
      "Can only escalate after the assignee has replied",
    );
  }

  const newEscalationLevel = copy.escalationLevel + 1;

  // ── Walk hierarchy with a single recursive CTE (N+1 fix) ─────────────────
  // Instead of 2×N sequential queries (one reportingStructure + one userLogin
  // per level), we issue ONE raw SQL query that walks up to `newEscalationLevel`
  // hops in a single round-trip, then fetch the matching userLogin rows in a
  // second (non-sequential) batch query.
  const chainRows = await prisma.$queryRaw`
    WITH RECURSIVE chain AS (
      -- Base case: immediate manager of the assignee
      SELECT rs."manager_id" AS manager_id, 1 AS lvl
      FROM reporting_structure rs
      WHERE rs."user_id" = ${copy.assignedToId}::uuid
        AND rs."is_active" = true
      UNION ALL
      -- Recursive step: walk up one more level
      SELECT rs2."manager_id", chain.lvl + 1
      FROM reporting_structure rs2
      JOIN chain ON rs2."user_id" = chain.manager_id
      WHERE rs2."is_active" = true
        AND chain.lvl < ${newEscalationLevel}
    )
    SELECT manager_id, lvl FROM chain ORDER BY lvl ASC
  `;

  // Batch-fetch display names for all collected manager IDs
  const managerIds = chainRows.map((r) => r.manager_id).filter(Boolean);
  const bossUsers =
    managerIds.length > 0
      ? await prisma.userLogin.findMany({
        where: { id: { in: managerIds } },
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      })
      : [];

  const bossUserMap = new Map(bossUsers.map((u) => [u.id, u]));

  const allBosses = chainRows.map((row) => {
    const u = bossUserMap.get(row.manager_id);
    return {
      id: row.manager_id,
      level: Number(row.lvl),
      name: u?.employeeDetails?.displayName || u?.uid || "Unknown",
    };
  });

  const escalationTargetId =
    allBosses.length > 0 ? allBosses[allBosses.length - 1].id : null;

  const rootCopyId = copy.rootCopyId || copy.id;

  // Update the copy with new escalation level and reset status to pending
  const [updatedCopy] = await prisma.$transaction([
    prisma.noteCopy.update({
      where: { id: copyId },
      data: {
        status: "forwarded",
        escalationLevel: newEscalationLevel,
        escalatedToId: escalationTargetId,
        rootCopyId: rootCopyId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } },
          },
        },
        escalatedTo: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } },
          },
        },
      },
    }),
    // Record in note history
    prisma.noteHistory.create({
      data: {
        noteId: copy.noteId,
        action: "copy_forwarded",
        performedById: userId,
        remarks: `Work not completed — forwarded back to ${copy.assignedTo?.employeeDetails?.displayName || copy.assignedTo?.uid}. Escalation Level: ${newEscalationLevel}${allBosses.length > 0 ? ` (${allBosses.map((b) => b.name).join(", ")} notified)` : ""}. Reason: ${remarks.trim()}`,
      },
    }),
  ]);

  // Build escalation chain — a clear narrative of what happened at each level
  // Each entry shows: who was notified, what they were told, that they didn't act
  const previousEscalationCopies = await prisma.noteCopy.findMany({
    where: {
      noteId: copy.noteId,
      escalationLevel: { gt: 0 },
      id: { not: copyId }, // exclude the current copy being forwarded
      assignedToId: { not: copy.assignedToId }, // exclude worker reassigned copies — only boss copies
    },
    orderBy: { escalationLevel: "asc" },
    select: {
      escalationLevel: true,
      remarks: true,
      createdAt: true,
      assignedTo: {
        select: {
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
    },
  });

  // Build chain array — each previous escalation's details
  const escalationChain = previousEscalationCopies.map((ec) => {
    let escRemarks = ec.remarks;
    try {
      const p = JSON.parse(ec.remarks);
      if (p.senderRemarks) escRemarks = p.senderRemarks;
    } catch {
      /* raw string */
    }
    const bossName =
      ec.assignedTo?.employeeDetails?.displayName ||
      ec.assignedTo?.uid ||
      "Unknown";
    return {
      level: ec.escalationLevel,
      notifiedPerson: bossName,
      creatorRemarks: escRemarks,
      date: ec.createdAt,
      actionTaken: false, // they didn't act, that's why we're escalating again
    };
  });

  const creatorName =
    copy.note?.createdBy?.employeeDetails?.displayName ||
    copy.note?.createdBy?.uid ||
    "Unknown";
  const assigneeName =
    copy.assignedTo?.employeeDetails?.displayName ||
    copy.assignedTo?.uid ||
    "Unknown";
  const senderName =
    copy.sentBy?.employeeDetails?.displayName || copy.sentBy?.uid || "Unknown";
  const escalationTargetName =
    allBosses.length > 0 ? allBosses[allBosses.length - 1].name : "Unknown";
  const immediateBossName = allBosses.length > 0 ? allBosses[0].name : null;

  // Add system warning per spec: "Work marked completed but not verified. Please resolve immediately."
  const systemWarning =
    newEscalationLevel === 1
      ? "Work marked completed but not verified. Please resolve immediately."
      : `Work not completed after Level ${newEscalationLevel - 1} escalation. Escalated to higher authority.`;

  // Create escalation copies for ALL bosses in the chain (spec Step 5:
  // "Send escalation to: Task Owner, Immediate Boss, Boss's Boss").
  // L1 boss orders worker, L2 boss orders L1 boss, etc.
  for (let bi = 0; bi < allBosses.length; bi++) {
    const boss = allBosses[bi];
    const orderTarget =
      bi === 0
        ? { id: copy.assignedToId, name: assigneeName }
        : { id: allBosses[bi - 1].id, name: allBosses[bi - 1].name };

    const isHighestBoss = boss.level === newEscalationLevel;
    const bossWarning = isHighestBoss
      ? systemWarning
      : `Reminder: Task still pending. Escalated to ${escalationTargetName} (Level ${newEscalationLevel}).`;

    await prisma.noteCopy.create({
      data: {
        noteId: copy.noteId,
        sentById: userId,
        assignedToId: boss.id,
        remarks: JSON.stringify({
          type: "escalation",
          level: boss.level,
          creatorName,
          senderName,
          assigneeName,
          senderRemarks: remarks.trim(),
          systemWarning: bossWarning,
          escalationChain,
          orderTargetId: orderTarget.id,
          orderTargetName: orderTarget.name,
          higherBossesNotified: allBosses
            .filter((b) => b.level > boss.level)
            .map((b) => b.name),
        }),
        status: "pending",
        escalationLevel: boss.level,
        rootCopyId,
      },
    });
  }

  // Copy BACK to assignee — they still need to do the work
  await prisma.noteCopy.create({
    data: {
      noteId: copy.noteId,
      sentById: userId,
      assignedToId: copy.assignedToId,
      remarks: JSON.stringify({
        type: "reassigned",
        level: newEscalationLevel,
        creatorName,
        senderName,
        senderRemarks: remarks.trim(),
        systemWarning,
        bossesNotified: allBosses.map((b) => b.name),
        immediateBossName,
        escalationChain,
      }),
      status: "pending",
      escalationLevel: newEscalationLevel,
      rootCopyId,
    },
  });

  const bossNames = allBosses.map((b) => b.name).join(", ");
  let message = `Copy forwarded back to ${assigneeName}`;
  if (allBosses.length > 0) {
    message += `. Escalation notice sent to ${bossNames}`;
  }

  await invalidateNoteCaches(copy.noteId);
  return ApiResponse.success(res, updatedCopy, message);
});

/**
 * Complete a copy chain — Creator marks work as done
 * Marks all copies in the escalation chain (assignee, boss, boss's boss) as completed
 * Only Creator can mark final completion
 *
 * @route POST /api/noting/copy/:copyId/complete
 */
const completeCopy = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { copyId } = req.params;

  const copy = await prisma.noteCopy.findUnique({
    where: { id: copyId },
    include: {
      note: { select: { id: true, createdById: true } },
      assignedTo: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
    },
  });
  if (!copy) throw new NotFoundError("Copy");
  if (copy.note.createdById !== userId) {
    throw new ForbiddenError("Only the creator can mark work as completed");
  }
  if (copy.status === "completed") {
    throw new ValidationError("This copy is already completed");
  }
  if (copy.status !== "replied") {
    throw new ValidationError(
      "Can only complete a copy after the assignee has replied",
    );
  }

  const rootId = copy.rootCopyId || copy.id;

  // Find all copies in the chain: root or any copy with this rootCopyId
  const chainCopyIds = await prisma.noteCopy
    .findMany({
      where: {
        OR: [{ id: rootId }, { rootCopyId: rootId }],
      },
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  await prisma.$transaction([
    prisma.noteCopy.updateMany({
      where: { id: { in: chainCopyIds } },
      data: { status: "completed" },
    }),
    prisma.noteHistory.create({
      data: {
        noteId: copy.noteId,
        action: "copy_completed",
        performedById: userId,
        remarks: `Work completed — marked by creator. Assignee: ${copy.assignedTo?.employeeDetails?.displayName || copy.assignedTo?.uid}. Entire escalation chain closed.`,
      },
    }),
  ]);

  await invalidateNoteCaches(copy.noteId);
  return ApiResponse.success(
    res,
    { completed: chainCopyIds.length },
    "Work marked as completed. Entire escalation chain closed.",
  );
});

/**
 * Get all copies for a specific note (creator view)
 *
 * @route GET /api/noting/:id/copies
 */
const getCopies = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const note = await prisma.note.findUnique({ where: { id } });
  if (!note) throw new NotFoundError("Note");

  // Only the creator can see all copies
  if (note.createdById !== userId) {
    throw new ForbiddenError("Only the creator can view all copies");
  }

  const copies = await prisma.noteCopy.findMany({
    where: { noteId: id },
    include: {
      assignedTo: {
        select: {
          id: true,
          uid: true,
          employeeDetails: {
            select: { displayName: true, firstName: true, lastName: true },
          },
        },
      },
      sentBy: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
      rootCopy: {
        select: {
          assignedToId: true,
          assignedTo: {
            select: {
              employeeDetails: { select: { displayName: true } },
              uid: true,
            },
          },
        },
      },
      note: { select: { createdById: true } },
      escalatedTo: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      },
      replies: {
        include: {
          repliedBy: {
            select: {
              id: true,
              uid: true,
              employeeDetails: { select: { displayName: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ApiResponse.success(res, copies, "Copies fetched successfully");
});

/**
 * Get copies assigned to the current user
 *
 * @route GET /api/noting/my-copies
 */
const getMyCopies = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Support optional pagination (default: paginated with limit 20)
  const rawPage = parseInt(req.query.page);
  const rawLimit = parseInt(req.query.limit);
  const cursorParam = req.query.cursor || null;  // cursor-based pagination
  const usePagination = !isNaN(rawPage) && !isNaN(rawLimit);
  const useCursorPag = !!cursorParam;
  const page = usePagination ? Math.max(1, rawPage) : null;
  const limit = usePagination || useCursorPag
    ? Math.min(100, Math.max(1, rawLimit || 20))
    : 50; // Default cap even for "all" — prevents unbounded loads
  const skip = usePagination ? (page - 1) * limit : undefined;

  // ── PERF: Cache my-copies per-user for 30s ─────────────────────────────
  const pagKey = useCursorPag ? `c:${cursorParam}:${limit}` : `${page || "all"}:${limit || "all"}`;
  const copiesCacheKey = `noting:mycopies:${userId}:${pagKey}`;
  const cachedCopies = await cache.get(copiesCacheKey);
  if (cachedCopies) {
    return ApiResponse.success(res, cachedCopies, "My copies fetched successfully");
  }

  // ── PERF: Build pagination args + count in parallel ─────────────────────
  const paginationArgs = useCursorPag
    ? { take: limit, skip: 1, cursor: { id: cursorParam } }
    : usePagination
      ? { skip, take: limit }
      : { take: limit };

  // ── PERF: Single query with select{} + relationLoadStrategy:"join" ──────
  // This replaces the old include{} pattern which caused N+1 queries.
  // With "join", Prisma emits ONE SQL query with LEFT JOINs, saving
  // 3-5 Neon serverless round-trips (~50-200ms each = 150-1000ms saved).
  const userDisplaySelect = {
    id: true,
    uid: true,
    employeeDetails: { select: { displayName: true } },
  };

  const [copies, totalCount, managerId] = await Promise.all([
    prisma.noteCopy.findMany({
      where: { assignedToId: userId },
      ...paginationArgs,
      relationLoadStrategy: "join",
      select: {
        id: true,
        noteId: true,
        sentById: true,
        assignedToId: true,
        remarks: true,
        status: true,
        escalationLevel: true,
        rootCopyId: true,
        createdAt: true,
        updatedAt: true,
        note: {
          select: {
            id: true,
            notingId: true,
            category: true,
            subcategory: true,
            description: true,
            status: true,
            amount: true,
            amountRequired: true,
            approvalPeriod: true,
            createdAt: true,
            createdById: true,
            points: { select: { id: true, content: true, sortOrder: true } },
            attachments: {
              select: {
                id: true,
                filePath: true,
                fileName: true,
                fileDescription: true,
              },
            },
            createdBy: {
              select: {
                uid: true,
                employeeDetails: { select: { displayName: true } },
              },
            },
          },
        },
        sentBy: { select: userDisplaySelect },
        rootCopy: { select: { assignedToId: true } },
        replies: {
          select: {
            id: true,
            copyId: true,
            remarks: true,
            attachments: true,
            createdAt: true,
            repliedBy: { select: userDisplaySelect },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Count only when using offset pagination (cursor doesn't need total)
    usePagination
      ? prisma.noteCopy.count({ where: { assignedToId: userId } })
      : null,
    // Manager ID lookup (tiny indexed query)
    prisma.reportingStructure
      .findUnique({ where: { userId }, select: { managerId: true } })
      .then((r) => r?.managerId || null)
      .catch(() => null),
  ]);

  // ── Pagination metadata ───────────────────────────────────────────────────
  const paginationMeta = useCursorPag
    ? createCursorPaginationMeta(copies, limit)
    : usePagination
      ? { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) }
      : null;

  // Dedupe per chain (rootCopyId), not per noteId.
  // Same note can have me as worker (chain A) AND boss (chain B) — both must stay.
  // When status priority ties, prefer the newer copy (L2 reminder over stale L1).
  const statusPriority = { pending: 0, replied: 1, completed: 2, forwarded: 3 };
  const byChain = new Map();
  for (const c of copies) {
    const key = c.rootCopyId || c.id;
    const curr = byChain.get(key);
    const pCurr = curr ? (statusPriority[curr.status] ?? 4) : 99;
    const pNew = statusPriority[c.status] ?? 4;
    if (
      !curr ||
      pNew < pCurr ||
      (pNew === pCurr && new Date(c.createdAt) > new Date(curr.createdAt))
    ) {
      byChain.set(key, c);
    }
  }
  let dedupedCopies = Array.from(byChain.values());

  // For each copy, fetch replies from ALL copies of the same note (boss + our other copies)
  // so assignee sees full thread even when we deduped to one card per noting
  const noteIds = [...new Set(dedupedCopies.map((c) => c.noteId))];

  // ── OPTIMISED FETCH STRATEGY (v2) ───────────────────────────────────────
  // v1 had 4 serial round-trips: count → findMany → allCopiesForNotes → allReplies
  // v2 merges count + findMany + managerId into one parallel batch (above),
  //    then does ONE more query for chain data + replies.
  //    Total: 2 round-trips max (was 4).
  //
  // Uses relationLoadStrategy:"join" + select{} on chain copies so Prisma
  // emits a single SQL with LEFT JOINs instead of N sub-queries.
  // ─────────────────────────────────────────────────────────────────────────

  if (noteIds.length > 0) {
    const userDisplaySelectSmall = {
      employeeDetails: { select: { displayName: true } },
      uid: true,
    };

    // Single round-trip: fetch ALL NoteCopy rows for these notes WITH their replies
    // Using relationLoadStrategy:"join" → 1 SQL query with JOINs
    const allCopiesForNotes = await prisma.noteCopy.findMany({
      where: { noteId: { in: noteIds } },
      relationLoadStrategy: "join",
      select: {
        id: true,
        noteId: true,
        createdAt: true,
        escalationLevel: true,
        status: true,
        sentById: true,
        assignedToId: true,
        rootCopyId: true,
        remarks: true,
        assignedTo: { select: userDisplaySelectSmall },
        sentBy: { select: userDisplaySelectSmall },
        note: { select: { createdById: true } },
        rootCopy: {
          select: {
            assignedToId: true,
            assignedTo: { select: userDisplaySelectSmall },
          },
        },
        replies: {
          select: {
            id: true,
            copyId: true,
            remarks: true,
            attachments: true,
            createdAt: true,
            repliedBy: {
              select: {
                id: true,
                uid: true,
                employeeDetails: { select: { displayName: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Build O(1) lookup map: copyId → copy data
    const copyMap = new Map(allCopiesForNotes.map((c) => [c.id, c]));

    // Flatten all replies from all copies, attach copy reference
    const allRepliesWithCopy = [];
    for (const copy of allCopiesForNotes) {
      if (copy.replies) {
        for (const reply of copy.replies) {
          allRepliesWithCopy.push({
            ...reply,
            copy: { noteId: copy.noteId, ...copyMap.get(reply.copyId) },
          });
        }
      }
    }

    // Group all replies by noteId
    const repliesByNote = {};
    for (const reply of allRepliesWithCopy) {
      const nid = reply.copy?.noteId;
      if (!nid) continue;
      if (!repliesByNote[nid]) repliesByNote[nid] = [];
      repliesByNote[nid].push(reply);
    }

    // Build chain-by-note from the already-fetched copies (no extra query)
    const chainByNote = {};
    for (const c of allCopiesForNotes) {
      if (!chainByNote[c.noteId]) chainByNote[c.noteId] = [];
      chainByNote[c.noteId].push(c);
    }

    // Attach allReplies + copyChain to every copy card in one pass
    for (const copy of dedupedCopies) {
      const all = repliesByNote[copy.noteId] || [];
      copy.allReplies = all.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      copy.copyChain = chainByNote[copy.noteId] || [];
    }
  }

  const responseData = {
    copies: dedupedCopies,
    myManagerId: managerId,
    ...(paginationMeta ? { pagination: paginationMeta } : {}),
  };
  // Cache for 60 seconds (invalidated on state changes)
  await cache.set(copiesCacheKey, responseData, 60);

  return ApiResponse.success(
    res,
    responseData,
    "My copies fetched successfully",
  );
});

/**
 * Get the current user's noting action permissions.
 * Used by the frontend to permission-drive the Approval Section UI —
 * only buttons whose corresponding permission is true are rendered.
 *
 * Permission → UI button mapping:
 *   noting_approve      → Approve, Reject (can reject when you can approve), Recommend, Not-Recommend
 *   noting_forward      → Forward (manual + auto)
 *   noting_return       → Revert Back, Reject (can reject when you can revert)
 *   noting_add_comment  → Recommend, Not-Recommend (secondary check, noting_approve is primary)
 *
 * @route  GET /api/noting/my-permissions
 * @access Protected (any authenticated user)
 */
const getMyNotingPermissions = asyncHandler(async (req, res) => {
  const user = req.user; // fully populated by protect middleware

  // No caching — permissions must always reflect the latest admin changes.
  // The protect middleware already caches the user session (with merged role perms)
  // so this endpoint just does a lightweight in-memory iteration.

  // The canonical set of noting permission keys we expose to the frontend.
  const NOTING_PERM_KEYS = [
    "noting_create",
    "noting_view_own",
    "noting_view_department",
    "noting_view_all",
    "noting_approve",
    "noting_forward",
    "noting_return",
    "noting_add_comment",
    "noting_reject",
    "noting_not_recommend",
    // Subcategory-specific approval keys
    "event_approve",
    "dsw_approve_noting",
    "curriculum_approve",
    "exam_approve",
    "infrastructure_approve",
    "accounts_purchase_approve",
    "student_related_approve",
    "non_academic_resources_approve",
    // Event management keys (for chairperson visibility)
    "event_manage_own",
    "event_publish",
    "event_manage_attendance",
    "event_assign_volunteers",
    "event_view_reports",
  ];

  // 1. Start from role-level defaults (e.g. admin always has noting_approve)
  const defaults = getDefaultPermissions(user.role);

  const result = {};

  // Pre-compute combined permission arrays once (avoid re-iterating per key)
  const allDeptPermissions = [
    ...(Array.isArray(user.centralDeptPermissions)
      ? user.centralDeptPermissions
      : []),
    ...(Array.isArray(user.schoolDeptPermissions)
      ? user.schoolDeptPermissions
      : []),
  ];

  for (const key of NOTING_PERM_KEYS) {
    if (defaults[key] === true) {
      result[key] = true;
      continue;
    }

    // Check all dept permission assignments in one pass
    result[key] = allDeptPermissions.some(
      (dp) =>
        dp.permissions &&
        (dp.permissions[key] === true ||
          dp.permissions[`${key.split("_")[0]}_${key}`] === true),
    );
  }

  // ── Club chairperson override for students ──────────────────────────────
  // If the student is a chairperson of an active/approved club,
  // grant noting_create + noting_view_own + attach metadata.
  if (user.role === "student" && !result.noting_create) {
    try {
      const chairpersonClub = await prisma.club.findFirst({
        where: {
          chairpersonId: user.id,
          status: { in: ["approved", "active"] },
        },
        select: { id: true, name: true },
      });
      if (chairpersonClub) {
        result.noting_create = true;
        result.noting_view_own = true;
        result.isClubChairperson = true;
        result.chairpersonClubId = chairpersonClub.id;
        result.chairpersonClubName = chairpersonClub.name;
      }
    } catch (clubErr) {
      console.error("Chairperson club check in permissions:", clubErr);
    }
  }

  return ApiResponse.success(
    res,
    result,
    "Noting permissions fetched successfully",
  );
});

module.exports = {
  getConfig,
  previewNotingId,
  create,
  getById,
  list,
  getCounts,
  approve,
  reject,
  revert,
  forward,
  updateDraft,
  deleteDraft,
  submitDraft,
  getMyCreatorInfo,
  getForwardPrograms,
  getForwardUsers,
  searchEmployees,
  getMyManager,
  autoForward,
  recommend,
  notRecommend,
  sendCopy,
  replyCopy,
  forwardCopy,
  getCopies,
  getMyCopies,
  completeCopy,
  getMyNotingPermissions,
};
