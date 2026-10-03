/**
 * @module fileTypes
 * @description Upload/download file-type policy shared by the S3 and local file services.
 *
 * The client-supplied MIME type is never trusted:
 *   - uploads must have an allowlisted extension, a MIME type plausible for that extension,
 *     and content whose magic bytes match the extension;
 *   - stored and served Content-Type is derived from the extension, never from what the
 *     uploader sent (an "image/png" that is really HTML must not render as HTML).
 */
const path = require('path');

const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .doc/.xls/.ppt
const startsWith = (buf, bytes, offset = 0) =>
  Buffer.isBuffer(buf) && buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const isZip = (buf) =>
  startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buf, [0x50, 0x4b, 0x05, 0x06]); // PK.. (also OOXML)
const isPlainText = (buf) => {
  if (!Buffer.isBuffer(buf)) return false;
  const head = buf.subarray(0, 8192);
  return !head.includes(0x00);
};

/** Content-Type served for an extension (download side; broader than the upload allowlist). */
const CONTENT_TYPES = Object.freeze({
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.zip': 'application/zip',
});

// Browsers (notably on Windows) send application/octet-stream for office/zip files.
const OCTET = 'application/octet-stream';
const ZIP_MIMES = ['application/zip', 'application/x-zip-compressed', 'application/x-zip', 'multipart/x-zip', OCTET];

/** Upload allowlist: extension → accepted client MIME types + content check. */
const UPLOAD_TYPES = Object.freeze({
  '.pdf': { mimes: ['application/pdf'], check: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) }, // %PDF-
  '.doc': { mimes: ['application/msword', OCTET], check: (b) => startsWith(b, OLE2) },
  '.docx': { mimes: [CONTENT_TYPES['.docx'], OCTET, 'application/zip'], check: isZip },
  '.xls': { mimes: ['application/vnd.ms-excel', OCTET], check: (b) => startsWith(b, OLE2) },
  '.xlsx': { mimes: [CONTENT_TYPES['.xlsx'], OCTET, 'application/zip'], check: isZip },
  '.jpg': { mimes: ['image/jpeg', 'image/jpg', 'image/pjpeg'], check: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  '.jpeg': { mimes: ['image/jpeg', 'image/jpg', 'image/pjpeg'], check: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  '.png': { mimes: ['image/png'], check: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  '.gif': { mimes: ['image/gif'], check: (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]) }, // GIF8
  '.txt': { mimes: ['text/plain'], check: isPlainText },
  '.csv': { mimes: ['text/csv', 'text/plain', 'application/vnd.ms-excel', OCTET], check: isPlainText },
  '.zip': { mimes: ZIP_MIMES, check: isZip },
});

/**
 * Brand images (university logos / favicon). Kept separate from UPLOAD_TYPES so the
 * general document upload allowlist does not grow. SVG is accepted here only because
 * the branding service rasterises it to PNG before storing (no SVG is ever served).
 */
const isWebp = (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8); // RIFF....WEBP
const looksLikeSvg = (b) => {
  if (!isPlainText(b)) return false;
  const head = b.subarray(0, 4096).toString('utf8').trimStart().toLowerCase();
  // A DOCTYPE is recognised here so the branding service can refuse it with a clear reason
  return /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!doctype[^[>]*(\[[\s\S]*?\])?\s*>\s*)*<svg[\s>]/.test(head);
};
const BRAND_IMAGE_TYPES = Object.freeze({
  '.png': UPLOAD_TYPES['.png'],
  '.jpg': UPLOAD_TYPES['.jpg'],
  '.jpeg': UPLOAD_TYPES['.jpeg'],
  '.webp': { mimes: ['image/webp'], check: isWebp },
  '.svg': { mimes: ['image/svg+xml'], check: looksLikeSvg },
});

const extOf = (fileName) => path.extname(String(fileName || '')).toLowerCase();

/** Content-Type to store/serve for a file name; application/octet-stream when unknown. */
const contentTypeFor = (fileName) => CONTENT_TYPES[extOf(fileName)] || OCTET;

/**
 * Metadata check (usable in a multer fileFilter, before the body is read).
 * @param {{ originalname: string, mimetype: string }} file
 * @param {string[]} [allowedExtensions] restrict further (e.g. ['.zip'] for prototypes)
 * @param {Record<string, {mimes: string[]}>} [types] type table (UPLOAD_TYPES or BRAND_IMAGE_TYPES)
 * @returns {string|null} error message, or null when acceptable
 */
const checkUploadMetadata = (file, allowedExtensions = Object.keys(UPLOAD_TYPES), types = UPLOAD_TYPES) => {
  const ext = extOf(file?.originalname);
  const type = types[ext];
  if (!type || !allowedExtensions.includes(ext)) {
    return `File type ${ext || '(none)'} is not allowed`;
  }
  const mime = String(file?.mimetype || '').toLowerCase().split(';')[0].trim();
  if (!type.mimes.includes(mime)) {
    return `File content type ${mime || '(none)'} does not match a ${ext} file`;
  }
  return null;
};

/**
 * Content check: magic bytes must match the extension.
 * @param {{ originalname: string, buffer: Buffer }} file
 * @returns {boolean}
 */
const contentMatchesExtension = (file, types = UPLOAD_TYPES) => {
  const type = types[extOf(file?.originalname)];
  return Boolean(type && type.check(file?.buffer));
};

module.exports = {
  CONTENT_TYPES,
  UPLOAD_TYPES,
  BRAND_IMAGE_TYPES,
  extOf,
  contentTypeFor,
  checkUploadMetadata,
  contentMatchesExtension,
};
