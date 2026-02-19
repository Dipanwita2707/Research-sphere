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

const { Prisma } = require('@prisma/client');
const prisma = require('../../../shared/config/database');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const { ValidationError, ForbiddenError } = require('../../../shared/utils/AppError');

const { generateNotingId } = require('../services/notingId.service');
const approvalFlowService = require('../services/approvalFlow.service');

const { CATEGORIES } = require('../config/noting.config');
const { NOTE_STATUS, NOTE_ACTIONS, LIMITS } = require('../constants/noting.constants');
const { getPaginationParams, createPaginationMeta } = require('../utils/pagination');
const {
  validateDescription,
  validateCategory,
  sanitizeAttachments,
  sanitizePoints,
  parsePolicyCompliance,
  sanitizeEventSponsors,
} = require('../utils/validators');
const {
  getNoteById,
  getNoteWithDetails,
  verifyCanEditDraft,
  verifyCanEditNote,
  verifyCanDeleteNote,
  verifyNotePending,
  verifyCanActOnNote,
} = require('../utils/noteHelpers');
const { getFullNoteInclude, getListNoteInclude } = require('../utils/selectFragments');

/**
 * Get configuration for frontend
 * Returns categories, subcategories, and dropdown options
 * 
 * @route GET /api/noting/config
 * @access Protected
 */
const getConfig = asyncHandler(async (req, res) => {
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
      { value: 'one_time', label: 'One-time' },
      { value: 'recurring', label: 'Recurring' },
    ],
    recurringFrequencyOptions: [
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'quarterly', label: 'Quarterly' },
      { value: 'half_yearly', label: 'Half-Yearly' },
      { value: 'annually', label: 'Annually' },
    ],
    eventTypeOptions: [
      { value: 'seminar', label: 'Seminar' },
      { value: 'workshop', label: 'Workshop' },
      { value: 'fest', label: 'Fest' },
      { value: 'conference', label: 'Conference' },
      { value: 'competition', label: 'Competition' },
      { value: 'cultural', label: 'Cultural' },
      { value: 'technical', label: 'Technical' },
      { value: 'sports', label: 'Sports' },
      { value: 'other', label: 'Other' },
    ],
    eventPaymentTypeOptions: [
      { value: 'free', label: 'Free' },
      { value: 'paid', label: 'Paid' },
    ],
  };

  return ApiResponse.success(res, configData, 'Configuration fetched successfully');
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
  
  return ApiResponse.success(res, { notingId }, 'Noting ID generated');
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
    eventHasSponsorship,
    eventSponsors,
    eventHasResources,
    eventResources,
  } = req.body;

  // Validate category and subcategory
  validateCategory(category, subcategory);

  // Validate description (required only if submitting)
  const descriptionValue = validateDescription(description, submit);
  if (submit && !descriptionValue) {
    throw new ValidationError(
      'Description is required to submit a note. Please provide a clear description of your request before submitting for approval.'
    );
  }

  // Validate event fields if provided
  if (eventName || eventType || eventStartDate || eventEndDate || eventPaymentType) {
    if (!eventName || !eventType || !eventStartDate || !eventEndDate || !eventPaymentType) {
      throw new ValidationError(
        'For event approval requests, all event details are required: Event Name, Event Type, Start Date, End Date, and Payment Type. Please fill in all fields.'
      );
    }
    
    // Validate dates
    const startDate = new Date(eventStartDate);
    const endDate = new Date(eventEndDate);
    
    if (endDate < startDate) {
      throw new ValidationError(
        'Event end date cannot be before the start date. Please correct the dates.'
      );
    }
    
    // Validate fee for paid events
    if (eventPaymentType === 'paid') {
      const isTeam = eventParticipationType === 'team';
      if (isTeam && (eventRegistrationFeeTeam == null || eventRegistrationFeeTeam < 0)) {
        throw new ValidationError('For paid team events, fee per team (₹) is required.');
      }
      if (!isTeam && (eventRegistrationFeeIndividual == null || eventRegistrationFeeIndividual < 0)) {
        throw new ValidationError('For paid individual events, participation fee (₹) is required.');
      }
    }
  }

  // Generate unique noting ID
  const notingId = generateNotingId(category, subcategory);
  const status = submit ? NOTE_STATUS.PENDING : NOTE_STATUS.DRAFT;

  // Determine initial holder if submitting - will be set after create if auto-forward succeeds
  let currentHolderId = null;

  // Parse policy compliance
  const policyCompliant = parsePolicyCompliance(policyCompliance);

  // Sanitize attachments and points
  const validAttachments = sanitizeAttachments(attachmentsPayload);
  const validPoints = sanitizePoints(points);

  // Create note in database
  const note = await prisma.note.create({
    data: {
      notingId,
      category,
      subcategory,
      description: descriptionValue || '',
      approvalPeriod: approvalPeriod || 'one_time',
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
      eventRegistrationFeeIndividual: eventPaymentType === 'paid' && eventRegistrationFeeIndividual != null ? parseFloat(eventRegistrationFeeIndividual) : null,
      eventRegistrationFeeTeam: eventPaymentType === 'paid' && eventParticipationType === 'team' && eventRegistrationFeeTeam != null ? parseFloat(eventRegistrationFeeTeam) : null,
      eventApproxCapacity: eventApproxCapacity != null ? parseInt(eventApproxCapacity, 10) : null,
      eventDutyLeaveAvailable: eventDutyLeaveAvailable != null ? !!eventDutyLeaveAvailable : null,
      eventDutyLeaveEligibility: Array.isArray(eventDutyLeaveEligibility) ? eventDutyLeaveEligibility : null,
      eventHasSponsorship: eventHasSponsorship != null ? !!eventHasSponsorship : null,
      eventSponsors: eventHasSponsorship ? sanitizeEventSponsors(eventSponsors) : null,
      eventHasResources: eventHasResources != null ? !!eventHasResources : null,
      eventResources: Array.isArray(eventResources) ? eventResources : null,
      status,
      createdById: userId,
      currentHolderId,
      points: validPoints.length
        ? { create: validPoints }
        : undefined,
      attachments: validAttachments.length
        ? { create: validAttachments }
        : undefined,
    },
    include: getFullNoteInclude(),
  });

  // ==========================================
  // REPORTING STRUCTURE BASED AUTO-FORWARD
  // This is the PRIMARY workflow for all notings
  // ==========================================
  let finalCurrentHolderId = currentHolderId;
  let autoForwarded = false;

  if (submit) {
    // Get module permission key based on subcategory
    const modulePermissionKey = approvalFlowService.getModulePermissionKey(note);
    
    // Check user's reporting structure and manager's permissions
    const autoForwardResult = await approvalFlowService.determineNextApproverByReporting(
      note,
      modulePermissionKey
    );

    // CASE 1: No manager assigned - REJECT submission
    if (!autoForwardResult.nextApproverId) {
      // Delete the draft note that was created
      await prisma.note.delete({ where: { id: note.id } });
      throw new ValidationError(
        'You do not have a reporting manager assigned. Please contact Admin to set up your reporting structure before submitting notes.'
      );
    }

    // CASE 2: Manager doesn't have approval permission - REJECT submission
    if (!autoForwardResult.canAutoForward) {
      // Delete the draft note that was created
      await prisma.note.delete({ where: { id: note.id } });
      const managerName = autoForwardResult.managerInfo?.name || autoForwardResult.managerInfo?.email || 'Your manager';
      throw new ValidationError(
        `${managerName} does not have approval permission (${modulePermissionKey}). Please contact Admin to grant this permission before you can submit notes.`
      );
    }

    // CASE 3: Manager has permission - Forward to manager
    finalCurrentHolderId = autoForwardResult.nextApproverId;
    autoForwarded = true;

    await prisma.note.update({
      where: { id: note.id },
      data: {
        currentHolderId: finalCurrentHolderId,
        autoForwardedToManager: true,
        reportingChainHistory: {
          push: {
            timestamp: new Date().toISOString(),
            fromUserId: userId,
            toUserId: finalCurrentHolderId,
            reason: autoForwardResult.reason,
          },
        },
      },
    });
  }

  // Create history entry if submitted
  if (submit && finalCurrentHolderId) {
    await prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.FORWARDED,
        performedById: userId,
        remarks: 'Auto-forwarded to manager based on reporting hierarchy',
        nextHolderId: finalCurrentHolderId,
      },
    });
  }

  // Fetch updated note with all relations
  const updatedNote = await prisma.note.findUnique({
    where: { id: note.id },
    include: getFullNoteInclude(),
  });

  return ApiResponse.created(
    res,
    updatedNote,
    submit
      ? 'Note submitted and forwarded to your manager successfully'
      : 'Draft saved successfully'
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
    eventHasSponsorship,
    eventSponsors,
    eventHasResources,
    eventResources,
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
  const policyCompliant = policyCompliance !== undefined
    ? parsePolicyCompliance(policyCompliance)
    : note.policyCompliant;

  // Sanitize attachments and points
  const validAttachments = sanitizeAttachments(attachmentsPayload);
  const validPoints = sanitizePoints(points);

  // Prepare update data
  const updateData = {};
  if (descriptionValue !== undefined) updateData.description = descriptionValue;
  if (approvalPeriod !== undefined) updateData.approvalPeriod = approvalPeriod || 'one_time';
  if (recurringFrequency !== undefined) updateData.recurringFrequency = recurringFrequency || null;
  if (policyCompliant !== undefined && policyCompliant !== null) updateData.policyCompliant = policyCompliant;
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
  if (eventStartDate !== undefined) updateData.eventStartDate = eventStartDate ? new Date(eventStartDate) : null;
  if (eventEndDate !== undefined) updateData.eventEndDate = eventEndDate ? new Date(eventEndDate) : null;
  if (eventPaymentType !== undefined) updateData.eventPaymentType = eventPaymentType || null;
  if (eventParticipationType !== undefined) updateData.eventParticipationType = eventParticipationType || null;
  if (eventRegistrationFeeIndividual !== undefined) updateData.eventRegistrationFeeIndividual = eventPaymentType === 'paid' && eventRegistrationFeeIndividual != null ? parseFloat(eventRegistrationFeeIndividual) : null;
  if (eventRegistrationFeeTeam !== undefined) updateData.eventRegistrationFeeTeam = eventPaymentType === 'paid' && eventParticipationType === 'team' && eventRegistrationFeeTeam != null ? parseFloat(eventRegistrationFeeTeam) : null;
  if (eventApproxCapacity !== undefined) updateData.eventApproxCapacity = eventApproxCapacity != null ? parseInt(eventApproxCapacity, 10) : null;
  if (eventDutyLeaveAvailable !== undefined) updateData.eventDutyLeaveAvailable = eventDutyLeaveAvailable != null ? !!eventDutyLeaveAvailable : null;
  if (eventDutyLeaveEligibility !== undefined) updateData.eventDutyLeaveEligibility = Array.isArray(eventDutyLeaveEligibility) ? eventDutyLeaveEligibility : null;
  if (eventHasSponsorship !== undefined) updateData.eventHasSponsorship = eventHasSponsorship != null ? !!eventHasSponsorship : null;
  if (eventSponsors !== undefined) updateData.eventSponsors = (eventHasSponsorship === false) ? null : sanitizeEventSponsors(eventSponsors || []);
  if (eventHasResources !== undefined) updateData.eventHasResources = eventHasResources != null ? !!eventHasResources : null;
  if (eventResources !== undefined) updateData.eventResources = Array.isArray(eventResources) ? eventResources : null;

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
      points: { orderBy: { sortOrder: 'asc' } },
      attachments: true,
    },
  });

  return ApiResponse.success(res, updated, 'Draft updated successfully');
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

  return ApiResponse.success(res, null, 'Note deleted successfully');
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

  // Load note
  const note = await getNoteById(id, { include: { points: true } });

  // Verify permissions (allows draft or reverted status)
  verifyCanEditDraft(note, userId);

  // Validate description is present
  if (!String(note.description || '').trim()) {
    throw new ValidationError(
      'Description is required to submit this note. Please add a clear description explaining your request, then try again.'
    );
  }

  // Determine if this is a resubmission after revert
  const isResubmission = note.status === NOTE_STATUS.REVERTED;
  const action = isResubmission ? NOTE_ACTIONS.RESUBMITTED : NOTE_ACTIONS.SUBMITTED;
  const actionMessage = isResubmission ? 'Note resubmitted after modifications' : 'Note submitted for approval';

  // Get module permission key
  const modulePermissionKey = approvalFlowService.getModulePermissionKey(note);
  
  // Check reporting structure for auto-forward
  const autoForwardResult = await approvalFlowService.determineNextApproverByReporting(
    note,
    modulePermissionKey
  );

  // CASE 1: No manager assigned - REJECT submission
  if (!autoForwardResult.nextApproverId) {
    throw new ValidationError(
      'You do not have a reporting manager assigned. Please contact Admin to set up your reporting structure before submitting notes.'
    );
  }

  // CASE 2: Manager doesn't have approval permission - REJECT submission
  if (!autoForwardResult.canAutoForward) {
    const managerName = autoForwardResult.managerInfo?.name || autoForwardResult.managerInfo?.email || 'Your manager';
    throw new ValidationError(
      `${managerName} does not have approval permission (${modulePermissionKey}). Please contact Admin to grant this permission before you can submit notes.`
    );
  }

  // CASE 3: Manager has permission - Forward to manager
  const currentHolderId = autoForwardResult.nextApproverId;

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

  return ApiResponse.success(res, updated, isResubmission ? 'Note resubmitted successfully' : 'Note submitted for approval');
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

  // Fetch note with full details
  const note = await getNoteWithDetails(id);

  return ApiResponse.success(res, note, 'Note details retrieved successfully');
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
    filter = 'mine', 
    status, 
    category,
    search,        // Search by notingId or description
    createdById,   // Filter by creator ID
    startDate,     // Date range start
    endDate,       // Date range end
    includeCounts, // When true, include mine/pending/handled counts in response
  } = req.query;
  const { page, limit, skip } = getPaginationParams(req.query);
  const wantCounts = includeCounts === 'true' || includeCounts === true;

  const include = getListNoteInclude();

  let notes;
  let total;

  if (filter === 'handled') {
    // Get notes current user has acted on - use efficient paginated subquery instead of loading all history
    const actions = [NOTE_ACTIONS.APPROVED, NOTE_ACTIONS.REJECTED, NOTE_ACTIONS.FORWARDED, NOTE_ACTIONS.REVERTED];
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
        include,
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

    if (filter === 'mine') {
      where.createdById = userId;
    } else if (filter === 'pending') {
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
        { notingId: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
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

    // Standard query with pagination
    [notes, total] = await Promise.all([
      prisma.note.findMany({
        where,
        include,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.note.count({ where }),
    ]);
  }

  const pagination = createPaginationMeta(page, limit, total);

  if (wantCounts) {
    const actions = [NOTE_ACTIONS.APPROVED, NOTE_ACTIONS.REJECTED, NOTE_ACTIONS.FORWARDED, NOTE_ACTIONS.REVERTED];
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
    return res.status(200).json({
      success: true,
      message: 'Notes fetched successfully',
      data: notes,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages || Math.ceil(pagination.total / pagination.limit),
      },
      counts: { mine: mineCount, pending: pendingCount, handled: handledCount },
    });
  }

  return ApiResponse.paginated(res, notes, pagination, 'Notes fetched successfully');
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
  const actions = [NOTE_ACTIONS.APPROVED, NOTE_ACTIONS.REJECTED, NOTE_ACTIONS.FORWARDED, NOTE_ACTIONS.REVERTED];
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

  return ApiResponse.success(res, {
    mine: mineCount,
    pending: pendingCount,
    handled: handledCount,
  }, 'Counts fetched successfully');
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
  // Update note and create history in transaction
  await prisma.$transaction([
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

  // Auto-create event if this is an event noting
  let eventCreated = false;
  let eventId = null;
  try {
    if (updated.eventName && updated.eventType && updated.eventStartDate && updated.eventEndDate && updated.eventPaymentType) {
      const eventService = require('../../event-management/services/event.service');
      const event = await eventService.createEventFromNoting(updated.id, userId);
      eventCreated = true;
      eventId = event.eventId;
      console.log(`✅ Auto-created DRAFT event ${event.eventId} for noting ${updated.notingId}`);
    }
  } catch (error) {
    // Log error but don't fail the approval
    console.error('❌ Failed to auto-create event:', error.message);
  }

  // Auto-create club if this is a DSW club creation noting
  let clubCreated = false;
  let clubId = null;
  try {
    if (updated.category === 'administrative' && updated.subcategory === 'dsw_club_creation') {
      const dswNotingService = require('../../dsw/services/notingIntegrationService');
      const club = await dswNotingService.processApprovedClubCreationNoting(updated, userId);
      clubCreated = true;
      clubId = club.clubId;
      console.log(`✅ Auto-created club ${club.clubId} for noting ${updated.notingId}`);
    }
  } catch (error) {
    // Log error but don't fail the approval
    console.error('❌ Failed to auto-create club:', error.message);
  }

  let successMessage = 'Note approved successfully';
  if (eventCreated && eventId) {
    successMessage = `Note approved successfully. Event ${eventId} created in DRAFT status. The creator can now add details and publish it.`;
  }
  if (clubCreated && clubId) {
    successMessage = `Note approved successfully. Club ${clubId} has been created and is now ACTIVE.`;
  }
  if (eventCreated && clubCreated) {
    successMessage = `Note approved successfully. Event ${eventId} and Club ${clubId} have been created.`;
  }

  return ApiResponse.success(
    res,
    { ...updated, eventCreated, eventId, clubCreated, clubId },
    successMessage
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

  return ApiResponse.success(res, null, 'Note rejected successfully');
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

  return ApiResponse.success(res, null, 'Note reverted back to creator successfully');
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
      'Please select a person to forward this note to.'
    );
  }
  const targetHolderId = String(nextHolderId).trim();

  // Verify target user exists and is active
  const targetUser = await prisma.userLogin.findUnique({
    where: { id: targetHolderId },
    select: { id: true, uid: true, status: true, employeeDetails: { select: { displayName: true } } },
  });

  if (!targetUser) {
    throw new ValidationError('Selected user not found.');
  }

  if (targetUser.status !== 'active') {
    throw new ValidationError(`${targetUser.employeeDetails?.displayName || targetUser.uid} is not an active user.`);
  }

  if (targetHolderId === userId) {
    throw new ValidationError('You cannot forward a note to yourself.');
  }

  // Update note and create history in transaction
  await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.FORWARDED,
        performedById: userId,
        remarks: String(remarks || '').trim(),
        nextHolderId: targetHolderId,
      },
    }),
    prisma.note.update({
      where: { id },
      data: {
        currentHolderId: targetHolderId,
        // Track reporting chain history
        reportingChainHistory: {
          push: {
            timestamp: new Date().toISOString(),
            fromUserId: userId,
            toUserId: targetHolderId,
            reason: remarks || 'Manual forward',
          },
        },
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

  return ApiResponse.success(res, updated, 'Note forwarded successfully');
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
    throw new NotFoundError('User');
  }

  // Build display name
  const name =
    user.employeeDetails?.displayName ||
    [user.employeeDetails?.firstName, user.employeeDetails?.lastName]
      .filter(Boolean)
      .join(' ') ||
    user.studentLogin?.displayName ||
    user.uid;

  const employeeId = user.employeeDetails?.empId ?? user.studentLogin?.studentId ?? null;

  // Get department and school
  let department = user.employeeDetails?.primaryDepartment?.departmentName ?? null;
  let school = user.employeeDetails?.primarySchool?.facultyName ?? null;

  if (user.role === 'student' && user.studentLogin?.program?.department) {
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
    orderBy: { programName: 'asc' },
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
      role: { in: ['faculty', 'staff'] },
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
    orderBy: { uid: 'asc' },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    uid: u.uid,
    role: u.role,
    displayName:
      u.employeeDetails?.displayName ||
      [u.employeeDetails?.firstName, u.employeeDetails?.lastName]
        .filter(Boolean)
        .join(' ') ||
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
      role: 'faculty',
      status: 'active',
      OR: [
        { uid: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { employeeDetails: { displayName: { contains: searchTerm, mode: 'insensitive' } } },
        { employeeDetails: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { employeeDetails: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        { employeeDetails: { empId: { contains: searchTerm, mode: 'insensitive' } } },
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
    orderBy: { uid: 'asc' },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    uid: u.uid,
    role: u.role,
    displayName:
      u.employeeDetails?.displayName ||
      [u.employeeDetails?.firstName, u.employeeDetails?.lastName].filter(Boolean).join(' ') ||
      u.uid,
    empId: u.employeeDetails?.empId || '',
    department: u.employeeDetails?.primaryDepartment?.departmentName || '',
    school: u.employeeDetails?.primarySchool?.facultyName || '',
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
  const reportingService = require('../../core/services/reportingStructure.service');
  const manager = await reportingService.getDirectManager(userId);

  if (!manager) {
    return ApiResponse.success(res, null, 'No reporting manager found');
  }

  const managerInfo = {
    id: manager.id,
    uid: manager.uid,
    displayName: manager.employeeDetails?.displayName || manager.employeeDetails?.firstName || manager.uid,
    empId: manager.employeeDetails?.empId || '',
    department: manager.employeeDetails?.primaryDepartment?.departmentName || '',
    school: manager.employeeDetails?.primarySchool?.facultyName || '',
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
  const reportingService = require('../../core/services/reportingStructure.service');
  const manager = await reportingService.getDirectManager(userId);

  if (!manager) {
    throw new ValidationError(
      'You do not have a reporting manager assigned. Please contact Admin to set up your reporting structure.'
    );
  }

  // Update note and create history
  await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.FORWARDED,
        performedById: userId,
        remarks: String(remarks || 'Auto-forwarded to reporting manager').trim(),
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
            reason: remarks || 'Auto-forwarded to reporting manager',
          },
        },
      },
    }),
  ]);

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

  const managerName = manager.employeeDetails?.displayName || manager.uid || manager.email;
  return ApiResponse.success(res, updated, `Note forwarded to ${managerName} (your reporting manager)`);
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
};
