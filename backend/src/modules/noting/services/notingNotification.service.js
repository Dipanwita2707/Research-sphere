/**
 * Noting Notification Service
 *
 * Centralises in-app notification creation for all Noting-related actions.
 * Uses the same prisma.notification.create() mechanism already used by Research,
 * IPR, and Event Management — no changes to the Notification module itself.
 *
 * Rules:
 *   - All public functions are fire-and-forget; errors are logged, never thrown.
 *     Notification failures MUST NOT propagate to or roll back noting workflows.
 *   - Each creation invalidates notif:unread:{userId} so the unread badge stays
 *     accurate without waiting for the 30-second cache TTL to expire.
 *   - referenceType is always 'note'; referenceId is the note's UUID primary key.
 */

const prisma = require('../../../shared/config/database');
const cache  = require('../../../shared/config/redis');
const log    = require('../../../shared/utils/logger');

// ── Notification type strings ───────────────────────────────────────────────
// VarChar(50) — consistent with the platform convention of free-form type tags.
// All strings below are well within the 50-character column limit.
const TYPES = {
  ASSIGNED:        'noting_assigned',        // Note submitted → assigned approver
  FORWARDED:       'noting_forwarded',       // Note forwarded to new holder
  APPROVED:        'noting_approved',        // Note approved → creator
  REJECTED:        'noting_rejected',        // Note rejected → creator
  REVERTED:        'noting_reverted',        // Note reverted → creator
  RECOMMENDED:     'noting_recommended',     // Recommend recorded → next holder + creator FYI
  NOT_RECOMMENDED: 'noting_not_recommended', // Not-recommend recorded → same recipients
  COPY_SENT:       'noting_copy_sent',       // Copy assigned to user
  COPY_REPLY:      'noting_copy_reply',      // Assignee replied → copy sender
  COPY_ESCALATED:  'noting_copy_escalated',  // Escalation triggered → each boss in chain
  SPONSOR_ASSIGNED: 'noting_sponsor_assigned', // Sponsor responsibility assigned to user
};

// ── Internal helper ─────────────────────────────────────────────────────────

/**
 * Create one notification row and invalidate the recipient's unread-count cache.
 * All errors are swallowed so callers are never disrupted.
 *
 * @param {string} userId
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @param {string} referenceType
 * @param {string} referenceId
 * @param {Object} [metadata]
 */
async function _notify(userId, type, title, message, referenceType, referenceId, metadata = {}) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, referenceType, referenceId, metadata },
    });
    // Bust unread-count cache.  The notification controller sets this key on
    // mark-as-read; since we're creating from the Noting module we bust it here
    // so the badge count stays correct for the recipient immediately.
    await cache.del(`notif:unread:${userId}`);
  } catch (err) {
    log.error(`[NotingNotification] Failed to create notification (${type}) for user ${userId}: ${err.message}`);
  }
}

/** Returns " (subcategory label)" for human-readable messages, or '' if none. */
function _subcatLabel(note) {
  const sub = (note.subcategory || '').replace(/_/g, ' ');
  return sub ? ` (${sub})` : '';
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Notify the assigned approver when a note is submitted or resubmitted and
 * auto-forwarded to them.
 *
 * @param {Object} note     - Note scalar row (needs id, notingId, category, subcategory)
 * @param {string} holderId - UUID of the new approver / current holder
 */
async function notifyAssigned(note, holderId) {
  if (!holderId) return;
  await _notify(
    holderId,
    TYPES.ASSIGNED,
    'Note Assigned for Your Review',
    `Noting ${note.notingId}${_subcatLabel(note)} has been submitted and assigned to you for review and approval.`,
    'note',
    note.id,
    { notingId: note.notingId, category: note.category, subcategory: note.subcategory },
  );
}

/**
 * Notify the new holder when a note is manually or automatically forwarded.
 *
 * @param {Object} note        - Note scalar row (needs id, notingId, category, subcategory)
 * @param {string} newHolderId - UUID of the new holder
 * @param {string} [remarks]
 */
async function notifyForwarded(note, newHolderId, remarks) {
  if (!newHolderId) return;
  const extra = remarks ? ` Remarks: "${remarks}"` : '';
  await _notify(
    newHolderId,
    TYPES.FORWARDED,
    'Note Forwarded to You',
    `Noting ${note.notingId}${_subcatLabel(note)} has been forwarded to you for action.${extra}`,
    'note',
    note.id,
    { notingId: note.notingId, category: note.category, subcategory: note.subcategory },
  );
}

/**
 * Notify the creator when their note is approved.
 * Optionally includes derived event / club identifiers in metadata.
 *
 * @param {Object} note         - Note scalar row (needs id, notingId, createdById, category, subcategory)
 * @param {Object} [opts]
 * @param {string}   [opts.eventId]
 * @param {string[]} [opts.eventIds]
 * @param {string}   [opts.clubId]
 */
async function notifyApproved(note, opts = {}) {
  const creatorId = note.createdById;
  if (!creatorId) return;

  let suffix = '';
  if (opts.eventIds && opts.eventIds.length > 0) {
    suffix = ` ${opts.eventIds.length} sub-event(s) have been created in DRAFT status.`;
  } else if (opts.eventId) {
    suffix = ` Event ${opts.eventId} has been created in DRAFT status.`;
  } else if (opts.clubId) {
    suffix = ` Club ${opts.clubId} has been created and is now active.`;
  }

  await _notify(
    creatorId,
    TYPES.APPROVED,
    'Your Note Has Been Approved',
    `Noting ${note.notingId}${_subcatLabel(note)} has been approved.${suffix}`,
    'note',
    note.id,
    {
      notingId: note.notingId,
      category: note.category,
      subcategory: note.subcategory,
      ...(opts.eventId  ? { eventId: opts.eventId }   : {}),
      ...(opts.eventIds ? { eventIds: opts.eventIds } : {}),
      ...(opts.clubId   ? { clubId: opts.clubId }     : {}),
    },
  );
}

/**
 * Notify the creator when their note is rejected.
 *
 * @param {Object} note    - Note scalar row (needs id, notingId, createdById, category, subcategory)
 * @param {string} remarks - Rejection reason (mandatory per noting workflow)
 */
async function notifyRejected(note, remarks) {
  const creatorId = note.createdById;
  if (!creatorId) return;
  await _notify(
    creatorId,
    TYPES.REJECTED,
    'Your Note Has Been Rejected',
    `Noting ${note.notingId}${_subcatLabel(note)} has been rejected. Reason: "${remarks}"`,
    'note',
    note.id,
    { notingId: note.notingId, category: note.category, subcategory: note.subcategory, remarks },
  );
}

/**
 * Notify the creator when their note is reverted for modifications.
 *
 * @param {Object} note    - Note scalar row (needs id, notingId, createdById, category, subcategory)
 * @param {string} remarks - Revert remarks (mandatory per noting workflow)
 */
async function notifyReverted(note, remarks) {
  const creatorId = note.createdById;
  if (!creatorId) return;
  await _notify(
    creatorId,
    TYPES.REVERTED,
    'Your Note Has Been Returned for Changes',
    `Noting ${note.notingId}${_subcatLabel(note)} has been returned to you for modification. Remarks: "${remarks}"`,
    'note',
    note.id,
    { notingId: note.notingId, category: note.category, subcategory: note.subcategory, remarks },
  );
}

/**
 * Notify two parties after a recommendation is recorded:
 *   1. The next holder (currentHolderId) — note is now in their queue.
 *   2. The creator (createdById) — FYI that a reviewer added a comment.
 *
 * @param {Object} note   - Note scalar row (needs id, notingId, createdById, currentHolderId,
 *                          category, subcategory). currentHolderId must already be set to the
 *                          new manager BEFORE this function is called.
 * @param {'recommended'|'not_recommended'} action
 * @param {string} remarks
 */
async function notifyRecommendation(note, action, remarks) {
  const isPositive  = action === 'recommended';
  const actionLabel = isPositive ? 'recommended' : 'not recommended';
  const creatorId   = note.createdById;
  const nextHolderId = note.currentHolderId;

  // 1. Notify the next holder (note is now in their queue)
  if (nextHolderId) {
    const extra = remarks ? ` Remarks: "${remarks}"` : '';
    await _notify(
      nextHolderId,
      isPositive ? TYPES.RECOMMENDED : TYPES.NOT_RECOMMENDED,
      'Note Forwarded to You with Recommendation',
      `Noting ${note.notingId}${_subcatLabel(note)} has been ${actionLabel} and forwarded to you for further action.${extra}`,
      'note',
      note.id,
      { notingId: note.notingId, action, remarks },
    );
  }

  // 2. Notify the creator as an FYI (no action required on their part)
  if (creatorId && creatorId !== nextHolderId) {
    await _notify(
      creatorId,
      isPositive ? TYPES.RECOMMENDED : TYPES.NOT_RECOMMENDED,
      isPositive ? 'Your Note Has Been Recommended' : 'Your Note Was Not Recommended',
      `A reviewer has ${actionLabel} Noting ${note.notingId}${_subcatLabel(note)} and forwarded it to the next authority.`,
      'note',
      note.id,
      { notingId: note.notingId, action, remarks },
    );
  }
}

/**
 * Notify each user who received a copy of an approved note.
 *
 * @param {Object[]} copies - Array of NoteCopy rows (each needs .id and .assignedToId)
 * @param {Object}   note   - Note scalar row (needs id, notingId, category, subcategory)
 */
async function notifyCopySent(copies, note) {
  for (const copy of copies) {
    if (!copy.assignedToId) continue;
    await _notify(
      copy.assignedToId,
      TYPES.COPY_SENT,
      'A Note Copy Has Been Assigned to You',
      `You have been assigned a copy of Noting ${note.notingId}${_subcatLabel(note)} for your action.`,
      'note',
      note.id,
      { notingId: note.notingId, copyId: copy.id },
    );
  }
}

/**
 * Notify the copy sender when the assignee submits a reply.
 *
 * @param {Object} copy - NoteCopy row with { sentById, noteId, note: { notingId, ... } }
 */
async function notifyCopyReply(copy) {
  const sentById = copy.sentById;
  if (!sentById) return;
  const notingId = copy.note?.notingId || '';
  const noteId   = copy.noteId;
  await _notify(
    sentById,
    TYPES.COPY_REPLY,
    'Reply Received on Your Note Copy',
    `The assignee has replied to the copy of Noting ${notingId} that you sent. Please review the reply.`,
    'note',
    noteId,
    { notingId, copyId: copy.id },
  );
}

/**
 * Notify each manager in the escalation chain after a copy is escalated.
 *
 * @param {Array<{id: string, level: number, name: string}>} allBosses - From forwardCopy's CTE walk
 * @param {Object} copy - NoteCopy row with { noteId, note: { notingId } }
 */
async function notifyCopyEscalated(allBosses, copy) {
  if (!allBosses || allBosses.length === 0) return;
  const notingId = copy.note?.notingId || '';
  const noteId   = copy.noteId;
  for (const boss of allBosses) {
    if (!boss.id) continue;
    await _notify(
      boss.id,
      TYPES.COPY_ESCALATED,
      'Escalation Notice: Note Copy Pending Action',
      `Noting ${notingId} has been escalated to you (Level ${boss.level}). The assigned task is still pending completion.`,
      'note',
      noteId,
      { notingId, escalationLevel: boss.level, copyId: copy.id },
    );
  }
}

/**
 * Notify users who have been assigned sponsor-related responsibilities.
 * Covers both cash collection assignments and in-kind item pickup assignments.
 * Deduplicates so each user gets at most one notification listing all their tasks.
 *
 * @param {Object}   note     - Note scalar row (needs id, notingId, category, subcategory)
 * @param {Object[]} sponsors - Sanitized sponsor array from eventSponsors JSON field
 */
async function notifySponsorAssigned(note, sponsors) {
  if (!Array.isArray(sponsors) || sponsors.length === 0) return;

  // Collect tasks per user: { [userId]: string[] }
  const tasksByUser = {};

  for (const s of sponsors) {
    const sponsorLabel = s.name || 'Unnamed sponsor';

    // Cash collection assignment
    if (s.cashAssignedTo && s.cashAssignedTo.id) {
      const uid = s.cashAssignedTo.id;
      if (!tasksByUser[uid]) tasksByUser[uid] = [];
      tasksByUser[uid].push(`Collect cash sponsorship from ${sponsorLabel}`);
    }

    // In-kind item assignments
    if (Array.isArray(s.inKindItems)) {
      for (const item of s.inKindItems) {
        if (item.assignedTo && item.assignedTo.id) {
          const uid = item.assignedTo.id;
          if (!tasksByUser[uid]) tasksByUser[uid] = [];
          const itemLabel = item.itemName || 'an in-kind item';
          tasksByUser[uid].push(`Collect ${itemLabel} from ${sponsorLabel}`);
        }
      }
    }
  }

  for (const [userId, tasks] of Object.entries(tasksByUser)) {
    const taskList = tasks.join('; ');
    await _notify(
      userId,
      TYPES.SPONSOR_ASSIGNED,
      'Sponsor Responsibility Assigned',
      `You have been assigned sponsor duties for Noting ${note.notingId}${_subcatLabel(note)}: ${taskList}.`,
      'note',
      note.id,
      { notingId: note.notingId, category: note.category, subcategory: note.subcategory, tasks },
    );
  }
}

module.exports = {
  notifyAssigned,
  notifyForwarded,
  notifyApproved,
  notifyRejected,
  notifyReverted,
  notifyRecommendation,
  notifyCopySent,
  notifyCopyReply,
  notifyCopyEscalated,
  notifySponsorAssigned,
};
