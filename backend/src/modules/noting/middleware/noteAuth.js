/**
 * Note Authorization Middleware
 * Provides reusable authorization checks for note operations
 */

const prisma = require('../../../shared/config/database');
const { ForbiddenError, UnauthorizedError } = require('../../../shared/utils/AppError');
const { getNoteById, verifyCanActOnNote, verifyNotePending } = require('../utils/noteHelpers');
const { noteForValidation } = require('../utils/selectFragments');

/**
 * Middleware: Require authenticated user
 * Attaches user to request or throws error
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    throw new UnauthorizedError('Authentication required');
  }
  next();
};

/**
 * Middleware: Load note and verify user can act on it (approve/reject/forward)
 * Attaches note to req.note
 */
const requireNoteApprover = async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  // Load note with minimal fields for validation
  const note = await getNoteById(id, { select: noteForValidation });

  // Verify note is pending
  verifyNotePending(note);

  // Verify user can act
  await verifyCanActOnNote(note, userId);

  // Attach note to request for use in controller
  req.note = note;
  next();
};

/**
 * Middleware: Verify user is the creator of the note
 * Attaches note to req.note
 */
const requireNoteCreator = async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  // Load note
  const note = await getNoteById(id, { select: noteForValidation });

  // Verify user is creator
  if (note.createdById !== userId) {
    throw new ForbiddenError('You can only perform this action on your own notes');
  }

  // Attach note to request
  req.note = note;
  next();
};

/**
 * Middleware: Verify note is a draft and user is creator
 * Attaches note to req.note
 */
const requireDraftNote = async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  // Load note
  const note = await getNoteById(id, { select: noteForValidation });

  // Verify it's a draft
  if (note.status !== 'draft') {
    throw new ForbiddenError('This action can only be performed on draft notes');
  }

  // Verify user is creator
  if (note.createdById !== userId) {
    throw new ForbiddenError('You can only modify your own drafts');
  }

  // Attach note to request
  req.note = note;
  next();
};

module.exports = {
  requireAuth,
  requireNoteApprover,
  requireNoteCreator,
  requireDraftNote,
};
