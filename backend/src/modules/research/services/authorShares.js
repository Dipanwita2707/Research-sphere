/**
 * Author incentive shares: the ONE place that splits a contribution's incentive pool and
 * points among its authors. Every figure an author sees goes through computeAuthorShares():
 *
 *   - the submission form preview      POST /research/incentive-preview (ContributionService.previewIncentiveShares)
 *   - the shares saved with the work   ContributionService._createAuthors (create, edit, Scopus import)
 *   - the shares credited at approval  ReviewService._creditIncentivesToAuthors
 *
 * IncentiveCalculator works out each author's exact (unrounded) share from the policy;
 * this module rounds them together with the largest-remainder method so the authors'
 * rupees and points never add up to more than the pool. Ties are broken by author position,
 * then by list order, so the same authors always get the same numbers.
 */
const { IncentiveCalculator } = require('./incentive-calculator');

const NO_POLICY_WARNING_MESSAGE =
  'No incentive policy covers this publication date/type — incentive will be ₹0 unless a policy is configured';

const EPS = 1e-6;

function normalizeRole(role) {
  if (role === 'first_and_corresponding' || role === 'first_and_corresponding_author') return 'first_and_corresponding_author';
  if (role === 'first' || role === 'first_author') return 'first_author';
  if (role === 'corresponding' || role === 'corresponding_author') return 'corresponding_author';
  return 'co_author'; // co_author, co, senior_author, position-based "author", unknown
}

const toPosition = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Round `raws` to whole numbers that add up to round(Σ raws), never more than `pool`
 * (largest-remainder / Hamilton method). If the exact shares themselves exceed the pool
 * (a misconfigured split), they are first scaled down to the pool.
 *
 * @param {number[]} raws     exact shares (≥ 0)
 * @param {number}   pool     the pool they are taken from
 * @param {number[]} tieOrder rank used to break equal remainders (lower wins)
 * @returns {number[]} whole shares, same order as `raws`
 */
function apportion(raws, pool, tieOrder = raws.map((_, i) => i)) {
  const clean = raws.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  const cap = Number.isFinite(pool) && pool > 0 ? Math.floor(pool + EPS) : 0;
  const shares = sum > cap + EPS && sum > 0 ? clean.map((v) => (v * cap) / sum) : clean;
  const target = Math.min(Math.round(Math.min(sum, cap) + 1e-9), cap);
  const floors = shares.map((v) => Math.floor(v + EPS));
  let left = target - floors.reduce((a, b) => a + b, 0);
  const order = shares
    .map((v, i) => ({ i, rem: Math.round((v - floors[i]) * 1e9) }))
    .filter((o) => o.rem > 0)
    .sort((a, b) => b.rem - a.rem || tieOrder[a.i] - tieOrder[b.i] || a.i - b.i);
  for (const o of order) {
    if (left <= 0) break;
    floors[o.i] += 1;
    left -= 1;
  }
  return floors;
}

const pct = (n) => `${Number(Number(n).toFixed(2))}%`;
const ordinal = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

/** "role-based: first 35% · corresponding 30% · co-authors share 35%" and friends. */
function describeSplit(policy) {
  if (!policy) return null;
  switch (policy.distributionMethod) {
    case 'author_role_based': {
      const p = policy.percentages || {};
      return `role-based: first ${pct(p.firstAuthor)} · corresponding ${pct(p.correspondingAuthor)} · co-authors share ${pct(p.coAuthors)}`;
    }
    case 'author_position_based': {
      const parts = Object.entries(policy.positionPercentages || {})
        .map(([pos, v]) => `${ordinal(Number(pos))} ${pct(v)}`);
      return `position-based: ${[...parts, '6th+ 0%'].join(' · ')}`;
    }
    case 'single_presenter':
      return 'full amount to the presenter';
    case 'equal_split':
      return 'split equally among all authors';
    default:
      return null;
  }
}

/**
 * Split the pool among the authors.
 *
 * @param {object} prisma                      client (or transaction client) for policy lookups
 * @param {object} args
 * @param {object} args.contributionData       toIncentiveInput() output
 * @param {string} args.publicationType
 * @param {Array<{role, isInternal, isStudent, position}>} args.authors  in paper order
 * @returns {Promise<object>} { publicationType, policy, pool, totals, authors, warnings, incentiveStatus }
 */
async function computeAuthorShares(prisma, { contributionData, publicationType, authors = [] }) {
  const list = authors.map((a, index) => ({
    index,
    role: normalizeRole(a.role),
    isInternal: a.isInternal !== false,
    isStudent: Boolean(a.isStudent),
    position: toPosition(a.position),
  }));
  const totalAuthors = Math.max(list.length, 1);
  const coAuthors = list.filter((a) => a.role === 'co_author');
  const internalCoAuthors = coAuthors.filter((a) => a.isInternal);

  const calculator = new IncentiveCalculator(prisma);
  const common = {
    contributionData,
    publicationType,
    totalAuthors,
    coAuthorCount: coAuthors.length,
    internalCoAuthorCount: internalCoAuthors.length,
    internalEmployeeCoAuthorCount: internalCoAuthors.filter((a) => !a.isStudent).length,
  };

  // Sequential: approval runs this on an interactive transaction client.
  const results = [];
  for (const a of list) {
    results.push(await calculator.calculate({
      ...common,
      authorRole: a.role,
      isStudent: a.isStudent,
      isInternal: a.isInternal,
      authorPosition: a.position,
    }));
  }

  // Pool and policy come from an internal author's result (external results are blank).
  const internalResults = results.filter((_, i) => list[i].isInternal);
  let reference = internalResults[0];
  if (!reference) {
    reference = await calculator.calculate({
      contributionData, publicationType, authorRole: 'first_and_corresponding_author', totalAuthors: 1, isInternal: true,
    });
  }
  const poolAmount = Math.max(0, ...results.map((r) => r.totalPoolAmount || 0), reference.totalPoolAmount || 0);
  const poolPoints = Math.max(0, ...results.map((r) => r.totalPoolPoints || 0), reference.totalPoolPoints || 0);

  const tieOrder = list.map((a) => (a.position ?? 1e6) * 1e4 + a.index);
  const amounts = apportion(results.map((r) => r.rawIncentive), poolAmount, tieOrder);
  const points = apportion(results.map((r) => r.rawPoints), poolPoints, tieOrder);

  const policyFound = internalResults.length
    ? internalResults.every((r) => r.policyFound !== false)
    : reference.policyFound !== false;
  const usedDefaultPolicy = (internalResults.length ? internalResults : [reference]).some((r) => r.usedDefaultPolicy);
  const reason = (internalResults.find((r) => r.policyFound === false) || (!internalResults.length && reference.policyFound === false ? reference : null))?.reason || null;
  const summary = (internalResults.find((r) => r.policy) || reference).policy || null;

  const policy = {
    found: policyFound,
    usedDefault: usedDefaultPolicy,
    id: summary?.id || null,
    name: summary?.name || null,
    distributionMethod: summary?.distributionMethod || null,
    percentages: summary?.percentages || null,
    positionPercentages: summary?.positionPercentages || null,
    description: policyFound ? describeSplit(summary) : null,
    reason,
  };

  const totalAmount = amounts.reduce((a, b) => a + b, 0);
  const totalPoints = points.reduce((a, b) => a + b, 0);

  return {
    publicationType,
    policy,
    pool: { amount: poolAmount, points: poolPoints },
    totals: {
      amount: totalAmount,
      points: totalPoints,
      unallocatedAmount: Math.max(0, Math.floor(poolAmount + EPS) - totalAmount),
      unallocatedPoints: Math.max(0, Math.floor(poolPoints + EPS) - totalPoints),
    },
    authors: list.map((a, i) => ({ ...a, incentive: amounts[i], points: points[i] })),
    warnings: buildWarnings({ list, policy, poolAmount }),
    incentiveStatus: {
      hasInternalAuthors: internalResults.length > 0,
      policyFound,
      usedDefaultPolicy,
      reason,
    },
  };
}

function buildWarnings({ list, policy, poolAmount }) {
  const warnings = [];
  const indexes = (pred) => list.filter(pred).map((a) => a.index);

  if (!policy.found) {
    warnings.push({ code: 'NO_INCENTIVE_POLICY', message: NO_POLICY_WARNING_MESSAGE, reason: policy.reason });
    return warnings;
  }
  if (policy.usedDefault) {
    warnings.push({
      code: 'DEFAULT_POLICY_USED',
      message: 'No policy is configured for this date: the built-in default amounts apply.',
    });
  }
  if (!poolAmount) return warnings;

  if (policy.distributionMethod === 'author_position_based') {
    const beyond = indexes((a) => a.isInternal && a.position !== null && a.position >= 6);
    if (beyond.length) {
      warnings.push({ code: 'POSITION_BEYOND_FIFTH', message: 'Authors in position 6 or later receive ₹0 and 0 points.', authorIndexes: beyond });
    }
  }

  const externals = list.filter((a) => !a.isInternal);
  if (externals.length) {
    const roleBased = policy.distributionMethod === 'author_role_based';
    const leadExternals = indexes((a) => !a.isInternal && a.role !== 'co_author');
    const externalCo = indexes((a) => !a.isInternal && a.role === 'co_author');
    const internalCo = list.filter((a) => a.isInternal && a.role === 'co_author').length;
    if (roleBased && leadExternals.length) {
      warnings.push({
        code: 'EXTERNAL_SHARE_FORFEITED',
        message: 'External first/corresponding authors receive nothing; their percentage is forfeited, not redistributed.',
        authorIndexes: leadExternals,
      });
    }
    if (roleBased && externalCo.length) {
      warnings.push(internalCo
        ? { code: 'EXTERNAL_SHARE_REDISTRIBUTED', message: 'External co-authors receive nothing; the co-author share goes to the internal co-authors.', authorIndexes: externalCo }
        : { code: 'EXTERNAL_SHARE_FORFEITED', message: 'External co-authors receive nothing, and with no internal co-author the co-author share is forfeited.', authorIndexes: externalCo });
    }
    if (!roleBased) {
      warnings.push({
        code: 'EXTERNAL_SHARE_FORFEITED',
        message: 'External authors receive nothing; their share is forfeited, not redistributed.',
        authorIndexes: externals.map((a) => a.index),
      });
    }
  }
  return warnings;
}

/**
 * Share inputs for stored author rows (approval, re-credit). Students earn money but no
 * points: an author is a student when the linked account is a student or the row was saved
 * as a student author.
 */
async function storedAuthorsForShares(dbClient, authors = []) {
  const linkedUserIds = authors.map((a) => a.userId).filter(Boolean);
  const studentUserIds = new Set(
    linkedUserIds.length
      ? (await dbClient.userLogin.findMany({
          where: { id: { in: linkedUserIds }, role: 'student' },
          select: { id: true },
        })).map((u) => u.id)
      : [],
  );
  return authors.map((a) => ({
    role: a.authorType || 'co_author',
    // isInternal is set when authors are saved; authorCategory never contains "external".
    isInternal: a.isInternal !== false,
    isStudent: Boolean((a.userId && studentUserIds.has(a.userId)) || a.authorCategory === 'student'),
    position: Number(a.authorPosition || a.authorOrder) || null,
  }));
}

module.exports = {
  computeAuthorShares,
  storedAuthorsForShares,
  apportion,
  describeSplit,
  normalizeRole,
  NO_POLICY_WARNING_MESSAGE,
};
