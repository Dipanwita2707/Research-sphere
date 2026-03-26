/**
 * Unit Tests: IncentiveCalculator & analyzeAuthorComposition
 * Requirements: 2.8, 2.1
 */

const { IncentiveCalculator, analyzeAuthorComposition } = require('../../../modules/research/services/incentive-calculator');

// ── Mock Prisma ───────────────────────────────────────────────────────────────

function makePrisma(overrides = {}) {
  return {
    bookIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
    bookChapterIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
    conferenceIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
    researchIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

// ── IncentiveCalculator ───────────────────────────────────────────────────────

describe('IncentiveCalculator', () => {
  let calc;
  let prisma;

  beforeEach(() => {
    prisma = makePrisma();
    calc = new IncentiveCalculator(prisma);
  });

  describe('_zero()', () => {
    test('returns all-zero result', () => {
      expect(calc._zero()).toEqual({ totalPoolAmount: 0, totalPoolPoints: 0, incentiveAmount: 0, points: 0 });
    });
  });

  describe('calculate() - external author', () => {
    test('returns zero for external (non-internal) author', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01' },
        publicationType: 'research_paper',
        authorRole: 'first_author',
        isInternal: false,
      });
      expect(result).toEqual(calc._zero());
    });
  });

  describe('calculate() - book', () => {
    test('uses default policy when no DB policy found (authored, single author)', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'authored' },
        publicationType: 'book',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(50000);
      expect(result.totalPoolAmount).toBe(50000);
      expect(result.points).toBe(50);
    });

    test('splits equally among multiple authors', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'authored' },
        publicationType: 'book',
        authorRole: 'first_author',
        totalAuthors: 2,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(25000);
    });

    test('student gets 0 points', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'authored' },
        publicationType: 'book',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
        isStudent: true,
      });
      expect(result.points).toBe(0);
      expect(result.incentiveAmount).toBe(50000);
    });

    test('edited book uses lower default incentive', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'edited' },
        publicationType: 'book',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(40000);
    });

    test('uses DB policy when available', async () => {
      prisma.bookIncentivePolicy.findFirst.mockResolvedValue({
        authoredIncentiveAmount: 80000, authoredPoints: 80,
        editedIncentiveAmount: 60000, editedPoints: 60,
        splitPolicy: 'equal',
        indexingBonuses: {},
        internationalBonus: 0,
      });
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'authored' },
        publicationType: 'book',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(80000);
    });
  });

  describe('calculate() - book chapter', () => {
    test('uses bookChapterIncentivePolicy model', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'authored' },
        publicationType: 'book_chapter',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(prisma.bookChapterIncentivePolicy.findFirst).toHaveBeenCalled();
      expect(result.incentiveAmount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculate() - conference paper', () => {
    test('returns zero when conferenceSubType is missing', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01' },
        publicationType: 'conference_paper',
        authorRole: 'first_author',
        isInternal: true,
      });
      expect(result).toEqual(calc._zero());
    });

    test('flat conference - paper_not_indexed national', async () => {
      const result = await calc.calculate({
        contributionData: {
          publicationDate: '2024-01-01',
          conferenceSubType: 'paper_not_indexed',
          conferenceType: 'national',
        },
        publicationType: 'conference_paper',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(10000);
    });

    test('flat conference - paper_not_indexed international', async () => {
      const result = await calc.calculate({
        contributionData: {
          publicationDate: '2024-01-01',
          conferenceSubType: 'paper_not_indexed',
          conferenceType: 'international',
        },
        publicationType: 'conference_paper',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(15000);
    });

    test('keynote speaker is not split among authors', async () => {
      const result = await calc.calculate({
        contributionData: {
          publicationDate: '2024-01-01',
          conferenceSubType: 'keynote_speaker_invited_talks',
          conferenceType: 'national',
        },
        publicationType: 'conference_paper',
        authorRole: 'first_author',
        totalAuthors: 3,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(10000); // not divided by 3
    });
  });

  describe('_resolveRolePercentage()', () => {
    test('single author gets 100%', () => {
      expect(calc._resolveRolePercentage('first_author', 1, 0, 0, 40, 40, 20, 0)).toBe(100);
    });

    test('two authors with no co-authors splits 50/50', () => {
      expect(calc._resolveRolePercentage('first_author', 2, 0, 0, 40, 40, 20, 0)).toBe(50);
    });

    test('first_and_corresponding_author gets combined percentage', () => {
      expect(calc._resolveRolePercentage('first_and_corresponding_author', 3, 1, 1, 40, 40, 20, 0)).toBe(80);
    });

    test('first_author gets first_author percentage', () => {
      expect(calc._resolveRolePercentage('first_author', 3, 1, 1, 40, 40, 20, 0)).toBe(40);
    });

    test('corresponding_author gets corresponding percentage', () => {
      expect(calc._resolveRolePercentage('corresponding_author', 3, 1, 1, 40, 40, 20, 0)).toBe(40);
    });

    test('co_author splits remaining percentage', () => {
      // coAuthorTotalPct = 20, internalCoAuthorCount = 2 → 10 each
      expect(calc._resolveRolePercentage('co_author', 4, 2, 2, 40, 40, 20, 0)).toBe(10);
    });
  });

  describe('_resolvePositionPercentage()', () => {
    test('position 1 gets 40%', () => {
      expect(calc._resolvePositionPercentage(1, null)).toBe(40);
    });

    test('position 6+ gets 0%', () => {
      expect(calc._resolvePositionPercentage(6, null)).toBe(0);
    });

    test('null position gets 0%', () => {
      expect(calc._resolvePositionPercentage(null, null)).toBe(0);
    });

    test('uses policy positionBasedDistribution when provided', () => {
      const policy = { positionBasedDistribution: { '1': 50, '2': 30, '3': 20 } };
      expect(calc._resolvePositionPercentage(1, policy)).toBe(50);
      expect(calc._resolvePositionPercentage(2, policy)).toBe(30);
    });
  });

  describe('error handling', () => {
    test('returns zero on unexpected error', async () => {
      prisma.bookIncentivePolicy.findFirst.mockImplementation(() => Promise.reject(new Error('DB crash')));
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'authored' },
        publicationType: 'book',
        authorRole: 'first_author',
        isInternal: true,
      });
      expect(result).toEqual(calc._zero());
    });
  });
});

// ── analyzeAuthorComposition ──────────────────────────────────────────────────

describe('analyzeAuthorComposition', () => {
  const firstPct = 40;
  const corrPct = 40;

  test('throws when policy percentages are missing', () => {
    expect(() => analyzeAuthorComposition([], null, null, null, null)).toThrow();
  });

  test('single internal author with no co-authors', () => {
    const result = analyzeAuthorComposition([], 'internal_faculty', 'first_author', firstPct, corrPct);
    expect(result.internalCount).toBe(1);
    expect(result.externalCount).toBe(0);
    expect(result.internalCoAuthorCount).toBe(0);
    expect(result.externalFirstCorrespondingPct).toBe(0);
  });

  test('external first_and_corresponding_author adds combined pct', () => {
    const result = analyzeAuthorComposition([], 'external', 'first_and_corresponding_author', firstPct, corrPct);
    expect(result.externalFirstCorrespondingPct).toBe(firstPct + corrPct);
    expect(result.hasExternalFirstOrCorresponding).toBe(true);
  });

  test('counts internal co-authors correctly', () => {
    const coAuthors = [
      { authorType: 'internal_faculty', authorRole: 'co_author', isInternal: true },
      { authorType: 'internal_faculty', authorRole: 'co_author', isInternal: true },
    ];
    const result = analyzeAuthorComposition(coAuthors, 'internal_faculty', 'first_author', firstPct, corrPct);
    expect(result.internalCoAuthorCount).toBe(2);
    expect(result.internalEmployeeCoAuthorCount).toBe(2);
  });

  test('student co-authors not counted as employee co-authors', () => {
    const coAuthors = [
      { authorType: 'internal_student', authorRole: 'co_author', isInternal: true },
    ];
    const result = analyzeAuthorComposition(coAuthors, 'internal_faculty', 'first_author', firstPct, corrPct);
    expect(result.internalCoAuthorCount).toBe(1);
    expect(result.internalEmployeeCoAuthorCount).toBe(0);
  });

  test('totalCount is sum of internal and external', () => {
    const coAuthors = [
      { authorType: 'internal_faculty', authorRole: 'co_author', isInternal: true },
      { authorType: 'external', authorRole: 'co_author', isInternal: false },
    ];
    const result = analyzeAuthorComposition(coAuthors, 'internal_faculty', 'first_author', firstPct, corrPct);
    expect(result.totalCount).toBe(result.internalCount + result.externalCount);
  });
});

// ── _computeResearchPool and _calculateResearchPaper ─────────────────────────

describe('IncentiveCalculator - research paper branches', () => {
  let calc;
  let prisma;

  beforeEach(() => {
    prisma = makePrisma();
    calc = new IncentiveCalculator(prisma);
  });

  describe('_computeResearchPool() - scopus quartile', () => {
    test('Q1 scopus returns 50000', () => {
      const { totalAmount, totalPoints } = calc._computeResearchPool(
        { indexingCategories: ['scopus'], quartile: 'Q1' }, null
      );
      expect(totalAmount).toBe(50000);
      expect(totalPoints).toBe(50);
    });

    test('Q2 scopus returns 30000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['scopus'], quartile: 'Q2' }, null
      );
      expect(totalAmount).toBe(30000);
    });

    test('Top 1% scopus returns 75000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['scopus'], quartile: 'top1' }, null
      );
      expect(totalAmount).toBe(75000);
    });

    test('Top 5% scopus returns 60000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['scopus'], quartile: 'top5' }, null
      );
      expect(totalAmount).toBe(60000);
    });

    test('unknown quartile returns 0', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['scopus'], quartile: 'Q99' }, null
      );
      expect(totalAmount).toBe(0);
    });
  });

  describe('_computeResearchPool() - WOS/SJR ranges', () => {
    test('SJR 2.5 returns 50000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['scie_wos'], sjr: 2.5 }, null
      );
      expect(totalAmount).toBe(50000);
    });

    test('SJR 1.0 returns 30000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['scie_wos'], sjr: 1.0 }, null
      );
      expect(totalAmount).toBe(30000);
    });

    test('SJR 0.5 returns 15000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['scie_wos'], sjr: 0.5 }, null
      );
      expect(totalAmount).toBe(15000);
    });

    test('SJR 0.1 returns 5000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['scie_wos'], sjr: 0.1 }, null
      );
      expect(totalAmount).toBe(5000);
    });
  });

  describe('_computeResearchPool() - NAAS rating', () => {
    test('NAAS rating 10 returns 30000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['naas_rating_6_plus'], naasRating: 10 }, null
      );
      expect(totalAmount).toBe(30000);
    });

    test('NAAS rating 8 returns 20000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['naas_rating_6_plus'], naasRating: 8 }, null
      );
      expect(totalAmount).toBe(20000);
    });

    test('NAAS rating 6 returns 10000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['naas_rating_6_plus'], naasRating: 6 }, null
      );
      expect(totalAmount).toBe(10000);
    });

    test('NAAS rating below 6 returns 0', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['naas_rating_6_plus'], naasRating: 5 }, null
      );
      expect(totalAmount).toBe(0);
    });
  });

  describe('_computeResearchPool() - indexing category bonuses', () => {
    test('pubmed returns 15000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['pubmed'] }, null
      );
      expect(totalAmount).toBe(15000);
    });

    test('nature_science_lancet_cell_nejm returns 200000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['nature_science_lancet_cell_nejm'] }, null
      );
      expect(totalAmount).toBe(200000);
    });

    test('picks highest amount when multiple categories', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['pubmed', 'nature_science_lancet_cell_nejm'] }, null
      );
      expect(totalAmount).toBe(200000);
    });

    test('subsidiary_if_above_20 with IF > 20 returns 100000', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['subsidiary_if_above_20'], subsidiaryImpactFactor: 25 }, null
      );
      expect(totalAmount).toBe(100000);
    });

    test('subsidiary_if_above_20 with IF <= 20 returns 0', () => {
      const { totalAmount } = calc._computeResearchPool(
        { indexingCategories: ['subsidiary_if_above_20'], subsidiaryImpactFactor: 15 }, null
      );
      expect(totalAmount).toBe(0);
    });

    test('empty categories returns 0', () => {
      const { totalAmount } = calc._computeResearchPool({ indexingCategories: [] }, null);
      expect(totalAmount).toBe(0);
    });
  });

  describe('calculate() - research_paper with policy', () => {
    test('throws when policy missing role percentages', async () => {
      prisma.researchIncentivePolicy.findFirst.mockResolvedValue({
        distributionMethod: 'author_role_based',
        indexingBonuses: {},
        // missing first_author_percentage
      });
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', indexingCategories: ['pubmed'] },
        publicationType: 'research_paper',
        authorRole: 'first_author',
        isInternal: true,
      });
      // returns zero on error
      expect(result).toEqual(calc._zero());
    });

    test('returns zero when pool is zero (no matching category)', async () => {
      prisma.researchIncentivePolicy.findFirst.mockResolvedValue(null);
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', indexingCategories: [] },
        publicationType: 'research_paper',
        authorRole: 'first_author',
        isInternal: true,
      });
      expect(result).toEqual(calc._zero());
    });

    test('position >= 6 returns zero for position-based distribution', async () => {
      prisma.researchIncentivePolicy.findFirst.mockResolvedValue({
        distributionMethod: 'author_position_based',
        first_author_percentage: 40,
        corresponding_author_percentage: 40,
        indexingBonuses: {},
      });
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', indexingCategories: ['pubmed'] },
        publicationType: 'research_paper',
        authorRole: 'co_author',
        authorPosition: 6,
        isInternal: true,
      });
      expect(result).toEqual(calc._zero());
    });

    test('first_author gets 40% of pool with policy', async () => {
      prisma.researchIncentivePolicy.findFirst.mockResolvedValue({
        distributionMethod: 'author_role_based',
        first_author_percentage: 40,
        corresponding_author_percentage: 40,
        indexingBonuses: {},
      });
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', indexingCategories: ['scopus'], quartile: 'Q1' },
        publicationType: 'research_paper',
        authorRole: 'first_author',
        totalAuthors: 3,
        internalCoAuthorCount: 1,
        isInternal: true,
      });
      // pool = 50000, first_author = 40% = 20000
      expect(result.incentiveAmount).toBe(20000);
    });
  });

  describe('_calculateConferenceScopus() - quartile matching', () => {
    test('Q1 conference scopus returns 40000', async () => {
      const result = await calc.calculate({
        contributionData: {
          publicationDate: '2024-01-01',
          conferenceSubType: 'paper_indexed_scopus',
          proceedingsQuartile: 'Q1',
          conferenceType: 'national',
        },
        publicationType: 'conference_paper',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(40000);
    });

    test('Q2 conference scopus returns 25000', async () => {
      const result = await calc.calculate({
        contributionData: {
          publicationDate: '2024-01-01',
          conferenceSubType: 'paper_indexed_scopus',
          proceedingsQuartile: 'Q2',
          conferenceType: 'national',
        },
        publicationType: 'conference_paper',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(25000);
    });

    test('no quartile match returns 0 incentive', async () => {
      const result = await calc.calculate({
        contributionData: {
          publicationDate: '2024-01-01',
          conferenceSubType: 'paper_indexed_scopus',
          proceedingsQuartile: 'Q99',
          conferenceType: 'national',
        },
        publicationType: 'conference_paper',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(0);
    });
  });

  describe('book indexing bonuses', () => {
    test('scopus_indexed book adds 10000 bonus', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'authored', indexing: 'scopus_indexed' },
        publicationType: 'book',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(60000); // 50000 + 10000
    });

    test('sgt_publication_house book adds 2000 bonus', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'authored', indexing: 'sgt_publication_house' },
        publicationType: 'book',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(52000); // 50000 + 2000
    });

    test('international book adds 5000 bonus', async () => {
      const result = await calc.calculate({
        contributionData: { publicationDate: '2024-01-01', bookType: 'authored', isInternational: true },
        publicationType: 'book',
        authorRole: 'first_author',
        totalAuthors: 1,
        isInternal: true,
      });
      expect(result.incentiveAmount).toBe(55000); // 50000 + 5000
    });
  });
});
