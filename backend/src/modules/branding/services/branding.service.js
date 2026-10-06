/**
 * University branding: name, logos, theme preset and colours, dashboard hero text.
 *
 * All reads and writes take an explicit universityId. Callers decide whose branding that
 * is: a tenant user/admin always passes their own tenant (req.tenantId, set by `protect`),
 * the superadmin passes the :id of the university being edited, public routes resolve
 * an active university by slug. The Prisma tenant extension additionally confines a
 * tenant request to its own University row, so a foreign id behaves like a missing one.
 */
const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { auditService, AuditActionType, AuditModule, AuditSeverity } = require('../../audit/services/audit.service');
const { DEFAULT_THEME_PRESET } = require('../constants/themePresets');
const { parseBrandingUpdate } = require('../validation/branding.validation');
const assets = require('./brandAsset.service');

const BRANDING_SELECT = Object.freeze({
  id: true,
  code: true,
  name: true,
  slug: true,
  isActive: true,
  displayName: true,
  shortName: true,
  tagline: true,
  logoUrl: true, // storage key of the light logo (see schema comment)
  logoDarkKey: true,
  faviconKey: true,
  heroImageKey: true,
  themePreset: true,
  primaryColor: true,
  accentColor: true,
  heroHeading: true,
  heroSubheading: true,
  brandingUpdatedAt: true,
});

/** Branding fields editable as plain values (asset keys change only through uploads). */
const EDITABLE_FIELDS = ['displayName', 'shortName', 'tagline', 'heroHeading', 'heroSubheading', 'themePreset', 'primaryColor', 'accentColor'];

/** DB column holding each asset variant's storage key. */
const ASSET_FIELD = Object.freeze({ light: 'logoUrl', dark: 'logoDarkKey', favicon: 'faviconKey', hero: 'heroImageKey' });

/** How an image variant is named in audit entries. */
const ASSET_LABEL = Object.freeze({ light: 'light logo', dark: 'dark logo', favicon: 'favicon', hero: 'profile banner image' });

class BrandingError extends Error {
  constructor(message, statusCode = 400, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** Short name shown in the tab title / compact header when none is set: initials of the name. */
function deriveShortName(name, code) {
  const initials = String(name || '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !/^(of|and|the|for|&)$/i.test(w))
    .map((w) => w[0].toUpperCase())
    .join('');
  return (initials.length >= 2 && initials.length <= 8 ? initials : String(code || '').toUpperCase()) || null;
}

/**
 * Shape sent to browsers. Logo URLs go through the public, slug-addressed endpoint with the
 * branding version as cache-buster, so the same URL works on public pages and after login.
 */
function toBrandingDto(uni) {
  if (!uni) return null;
  const version = uni.brandingUpdatedAt ? new Date(uni.brandingUpdatedAt).getTime() : 0;
  const assetUrl = (variant, key) => (key ? `/api/v1/public/branding/${uni.slug}/logo/${variant}?v=${version}` : null);
  const displayName = uni.displayName || uni.name;
  return {
    universityId: uni.id,
    code: uni.code,
    slug: uni.slug,
    legalName: uni.name,
    displayName,
    shortName: uni.shortName || deriveShortName(displayName, uni.code),
    shortNameIsCustom: Boolean(uni.shortName),
    tagline: uni.tagline || null,
    themePreset: uni.themePreset || DEFAULT_THEME_PRESET,
    primaryColor: uni.primaryColor || null,
    accentColor: uni.accentColor || null,
    heroHeading: uni.heroHeading || null,
    heroSubheading: uni.heroSubheading || null,
    logoUrl: assetUrl('light', uni.logoUrl),
    logoDarkUrl: assetUrl('dark', uni.logoDarkKey),
    faviconUrl: assetUrl('favicon', uni.faviconKey),
    heroImageUrl: assetUrl('hero', uni.heroImageKey),
    version,
  };
}

/** Editable values as stored (for the editor form). */
function toEditableValues(uni) {
  return {
    displayName: uni.displayName || null,
    shortName: uni.shortName || null,
    tagline: uni.tagline || null,
    heroHeading: uni.heroHeading || null,
    heroSubheading: uni.heroSubheading || null,
    themePreset: uni.themePreset || DEFAULT_THEME_PRESET,
    primaryColor: uni.primaryColor || null,
    accentColor: uni.accentColor || null,
  };
}

async function loadUniversity(universityId) {
  if (!universityId) throw new BrandingError('No university selected', 400);
  const uni = await prisma.university.findUnique({ where: { id: universityId }, select: BRANDING_SELECT });
  if (!uni) throw new BrandingError('University not found', 404);
  return uni;
}

/** Branding of one university (caller has already decided it may see it). */
async function getBranding(universityId) {
  const uni = await loadUniversity(universityId);
  return { branding: toBrandingDto(uni), values: toEditableValues(uni) };
}

/** Public branding by slug: active universities only; anything else is a 404. */
async function getPublicBrandingBySlug(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,64}$/i.test(slug)) return null;
  const uni = await tenantContext.runAsSystem(() =>
    prisma.university.findUnique({ where: { slug: slug.toLowerCase() }, select: BRANDING_SELECT }),
  );
  if (!uni || !uni.isActive) return null;
  return uni;
}

function auditBrandingChange({ actor, universityId, action, oldValues, newValues, actionType = AuditActionType.CONFIG_CHANGE, req }) {
  return auditService.log({
    actorId: actor?.id || null,
    universityId,
    action,
    actionType,
    module: AuditModule.ADMIN,
    category: 'branding',
    severity: AuditSeverity.INFO,
    targetTable: 'universities',
    targetId: universityId,
    oldValues,
    newValues,
    details: { actorRole: actor?.role || null, scope: actor?.role === 'superadmin' ? 'platform' : 'tenant' },
    ipAddress: req?.ip || null,
    userAgent: req?.headers?.['user-agent'] || null,
    requestPath: req?.originalUrl || null,
    requestMethod: req?.method || null,
  });
}

/**
 * Validate and apply a branding update. Only changed fields are written and audited.
 * @param {string} universityId
 * @param {unknown} body
 * @param {{ actor: { id: string, role: string }, req?: import('express').Request }} ctx
 */
async function updateBranding(universityId, body, { actor, req } = {}) {
  const parsed = parseBrandingUpdate(body);
  if (!parsed.ok) throw new BrandingError(parsed.errors[0], 400, parsed.errors);
  const uni = await loadUniversity(universityId);

  const changes = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in parsed.data)) continue;
    const next = parsed.data[field] ?? (field === 'themePreset' ? DEFAULT_THEME_PRESET : null);
    if ((uni[field] ?? null) !== next) changes[field] = next;
  }
  if (Object.keys(changes).length === 0) return { branding: toBrandingDto(uni), values: toEditableValues(uni), changed: [] };

  const updated = await prisma.university.update({
    where: { id: universityId },
    data: { ...changes, brandingUpdatedAt: new Date() },
    select: BRANDING_SELECT,
  });

  const oldValues = Object.fromEntries(Object.keys(changes).map((k) => [k, uni[k] ?? null]));
  await auditBrandingChange({
    actor,
    universityId,
    action: `Updated branding for ${uni.code} (${Object.keys(changes).join(', ')})`,
    oldValues,
    newValues: changes,
    req,
  });
  return { branding: toBrandingDto(updated), values: toEditableValues(updated), changed: Object.keys(changes) };
}

/** Restore the default ResearchSphere look: clears every branding field and image. */
async function resetBranding(universityId, { actor, req } = {}) {
  const uni = await loadUniversity(universityId);
  const cleared = {
    displayName: null, shortName: null, tagline: null, heroHeading: null, heroSubheading: null,
    themePreset: DEFAULT_THEME_PRESET, primaryColor: null, accentColor: null,
    logoUrl: null, logoDarkKey: null, faviconKey: null, heroImageKey: null,
  };
  const updated = await prisma.university.update({
    where: { id: universityId },
    data: { ...cleared, brandingUpdatedAt: new Date() },
    select: BRANDING_SELECT,
  });
  await Promise.all(Object.values(ASSET_FIELD).map((f) => assets.deleteBrandImage(uni[f], universityId)));
  const oldValues = Object.fromEntries(Object.keys(cleared).map((k) => [k, uni[k] ?? null]));
  await auditBrandingChange({ actor, universityId, action: `Reset branding for ${uni.code} to the default theme`, oldValues, newValues: cleared, req });
  return { branding: toBrandingDto(updated), values: toEditableValues(updated) };
}

/** Validate, re-encode and store a logo/favicon, replacing the previous one. */
async function uploadBrandAsset(universityId, variant, file, { actor, req } = {}) {
  const field = ASSET_FIELD[variant];
  if (!field) throw new BrandingError('Unknown image type. Use light, dark, favicon or hero.', 400);
  const uni = await loadUniversity(universityId);
  const processed = await assets.processBrandImage(file, variant).catch((err) => {
    throw new BrandingError(err.message, err.statusCode || 400);
  });
  const key = await assets.storeBrandImage(processed.buffer, universityId, variant);
  const updated = await prisma.university.update({
    where: { id: universityId },
    data: { [field]: key, brandingUpdatedAt: new Date() },
    select: BRANDING_SELECT,
  });
  if (uni[field] && uni[field] !== key) await assets.deleteBrandImage(uni[field], universityId);
  await auditBrandingChange({
    actor,
    universityId,
    action: `Uploaded ${ASSET_LABEL[variant]} for ${uni.code}`,
    actionType: AuditActionType.UPLOAD,
    oldValues: { [field]: uni[field] ?? null },
    newValues: { [field]: key, width: processed.width, height: processed.height, originalName: String(file.originalname || '').slice(0, 120) },
    req,
  });
  return { branding: toBrandingDto(updated), values: toEditableValues(updated) };
}

async function removeBrandAsset(universityId, variant, { actor, req } = {}) {
  const field = ASSET_FIELD[variant];
  if (!field) throw new BrandingError('Unknown image type. Use light, dark, favicon or hero.', 400);
  const uni = await loadUniversity(universityId);
  if (!uni[field]) return { branding: toBrandingDto(uni), values: toEditableValues(uni) };
  const updated = await prisma.university.update({
    where: { id: universityId },
    data: { [field]: null, brandingUpdatedAt: new Date() },
    select: BRANDING_SELECT,
  });
  await assets.deleteBrandImage(uni[field], universityId);
  await auditBrandingChange({
    actor,
    universityId,
    action: `Removed ${ASSET_LABEL[variant]} for ${uni.code}`,
    actionType: AuditActionType.DELETE,
    oldValues: { [field]: uni[field] },
    newValues: { [field]: null },
    req,
  });
  return { branding: toBrandingDto(updated), values: toEditableValues(updated) };
}

module.exports = {
  BRANDING_SELECT,
  ASSET_FIELD,
  BrandingError,
  deriveShortName,
  toBrandingDto,
  getBranding,
  getPublicBrandingBySlug,
  updateBranding,
  resetBranding,
  uploadBrandAsset,
  removeBrandAsset,
};
