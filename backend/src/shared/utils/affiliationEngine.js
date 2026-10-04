/**
 * Affiliation Engine
 * ===================
 * Dependency-free, tenant-agnostic matcher that decides whether an author's
 * affiliation string (as scraped from Scopus/OpenAlex/ORCID/etc.) belongs to
 * "this" university.
 *
 * Two halves:
 *   1. generateAffiliationVariants() derives a list of name variants from the
 *      university's configured name / aliases (shown in Settings and the
 *      superadmin preview, and cached per tenant).
 *   2. isAffiliationMatch(value, variants) compiles that list into a matcher
 *      and tests the value against it.
 *
 * Matching is precision-first:
 *   - The value is split into affiliation segments (";" / "|" / newline) and each
 *     segment into comma parts. Only a part can match, never the joined string, and
 *     a part matches only when it carries the institution's NAME — city, state or
 *     country tokens and generic words ("University", "Unknown") never match.
 *   - A name must appear as a contiguous, whole-word token run. Names whose core is a
 *     single short token ("SGT" in "SGT University") must be followed by the
 *     institution-type word ("SGT University", "S.G.T. Univ."), so "SGT College",
 *     "SGT Public School", "Sgt. Pepper" and "Sgtx" do not match.
 *   - Acronyms that include the type letter ("SGTU", "DTU") match as a whole token
 *     only when they stand alone in their part or the segment names the tenant's
 *     city/state/country; a segment naming a foreign country rejects acronym hits.
 *   - Spelling variants: Shri/Shree/Sri/Sree, Univ./University, dotted or spaced
 *     acronyms (S.G.T.), and single-token typos on long words. A whole-part fuzzy
 *     comparison (similarity >= 0.9) is used only for parts of 12+ characters.
 */

const STOP_WORDS = new Set(['of', 'the', 'and', '&', 'at', 'in', 'for', 'a', 'an', 'to', 'de', 'la']);

// Institution-type words (canonical form).
const TYPE_WORDS = new Set([
  'university', 'institute', 'college', 'school', 'academy', 'polytechnic', 'hospital', 'centre',
]);

// Words that carry no institutional identity on their own.
const GENERIC_WORDS = new Set([
  ...TYPE_WORDS, 'campus', 'faculty', 'department', 'division', 'unit', 'lab', 'laboratory',
  'tech', 'engineering', 'science', 'medical', 'management', 'research', 'pharmacy', 'dental',
  'nursing', 'applied', 'studies', 'humanities', 'arts', 'commerce', 'law', 'education',
  'national', 'international', 'state', 'central', 'private', 'deemed', 'government', 'govt',
  'unknown', 'na', 'none', 'independent', 'researcher', 'india', 'indian', 'computer', 'information',
]);

// Legacy export name kept for callers that only need the generic list.
const QUALIFIER_WORDS = ['university', 'institute', 'college', 'school', 'academy', 'institution', 'polytechnic', 'campus'];

// token -> canonical token
const CANONICAL_TOKENS = {
  univ: 'university', uni: 'university', universities: 'university', universitat: 'university', universidad: 'university',
  inst: 'institute', institution: 'institute', institutes: 'institute',
  tech: 'tech', technology: 'tech', technological: 'tech', technol: 'tech',
  coll: 'college', acad: 'academy', hosp: 'hospital', center: 'centre',
  shree: 'shri', sri: 'shri', sree: 'shri', shre: 'shri',
  dept: 'department', dep: 'department', deptt: 'department',
  engg: 'engineering', eng: 'engineering',
  sci: 'science', sciences: 'science',
  med: 'medical', mgmt: 'management', res: 'research', pharm: 'pharmacy', pharmaceutical: 'pharmacy',
  dent: 'dental', nurs: 'nursing', natl: 'national', intl: 'international',
  comp: 'computer', info: 'information', lab: 'lab', labs: 'lab', laboratories: 'laboratory',
};

// Long words that are commonly misspelt, with the edit distance tolerated.
const FUZZY_CANONICAL = [
  ['university', 2], ['institute', 1], ['technological', 2], ['technology', 1], ['department', 1],
];

const HONORIFICS = new Set(['shri']);

// Countries that, when present in a segment, make an acronym-only hit unreliable
// (e.g. "DTU, Lyngby, Denmark" is the Technical University of Denmark).
const COUNTRY_NAMES = [
  'india', 'usa', 'united states', 'united kingdom', 'uk', 'england', 'scotland', 'china', 'japan',
  'korea', 'south korea', 'germany', 'france', 'italy', 'spain', 'denmark', 'sweden', 'norway',
  'finland', 'netherlands', 'belgium', 'switzerland', 'austria', 'poland', 'russia', 'canada',
  'australia', 'new zealand', 'brazil', 'mexico', 'south africa', 'egypt', 'saudi arabia',
  'uae', 'united arab emirates', 'qatar', 'iran', 'iraq', 'turkey', 'pakistan', 'bangladesh',
  'nepal', 'sri lanka', 'malaysia', 'singapore', 'indonesia', 'thailand', 'vietnam', 'taiwan',
  'hong kong', 'portugal', 'greece', 'ireland', 'israel', 'nigeria', 'kenya', 'ethiopia',
];

// Common legal-status suffixes appended to Indian university names.
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

/**
 * Display-level normalisation (lower-case, punctuation reduced). Kept stable:
 * other modules use it for keys.
 */
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

/** Optimal-string-alignment distance (Levenshtein + adjacent transposition), three rolling rows. */
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev2 = new Array(n + 1).fill(0); // row i-2
  let prev = new Array(n + 1);           // row i-1
  let cur = new Array(n + 1);            // row i
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    const recycled = prev2;
    prev2 = prev;
    prev = cur;
    cur = recycled;
  }
  return prev[n];
}

function getSimilarity(s1, s2) {
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - editDistance(s1, s2) / maxLength;
}

const canonicalTokenMemo = new Map();
const MEMO_LIMIT = 20000;

/** Bounded memo set: cleared when full (inputs are a tenant's recurring affiliation strings). */
function memoSet(map, key, value) {
  if (map.size >= MEMO_LIMIT) map.clear();
  map.set(key, value);
  return value;
}

function canonicalToken(token) {
  const known = canonicalTokenMemo.get(token);
  if (known !== undefined) return known;
  return memoSet(canonicalTokenMemo, token, computeCanonicalToken(token));
}

function computeCanonicalToken(token) {
  if (CANONICAL_TOKENS[token]) return CANONICAL_TOKENS[token];
  if (token.length >= 7) {
    for (const [word, maxDist] of FUZZY_CANONICAL) {
      if (Math.abs(token.length - word.length) <= maxDist && editDistance(token, word) <= maxDist) {
        return CANONICAL_TOKENS[word] || word;
      }
    }
  }
  return token;
}

/**
 * Raw word tokens of a phrase: diacritics stripped, punctuation split, and runs of
 * single letters collapsed ("S.G.T." / "s g t" -> "sgt").
 */
function rawTokens(value) {
  const words = String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const out = [];
  let run = '';
  for (const w of words) {
    if (w.length === 1 && /[a-z]/.test(w)) {
      run += w;
      continue;
    }
    if (run) { out.push(run); run = ''; }
    out.push(w);
  }
  if (run) out.push(run);
  return out;
}

/** Canonical comparison tokens: stop words dropped, abbreviations/spellings unified. */
function canonTokens(value) {
  return rawTokens(stripLegalSuffixes(value))
    .filter((t) => !STOP_WORDS.has(t))
    .map(canonicalToken)
    .filter((t) => !STOP_WORDS.has(t));
}

function tokensEqual(a, b) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  const maxDist = min >= 10 ? 2 : min >= 6 ? 1 : 0;
  if (maxDist === 0 || Math.abs(a.length - b.length) > maxDist) return false;
  return editDistance(a, b) <= maxDist;
}

function findRun(haystack, needle, from = 0) {
  outer: for (let i = from; i + needle.length <= haystack.length; i++) {
    for (let k = 0; k < needle.length; k++) {
      if (!tokensEqual(haystack[i + k], needle[k])) continue outer;
    }
    return i;
  }
  return -1;
}

function hasIdentityToken(tokens) {
  return tokens.some((t) => !GENERIC_WORDS.has(t) && !HONORIFICS.has(t) && !/^\d+$/.test(t));
}

function initials(tokens) {
  return tokens.map((t) => t[0]).join('');
}

/** "SGT" in "SGT University", "SGT Demo" in "SGT Demo University": the run of short leading tokens. */
function leadingShortRun(tokens) {
  const run = [];
  for (const t of tokens) {
    if (t.length <= 5 && !TYPE_WORDS.has(t) && !GENERIC_WORDS.has(t)) run.push(t);
    else break;
  }
  return run;
}

/* ------------------------------------------------------------------------- */
/* Variant generation                                                         */
/* ------------------------------------------------------------------------- */

function titleTokensOf(rawName) {
  return rawTokens(stripLegalSuffixes(rawName)).filter((t) => !['the'].includes(t));
}

function honorificSpellings(tokens) {
  if (!tokens.length || !['shri', 'shree', 'sri', 'sree'].includes(tokens[0])) return [tokens];
  const rest = tokens.slice(1);
  return [['shri', ...rest], ['shree', ...rest], ['sri', ...rest], ['sree', ...rest], rest];
}

function univSpellings(tokens) {
  const idx = tokens.findIndex((t) => t === 'university');
  if (idx === -1) return [tokens];
  const short = tokens.slice();
  short[idx] = 'univ';
  return [tokens, short];
}

/**
 * Core entry point: given a university's identifying details, generate a
 * de-duplicated, lowercase array of affiliation-string variants that refer to
 * "this" institution. City/state only ever appear appended to a name.
 *
 * @param {Object} params
 * @param {string} params.name - Primary/display name, e.g. "SGT University".
 * @param {string} [params.code] - Tenant code; emitted only when it is the name's acronym.
 * @param {string} [params.legalName] - Full legal/registered name, if different from `name`.
 * @param {string} [params.city]
 * @param {string} [params.state]
 * @param {string[]} [params.extraAliases] - Admin-curated names (processed like the name).
 * @param {string[]} [params.schools] - School names; emitted only combined with the university name.
 * @returns {string[]}
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
  const typedBases = new Set();
  const derivedAcronyms = new Set();
  const add = (v) => {
    const clean = String(v || '').replace(/\s+/g, ' ').trim();
    if (clean.length >= 2) variantSet.add(clean);
  };

  const aliasList = (Array.isArray(extraAliases) ? extraAliases : []).filter(Boolean);
  const namesToProcess = [name, legalName, ...aliasList].filter(Boolean);

  namesToProcess.forEach((rawName) => {
    const tokens = titleTokensOf(rawName);
    if (tokens.length === 0) return;

    if (tokens.length === 1) {
      // A one-word alias is an acronym ("SGTU"); too-long single words are not.
      if (tokens[0].length >= 3 && tokens[0].length <= 8 && !GENERIC_WORDS.has(canonicalToken(tokens[0]))) {
        add(tokens[0]);
        derivedAcronyms.add(tokens[0]);
      }
      return;
    }

    const canon = tokens.filter((t) => !STOP_WORDS.has(t)).map(canonicalToken);
    if (!hasIdentityToken(canon)) return; // "Institute of Technology" alone identifies nothing

    for (const spelled of honorificSpellings(tokens)) {
      if (spelled.length === 0) continue;
      for (const v of univSpellings(spelled)) {
        add(v.join(' '));
      }
    }
    add(normalize(stripLegalSuffixes(rawName)));

    const lastCanon = canon[canon.length - 1];
    if (TYPE_WORDS.has(lastCanon)) {
      typedBases.add(tokens.join(' '));
      const core = canon.slice(0, -1);
      if (core.length > 0) {
        // Word-drop form ("guru gobind singh tricentenary"): only meaningful for long cores.
        if (core.length >= 3) add(tokens.slice(0, -1).join(' '));
        const lead = leadingShortRun(core);
        const typeInitial = lastCanon[0];
        if (core.length === 1 && lead.length === 1) {
          const acr = lead.join('');
          if (acr.length >= 2) {
            add(`${acr} ${tokens[tokens.length - 1]}`);
            derivedAcronyms.add(`${acr}${typeInitial}`);
            // Dotted / spaced spellings of the short core: "s.g.t. university".
            if (/^[a-z]{2,5}$/.test(acr)) {
              add(`${acr.split('').join('.')}. ${tokens[tokens.length - 1]}`);
            }
          }
        }
        const init = initials(core) + typeInitial;
        if (code && normalize(code).replace(/[^a-z0-9]/g, '') === init && init.length >= 3) {
          derivedAcronyms.add(init);
        }
      }
    }
  });

  if (code) {
    const normalizedCode = normalize(code).replace(/[^a-z0-9]/g, '');
    if (derivedAcronyms.has(normalizedCode)) add(normalizedCode);
  }
  derivedAcronyms.forEach((a) => {
    if (a.length >= 3) add(a);
  });

  // City/state only as qualifiers of a full typed name.
  const locations = [city, state].map((v) => normalize(v)).filter(Boolean);
  typedBases.forEach((base) => {
    locations.forEach((loc) => add(`${base}, ${loc}`));
  });

  // School names only in combination with the university's canonical name.
  const canonicalName = normalize(stripLegalSuffixes(name || legalName || ''));
  if (canonicalName && Array.isArray(schools)) {
    schools.map((s) => normalize(s)).filter((s) => s && s.length > 3).forEach((school) => {
      add(`${school}, ${canonicalName}`);
    });
  }

  return Array.from(variantSet).filter((v) => v.length >= 2);
}

/* ------------------------------------------------------------------------- */
/* Matching                                                                   */
/* ------------------------------------------------------------------------- */

const compiledCache = new WeakMap();
// Same list arriving as a new array (JSON.parse of the Redis copy, [...variants, ...aliases]).
const compiledByContent = new Map();

/**
 * Compile a variant list into name entries + acronyms.
 * @param {string[]} variants
 */
function compileAffiliationMatcher(variants) {
  if (Array.isArray(variants) && compiledCache.has(variants)) return compiledCache.get(variants);
  const contentKey = Array.isArray(variants) ? variants.join('\u0001') : '';
  const byContent = compiledByContent.get(contentKey);
  if (byContent) {
    if (Array.isArray(variants)) compiledCache.set(variants, byContent);
    return byContent;
  }

  const entriesByCore = new Map();
  const singleTokens = new Set();

  for (const variant of Array.isArray(variants) ? variants : []) {
    const tokens = canonTokens(variant);
    if (tokens.length === 0) continue;
    if (tokens.length === 1) {
      const t = tokens[0];
      if (t.length >= 3 && t.length <= 8 && !GENERIC_WORDS.has(t) && !HONORIFICS.has(t)) singleTokens.add(t);
      continue;
    }
    let core = tokens.slice();
    let type = null;
    let leadingType = null;
    if (TYPE_WORDS.has(core[core.length - 1])) {
      type = core[core.length - 1];
      core = core.slice(0, -1);
    } else if (TYPE_WORDS.has(core[0])) {
      leadingType = core[0];
      core = core.slice(1);
    }
    if (core.length === 0 || !hasIdentityToken(core)) continue;
    const key = core.join(' ');
    const entry = entriesByCore.get(key) || { core, types: new Set(), leadingTypes: new Set(), untyped: false };
    if (type) entry.types.add(type);
    else if (leadingType) entry.leadingTypes.add(leadingType);
    else entry.untyped = true;
    entriesByCore.set(key, entry);
  }

  const entries = Array.from(entriesByCore.values());
  // An untyped word-drop form inherits the type of the same core ("delhi tech" + "delhi tech university").
  const tenantTypes = new Set();
  entries.forEach((e) => e.types.forEach((t) => tenantTypes.add(t)));

  // Acronyms that include the type letter (SGTU, DTU) vs bare cores (SGT).
  const fullAcronyms = new Set();
  entries.forEach((e) => {
    if (e.types.size === 0) return;
    e.types.forEach((type) => {
      const lead = leadingShortRun(e.core);
      if (lead.length === e.core.length) fullAcronyms.add(lead.join('') + type[0]);
      fullAcronyms.add(initials(e.core) + type[0]);
    });
  });
  const acronyms = [];
  singleTokens.forEach((t) => {
    acronyms.push({ token: t, full: fullAcronyms.has(t) });
  });

  // Whole-part fuzzy comparison only for names with a long distinctive core:
  // "sgt university" vs "srt university" is one edit apart but another institution.
  const fullNames = [];
  entries.forEach((e) => {
    if (e.core.join(' ').length < 8) return;
    e.types.forEach((type) => fullNames.push([...e.core, type].join(' ')));
  });

  // results: memo of isAffiliationMatch decisions for this variant list (keyed by options + value).
  const compiled = { entries, acronyms, tenantTypes, fullNames: fullNames.filter((n) => n.length >= 12), results: new Map() };
  if (Array.isArray(variants)) compiledCache.set(variants, compiled);
  if (compiledByContent.size >= 64) compiledByContent.clear();
  compiledByContent.set(contentKey, compiled);
  return compiled;
}

function splitSegments(value) {
  return String(value || '')
    .split(/[;|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function segmentCountries(segmentText) {
  const text = ` ${rawTokens(segmentText).join(' ')} `;
  return COUNTRY_NAMES.filter((c) => text.includes(` ${c} `));
}

function matchNameEntry(entry, part, tenantTypes) {
  let cores = [entry.core];
  if (HONORIFICS.has(entry.core[0]) && entry.core.length - 1 >= 3) cores = [entry.core, entry.core.slice(1)];

  for (const core of cores) {
    let from = 0;
    for (;;) {
      const i = findRun(part, core, from);
      if (i === -1) break;
      from = i + 1;
      const next = part[i + core.length];
      const prev = part[i - 1];
      const allowedTypes = entry.types.size > 0 ? entry.types : (entry.untyped ? tenantTypes : new Set());

      if (entry.leadingTypes.size > 0 && prev && entry.leadingTypes.has(prev)) return true;
      if (next && allowedTypes.has(next)) return true;
      // Distinctive multi-word cores may appear without the type word,
      // as long as no different institution type follows.
      const conflicting = next && TYPE_WORDS.has(next) && !allowedTypes.has(next);
      if (!conflicting && core.length >= 3) return true;
      if (!conflicting && entry.untyped && entry.types.size === 0 && entry.leadingTypes.size === 0 && core.length >= 2) {
        return true;
      }
    }
  }
  return false;
}

function matchAcronym(acr, part, ctx) {
  const idx = part.indexOf(acr.token);
  if (idx === -1) return false;
  const next = part[idx + 1];
  if (next && ctx.tenantTypes.has(next)) return true; // "SGT University" via the acronym list
  if (!acr.full) return false; // bare core acronyms ("SGT") need the type word
  if (ctx.foreign) return false;
  const others = part.filter((t, k) => k !== idx && !GENERIC_WORDS.has(t));
  if (others.length === 0) return true; // "DTU", "Dept. of CSE, DTU"
  return ctx.hasHomeLocation;
}

/**
 * True when `value` names the institution described by `variants`.
 *
 * @param {string} value - Raw affiliation string (may hold several affiliations).
 * @param {string[]} variants - Output of generateAffiliationVariants() (+ any aliases).
 * @param {{ locations?: string[], country?: string }} [options] - tenant city/state/country,
 *   used only to accept an acronym that shares its part with other words.
 * @returns {boolean}
 */
function isAffiliationMatch(value, variants, options = {}) {
  if (!value || !Array.isArray(variants) || variants.length === 0) return false;
  const compiled = compileAffiliationMatcher(variants);
  if (compiled.entries.length === 0 && compiled.acronyms.length === 0) return false;

  // The same affiliation strings recur across a researcher's papers and every co-author row.
  const memoKey = `${options.country || ''}\u0001${(options.locations || []).join('\u0002')}\u0001${value}`;
  const memo = compiled.results.get(memoKey);
  if (memo !== undefined) return memo;
  return memoSet(compiled.results, memoKey, matchUncached(value, compiled, options));
}

function matchUncached(value, compiled, options) {
  const homeCountry = normalize(options.country || 'india');
  const locationTokens = (options.locations || []).flatMap((l) => canonTokens(l));

  for (const segment of splitSegments(value)) {
    const countries = segmentCountries(segment);
    const segTokens = canonTokens(segment);
    const ctx = {
      tenantTypes: compiled.tenantTypes,
      foreign: countries.length > 0 && !countries.includes(homeCountry),
      hasHomeLocation: locationTokens.length > 0 && locationTokens.some((t) => segTokens.includes(t)),
    };

    const parts = segment.split(',').map((p) => canonTokens(p)).filter((p) => p.length > 0);
    for (const part of parts) {
      if (!hasIdentityToken(part) && !part.some((t) => compiled.acronyms.some((a) => a.token === t))) continue;
      if (compiled.entries.some((entry) => matchNameEntry(entry, part, compiled.tenantTypes))) return true;
      if (compiled.acronyms.some((acr) => matchAcronym(acr, part, ctx))) return true;

      const joined = part.join(' ');
      // Similarity ≥ 0.9 needs the length difference within 10% (edit distance ≥ length difference).
      if (joined.length >= 12 && compiled.fullNames.some((n) => Math.abs(joined.length - n.length) <= 0.1 * Math.max(joined.length, n.length)
        && getSimilarity(joined, n) >= 0.9)) return true;
    }
  }
  return false;
}

module.exports = {
  generateAffiliationVariants,
  isAffiliationMatch,
  compileAffiliationMatcher,
  // Exported for unit testing / reuse by other normalization needs.
  normalize,
  canonTokens,
  getSimilarity,
  QUALIFIER_WORDS,
};
