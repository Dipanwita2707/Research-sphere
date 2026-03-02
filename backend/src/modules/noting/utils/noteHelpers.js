/**
 * Note-specific Helper Functions
 * Business logic helpers for note operations
 */

const prisma = require('../../../shared/config/database');
const { NotFoundError, ValidationError, ForbiddenError } = require('../../../shared/utils/AppError');
const { NOTE_STATUS } = require('../constants/noting.constants');
const { noteForValidation, getFullNoteInclude, getFullNoteSelect } = require('./selectFragments');

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
 * PERF: Uses select{} + relationLoadStrategy:"join" instead of include{}.
 * This reduces Neon round-trips from 5-6 to 1 (single SQL with JOINs).
 * @param {string} id - Note UUID
 * @returns {Promise<Object>} Note with all relations
 */
async function getNoteWithDetails(id) {
  const note = await getNoteById(id, getFullNoteSelect());

  // ── Enrich DSW club creation notings with resolved names ──────────────
  if (note.subcategory === 'dsw_club_creation' && note.clubName) {
    note.clubDetails = await resolveDswClubDetails(note);
  }

  return note;
}

/**
 * Resolve UUIDs to display names for DSW club creation noting fields.
 * clubCategoryId   → category name (and parent)
 * clubFacultyFacilitatorId → name, uid, department
 * clubChairpersonId → name, uid
 * clubInitialMembers[] → [{id, uid, name}]
 */
async function resolveDswClubDetails(note) {
  const details = {
    categoryName: null,
    parentCategoryName: null,
    facultyFacilitator: null,
    chairperson: null,
    members: [],
  };

  try {
    // Parallelize independent lookups: category, facilitator, and chairperson
    // are all independent queries that can run concurrently
    const [cat, facilitatorUser, chairpersonUser] = await Promise.all([
      // Category lookup
      note.clubCategoryId
        ? prisma.clubCategory.findUnique({
            where: { id: note.clubCategoryId },
            select: { name: true, parent: { select: { name: true } } },
          })
        : null,
      // Faculty Facilitator lookup
      note.clubFacultyFacilitatorId
        ? prisma.userLogin.findUnique({
            where: { id: note.clubFacultyFacilitatorId },
            select: {
              id: true, uid: true,
              employeeDetails: {
                select: {
                  firstName: true, lastName: true, displayName: true,
                  designation: true,
                  primaryDepartment: { select: { departmentName: true } },
                },
              },
            },
          })
        : null,
      // Chairperson lookup
      note.clubChairpersonId
        ? prisma.userLogin.findUnique({
            where: { id: note.clubChairpersonId },
            select: {
              id: true, uid: true,
              studentLogin: {
                select: {
                  displayName: true, firstName: true, lastName: true, studentId: true,
                  program: {
                    select: { programName: true, department: { select: { departmentName: true } } },
                  },
                },
              },
              employeeDetails: {
                select: { displayName: true, firstName: true, lastName: true },
              },
            },
          })
        : null,
    ]);

    // Map category result
    if (cat) {
      details.categoryName = cat.name;
      details.parentCategoryName = cat.parent?.name || null;
    }

    // Map faculty facilitator result
    if (facilitatorUser) {
      const emp = facilitatorUser.employeeDetails;
      details.facultyFacilitator = {
        id: facilitatorUser.id,
        uid: facilitatorUser.uid,
        name: emp?.displayName || [emp?.firstName, emp?.lastName].filter(Boolean).join(' ') || facilitatorUser.uid,
        department: emp?.primaryDepartment?.departmentName || null,
        designation: emp?.designation || null,
      };
    }

    // Map chairperson result
    if (chairpersonUser) {
      const stu = chairpersonUser.studentLogin;
      const emp = chairpersonUser.employeeDetails;
      details.chairperson = {
        id: chairpersonUser.id,
        uid: chairpersonUser.uid,
        name: stu?.displayName || [stu?.firstName, stu?.lastName].filter(Boolean).join(' ')
              || emp?.displayName || [emp?.firstName, emp?.lastName].filter(Boolean).join(' ')
              || chairpersonUser.uid,
        department: stu?.program?.department?.departmentName || null,
        program: stu?.program?.programName || null,
      };
    }

    // Initial Members (batch) — already efficient, runs after parallel lookups
    if (note.clubInitialMembers && note.clubInitialMembers.length > 0) {
      const users = await prisma.userLogin.findMany({
        where: { id: { in: note.clubInitialMembers } },
        select: {
          id: true, uid: true,
          studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
          employeeDetails: { select: { displayName: true, firstName: true, lastName: true } },
        },
      });
      details.members = users.map((u) => {
        const stu = u.studentLogin;
        const emp = u.employeeDetails;
        return {
          id: u.id,
          uid: u.uid,
          name: stu?.displayName || [stu?.firstName, stu?.lastName].filter(Boolean).join(' ')
                || emp?.displayName || [emp?.firstName, emp?.lastName].filter(Boolean).join(' ')
                || u.uid,
        };
      });
    }
  } catch (err) {
    console.error('Failed to resolve DSW club details for note', note.id, err.message);
  }

  return details;
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
