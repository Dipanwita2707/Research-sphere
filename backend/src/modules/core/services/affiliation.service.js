/**
 * Affiliation Service
 * ====================
 * Bridges the tenant's University record (managed by Super Admin) with the
 * affiliation engine, exposing the generated variant list + a suggested
 * display affiliation string for a given user.
 */
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const { generateAffiliationVariants } = require('../../../shared/utils/affiliationEngine');

const CACHE_TTL_SECONDS = 300; // Affiliation config rarely changes; safe to cache 5 min.

function cacheKey(universityId) {
  return `affiliation:variants:${universityId || 'global'}`;
}

async function invalidateUniversityAffiliationCache(universityId) {
  await cache.del(cacheKey(universityId));
}

/**
 * Load the University row and derive its canonical name + full variant list
 * (auto-generated ∪ admin-curated aliases).
 * @param {string} universityId
 * @returns {Promise<{ canonicalName: string, code: string|null, variants: string[], aliases: string[] }>}
 */
async function getUniversityAffiliationVariants(universityId) {
  if (!universityId) {
    return { canonicalName: 'University', code: null, variants: [], aliases: [] };
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
        affiliationAliases: true,
      },
    }),
    prisma.facultySchoolList.findMany({
      where: { universityId, isActive: true },
      select: { facultyName: true, shortName: true }
    })
  ]);

  if (!university) {
    return { canonicalName: 'University', code: null, variants: [], aliases: [] };
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

module.exports = {
  getUniversityAffiliationVariants,
  suggestAffiliationForUser,
  invalidateUniversityAffiliationCache,
};
