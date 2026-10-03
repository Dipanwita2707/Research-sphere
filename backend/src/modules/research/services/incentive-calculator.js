/**
 * IncentiveCalculator
 * Encapsulates the calculateIncentives logic extracted from contribution.controller.js.
 * Accepts a single structured input object instead of 12 positional parameters.
 * Accepts a prisma client via constructor for testability.
 */

const { toNumber, assertWithinCap } = require('../utils/policyMath');
const { policyWindowWhere } = require('../utils/policyWindow');

const NO_POLICY_REASON = 'No incentive policy covers this publication date/type';

/**
 * Built-in defaults the calculator pays when no book / chapter / conference policy is
 * configured (research papers and grants have none). Exported so policy previews show
 * exactly what would be paid.
 */
const DEFAULT_BOOK_POLICY = Object.freeze({
  authoredIncentiveAmount: 50000, authoredPoints: 50,
  editedIncentiveAmount: 40000, editedPoints: 40,
  splitPolicy: 'equal',
  indexingBonuses: Object.freeze({ scopus_indexed: 10000, non_indexed: 0, sgt_publication_house: 2000 }),
  internationalBonus: 5000,
});
const DEFAULT_CONFERENCE_QUARTILE_INCENTIVES = Object.freeze([
  { quartile: 'Top 1%', incentiveAmount: 60000, points: 60 },
  { quartile: 'Top 5%', incentiveAmount: 50000, points: 50 },
  { quartile: 'Q1', incentiveAmount: 40000, points: 40 },
  { quartile: 'Q2', incentiveAmount: 25000, points: 25 },
  { quartile: 'Q3', incentiveAmount: 12000, points: 12 },
  { quartile: 'Q4', incentiveAmount: 5000, points: 5 }
]);
const DEFAULT_CONFERENCE_ROLE_PERCENTAGES = Object.freeze([
  { role: 'first_author', percentage: 40 },
  { role: 'corresponding_author', percentage: 40 }
]);
const DEFAULT_CONFERENCE_FLAT = Object.freeze({
  paper_not_indexed: {
    national: { incentiveAmount: 10000, points: 10 },
    international: { incentiveAmount: 15000, points: 15 }
  },
  keynote_speaker_invited_talks: {
    national: { incentiveAmount: 10000, points: 10 },
    international: { incentiveAmount: 20000, points: 20 }
  },
  organizer_coordinator_member: {
    national: { incentiveAmount: 5000, points: 5 },
    international: { incentiveAmount: 10000, points: 10 }
  }
});

/**
 * Policy-shaped view of the conference defaults for a sub-type (what the calculator uses
 * without a configured policy: default quartile table and 40/40 split for Scopus papers, the
 * national/international flat amounts otherwise, and no bonuses).
 */
function defaultConferencePolicy(conferenceSubType) {
  if (conferenceSubType === 'paper_indexed_scopus') {
    return {
      conferenceSubType,
      quartileIncentives: DEFAULT_CONFERENCE_QUARTILE_INCENTIVES.map((q) => ({ ...q })),
      rolePercentages: DEFAULT_CONFERENCE_ROLE_PERCENTAGES.map((r) => ({ ...r })),
      flatIncentiveAmount: null, flatPoints: null, internationalBonus: null, bestPaperAwardBonus: null,
    };
  }
  const levels = DEFAULT_CONFERENCE_FLAT[conferenceSubType] || DEFAULT_CONFERENCE_FLAT.paper_not_indexed;
  return {
    conferenceSubType,
    quartileIncentives: [], rolePercentages: [],
    flatIncentiveAmount: null, flatPoints: null, internationalBonus: null, bestPaperAwardBonus: null,
    defaultLevels: { national: { ...levels.national }, international: { ...levels.international } },
  };
}

const isFirstAndCorresponding = (role) => role === 'first_and_corresponding_author' || role === 'first_and_corresponding';

class IncentiveCalculator {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Calculate incentive amount and points for a single author.
   *
   * @param {object} input
   * @param {object}  input.contributionData
   * @param {string}  input.publicationType
   * @param {string}  input.authorRole
   * @param {boolean} [input.isStudent=false]
   * @param {number}  [input.sjrValue=0]
   * @param {number}  [input.coAuthorCount=0]
   * @param {number}  [input.totalAuthors=1]
   * @param {boolean} [input.isInternal=true]
   * @param {number}  [input.internalCoAuthorCount=0]
   * @param {number}  [input.externalFirstCorrespondingPct=0]
   * @param {number}  [input.internalEmployeeCoAuthorCount=0]
   * @param {number|null} [input.authorPosition=null]
   * @returns {Promise<{ totalPoolAmount, totalPoolPoints, incentiveAmount, points,
   *   policyFound: boolean, usedDefaultPolicy: boolean, reason?: string }>}
   *   policyFound false (with a reason) when no policy applies: the amount is then 0 and
   *   callers must surface that instead of silently paying nothing. usedDefaultPolicy true
   *   when built-in defaults were used because no policy is configured (books, chapters,
   *   conferences). Errors other than "no policy" (database, programming, a pool above the
   *   per-work cap) are logged and rethrown, never turned into a silent 0.
   */
  async calculate(input) {
    const {
      contributionData,
      publicationType,
      authorRole,
      isStudent = false,
      sjrValue = 0,
      coAuthorCount = 0,
      totalAuthors = 1,
      isInternal = true,
      internalCoAuthorCount = 0,
      externalFirstCorrespondingPct = 0,
      internalEmployeeCoAuthorCount = 0,
      authorPosition = null
    } = input;

    try {
      if (!isInternal) return this._zero();

      const publicationDate = contributionData.publicationDate
        ? new Date(contributionData.publicationDate) : new Date();

      const isBook = publicationType === 'book';
      const isBookChapter = publicationType === 'book_chapter';
      const isConference = publicationType === 'conference_paper';

      if (isBook || isBookChapter) {
        return await this._calculateBook(contributionData, isBook, totalAuthors, isStudent, publicationDate);
      }

      if (isConference) {
        return await this._calculateConference(
          contributionData, authorRole, isStudent, totalAuthors,
          internalCoAuthorCount, internalEmployeeCoAuthorCount,
          externalFirstCorrespondingPct, coAuthorCount, publicationDate
        );
      }

      return await this._calculateResearchPaper(
        contributionData, publicationType, authorRole, isStudent,
        totalAuthors, internalCoAuthorCount, internalEmployeeCoAuthorCount,
        externalFirstCorrespondingPct, coAuthorCount, authorPosition, publicationDate
      );
    } catch (error) {
      console.error('[IncentiveCalculator] Error:', error.message);
      throw error;
    }
  }

  /** Reject an implausible pool or share (e.g. Decimal string concatenation) before paying. */
  _checked(result, label) {
    assertWithinCap(result.totalPoolAmount, label);
    assertWithinCap(result.incentiveAmount, label);
    return result;
  }

  // ─── Book / Book Chapter ─────────────────────────────────────────────────

  async _calculateBook(data, isBook, totalAuthors, isStudent, publicationDate) {
    const policy = await this._fetchBookPolicy(isBook, publicationDate);
    // No configured policy: the built-in defaults apply, and the result says so.
    const activePolicy = policy || this._defaultBookPolicy();

    // Every policy value is a Prisma Decimal or JSON value: convert before adding, or
    // 70000 + "2000" concatenates. A configured 0 is honoured (no `|| default`).
    const isAuthored = data.bookType === 'authored';
    let baseIncentive = toNumber(isAuthored ? activePolicy.authoredIncentiveAmount : activePolicy.editedIncentiveAmount);
    const basePoints = toNumber(isAuthored ? activePolicy.authoredPoints : activePolicy.editedPoints);

    const bonuses = activePolicy.indexingBonuses || {};
    if (data.indexing === 'scopus_indexed') baseIncentive += toNumber(bonuses.scopus_indexed);
    else if (data.indexing === 'non_indexed') baseIncentive += toNumber(bonuses.non_indexed);
    else if (data.indexing === 'sgt_publication_house') baseIncentive += toNumber(bonuses.sgt_publication_house);

    if (data.isInternational) baseIncentive += toNumber(activePolicy.internationalBonus);

    const count = Math.max(toNumber(totalAuthors, 1), 1);
    return this._checked(this._share({
      totalPoolAmount: baseIncentive,
      totalPoolPoints: basePoints,
      rawIncentive: baseIncentive / count,
      rawPoints: isStudent ? 0 : basePoints / count,
      ...this._policyMeta(policy, {
        defaultsIntended: true,
        summary: this._splitSummary(policy, isBook ? 'Default book policy' : 'Default book chapter policy', 'equal_split'),
      }),
    }), isBook ? 'this book' : 'this book chapter');
  }

  async _fetchBookPolicy(isBook, publicationDate) {
    const model = isBook ? 'bookIncentivePolicy' : 'bookChapterIncentivePolicy';
    return this.prisma[model].findFirst({
      where: policyWindowWhere(publicationDate),
      orderBy: { effectiveFrom: 'desc' }
    });
  }

  _defaultBookPolicy() {
    return { ...DEFAULT_BOOK_POLICY, indexingBonuses: { ...DEFAULT_BOOK_POLICY.indexingBonuses } };
  }

  // ─── Conference Paper ────────────────────────────────────────────────────

  async _calculateConference(
    data, authorRole, isStudent, totalAuthors,
    internalCoAuthorCount, internalEmployeeCoAuthorCount,
    externalFirstCorrespondingPct, coAuthorCount, publicationDate
  ) {
    const { conferenceSubType } = data;
    if (!conferenceSubType) return this._noPolicy('Conference sub-type is missing');

    const policy = await this._fetchConferencePolicy(conferenceSubType, publicationDate);

    if (conferenceSubType === 'paper_indexed_scopus') {
      return this._calculateConferenceScopus(
        data, policy, authorRole, isStudent, totalAuthors,
        internalCoAuthorCount, internalEmployeeCoAuthorCount,
        externalFirstCorrespondingPct, coAuthorCount
      );
    }

    return this._calculateConferenceFlat(data, policy, conferenceSubType, isStudent, totalAuthors);
  }

  async _fetchConferencePolicy(conferenceSubType, publicationDate) {
    return this.prisma.conferenceIncentivePolicy.findFirst({
      where: { conferenceSubType, ...policyWindowWhere(publicationDate) },
      orderBy: { effectiveFrom: 'desc' }
    });
  }

  _calculateConferenceScopus(
    data, policy, authorRole, isStudent, totalAuthors,
    internalCoAuthorCount, internalEmployeeCoAuthorCount,
    externalFirstCorrespondingPct, coAuthorCount
  ) {
    const defaultQuartileIncentives = DEFAULT_CONFERENCE_QUARTILE_INCENTIVES;
    const defaultRolePercentages = DEFAULT_CONFERENCE_ROLE_PERCENTAGES;

    const quartileIncentives = policy?.quartileIncentives || defaultQuartileIncentives;
    const rolePercentages = policy?.rolePercentages || defaultRolePercentages;

    const firstRaw = rolePercentages.find(r => r.role === 'first_author')?.percentage;
    const correspondingRaw = rolePercentages.find(r => r.role === 'corresponding_author')?.percentage;

    if (firstRaw === undefined || correspondingRaw === undefined) {
      // A misconfigured policy is "no usable policy", not a crash or a silent 0.
      return this._noPolicy('The conference policy has no first/corresponding author percentages configured');
    }
    const firstAuthorPct = toNumber(firstRaw);
    const correspondingAuthorPct = toNumber(correspondingRaw);

    const coAuthorTotalPct = 100 - firstAuthorPct - correspondingAuthorPct;

    let totalAmount = 0;
    let totalPoints = 0;
    const quartile = data.proceedingsQuartile;
    if (quartile) {
      const displayQuartile = this._toDisplayQuartile(quartile);
      const match = quartileIncentives.find(q =>
        String(q.quartile).toUpperCase() === displayQuartile.toUpperCase() ||
        String(q.quartile).toUpperCase() === quartile.toUpperCase()
      );
      if (match) { totalAmount = toNumber(match.incentiveAmount); totalPoints = toNumber(match.points); }
    }

    if (data.conferenceType === 'international' && policy?.internationalBonus) {
      totalAmount += toNumber(policy.internationalBonus);
    }
    if (data.conferenceBestPaperAward === 'yes' && policy?.bestPaperAwardBonus) {
      totalAmount += toNumber(policy.bestPaperAwardBonus);
    }

    const rolePercentage = this._resolveRolePercentage(
      authorRole, totalAuthors, internalCoAuthorCount, coAuthorCount,
      firstAuthorPct, correspondingAuthorPct, coAuthorTotalPct, externalFirstCorrespondingPct
    );

    let pointPercentage = rolePercentage;
    if (authorRole === 'co_author' && totalAuthors > 1) {
      pointPercentage = coAuthorTotalPct / Math.max(internalEmployeeCoAuthorCount, 1);
    }

    return this._checked(this._share({
      totalPoolAmount: totalAmount, totalPoolPoints: totalPoints,
      rawIncentive: (totalAmount * rolePercentage) / 100,
      rawPoints: isStudent ? 0 : (totalPoints * pointPercentage) / 100,
      ...this._policyMeta(policy, {
        defaultsIntended: true,
        summary: {
          ...this._splitSummary(policy, 'Default conference policy', 'author_role_based'),
          percentages: { firstAuthor: firstAuthorPct, correspondingAuthor: correspondingAuthorPct, coAuthors: coAuthorTotalPct },
        },
      }),
    }), 'this conference paper');
  }

  _calculateConferenceFlat(data, policy, conferenceSubType, isStudent, totalAuthors) {
    const defaults = DEFAULT_CONFERENCE_FLAT;

    const isInternational = data.conferenceType === 'international' ||
      data.nationalInternational === 'international' || data.conferenceHeldLocation === 'abroad';

    let baseIncentive = 0;
    let basePoints = 0;

    if (policy) {
      baseIncentive = toNumber(policy.flatIncentiveAmount);
      basePoints = toNumber(policy.flatPoints);
      if (isInternational && policy.internationalBonus) baseIncentive += toNumber(policy.internationalBonus);
    } else {
      const sub = defaults[conferenceSubType] || defaults.paper_not_indexed;
      const level = isInternational ? sub.international : sub.national;
      baseIncentive = level.incentiveAmount;
      basePoints = level.points;
    }

    if (data.conferenceBestPaperAward === 'yes' && policy?.bestPaperAwardBonus) {
      baseIncentive += toNumber(policy.bestPaperAwardBonus);
    }

    const isSinglePresenter = conferenceSubType === 'keynote_speaker_invited_talks' ||
      conferenceSubType === 'organizer_coordinator_member';

    const divisor = isSinglePresenter ? 1 : Math.max(totalAuthors, 1);

    return this._checked(this._share({
      totalPoolAmount: baseIncentive, totalPoolPoints: basePoints,
      rawIncentive: baseIncentive / divisor,
      rawPoints: isStudent ? 0 : basePoints / divisor,
      ...this._policyMeta(policy, {
        defaultsIntended: true,
        summary: this._splitSummary(policy, 'Default conference policy', isSinglePresenter ? 'single_presenter' : 'equal_split'),
      }),
    }), 'this conference contribution');
  }

  // ─── Research Paper ──────────────────────────────────────────────────────

  async _calculateResearchPaper(
    data, publicationType, authorRole, isStudent,
    totalAuthors, internalCoAuthorCount, internalEmployeeCoAuthorCount,
    externalFirstCorrespondingPct, coAuthorCount, authorPosition, publicationDate
  ) {
    const policy = await this._fetchResearchPolicy(publicationType, publicationDate);
    // Research papers have no built-in defaults: without a policy nothing is payable, and
    // the caller is told so (policyFound:false) instead of receiving a silent 0.
    if (!policy) return this._noPolicy();
    if (policy.first_author_percentage == null || policy.corresponding_author_percentage == null) {
      return this._noPolicy('The research incentive policy has no author percentages configured');
    }
    const distributionMethod = policy.distributionMethod || 'author_role_based';
    const meta = this._policyMeta(policy, { summary: this._researchSummary(policy, distributionMethod) });

    if (distributionMethod === 'author_position_based' && authorPosition !== null && authorPosition >= 6) {
      return this._zero(meta);
    }

    const { totalAmount, totalPoints } = this._computeResearchPool(data, policy);
    if (totalAmount === 0) return this._zero(meta);

    const firstAuthorPct = toNumber(policy.first_author_percentage);
    const correspondingAuthorPct = toNumber(policy.corresponding_author_percentage);
    const coAuthorTotalPct = 100 - firstAuthorPct - correspondingAuthorPct;

    let rolePercentage;
    if (totalAuthors === 1 && isFirstAndCorresponding(authorRole)) {
      // A sole author who is both first and corresponding author receives the whole pool.
      rolePercentage = 100;
    } else if (distributionMethod === 'author_position_based') {
      rolePercentage = this._resolvePositionPercentage(authorPosition, policy);
    } else {
      rolePercentage = this._resolveRolePercentage(
        authorRole, totalAuthors, internalCoAuthorCount, coAuthorCount,
        firstAuthorPct, correspondingAuthorPct, coAuthorTotalPct, externalFirstCorrespondingPct
      );
    }

    let pointPercentage = rolePercentage;
    // Role-based policies share co-author points equally among employee co-authors; a
    // position-based policy pays points by position, exactly like the money.
    if (authorRole === 'co_author' && distributionMethod !== 'author_position_based') {
      pointPercentage = coAuthorTotalPct / Math.max(internalEmployeeCoAuthorCount, 1);
    }

    return this._checked(this._share({
      totalPoolAmount: totalAmount, totalPoolPoints: totalPoints,
      rawIncentive: (totalAmount * rolePercentage) / 100,
      rawPoints: isStudent ? 0 : (totalPoints * pointPercentage) / 100,
      ...meta,
    }), 'this research paper');
  }

  async _fetchResearchPolicy(publicationType, publicationDate) {
    return this.prisma.researchIncentivePolicy.findFirst({
      where: { publicationType, ...policyWindowWhere(publicationDate) },
      orderBy: { effectiveFrom: 'desc' }
    });
  }

  _computeResearchPool(data, policy) {
    const indexingBonuses = policy?.indexingBonuses || {};
    const nestedIncentives = indexingBonuses.nestedCategoryIncentives || {};

    const scopusQuartileIncentives = indexingBonuses.quartileIncentives || [
      { quartile: 'Top 1%', incentiveAmount: 75000, points: 75 },
      { quartile: 'Top 5%', incentiveAmount: 60000, points: 60 },
      { quartile: 'Q1', incentiveAmount: 50000, points: 50 },
      { quartile: 'Q2', incentiveAmount: 30000, points: 30 },
      { quartile: 'Q3', incentiveAmount: 15000, points: 15 },
      { quartile: 'Q4', incentiveAmount: 5000, points: 5 }
    ];

    const wosSjrIncentives = indexingBonuses.sjrRanges || [
      { minSJR: 2.0, maxSJR: 999, incentiveAmount: 50000, points: 50 },
      { minSJR: 1.0, maxSJR: 1.99, incentiveAmount: 30000, points: 30 },
      { minSJR: 0.5, maxSJR: 0.99, incentiveAmount: 15000, points: 15 },
      { minSJR: 0.0, maxSJR: 0.49, incentiveAmount: 5000, points: 5 }
    ];

    const naasRatingIncentives = nestedIncentives.naasRatingIncentives || [
      { minRating: 10, maxRating: 20, incentiveAmount: 30000, points: 30 },
      { minRating: 8, maxRating: 9.99, incentiveAmount: 20000, points: 20 },
      { minRating: 6, maxRating: 7.99, incentiveAmount: 10000, points: 10 }
    ];

    const indexingCategoryBonuses = indexingBonuses.indexingCategoryBonuses || [
      { category: 'nature_science_lancet_cell_nejm', incentiveAmount: 200000, points: 100 },
      { category: 'subsidiary_if_above_20', incentiveAmount: 100000, points: 50 },
      { category: 'pubmed', incentiveAmount: 15000, points: 15 },
      { category: 'abdc_scopus_wos', incentiveAmount: 20000, points: 20 },
      { category: 'sgtu_in_house', incentiveAmount: 5000, points: 5 },
      { category: 'case_centre_uk', incentiveAmount: 8000, points: 8 }
    ];

    const selectedCategories = data.indexingCategories || [];
    let highestAmount = 0;
    let highestPoints = 0;

    for (const category of selectedCategories) {
      let catAmount = 0;
      let catPoints = 0;

      if (category === 'scopus' && data.quartile) {
        const qVal = data.quartile.toLowerCase();
        const qMap = {
          'top1': 'Top 1%', 'top 1%': 'Top 1%', 'top_1_': 'Top 1%',
          'top5': 'Top 5%', 'top 5%': 'Top 5%', 'top_5_': 'Top 5%',
          'q1': 'Q1', 'q2': 'Q2', 'q3': 'Q3', 'q4': 'Q4'
        };
        const normalized = qMap[qVal] || data.quartile;
        const match = scopusQuartileIncentives.find(q =>
          String(q.quartile).toLowerCase() === normalized.toLowerCase() ||
          String(q.quartile).toLowerCase() === qVal
        );
        if (match) { catAmount = toNumber(match.incentiveAmount); catPoints = toNumber(match.points); }
      } else if (category === 'scie_wos' && data.sjr) {
        const sjrVal = Number(data.sjr);
        const match = wosSjrIncentives.find(r => sjrVal >= toNumber(r.minSJR) && sjrVal <= toNumber(r.maxSJR, Infinity));
        if (match) { catAmount = toNumber(match.incentiveAmount); catPoints = toNumber(match.points); }
      } else if (category === 'naas_rating_6_plus') {
        const rating = Number(data.naasRating);
        if (rating && rating >= 6) {
          const match = naasRatingIncentives.find(r => rating >= toNumber(r.minRating) && rating <= toNumber(r.maxRating, Infinity));
          if (match) { catAmount = toNumber(match.incentiveAmount); catPoints = toNumber(match.points); }
          else {
            const base = indexingCategoryBonuses.find(b => b.category === 'naas_rating_6_plus');
            if (base) { catAmount = toNumber(base.incentiveAmount); catPoints = toNumber(base.points); }
          }
        }
      } else if (category === 'subsidiary_if_above_20') {
        const subIF = Number(data.subsidiaryImpactFactor);
        if (subIF && subIF > 20) {
          const bonus = indexingCategoryBonuses.find(b => b.category === category);
          if (bonus) { catAmount = toNumber(bonus.incentiveAmount); catPoints = toNumber(bonus.points); }
        }
      } else {
        const bonus = indexingCategoryBonuses.find(b => b.category === category);
        if (bonus) { catAmount = toNumber(bonus.incentiveAmount); catPoints = toNumber(bonus.points); }
      }

      if (catAmount > highestAmount) {
        highestAmount = catAmount;
        highestPoints = catPoints;
      }
    }

    return { totalAmount: highestAmount, totalPoints: highestPoints };
  }

  // ─── Shared helpers ──────────────────────────────────────────────────────

  _resolveRolePercentage(
    authorRole, totalAuthors, internalCoAuthorCount, coAuthorCount,
    firstAuthorPct, correspondingAuthorPct, coAuthorTotalPct, externalFirstCorrespondingPct
  ) {
    // A sole author gets the whole pool only as first AND corresponding author; otherwise
    // only the share of the role they hold.
    if (totalAuthors === 1) {
      if (isFirstAndCorresponding(authorRole)) return 100;
      return authorRole === 'corresponding_author' ? correspondingAuthorPct : firstAuthorPct;
    }
    if (totalAuthors === 2 && internalCoAuthorCount === 0 && coAuthorCount === 0) return 50;
    if (authorRole === 'first_and_corresponding_author' || authorRole === 'first_and_corresponding') {
      return firstAuthorPct + correspondingAuthorPct;
    }
    if (authorRole === 'first_author') return firstAuthorPct;
    if (authorRole === 'corresponding_author') return correspondingAuthorPct;
    // co_author or default
    return coAuthorTotalPct / Math.max(internalCoAuthorCount, 1);
  }

  _resolvePositionPercentage(authorPosition, policy) {
    if (authorPosition === null || authorPosition === undefined) return 0;
    if (authorPosition >= 6) return 0;

    const defaultPositionPercentages = [
      { position: 1, percentage: 40 }, { position: 2, percentage: 25 },
      { position: 3, percentage: 15 }, { position: 4, percentage: 12 },
      { position: 5, percentage: 8 }
    ];

    let positionPercentages = defaultPositionPercentages;
    if (policy?.positionBasedDistribution) {
      positionPercentages = Object.entries(policy.positionBasedDistribution)
        .filter(([key]) => key !== '6+')
        .map(([pos, pct]) => ({ position: parseInt(pos, 10), percentage: toNumber(pct) }));
    }

    const match = positionPercentages.find(pp => pp.position === authorPosition);
    return match?.percentage || 0;
  }

  _toDisplayQuartile(q) {
    if (!q) return '';
    const map = { 'Top_1_': 'Top 1%', 'Top_5_': 'Top 5%', 'Q1': 'Q1', 'Q2': 'Q2', 'Q3': 'Q3', 'Q4': 'Q4' };
    return map[q] || q;
  }

  /**
   * One author's share. rawIncentive / rawPoints are the exact (unrounded) shares that
   * computeAuthorShares() apportions with the largest-remainder method, so the authors'
   * totals never exceed the pool. incentiveAmount / points are this author's share rounded
   * on its own, for callers that look at one author only (pool lookups, policy checks).
   */
  _share(result) {
    return { ...result, incentiveAmount: Math.round(result.rawIncentive), points: Math.round(result.rawPoints) };
  }

  /** Policy metadata carried on every result; `policy` describes how the pool is split. */
  _policyMeta(policy, { defaultsIntended = false, summary = null } = {}) {
    if (policy) return { policyFound: true, usedDefaultPolicy: false, policyId: policy.id || null, policy: summary };
    return defaultsIntended
      ? { policyFound: true, usedDefaultPolicy: true, policyId: null, policy: summary }
      : { policyFound: false, usedDefaultPolicy: false, policyId: null, policy: null, reason: NO_POLICY_REASON };
  }

  _splitSummary(policy, defaultName, distributionMethod) {
    return { id: policy?.id || null, name: policy?.policyName || defaultName, distributionMethod };
  }

  _researchSummary(policy, distributionMethod) {
    const summary = { id: policy.id || null, name: policy.policyName || null, distributionMethod };
    if (distributionMethod === 'author_position_based') {
      summary.positionPercentages = {};
      for (let p = 1; p <= 5; p += 1) summary.positionPercentages[p] = this._resolvePositionPercentage(p, policy);
    } else {
      const first = toNumber(policy.first_author_percentage);
      const corresponding = toNumber(policy.corresponding_author_percentage);
      summary.percentages = { firstAuthor: first, correspondingAuthor: corresponding, coAuthors: 100 - first - corresponding };
    }
    return summary;
  }

  _zero(meta = { policyFound: true, usedDefaultPolicy: false }) {
    return { totalPoolAmount: 0, totalPoolPoints: 0, rawIncentive: 0, rawPoints: 0, incentiveAmount: 0, points: 0, ...meta };
  }

  /** 0 because no (usable) policy applies; callers must surface `reason`. */
  _noPolicy(reason = NO_POLICY_REASON) {
    return this._zero({ policyFound: false, usedDefaultPolicy: false, policyId: null, reason });
  }
}

module.exports = {
  IncentiveCalculator,
  NO_POLICY_REASON,
  DEFAULT_BOOK_POLICY,
  defaultConferencePolicy,
};
