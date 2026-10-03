/**
 * Input validation for university branding.
 *
 * Text fields are trimmed, stripped of control characters and length-limited; an empty
 * string clears the field (stored as null). Colours must be #RRGGBB. Unknown keys are
 * rejected so a client cannot write other University columns through this endpoint.
 */
const { z } = require('zod');
const { THEME_PRESET_KEYS } = require('../constants/themePresets');

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
// C0/C1 control characters (keeps normal whitespace: tab/newline are collapsed below)
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

const cleanText = (max, label) =>
  z
    .union([z.string(), z.null()])
    .transform((v) => (v === null ? null : v.replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim()))
    .refine((v) => v === null || v.length <= max, { message: `${label} must be at most ${max} characters` })
    .transform((v) => (v ? v : null));

const hexColor = (label) =>
  z
    .union([z.string(), z.null()])
    .transform((v) => (v === null ? null : v.trim()))
    .refine((v) => v === null || v === '' || HEX_RE.test(v), { message: `${label} must be a hex colour like #1D4ED8` })
    .transform((v) => (v ? v.toUpperCase() : null));

const brandingUpdateSchema = z
  .object({
    displayName: cleanText(256, 'Display name'),
    shortName: cleanText(32, 'Short name'),
    tagline: cleanText(160, 'Tagline'),
    heroHeading: cleanText(120, 'Dashboard heading'),
    heroSubheading: cleanText(280, 'Dashboard subheading'),
    themePreset: z.enum(THEME_PRESET_KEYS, { message: `Theme must be one of: ${THEME_PRESET_KEYS.join(', ')}` }),
    primaryColor: hexColor('Primary colour'),
    accentColor: hexColor('Accent colour'),
  })
  .partial()
  .strict();

/**
 * @param {unknown} body
 * @returns {{ ok: true, data: Record<string, unknown> } | { ok: false, errors: string[] }}
 */
function parseBrandingUpdate(body) {
  const result = brandingUpdateSchema.safeParse(body ?? {});
  if (result.success) return { ok: true, data: result.data };
  const errors = result.error.issues.map((i) => {
    if (i.code === 'unrecognized_keys') return `Unknown field(s): ${i.keys.join(', ')}`;
    const field = i.path.join('.');
    return field && !i.message.toLowerCase().includes(field.toLowerCase()) && i.code !== 'custom'
      ? `${field}: ${i.message}`
      : i.message;
  });
  return { ok: false, errors };
}

const ASSET_VARIANTS = Object.freeze(['light', 'dark', 'favicon']);

module.exports = { parseBrandingUpdate, brandingUpdateSchema, HEX_RE, ASSET_VARIANTS };
