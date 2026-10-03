/**
 * Policy create/update endpoints: validation → 400, overlaps → 409, and the previous policy
 * is closed in the SAME transaction as the create (no half-applied state, no 500).
 */
const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/utils/auditLogger', () => ({
  logPolicyCreation: jest.fn(() => Promise.resolve()),
  logPolicyUpdate: jest.fn(() => Promise.resolve()),
  logPolicyDeletion: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../shared/config/redis', () => ({
  delPattern: jest.fn(() => Promise.resolve()),
  CACHE_KEYS: { POLICY: 'policy:' },
}));

const research = require('../../../modules/research/controllers/policies/research.policy.controller');
const book = require('../../../modules/research/controllers/policies/book.policy.controller');
const conference = require('../../../modules/research/controllers/policies/conference.policy.controller');
const grant = require('../../../modules/research/controllers/policies/grant.policy.controller');
const ipr = require('../../../modules/research/controllers/policies/incentive.policy.controller');

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
};
const req = (body, extra = {}) => ({ body, params: {}, query: {}, user: { id: 'admin-1' }, tenantId: 'uni-1', ...extra });

/** A model delegate whose writes are recorded; tx and top-level client share it. */
const delegate = (rows = []) => ({
  findMany: jest.fn().mockResolvedValue(rows),
  findFirst: jest.fn().mockResolvedValue(null),
  findUnique: jest.fn().mockResolvedValue(null),
  update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
  create: jest.fn(async ({ data }) => ({ id: 'new-id', ...data })),
});

beforeEach(() => {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  mockPrisma.$transaction = jest.fn(async (cb) => cb(mockPrisma));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('research policy create/update', () => {
  const body = {
    publicationType: 'research_paper', policyName: 'RP 2027', baseIncentiveAmount: 0, basePoints: 0,
    distributionMethod: 'author_role_based', firstAuthorPercentage: 35, correspondingAuthorPercentage: 30,
    effectiveFrom: '2027-01-01', indexingBonuses: { indexingCategoryBonuses: [] },
  };

  test('closes the current policy the day before and creates the new one in one transaction (future-dated stays enabled)', async () => {
    mockPrisma.researchIncentivePolicy = delegate([
      { id: 'p2026', policyName: 'RP 2026', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true },
    ]);
    const res = makeRes();
    await research.createPolicy(req(body), res);

    expect(res.statusCode).toBe(201);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.researchIncentivePolicy.update).toHaveBeenCalledWith({
      where: { id: 'p2026' }, data: { effectiveTo: new Date('2026-12-31T00:00:00Z'), updatedById: 'admin-1' },
    });
    const { data } = mockPrisma.researchIncentivePolicy.create.mock.calls[0][0];
    expect(data).toMatchObject({
      isActive: true, // NOT derived from dates: a 2027 policy is enabled now and applies from 2027
      universityId: 'uni-1', createdById: 'admin-1',
      first_author_percentage: 35, corresponding_author_percentage: 30,
    });
    expect(res.body.adjustedPolicies).toEqual([expect.objectContaining({ id: 'p2026' })]);
  });

  test('looks only at the tenant\'s enabled policies of the same type', async () => {
    mockPrisma.researchIncentivePolicy = delegate([]);
    await research.createPolicy(req(body), makeRes());
    expect(mockPrisma.researchIncentivePolicy.findMany.mock.calls[0][0].where)
      .toEqual({ publicationType: 'research_paper', universityId: 'uni-1', isActive: true });
  });

  test('invalid input is a 400 with every problem listed, nothing written', async () => {
    mockPrisma.researchIncentivePolicy = delegate([]);
    const res = makeRes();
    await research.createPolicy(req({ ...body, firstAuthorPercentage: 80, correspondingAuthorPercentage: 30, effectiveTo: '2026-01-01' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_POLICY');
    expect(res.body.errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/Effective to date cannot be before/),
      expect.stringMatching(/cannot exceed 100%/),
    ]));
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('a DB exclusion violation (concurrent save) becomes 409, not 500', async () => {
    mockPrisma.researchIncentivePolicy = delegate([]);
    mockPrisma.researchIncentivePolicy.create.mockRejectedValue(new Error('violates exclusion constraint "research_incentive_policy_no_overlap"'));
    const res = makeRes();
    await research.createPolicy(req(body), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('POLICY_OVERLAP');
  });

  test('PUT applies the same validation to the merged policy and keeps isActive unless sent', async () => {
    const existing = {
      id: 'p2026', universityId: 'uni-1', publicationType: 'research_paper', policyName: 'RP 2026',
      baseIncentiveAmount: 0, basePoints: 0, splitPolicy: 'percentage_based', distributionMethod: 'author_role_based',
      first_author_percentage: 40, corresponding_author_percentage: 30, indexingBonuses: {},
      effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true,
    };
    mockPrisma.researchIncentivePolicy = delegate([]);
    mockPrisma.researchIncentivePolicy.findUnique.mockResolvedValue(existing);

    const bad = makeRes();
    await research.updatePolicy(req({ baseIncentiveAmount: -1 }, { params: { id: 'p2026' } }), bad);
    expect(bad.statusCode).toBe(400);

    const ok = makeRes();
    await research.updatePolicy(req({ firstAuthorPercentage: 35, effectiveTo: '2026-12-31' }, { params: { id: 'p2026' } }), ok);
    expect(ok.statusCode).toBe(200);
    expect(mockPrisma.researchIncentivePolicy.update).toHaveBeenCalledWith({
      where: { id: 'p2026' },
      data: expect.objectContaining({ first_author_percentage: 35, isActive: true, effectiveTo: new Date('2026-12-31T00:00:00Z'), updatedById: 'admin-1' }),
    });
  });
});

describe('book policy create', () => {
  const body = { publicationType: 'book', policyName: 'Books 2026', authoredIncentiveAmount: 70000, editedIncentiveAmount: 40000, effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' };

  test('rejects a window that engulfs an existing enabled policy (409)', async () => {
    mockPrisma.bookIncentivePolicy = delegate([
      { id: 'b-mid', policyName: 'Mid-year', effectiveFrom: new Date('2026-04-01'), effectiveTo: new Date('2026-06-30'), isActive: true },
    ]);
    const res = makeRes();
    await book.createBookPolicy(req(body), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('POLICY_OVERLAP');
    expect(mockPrisma.bookIncentivePolicy.create).not.toHaveBeenCalled();
  });

  test('negative amount → 400; list rows carry publicationType', async () => {
    mockPrisma.bookIncentivePolicy = delegate([]);
    const res = makeRes();
    await book.createBookPolicy(req({ ...body, internationalBonus: -5 }), res);
    expect(res.statusCode).toBe(400);

    mockPrisma.bookIncentivePolicy.findMany.mockResolvedValue([{ id: 'b1', policyName: 'B' }]);
    const list = makeRes();
    await book.getAllBookPolicies(req({}), list);
    expect(list.body.data).toEqual([{ id: 'b1', policyName: 'B', publicationType: 'book' }]);
  });
});

describe('conference and grant policy create', () => {
  test('conference scopus without role percentages → 400', async () => {
    mockPrisma.conferenceIncentivePolicy = delegate([]);
    const res = makeRes();
    await conference.createConferencePolicy(req({
      policyName: 'Scopus', conferenceSubType: 'paper_indexed_scopus', quartileIncentives: [{ quartile: 'Q1', incentiveAmount: 1, points: 1 }],
    }), res);
    expect(res.statusCode).toBe(400);
  });

  test('grant: overlap with an enabled policy of the same category/type → 409', async () => {
    mockPrisma.grantIncentivePolicy = delegate([
      { id: 'g1', policyName: 'Govt intl', effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true },
    ]);
    const res = makeRes();
    await grant.createGrantPolicy(req({
      policyName: 'Govt intl v2', projectCategory: 'govt', projectType: 'international', baseIncentiveAmount: 25000, basePoints: 30,
      splitPolicy: 'equal', effectiveFrom: '2026-06-01',
    }), res);
    expect(res.statusCode).toBe(409);
    expect(mockPrisma.grantIncentivePolicy.findMany.mock.calls[0][0].where)
      .toMatchObject({ projectCategory: 'govt', projectType: 'international', universityId: 'uni-1', isActive: true });
  });
});

describe('IPR policy create/update', () => {
  test('a new version closes the previous one and keeps it enabled (versions are unlimited)', async () => {
    mockPrisma.incentivePolicy = delegate([
      { id: 'ip-v2', policyName: 'Patent v2', effectiveFrom: new Date('2026-03-01'), effectiveTo: null, isActive: true },
    ]);
    const res = makeRes();
    await ipr.createPolicy(req({ iprType: 'patent', policyName: 'Patent v3', baseIncentiveAmount: 60000, basePoints: 60, effectiveFrom: '2026-10-02' }), res);
    expect(res.statusCode).toBe(201);
    expect(mockPrisma.incentivePolicy.update).toHaveBeenCalledWith({
      where: { id: 'ip-v2' }, data: { effectiveTo: new Date('2026-10-01T00:00:00Z'), updatedById: 'admin-1' },
    });
    expect(mockPrisma.incentivePolicy.create.mock.calls[0][0].data).toMatchObject({ iprType: 'patent', isActive: true, effectiveTo: null });
  });

  test('update honours effectiveTo and is validated', async () => {
    const existing = {
      id: 'ip1', universityId: 'uni-1', iprType: 'patent', policyName: 'P', baseIncentiveAmount: 50000, basePoints: 50,
      splitPolicy: 'equal', primaryInventorShare: null, effectiveFrom: new Date('2026-01-01'), effectiveTo: null, isActive: true,
    };
    mockPrisma.incentivePolicy = delegate([]);
    mockPrisma.incentivePolicy.findUnique.mockResolvedValue(existing);
    const res = makeRes();
    await ipr.updatePolicy(req({ effectiveTo: '2026-12-31' }, { params: { id: 'ip1' } }), res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.incentivePolicy.update.mock.calls[0][0].data).toMatchObject({ effectiveTo: new Date('2026-12-31T00:00:00Z') });

    const bad = makeRes();
    await ipr.updatePolicy(req({ effectiveTo: '2025-01-01' }, { params: { id: 'ip1' } }), bad);
    expect(bad.statusCode).toBe(400);
  });
});
