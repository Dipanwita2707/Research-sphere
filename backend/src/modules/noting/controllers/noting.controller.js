const prisma = require('../../../shared/config/database');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const { ValidationError, ForbiddenError } = require('../../../shared/utils/AppError');

const { generateNotingId } = require('../services/notingId.service');
const approvalFlowService = require('../services/approvalFlow.service');

const { CATEGORIES, isCentralDepartmentRole, CENTRAL_DEPARTMENT_ROLE_TO_DEPT_CODE } = require('../config/noting.config');
const { NOTE_STATUS, NOTE_ACTIONS, LIMITS } = require('../constants/noting.constants');
const { getPaginationParams, createPaginationMeta } = require('../utils/pagination');
const {
  validateDescription,
  validateCategory,
  sanitizeAttachments,
  sanitizePoints,
  parsePolicyCompliance,
} = require('../utils/validators');
const {
  getNoteById,
  getNoteWithDetails,
  verifyCanEditDraft,
  verifyCanEditNote,
  verifyCanDeleteNote,
  verifyNotePending,
  verifyCanActOnNote,
  resolveCurrentFlowIndex,
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
  } = req.body;

  // Validate category and subcategory
  validateCategory(category, subcategory);

  // Validate description (required only if submitting)
  const descriptionValue = validateDescription(description, submit);
  if (submit && !descriptionValue) {
    throw new ValidationError('Description is required when submitting for approval');
  }

  // Validate event fields if provided
  if (eventName || eventType || eventStartDate || eventEndDate || eventPaymentType) {
    if (!eventName || !eventType || !eventStartDate || !eventEndDate || !eventPaymentType) {
      throw new ValidationError('All event fields (name, type, start date, end date, payment type) are required when creating an event noting');
    }
    
    // Validate dates
    const startDate = new Date(eventStartDate);
    const endDate = new Date(eventEndDate);
    
    if (endDate < startDate) {
      throw new ValidationError('Event end date must be after start date');
    }
  }

  // Generate unique noting ID
  const notingId = generateNotingId(category, subcategory);
  const status = submit ? NOTE_STATUS.PENDING : NOTE_STATUS.DRAFT;

  // Determine initial holder if submitting
  let currentHolderId = null;
  let currentFlowIndex = null;

  if (submit) {
    const noteContext = { amountRequired: amountRequired === true };
    const steps = await approvalFlowService.getFullFlowSteps(category, subcategory, userId, noteContext);
    const firstStep = steps[0];

    if (firstStep) {
      currentFlowIndex = 0;
      const isGroupStep = isCentralDepartmentRole(firstStep.authorityType) && firstStep.userIds.length > 0;
      currentHolderId = isGroupStep ? null : (firstStep.userIds[0] ?? null);
    }
  }

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
      status,
      createdById: userId,
      currentHolderId,
      currentFlowIndex,
      points: validPoints.length
        ? { create: validPoints }
        : undefined,
      attachments: validAttachments.length
        ? { create: validAttachments }
        : undefined,
    },
    include: getFullNoteInclude(),
  });

  // Create history entry if submitted
  if (submit && currentHolderId) {
    await prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.SUBMITTED,
        performedById: userId,
        remarks: 'Note submitted for approval',
        nextHolderId: currentHolderId,
      },
    });
  }

  return ApiResponse.created(
    res,
    note,
    submit ? 'Note submitted successfully' : 'Draft saved successfully'
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
    throw new ValidationError('Description is required before submitting');
  }

  // Determine if this is a resubmission after revert
  const isResubmission = note.status === NOTE_STATUS.REVERTED;
  const action = isResubmission ? NOTE_ACTIONS.RESUBMITTED : NOTE_ACTIONS.SUBMITTED;
  const actionMessage = isResubmission ? 'Note resubmitted after modifications' : 'Note submitted for approval';

  // Get approval flow
  const noteContext = { amountRequired: note.amountRequired === true };
  const steps = await approvalFlowService.getFullFlowSteps(
    note.category,
    note.subcategory,
    userId,
    noteContext
  );

  const firstStep = steps[0];
  let currentHolderId = null;
  let currentFlowIndex = null;

  if (firstStep) {
    currentFlowIndex = 0;
    const isGroupStep = isCentralDepartmentRole(firstStep.authorityType) && firstStep.userIds.length > 0;
    currentHolderId = isGroupStep ? null : (firstStep.userIds[0] ?? null);
  }

  // Update note and create history in transaction
  await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: id,
        action: action,
        performedById: userId,
        remarks: actionMessage,
        nextHolderId: currentHolderId,
      },
    }),
    prisma.note.update({
      where: { id },
      data: {
        status: NOTE_STATUS.PENDING,
        currentHolderId,
        currentFlowIndex,
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

  // If note is pending with group step, add current step info
  if (
    note.status === NOTE_STATUS.PENDING &&
    note.currentHolderId == null &&
    note.currentFlowIndex != null
  ) {
    const noteContext = { amountRequired: note.amountRequired === true };
    const steps = await approvalFlowService.getFullFlowSteps(
      note.category,
      note.subcategory,
      note.createdById,
      noteContext
    );

    const step = steps[note.currentFlowIndex];
    if (step && isCentralDepartmentRole(step.authorityType) && step.userIds.length > 0) {
      const deptCode = CENTRAL_DEPARTMENT_ROLE_TO_DEPT_CODE[step.authorityType];
      const centralDept = deptCode
        ? await prisma.centralDepartment.findFirst({
            where: { departmentCode: deptCode, isActive: true },
            select: { id: true, departmentName: true, departmentCode: true },
          })
        : null;

      const members = await prisma.userLogin.findMany({
        where: { id: { in: step.userIds } },
        select: {
          id: true,
          uid: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
        },
      });

      note.currentStep = {
        authorityType: step.authorityType,
        isCentralDepartment: true,
        centralDepartmentId: centralDept?.id,
        centralDepartmentName: centralDept?.departmentName,
        centralDepartmentCode: centralDept?.departmentCode,
        members: members.map((u) => ({
          id: u.id,
          displayName:
            u.employeeDetails?.displayName ||
            [u.employeeDetails?.firstName, u.employeeDetails?.lastName]
              .filter(Boolean)
              .join(' ') ||
            u.uid,
        })),
      };
    }
  }

  return ApiResponse.success(res, note, 'Note fetched successfully');
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
  } = req.query;
  const { page, limit, skip } = getPaginationParams(req.query);

  const include = getListNoteInclude();

  let notes;
  let total;

  if (filter === 'handled') {
    // Get notes current user has acted on (approved/rejected/forwarded/reverted)
    const historyRows = await prisma.noteHistory.findMany({
      where: {
        performedById: userId,
        action: { in: [NOTE_ACTIONS.APPROVED, NOTE_ACTIONS.REJECTED, NOTE_ACTIONS.FORWARDED, NOTE_ACTIONS.REVERTED] },
      },
      orderBy: { createdAt: 'desc' },
      select: { noteId: true, action: true, createdAt: true },
    });

    // Get unique note IDs (most recent action per note)
    const seen = new Set();
    const noteIdsWithAction = [];
    for (const h of historyRows) {
      if (seen.has(h.noteId)) continue;
      seen.add(h.noteId);
      noteIdsWithAction.push({
        noteId: h.noteId,
        action: h.action,
        performedAt: h.createdAt,
      });
    }

    total = noteIdsWithAction.length;
    const pageItems = noteIdsWithAction.slice(skip, skip + limit);
    const noteIds = pageItems.map((x) => x.noteId);

    if (noteIds.length > 0) {
      const fetched = await prisma.note.findMany({
        where: { id: { in: noteIds } },
        include,
      });

      const noteMap = new Map();
      fetched.forEach((n) => noteMap.set(n.id, n));

      notes = pageItems
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
        OR: [
          { currentHolderId: userId },
          { currentHolderId: null, currentFlowIndex: { not: null } },
        ],
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

    // Special handling for pending filter to check authorization
    if (filter === 'pending') {
      // Fetch candidates (limit to reasonable number for performance)
      const candidates = await prisma.note.findMany({
        where,
        include,
        orderBy: { updatedAt: 'desc' },
        take: LIMITS.PENDING_NOTES_FETCH_LIMIT,
      });

      // Separate direct holders from group step notes
      const directHolders = candidates.filter((n) => n.currentHolderId === userId);
      const groupStepNotes = candidates.filter(
        (n) => n.currentHolderId == null && n.currentFlowIndex != null
      );

      // Batch check authorization for group step notes
      const authResults = await approvalFlowService.canUserActAtStepBatch(userId, groupStepNotes);
      const authorizedGroupNotes = groupStepNotes.filter((n) => authResults.get(n.id));

      // Combine results
      const allAuthorized = [...directHolders, ...authorizedGroupNotes];

      // Sort by updatedAt desc
      allAuthorized.sort((a, b) => b.updatedAt - a.updatedAt);

      total = allAuthorized.length;
      notes = allAuthorized.slice(skip, skip + limit);
    } else {
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
  }

  const pagination = createPaginationMeta(page, limit, total);

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

  // Count my notes
  const mineCount = await prisma.note.count({
    where: { createdById: userId },
  });

  // Count notes I've handled (acted on)
  const handledNoteIds = await prisma.noteHistory.findMany({
    where: {
      performedById: userId,
      action: { in: [NOTE_ACTIONS.APPROVED, NOTE_ACTIONS.REJECTED, NOTE_ACTIONS.FORWARDED, NOTE_ACTIONS.REVERTED] },
    },
    select: { noteId: true },
    distinct: ['noteId'],
  });
  const handledCount = handledNoteIds.length;

  // Count pending notes (more complex - needs authorization check)
  const pendingWhere = {
    status: NOTE_STATUS.PENDING,
    OR: [
      { currentHolderId: userId },
      { currentHolderId: null, currentFlowIndex: { not: null } },
    ],
  };

  const pendingCandidates = await prisma.note.findMany({
    where: pendingWhere,
    select: {
      id: true,
      currentHolderId: true,
      currentFlowIndex: true,
      category: true,
      subcategory: true,
      amountRequired: true,
      createdById: true,
    },
    take: LIMITS.PENDING_NOTES_FETCH_LIMIT,
  });

  // Direct holders
  const directHolders = pendingCandidates.filter((n) => n.currentHolderId === userId);
  
  // Group step notes requiring authorization check
  const groupStepNotes = pendingCandidates.filter(
    (n) => n.currentHolderId == null && n.currentFlowIndex != null
  );

  const authResults = await approvalFlowService.canUserActAtStepBatch(userId, groupStepNotes);
  const authorizedGroupCount = groupStepNotes.filter((n) => authResults.get(n.id)).length;

  const pendingCount = directHolders.length + authorizedGroupCount;

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
        currentFlowIndex: null,
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
        // Don't change currentFlowIndex - preserve where it was in flow
      },
    }),
  ]);

  return ApiResponse.success(res, null, 'Note reverted back to creator successfully');
});

/**
 * Forward note to another authority
 * Can be automated (next in flow) or manual (specific user)
 * DSW/Central Team: any member can act
 * 
 * @route POST /api/noting/:id/forward
 * @access Protected - Current approver only
 */
const forward = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { nextHolderId, remarks, automated } = req.body;

  // Validation handled by validator middleware

  // Load note
  const note = await getNoteById(id);
  verifyNotePending(note);
  await verifyCanActOnNote(note, userId);

  let targetHolderId = nextHolderId;
  let targetFlowIndex = null;

  if (automated === true) {
    // Automated forward: move to next step in flow
    const noteContext = { amountRequired: note.amountRequired === true };
    const steps = await approvalFlowService.getFullFlowSteps(
      note.category,
      note.subcategory,
      note.createdById,
      noteContext
    );
    const currentIndex = resolveCurrentFlowIndex(note, steps);
    const nextIndex = currentIndex != null ? currentIndex + 1 : null;
    const nextStep = nextIndex != null && nextIndex < steps.length ? steps[nextIndex] : null;

    if (!nextStep) {
      throw new ValidationError('No next authority in approval flow for automated forward');
    }

    targetFlowIndex = nextIndex;
    const isGroupStep = isCentralDepartmentRole(nextStep.authorityType) && nextStep.userIds.length > 0;
    targetHolderId = isGroupStep ? null : (nextStep.userIds[0] ?? null);
  } else {
    // Manual forward: use provided nextHolderId
    if (!targetHolderId || !String(targetHolderId).trim()) {
      throw new ValidationError('nextHolderId is required for manual forward');
    }
    targetHolderId = String(targetHolderId).trim();
  }

  // Update note and create history in transaction
  await prisma.$transaction([
    prisma.noteHistory.create({
      data: {
        noteId: note.id,
        action: NOTE_ACTIONS.FORWARDED,
        performedById: userId,
        remarks: String(remarks).trim(),
        nextHolderId: targetHolderId || undefined,
      },
    }),
    prisma.note.update({
      where: { id },
      data: {
        currentHolderId: targetHolderId || null,
        ...(targetFlowIndex != null && { currentFlowIndex: targetFlowIndex }),
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
};
