/**
 * Affiliation Service
 * ====================
 * Bridges the tenant's University record (managed by Super Admin) with the
 * affiliation engine, exposing the generated variant list + a suggested
 * display affiliation string for a given user.
 */
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const { generateAffiliationVariants, canonTokens } = require('../../../shared/utils/affiliationEngine');

const GENERIC = new Set([
  'university', 'institute', 'college', 'school', 'academy', 'campus', 'faculty', 'department', 'tech',
  'engineering', 'science', 'medical', 'research', 'management', 'pharmacy', 'dental', 'unknown',
  'india', 'computer', 'centre', 'hospital', 'lab', 'laboratory', 'division',
]);
const INSTITUTION_TYPES = new Set(['university', 'institute', 'college', 'academy', 'polytechnic', 'hospital']);

const CACHE_TTL_SECONDS = 300; // Affiliation config rarely changes; safe to cache 5 min.

// v2: variant generation changed (no bare locations/acronym codes) and the payload
// now carries locations/country/scopusAffiliationIds.
function cacheKey(universityId) {
  return `affiliation:variants:v2:${universityId || 'global'}`;
}

async function invalidateUniversityAffiliationCache(universityId) {
  await cache.del(cacheKey(universityId));
}

/**
 * Load the University row and derive its canonical name + full variant list
 * (auto-generated ∪ admin-curated aliases).
 * @param {string} universityId
 * @returns {Promise<{ canonicalName: string, code: string|null, variants: string[], aliases: string[],
 *   locations: string[], country: string|null, scopusAffiliationIds: string[] }>}
 */
async function getUniversityAffiliationVariants(universityId) {
  const empty = { canonicalName: 'University', code: null, variants: [], aliases: [], locations: [], country: null, scopusAffiliationIds: [] };
  if (!universityId) {
    return empty;
  }

  const CACHE_KEY = cacheKey(universityId);
  const cached = await cache.get(CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const [university, schools] = await Promise.all([
    prisma.university.findUnique({
      where: { id: universityId },
      select: {
        name: true,
        code: true,
        city: true,
        state: true,
        country: true,
        affiliationAliases: true,
        scopusAffiliationIds: true,
      },
    }),
    prisma.facultySchoolList.findMany({
      where: { universityId, isActive: true },
      select: { facultyName: true, shortName: true }
    })
  ]);

  if (!university) {
    return empty;
  }

  const aliases = Array.isArray(university.affiliationAliases) ? university.affiliationAliases : [];
  
  const schoolNames = [];
  if (schools) {
    schools.forEach((s) => {
      if (s.facultyName) schoolNames.push(s.facultyName);
      if (s.shortName) schoolNames.push(s.shortName);
    });
  }

  const variants = generateAffiliationVariants({
    name: university.name,
    code: university.code,
    city: university.city,
    state: university.state,
    extraAliases: aliases,
    schools: schoolNames,
  });

  const result = {
    canonicalName: university.name,
    code: university.code,
    variants,
    aliases,
    locations: [university.city, university.state].filter(Boolean),
    country: university.country || null,
    scopusAffiliationIds: (university.scopusAffiliationIds || []).map((id) => String(id).trim()).filter(Boolean),
  };

  await cache.set(CACHE_KEY, JSON.stringify(result), CACHE_TTL_SECONDS);
  return result;
}

/**
 * Build a suggested "display affiliation" string for a specific user, e.g.
 * "School of Computer Science, SGT University" — combining their primary
 * school (if any) with the tenant's canonical university name. If the user
 * has saved a manual override in UserSettings, that takes precedence for the
 * "current" affiliation while `suggested` always reflects the auto-generated
 * value (so the UI can offer "reset to suggested").
 * @param {string} userId
 * @returns {Promise<{ current: string, suggested: string, canonicalName: string, variants: string[], aliases: string[], hasOverride: boolean }>}
 */
async function suggestAffiliationForUser(userId) {
  const [user, settings] = await Promise.all([
    prisma.userLogin.findUnique({
      where: { id: userId },
      select: {
        universityId: true,
        employeeDetails: {
          select: {
            primarySchool: { select: { facultyName: true } },
          },
        },
      },
    }),
    prisma.userSettings.findUnique({
      where: { userId },
      select: { affiliationOverride: true },
    }),
  ]);

  const { canonicalName, variants, aliases } = await getUniversityAffiliationVariants(user?.universityId);
  const schoolName = user?.employeeDetails?.primarySchool?.facultyName;

  const suggested = schoolName ? `${schoolName}, ${canonicalName}` : canonicalName;
  const override = settings?.affiliationOverride || null;

  return {
    current: override || suggested,
    suggested,
    canonicalName,
    variants,
    aliases,
    hasOverride: Boolean(override),
  };
}

/**
 * A user's own affiliation strings (Settings override + research-identity aliases),
 * kept only when they name an institution: city/state/country-only or generic
 * strings ("Gurugram", "University") are dropped. These widen the match for the
 * user's OWN author entry during sync; co-authors are judged on the university's
 * variants alone.
 * @param {{ affiliationOverride?: string|null, identityAliases?: any, locations?: string[] }} input
 * @returns {string[]}
 */
function personalAffiliationAliases({ affiliationOverride = null, identityAliases = [], locations = [] } = {}) {
  const locationTokens = new Set(locations.flatMap((l) => canonTokens(l)));
  const raw = [affiliationOverride, ...(Array.isArray(identityAliases) ? identityAliases : [])];
  const out = [];
  for (const alias of raw) {
    const text = typeof alias === 'string' ? alias.trim() : '';
    if (!text || text.length > 256) continue;
    // An override like "School of CS, SGT University" holds several parts: keep each.
    for (const part of text.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
      const tokens = canonTokens(part);
      const identity = tokens.filter((t) => !locationTokens.has(t) && !GENERIC.has(t));
      if (identity.length === 0) continue; // location-only / generic
      if (tokens.length === 1) {
        if (tokens[0].length >= 3 && tokens[0].length <= 8) out.push(part); // acronym
        continue;
      }
      // Multi-word: must name an institution ("SGT Medical College"), not a sub-unit ("School of CS").
      if (!tokens.some((t) => INSTITUTION_TYPES.has(t))) continue;
      out.push(part);
    }
  }
  return Array.from(new Set(out));
}

module.exports = {
  getUniversityAffiliationVariants,
  personalAffiliationAliases,
  suggestAffiliationForUser,
  invalidateUniversityAffiliationCache,
};
