/**
 * Note-specific Helper Functions
 * Business logic helpers for note operations
 */

const prisma = require('../../../shared/config/database');
const { NotFoundError, ValidationError, ForbiddenError } = require('../../../shared/utils/AppError');
const { NOTE_STATUS } = require('../constants/noting.constants');
const { noteForValidation, getFullNoteInclude } = require('./selectFragments');
const approvalFlowService = require('../services/approvalFlow.service');

/**
 * Get note by ID with validation
 * @param {string} id - Note UUID
 * @param {Object} options - Prisma options (include, select, etc.)
 * @returns {Promise<Object>} Note object
 * @throws {NotFoundError} If note not found
 */
async function getNoteById(id, options = null) {
  const note = await prisma.note.findUnique({
    where: { id },
    ...options,
  });

  if (!note) {
    throw new NotFoundError('Note');
  }

  return note;
}

/**
 * Get note with full details
 * @param {string} id - Note UUID
 * @returns {Promise<Object>} Note with all relations
 */
async function getNoteWithDetails(id) {
  return getNoteById(id, { include: getFullNoteInclude() });
}

/**
 * Verify user can edit draft note
 * @param {Object} note - Note object
 * @param {string} userId - User ID
 * @throws {ValidationError} If note is not a draft
 * @throws {ForbiddenError} If user is not the creator
 */
function verifyCanEditDraft(note, userId) {
  if (note.status !== NOTE_STATUS.DRAFT && note.status !== NOTE_STATUS.REVERTED) {
    throw new ValidationError('Only draft or reverted notes can be edited');
  }

  if (note.createdById !== userId) {
    throw new ForbiddenError('You can only edit your own notes');
  }
}

/**
 * Verify user can delete note (no actions by approvers)
 * Can delete until an approver (someone other than creator) takes action
 * @param {Object} note - Note object with history relation
 * @param {string} userId - User ID
 * @throws {ForbiddenError} If user is not the creator or if any approver has acted
 */
async function verifyCanDeleteNote(note, userId) {
  // User must be the creator
  if (note.createdById !== userId) {
    throw new ForbiddenError('You can only delete your own notes');
  }

  // Check if any approver (non-creator) has taken action
  let approverActions;
  
  if (note.history && Array.isArray(note.history)) {
    // History already loaded - check if any action by someone other than creator
    approverActions = note.history.filter(h => h.performedById !== note.createdById);
  } else {
    // Need to query history for approver actions
    const count = await prisma.noteHistory.count({
      where: {
        noteId: note.id,
        performedById: { not: note.createdById },
      },
    });
    approverActions = count > 0 ? [{ id: 'exists' }] : [];
  }

  if (approverActions.length > 0) {
    throw new ForbiddenError(
      'Cannot delete note after an approver has taken action. The note is being processed in the approval workflow.'
    );
  }
}

/**
 * Verify user can edit note (no actions by approvers)
 * Can edit until an approver (someone other than creator) takes action
 * @param {Object} note - Note object with history relation
 * @param {string} userId - User ID
 * @throws {ForbiddenError} If user is not the creator or if any approver has acted
 */
async function verifyCanEditNote(note, userId) {
  // User must be the creator
  if (note.createdById !== userId) {
    throw new ForbiddenError('You can only edit your own notes');
  }

  // Allow editing if note is reverted (back to creator for modifications)
  if (note.status === NOTE_STATUS.REVERTED) {
    return;
  }

  // Check if any approver (non-creator) has taken action
  let approverActions;
  
  if (note.history && Array.isArray(note.history)) {
    // History already loaded - check if any action by someone other than creator
    approverActions = note.history.filter(h => h.performedById !== note.createdById);
  } else {
    // Need to query history for approver actions
    const count = await prisma.noteHistory.count({
      where: {
        noteId: note.id,
        performedById: { not: note.createdById },
      },
    });
    approverActions = count > 0 ? [{ id: 'exists' }] : [];
  }

  if (approverActions.length > 0) {
    throw new ForbiddenError(
      'Cannot edit note after an approver has taken action. The note is being processed in the approval workflow.'
    );
  }
}

/**
 * Verify note is in pending status
 * @param {Object} note - Note object
 * @throws {ValidationError} If note is not pending
 */
function verifyNotePending(note) {
  if (note.status !== NOTE_STATUS.PENDING) {
    throw new ValidationError('Note is not in pending status');
  }
}

/**
 * Check if user can act on note (approve/reject/forward)
 * @param {Object} note - Note object
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user can act
 */
async function canUserActOnNote(note, userId) {
  // Direct holder
  if (note.currentHolderId === userId) {
    return true;
  }

  // Group step (central department)
  if (note.currentHolderId == null && note.currentFlowIndex != null) {
    const noteContext = { amountRequired: note.amountRequired === true };
    return await approvalFlowService.canUserActAtStep(
      userId,
      note.category,
      note.subcategory,
      note.createdById,
      note.currentFlowIndex,
      noteContext
    );
  }

  return false;
}

/**
 * Verify user can act on note
 * @param {Object} note - Note object
 * @param {string} userId - User ID
 * @throws {ForbiddenError} If user cannot act
 */
async function verifyCanActOnNote(note, userId) {
  const canAct = await canUserActOnNote(note, userId);
  if (!canAct) {
    throw new ForbiddenError('You are not authorized to act on this note');
  }
}

/**
 * Resolve current flow step index from note
 * @param {Object} note - Note object
 * @param {Array} steps - Flow steps array
 * @returns {number|null} Current flow index
 */
function resolveCurrentFlowIndex(note, steps) {
  if (note.currentFlowIndex != null) {
    return note.currentFlowIndex;
  }

  if (!note.currentHolderId) {
    return null;
  }

  const idx = steps.findIndex((s) => s.userIds.includes(note.currentHolderId));
  return idx >= 0 ? idx : null;
}

/**
 * Get description for saving (handles draft placeholder logic)
 * @param {string} description - Description from request
 * @param {boolean} isSubmit - Whether this is a submission
 * @returns {string} Description to save
 */
function getDescriptionForSave(description, isSubmit) {
  const trimmed = String(description || '').trim();

  // Draft notes can have empty description, but DB requires non-null string
  // Store empty string for drafts (schema allows it)
  if (!trimmed) {
    return '';
  }

  return trimmed;
}

module.exports = {
  getNoteById,
  getNoteWithDetails,
  verifyCanEditDraft,
  verifyCanEditNote,
  verifyCanDeleteNote,
  verifyNotePending,
  canUserActOnNote,
  verifyCanActOnNote,
  resolveCurrentFlowIndex,
  getDescriptionForSave,
};
