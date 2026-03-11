/**
 * Noting Service Layer
 *
 * Extracts reusable business logic from the controller to enforce the
 * Single Responsibility Principle. The controller remains the HTTP adapter
 * (parse req → call service → send res), while this module owns:
 *
 *   - Note lifecycle guards  (pending? holder? subcategory permission?)
 *   - Role/privileged checks
 *   - Cache invalidation orchestration
 *   - Common data-fetching patterns with perf-optimised selects
 *
 * Design choices:
 *   1. Functions are stateless — no class instance, just pure helpers.
 *   2. Prisma is required lazily to avoid circular deps at boot.
 *   3. Every function that writes state calls invalidateNoteCaches().
 */

const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const cache = require('../../../shared/config/redis');
const { NOTE_STATUS, NOTE_ACTIONS } = require('../constants/noting.constants');
const approvalFlowService = require('./approvalFlow.service');
const log = require('../../../shared/utils/logger');

// ── Lazy Prisma getter (avoids circular-require at module load) ─────────────
let _prisma;
function prisma() {
  if (!_prisma) _prisma = require('../../../shared/config/database');
  return _prisma;
}

// ── Privileged-role set (admin, superadmin, dean bypass subcategory checks) ──
const PRIVILEGED_ROLES = new Set(['admin', 'superadmin', 'dean']);

/**
 * Check whether the user is a privileged role that bypasses subcategory
 * permission gates.
 * @param {Object} user - req.user populated by protect middleware
 * @returns {boolean}
 */
function isPrivilegedUser(user) {
  return PRIVILEGED_ROLES.has(user.role) || user.roleCode === 'DEAN';
}

// ── Cache Invalidation ──────────────────────────────────────────────────────

/**
 * Bust stale cache for the affected note + all user-scoped list caches.
 * Every state-changing operation MUST call this.
 *
 * PERF FIX: Added targeted copies cache invalidation.
 * The wildcard SCAN patterns (noting:list:*, noting:mycopies:*) are kept
 * because list/copies caches are keyed per-user+page — we can't easily
 * enumerate affected users without extra queries. The SCAN cost (~20-50ms)
 * is acceptable since this only runs on writes.
 *
 * @param {string} noteId
 */
async function invalidateNoteCaches(noteId) {
  await Promise.all([
    cache.del(`noting:detail:${noteId}`),
    cache.del(`noting:copies:${noteId}`),      // Creator copies view cache
    cache.delPattern('noting:counts:*'),
    cache.delPattern('noting:list:*'),
    cache.delPattern('noting:mycopies:*'),
  ]);
}

/**
 * Lightweight cache invalidation for draft autosave.
 * Clears the detail cache synchronously (so an immediate GET sees fresh data)
 * but defers the expensive wildcard SCAN patterns to run async.
 * This shaves ~50-100ms off the autosave response time.
 *
 * @param {string} noteId
 */
async function invalidateDraftCache(noteId) {
  // Synchronous: only the specific key that a subsequent getById would hit
  await cache.del(`noting:detail:${noteId}`);
  // Fire-and-forget: list/counts caches will catch up shortly
  Promise.all([
    cache.del(`noting:copies:${noteId}`),
    cache.delPattern('noting:counts:*'),
    cache.delPattern('noting:list:*'),
    cache.delPattern('noting:mycopies:*'),
  ]).catch(() => {}); // swallow errors — these are best-effort
}

// ── Note Lifecycle Guards ───────────────────────────────────────────────────

/**
 * Fetch a note and validate it exists.
 * @param {string} id - Note UUID
 * @param {Object} [options] - Prisma findUnique options (select/include)
 * @returns {Promise<Object>} The note
 * @throws {NotFoundError}
 */
async function fetchNoteOrThrow(id, options = {}) {
  const note = await prisma().note.findUnique({ where: { id }, ...options });
  if (!note) throw new NotFoundError('Note');
  return note;
}

/**
 * Validate that a note is in pending status.
 * @param {Object} note
 * @throws {ValidationError}
 */
function assertNotePending(note) {
  if (note.status !== NOTE_STATUS.PENDING) {
    throw new ValidationError('Only pending notes can be acted upon');
  }
}

/**
 * Validate that the given user is the current holder.
 * @param {Object} note
 * @param {string} userId
 * @throws {ForbiddenError}
 */
function assertCurrentHolder(note, userId) {
  if (note.currentHolderId !== userId) {
    throw new ForbiddenError('Only the current holder can act on this note');
  }
}

/**
 * Full guard chain: exists → pending → current holder.
 * Returns the fetched note.
 * @param {string} noteId
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function guardPendingHolder(noteId, userId) {
  const note = await fetchNoteOrThrow(noteId);
  assertNotePending(note);
  assertCurrentHolder(note, userId);
  return note;
}

// ── Subcategory Permission Guard ────────────────────────────────────────────

/**
 * Verify the user has the subcategory-level permission for this note's module.
 * Privileged roles (admin/superadmin/dean) bypass.
 *
 * @param {Object} user - req.user
 * @param {Object} note - note with at least { subcategory }
 * @throws {ForbiddenError}
 */
async function assertSubcategoryPermission(user, note) {
  if (isPrivilegedUser(user)) return;

  const modulePermKey = approvalFlowService.getModulePermissionKey(note);
  const { hasPermissionAsync } = require('../../../shared/config/permissions.config');
  const hasPerm = await hasPermissionAsync(user, modulePermKey);
  if (!hasPerm) {
    const subcatLabel = (note.subcategory || 'unknown').replace(/_/g, ' ');
    throw new ForbiddenError(
      `You do not have the Subcategory Approval permission for "${subcatLabel}" notings`
    );
  }
}

// ── Reporting Manager Lookup ────────────────────────────────────────────────

/**
 * Get the user's direct reporting manager or throw.
 * @param {string} userId
 * @returns {Promise<Object>} manager with { id, ... }
 * @throws {ValidationError} if no manager found
 */
async function getManagerOrThrow(userId) {
  const reportingService = require('../../core/services/reportingStructure.service');
  const manager = await reportingService.getDirectManager(userId);
  if (!manager || !manager.id) {
    throw new ValidationError('No reporting manager found to forward the note');
  }
  return manager;
}

module.exports = {
  // Guards
  fetchNoteOrThrow,
  assertNotePending,
  assertCurrentHolder,
  guardPendingHolder,
  assertSubcategoryPermission,
  isPrivilegedUser,

  // Helpers
  getManagerOrThrow,
  invalidateNoteCaches,
  invalidateDraftCache,

  // Re-exports for convenience
  NOTE_STATUS,
  NOTE_ACTIONS,
};
