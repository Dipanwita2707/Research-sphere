/**
 * @module objectAccess
 * @description Object-level authorization for research, grant, IPR and progress-tracker records.
 *
 * Tenant isolation is enforced by the Prisma tenant extension, so these checks only
 * decide whether a user may see a record WITHIN their own university:
 *   - the applicant / owner
 *   - a listed author, co-author, investigator or contributor
 *   - the faculty mentor named on a student submission
 *   - an assigned or past reviewer
 *   - a user holding a relevant DRD review/approve/dashboard/finance permission
 *   - a superadmin
 *
 * Callers must answer 404 (never 403) when access is denied so the existence of
 * another user's record is not disclosed.
 */

const RESEARCH_STAFF_PERMISSIONS = [
  'research_review', 'research_approve', 'research_assign_school',
  'book_review', 'book_approve', 'book_assign_school',
  'conference_review', 'conference_approve', 'conference_assign_school',
  'grant_review', 'grant_approve', 'grant_assign_school',
  'finance_review', 'finance_approve', 'finance_manage',
];

const GRANT_STAFF_PERMISSIONS = [
  'grant_review', 'grant_approve', 'grant_assign_school',
  'finance_review', 'finance_approve', 'finance_manage',
];

const IPR_STAFF_PERMISSIONS = [
  'ipr_review', 'ipr_approve', 'ipr_all_dashboard', 'ipr_edit_all', 'ipr_assign_school',
  'finance_review', 'finance_approve', 'finance_manage',
];

/** Same naming-convention expansion as requireAnyPermission in shared/middleware/auth.js. */
const expandPermission = (name) => [name, `drd_${name}`, name.replace('drd_', '')];

/**
 * Does the user hold any of the given permissions (central or school department)?
 * @param {object} user - req.user as loaded by protect (merged role + direct permissions)
 * @param {string[]} permissionNames
 * @returns {boolean}
 */
const hasAnyPermission = (user, permissionNames) => {
  if (!user) return false;
  const wanted = new Set(permissionNames.flatMap(expandPermission));
  const entries = [...(user.centralDeptPermissions || []), ...(user.schoolDeptPermissions || [])];
  return entries.some((entry) => {
    const perms = entry && entry.permissions;
    if (!perms || typeof perms !== 'object') return false;
    for (const key of wanted) if (perms[key] === true) return true;
    return false;
  });
};

const isSuperadmin = (user) => user?.role === 'superadmin';

const matchesUser = (user, person) => {
  if (!person || !user) return false;
  if (person.userId && person.userId === user.id) return true;
  if (user.uid && (person.uid === user.uid || person.registrationNo === user.uid)) return true;
  return false;
};

const reviewedBy = (user, reviews) =>
  Array.isArray(reviews) && reviews.some((r) => r && r.reviewerId === user.id);

const isMentor = (user, details) => Boolean(user?.uid && details?.mentorUid && details.mentorUid === user.uid);

/**
 * Relations a record must be loaded with for the can* checks below to be complete.
 * Spread into an existing `include`, or pass on its own.
 */
const CONTRIBUTION_ACCESS_INCLUDE = {
  authors: { select: { userId: true, uid: true, registrationNo: true } },
  reviews: { select: { reviewerId: true } },
  applicantDetails: { select: { mentorUid: true } },
};
const GRANT_ACCESS_INCLUDE = {
  investigators: { select: { userId: true, uid: true } },
  reviews: { select: { reviewerId: true } },
};
const IPR_ACCESS_INCLUDE = {
  contributors: { select: { userId: true, uid: true } },
  reviews: { select: { reviewerId: true } },
  applicantDetails: { select: { mentorUid: true, inventorUid: true } },
};

/** Personal relationship (not a staff permission) to a research contribution. */
const isContributionParticipant = (user, c) => {
  if (!user || !c) return false;
  if (c.applicantUserId === user.id || c.currentReviewerId === user.id) return true;
  if (Array.isArray(c.authors) && c.authors.some((a) => matchesUser(user, a))) return true;
  if (reviewedBy(user, c.reviews)) return true;
  return isMentor(user, c.applicantDetails);
};

/** May the user view this research contribution (and download its documents)? */
const canViewContribution = (user, c) =>
  Boolean(c) && (isSuperadmin(user) || isContributionParticipant(user, c) || hasAnyPermission(user, RESEARCH_STAFF_PERMISSIONS));

/** Personal relationship (not a staff permission) to a grant application. */
const isGrantParticipant = (user, g) => {
  if (!user || !g) return false;
  if (g.applicantUserId === user.id || g.currentReviewerId === user.id) return true;
  if (Array.isArray(g.investigators) && g.investigators.some((i) => matchesUser(user, i))) return true;
  return reviewedBy(user, g.reviews);
};

/** May the user view this grant application (and download its documents)? */
const canViewGrant = (user, g) => {
  if (!user || !g) return false;
  if (isSuperadmin(user)) return true;
  if (isGrantParticipant(user, g)) return true;
  return hasAnyPermission(user, GRANT_STAFF_PERMISSIONS);
};

/** Personal relationship (not a staff permission) to an IPR application. */
const isIprParticipant = (user, a) => {
  if (!user || !a) return false;
  if (a.applicantUserId === user.id || a.currentReviewerId === user.id) return true;
  if (Array.isArray(a.contributors) && a.contributors.some((c) => matchesUser(user, c))) return true;
  if (reviewedBy(user, a.reviews)) return true;
  if (isMentor(user, a.applicantDetails)) return true;
  return Boolean(user.uid && a.applicantDetails?.inventorUid === user.uid);
};

/** May the user view this IPR application? */
const canViewIpr = (user, a) =>
  Boolean(a) && (isSuperadmin(user) || isIprParticipant(user, a) || hasAnyPermission(user, IPR_STAFF_PERMISSIONS));

/**
 * May the user view this progress tracker? Trackers are private working notes:
 * owner, or research staff once it has been linked to a submitted contribution.
 */
const canViewTracker = (user, t) => {
  if (!user || !t) return false;
  if (isSuperadmin(user) || t.userId === user.id) return true;
  return Boolean(t.researchContributionId) && hasAnyPermission(user, RESEARCH_STAFF_PERMISSIONS);
};

/** Error to throw from services when access is denied: indistinguishable from a missing row. */
const notFound = (message = 'Not found') => {
  const err = new Error(message);
  err.statusCode = 404;
  err.isOperational = true;
  return err;
};

module.exports = {
  RESEARCH_STAFF_PERMISSIONS,
  GRANT_STAFF_PERMISSIONS,
  IPR_STAFF_PERMISSIONS,
  CONTRIBUTION_ACCESS_INCLUDE,
  GRANT_ACCESS_INCLUDE,
  IPR_ACCESS_INCLUDE,
  hasAnyPermission,
  isContributionParticipant,
  isGrantParticipant,
  isIprParticipant,
  canViewContribution,
  canViewGrant,
  canViewIpr,
  canViewTracker,
  notFound,
};
