/**
 * UGC-CARE (Consortium for Academic and Research Ethics) journal listing, used by NAAC 3.3.1
 * (papers per teacher in UGC-CARE journals).
 *
 * ResearchContribution.ugcCareListed: true = journal is in the UGC-CARE list, false = it is not,
 * null = unknown / not stated.
 * ResearchContribution.ugcCareGroup (only when listed):
 *   'group_1' - Group I: journals found qualified through the UGC-CARE protocol
 *   'group_2' - Group II: journals indexed in globally recognised databases (Scopus / Web of Science)
 */

const UGC_CARE_GROUPS = Object.freeze(['group_1', 'group_2']);

class UgcCareValidationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
    this.code = 'INVALID_UGC_CARE';
  }
}

/** 'yes' / 'no' / '' / true / false / null → true / false / null (undefined stays undefined). */
const parseListed = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '' || value === 'unknown') return null;
  if (value === true || value === 'yes' || value === 'true') return true;
  if (value === false || value === 'no' || value === 'false') return false;
  throw new UgcCareValidationError('ugcCareListed must be yes, no or unknown');
};

/**
 * Normalise the pair from a request body.
 * @param {*} listed - ugcCareListed as sent (undefined = not sent)
 * @param {*} group  - ugcCareGroup as sent (undefined = not sent)
 * @param {{ partial?: boolean }} [opts] - partial: leave fields that were not sent untouched
 * @returns {{ ugcCareListed?: boolean|null, ugcCareGroup?: string|null }}
 * @throws {UgcCareValidationError} on an unknown value, or a group on a journal that is not listed
 */
function normalizeUgcCare(listed, group, { partial = false } = {}) {
  const out = {};
  const parsedListed = parseListed(listed);
  let parsedGroup;
  if (group === undefined) parsedGroup = undefined;
  else if (group === null || group === '') parsedGroup = null;
  else if (UGC_CARE_GROUPS.includes(group)) parsedGroup = group;
  else throw new UgcCareValidationError(`ugcCareGroup must be one of: ${UGC_CARE_GROUPS.join(', ')}`);

  if (parsedListed === undefined && parsedGroup === undefined) {
    return partial ? out : { ugcCareListed: null, ugcCareGroup: null };
  }
  if (parsedListed !== true && parsedGroup) {
    if (parsedListed === undefined) {
      throw new UgcCareValidationError('Send ugcCareListed: yes together with a UGC-CARE group');
    }
    throw new UgcCareValidationError('A UGC-CARE group can only be set when the journal is UGC-CARE listed');
  }
  if (parsedListed !== undefined) out.ugcCareListed = parsedListed;
  // The group follows the listing: cleared whenever the journal is not (known to be) listed.
  out.ugcCareGroup = parsedListed === true ? (parsedGroup ?? null) : null;
  return out;
}

/**
 * Indexing categories that mean "indexed in Scopus or Web of Science". UGC-CARE Group II is by
 * definition the journals indexed in those databases, so a paper in any of these categories is
 * UGC-CARE listed, Group II, without asking the author. (Nature/Science/Lancet/Cell/NEJM and
 * IF > 20 journals are Web of Science / JCR journals.)
 */
const SCOPUS_WOS_CATEGORIES = Object.freeze([
  'scopus', 'scie_wos', 'abdc_scopus_wos', 'nature_science_lancet_cell_nejm', 'subsidiary_if_above_20',
]);

/** UGC-CARE values implied by the indexing categories, or null when they imply nothing. */
function ugcCareFromIndexing(indexingCategories) {
  const cats = Array.isArray(indexingCategories) ? indexingCategories : [];
  return cats.some((c) => SCOPUS_WOS_CATEGORIES.includes(c))
    ? { ugcCareListed: true, ugcCareGroup: 'group_2' }
    : null;
}

/**
 * The UGC-CARE pair to store for a journal paper: derived from the indexing categories when they
 * settle it (Scopus / Web of Science → listed, Group II), otherwise what the author answered.
 */
function resolveUgcCare(listed, group, indexingCategories, opts) {
  return ugcCareFromIndexing(indexingCategories) || normalizeUgcCare(listed, group, opts);
}

module.exports = {
  UGC_CARE_GROUPS, SCOPUS_WOS_CATEGORIES, UgcCareValidationError,
  normalizeUgcCare, ugcCareFromIndexing, resolveUgcCare,
};
