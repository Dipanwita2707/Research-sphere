/**
 * Validation for POST /research/incentive-preview: the in-progress submission form payload.
 * Only the fields the incentive computation reads are kept; anything else is dropped.
 * Malformed input throws a 400 whose message lists every problem.
 */
const { z } = require('zod');

const PREVIEW_PUBLICATION_TYPES = ['research_paper', 'book', 'book_chapter', 'conference_paper'];
const MAX_AUTHORS = 100;

const text = (max) => z.string().trim().max(max);
const optText = (max) => text(max).nullish();
const yesNo = z.union([z.boolean(), z.enum(['yes', 'no', 'true', 'false'])]).nullish();

/** Number, numeric string or empty → number | null. */
const optNumber = (label) => z.preprocess(
  (v) => (v === '' || v === undefined ? null : typeof v === 'string' ? Number(v) : v),
  z.number({ error: `${label} must be a number` }).refine(Number.isFinite, `${label} must be a number`)
    .refine((n) => n >= 0, `${label} cannot be negative`).nullable(),
).optional();

const optPosition = z.preprocess(
  (v) => (v === '' || v === undefined ? null : typeof v === 'string' ? Number(v) : v),
  z.number({ error: 'Author position must be a whole number' }).int('Author position must be a whole number')
    .min(1, 'Author position must be at least 1').max(1000).nullable(),
).optional();

const authorSchema = z.object({
  name: optText(256),
  authorType: optText(64),
  authorRole: optText(64),
  authorCategory: optText(64),
  registrationNumber: optText(64),
  uid: optText(64),
  email: optText(256),
  affiliation: optText(256),
  orderNumber: optPosition,
  authorPosition: optPosition,
  isCorresponding: z.boolean().nullish(),
  isInternal: z.boolean().nullish(),
  isStudent: z.boolean().nullish(),
});

const previewSchema = z.object({
  publicationType: z.enum(PREVIEW_PUBLICATION_TYPES, { error: `publicationType must be one of: ${PREVIEW_PUBLICATION_TYPES.join(', ')}` }),
  publicationDate: z.union([
    z.null(),
    z.literal(''),
    z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), 'publicationDate must be a valid date'),
  ]).optional(),
  // Research paper
  indexingCategories: z.array(text(64)).max(20).nullish(),
  quartile: optText(32),
  sjr: optNumber('SJR'),
  impactFactor: optNumber('Impact factor'),
  naasRating: optNumber('NAAS rating'),
  subsidiaryImpactFactor: optNumber('Subsidiary impact factor'),
  // Book / book chapter
  bookType: optText(32),
  bookPublicationType: optText(32),
  bookIndexingType: optText(64),
  indexing: optText(64),
  isInternational: yesNo,
  nationalInternational: optText(32),
  // Conference
  conferenceSubType: optText(64),
  proceedingsQuartile: optText(32),
  conferenceType: optText(32),
  conferenceHeldLocation: optText(32),
  conferenceBestPaperAward: yesNo,
  authors: z.array(authorSchema).max(MAX_AUTHORS, `At most ${MAX_AUTHORS} authors`).default([]),
});

/**
 * @param {unknown} body
 * @returns {object} the validated payload (dates/numbers normalised, unknown keys dropped)
 * @throws {Error} statusCode 400
 */
function parseIncentivePreview(body) {
  const result = previewSchema.safeParse(body ?? {});
  if (!result.success) {
    const problems = result.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message));
    const err = new Error(`Invalid incentive preview request: ${problems.join('; ')}`);
    err.statusCode = 400;
    err.validationErrors = problems;
    throw err;
  }
  const data = result.data;
  if (!data.publicationDate) data.publicationDate = null;
  return data;
}

module.exports = { parseIncentivePreview, PREVIEW_PUBLICATION_TYPES };
