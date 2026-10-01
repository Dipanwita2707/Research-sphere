/**
 * Shared helpers for reading research contributions consistently across the
 * Research Intelligence services: which records count, their year, citations,
 * and how researchers are named.
 */

'use strict';

/** Contributions that represent real research output (drafts, rejections and cancellations are excluded). */
const COUNTED_STATUSES = ['submitted', 'under_review', 'changes_required', 'resubmitted', 'approved', 'completed'];

/** Prisma where-fragment selecting counted contributions. Tenant scoping is added by tenantExtension. */
const countedWhere = (extra = {}) => ({ status: { in: COUNTED_STATUSES }, ...extra });

/** SQL literal list of counted statuses, for raw queries. */
const COUNTED_STATUSES_SQL = COUNTED_STATUSES.map((s) => `'${s}'`).join(',');

const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Citation count imported from Scopus / OpenAlex (stored in indexingDetails by publicationSync). */
const citationsOf = (contribution) => {
  const n = Number(asObject(contribution.indexingDetails).citationCount);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Publication year, falling back to submission or creation date. */
const yearOf = (contribution) => {
  const d = contribution.publicationDate || contribution.submittedAt || contribution.createdAt;
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return Number.isFinite(y) ? y : null;
};

const displayName = (user) => {
  if (!user) return 'Unknown researcher';
  const e = user.employeeDetails;
  if (e?.displayName) return e.displayName;
  const full = [e?.firstName, e?.lastName].filter(Boolean).join(' ').trim();
  return full || user.uid || 'Unknown researcher';
};

/** Prisma select for a researcher with the fields displayName() and profiles need. */
const RESEARCHER_SELECT = {
  id: true,
  uid: true,
  employeeDetails: {
    select: {
      displayName: true,
      firstName: true,
      lastName: true,
      designation: true,
      primaryDepartment: { select: { id: true, departmentName: true } },
      primarySchool: { select: { id: true, facultyName: true } },
    },
  },
};

const researcherSummary = (user) => ({
  id: user.id,
  name: displayName(user),
  designation: user.employeeDetails?.designation || null,
  department: user.employeeDetails?.primaryDepartment?.departmentName || null,
  school: user.employeeDetails?.primarySchool?.facultyName || null,
});

/** h-index from a list of per-paper citation counts. */
const hIndex = (citationCounts) => {
  const sorted = [...citationCounts].sort((a, b) => b - a);
  let h = 0;
  while (h < sorted.length && sorted[h] >= h + 1) h++;
  return h;
};

const toSlug = (name, max = 256) =>
  String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max);

module.exports = {
  COUNTED_STATUSES,
  COUNTED_STATUSES_SQL,
  countedWhere,
  asObject,
  citationsOf,
  yearOf,
  displayName,
  RESEARCHER_SELECT,
  researcherSummary,
  hIndex,
  toSlug,
};
