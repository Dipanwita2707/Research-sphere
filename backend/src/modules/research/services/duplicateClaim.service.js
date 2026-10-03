/**
 * Duplicate-claim detection: one claim per work per university.
 *
 * A "work" is identified by a work key, strongest identifier first:
 *   doi:<doi>                       journal / conference papers with a DOI
 *   isbn:<isbn>                     books
 *   isbn:<isbn>:ch:<title>          book chapters (many chapters share a book's ISBN)
 *   t:<type>:<title>:<year>         everything else (normalised title + publication year)
 *
 * When co-authors from the same university each claim the same work, the first active
 * claim wins: later submissions are blocked (the co-author should ask to be listed on the
 * existing claim), DRD approval re-checks, and the payout ledger refuses to pay one author
 * twice for the same work key.
 */
const prisma = require('../../../shared/config/database');

/** Statuses in which a contribution "holds" its work. Drafts, rejected and cancelled do not. */
const ACTIVE_CLAIM_STATUSES = [
  'pending_mentor_approval', 'submitted', 'under_review', 'changes_required', 'resubmitted', 'approved', 'completed',
];

function normalizeDoi(raw) {
  if (!raw) return null;
  const doi = String(raw).trim().toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '')
    .replace(/\s+/g, '');
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : null;
}

function normalizeIsbn(raw) {
  if (!raw) return null;
  const isbn = String(raw).toUpperCase().replace(/[^0-9X]/g, '');
  return isbn.length === 10 || isbn.length === 13 ? isbn : null;
}

function normalizeTitle(raw) {
  if (!raw) return null;
  const t = String(raw)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return t.length >= 8 ? t.slice(0, 250) : null;
}

function yearOf(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

/** Title-based key, computed even when a DOI exists (see findActiveClaims). */
function computeTitleKey(c = {}) {
  const type = c.publicationType;
  if (!type || type === 'grant_proposal') return null;
  const title = normalizeTitle(c.title);
  if (!title) return null;
  const year = yearOf(c.publicationDate) || yearOf(c.conferenceDate) || c.publishedYear || null;
  return `t:${type}:${title}${year ? `:${year}` : ''}`.slice(0, 320);
}

/**
 * @param {object} c contribution-like object (stored row or submission payload)
 * @returns {string|null}
 */
function computeWorkKey(c = {}) {
  const type = c.publicationType;
  if (!type || type === 'grant_proposal') return null;

  const doi = normalizeDoi(c.doi) || normalizeDoi(c.paperDoi);
  if (doi) return `doi:${doi}`;

  const isbn = normalizeIsbn(c.isbn);
  const title = normalizeTitle(c.title);
  if (type === 'book' && isbn) return `isbn:${isbn}`;
  if (type === 'book_chapter' && isbn && title) return `isbn:${isbn}:ch:${title}`.slice(0, 320);

  if (!title) return null;
  const year = yearOf(c.publicationDate) || yearOf(c.conferenceDate) || c.publishedYear || null;
  return `t:${type}:${title}${year ? `:${year}` : ''}`.slice(0, 320);
}

class DuplicateClaimError extends Error {
  constructor(existing) {
    super(
      `This work has already been claimed (${existing.applicationNumber || 'existing claim'}, ${existing.status.replace(/_/g, ' ')}). ` +
      'Ask the person who submitted it to add you as a co-author instead of submitting it again.',
    );
    this.statusCode = 409;
    this.code = 'DUPLICATE_CLAIM';
    this.existing = existing;
  }
}

/** Both identity keys for a contribution-like object. */
function keysFor(c = {}) {
  return { workKey: computeWorkKey(c), titleWorkKey: computeTitleKey(c) };
}

/**
 * Active claims on the same work in the current university (tenant-scoped by the extension).
 *
 * Same work = same workKey (same DOI / ISBN / title key), OR same title key when at least one
 * of the two claims has no DOI. Two claims with DIFFERENT DOIs but the same title are treated
 * as different works (e.g. a preprint and the published version).
 *
 * @param {string|object|null} keysOrWorkKey `{ workKey, titleWorkKey }` or a plain workKey
 * @param {{ excludeId?: string, client?: object }} [opts]
 */
async function findActiveClaims(keysOrWorkKey, { excludeId = null, client = prisma } = {}) {
  const keys = typeof keysOrWorkKey === 'object' && keysOrWorkKey !== null
    ? keysOrWorkKey
    : { workKey: keysOrWorkKey, titleWorkKey: null };
  const { workKey, titleWorkKey } = keys;
  if (!workKey && !titleWorkKey) return [];
  const inputHasDoi = Boolean(workKey && workKey.startsWith('doi:'));
  const rows = await client.researchContribution.findMany({
    where: {
      status: { in: ACTIVE_CLAIM_STATUSES },
      OR: [
        ...(workKey ? [{ workKey }] : []),
        ...(titleWorkKey ? [{ titleWorkKey }, { workKey: titleWorkKey }] : []),
      ],
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: {
      workKey: true,
      id: true,
      applicationNumber: true,
      status: true,
      title: true,
      publicationType: true,
      submittedAt: true,
      applicantUserId: true,
      applicantUser: {
        select: {
          uid: true,
          employeeDetails: { select: { displayName: true, firstName: true, lastName: true } },
          studentLogin: { select: { displayName: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { submittedAt: 'asc' },
    take: 10,
  });
  return rows.filter((r) => {
    if (workKey && r.workKey === workKey) return true;
    // Title-only match: duplicate unless both claims carry (different) DOIs.
    const existingHasDoi = Boolean(r.workKey && r.workKey.startsWith('doi:'));
    return !(inputHasDoi && existingHasDoi);
  }).slice(0, 5);
}

function describeClaim(row) {
  const person = row.applicantUser?.employeeDetails || row.applicantUser?.studentLogin;
  const name = person?.displayName || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || row.applicantUser?.uid || 'another author';
  return {
    id: row.id,
    applicationNumber: row.applicationNumber,
    status: row.status,
    title: row.title,
    publicationType: row.publicationType,
    submittedAt: row.submittedAt,
    claimedBy: name,
  };
}

/**
 * Throw DuplicateClaimError when another active claim holds the same work.
 * @returns {{ workKey: string|null, titleWorkKey: string|null }} keys to store on the claim
 */
async function assertNoActiveClaim(contribution, { client = prisma } = {}) {
  const keys = keysFor(contribution);
  const [existing] = await findActiveClaims(keys, { excludeId: contribution.id, client });
  if (existing) throw new DuplicateClaimError(describeClaim(existing));
  return keys;
}

/** For the submission form's live check (no throw). */
async function checkDuplicate(input, { excludeId = null } = {}) {
  const keys = keysFor(input);
  const claims = await findActiveClaims(keys, { excludeId });
  return { workKey: keys.workKey, duplicate: claims.length > 0, claims: claims.map(describeClaim) };
}

module.exports = {
  ACTIVE_CLAIM_STATUSES,
  computeWorkKey,
  computeTitleKey,
  keysFor,
  normalizeDoi,
  normalizeIsbn,
  normalizeTitle,
  findActiveClaims,
  assertNoActiveClaim,
  checkDuplicate,
  DuplicateClaimError,
};
