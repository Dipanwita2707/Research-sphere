/**
 * Noting Workflow Controller
 *
 * Handles approval-chain operations on pending notes:
 *   - approve        POST /api/noting/:id/approve
 *   - reject         POST /api/noting/:id/reject
 *   - revert         POST /api/noting/:id/revert
 *   - forward        POST /api/noting/:id/forward
 *   - autoForward    POST /api/noting/:id/auto-forward
 *   - recommend      POST /api/noting/:id/recommend
 *   - notRecommend   POST /api/noting/:id/not-recommend
 */

const prisma = require("../../../shared/config/database");
const asyncHandler = require("../../../shared/utils/asyncHandler");
const ApiResponse = require("../../../shared/utils/ApiResponse");
const log = require("../../../shared/utils/logger");
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} = require("../../../shared/utils/AppError");

const approvalFlowService = require("../services/approvalFlow.service");
const { invalidateNoteCaches } = require("../services/noting.service");

// Cross-module services (used only by approve for auto-creating events/clubs)
const eventService = require("../../event-management/services/event.service");
const dswNotingService = require("../../dsw/services/notingIntegrationService");

const { NOTE_STATUS, NOTE_ACTIONS } = require("../constants/noting.constants");
const {
  getNoteById,
  verifyNotePending,
  verifyCanActOnNote,
} = require("../utils/noteHelpers");

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVE
// ═══════════════════════════════════════════════════════════════════════════════

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

  // PERF FIX: Use req.note from requireNoteApprover middleware instead of
  // re-fetching. The middleware already loaded, validated pending status,
  // verified currentHolder, and checked subcategory permissions.
  const note = req.note;

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
        log.ok(
          `Auto-created ${result.events.length} DRAFT sub-event(s) for festival noting ${updated.notingId}: [${eventIds.join(", ")}]`,
        );
      } else {
        eventId = result.event.eventId;
        log.ok(
          `Auto-created DRAFT event ${eventId} for noting ${updated.notingId}`,
        );
      }
    }
  } catch (error) {
    // Log error but don't fail the approval
    log.error("Failed to auto-create event:", error.message);
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
      log.ok(
        `Auto-created club ${club.clubId} for noting ${updated.notingId}`,
      );
    }
  } catch (error) {
    // Log error but don't fail the approval
    log.error("Failed to auto-create club:", error.message);
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

// ═══════════════════════════════════════════════════════════════════════════════
// REJECT
// ═══════════════════════════════════════════════════════════════════════════════

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

  // PERF FIX: Use req.note from requireNoteApprover middleware
  const note = req.note;

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

// ═══════════════════════════════════════════════════════════════════════════════
// REVERT
// ═══════════════════════════════════════════════════════════════════════════════

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

  // PERF FIX: Use req.note from requireNoteApprover middleware
  const note = req.note;

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

// ═══════════════════════════════════════════════════════════════════════════════
// FORWARD
// ═══════════════════════════════════════════════════════════════════════════════

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

  // PERF FIX: Use req.note from requireNoteApprover middleware.
  // For forward we also need createdBy, so fetch only the extra relation
  // if not already present on the minimal note from middleware.
  let note = req.note;
  if (!note.createdBy) {
    note = await getNoteById(id, {
      include: {
        createdBy: {
          select: { id: true, role: true },
        },
      },
    });
  }

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

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-FORWARD
// ═══════════════════════════════════════════════════════════════════════════════

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

  // PERF FIX: Use req.note from requireNoteApprover middleware
  const note = req.note;

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

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMEND / NOT RECOMMEND
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Shared logic for recommend and notRecommend — both validate the same
 * guards (pending status, current holder, subcategory permission), fetch
 * the next manager, and persist a history entry. Only the action string
 * and user-facing messages differ.
 *
 * @param {Object} params
 * @param {string} params.action - "recommended" | "not_recommended"
 * @param {string} params.remarksLabel - human label for error messages
 * @param {string} params.successMsg - response message on success
 */
async function _handleRecommendation(req, res, { action, remarksLabel, successMsg }) {
  const userId = req.user.id;
  const { id } = req.params;
  const { remarks } = req.body;

  if (!remarks || !remarks.trim()) {
    throw new ValidationError(`Remarks are mandatory ${remarksLabel}`);
  }

  // PERF FIX: Use req.note from requireNoteApprover middleware
  // The middleware already verified pending status, currentHolder, and subcategory permissions.
  const note = req.note;

  // Get the next person in chain using the canonical reporting service
  const reportingService = require("../../core/services/reportingStructure.service");
  const manager = await reportingService.getDirectManager(userId);
  if (!manager || !manager.id) {
    throw new ValidationError("No reporting manager found to forward the note");
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
        action,
        performedById: userId,
        remarks: remarks.trim(),
        nextHolderId: manager.id,
      },
    }),
  ]);

  await invalidateNoteCaches(id);
  return ApiResponse.success(res, updated, successMsg);
}

/**
 * Recommend a pending note and forward to next approver
 * @route POST /api/noting/:id/recommend
 */
const recommend = asyncHandler(async (req, res) => {
  return _handleRecommendation(req, res, {
    action: NOTE_ACTIONS.RECOMMENDED,
    remarksLabel: "for recommendation",
    successMsg: "Note recommended and forwarded to next authority",
  });
});

/**
 * Not Recommend a pending note — forwards to reporting manager with
 * "not_recommended" label so the next authority can see the previous
 * holder did NOT recommend it.
 * @route POST /api/noting/:id/not-recommend
 */
const notRecommend = asyncHandler(async (req, res) => {
  return _handleRecommendation(req, res, {
    action: NOTE_ACTIONS.NOT_RECOMMENDED,
    remarksLabel: "when not recommending",
    successMsg: "Note not recommended and forwarded to next authority",
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  approve,
  reject,
  revert,
  forward,
  autoForward,
  recommend,
  notRecommend,
};
