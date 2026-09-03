/**
 * Affiliation Engine
 * ===================
 * Dependency-free, tenant-agnostic algorithm that derives a comprehensive set
 * of plausible "affiliation name variants" from whatever university name a
 * Super Admin configures (e.g. "SGT University", "Delhi Technological
 * University", "Shree Guru Gobind Singh Tricentenary University").
 *
 * These variants are used to:
 *   1. Suggest/auto-fill the "Affiliation" field shown to users in Settings.
 *   2. Recognise whether an author's affiliation string (as scraped from
 *      Scopus/OpenAlex/ORCID/etc.) belongs to "this" university, replacing the
 *      old hardcoded SGT-only allow-list in publicationSync.service.js.
 *
 * The generation strategy purposefully over-generates (favouring recall) since
 * the consumer always does substring-containment matching, not exact match.
 */

// Words that should never anchor an acronym or a "meaningful" comparison —
// they carry no distinguishing information about the institution's identity.
const STOP_WORDS = new Set([
  'of', 'the', 'and', '&', 'at', 'in', 'for', 'a', 'an', 'to',
]);

// Institutional "qualifier" words that authors frequently omit or abbreviate
// when self-reporting affiliation (e.g. "SGT" instead of "SGT University").
const QUALIFIER_WORDS = [
  'university', 'institute', 'college', 'school', 'academy',
  'institution', 'polytechnic', 'campus',
];

// Common abbreviation expansions/reductions to enhance matching recall
const ABBREVIATION_MAP = {
  university: ['univ', 'univ.'],
  technology: ['tech', 'tech.'],
  technological: ['tech', 'tech.'],
  institute: ['inst', 'inst.'],
  institution: ['inst', 'inst.'],
  engineering: ['engg', 'eng', 'engg.', 'eng.'],
  science: ['sci', 'sci.'],
  sciences: ['sci', 'sci.'],
  management: ['mgmt', 'mgmt.'],
  medical: ['med', 'med.'],
  dental: ['dent', 'dent.'],
  agricultural: ['agri', 'agri.'],
  national: ['natl', 'natl.'],
  international: ['intl', 'intl.'],
  academy: ['acad', 'acad.'],
  research: ['res', 'res.'],
  pharmacy: ['pharm', 'pharm.'],
  pharmaceutical: ['pharm', 'pharm.'],
  computer: ['comp', 'comp.'],
  information: ['info', 'info.'],
  hospital: ['hosp', 'hosp.'],
  nursing: ['nurs']
};

// Common legal-status suffixes appended to Indian university names that add
// no identity value for matching purposes.
const LEGAL_SUFFIX_PATTERNS = [
  /\(deemed to be university\)/gi,
  /\(deemed university\)/gi,
  /\(a deemed to be university\)/gi,
  /deemed to be university/gi,
  /\(autonomous\)/gi,
  /\(state university\)/gi,
  /\(central university\)/gi,
  /\(private university\)/gi,
];

function normalize(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLegalSuffixes(value) {
  let result = String(value || '');
  LEGAL_SUFFIX_PATTERNS.forEach((pattern) => {
    result = result.replace(pattern, ' ');
  });
  return result.replace(/\s+/g, ' ').trim();
}

function tokenize(normalized) {
  return normalized.split(/[\s,]+/).filter(Boolean);
}

function isQualifierToken(token) {
  return QUALIFIER_WORDS.includes(token);
}

/**
 * Build acronyms from significant (non-stop-word) tokens.
 * Generates both the "full" acronym (all significant words) and a
 * "core" acronym that drops trailing qualifier words (University/Institute/…)
 * since that's how most short-form acronyms are actually formed
 * (e.g. "SGT University" -> "SGTU" and "SGT").
 */
function buildAcronyms(tokens) {
  const significant = tokens.filter((t) => !STOP_WORDS.has(t));
  if (significant.length === 0) return [];

  const acronyms = new Set();

  const fullInitials = significant.map((t) => t[0]).join('');
  if (fullInitials.length >= 2) acronyms.add(fullInitials);

  const coreTokens = [];
  for (const t of significant) {
    if (isQualifierToken(t) && coreTokens.length > 0) break;
    coreTokens.push(t);
  }
  const coreInitials = coreTokens.map((t) => t[0]).join('');
  if (coreInitials.length >= 2) acronyms.add(coreInitials);

  // If the name already starts with a short all-caps-looking token cluster
  // (e.g. "SGT" in "SGT University"), treat that leading run of short tokens
  // joined together as an acronym-like variant too.
  const leadingShortTokens = [];
  for (const t of significant) {
    if (t.length <= 5 && !isQualifierToken(t)) {
      leadingShortTokens.push(t);
    } else {
      break;
    }
  }
  if (leadingShortTokens.length > 0) {
    acronyms.add(leadingShortTokens.join(''));
  }

  return Array.from(acronyms).filter((a) => a.length >= 2);
}

/**
 * Systematically drop leading articles and trailing qualifier words to
 * produce the set of "word-drop" variants authors commonly use.
 * e.g. "SGT University" -> ["sgt university", "sgt"]
 * e.g. "The Delhi Technological University" -> [
 *   "the delhi technological university", "delhi technological university", "delhi technological"
 * ]
 */
function buildWordDropVariants(tokens) {
  let working = tokens.slice();
  const variants = new Set();

  // Strip leading articles ("the", "a", "an").
  while (working.length > 1 && STOP_WORDS.has(working[0])) {
    working = working.slice(1);
  }
  if (working.length === 0) return [];

  variants.add(working.join(' '));

  // Progressively strip trailing qualifier words, one at a time, so
  // "guru gobind singh tricentenary university" also yields
  // "guru gobind singh tricentenary".
  let trimmed = working.slice();
  while (trimmed.length > 1 && isQualifierToken(trimmed[trimmed.length - 1])) {
    trimmed = trimmed.slice(0, -1);
    variants.add(trimmed.join(' '));
  }

  return Array.from(variants);
}

/**
 * Generate "<name> <city>" / "<name>, <city>" / "<name> <state>" combinations
 * for every base-name variant, since scraped affiliation strings frequently
 * include the campus location.
 */
function buildLocationVariants(baseVariants, city, state) {
  const locations = [city, state].map((v) => normalize(v)).filter(Boolean);
  if (locations.length === 0) return [];

  const variants = new Set();
  baseVariants.forEach((base) => {
    locations.forEach((loc) => {
      variants.add(`${base} ${loc}`);
      variants.add(`${base}, ${loc}`);
    });
  });
  return Array.from(variants);
}

/**
 * Generate dotted versions of acronyms (e.g. "sgt" -> "s.g.t", "s.g.t.")
 */
function buildDottedAcronyms(acronyms) {
  const dotted = new Set();
  acronyms.forEach((acronym) => {
    if (/^[a-z]+$/i.test(acronym) && acronym.length >= 2) {
      const chars = acronym.split('');
      const dottedStr = chars.join('.');
      dotted.add(dottedStr);
      dotted.add(dottedStr + '.');
    }
  });
  return Array.from(dotted);
}

/**
 * Extract contiguous sub-phrases of significant tokens for multi-word university names
 */
function buildSubphraseVariants(tokens) {
  const significant = tokens.filter((t) => !STOP_WORDS.has(t) && !isQualifierToken(t));
  if (significant.length < 3) return [];

  const subphrases = new Set();
  // Generate combinations of 3 or more consecutive significant words
  for (let len = 3; len <= significant.length; len++) {
    for (let i = 0; i <= significant.length - len; i++) {
      const slice = significant.slice(i, i + len);
      subphrases.add(slice.join(' '));
    }
  }
  return Array.from(subphrases);
}

/**
 * Generate variants with common abbreviations substituted
 */
function buildAbbreviationVariants(baseVariants) {
  const result = new Set();

  baseVariants.forEach((variant) => {
    const words = variant.split(/\s+/);
    
    // We'll generate combinations of abbreviated words.
    // To keep it simple and efficient, we construct possible token options for each position.
    const options = words.map((word) => {
      const opts = [word];
      const normalizedWord = word.replace(/[.,]/g, '');
      if (ABBREVIATION_MAP[normalizedWord]) {
        opts.push(...ABBREVIATION_MAP[normalizedWord]);
      }
      return opts;
    });

    // Helper to cartesian-product options
    function cartesianProduct(index, currentPhrase) {
      if (index === options.length) {
        result.add(currentPhrase.join(' '));
        return;
      }
      for (const opt of options[index]) {
        cartesianProduct(index + 1, [...currentPhrase, opt]);
      }
    }

    cartesianProduct(0, []);
  });

  return Array.from(result);
}

/**
 * Core entry point: given a university's identifying details, generate a
 * de-duplicated, lowercase array of affiliation-string variants that should
 * all be treated as referring to "this" institution.
 *
 * @param {Object} params
 * @param {string} params.name - Primary/display name, e.g. "SGT University".
 * @param {string} [params.code] - Short internal tenant code, e.g. "SGT".
 * @param {string} [params.legalName] - Full legal/registered name, if different from `name`.
 * @param {string} [params.city]
 * @param {string} [params.state]
 * @param {string[]} [params.extraAliases] - Admin-curated manual overrides (union'd in as-is).
 * @returns {string[]} Deduplicated, normalized (lowercase) variant strings.
 */
function generateAffiliationVariants({
  name,
  code,
  legalName,
  city,
  state,
  extraAliases = [],
  schools = [],
} = {}) {
  const variantSet = new Set();
  const acronyms = new Set();
  const baseVariants = new Set();

  const namesToProcess = [name, legalName].filter(Boolean);

  namesToProcess.forEach((rawName) => {
    const cleaned = stripLegalSuffixes(rawName);
    const normalized = normalize(cleaned);
    if (!normalized) return;

    const tokens = tokenize(normalized);
    const wordDropVariants = buildWordDropVariants(tokens);
    const subphrases = buildSubphraseVariants(tokens);

    wordDropVariants.forEach((v) => {
      variantSet.add(v);
      baseVariants.add(v);
    });

    subphrases.forEach((v) => {
      variantSet.add(v);
      baseVariants.add(v);
    });

    buildAcronyms(tokens).forEach((a) => {
      variantSet.add(a);
      acronyms.add(a);
    });

    const locations = buildLocationVariants(wordDropVariants, city, state);
    locations.forEach((v) => {
      variantSet.add(v);
      baseVariants.add(v);
    });
  });

  if (Array.isArray(schools) && schools.length > 0) {
    schools.forEach((school) => {
      const normalizedSchool = normalize(school);
      if (!normalizedSchool) return;

      baseVariants.forEach((base) => {
        variantSet.add(`${normalizedSchool} ${base}`);
        variantSet.add(`${base} ${normalizedSchool}`);
        variantSet.add(`${normalizedSchool}, ${base}`);
        variantSet.add(`${base}, ${normalizedSchool}`);
      });
    });
  }

  if (code) {
    const normalizedCode = normalize(code);
    if (normalizedCode) {
      variantSet.add(normalizedCode);
      acronyms.add(normalizedCode);
    }
  }

  // Generate abbreviation variations for all base word-based variants
  const abbrVariants = buildAbbreviationVariants(Array.from(baseVariants));
  abbrVariants.forEach((v) => variantSet.add(v));

  // Generate dotted variants for all acronyms (e.g. "sgt" -> "s.g.t", "s.g.t.")
  const dottedAcronyms = buildDottedAcronyms(Array.from(acronyms));
  dottedAcronyms.forEach((a) => variantSet.add(a));

  (Array.isArray(extraAliases) ? extraAliases : [])
    .map((alias) => normalize(alias))
    .filter(Boolean)
    .forEach((alias) => variantSet.add(alias));

  // Drop variants that are too short/generic to be useful signals (e.g. a
  // single 1-2 letter leftover from aggressive word-dropping) to avoid false
  // positives, but always keep deliberately-short acronyms/codes.
  return Array.from(variantSet).filter((v) => v.length >= 2);
}

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return dp[m][n];
}

function getSimilarity(s1, s2) {
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
}

/**
 * Bidirectional substring-containment match: returns true if `value`
 * "looks like" it refers to the same institution as any of `variants`.
 * Mirrors the legacy `_isSgtAffiliation` behaviour but is now driven by the
 * dynamically generated variant list instead of a hardcoded array.
 *
 * @param {string} value - Raw affiliation string to test (e.g. from Scopus).
 * @param {string[]} variants - Output of generateAffiliationVariants().
 * @returns {boolean}
 */
function isAffiliationMatch(value, variants) {
  const normalizedValue = normalize(value);
  if (!normalizedValue || !Array.isArray(variants) || variants.length === 0) return false;

  // Bare institutional words must never reverse-match (e.g. "university"
  // must not match variant "sgt university").
  const genericTokens = new Set(QUALIFIER_WORDS);
  if (genericTokens.has(normalizedValue)) return false;

  return variants.some((variant) => {
    if (!variant || genericTokens.has(variant)) return false;
    if (normalizedValue.includes(variant)) return true;
    // Reverse containment only for specific-enough affiliation strings
    if (normalizedValue.length >= 4 && variant.includes(normalizedValue)) return true;
    
    // Fuzzy matching for longer strings to catch typos/OCR errors
    if (normalizedValue.length >= 6 && variant.length >= 6) {
      if (getSimilarity(normalizedValue, variant) >= 0.85) return true;
    }
    
    return normalizedValue === variant;
  });
}

module.exports = {
  generateAffiliationVariants,
  isAffiliationMatch,
  // Exported for unit testing / reuse by other normalization needs.
  normalize,
};
