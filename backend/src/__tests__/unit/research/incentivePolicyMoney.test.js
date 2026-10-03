/**
 * Incentive money safety:
 *   - Prisma Decimal / string policy values are added as numbers (70000 + 2000 + 3000 = 75000,
 *     never "7000020003000"), on every calculator path
 *   - a pool above the per-work cap throws instead of paying
 *   - "no policy" is reported (policyFound:false + reason), defaults are flagged (usedDefaultPolicy)
 *   - IPR policy selection is date-based and flags the built-in defaults
 */
const { IncentiveCalculator } = require('../../../modules/research/services/incentive-calculator');
const { toNumber, assertWithinCap, maxIncentivePerWork } = require('../../../modules/research/utils/policyMath');
const { resolveIprPolicy } = require('../../../modules/research/utils/iprIncentive');

/** Minimal stand-in for a Prisma Decimal: an object, so `+` would string-concatenate. */
const dec = (v) => ({ toNumber: () => Number(v), toString: () => String(v), valueOf: () => String(v) });

const makePrisma = (overrides = {}) => ({
  bookIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
  bookChapterIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
  conferenceIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
  researchIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) },
  ...overrides,
});

describe('policyMath', () => {
  test('toNumber handles Decimal, numeric strings, null and junk', () => {
    expect(toNumber(dec('70000.00'))).toBe(70000);
    expect(toNumber('2000')).toBe(2000);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined, 5)).toBe(5);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(Infinity)).toBe(0);
  });

  test('assertWithinCap allows 0..cap and rejects above the cap or negative', () => {
    expect(assertWithinCap(75000)).toBe(75000);
    expect(assertWithinCap(0)).toBe(0);
    expect(() => assertWithinCap(maxIncentivePerWork() + 1)).toThrow(expect.objectContaining({ code: 'INCENTIVE_ABOVE_CAP', statusCode: 422 }));
    expect(() => assertWithinCap(-1)).toThrow(/outside the allowed range/);
  });

  test('cap is configurable via MAX_INCENTIVE_PER_WORK', () => {
    const prev = process.env.MAX_INCENTIVE_PER_WORK;
    process.env.MAX_INCENTIVE_PER_WORK = '50000';
    try {
      expect(() => assertWithinCap(50001)).toThrow(/₹50,000/);
    } finally {
      if (prev === undefined) delete process.env.MAX_INCENTIVE_PER_WORK; else process.env.MAX_INCENTIVE_PER_WORK = prev;
    }
  });
});

describe('IncentiveCalculator with Decimal policy values', () => {
  const bookPolicy = {
    id: 'bp1',
    authoredIncentiveAmount: dec('70000.00'), authoredPoints: 50,
    editedIncentiveAmount: dec('40000.00'), editedPoints: 40,
    indexingBonuses: { scopus_indexed: '2000', non_indexed: 0, sgt_publication_house: dec(1000) },
    internationalBonus: dec('3000.00'),
  };

  test('book: 70000 + 2000 + 3000 = 75000 (not "7000020003000")', async () => {
    const prisma = makePrisma({ bookIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(bookPolicy) } });
    const r = await new IncentiveCalculator(prisma).calculate({
      contributionData: { publicationDate: '2026-03-01', bookType: 'authored', indexing: 'scopus_indexed', isInternational: true },
      publicationType: 'book', authorRole: 'first_author', totalAuthors: 1, isInternal: true,
    });
    expect(r.totalPoolAmount).toBe(75000);
    expect(r.incentiveAmount).toBe(75000);
    expect(typeof r.totalPoolAmount).toBe('number');
    expect(r).toMatchObject({ policyFound: true, usedDefaultPolicy: false, policyId: 'bp1' });
  });

  test('book chapter: Decimal amounts split numerically between authors', async () => {
    const prisma = makePrisma({ bookChapterIncentivePolicy: { findFirst: jest.fn().mockResolvedValue(bookPolicy) } });
    const r = await new IncentiveCalculator(prisma).calculate({
      contributionData: { publicationDate: '2026-03-01', bookType: 'edited', indexing: 'sgt_publication_house' },
      publicationType: 'book_chapter', authorRole: 'co_author', totalAuthors: 2, isInternal: true,
    });
    expect(r.totalPoolAmount).toBe(41000);
    expect(r.incentiveAmount).toBe(20500);
  });

  test('book: a configured 0 is honoured (not replaced by the default 50000)', async () => {
    const prisma = makePrisma({
      bookIncentivePolicy: { findFirst: jest.fn().mockResolvedValue({ ...bookPolicy, authoredIncentiveAmount: dec(0), internationalBonus: null }) },
    });
    const r = await new IncentiveCalculator(prisma).calculate({
      contributionData: { publicationDate: '2026-03-01', bookType: 'authored' },
      publicationType: 'book', authorRole: 'first_author', totalAuthors: 1, isInternal: true,
    });
    expect(r.totalPoolAmount).toBe(0);
  });

  test('book without a configured policy uses the defaults and says so', async () => {
    const r = await new IncentiveCalculator(makePrisma()).calculate({
      contributionData: { publicationDate: '2026-03-01', bookType: 'authored' },
      publicationType: 'book', authorRole: 'first_author', totalAuthors: 1, isInternal: true,
    });
    expect(r).toMatchObject({ totalPoolAmount: 50000, policyFound: true, usedDefaultPolicy: true });
  });

  test('conference (flat): Decimal flat amount + bonuses add numerically', async () => {
    const prisma = makePrisma({
      conferenceIncentivePolicy: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cp1', flatIncentiveAmount: dec('15000.00'), flatPoints: 15,
          internationalBonus: dec('5000.00'), bestPaperAwardBonus: '2500',
        }),
      },
    });
    const r = await new IncentiveCalculator(prisma).calculate({
      contributionData: { publicationDate: '2026-03-01', conferenceSubType: 'paper_not_indexed', conferenceType: 'international', conferenceBestPaperAward: 'yes' },
      publicationType: 'conference_paper', authorRole: 'first_author', totalAuthors: 1, isInternal: true,
    });
    expect(r.totalPoolAmount).toBe(22500);
  });

  test('conference (scopus): string quartile amounts and Decimal bonuses', async () => {
    const prisma = makePrisma({
      conferenceIncentivePolicy: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cp2',
          quartileIncentives: [{ quartile: 'Q1', incentiveAmount: '40000', points: '40' }],
          rolePercentages: [{ role: 'first_author', percentage: '40' }, { role: 'corresponding_author', percentage: 30 }],
          internationalBonus: dec(5000), bestPaperAwardBonus: dec(0),
        }),
      },
    });
    const r = await new IncentiveCalculator(prisma).calculate({
      contributionData: { publicationDate: '2026-03-01', conferenceSubType: 'paper_indexed_scopus', proceedingsQuartile: 'Q1', conferenceType: 'international' },
      publicationType: 'conference_paper', authorRole: 'first_and_corresponding_author', totalAuthors: 2, internalCoAuthorCount: 1, coAuthorCount: 1, isInternal: true,
    });
    expect(r.totalPoolAmount).toBe(45000);
    expect(r.incentiveAmount).toBe(Math.round(45000 * 0.7));
  });

  test('research: Decimal percentages and string JSON amounts', async () => {
    const prisma = makePrisma({
      researchIncentivePolicy: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'rp1', distributionMethod: 'author_role_based',
          first_author_percentage: dec('35.00'), corresponding_author_percentage: dec('30.00'),
          indexingBonuses: { indexingCategoryBonuses: [{ category: 'pubmed', incentiveAmount: '15000', points: '15' }] },
        }),
      },
    });
    const r = await new IncentiveCalculator(prisma).calculate({
      contributionData: { publicationDate: '2026-03-01', indexingCategories: ['pubmed'] },
      publicationType: 'research_paper', authorRole: 'first_author', totalAuthors: 3, internalCoAuthorCount: 1, coAuthorCount: 1, isInternal: true,
    });
    expect(r.totalPoolAmount).toBe(15000);
    expect(r.incentiveAmount).toBe(5250);
    expect(r).toMatchObject({ policyFound: true, policyId: 'rp1' });
  });

  test('research: position-based distribution with string percentages', async () => {
    const prisma = makePrisma({
      researchIncentivePolicy: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'rp2', distributionMethod: 'author_position_based',
          first_author_percentage: 40, corresponding_author_percentage: 30,
          positionBasedDistribution: { 1: '40', 2: '30', 3: '15', 4: '10', 5: '5', '6+': 0 },
          indexingBonuses: { indexingCategoryBonuses: [{ category: 'pubmed', incentiveAmount: 10000, points: 10 }] },
        }),
      },
    });
    const r = await new IncentiveCalculator(prisma).calculate({
      contributionData: { publicationDate: '2026-03-01', indexingCategories: ['pubmed'] },
      publicationType: 'research_paper', authorRole: 'co_author', authorPosition: 2, totalAuthors: 3, isInternal: true,
    });
    expect(r.incentiveAmount).toBe(3000);
  });

  test('a pool above the cap throws instead of paying', async () => {
    const prisma = makePrisma({
      bookIncentivePolicy: { findFirst: jest.fn().mockResolvedValue({ ...bookPolicy, authoredIncentiveAmount: '7000020003000' }) },
    });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(new IncentiveCalculator(prisma).calculate({
      contributionData: { publicationDate: '2026-03-01', bookType: 'authored' },
      publicationType: 'book', authorRole: 'first_author', totalAuthors: 1, isInternal: true,
    })).rejects.toMatchObject({ code: 'INCENTIVE_ABOVE_CAP', statusCode: 422 });
    spy.mockRestore();
  });

  test('research paper with no policy for its date → policyFound:false with the reason', async () => {
    const prisma = makePrisma();
    const r = await new IncentiveCalculator(prisma).calculate({
      contributionData: { publicationDate: '2019-05-01', indexingCategories: ['pubmed'] },
      publicationType: 'research_paper', authorRole: 'first_author', isInternal: true,
    });
    expect(r).toMatchObject({ incentiveAmount: 0, policyFound: false, reason: 'No incentive policy covers this publication date/type' });
    // selection is by enabled + effective window (calendar day of the publication)
    const { where } = prisma.researchIncentivePolicy.findFirst.mock.calls[0][0];
    expect(where).toMatchObject({ publicationType: 'research_paper', isActive: true });
    expect(where.effectiveFrom.lt.toISOString()).toBe('2019-05-02T00:00:00.000Z');
    expect(where.OR[1].effectiveTo.gte.toISOString()).toBe('2019-05-01T00:00:00.000Z');
  });
});

describe('resolveIprPolicy', () => {
  test('selects the enabled policy whose window covers the date', async () => {
    const client = { incentivePolicy: { findFirst: jest.fn().mockResolvedValue({ id: 'ip1', baseIncentiveAmount: dec(60000), basePoints: 60 }) } };
    const r = await resolveIprPolicy(client, 'PATENT', new Date('2026-06-15T10:00:00Z'));
    expect(r).toMatchObject({ iprType: 'patent', usedDefaultPolicy: false, policy: { id: 'ip1' } });
    const arg = client.incentivePolicy.findFirst.mock.calls[0][0];
    expect(arg.where).toMatchObject({ iprType: 'patent', isActive: true });
    expect(arg.where.effectiveFrom.lt.toISOString()).toBe('2026-06-16T00:00:00.000Z');
    expect(arg.orderBy).toEqual({ effectiveFrom: 'desc' });
  });

  test('falls back to the built-in defaults and flags it', async () => {
    const client = { incentivePolicy: { findFirst: jest.fn().mockResolvedValue(null) } };
    const r = await resolveIprPolicy(client, 'copyright');
    expect(r).toMatchObject({ usedDefaultPolicy: true, policy: { baseIncentiveAmount: 15000 } });
  });
});
