/**
 * Validation for every incentive-policy create/update endpoint (research, book, book chapter,
 * conference, grant, IPR). One module so the rules cannot drift between policy types.
 *
 *   - amounts, points and bonuses are numbers ≥ 0, also inside JSON tables
 *   - percentages are within 0..100, and splits add up (see each schema)
 *   - enum fields are checked (publication type, distribution method, IPR type, …)
 *   - effectiveTo ≥ effectiveFrom; dates are stored as calendar days (UTC midnight)
 *
 * parse*() returns normalised values ready for Prisma or throws a 400 error whose message
 * lists every problem. Updates validate the merged record (stored values + changes), so a
 * PUT is held to the same rules as a POST.
 */
const { Prisma } = require('@prisma/client');
const { z } = require('zod');
const { startOfUtcDay } = require('../utils/policyWindow');

const RESEARCH_PUBLICATION_TYPES = ['research_paper', 'book', 'book_chapter', 'conference_paper', 'grant'];
const DISTRIBUTION_METHODS = ['author_role_based', 'author_position_based'];
const BOOK_PUBLICATION_TYPES = ['book', 'book_chapter'];
const BOOK_SPLIT_POLICIES = ['equal', 'weighted'];
const CONFERENCE_SUB_TYPES = ['paper_indexed_scopus', 'paper_not_indexed', 'keynote_speaker_invited_talks', 'organizer_coordinator_member'];
const CONFERENCE_ROLES = ['first_author', 'corresponding_author', 'co_author'];
const GRANT_PROJECT_CATEGORIES = ['govt', 'non_govt', 'industry'];
const GRANT_PROJECT_TYPES = ['indian', 'international'];
const GRANT_SPLIT_POLICIES = ['equal', 'percentage_based'];
const IPR_TYPES = ['patent', 'copyright', 'trademark', 'design'];
const IPR_SPLIT_POLICIES = ['equal', 'primary_inventor', 'weighted'];
const REQUIRED_QUARTILES = ['Top 1%', 'Top 5%', 'Q1', 'Q2', 'Q3', 'Q4'];

// ─── Primitive schemas ─────────────────────────────────────────────────────

const toNumberInput = (v) => {
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  if (v && typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber(); // Prisma Decimal
  return v;
};
const number = (label) => z.preprocess(toNumberInput, z.number({ error: `${label} must be a number` })
  .refine(Number.isFinite, `${label} must be a number`));
const money = (label) => number(label).refine((n) => n >= 0, `${label} cannot be negative`);
const points = (label) => money(label).refine(Number.isInteger, `${label} must be a whole number`);
const percent = (label) => number(label).refine((n) => n >= 0 && n <= 100, `${label} must be between 0 and 100`);
const enumOf = (values, label) => z.enum(values, { error: `${label} must be one of: ${values.join(', ')}` });
const name = z.string({ error: 'Policy name is required' }).trim().min(1, 'Policy name is required').max(255, 'Policy name is too long');
const date = (label) => z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : (v instanceof Date ? v : (v === null ? null : new Date(v)))),
  z.date({ error: `${label} must be a valid date` }).transform(startOfUtcDay),
);
const jsonValue = z.any();

// ─── Shared checks ─────────────────────────────────────────────────────────

/** Path of the first negative number (or numeric string) inside a JSON value, or null. */
function findNegative(value, path) {
  if (typeof value === 'number') return value < 0 ? path : null;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value) < 0 ? path : null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const p = findNegative(value[i], `${path}[${i}]`);
      if (p) return p;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const p = findNegative(v, `${path}.${k}`);
      if (p) return p;
    }
  }
  return null;
}

function checkNoNegatives(ctx, value, label) {
  if (value === null || value === undefined) return;
  const p = findNegative(value, label);
  if (p) ctx.addIssue({ code: 'custom', message: `${p} cannot be negative` });
}

function checkWindow(ctx, data) {
  if (data.effectiveFrom && data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
    ctx.addIssue({ code: 'custom', message: 'Effective to date cannot be before the effective from date' });
  }
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const near = (a, b) => Math.abs(a - b) < 0.01;

class PolicyValidationError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.statusCode = 400;
    this.code = 'INVALID_POLICY';
    this.errors = errors;
  }
}

function run(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors = [...new Set(result.error.issues.map((i) => i.message))];
    throw new PolicyValidationError(errors);
  }
  return result.data;
}

/** Keep only keys that were actually sent (undefined = "leave unchanged"). */
const defined = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined));
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));
/** Stored values of a row (nulls dropped so schema defaults apply to empty columns). */
const stored = (row, keys) => Object.fromEntries(keys.filter((k) => row?.[k] !== undefined && row[k] !== null).map((k) => [k, row[k]]));
/** Nullable bonus columns: a stored NULL pays nothing, so it must not pick up a create-time default. */
const BONUS_COLUMNS = ['internationalBonus', 'bestPaperAwardBonus', 'consortiumBonus'];
const storedWithBonuses = (row, keys) => ({
  ...stored(row, keys),
  ...Object.fromEntries(BONUS_COLUMNS.filter((k) => keys.includes(k) && row && row[k] === null).map((k) => [k, 0])),
});

// ─── Research ──────────────────────────────────────────────────────────────

const RESEARCH_FIELDS = [
  'publicationType', 'policyName', 'baseIncentiveAmount', 'basePoints', 'splitPolicy', 'distributionMethod',
  'primaryAuthorShare', 'authorTypeMultipliers', 'indexingBonuses', 'impactFactorTiers',
  'firstAuthorPercentage', 'correspondingAuthorPercentage', 'positionBasedDistribution',
  'effectiveFrom', 'effectiveTo', 'isActive',
];

const roleFromList = (list, role) => (Array.isArray(list) ? list.find((r) => r?.role === role)?.percentage : undefined);
const positionsToDistribution = (list) => {
  if (!Array.isArray(list) || !list.length) return undefined;
  const out = {};
  for (const p of list) if (p && p.position !== undefined) out[String(p.position)] = p.percentage;
  out['6+'] = 0;
  return out;
};

/**
 * Map every accepted spelling of the research split fields onto the canonical names.
 * Precedence: explicit column fields (camelCase, then snake_case) → top-level rolePercentages /
 * positionPercentages → the copies inside indexingBonuses (what older admin UIs sent).
 */
function normalizeResearchInput(body = {}) {
  const ib = body.indexingBonuses && typeof body.indexingBonuses === 'object' ? body.indexingBonuses : {};
  return defined({
    ...pick(body, RESEARCH_FIELDS),
    publicationType: typeof body.publicationType === 'string' ? body.publicationType.toLowerCase() : body.publicationType,
    firstAuthorPercentage: body.firstAuthorPercentage ?? body.first_author_percentage
      ?? roleFromList(body.rolePercentages, 'first_author') ?? roleFromList(ib.rolePercentages, 'first_author'),
    correspondingAuthorPercentage: body.correspondingAuthorPercentage ?? body.corresponding_author_percentage
      ?? roleFromList(body.rolePercentages, 'corresponding_author') ?? roleFromList(ib.rolePercentages, 'corresponding_author'),
    positionBasedDistribution: body.positionBasedDistribution
      ?? positionsToDistribution(body.positionPercentages) ?? positionsToDistribution(ib.positionPercentages),
  });
}

const researchSchema = z.object({
  publicationType: enumOf(RESEARCH_PUBLICATION_TYPES, 'Publication type'),
  policyName: name,
  baseIncentiveAmount: money('Base incentive amount'),
  basePoints: points('Base points'),
  splitPolicy: z.string().trim().min(1).max(50).default('equal'),
  distributionMethod: enumOf(DISTRIBUTION_METHODS, 'Distribution method').default('author_role_based'),
  primaryAuthorShare: percent('Primary author share').nullable().optional(),
  authorTypeMultipliers: jsonValue.nullable().optional(),
  indexingBonuses: jsonValue.nullable().optional(),
  impactFactorTiers: jsonValue.nullable().optional(),
  firstAuthorPercentage: percent('First author percentage').default(40),
  correspondingAuthorPercentage: percent('Corresponding author percentage').default(30),
  positionBasedDistribution: z.record(z.string(), percent('Position percentage')).nullable().optional(),
  effectiveFrom: date('Effective from date'),
  effectiveTo: date('Effective to date').nullable().optional(),
  isActive: z.boolean({ error: 'isActive must be true or false' }).optional(),
}).superRefine((d, ctx) => {
  checkWindow(ctx, d);
  checkNoNegatives(ctx, d.indexingBonuses, 'indexingBonuses');
  checkNoNegatives(ctx, d.impactFactorTiers, 'impactFactorTiers');
  checkNoNegatives(ctx, d.authorTypeMultipliers, 'authorTypeMultipliers');

  if (d.firstAuthorPercentage + d.correspondingAuthorPercentage > 100) {
    ctx.addIssue({ code: 'custom', message: `First author (${d.firstAuthorPercentage}%) + corresponding author (${d.correspondingAuthorPercentage}%) cannot exceed 100%` });
  }
  if (d.distributionMethod === 'author_role_based' && (d.firstAuthorPercentage <= 0 || d.correspondingAuthorPercentage <= 0)) {
    ctx.addIssue({ code: 'custom', message: 'First author and corresponding author percentages must be greater than 0' });
  }
  if (d.distributionMethod === 'author_position_based') {
    const dist = d.positionBasedDistribution;
    if (!dist || !Object.keys(dist).length) {
      ctx.addIssue({ code: 'custom', message: 'Position percentages are required for position-based distribution' });
    } else {
      const total = sum(Object.values(dist));
      if (!near(total, 100)) ctx.addIssue({ code: 'custom', message: `Position percentages must total 100% (currently ${total}%)` });
    }
  }

  const ib = d.indexingBonuses;
  if (ib && typeof ib === 'object' && !Array.isArray(ib)) {
    if (ib.quartileIncentives !== undefined) {
      if (!Array.isArray(ib.quartileIncentives)) {
        ctx.addIssue({ code: 'custom', message: 'Quartile incentives must be a list' });
      } else {
        const provided = ib.quartileIncentives.map((q) => q?.quartile);
        const missing = REQUIRED_QUARTILES.filter((q) => !provided.includes(q));
        if (missing.length) {
          ctx.addIssue({ code: 'custom', message: `Missing required quartile incentives: ${missing.join(', ')}. All six quartiles (Top 1%, Top 5%, Q1-Q4) must be provided.` });
        }
      }
    }
    for (const [key, list] of [['sjrRanges', ib.sjrRanges], ['naasRatingIncentives', ib.nestedCategoryIncentives?.naasRatingIncentives]]) {
      if (!Array.isArray(list)) continue;
      list.forEach((r, i) => {
        const lo = Number(r?.minSJR ?? r?.minRating);
        const hi = Number(r?.maxSJR ?? r?.maxRating);
        if (Number.isFinite(lo) && Number.isFinite(hi) && lo > hi) {
          ctx.addIssue({ code: 'custom', message: `${key}[${i}]: minimum cannot be greater than maximum` });
        }
      });
    }
    for (const key of ['rolePercentages', 'positionPercentages']) {
      if (Array.isArray(ib[key]) && ib[key].some((r) => Number(r?.percentage) > 100)) {
        ctx.addIssue({ code: 'custom', message: `indexingBonuses.${key} percentages must be between 0 and 100` });
      }
    }
  }
});

/** Mirror the split columns into indexingBonuses so the admin UI and the calculator agree. */
function syncResearchJson(d) {
  if (!d.indexingBonuses || typeof d.indexingBonuses !== 'object' || Array.isArray(d.indexingBonuses)) return d.indexingBonuses;
  const ib = { ...d.indexingBonuses };
  ib.rolePercentages = [
    { role: 'first_author', percentage: d.firstAuthorPercentage },
    { role: 'corresponding_author', percentage: d.correspondingAuthorPercentage },
  ];
  if (d.positionBasedDistribution) {
    ib.positionPercentages = Object.entries(d.positionBasedDistribution)
      .filter(([k]) => /^\d+$/.test(k))
      .map(([k, v]) => ({ position: Number(k), percentage: v }))
      .sort((a, b) => a.position - b.position);
  }
  return ib;
}

/** Canonical (input-shaped) view of a stored research policy, for merging updates. */
function researchRowToInput(row) {
  return defined({
    ...stored(row, RESEARCH_FIELDS),
    firstAuthorPercentage: row.first_author_percentage ?? undefined,
    correspondingAuthorPercentage: row.corresponding_author_percentage ?? undefined,
  });
}

/**
 * @param {object} body request body
 * @param {object} [existing] stored row (update)
 * @returns Prisma data (column names) for create/update
 */
function parseResearchPolicy(body, existing = null) {
  const input = existing
    ? { ...researchRowToInput(existing), ...normalizeResearchInput(body), publicationType: existing.publicationType }
    : normalizeResearchInput(body);
  if (!existing && input.effectiveFrom === undefined) {
    throw new PolicyValidationError(['Please provide an effectiveFrom date']);
  }
  const d = run(researchSchema, input);
  return {
    publicationType: d.publicationType,
    policyName: d.policyName,
    baseIncentiveAmount: d.baseIncentiveAmount,
    basePoints: d.basePoints,
    splitPolicy: d.splitPolicy,
    distributionMethod: d.distributionMethod,
    primaryAuthorShare: d.primaryAuthorShare ?? null,
    authorTypeMultipliers: d.authorTypeMultipliers ?? undefined,
    indexingBonuses: syncResearchJson(d) ?? undefined,
    impactFactorTiers: d.impactFactorTiers ?? undefined,
    first_author_percentage: d.firstAuthorPercentage,
    corresponding_author_percentage: d.correspondingAuthorPercentage,
    positionBasedDistribution: d.positionBasedDistribution ?? undefined,
    effectiveFrom: d.effectiveFrom,
    effectiveTo: d.effectiveTo ?? null,
    ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
  };
}

// ─── Book / book chapter ───────────────────────────────────────────────────

const BOOK_FIELDS = ['policyName', 'authoredIncentiveAmount', 'authoredPoints', 'editedIncentiveAmount', 'editedPoints',
  'splitPolicy', 'indexingBonuses', 'internationalBonus', 'effectiveFrom', 'effectiveTo', 'isActive'];

const bookSchema = z.object({
  policyName: name,
  authoredIncentiveAmount: money('Authored incentive amount'),
  authoredPoints: points('Authored points').default(0),
  editedIncentiveAmount: money('Edited incentive amount'),
  editedPoints: points('Edited points').default(0),
  splitPolicy: enumOf(BOOK_SPLIT_POLICIES, 'Split policy').default('equal'),
  indexingBonuses: z.object({
    scopus_indexed: money('Scopus-indexed bonus').default(0),
    non_indexed: money('Non-indexed bonus').default(0),
    sgt_publication_house: money('Publication-house bonus').default(0),
  }, { error: 'Indexing bonuses must be an object' }).default({ scopus_indexed: 10000, non_indexed: 0, sgt_publication_house: 2000 }),
  internationalBonus: money('International bonus').default(5000),
  effectiveFrom: date('Effective from date').default(() => startOfUtcDay(new Date())),
  effectiveTo: date('Effective to date').nullable().optional(),
  isActive: z.boolean({ error: 'isActive must be true or false' }).optional(),
}).superRefine((d, ctx) => checkWindow(ctx, d));

function parseBookPolicy(body, existing = null) {
  const input = existing ? { ...storedWithBonuses(existing, BOOK_FIELDS), ...defined(pick(body, BOOK_FIELDS)) } : pick(body, BOOK_FIELDS);
  const d = run(bookSchema, input);
  return { ...d, effectiveTo: d.effectiveTo ?? null };
}

function parseBookPublicationType(value) {
  if (!BOOK_PUBLICATION_TYPES.includes(value)) {
    throw new PolicyValidationError(['Invalid publication type. Must be "book" or "book_chapter"']);
  }
  return value;
}

// ─── Conference ────────────────────────────────────────────────────────────

const CONFERENCE_FIELDS = ['policyName', 'conferenceSubType', 'quartileIncentives', 'rolePercentages', 'flatIncentiveAmount',
  'flatPoints', 'splitPolicy', 'internationalBonus', 'bestPaperAwardBonus', 'effectiveFrom', 'effectiveTo', 'isActive'];

const conferenceSchema = z.object({
  policyName: name,
  conferenceSubType: enumOf(CONFERENCE_SUB_TYPES, 'Conference sub-type'),
  quartileIncentives: z.array(z.object({
    quartile: z.string({ error: 'Each quartile incentive needs a quartile' }).trim().min(1),
    incentiveAmount: money('Quartile incentive amount'),
    points: points('Quartile points'),
  }), { error: 'Quartile incentives must be a list' }).nullable().optional(),
  rolePercentages: z.array(z.object({
    role: enumOf(CONFERENCE_ROLES, 'Role'),
    percentage: percent('Role percentage'),
  }), { error: 'Role percentages must be a list' }).nullable().optional(),
  flatIncentiveAmount: money('Flat incentive amount').nullable().optional(),
  flatPoints: points('Flat points').nullable().optional(),
  splitPolicy: z.string().trim().min(1).max(50).default('equal'),
  internationalBonus: money('International bonus').default(5000),
  bestPaperAwardBonus: money('Best paper award bonus').default(5000),
  effectiveFrom: date('Effective from date').default(() => startOfUtcDay(new Date())),
  effectiveTo: date('Effective to date').nullable().optional(),
  isActive: z.boolean({ error: 'isActive must be true or false' }).optional(),
}).superRefine((d, ctx) => {
  checkWindow(ctx, d);
  if (d.conferenceSubType === 'paper_indexed_scopus') {
    if (!d.quartileIncentives?.length) {
      ctx.addIssue({ code: 'custom', message: 'Quartile incentives are required for Scopus-indexed conference papers' });
    }
    const roles = d.rolePercentages || [];
    const first = roles.find((r) => r.role === 'first_author')?.percentage;
    const corresponding = roles.find((r) => r.role === 'corresponding_author')?.percentage;
    const coAuthor = roles.find((r) => r.role === 'co_author')?.percentage;
    if (!(first > 0) || !(corresponding > 0)) {
      ctx.addIssue({ code: 'custom', message: 'Scopus conference policies need first author and corresponding author percentages greater than 0' });
    } else if (coAuthor !== undefined ? !near(first + corresponding + coAuthor, 100) : first + corresponding > 100) {
      ctx.addIssue({ code: 'custom', message: `Role percentages must total 100% (first ${first}% + corresponding ${corresponding}%${coAuthor !== undefined ? ` + co-authors ${coAuthor}%` : ''}; co-authors share the remainder)` });
    }
    if (new Set(roles.map((r) => r.role)).size !== roles.length) {
      ctx.addIssue({ code: 'custom', message: 'Each role may appear only once in role percentages' });
    }
  } else if (d.flatIncentiveAmount === undefined || d.flatIncentiveAmount === null || d.flatPoints === undefined || d.flatPoints === null) {
    ctx.addIssue({ code: 'custom', message: 'Flat incentive amount and points are required for this conference type' });
  }
});

function parseConferencePolicy(body, existing = null) {
  const input = existing
    ? { ...storedWithBonuses(existing, CONFERENCE_FIELDS), ...defined(pick(body, CONFERENCE_FIELDS)), conferenceSubType: existing.conferenceSubType }
    : pick(body, CONFERENCE_FIELDS);
  const d = run(conferenceSchema, input);
  const scopus = d.conferenceSubType === 'paper_indexed_scopus';
  return {
    ...d,
    quartileIncentives: scopus ? d.quartileIncentives : [],
    rolePercentages: scopus ? d.rolePercentages : [],
    flatIncentiveAmount: scopus ? null : d.flatIncentiveAmount,
    flatPoints: scopus ? null : d.flatPoints,
    effectiveTo: d.effectiveTo ?? null,
  };
}

// ─── Grant ─────────────────────────────────────────────────────────────────

const GRANT_FIELDS = ['policyName', 'projectCategory', 'projectType', 'baseIncentiveAmount', 'basePoints', 'splitPolicy',
  'rolePercentages', 'fundingAmountMultiplier', 'internationalBonus', 'consortiumBonus', 'effectiveFrom', 'effectiveTo', 'isActive'];

const grantSchema = z.object({
  policyName: name,
  projectCategory: enumOf(GRANT_PROJECT_CATEGORIES, 'Project category'),
  projectType: enumOf(GRANT_PROJECT_TYPES, 'Project type'),
  baseIncentiveAmount: money('Base incentive amount'),
  basePoints: points('Base points'),
  splitPolicy: enumOf(GRANT_SPLIT_POLICIES, 'Split policy'),
  rolePercentages: z.array(z.object({
    role: z.string({ error: 'Each role percentage needs a role' }).trim().min(1, 'Each role percentage needs a role'),
    percentage: percent('Role percentage'),
  }), { error: 'Role percentages must be a list' }).nullable().optional(),
  fundingAmountMultiplier: jsonValue.nullable().optional(),
  internationalBonus: money('International bonus').default(10000),
  consortiumBonus: money('Consortium bonus').default(5000),
  effectiveFrom: date('Effective from date').default(() => startOfUtcDay(new Date())),
  effectiveTo: date('Effective to date').nullable().optional(),
  isActive: z.boolean({ error: 'isActive must be true or false' }).optional(),
}).superRefine((d, ctx) => {
  checkWindow(ctx, d);
  checkNoNegatives(ctx, d.fundingAmountMultiplier, 'fundingAmountMultiplier');
  if (d.splitPolicy === 'percentage_based') {
    const roles = d.rolePercentages || [];
    if (!roles.length) {
      ctx.addIssue({ code: 'custom', message: 'Role percentages are required for percentage-based split policy' });
    } else {
      const total = sum(roles.map((r) => r.percentage));
      if (!near(total, 100)) ctx.addIssue({ code: 'custom', message: `Role percentages must total 100%. Current total: ${total}%` });
    }
  }
});

function parseGrantPolicy(body, existing = null) {
  const input = existing ? { ...storedWithBonuses(existing, GRANT_FIELDS), ...defined(pick(body, GRANT_FIELDS)) } : pick(body, GRANT_FIELDS);
  const d = run(grantSchema, input);
  return { ...d, rolePercentages: d.rolePercentages || [], fundingAmountMultiplier: d.fundingAmountMultiplier ?? {}, effectiveTo: d.effectiveTo ?? null };
}

// ─── IPR ───────────────────────────────────────────────────────────────────

const IPR_FIELDS = ['iprType', 'policyName', 'baseIncentiveAmount', 'basePoints', 'splitPolicy', 'primaryInventorShare',
  'filingTypeMultiplier', 'projectTypeBonus', 'effectiveFrom', 'effectiveTo', 'isActive'];

const iprSchema = z.object({
  iprType: enumOf(IPR_TYPES, 'IPR type'),
  policyName: name,
  baseIncentiveAmount: money('Base incentive amount'),
  basePoints: points('Base points'),
  splitPolicy: enumOf(IPR_SPLIT_POLICIES, 'Split policy').default('equal'),
  primaryInventorShare: percent('Primary inventor share').nullable().optional(),
  filingTypeMultiplier: jsonValue.nullable().optional(),
  projectTypeBonus: jsonValue.nullable().optional(),
  effectiveFrom: date('Effective from date').default(() => startOfUtcDay(new Date())),
  effectiveTo: date('Effective to date').nullable().optional(),
  isActive: z.boolean({ error: 'isActive must be true or false' }).default(true),
}).superRefine((d, ctx) => {
  checkWindow(ctx, d);
  checkNoNegatives(ctx, d.filingTypeMultiplier, 'filingTypeMultiplier');
  checkNoNegatives(ctx, d.projectTypeBonus, 'projectTypeBonus');
  if (d.splitPolicy === 'primary_inventor' && (d.primaryInventorShare === undefined || d.primaryInventorShare === null)) {
    ctx.addIssue({ code: 'custom', message: 'Primary inventor share is required for the primary-inventor split policy' });
  }
});

function parseIprPolicy(body, existing = null) {
  const normalized = { ...pick(body, IPR_FIELDS) };
  if (typeof normalized.iprType === 'string') normalized.iprType = normalized.iprType.toLowerCase();
  const input = existing
    ? { ...stored(existing, IPR_FIELDS), ...defined(normalized), iprType: existing.iprType }
    : normalized;
  const d = run(iprSchema, input);
  // Publication pays exactly the policy's base amount and points, split equally among the
  // inventors. Nothing else is paid, so the extra knobs are never stored.
  return {
    ...d,
    effectiveTo: d.effectiveTo ?? null,
    splitPolicy: 'equal',
    primaryInventorShare: null,
    filingTypeMultiplier: Prisma.DbNull,
    projectTypeBonus: Prisma.DbNull,
  };
}

/** Send a validation/overlap error as JSON; returns false when `error` is not one of ours. */
function sendPolicyError(res, error) {
  if (!error) return false;
  // A concurrent save slipped past the in-transaction check and hit the database's
  // no-overlap exclusion constraint (SQLSTATE 23P01) or a unique index.
  const text = `${error.message || ''} ${error.meta ? JSON.stringify(error.meta) : ''}`;
  if (error.code === 'P2002' || /23P01|_no_overlap|exclusion constraint/i.test(text)) {
    res.status(409).json({
      success: false,
      code: 'POLICY_OVERLAP',
      message: 'Another enabled policy already covers these dates. Refresh and adjust the dates, or disable the other policy first.',
    });
    return true;
  }
  if (!error.statusCode || error.statusCode >= 500) return false;
  res.status(error.statusCode).json({
    success: false,
    code: error.code,
    message: error.message,
    ...(error.errors ? { errors: error.errors } : {}),
    ...(error.conflictingPolicyId ? { conflictingPolicyId: error.conflictingPolicyId } : {}),
  });
  return true;
}

module.exports = {
  RESEARCH_PUBLICATION_TYPES,
  DISTRIBUTION_METHODS,
  BOOK_PUBLICATION_TYPES,
  CONFERENCE_SUB_TYPES,
  GRANT_PROJECT_CATEGORIES,
  GRANT_PROJECT_TYPES,
  IPR_TYPES,
  PolicyValidationError,
  findNegative,
  normalizeResearchInput,
  parseResearchPolicy,
  parseBookPolicy,
  parseBookPublicationType,
  parseConferencePolicy,
  parseGrantPolicy,
  parseIprPolicy,
  sendPolicyError,
};
