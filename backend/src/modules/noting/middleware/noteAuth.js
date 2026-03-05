/**
 * Note Authorization Middleware
 * Provides reusable authorization checks for note operations
 */

const prisma = require('../../../shared/config/database');
const { ForbiddenError } = require('../../../shared/utils/AppError');
const { getNoteById, verifyCanActOnNote, verifyNotePending } = require('../utils/noteHelpers');
const { noteForValidation } = require('../utils/selectFragments');
const { getModulePermissionKey } = require('../services/approvalFlow.service');
const { hasPermissionAsync } = require('../../../shared/config/permissions.config');

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

  // Verify user can act (is currentHolder)
  await verifyCanActOnNote(note, userId);

  // ── Subcategory permission check ──────────────────────────────────────
  // Route-level middleware only checks if user has ANY approval action
  // (noting_approve, noting_return, etc.). Here we enforce the user ALSO
  // has the SPECIFIC subcategory permission (event_approve, curriculum_approve,
  // etc.) — so someone with only "Approve Notings" action but NO subcategory
  // permissions cannot approve/reject/forward any subcategory's notings.
  //
  // Admin / superadmin / dean bypass — they inherently own all subcategories.
  const isPrivilegedRole =
    req.user.role === 'admin' ||
    req.user.role === 'superadmin' ||
    req.user.role === 'dean' ||
    req.user.roleCode === 'DEAN';

  if (!isPrivilegedRole) {
    const modulePermKey = getModulePermissionKey(note);
    // Check ONLY the specific subcategory key — do NOT fall back to
    // noting_approve (that's an action permission, not a subcategory one).
    const hasSubcatPerm = await hasPermissionAsync(req.user, modulePermKey);
    if (!hasSubcatPerm) {
      const subcatLabel = (note.subcategory || 'unknown').replace(/_/g, ' ');
      throw new ForbiddenError(
        `You do not have the Subcategory Approval permission for "${subcatLabel}" notings. ` +
        `Required: ${modulePermKey}. ` +
        `Please contact your administrator to assign the relevant Subcategory Approval.`
      );
    }
  }

  // Attach note to request for use in controller
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
  requireNoteApprover,
  requireDraftNote,
};
