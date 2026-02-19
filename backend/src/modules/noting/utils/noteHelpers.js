/**
 * Note-specific Helper Functions
 * Business logic helpers for note operations
 */

const prisma = require('../../../shared/config/database');
const { NotFoundError, ValidationError, ForbiddenError } = require('../../../shared/utils/AppError');
const { NOTE_STATUS } = require('../constants/noting.constants');
const { noteForValidation, getFullNoteInclude } = require('./selectFragments');

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
    throw new ValidationError(
      `This note cannot be edited because it is currently "${note.status}". Only drafts or notes returned for revision can be edited.`
    );
  }

  if (note.createdById !== userId) {
    throw new ForbiddenError(
      'You can only edit notes that you created. This note belongs to another user.'
    );
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
      'This note cannot be deleted because an approver has already reviewed it. The note is currently in the approval workflow. If you need to cancel this request, please contact your manager.'
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
      'This note cannot be edited because an approver has already reviewed it. If changes are needed, ask your manager to "Revert" the note back to you for modifications.'
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
    const statusMessages = {
      draft: 'This note is still a draft. Please submit it first before any actions can be taken.',
      approved: 'This note has already been approved. No further actions are needed.',
      rejected: 'This note has been rejected. Please create a new note if needed.',
      reverted: 'This note has been returned for revision. The creator needs to modify and resubmit it.',
    };
    throw new ValidationError(
      statusMessages[note.status] || `This note is currently "${note.status}" and cannot be acted upon.`
    );
  }
}

/**
 * Check if user can act on note (approve/reject/forward)
 * User must be the current holder of the note
 * @param {Object} note - Note object
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user can act
 */
async function canUserActOnNote(note, userId) {
  // Direct holder - only the current holder can act
  return note.currentHolderId === userId;
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
    throw new ForbiddenError(
      'You are not the current holder of this note. Only the person to whom the note is currently assigned can Approve, Reject, Forward, or Revert it.'
    );
  }
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
  getDescriptionForSave,
};
