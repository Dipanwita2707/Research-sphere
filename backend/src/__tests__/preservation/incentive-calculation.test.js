/**
 * Preservation Tests: Incentive Calculation
 *
 * Property 2: Preservation - Business Logic Unchanged
 * Validates: Requirements 3.5
 *
 * These tests MUST PASS on the UNFIXED code.
 * They capture the observable behavior of calculateIncentives so that
 * after refactoring to IncentiveCalculator, the same inputs produce
 * the same outputs.
 *
 * Strategy:
 * - Mock prisma so the function can run without a real database
 * - Provide realistic policy objects that match what the DB would return
 * - Test all major code paths: external author, book, conference, research paper
 */

// ── Mock prisma BEFORE requiring the controller ──────────────────────────────
jest.mock('../../shared/config/database', () => ({
  bookIncentivePolicy: { findFirst: jest.fn() },
  bookChapterIncentivePolicy: { findFirst: jest.fn() },
  conferenceIncentivePolicy: { findFirst: jest.fn() },
  researchIncentivePolicy: { findFirst: jest.fn() },
  incentivePolicy: { findFirst: jest.fn() },
}));

// Also mock audit logger and S3 to prevent side-effect imports from failing
jest.mock('../../shared/utils/auditLogger', () => ({
  logResearchFiling: jest.fn(),
  logResearchUpdate: jest.fn(),
  logResearchStatusChange: jest.fn(),
  logFileUpload: jest.fn(),
  getIp: jest.fn(),
}));
jest.mock('../../shared/utils/s3', () => ({ uploadToS3: jest.fn() }));

const prisma = require('../../shared/config/database');
const { calculateIncentives } = require('../../modules/research/controllers/contribution.controller');

// ── Shared policy fixtures ────────────────────────────────────────────────────

const RESEARCH_POLICY = {
  id: 'policy-1',
  policyName: 'Test Research Policy',
  publicationType: 'research_paper',
  isActive: true,
  effectiveFrom: new Date('2020-01-01'),
  effectiveTo: null,
  distributionMethod: 'author_role_based',
  first_author_percentage: 40,
  corresponding_author_percentage: 40,
  indexingBonuses: {
    quartileIncentives: [
      { quartile: 'Q1', incentiveAmount: 50000, points: 50 },
      { quartile: 'Q2', incentiveAmount: 30000, points: 30 },
      { quartile: 'Q3', incentiveAmount: 15000, points: 15 },
      { quartile: 'Q4', incentiveAmount: 5000, points: 5 },
      { quartile: 'Top 1%', incentiveAmount: 75000, points: 75 },
      { quartile: 'Top 5%', incentiveAmount: 60000, points: 60 },
    ],
    sjrRanges: [
      { minSJR: 2.0, maxSJR: 999, incentiveAmount: 50000, points: 50 },
      { minSJR: 1.0, maxSJR: 1.99, incentiveAmount: 30000, points: 30 },
      { minSJR: 0.5, maxSJR: 0.99, incentiveAmount: 15000, points: 15 },
      { minSJR: 0.0, maxSJR: 0.49, incentiveAmount: 5000, points: 5 },
    ],
    indexingCategoryBonuses: [
      { category: 'pubmed', incentiveAmount: 15000, points: 15 },
      { category: 'abdc_scopus_wos', incentiveAmount: 20000, points: 20 },
      { category: 'sgtu_in_house', incentiveAmount: 5000, points: 5 },
    ],
    rolePercentages: [
      { role: 'first_author', percentage: 40 },
      { role: 'corresponding_author', percentage: 40 },
    ],
  },
};

const BOOK_POLICY = {
  id: 'book-policy-1',
  policyName: 'Test Book Policy',
  isActive: true,
  effectiveFrom: new Date('2020-01-01'),
  effectiveTo: null,
  authoredIncentiveAmount: 50000,
  authoredPoints: 50,
  editedIncentiveAmount: 40000,
  editedPoints: 40,
  splitPolicy: 'equal',
  indexingBonuses: {
    scopus_indexed: 10000,
    non_indexed: 0,
    sgt_publication_house: 2000,
  },
  internationalBonus: 5000,
};

const BOOK_CHAPTER_POLICY = {
  id: 'book-chapter-policy-1',
  policyName: 'Test Book Chapter Policy',
  isActive: true,
  effectiveFrom: new Date('2020-01-01'),
  effectiveTo: null,
  authoredIncentiveAmount: 20000,
  authoredPoints: 20,
  editedIncentiveAmount: 15000,
  editedPoints: 15,
  splitPolicy: 'equal',
  indexingBonuses: {},
  internationalBonus: 2000,
};

const CONFERENCE_POLICY_SCOPUS = {
  id: 'conf-policy-1',
  policyName: 'Test Conference Policy',
  conferenceSubType: 'paper_indexed_scopus',
  isActive: true,
  effectiveFrom: new Date('2020-01-01'),
  effectiveTo: null,
  quartileIncentives: [
    { quartile: 'Q1', incentiveAmount: 40000, points: 40 },
    { quartile: 'Q2', incentiveAmount: 25000, points: 25 },
    { quartile: 'Q3', incentiveAmount: 12000, points: 12 },
    { quartile: 'Q4', incentiveAmount: 5000, points: 5 },
  ],
  rolePercentages: [
    { role: 'first_author', percentage: 40 },
    { role: 'corresponding_author', percentage: 40 },
  ],
  internationalBonus: 0,
  bestPaperAwardBonus: 0,
};

// ── Helper ────────────────────────────────────────────────────────────────────

function makeContributionData(overrides = {}) {
  return {
    publicationDate: '2024-01-01',
    indexingCategories: [],
    quartile: null,
    sjr: null,
    naasRating: null,
    subsidiaryImpactFactor: null,
    bookType: null,
    indexing: null,
    isInternational: false,
    conferenceSubType: null,
    conferenceType: null,
    proceedingsQuartile: null,
    conferenceBestPaperAward: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation: calculateIncentives behavior baseline', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rule 1: External authors always get zero ──────────────────────────────
  describe('External author rule (no DB call needed)', () => {
    test('external author receives zero incentives and zero points regardless of type', async () => {
      const result = await calculateIncentives(
        makeContributionData(),
        'research_paper',
        'first_author',
        false,   // isStudent
        0,       // sjrValue
        0,       // coAuthorCount
        1,       // totalAuthors
        false    // isInternal = false → external
      );

      expect(result).toEqual({
        totalPoolAmount: 0,
        totalPoolPoints: 0,
        incentiveAmount: 0,
        points: 0,
      });
    });

    test('external student author also receives zero', async () => {
      const result = await calculateIncentives(
        makeContributionData(),
        'book',
        'first_author',
        true,    // isStudent
        0, 0, 1,
        false    // isInternal = false
      );

      expect(result).toEqual({
        totalPoolAmount: 0,
        totalPoolPoints: 0,
        incentiveAmount: 0,
        points: 0,
      });
    });
  });

  // ── Book incentive calculation ────────────────────────────────────────────
  describe('Book incentive calculation', () => {
    beforeEach(() => {
      prisma.bookIncentivePolicy.findFirst.mockResolvedValue(BOOK_POLICY);
    });

    test('sole authored book: full authored amount to single internal author', async () => {
      const result = await calculateIncentives(
        makeContributionData({ bookType: 'authored' }),
        'book',
        'first_author',
        false, 0, 0,
        1,    // totalAuthors
        true  // isInternal
      );

      expect(result.totalPoolAmount).toBe(50000);
      expect(result.totalPoolPoints).toBe(50);
      expect(result.incentiveAmount).toBe(50000); // 50000 / 1 author
      expect(result.points).toBe(50);
    });

    test('authored book with 2 authors: equal split', async () => {
      const result = await calculateIncentives(
        makeContributionData({ bookType: 'authored' }),
        'book',
        'co_author',
        false, 0, 0,
        2,    // totalAuthors
        true
      );

      expect(result.totalPoolAmount).toBe(50000);
      expect(result.incentiveAmount).toBe(25000); // 50000 / 2
      expect(result.points).toBe(25);
    });

    test('edited book: uses editedIncentiveAmount', async () => {
      const result = await calculateIncentives(
        makeContributionData({ bookType: 'edited' }),
        'book',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      expect(result.totalPoolAmount).toBe(40000);
      expect(result.incentiveAmount).toBe(40000);
      expect(result.points).toBe(40);
    });

    test('student author gets incentive but zero points', async () => {
      const result = await calculateIncentives(
        makeContributionData({ bookType: 'authored' }),
        'book',
        'first_author',
        true,  // isStudent
        0, 0, 1,
        true
      );

      expect(result.incentiveAmount).toBe(50000);
      expect(result.points).toBe(0);
    });

    test('book with scopus indexing adds indexing bonus', async () => {
      const result = await calculateIncentives(
        makeContributionData({ bookType: 'authored', indexing: 'scopus_indexed' }),
        'book',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      // 50000 base + 10000 scopus bonus = 60000
      expect(result.totalPoolAmount).toBe(60000);
      expect(result.incentiveAmount).toBe(60000);
    });

    test('international book adds international bonus', async () => {
      const result = await calculateIncentives(
        makeContributionData({ bookType: 'authored', isInternational: true }),
        'book',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      // 50000 base + 5000 international = 55000
      expect(result.totalPoolAmount).toBe(55000);
      expect(result.incentiveAmount).toBe(55000);
    });
  });

  // ── Book chapter incentive calculation ───────────────────────────────────
  describe('Book chapter incentive calculation', () => {
    beforeEach(() => {
      prisma.bookChapterIncentivePolicy.findFirst.mockResolvedValue(BOOK_CHAPTER_POLICY);
    });

    test('sole authored book chapter: full amount', async () => {
      const result = await calculateIncentives(
        makeContributionData({ bookType: 'authored' }),
        'book_chapter',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      expect(result.totalPoolAmount).toBe(20000);
      expect(result.incentiveAmount).toBe(20000);
      expect(result.points).toBe(20);
    });

    test('book chapter with 3 authors: equal split', async () => {
      const result = await calculateIncentives(
        makeContributionData({ bookType: 'authored' }),
        'book_chapter',
        'co_author',
        false, 0, 0,
        3,
        true
      );

      expect(result.incentiveAmount).toBe(Math.round(20000 / 3));
    });
  });

  // ── Conference paper (flat, non-scopus) ──────────────────────────────────
  describe('Conference paper - flat incentive (no policy)', () => {
    beforeEach(() => {
      // No policy found → use defaults
      prisma.conferenceIncentivePolicy.findFirst.mockResolvedValue(null);
    });

    test('paper_not_indexed national: default flat incentive split equally', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          conferenceSubType: 'paper_not_indexed',
          conferenceType: 'national',
        }),
        'conference_paper',
        'first_author',
        false, 0, 0,
        2,   // totalAuthors
        true
      );

      // Default national paper_not_indexed = 10000, split among 2 authors
      expect(result.totalPoolAmount).toBe(10000);
      expect(result.incentiveAmount).toBe(5000);
    });

    test('paper_not_indexed international: higher default flat incentive', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          conferenceSubType: 'paper_not_indexed',
          conferenceType: 'international',
        }),
        'conference_paper',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      // Default international paper_not_indexed = 15000
      expect(result.totalPoolAmount).toBe(15000);
      expect(result.incentiveAmount).toBe(15000);
    });

    test('keynote_speaker_invited_talks: full amount to single presenter (no split)', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          conferenceSubType: 'keynote_speaker_invited_talks',
          conferenceType: 'national',
        }),
        'conference_paper',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      // Default national keynote = 10000, no split
      expect(result.totalPoolAmount).toBe(10000);
      expect(result.incentiveAmount).toBe(10000);
    });

    test('conference with no subtype returns zeros', async () => {
      const result = await calculateIncentives(
        makeContributionData({ conferenceSubType: null }),
        'conference_paper',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      expect(result).toEqual({
        totalPoolAmount: 0,
        totalPoolPoints: 0,
        incentiveAmount: 0,
        points: 0,
      });
    });
  });

  // ── Conference paper (scopus-indexed) ────────────────────────────────────
  describe('Conference paper - scopus indexed with policy', () => {
    beforeEach(() => {
      prisma.conferenceIncentivePolicy.findFirst.mockResolvedValue(CONFERENCE_POLICY_SCOPUS);
    });

    test('Q1 conference paper, first author gets 40%', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          conferenceSubType: 'paper_indexed_scopus',
          proceedingsQuartile: 'Q1',
          conferenceType: 'national',
        }),
        'conference_paper',
        'first_author',
        false, 0, 0,
        3,   // totalAuthors
        true,
        1    // internalCoAuthorCount
      );

      // Q1 pool = 40000, first_author = 40%
      expect(result.totalPoolAmount).toBe(40000);
      expect(result.incentiveAmount).toBe(16000); // 40000 * 40%
    });

    test('Q2 conference paper, co-author splits remaining 20%', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          conferenceSubType: 'paper_indexed_scopus',
          proceedingsQuartile: 'Q2',
          conferenceType: 'national',
        }),
        'conference_paper',
        'co_author',
        false, 0, 0,
        3,   // totalAuthors
        true,
        1    // internalCoAuthorCount = 1 co-author
      );

      // Q2 pool = 25000, co-author pool = 20%, 1 internal co-author
      expect(result.totalPoolAmount).toBe(25000);
      expect(result.incentiveAmount).toBe(5000); // 25000 * 20% / 1
    });
  });

  // ── Research paper (role-based) ───────────────────────────────────────────
  describe('Research paper - role-based distribution', () => {
    beforeEach(() => {
      prisma.researchIncentivePolicy.findFirst.mockResolvedValue(RESEARCH_POLICY);
    });

    test('SCOPUS Q1 paper, first author gets 40% of pool', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          indexingCategories: ['scopus'],
          quartile: 'Q1',
        }),
        'research_paper',
        'first_author',
        false, 0, 0,
        3,   // totalAuthors
        true,
        1    // internalCoAuthorCount
      );

      // Q1 pool = 50000, first_author = 40%
      expect(result.totalPoolAmount).toBe(50000);
      expect(result.totalPoolPoints).toBe(50);
      expect(result.incentiveAmount).toBe(20000); // 50000 * 40%
      expect(result.points).toBe(20);
    });

    test('SCOPUS Q2 paper, corresponding author gets 40%', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          indexingCategories: ['scopus'],
          quartile: 'Q2',
        }),
        'research_paper',
        'corresponding_author',
        false, 0, 0,
        3,
        true,
        1
      );

      expect(result.totalPoolAmount).toBe(30000);
      expect(result.incentiveAmount).toBe(12000); // 30000 * 40%
    });

    test('SCOPUS Q1 paper, first+corresponding author gets 80%', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          indexingCategories: ['scopus'],
          quartile: 'Q1',
        }),
        'research_paper',
        'first_and_corresponding_author',
        false, 0, 0,
        3,
        true,
        1
      );

      // 40% + 40% = 80%
      expect(result.incentiveAmount).toBe(40000); // 50000 * 80%
    });

    test('single author gets 100% of pool', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          indexingCategories: ['scopus'],
          quartile: 'Q1',
        }),
        'research_paper',
        'first_author',
        false, 0, 0,
        1,   // single author
        true,
        0
      );

      expect(result.incentiveAmount).toBe(50000); // 100%
    });

    test('student author gets incentive but zero points', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          indexingCategories: ['scopus'],
          quartile: 'Q1',
        }),
        'research_paper',
        'first_author',
        true,  // isStudent
        0, 0, 1,
        true
      );

      expect(result.incentiveAmount).toBe(50000);
      expect(result.points).toBe(0);
    });

    test('no matching indexing categories returns zero incentive', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          indexingCategories: [],
        }),
        'research_paper',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      expect(result).toEqual({
        totalPoolAmount: 0,
        totalPoolPoints: 0,
        incentiveAmount: 0,
        points: 0,
      });
    });

    test('multiple categories: highest incentive wins (not sum)', async () => {
      // scopus Q1 = 50000, pubmed = 15000 → should use 50000
      const result = await calculateIncentives(
        makeContributionData({
          indexingCategories: ['scopus', 'pubmed'],
          quartile: 'Q1',
        }),
        'research_paper',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      expect(result.totalPoolAmount).toBe(50000); // highest wins
    });

    test('WOS/SCIE paper with SJR 1.5 uses correct range', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          indexingCategories: ['scie_wos'],
          sjr: 1.5,
        }),
        'research_paper',
        'first_author',
        false, 0, 0,
        1,
        true
      );

      // SJR 1.0-1.99 range = 30000
      expect(result.totalPoolAmount).toBe(30000);
      expect(result.incentiveAmount).toBe(30000);
    });

    test('co-author splits remaining 20% among internal co-authors', async () => {
      const result = await calculateIncentives(
        makeContributionData({
          indexingCategories: ['scopus'],
          quartile: 'Q1',
        }),
        'research_paper',
        'co_author',
        false, 0, 0,
        4,   // totalAuthors
        true,
        2,   // internalCoAuthorCount = 2
        2    // internalEmployeeCoAuthorCount = 2
      );

      // Q1 pool = 50000, co-author pool = 20%, split among 2 internal co-authors
      // 50000 * 20% / 2 = 5000
      expect(result.incentiveAmount).toBe(5000);
    });
  });

  // ── Response shape contract ───────────────────────────────────────────────
  describe('Response shape contract', () => {
    test('always returns object with exactly 4 numeric fields', async () => {
      prisma.bookIncentivePolicy.findFirst.mockResolvedValue(BOOK_POLICY);

      const result = await calculateIncentives(
        makeContributionData({ bookType: 'authored' }),
        'book',
        'first_author',
        false, 0, 0, 1, true
      );

      expect(result).toHaveProperty('totalPoolAmount');
      expect(result).toHaveProperty('totalPoolPoints');
      expect(result).toHaveProperty('incentiveAmount');
      expect(result).toHaveProperty('points');
      expect(typeof result.totalPoolAmount).toBe('number');
      expect(typeof result.totalPoolPoints).toBe('number');
      expect(typeof result.incentiveAmount).toBe('number');
      expect(typeof result.points).toBe('number');
    });

    test('on error, returns zero-valued object (no throw)', async () => {
      prisma.researchIncentivePolicy.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await calculateIncentives(
        makeContributionData({ indexingCategories: ['scopus'], quartile: 'Q1' }),
        'research_paper',
        'first_author',
        false, 0, 0, 1, true
      );

      expect(result).toEqual({
        totalPoolAmount: 0,
        totalPoolPoints: 0,
        incentiveAmount: 0,
        points: 0,
      });
    });
  });

});
