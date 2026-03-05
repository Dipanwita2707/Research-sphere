/**
 * Noting CRUD Controller
 *
 * Handles note lifecycle operations:
 *   - create        POST   /api/noting
 *   - updateDraft   PATCH  /api/noting/:id
 *   - deleteDraft   DELETE /api/noting/:id
 *   - submitDraft   POST   /api/noting/:id/submit
 *   - getById       GET    /api/noting/:id
 *   - list          GET    /api/noting
 *   - getCounts     GET    /api/noting/counts
 */

const { Prisma } = require("@prisma/client");
const prisma = require("../../../shared/config/database");
const cache = require("../../../shared/config/redis");
const asyncHandler = require("../../../shared/utils/asyncHandler");
const ApiResponse = require("../../../shared/utils/ApiResponse");
const { ValidationError } = require("../../../shared/utils/AppError");

const { generateNotingId } = require("../services/notingId.service");
const approvalFlowService = require("../services/approvalFlow.service");
const { invalidateNoteCaches } = require("../services/noting.service");

const { NOTE_STATUS, NOTE_ACTIONS } = require("../constants/noting.constants");
const {
  getPaginationParams,
  createPaginationMeta,
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
} = require("../utils/noteHelpers");
const {
  getFullNoteSelect,
  getListNoteSelect,
} = require("../utils/selectFragments");

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE
// ═══════════════════════════════════════════════════════════════════════════════

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
    // Optional club association for event notings
    eventClubId,
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
    // Optional club association for event notings
    eventClubId: eventClubId || null,
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

  // PERF FIX: Return the full note from inside the transaction instead of
  // doing a separate findUnique afterward. Saves one DB round-trip (~100ms).
  const finalNote = await prisma.$transaction(async (tx) => {
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

    // Fetch with full relations inside the same transaction
    return tx.note.findUnique({
      where: { id: note.id },
      ...getFullNoteSelect(),
    });
  });

  // Invalidate all noting caches since a new note was created
  await invalidateNoteCaches(finalNote.id);

  return ApiResponse.created(
    res,
    finalNote,
    submit
      ? "Note submitted and forwarded to your manager successfully"
      : "Draft saved successfully",
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE DRAFT
// ═══════════════════════════════════════════════════════════════════════════════

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
    // Optional club association for event notings
    eventClubId,
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
  // Optional club association
  if (eventClubId !== undefined)
    updateData.eventClubId = eventClubId || null;

  // PERF FIX: Return updated note from inside the transaction instead of
  // doing a separate findUnique afterward. Saves one DB round-trip (~100ms).
  const updated = await prisma.$transaction(async (tx) => {
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

    // Return the updated note with includes from inside the transaction
    return tx.note.findUnique({
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
  });

  return ApiResponse.success(res, updated, "Draft updated successfully");
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE DRAFT
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// SUBMIT DRAFT
// ═══════════════════════════════════════════════════════════════════════════════

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
    // Use cached chairperson data from protect middleware (P0-6)
    const chairClub = req.user._chairpersonClub;
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

  // Update note and create history in a single transaction, returning the updated note
  const updated = await prisma.$transaction(async (tx) => {
    await tx.noteHistory.create({
      data: {
        noteId: id,
        action: action,
        performedById: userId,
        remarks: `${actionMessage} - Auto-forwarded to manager`,
        nextHolderId: currentHolderId,
      },
    });

    await tx.note.update({
      where: { id },
      data: {
        status: NOTE_STATUS.PENDING,
        currentHolderId,
        autoForwardedToManager: true,
      },
    });

    return tx.note.findUnique({
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

// ═══════════════════════════════════════════════════════════════════════════════
// GET BY ID
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get note by ID with full details
 * Includes creator, current holder, points, history, and attachments
 *
 * @route GET /api/noting/:id
 * @access Protected
 */
const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  // ── Access control: verify user can view this specific note ─────────────
  // Users with noting_view_all (admin/superadmin) can see everything.
  // Users with only noting_view_own must be creator, current holder,
  // or have participated in the approval workflow (noteActivity).
  const { getDefaultPermissions } = require("../../../shared/config/permissions.config");
  const defaultPerms = getDefaultPermissions(userRole);
  const hasViewAll = defaultPerms.noting_view_all === true ||
    (req.user.centralDeptPermissions || []).some(
      dp => dp.permissions && dp.permissions.noting_view_all === true
    );

  if (!hasViewAll) {
    // Quick ownership / participation check before fetching full details
    const noteAccess = await prisma.note.findFirst({
      where: {
        id,
        OR: [
          { createdById: userId },
          { currentHolderId: userId },
          { history: { some: { performedById: userId } } },
          { copies: { some: { assignedToId: userId } } },
        ],
      },
      select: { id: true },
    });
    if (!noteAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this noting",
      });
    }
  }

  // ── PERF: Cache note detail for 120s ────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// GET COUNTS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  create,
  updateDraft,
  deleteDraft,
  submitDraft,
  getById,
  list,
  getCounts,
};
