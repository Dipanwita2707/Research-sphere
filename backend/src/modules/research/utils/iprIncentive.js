/**
 * IPR incentive helpers shared by DRD publication (drdReview.controller) and the payout
 * backfill script. Incentive is split equally among internal inventors at publication and
 * each inventor's share becomes one line in the payout ledger.
 */
const payoutService = require('../../finance/services/incentivePayout.service');
const { policyWindowWhere } = require('./policyWindow');
const { toNumber, assertWithinCap } = require('./policyMath');

const INVENTOR_ROLES = ['inventor', 'co-inventor', 'primary_inventor', 'co_inventor'];

/** Statuses an IPR reaches only after publication, i.e. after its incentive was credited. */
const IPR_CREDITED_STATUSES = ['published', 'under_finance_review', 'finance_approved', 'finance_rejected', 'completed'];

const DEFAULT_INCENTIVE_POLICIES = {
  patent: { baseIncentiveAmount: 50000, basePoints: 50, splitPolicy: 'equal' },
  copyright: { baseIncentiveAmount: 15000, basePoints: 20, splitPolicy: 'equal' },
  trademark: { baseIncentiveAmount: 10000, basePoints: 15, splitPolicy: 'equal' },
  design: { baseIncentiveAmount: 20000, basePoints: 25, splitPolicy: 'equal' },
};

function displayNameOf(user) {
  const p = user?.employeeDetails || user?.studentLogin;
  return p?.displayName || [p?.firstName, p?.lastName].filter(Boolean).join(' ') || user?.uid || null;
}

const USER_NAME_SELECT = {
  id: true,
  uid: true,
  role: true,
  employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
  studentLogin: { select: { firstName: true, lastName: true, displayName: true } },
};

/**
 * The IPR incentive policy in force on `onDate` (enabled and inside its effective window,
 * the same rule as ipr.repository.findActivePolicy). Without one the built-in defaults are
 * used and `usedDefaultPolicy` is true, so the caller can record that in the history.
 */
async function resolveIprPolicy(client, iprTypeRaw, onDate = new Date()) {
  const iprType = String(iprTypeRaw || 'patent').toLowerCase();
  const policy = await client.incentivePolicy.findFirst({
    where: { iprType, ...policyWindowWhere(onDate) },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (policy) return { iprType, policy, usedDefaultPolicy: false };
  return {
    iprType,
    policy: DEFAULT_INCENTIVE_POLICIES[iprType] || DEFAULT_INCENTIVE_POLICIES.patent,
    usedDefaultPolicy: true,
  };
}

/**
 * What publication pays for an IPR: the policy's base amount and points, split equally
 * (floored) among the inventors. Every preview uses this so it never shows a different
 * amount. (filingTypeMultiplier / projectTypeBonus / primaryInventorShare are stored on
 * policies but are not applied at publication.)
 */
function computeIprIncentive(policy, inventorCount = 1) {
  const totalIncentive = assertWithinCap(toNumber(policy?.baseIncentiveAmount), 'this IPR');
  const totalPoints = toNumber(policy?.basePoints);
  const count = Math.max(Math.floor(toNumber(inventorCount, 1)), 1);
  return {
    totalIncentive,
    totalPoints,
    inventorCount: count,
    perInventorIncentive: Math.floor(totalIncentive / count),
    perInventorPoints: Math.floor(totalPoints / count),
  };
}

/**
 * Internal inventors (with an account) of an IPR application, plus the applicant when not
 * already listed. Each entry: { userId, name, role }.
 */
async function resolveIprInventors(client, application) {
  const contributors = await client.iprContributor.findMany({
    where: { iprApplicationId: application.id, role: { in: INVENTOR_ROLES }, userId: { not: null } },
    include: { user: { select: USER_NAME_SELECT } },
  });
  const inventors = [];
  const seen = new Set();
  for (const c of contributors) {
    if (seen.has(c.userId)) continue;
    seen.add(c.userId);
    inventors.push({ userId: c.userId, name: c.name || displayNameOf(c.user), role: c.role, isStudent: c.user?.role === 'student' });
  }
  if (application.applicantUserId && !seen.has(application.applicantUserId)) {
    const applicant = await client.userLogin.findUnique({ where: { id: application.applicantUserId }, select: USER_NAME_SELECT });
    inventors.push({ userId: application.applicantUserId, name: displayNameOf(applicant) || 'Applicant', role: 'primary_inventor', isStudent: applicant?.role === 'student' });
  }
  return inventors;
}

/** Ledger lines for an IPR's inventors (idempotent via the ledger's unique key). */
async function createIprPayoutLines(tx, application, { inventors, perInventorIncentive, perInventorPoints, approvedAt, actorId }) {
  if (!(Number(perInventorIncentive) > 0 || Number(perInventorPoints) > 0)) return { created: 0, skippedDuplicates: 0 };
  return payoutService.createLines(tx, {
    universityId: application.universityId,
    sourceType: 'ipr',
    sourceId: application.id,
    workType: String(application.iprType || 'patent').toLowerCase(),
    title: application.title,
    referenceNumber: application.applicationNumber,
    workKey: null,
    approvedAt,
    actorId,
    payees: inventors
      .filter((i) => i.userId)
      .map((i) => ({ userId: i.userId, name: i.name, role: i.role, amount: Number(perInventorIncentive) || 0, points: i.isStudent ? 0 : Number(perInventorPoints) || 0 })),
  });
}

module.exports = {
  INVENTOR_ROLES,
  IPR_CREDITED_STATUSES,
  DEFAULT_INCENTIVE_POLICIES,
  resolveIprPolicy,
  computeIprIncentive,
  resolveIprInventors,
  createIprPayoutLines,
};
