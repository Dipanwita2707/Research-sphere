/**
 * @module uploads/fileAccess
 * @description Authorisation + streaming for locally stored uploads.
 *
 * Uploaded files used to be served by `express.static('/uploads')` with no
 * authentication. They are now served only through `GET /uploads/<path>` behind
 * `protect` (see ./index.js), and each request must pass `authorizeUploadPath`.
 *
 * How ownership is resolved (all DB lookups run inside the request's tenant
 * context, so the tenant extension hides rows of other universities — a foreign
 * file therefore behaves exactly like a missing one):
 *
 *   profiles/<file>                  UserLogin.profileImage = <file>
 *   bug-reports/...                  BugReportScreenshot.storagePath|thumbnailPath;
 *                                    reporter, admin or superadmin only
 *   research/tracker/<file>          ResearchProgressStatusHistory.attachments
 *                                    contains { filename: <file> }
 *   <folder...>/<userId>/<file>      generic uploads (s3File/localFile services,
 *                                    IPR annexures/prototypes, documents, grants,
 *                                    noting ...): the uploader <userId> must be a
 *                                    user of the caller's university
 *   audit-reports/...                never served (download via the audit module)
 *   anything else                    superadmin (global view) only
 *
 * The generic rule is tenant-level, not per-record: within a university many
 * roles (reviewers, DRD, finance) legitimately open other users' documents, and
 * file names carry a timestamp + 48 random bits. Modules that need stricter
 * per-record rules should serve files from their own endpoint and may reuse
 * `resolveLocalFile` / `sendResolvedFile` from here.
 */
const fs = require('fs');
const path = require('path');
const prisma = require('../../shared/config/database');

const BACKEND_ROOT = path.join(__dirname, '..', '..', '..');

/**
 * Directories uploads have historically been written to, in lookup order:
 *   backend/uploads            profiles, bug reports, most files
 *   backend/src/uploads        s3File.service local fallback, progress tracker
 *   backend/src/modules/uploads localFile.service
 */
const UPLOAD_ROOTS = [
  path.join(BACKEND_ROOT, 'uploads'),
  path.join(BACKEND_ROOT, 'src', 'uploads'),
  path.join(BACKEND_ROOT, 'src', 'modules', 'uploads'),
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED_TOP_LEVEL = new Set(['audit-reports']);
const BUG_REPORT_ADMIN_ROLES = new Set(['admin', 'superadmin']);

// Types a browser may render inline; everything else is forced to download.
const INLINE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf']);

/**
 * Split and validate a relative upload path. Returns null when malformed
 * (traversal, absolute, backslashes, NUL, too deep).
 * @param {string} rawPath
 * @returns {string[]|null}
 */
function parseUploadPath(rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length === 0 || rawPath.length > 512) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch (_) {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments.length < 2 || segments.length > 8) return null;
  if (segments.some((s) => s === '.' || s === '..' || s.startsWith('.'))) return null;
  return segments;
}

/**
 * Decide whether the authenticated caller may read this upload.
 * Must run after `protect` (inside the request's tenant context).
 * @param {string[]} segments - output of parseUploadPath
 * @param {import('express').Request} req
 * @returns {Promise<boolean>}
 */
async function authorizeUploadPath(segments, req) {
  const [top] = segments;
  if (DENIED_TOP_LEVEL.has(top)) return false;

  const user = req.user;
  if (!user) return false;
  const isGlobalSuperadmin = user.role === 'superadmin' && !req.tenantId;
  if (isGlobalSuperadmin) return true;

  const fileName = segments[segments.length - 1];

  if (top === 'profiles') {
    if (segments.length !== 2) return false;
    const owner = await prisma.userLogin.findFirst({ where: { profileImage: fileName }, select: { id: true } });
    return Boolean(owner);
  }

  if (top === 'bug-reports') {
    const rel = segments.join('/');
    const variants = [rel, rel.replace(/\//g, '\\')];
    const shot = await prisma.bugReportScreenshot.findFirst({
      where: { OR: [{ storagePath: { in: variants } }, { thumbnailPath: { in: variants } }] },
      select: { bugReport: { select: { userId: true } } },
    });
    if (!shot) return false;
    return shot.bugReport?.userId === user.id || BUG_REPORT_ADMIN_ROLES.has(user.role);
  }

  if (top === 'research' && segments[1] === 'tracker') {
    if (segments.length !== 3) return false;
    const entry = await prisma.researchProgressStatusHistory.findFirst({
      where: { attachments: { array_contains: [{ filename: fileName }] } },
      select: { id: true },
    });
    return Boolean(entry);
  }

  // Generic "<folder...>/<uploaderUserId>/<file>" layout
  const ownerId = segments.slice(1, -1).reverse().find((s) => UUID_RE.test(s));
  if (!ownerId) return false;
  const owner = await prisma.userLogin.findFirst({ where: { id: ownerId }, select: { id: true } });
  return Boolean(owner);
}

/**
 * Locate a file on local disk, confined to the upload roots.
 * @param {string[]} segments
 * @returns {string|null} absolute path
 */
function resolveLocalFile(segments) {
  for (const root of UPLOAD_ROOTS) {
    const full = path.resolve(root, ...segments);
    if (!full.startsWith(root + path.sep)) continue;
    try {
      if (fs.statSync(full).isFile()) return full;
    } catch (_) {
      // not in this root
    }
  }
  return null;
}

function setSafeFileHeaders(res, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const disposition = INLINE_EXTENSIONS.has(ext) ? 'inline' : 'attachment';
  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // A served file can never run script in our origin, even if mislabelled
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  // The frontend (different origin) embeds images/PDFs from here
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

/**
 * Stream a resolved local file.
 * @param {import('express').Response} res
 * @param {string} fullPath
 * @param {Function} next
 */
function sendResolvedFile(res, fullPath, next) {
  setSafeFileHeaders(res, path.basename(fullPath));
  res.sendFile(fullPath, { dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) next(err);
  });
}

const s3Configured = () => Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

/**
 * Express handler for GET /uploads/*. Mount after `protect`.
 */
async function serveUpload(req, res, next) {
  try {
    const segments = parseUploadPath(req.path);
    if (!segments) {
      return res.status(400).json({ success: false, message: 'Invalid file path' });
    }

    // 404 for both "missing" and "not yours" so file existence is not disclosed
    const notFound = () => res.status(404).json({ success: false, message: 'File not found' });

    if (!(await authorizeUploadPath(segments, req))) return notFound();

    const fullPath = resolveLocalFile(segments);
    if (fullPath) return sendResolvedFile(res, fullPath, next);

    // Files uploaded while S3 was configured live under the same key in the bucket
    if (s3Configured()) {
      try {
        const { downloadFromS3 } = require('../../shared/utils/s3');
        const result = await downloadFromS3(segments.join('/'));
        setSafeFileHeaders(res, segments[segments.length - 1]);
        if (result.contentType) res.setHeader('Content-Type', result.contentType);
        if (result.contentLength) res.setHeader('Content-Length', result.contentLength);
        return result.stream.pipe(res);
      } catch (_) {
        // fall through to 404
      }
    }
    return notFound();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  UPLOAD_ROOTS,
  parseUploadPath,
  authorizeUploadPath,
  resolveLocalFile,
  sendResolvedFile,
  serveUpload,
};
