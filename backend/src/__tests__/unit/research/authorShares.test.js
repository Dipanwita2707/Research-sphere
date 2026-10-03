/**
 * Author shares: one computation for the form preview, the saved author rows and DRD approval.
 *
 *   - computeAuthorShares for every publication type and distribution method
 *   - the rules: sole author, students (money, 0 points), externals, positions ≥ 6, no policy
 *   - rounding: largest remainder, Σ shares ≤ pool, deterministic
 *   - parity: previewIncentiveShares == shares saved by _createAuthors == shares credited by
 *     _creditIncentivesToAuthors, for the same input
 */
jest.mock('../../../modules/core/services/affiliation.service', () => ({
  getUniversityAffiliationVariants: jest.fn(async () => ({ variants: ['sgt university'] })),
}));

const { computeAuthorShares, apportion, describeSplit } = require('../../../modules/research/services/authorShares');
const ContributionService = require('../../../modules/research/services/contribution.service');
const ReviewService = require('../../../modules/research/services/review.service');
const { toIncentiveInput } = require('../../../modules/research/utils/incentiveInput');

// ── Policies ──────────────────────────────────────────────────────────────────

const ROLE_POLICY = {
  id: 'rp-2026', policyName: 'Research Paper Policy 2026', publicationType: 'research_paper',
  distributionMethod: 'author_role_based', first_author_percentage: 35, corresponding_author_percentage: 30,
  indexingBonuses: {
    indexingCategoryBonuses: [
      { category: 'nature_science_lancet_cell_nejm', incentiveAmount: 200000, points: 100 },
      { category: 'pubmed', incentiveAmount: 15000, points: 15 },
    ],
  },
};
const POSITION_POLICY = {
  ...ROLE_POLICY, id: 'pp-2026', policyName: 'Position Policy 2026', distributionMethod: 'author_position_based',
  positionBasedDistribution: { 1: 40, 2: 25, 3: 15, 4: 12, 5: 8, '6+': 0 },
};
const BOOK_POLICY = {
  id: 'bp', policyName: 'Book Policy 2026', authoredIncentiveAmount: 50000, authoredPoints: 50,
  editedIncentiveAmount: 40000, editedPoints: 40, indexingBonuses: { scopus_indexed: 0 }, internationalBonus: 0,
};
const CHAPTER_POLICY = { ...BOOK_POLICY, id: 'bcp', policyName: 'Chapter Policy 2026', authoredIncentiveAmount: 20000, authoredPoints: 20 };
const CONFERENCE_POLICY = {
  id: 'cp', policyName: 'Conference Policy 2026', conferenceSubType: 'paper_indexed_scopus',
  quartileIncentives: [{ quartile: 'Q1', incentiveAmount: 40000, points: 40 }],
  rolePercentages: [{ role: 'first_author', percentage: 40 }, { role: 'corresponding_author', percentage: 40 }],
};

function makePrisma({ research = ROLE_POLICY, book = null, chapter = null, conference = null, users = [] } = {}) {
  return {
    researchIncentivePolicy: { findFirst: jest.fn(async () => research) },
    bookIncentivePolicy: { findFirst: jest.fn(async () => book) },
    bookChapterIncentivePolicy: { findFirst: jest.fn(async () => chapter) },
    conferenceIncentivePolicy: { findFirst: jest.fn(async () => conference) },
    userLogin: {
      findMany: jest.fn(async ({ where }) => users.filter((u) =>
        (!where.uid || where.uid.in.includes(u.uid))
        && (!where.id || where.id.in.includes(u.id))
        && (!where.role || u.role === where.role))),
    },
    researchContributionAuthor: { createMany: jest.fn(async () => ({})), update: jest.fn(async () => ({})) },
    notification: { createMany: jest.fn(async () => ({})) },
  };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const amounts = (r) => r.authors.map((a) => a.incentive);
const points = (r) => r.authors.map((a) => a.points);

const paper = { publicationDate: '2026-05-01', indexingCategories: ['nature_science_lancet_cell_nejm'] };
const shares = (prisma, authors, publicationType = 'research_paper', data = paper) =>
  computeAuthorShares(prisma, { contributionData: toIncentiveInput(data), publicationType, authors });

// ── computeAuthorShares ───────────────────────────────────────────────────────

describe('computeAuthorShares — research paper, role-based', () => {
  test('the DEMO 4-author case: first 35%, corresponding 30%, two co-authors share 35%', async () => {
    const r = await shares(makePrisma(), [
      { role: 'corresponding_author', position: 1 },
      { role: 'first_author', position: 2 },
      { role: 'co_author', position: 3 },
      { role: 'co_author', position: 4 },
    ]);
    expect(amounts(r)).toEqual([60000, 70000, 35000, 35000]);
    // 17.5 + 17.5 points: one rounds up, one down (earlier position first). Was 18 + 18 = 101.
    expect(points(r)).toEqual([30, 35, 18, 17]);
    expect(r.pool).toEqual({ amount: 200000, points: 100 });
    expect(r.totals).toMatchObject({ amount: 200000, points: 100, unallocatedAmount: 0, unallocatedPoints: 0 });
    expect(r.policy).toMatchObject({
      found: true, usedDefault: false, id: 'rp-2026', name: 'Research Paper Policy 2026',
      distributionMethod: 'author_role_based',
      percentages: { firstAuthor: 35, correspondingAuthor: 30, coAuthors: 35 },
      description: 'role-based: first 35% · corresponding 30% · co-authors share 35%',
    });
    expect(r.warnings).toEqual([]);
  });

  test('sole author gets 100% only as first AND corresponding author', async () => {
    const both = await shares(makePrisma(), [{ role: 'first_and_corresponding_author' }]);
    expect(amounts(both)).toEqual([200000]);
    expect(points(both)).toEqual([100]);
    const firstOnly = await shares(makePrisma(), [{ role: 'first_author' }]);
    expect(amounts(firstOnly)).toEqual([70000]);
    expect(firstOnly.totals.unallocatedAmount).toBe(130000);
  });

  test('students earn money but no points; co-author points go to employee co-authors', async () => {
    const r = await shares(makePrisma(), [
      { role: 'first_author', position: 1 },
      { role: 'corresponding_author', position: 2 },
      { role: 'co_author', position: 3, isStudent: true },
      { role: 'co_author', position: 4 },
    ]);
    expect(amounts(r)).toEqual([70000, 60000, 35000, 35000]);
    expect(points(r)).toEqual([35, 30, 0, 35]);
  });

  test('external first author: share forfeited; external co-author: share redistributed', async () => {
    const r = await shares(makePrisma(), [
      { role: 'first_author', isInternal: false, position: 1 },
      { role: 'corresponding_author', position: 2 },
      { role: 'co_author', position: 3 },
      { role: 'co_author', isInternal: false, position: 4 },
    ]);
    expect(amounts(r)).toEqual([0, 60000, 70000, 0]);
    expect(points(r)).toEqual([0, 30, 35, 0]);
    expect(r.totals.unallocatedAmount).toBe(70000);
    expect(r.warnings.map((w) => w.code)).toEqual(['EXTERNAL_SHARE_FORFEITED', 'EXTERNAL_SHARE_REDISTRIBUTED']);
    expect(r.warnings[0].authorIndexes).toEqual([0]);
    expect(r.warnings[1].authorIndexes).toEqual([3]);
  });

  test('no policy: ₹0 for everyone and NO_INCENTIVE_POLICY', async () => {
    const r = await shares(makePrisma({ research: null }), [{ role: 'first_and_corresponding_author' }]);
    expect(amounts(r)).toEqual([0]);
    expect(r.policy).toMatchObject({ found: false, description: null });
    expect(r.warnings[0]).toMatchObject({ code: 'NO_INCENTIVE_POLICY' });
    expect(r.incentiveStatus).toMatchObject({ hasInternalAuthors: true, policyFound: false });
  });

  test('only external authors: pool and policy still reported, nothing paid', async () => {
    const r = await shares(makePrisma(), [{ role: 'first_and_corresponding_author', isInternal: false }]);
    expect(amounts(r)).toEqual([0]);
    expect(r.pool.amount).toBe(200000);
    expect(r.incentiveStatus.hasInternalAuthors).toBe(false);
  });
});

describe('computeAuthorShares — research paper, position-based', () => {
  test('positions 1–5 by policy percentage; 6 and later get ₹0 with a warning', async () => {
    const authors = [1, 2, 3, 4, 5, 6, 7].map((position) => ({ role: 'co_author', position }));
    const r = await shares(makePrisma({ research: POSITION_POLICY }), authors);
    expect(amounts(r)).toEqual([80000, 50000, 30000, 24000, 16000, 0, 0]);
    expect(points(r)).toEqual([40, 25, 15, 12, 8, 0, 0]);
    expect(r.policy.description).toBe('position-based: 1st 40% · 2nd 25% · 3rd 15% · 4th 12% · 5th 8% · 6th+ 0%');
    expect(r.warnings).toEqual([expect.objectContaining({ code: 'POSITION_BEYOND_FIFTH', authorIndexes: [5, 6] })]);
  });
});

describe('computeAuthorShares — books, chapters, conferences', () => {
  test('book: equal split, rupees and points apportioned to the pool exactly', async () => {
    const data = { bookPublicationType: 'authored', bookIndexingType: 'scopus_indexed' };
    const r = await shares(makePrisma({ book: BOOK_POLICY }), [
      { role: 'first_author', position: 1 }, { role: 'co_author', position: 2 }, { role: 'co_author', position: 3 },
    ], 'book', data);
    expect(amounts(r)).toEqual([16667, 16667, 16666]);
    expect(points(r)).toEqual([17, 17, 16]);
    expect(r.policy).toMatchObject({ name: 'Book Policy 2026', distributionMethod: 'equal_split', description: 'split equally among all authors' });
  });

  test('book with no policy: built-in defaults, flagged', async () => {
    const r = await shares(makePrisma(), [{ role: 'first_and_corresponding_author' }], 'book', { bookPublicationType: 'authored' });
    expect(amounts(r)).toEqual([50000]);
    expect(r.policy).toMatchObject({ usedDefault: true, name: 'Default book policy' });
    expect(r.warnings.map((w) => w.code)).toEqual(['DEFAULT_POLICY_USED']);
  });

  test('book chapter: student gets money only, external forfeits', async () => {
    const r = await shares(makePrisma({ chapter: CHAPTER_POLICY }), [
      { role: 'first_author', position: 1 },
      { role: 'co_author', position: 2, isStudent: true },
      { role: 'co_author', position: 3, isInternal: false },
    ], 'book_chapter', { bookPublicationType: 'authored' });
    expect(amounts(r)).toEqual([6667, 6666, 0]);
    expect(points(r)).toEqual([7, 0, 0]);
    expect(sum(amounts(r))).toBeLessThanOrEqual(20000);
    expect(r.warnings.map((w) => w.code)).toEqual(['EXTERNAL_SHARE_FORFEITED']);
  });

  test('Scopus conference paper: role split from the conference policy', async () => {
    const r = await shares(makePrisma({ conference: CONFERENCE_POLICY }), [
      { role: 'first_author', position: 1 }, { role: 'corresponding_author', position: 2 },
      { role: 'co_author', position: 3 }, { role: 'co_author', position: 4 }, { role: 'co_author', position: 5 },
    ], 'conference_paper', { conferenceSubType: 'paper_indexed_scopus', proceedingsQuartile: 'q1' });
    expect(amounts(r)).toEqual([16000, 16000, 2667, 2667, 2666]);
    expect(points(r)).toEqual([16, 16, 3, 3, 2]);
    expect(r.policy.description).toBe('role-based: first 40% · corresponding 40% · co-authors share 20%');
  });

  test('flat conference paper: default amount split equally', async () => {
    const r = await shares(makePrisma(), [
      { role: 'first_author', position: 1 }, { role: 'co_author', position: 2 }, { role: 'co_author', position: 3 },
    ], 'conference_paper', { conferenceSubType: 'paper_not_indexed', conferenceType: 'national' });
    expect(amounts(r)).toEqual([3334, 3333, 3333]);
    expect(points(r)).toEqual([4, 3, 3]);
    expect(r.policy.usedDefault).toBe(true);
  });
});

// ── Rounding ──────────────────────────────────────────────────────────────────

describe('apportion (largest remainder)', () => {
  test('never more than the pool, each share within 1 of its exact value, deterministic', () => {
    let seed = 7;
    const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    for (let run = 0; run < 500; run += 1) {
      const pool = Math.floor(rand() * 300000);
      const n = 1 + Math.floor(rand() * 9);
      const weights = Array.from({ length: n }, () => rand());
      const totalWeight = sum(weights) / (rand() < 0.3 ? 0.8 : 1); // sometimes leave part of the pool unallocated
      const raws = weights.map((w) => (pool * w) / totalWeight);
      const out = apportion(raws, pool);
      expect(sum(out)).toBeLessThanOrEqual(pool);
      out.forEach((v, i) => {
        expect(Number.isInteger(v)).toBe(true);
        expect(Math.abs(v - raws[i])).toBeLessThan(1);
      });
      expect(apportion(raws, pool)).toEqual(out);
    }
  });

  test('17.5 + 17.5 points round to 18 + 17, not 18 + 18', () => {
    expect(apportion([35, 30, 17.5, 17.5], 100)).toEqual([35, 30, 18, 17]);
  });

  test('ties go to the earlier tie rank, whatever the input order', () => {
    expect(apportion([17.5, 17.5], 35, [4, 3])).toEqual([17, 18]);
  });

  test('shares above the pool (misconfigured split) are scaled down to it', () => {
    const out = apportion([10000, 10000], 10000);
    expect(out).toEqual([5000, 5000]);
  });

  test('zero / missing values stay zero', () => {
    expect(apportion([0, NaN, undefined, 50], 50)).toEqual([0, 0, 0, 50]);
  });

  test('describeSplit trims decimals', () => {
    expect(describeSplit({ distributionMethod: 'author_role_based', percentages: { firstAuthor: 35.0, correspondingAuthor: 30, coAuthors: 35 } }))
      .toBe('role-based: first 35% · corresponding 30% · co-authors share 35%');
  });
});

// ── Parity: preview == saved == credited ──────────────────────────────────────

const faculty = (uid, name, role, extra = {}) => ({ authorType: 'internal_faculty', registrationNumber: uid, name, authorRole: role, affiliation: 'SGT University', ...extra });

const PARITY_CASES = [
  {
    name: 'DEMO 4-author Nature/Science paper (role-based)',
    prismaOptions: {},
    payload: {
      publicationType: 'research_paper', ...paper,
      authors: [
        { ...faculty('DEMO-FAC-01', 'Applicant', 'corresponding_author'), isCorresponding: true, orderNumber: 1 },
        { ...faculty('DEMO-FAC-05', 'Suresh Patel', 'first_author'), orderNumber: 2 },
        { ...faculty('DEMO-FAC-02', 'Co One', 'co_author'), orderNumber: 3 },
        { ...faculty('DEMO-FAC-03', 'Co Two', 'co_author'), orderNumber: 4 },
      ],
    },
    expected: { amounts: [60000, 70000, 35000, 35000], points: [30, 35, 18, 17] },
  },
  {
    name: 'applicant as co-author (was double-counted at save)',
    prismaOptions: {},
    payload: {
      publicationType: 'research_paper', ...paper,
      authors: [
        { ...faculty('A', 'Applicant', 'co_author'), orderNumber: 1 },
        { ...faculty('B', 'First', 'first_author'), orderNumber: 2 },
        { ...faculty('C', 'Corr', 'corresponding_author'), orderNumber: 3 },
        { ...faculty('D', 'Co', 'co_author'), orderNumber: 4 },
      ],
    },
    expected: { amounts: [35000, 70000, 60000, 35000], points: [18, 35, 30, 17] },
  },
  {
    name: 'student (by author type and by linked account) and external authors',
    prismaOptions: { users: [{ id: 'stu-user', uid: 'STU-9', role: 'student' }] },
    payload: {
      publicationType: 'research_paper', ...paper,
      authors: [
        { ...faculty('A', 'Applicant', 'first_author'), orderNumber: 1 },
        { authorType: 'external_academic', name: 'Ext Corr', authorRole: 'corresponding_author', affiliation: 'Stanford University', orderNumber: 2 },
        { authorType: 'internal_student', registrationNumber: 'STU-1', name: 'Student', authorRole: 'co_author', orderNumber: 3 },
        { ...faculty('STU-9', 'Linked student', 'co_author'), orderNumber: 4 },
        { authorType: 'external_industry', name: 'Ext Co', authorRole: 'co_author', orderNumber: 5 },
      ],
    },
    expected: { amounts: [70000, 0, 35000, 35000, 0], points: [35, 0, 0, 0, 0] },
  },
  {
    name: 'sole author',
    prismaOptions: {},
    payload: { publicationType: 'research_paper', ...paper, authors: [{ ...faculty('A', 'Solo', 'first_and_corresponding_author'), orderNumber: 1 }] },
    expected: { amounts: [200000], points: [100] },
  },
  {
    name: 'position-based with 6 authors',
    prismaOptions: { research: POSITION_POLICY },
    payload: {
      publicationType: 'research_paper', ...paper,
      authors: [1, 2, 3, 4, 5, 6].map((n) => ({ ...faculty(`P${n}`, `Author ${n}`, n === 1 ? 'author' : 'co_author'), orderNumber: n, authorPosition: n })),
    },
    expected: { amounts: [80000, 50000, 30000, 24000, 16000, 0], points: [40, 25, 15, 12, 8, 0] },
  },
  {
    name: 'book (3 authors)',
    prismaOptions: { book: BOOK_POLICY },
    payload: {
      publicationType: 'book', bookPublicationType: 'authored', bookIndexingType: 'scopus_indexed', nationalInternational: 'national',
      authors: ['A', 'B', 'C'].map((u, i) => ({ ...faculty(u, u, i ? 'co_author' : 'first_author'), orderNumber: i + 1 })),
    },
    expected: { amounts: [16667, 16667, 16666], points: [17, 17, 16] },
  },
  {
    name: 'book chapter (2 authors)',
    prismaOptions: { chapter: CHAPTER_POLICY },
    payload: {
      publicationType: 'book_chapter', bookPublicationType: 'authored',
      authors: ['A', 'B'].map((u, i) => ({ ...faculty(u, u, i ? 'co_author' : 'first_author'), orderNumber: i + 1 })),
    },
    expected: { amounts: [10000, 10000], points: [10, 10] },
  },
  {
    name: 'Scopus conference paper',
    prismaOptions: { conference: CONFERENCE_POLICY },
    payload: {
      publicationType: 'conference_paper', conferenceSubType: 'paper_indexed_scopus', proceedingsQuartile: 'q1', conferenceType: 'national',
      authors: [
        { ...faculty('A', 'A', 'first_author'), orderNumber: 1 },
        { ...faculty('B', 'B', 'corresponding_author'), orderNumber: 2 },
        { ...faculty('C', 'C', 'co_author'), orderNumber: 3 },
      ],
    },
    expected: { amounts: [16000, 16000, 8000], points: [16, 16, 8] },
  },
];

/** Stored contribution as approval reads it: the publication fields + the saved author rows. */
function storedContribution(payload, rows) {
  const { authors: _authors, ...fields } = payload;
  return {
    id: 'c1', universityId: 'uni-1', ...fields,
    authors: rows.map((row, i) => ({ id: `a${i}`, ...row })).reverse(), // DB order is not author order
  };
}

describe('parity: preview == saved (createContribution) == credited (approval)', () => {
  test.each(PARITY_CASES)('$name', async ({ prismaOptions, payload, expected }) => {
    const prisma = makePrisma(prismaOptions);
    const contributionService = new ContributionService({}, null, null, prisma);
    const reviewService = new ReviewService({}, {}, null, prisma, null);
    const data = { ...payload, title: 'Parity', userId: 'u-applicant', userRole: 'faculty' };

    const preview = await contributionService.previewIncentiveShares(data);
    expect(prisma.researchContributionAuthor.createMany).not.toHaveBeenCalled(); // preview is read-only

    await contributionService._createAuthors('c1', data);
    const rows = prisma.researchContributionAuthor.createMany.mock.calls[0][0].data;

    const credited = await reviewService._creditIncentivesToAuthors(storedContribution(data, rows), 'c1', prisma);
    const creditedById = Object.fromEntries(credited.authorShares.map((a) => [a.id, a]));
    const creditedInOrder = rows.map((_, i) => creditedById[`a${i}`]);

    expect(amounts(preview)).toEqual(expected.amounts);
    expect(points(preview)).toEqual(expected.points);
    expect(rows.map((r) => r.incentiveShare)).toEqual(expected.amounts);
    expect(rows.map((r) => r.pointsShare)).toEqual(expected.points);
    expect(creditedInOrder.map((a) => a.incentiveShare)).toEqual(expected.amounts);
    expect(creditedInOrder.map((a) => a.pointsShare)).toEqual(expected.points);
    expect(credited.totalIncentiveAwarded).toBe(preview.totals.amount);
    expect(credited.totalPointsAwarded).toBe(preview.totals.points);
    expect(preview.totals.amount).toBeLessThanOrEqual(preview.pool.amount);
    expect(preview.totals.points).toBeLessThanOrEqual(preview.pool.points);
  });

  test('createContribution stores the preview pool on the contribution', async () => {
    const prisma = {
      ...makePrisma(),
      researchContributionApplicantDetails: { create: jest.fn() },
      researchContributionStatusHistory: { create: jest.fn() },
      department: { findUnique: jest.fn(async () => null) },
    };
    const repo = {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async (payload) => ({ id: 'c1', ...payload })),
      findById: jest.fn(async () => ({ id: 'c1', authors: [] })),
    };
    const service = new ContributionService(repo, null, null, prisma);
    jest.spyOn(service, 'validateContributionData').mockResolvedValue();
    jest.spyOn(service, '_resolveSchoolAndDepartment').mockResolvedValue({});
    jest.spyOn(service, 'dispatchPostCreationSideEffects').mockResolvedValue();
    const payload = { ...PARITY_CASES[0].payload, title: 'X', userId: 'u1', userRole: 'faculty' };

    const preview = await service.previewIncentiveShares(payload);
    await service.createContribution(payload);

    const stored = repo.create.mock.calls[0][0];
    expect(stored.calculatedIncentiveAmount).toBe(preview.pool.amount);
    expect(stored.calculatedPoints).toBe(preview.pool.points);
    const rows = prisma.researchContributionAuthor.createMany.mock.calls[0][0].data;
    expect(rows.map((r) => [r.incentiveShare, r.pointsShare])).toEqual(preview.authors.map((a) => [a.incentive, a.points]));
  });
});
