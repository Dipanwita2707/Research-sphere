/**
 * @module uploadPaths
 * @description Validation of client-supplied upload folders and authorisation of stored
 * file keys for the generic upload endpoints (/file-upload/*).
 *
 * Keys have the layout `<folder...>/<uploaderUserId>/<file>`; serving rules live in
 * uploads/fileAccess.service.js (the uploader must be a user of the caller's university).
 */
const { parseUploadPath, authorizeUploadPath } = require('../../uploads/fileAccess.service');

/** Top-level folders the generic upload endpoints may write to. */
const ALLOWED_UPLOAD_ROOTS = new Set(['documents', 'ipr', 'programmes', 'noting', 'grants']);
const SEGMENT_RE = /^[A-Za-z0-9_-]{1,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate a client-supplied upload folder.
 * @param {*} value - e.g. 'ipr/annexures', 'programmes/btech-cs/batch-2026'
 * @param {string} fallback - used when no folder was sent
 * @returns {string|null} the normalised folder, or null when it must be rejected
 */
const safeUploadFolder = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || value.length > 200) return null;
  if (value.includes('\\') || value.includes('\0') || value.startsWith('/')) return null;
  const segments = value.split('/').filter(Boolean);
  if (segments.length === 0 || segments.length > 5) return null;
  if (!segments.every((seg) => SEGMENT_RE.test(seg))) return null; // also rules out '.' and '..'
  if (!ALLOWED_UPLOAD_ROOTS.has(segments[0])) return null;
  return segments.join('/');
};

/**
 * Parse and authorise a stored key for the current caller (after `protect`).
 * @returns {Promise<{segments: string[], key: string} | {error: 400|404}>}
 *   404 covers both "missing" and "not yours" so existence is not disclosed.
 */
const authorizeFileKey = async (rawPath, req) => {
  const segments = parseUploadPath(rawPath);
  if (!segments) return { error: 400 };
  if (!(await authorizeUploadPath(segments, req))) return { error: 404 };
  return { segments, key: segments.join('/') };
};

/** Uploader user id encoded in a key (last UUID segment before the file name). */
const uploaderOf = (segments) => segments.slice(1, -1).reverse().find((s) => UUID_RE.test(s)) || null;

/** May the caller delete this file? The uploader, or an admin/superadmin of the same university. */
const canDeleteFile = (segments, user) =>
  Boolean(user) && (['admin', 'superadmin'].includes(user.role) || uploaderOf(segments) === user.id);

module.exports = {
  ALLOWED_UPLOAD_ROOTS,
  safeUploadFolder,
  authorizeFileKey,
  uploaderOf,
  canDeleteFile,
};
