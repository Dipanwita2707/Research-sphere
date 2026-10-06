/**
 * Brand image processing and storage (university logos, favicon and profile banner image).
 *
 * Every accepted image is decoded and re-encoded with sharp before it is stored (PNG; the
 * photographic banner image as JPEG, a fraction of the size):
 *   - raster uploads (PNG/JPG/WebP) lose metadata, embedded profiles and any trailing
 *     payload; a file that only *claims* to be an image fails to decode and is rejected;
 *   - SVG uploads are RASTERISED, never stored or served as SVG. An SVG is an XML
 *     document that can carry script, event handlers, external references and entity
 *     expansion; sanitising it reliably means maintaining an allowlist parser. Turning it
 *     into pixels removes every active feature by construction, so the only thing that
 *     can reach a browser is a PNG. Before rasterising we also refuse SVGs with DOCTYPE /
 *     ENTITY declarations, <script>, <foreignObject> or non-fragment external references,
 *     so the rasteriser itself never resolves anything outside the file.
 *
 * Stored under `branding/<universityId>/...png` in S3, or on local disk when S3 is not
 * configured (same fallback as the generic file service). Keys are only ever read back
 * after checking they belong to the requesting university.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { uploadToS3, downloadFromS3, deleteFromS3 } = require('../../../shared/utils/s3');
const { resolveLocalFile, setSafeFileHeaders } = require('../../uploads/fileAccess.service');
const { BRAND_IMAGE_TYPES, checkUploadMetadata, contentMatchesExtension, extOf } = require('../../../shared/utils/fileTypes');
const { createModuleLogger } = require('../../../shared/utils/logger');

const log = createModuleLogger('branding');

const MAX_BRAND_IMAGE_BYTES = 1024 * 1024; // 1 MB (logos, favicon)
const MAX_HERO_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB (banner photo / illustration)
/** Largest upload any variant accepts (the multer limit; each variant re-checks its own). */
const MAX_UPLOAD_BYTES = MAX_HERO_IMAGE_BYTES;
const maxBytesFor = (variant) => (variant === 'hero' ? MAX_HERO_IMAGE_BYTES : MAX_BRAND_IMAGE_BYTES);
const LOCAL_ROOT = path.join(__dirname, '..', '..', '..', '..', 'uploads');
const KEY_RE = /^branding\/[0-9a-f-]{36}\/[\w.-]+\.(png|jpg)$/i;
/** Stored format per variant: the banner is a photo, so JPEG; everything else PNG (keeps transparency). */
const outputExt = (variant) => (variant === 'hero' ? 'jpg' : 'png');

/** Output size per variant: logos fit inside the box keeping aspect; favicon is square. */
const VARIANT_SIZE = Object.freeze({
  light: { width: 1200, height: 400, fit: 'inside' },
  dark: { width: 1200, height: 400, fit: 'inside' },
  favicon: { width: 128, height: 128, fit: 'contain' },
  hero: { width: 1600, height: 1200, fit: 'inside' },
});

class BrandAssetError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** multer fileFilter: extension + declared MIME must fit a brand image type. */
function brandImageFileFilter(req, file, cb) {
  const error = checkUploadMetadata(file, Object.keys(BRAND_IMAGE_TYPES), BRAND_IMAGE_TYPES);
  if (error) cb(new BrandAssetError(`${error}. Use PNG, JPG, WebP or SVG.`), false);
  else cb(null, true);
}

/** Reasons an SVG is refused before it reaches the rasteriser (null when acceptable). */
function svgRejectionReason(buffer) {
  const text = buffer.toString('utf8');
  if (/<!DOCTYPE/i.test(text) || /<!ENTITY/i.test(text)) return 'SVG files with DOCTYPE or ENTITY declarations are not accepted';
  if (/<script[\s>]/i.test(text)) return 'SVG files containing scripts are not accepted';
  if (/<foreignObject[\s>]/i.test(text)) return 'SVG files containing foreignObject are not accepted';
  if (/<\?xml-stylesheet/i.test(text)) return 'SVG files referencing stylesheets are not accepted';
  // href / xlink:href / src / url(...) may only point inside the file (#id) or to inline raster data
  const refs = [...text.matchAll(/(?:href|src)\s*=\s*["']\s*([^"']*)["']/gi), ...text.matchAll(/url\(\s*["']?\s*([^"')]*)/gi)];
  for (const [, ref] of refs) {
    const r = ref.trim().toLowerCase();
    if (r.startsWith('#') || /^data:image\/(png|jpe?g|webp|gif);/.test(r)) continue;
    return 'SVG files must not reference external resources';
  }
  if (/@import/i.test(text)) return 'SVG files must not reference external resources';
  return null;
}

/**
 * Validate and re-encode an uploaded image (PNG, or JPEG for the hero banner).
 * @param {{ originalname: string, buffer: Buffer, size?: number }} file
 * @param {'light'|'dark'|'favicon'|'hero'} variant
 * @returns {Promise<{ buffer: Buffer, width: number, height: number }>}
 */
async function processBrandImage(file, variant) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) throw new BrandAssetError('No image uploaded');
  if (file.buffer.length > maxBytesFor(variant)) throw new BrandAssetError(`Image must be ${maxBytesFor(variant) / (1024 * 1024)} MB or smaller`);
  const metaError = checkUploadMetadata(file, Object.keys(BRAND_IMAGE_TYPES), BRAND_IMAGE_TYPES);
  if (metaError) throw new BrandAssetError(`${metaError}. Use PNG, JPG, WebP or SVG.`);
  if (!contentMatchesExtension(file, BRAND_IMAGE_TYPES)) throw new BrandAssetError('File content does not match its file type');

  const isSvg = extOf(file.originalname) === '.svg';
  if (isSvg) {
    const reason = svgRejectionReason(file.buffer);
    if (reason) throw new BrandAssetError(reason);
  }

  const size = VARIANT_SIZE[variant];
  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 40_000_000, // decompression-bomb guard
      density: isSvg ? 288 : undefined, // rasterise vectors crisply
      failOn: 'error',
    });
    const meta = await image.metadata();
    const expected = isSvg ? 'svg' : { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' }[extOf(file.originalname)];
    if (meta.format !== expected) throw new BrandAssetError('File content does not match its file type');
    if ((meta.pages || 1) > 1) throw new BrandAssetError('Animated images are not supported');

    const resized = image
      .rotate()
      .resize({
        width: size.width,
        height: size.height,
        fit: size.fit,
        withoutEnlargement: variant !== 'favicon',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    const encoded = outputExt(variant) === 'jpg'
      ? resized.flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true })
      : resized.png({ compressionLevel: 9, adaptiveFiltering: true });
    const out = await encoded.toBuffer({ resolveWithObject: true });
    return { buffer: out.data, width: out.info.width, height: out.info.height };
  } catch (err) {
    if (err instanceof BrandAssetError) throw err;
    throw new BrandAssetError('The image could not be read. Upload a valid PNG, JPG, WebP or SVG file.');
  }
}

const s3Configured = () => Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
/** S3 configured but unusable (bad/foreign keys, missing bucket, offline): fall back to local disk. */
const isS3CredentialError = (err) =>
  !s3Configured() || /credential|not valid|does not exist in our records|InvalidAccessKeyId|SignatureDoesNotMatch|AccessDenied|NoSuchBucket|ENOTFOUND|EAI_AGAIN/i.test(err?.message || '');

function saveLocal(buffer, universityId, variant) {
  const dir = path.join(LOCAL_ROOT, 'branding', universityId);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${variant}.${outputExt(variant)}`;
  fs.writeFileSync(path.join(dir, name), buffer);
  return `branding/${universityId}/${name}`;
}

/** Store a processed image; returns its storage key. */
async function storeBrandImage(buffer, universityId, variant) {
  if (s3Configured()) {
    try {
      const ext = outputExt(variant);
      const result = await uploadToS3(buffer, 'branding', universityId, `${variant}.${ext}`, ext === 'jpg' ? 'image/jpeg' : 'image/png');
      return result.key;
    } catch (err) {
      if (!isS3CredentialError(err)) throw err;
      log.warn(`S3 unavailable for branding upload, using local storage: ${err.message}`);
    }
  }
  return saveLocal(buffer, universityId, variant);
}

/** True when the key is a branding image of this university (defence in depth for reads/deletes). */
function keyBelongsTo(key, universityId) {
  return typeof key === 'string' && KEY_RE.test(key) && key.startsWith(`branding/${universityId}/`);
}

/** Best-effort removal of a replaced/cleared image. */
async function deleteBrandImage(key, universityId) {
  if (!keyBelongsTo(key, universityId)) return;
  const local = resolveLocalFile(key.split('/'));
  if (local) {
    try { fs.unlinkSync(local); } catch (_) { /* already gone */ }
    return;
  }
  if (s3Configured()) {
    try { await deleteFromS3(key); } catch (err) { log.warn(`Could not delete old brand image ${key}: ${err.message}`); }
  }
}

/**
 * Stream a stored brand image. Only PNG/JPEG files written by storeBrandImage are served,
 * with the matching image type, nosniff and a sandbox CSP.
 * @param {import('express').Response} res
 * @param {string} key
 * @param {string} universityId
 * @param {{ versioned?: boolean }} [opts] versioned URLs (?v=) may be cached for a day
 */
async function sendBrandImage(res, key, universityId, { versioned = false } = {}) {
  if (!keyBelongsTo(key, universityId)) return res.status(404).json({ success: false, message: 'Logo not found' });
  const fileName = path.basename(key);
  const contentType = /\.jpg$/i.test(key) ? 'image/jpeg' : 'image/png';
  const applyHeaders = () => {
    setSafeFileHeaders(res, fileName);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', versioned ? 'public, max-age=86400' : 'public, max-age=300');
  };
  const local = resolveLocalFile(key.split('/'));
  if (local) {
    applyHeaders();
    return res.sendFile(local, { dotfiles: 'deny', headers: { 'Content-Type': contentType } });
  }
  if (s3Configured()) {
    try {
      const result = await downloadFromS3(key);
      applyHeaders();
      if (result.contentLength) res.setHeader('Content-Length', result.contentLength);
      return result.stream.pipe(res);
    } catch (_) {
      // fall through
    }
  }
  return res.status(404).json({ success: false, message: 'Logo not found' });
}

module.exports = {
  MAX_BRAND_IMAGE_BYTES,
  MAX_HERO_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  BrandAssetError,
  brandImageFileFilter,
  svgRejectionReason,
  processBrandImage,
  storeBrandImage,
  deleteBrandImage,
  sendBrandImage,
  keyBelongsTo,
};
