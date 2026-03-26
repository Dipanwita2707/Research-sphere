/**
 * IncentiveCalculator
 * Encapsulates the calculateIncentives logic extracted from contribution.controller.js.
 * Accepts a single structured input object instead of 12 positional parameters.
 * Accepts a prisma client via constructor for testability.
 */

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
   * @returns {Promise<{ totalPoolAmount, totalPoolPoints, incentiveAmount, points }>}
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
      return this._zero();
    }
  }

  // ─── Book / Book Chapter ─────────────────────────────────────────────────

  async _calculateBook(data, isBook, totalAuthors, isStudent, publicationDate) {
    const policy = await this._fetchBookPolicy(isBook, publicationDate);
    const activePolicy = policy || this._defaultBookPolicy();

    const isAuthored = data.bookType === 'authored';
    let baseIncentive = isAuthored
      ? (activePolicy.authoredIncentiveAmount || 50000)
      : (activePolicy.editedIncentiveAmount || 40000);
    let basePoints = isAuthored
      ? (activePolicy.authoredPoints || 50)
      : (activePolicy.editedPoints || 40);

    const bonuses = activePolicy.indexingBonuses || {};
    if (data.indexing === 'scopus_indexed') baseIncentive += bonuses.scopus_indexed || 0;
    else if (data.indexing === 'non_indexed') baseIncentive += bonuses.non_indexed || 0;
    else if (data.indexing === 'sgt_publication_house') baseIncentive += bonuses.sgt_publication_house || 0;

    if (data.isInternational) baseIncentive += activePolicy.internationalBonus || 0;

    const count = Math.max(totalAuthors, 1);
    return {
      totalPoolAmount: baseIncentive,
      totalPoolPoints: basePoints,
      incentiveAmount: Math.round(baseIncentive / count),
      points: isStudent ? 0 : Math.round(basePoints / count)
    };
  }

  async _fetchBookPolicy(isBook, publicationDate) {
    const model = isBook ? 'bookIncentivePolicy' : 'bookChapterIncentivePolicy';
    return this.prisma[model].findFirst({
      where: {
        isActive: true,
        effectiveFrom: { lte: publicationDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: publicationDate } }]
      },
      orderBy: { effectiveFrom: 'desc' }
    });
  }

  _defaultBookPolicy() {
    return {
      authoredIncentiveAmount: 50000, authoredPoints: 50,
      editedIncentiveAmount: 40000, editedPoints: 40,
      splitPolicy: 'equal',
      indexingBonuses: { scopus_indexed: 10000, non_indexed: 0, sgt_publication_house: 2000 },
      internationalBonus: 5000
    };
  }

  // ─── Conference Paper ────────────────────────────────────────────────────

  async _calculateConference(
    data, authorRole, isStudent, totalAuthors,
    internalCoAuthorCount, internalEmployeeCoAuthorCount,
    externalFirstCorrespondingPct, coAuthorCount, publicationDate
  ) {
    const { conferenceSubType } = data;
    if (!conferenceSubType) return this._zero();

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
      where: {
        conferenceSubType,
        isActive: true,
        effectiveFrom: { lte: publicationDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: publicationDate } }]
      },
      orderBy: { effectiveFrom: 'desc' }
    });
  }

  _calculateConferenceScopus(
    data, policy, authorRole, isStudent, totalAuthors,
    internalCoAuthorCount, internalEmployeeCoAuthorCount,
    externalFirstCorrespondingPct, coAuthorCount
  ) {
    const defaultQuartileIncentives = [
      { quartile: 'Top 1%', incentiveAmount: 60000, points: 60 },
      { quartile: 'Top 5%', incentiveAmount: 50000, points: 50 },
      { quartile: 'Q1', incentiveAmount: 40000, points: 40 },
      { quartile: 'Q2', incentiveAmount: 25000, points: 25 },
      { quartile: 'Q3', incentiveAmount: 12000, points: 12 },
      { quartile: 'Q4', incentiveAmount: 5000, points: 5 }
    ];
    const defaultRolePercentages = [
      { role: 'first_author', percentage: 40 },
      { role: 'corresponding_author', percentage: 40 }
    ];

    const quartileIncentives = policy?.quartileIncentives || defaultQuartileIncentives;
    const rolePercentages = policy?.rolePercentages || defaultRolePercentages;

    const firstAuthorPct = rolePercentages.find(r => r.role === 'first_author')?.percentage;
    const correspondingAuthorPct = rolePercentages.find(r => r.role === 'corresponding_author')?.percentage;

    if (firstAuthorPct === undefined || correspondingAuthorPct === undefined) {
      throw new Error('Conference policy must have first_author and corresponding_author role percentages configured');
    }

    const coAuthorTotalPct = 100 - firstAuthorPct - correspondingAuthorPct;

    let totalAmount = 0;
    let totalPoints = 0;
    const quartile = data.proceedingsQuartile;
    if (quartile) {
      const displayQuartile = this._toDisplayQuartile(quartile);
      const match = quartileIncentives.find(q =>
        q.quartile.toUpperCase() === displayQuartile.toUpperCase() ||
        q.quartile.toUpperCase() === quartile.toUpperCase()
      );
      if (match) { totalAmount = Number(match.incentiveAmount) || 0; totalPoints = Number(match.points) || 0; }
    }

    if (data.conferenceType === 'international' && policy?.internationalBonus) {
      totalAmount += Number(policy.internationalBonus) || 0;
    }
    if (data.conferenceBestPaperAward === 'yes' && policy?.bestPaperAwardBonus) {
      totalAmount += Number(policy.bestPaperAwardBonus) || 0;
    }

    const rolePercentage = this._resolveRolePercentage(
      authorRole, totalAuthors, internalCoAuthorCount, coAuthorCount,
      firstAuthorPct, correspondingAuthorPct, coAuthorTotalPct, externalFirstCorrespondingPct
    );

    const authorIncentive = Math.round((totalAmount * rolePercentage) / 100);

    let pointPercentage = rolePercentage;
    if (authorRole === 'co_author' && totalAuthors > 1) {
      pointPercentage = coAuthorTotalPct / Math.max(internalEmployeeCoAuthorCount, 1);
    }
    const authorPoints = Math.round((totalPoints * pointPercentage) / 100);

    return {
      totalPoolAmount: totalAmount, totalPoolPoints: totalPoints,
      incentiveAmount: authorIncentive, points: isStudent ? 0 : authorPoints
    };
  }

  _calculateConferenceFlat(data, policy, conferenceSubType, isStudent, totalAuthors) {
    const defaults = {
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
    };

    const isInternational = data.conferenceType === 'international' ||
      data.nationalInternational === 'international' || data.conferenceHeldLocation === 'abroad';

    let baseIncentive = 0;
    let basePoints = 0;

    if (policy) {
      baseIncentive = Number(policy.flatIncentiveAmount) || 0;
      basePoints = Number(policy.flatPoints) || 0;
      if (isInternational && policy.internationalBonus) baseIncentive += Number(policy.internationalBonus) || 0;
    } else {
      const sub = defaults[conferenceSubType] || defaults.paper_not_indexed;
      const level = isInternational ? sub.international : sub.national;
      baseIncentive = level.incentiveAmount;
      basePoints = level.points;
    }

    if (data.conferenceBestPaperAward === 'yes' && policy?.bestPaperAwardBonus) {
      baseIncentive += Number(policy.bestPaperAwardBonus) || 0;
    }

    const isSinglePresenter = conferenceSubType === 'keynote_speaker_invited_talks' ||
      conferenceSubType === 'organizer_coordinator_member';

    const share = isSinglePresenter ? baseIncentive : Math.round(baseIncentive / Math.max(totalAuthors, 1));
    const pointShare = isSinglePresenter ? basePoints : Math.round(basePoints / Math.max(totalAuthors, 1));

    return {
      totalPoolAmount: baseIncentive, totalPoolPoints: basePoints,
      incentiveAmount: share, points: isStudent ? 0 : pointShare
    };
  }

  // ─── Research Paper ──────────────────────────────────────────────────────

  async _calculateResearchPaper(
    data, publicationType, authorRole, isStudent,
    totalAuthors, internalCoAuthorCount, internalEmployeeCoAuthorCount,
    externalFirstCorrespondingPct, coAuthorCount, authorPosition, publicationDate
  ) {
    const policy = await this._fetchResearchPolicy(publicationType, publicationDate);
    const distributionMethod = policy?.distributionMethod || 'author_role_based';

    if (distributionMethod === 'author_position_based' && authorPosition !== null && authorPosition >= 6) {
      return this._zero();
    }

    const { totalAmount, totalPoints } = this._computeResearchPool(data, policy);
    if (totalAmount === 0) return this._zero();

    if (!policy?.first_author_percentage || !policy?.corresponding_author_percentage) {
      throw new Error('Active research policy not configured. Please configure policy in admin panel.');
    }

    const firstAuthorPct = Number(policy.first_author_percentage);
    const correspondingAuthorPct = Number(policy.corresponding_author_percentage);
    const coAuthorTotalPct = 100 - firstAuthorPct - correspondingAuthorPct;

    let rolePercentage;
    if (distributionMethod === 'author_position_based') {
      rolePercentage = this._resolvePositionPercentage(authorPosition, policy);
    } else {
      rolePercentage = this._resolveRolePercentage(
        authorRole, totalAuthors, internalCoAuthorCount, coAuthorCount,
        firstAuthorPct, correspondingAuthorPct, coAuthorTotalPct, externalFirstCorrespondingPct
      );
    }

    const authorIncentive = Math.round((totalAmount * rolePercentage) / 100);

    let pointPercentage = rolePercentage;
    if (authorRole === 'co_author') {
      pointPercentage = coAuthorTotalPct / Math.max(internalEmployeeCoAuthorCount, 1);
    }
    const authorPoints = Math.round((totalPoints * pointPercentage) / 100);

    return {
      totalPoolAmount: totalAmount, totalPoolPoints: totalPoints,
      incentiveAmount: authorIncentive, points: isStudent ? 0 : authorPoints
    };
  }

  async _fetchResearchPolicy(publicationType, publicationDate) {
    return this.prisma.researchIncentivePolicy.findFirst({
      where: {
        publicationType,
        isActive: true,
        effectiveFrom: { lte: publicationDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: publicationDate } }]
      },
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
          q.quartile.toLowerCase() === normalized.toLowerCase() ||
          q.quartile.toLowerCase() === qVal
        );
        if (match) { catAmount = Number(match.incentiveAmount) || 0; catPoints = Number(match.points) || 0; }
      } else if (category === 'scie_wos' && data.sjr) {
        const sjrVal = Number(data.sjr);
        const match = wosSjrIncentives.find(r => sjrVal >= r.minSJR && sjrVal <= r.maxSJR);
        if (match) { catAmount = Number(match.incentiveAmount) || 0; catPoints = Number(match.points) || 0; }
      } else if (category === 'naas_rating_6_plus') {
        const rating = Number(data.naasRating);
        if (rating && rating >= 6) {
          const match = naasRatingIncentives.find(r => rating >= r.minRating && rating <= r.maxRating);
          if (match) { catAmount = Number(match.incentiveAmount) || 0; catPoints = Number(match.points) || 0; }
          else {
            const base = indexingCategoryBonuses.find(b => b.category === 'naas_rating_6_plus');
            if (base) { catAmount = Number(base.incentiveAmount) || 0; catPoints = Number(base.points) || 0; }
          }
        }
      } else if (category === 'subsidiary_if_above_20') {
        const subIF = Number(data.subsidiaryImpactFactor);
        if (subIF && subIF > 20) {
          const bonus = indexingCategoryBonuses.find(b => b.category === category);
          if (bonus) { catAmount = Number(bonus.incentiveAmount) || 0; catPoints = Number(bonus.points) || 0; }
        }
      } else {
        const bonus = indexingCategoryBonuses.find(b => b.category === category);
        if (bonus) { catAmount = Number(bonus.incentiveAmount) || 0; catPoints = Number(bonus.points) || 0; }
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
    if (totalAuthors === 1) return 100 - externalFirstCorrespondingPct;
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
        .map(([pos, pct]) => ({ position: parseInt(pos, 10), percentage: Number(pct) }));
    }

    const match = positionPercentages.find(pp => pp.position === authorPosition);
    return match?.percentage || 0;
  }

  _toDisplayQuartile(q) {
    if (!q) return '';
    const map = { 'Top_1_': 'Top 1%', 'Top_5_': 'Top 5%', 'Q1': 'Q1', 'Q2': 'Q2', 'Q3': 'Q3', 'Q4': 'Q4' };
    return map[q] || q;
  }

  _zero() {
    return { totalPoolAmount: 0, totalPoolPoints: 0, incentiveAmount: 0, points: 0 };
  }
}

/**
 * Analyze author composition for incentive calculation.
 * Extracted from contribution.controller.js — pure function, no DB calls.
 */
function analyzeAuthorComposition(
  allAuthors, applicantAuthorType = null, applicantRole = null,
  firstAuthorPct, correspondingAuthorPct
) {
  if (!firstAuthorPct || !correspondingAuthorPct) {
    throw new Error('Policy percentages are required for analyzeAuthorComposition');
  }

  let internalCount = 0, externalCount = 0;
  let internalCoAuthorCount = 0, externalCoAuthorCount = 0;
  let internalEmployeeCoAuthorCount = 0;
  let externalFirstCorrespondingPct = 0;

  const processAuthor = (authorType, role, isApplicant = false) => {
    const isInternal = authorType?.startsWith('internal_') || false;
    const isStudent = authorType === 'internal_student';

    if (isInternal) {
      internalCount++;
      if (role === 'co_author' || role === 'co') {
        internalCoAuthorCount++;
        if (!isStudent) internalEmployeeCoAuthorCount++;
      }
    } else {
      externalCount++;
      if (role === 'co_author' || role === 'co') externalCoAuthorCount++;
      if (role === 'first_and_corresponding_author' || role === 'first_and_corresponding') {
        externalFirstCorrespondingPct += firstAuthorPct + correspondingAuthorPct;
      } else if (role === 'first_author' || role === 'first') {
        externalFirstCorrespondingPct += firstAuthorPct;
      } else if (role === 'corresponding_author' || role === 'corresponding') {
        externalFirstCorrespondingPct += correspondingAuthorPct;
      }
    }
  };

  if (applicantAuthorType !== null) {
    processAuthor(applicantAuthorType, applicantRole, true);
  }

  for (const author of allAuthors) {
    const isInternal = author.authorType?.startsWith('internal_') || author.isInternal === true || false;
    const authorType = isInternal ? (author.authorType || 'internal_faculty') : 'external';
    const role = author.authorRole || author.authorType || 'co_author';
    processAuthor(authorType, role);
  }

  return {
    internalCount, externalCount,
    internalCoAuthorCount, externalCoAuthorCount,
    internalEmployeeCoAuthorCount,
    totalCount: internalCount + externalCount,
    externalFirstCorrespondingPct,
    hasExternalFirstOrCorresponding: externalFirstCorrespondingPct > 0
  };
}

module.exports = { IncentiveCalculator, analyzeAuthorComposition };
