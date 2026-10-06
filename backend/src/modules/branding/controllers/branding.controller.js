/**
 * HTTP handlers for university branding. The same editor handlers serve the superadmin
 * (university chosen by :id) and the tenant admin (always their own university); only the
 * `resolveUniversityId` function differs, so a tenant admin can never address another id.
 */
const multer = require('multer');
const prisma = require('../../../shared/config/database');
const { isUuid } = require('../../../shared/utils/uuidParam');
const service = require('../services/branding.service');
const assets = require('../services/brandAsset.service');
const { createModuleLogger } = require('../../../shared/utils/logger');

const log = createModuleLogger('branding');

const sendError = (res, err) => {
  if (err instanceof service.BrandingError || err instanceof assets.BrandAssetError) {
    return res.status(err.statusCode || 400).json({ success: false, message: err.message, errors: err.details });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (logos up to 1 MB, banner image up to 4 MB)' : 'Upload one image in the "file" field';
    return res.status(400).json({ success: false, message });
  }
  log.error('Branding request failed', { message: err?.message, stack: err?.stack });
  return res.status(500).json({ success: false, message: 'Branding request failed' });
};

/**
 * multer for one brand image, in memory (wrapped in bindMiddleware by the routes). The cap is the
 * largest variant's (banner, 4 MB); processBrandImage re-checks each variant's own limit.
 */
const brandImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: assets.MAX_UPLOAD_BYTES, files: 1, fields: 5 },
  fileFilter: assets.brandImageFileFilter,
}).single('file');

/** Run the upload middleware and turn its errors into 400 responses. */
const handleUpload = (bound) => (req, res, next) => bound(req, res, (err) => (err ? sendError(res, err) : next()));

/**
 * Build editor handlers around a university resolver.
 * @param {(req: import('express').Request) => string|null} resolveUniversityId
 */
function editorHandlers(resolveUniversityId) {
  const withUniversity = (fn) => async (req, res) => {
    const universityId = resolveUniversityId(req);
    if (!universityId) return res.status(404).json({ success: false, message: 'University not found' });
    try {
      const result = await fn(universityId, req);
      return res.json({ success: true, data: result });
    } catch (err) {
      return sendError(res, err);
    }
  };
  const ctx = (req) => ({ actor: req.user, req });
  return {
    get: withUniversity((id) => service.getBranding(id)),
    update: withUniversity((id, req) => service.updateBranding(id, req.body, ctx(req))),
    reset: withUniversity((id, req) => service.resetBranding(id, ctx(req))),
    upload: withUniversity((id, req) => service.uploadBrandAsset(id, req.params.variant, req.file, ctx(req))),
    remove: withUniversity((id, req) => service.removeBrandAsset(id, req.params.variant, ctx(req))),
  };
}

/** Superadmin: the university in the URL (routes run unscoped as system). */
const superadminEditor = editorHandlers((req) => (isUuid(req.params.id) ? req.params.id : null));

/** Tenant admin: always the caller's own university; no way to name another one. */
const tenantAdminEditor = editorHandlers((req) => (req.user?.role === 'superadmin' ? null : req.tenantId || null));

/**
 * GET /branding/me — branding of the signed-in user's university. A superadmin without a
 * selected tenant gets `null` (the platform keeps the default ResearchSphere theme).
 */
async function getMyBranding(req, res) {
  try {
    if (!req.tenantId) return res.json({ success: true, data: null });
    const { branding } = await service.getBranding(req.tenantId);
    res.setHeader('Cache-Control', 'private, no-cache');
    return res.json({ success: true, data: branding });
  } catch (err) {
    return sendError(res, err);
  }
}

/** GET /branding/me/logo/:variant — the caller's university logo (tenant-scoped). */
async function getMyLogo(req, res) {
  try {
    if (!req.tenantId) return res.status(404).json({ success: false, message: 'Logo not found' });
    // Runs inside protect's tenant context: the extension confines this to the caller's row.
    const uni = await prisma.university.findUnique({ where: { id: req.tenantId }, select: service.BRANDING_SELECT });
    const key = uni && uni[service.ASSET_FIELD[req.params.variant]];
    if (!key) return res.status(404).json({ success: false, message: 'Logo not found' });
    return assets.sendBrandImage(res, key, req.tenantId, { versioned: Boolean(req.query.v) });
  } catch (err) {
    return sendError(res, err);
  }
}

/** GET /public/branding/:slug — branding for public pages (profile, slug-addressed pages). */
async function getPublicBranding(req, res) {
  try {
    const uni = await service.getPublicBrandingBySlug(req.params.slug);
    if (!uni) return res.status(404).json({ success: false, message: 'University not found' });
    const { universityId: _id, ...dto } = service.toBrandingDto(uni);
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.json({ success: true, data: dto });
  } catch (err) {
    return sendError(res, err);
  }
}

/** GET /public/branding/:slug/logo/:variant — the image itself (PNG, re-encoded on upload). */
async function getPublicLogo(req, res) {
  try {
    const field = service.ASSET_FIELD[req.params.variant];
    const uni = field ? await service.getPublicBrandingBySlug(req.params.slug) : null;
    if (!uni || !uni[field]) return res.status(404).json({ success: false, message: 'Logo not found' });
    return assets.sendBrandImage(res, uni[field], uni.id, { versioned: Boolean(req.query.v) });
  } catch (err) {
    return sendError(res, err);
  }
}

module.exports = {
  brandImageUpload,
  handleUpload,
  superadminEditor,
  tenantAdminEditor,
  getMyBranding,
  getMyLogo,
  getPublicBranding,
  getPublicLogo,
};
