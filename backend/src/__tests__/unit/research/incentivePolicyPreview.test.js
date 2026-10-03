/**
 * Policy previews agree with what is paid:
 *   - research / grant: no policy → policyFound:false + reason, data null (₹0), never defaults
 *   - book / chapter / conference / IPR: no policy → the calculator's built-in defaults, flagged
 *   - policies are selected by the date given (publicationDate / onDate)
 * Grant approval selects its policy by sanction → submission → approval date and records it.
 * The zero-incentive report is read-only.
 */
const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/utils/auditLogger', () => ({
  logPolicyCreation: jest.fn(() => Promise.resolve()),
  logPolicyUpdate: jest.fn(() => Promise.resolve()),
  logPolicyDeletion: jest.fn(() => Promise.resolve()),
  logResearchFiling: jest.fn(() => Promise.resolve()),
  logResearchUpdate: jest.fn(() => Promise.resolve()),
  logResearchStatusChange: jest.fn(() => Promise.resolve()),
  logFileUpload: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../shared/config/redis', () => ({ delPattern: jest.fn(), CACHE_KEYS: { POLICY: 'policy:' } }));

const research = require('../../../modules/research/controllers/policies/research.policy.controller');
const book = require('../../../modules/research/controllers/policies/book.policy.controller');
const chapter = require('../../../modules/research/controllers/policies/bookChapter.policy.controller');
const conference = require('../../../modules/research/controllers/policies/conference.policy.controller');
const grant = require('../../../modules/research/controllers/policies/grant.policy.controller');
const ipr = require('../../../modules/research/controllers/policies/incentive.policy.controller');
const { IncentiveCalculator, DEFAULT_BOOK_POLICY } = require('../../../modules/research/services/incentive-calculator');
const { computeIprIncentive } = require('../../../modules/research/utils/iprIncentive');
const { grantPolicyDate } = require('../../../modules/grants/utils/grantPolicyDate');
const GrantService = require('../../../modules/grants/services/grant.service');
const { readOnlyClient } = require('../../../../scripts/finance/report-zero-incentives');

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((c) => { res.statusCode = c; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
};
const none = () => ({ findFirst: jest.fn().mockResolvedValue(null) });

beforeEach(() => {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  for (const m of ['researchIncentivePolicy', 'bookIncentivePolicy', 'bookChapterIncentivePolicy', 'conferenceIncentivePolicy', 'grantIncentivePolicy', 'incentivePolicy']) {
    mockPrisma[m] = none();
  }
});

describe('research previews: no defaults, ₹0 like the calculator', () => {
  test('applicable-by-date with no policy → policyFound:false, data null', async () => {
    const res = makeRes();
    await research.getApplicablePolicyByDate({ query: { publicationType: 'research_paper', publicationDate: '2019-05-01' }, tenantId: 'u' }, res);
    expect(res.body).toMatchObject({ success: true, policyFound: false, data: null, reason: 'No incentive policy covers this publication date/type' });
    const { where } = mockPrisma.researchIncentivePolicy.findFirst.mock.calls[0][0];
    expect(where.effectiveFrom.lt.toISOString()).toBe('2019-05-02T00:00:00.000Z');

    // and the calculator agrees: ₹0, policyFound false
    const calc = await new IncentiveCalculator(mockPrisma).calculate({
      contributionData: { publicationDate: '2019-05-01', indexingCategories: ['pubmed'] },
      publicationType: 'research_paper', authorRole: 'first_author', isInternal: true,
    });
    expect(calc).toMatchObject({ incentiveAmount: 0, policyFound: false });
  });

  test('active/:type with no policy → policyFound:false; a policy → policyFound:true', async () => {
    let res = makeRes();
    await research.getPolicyByType({ params: { publicationType: 'research_paper' }, query: {} }, res);
    expect(res.body).toMatchObject({ policyFound: false, data: null });

    mockPrisma.researchIncentivePolicy.findFirst.mockResolvedValue({ id: 'p1', policyName: 'RP' });
    res = makeRes();
    await research.getPolicyByType({ params: { publicationType: 'research_paper' }, query: {} }, res);
    expect(res.body).toMatchObject({ policyFound: true, usedDefaultPolicy: false, data: { id: 'p1', policyFound: true } });
  });

  test('an invalid date is a 400', async () => {
    const res = makeRes();
    await research.getApplicablePolicyByDate({ query: { publicationType: 'research_paper', publicationDate: 'soon' } }, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('book / chapter / conference / IPR previews: the defaults the calculator pays, flagged', () => {
  test('book: defaults equal the calculator default and give the same pool', async () => {
    const res = makeRes();
    await book.getActivePolicyByType({ params: { publicationType: 'book' }, query: { publicationDate: '2026-04-01' } }, res);
    expect(res.body).toMatchObject({ policyFound: true, usedDefaultPolicy: true, data: { ...DEFAULT_BOOK_POLICY, isDefault: true, publicationType: 'book' } });
    const calc = await new IncentiveCalculator(mockPrisma).calculate({
      contributionData: { publicationDate: '2026-04-01', bookType: 'authored', indexing: 'scopus_indexed', isInternational: true },
      publicationType: 'book', authorRole: 'first_author', totalAuthors: 1, isInternal: true,
    });
    const d = res.body.data;
    expect(calc.totalPoolAmount).toBe(d.authoredIncentiveAmount + d.indexingBonuses.scopus_indexed + d.internationalBonus);
    expect(mockPrisma.bookIncentivePolicy.findFirst.mock.calls[0][0].where.effectiveFrom.lt.toISOString()).toBe('2026-04-02T00:00:00.000Z');
  });

  test('book chapter: defaults flagged; a configured policy is returned as is', async () => {
    let res = makeRes();
    await chapter.getActivePolicy({ query: {} }, res);
    expect(res.body).toMatchObject({ usedDefaultPolicy: true, data: { publicationType: 'book_chapter', authoredIncentiveAmount: 50000 } });
    mockPrisma.bookChapterIncentivePolicy.findFirst.mockResolvedValue({ id: 'c1', authoredIncentiveAmount: 1 });
    res = makeRes();
    await chapter.getActivePolicy({ query: {} }, res);
    expect(res.body).toMatchObject({ usedDefaultPolicy: false, data: { id: 'c1', publicationType: 'book_chapter' } });
  });

  test('conference: scopus defaults (quartiles + 40/40 split, no bonuses); flat → default levels', async () => {
    let res = makeRes();
    await conference.getActivePolicyBySubType({ params: { subType: 'paper_indexed_scopus' }, query: {} }, res);
    expect(res.body.data).toMatchObject({
      usedDefaultPolicy: true, internationalBonus: null,
      rolePercentages: [{ role: 'first_author', percentage: 40 }, { role: 'corresponding_author', percentage: 40 }],
    });
    expect(res.body.data.quartileIncentives.find((q) => q.quartile === 'Q1').incentiveAmount).toBe(40000);

    res = makeRes();
    await conference.getActivePolicyBySubType({ params: { subType: 'keynote_speaker_invited_talks' }, query: {} }, res);
    expect(res.body.data).toMatchObject({ flatIncentiveAmount: null, defaultLevels: { international: { incentiveAmount: 20000 } } });
  });

  test('IPR: defaults flagged; calculate mirrors publication (base amount, equal split, no multipliers)', async () => {
    let res = makeRes();
    await ipr.getPolicyByType({ params: { iprType: 'design' }, query: {} }, res);
    expect(res.body).toMatchObject({ usedDefaultPolicy: true, data: { baseIncentiveAmount: 20000, isDefault: true } });

    mockPrisma.incentivePolicy.findFirst.mockResolvedValue({ id: 'ip', baseIncentiveAmount: 90000, basePoints: 30, filingTypeMultiplier: { complete: 2 }, projectTypeBonus: { funded: 10000 } });
    res = makeRes();
    await ipr.calculateIncentive({ body: { iprType: 'patent', filingType: 'complete', projectType: 'funded', inventorCount: 4 } }, res);
    expect(res.body.data).toMatchObject({ totalIncentive: 90000, perInventorIncentive: 22500, perInventorPoints: 7, usedDefaultPolicy: false });
    expect(res.body.data).toMatchObject(computeIprIncentive({ baseIncentiveAmount: 90000, basePoints: 30 }, 4));
  });
});

describe('grant previews and approval date', () => {
  test('preview with no policy → policyFound:false; selects by ?onDate', async () => {
    const res = makeRes();
    await grant.getActivePolicyByCategoryAndType({ params: { projectCategory: 'govt', projectType: 'indian' }, query: { onDate: '2025-04-01' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ policyFound: false, data: null });
    expect(mockPrisma.grantIncentivePolicy.findFirst.mock.calls[0][0].where.effectiveFrom.lt.toISOString()).toBe('2025-04-02T00:00:00.000Z');

    const calc = makeRes();
    await grant.calculateIncentive({ body: { projectCategory: 'govt', projectType: 'indian', onDate: '2025-04-01' } }, calc);
    expect(calc.body).toMatchObject({ policyFound: false, data: { totalIncentiveAmount: 0, policyFound: false } });
  });

  test('grantPolicyDate: sanction date → submission date → system submission → approval date', () => {
    const approval = new Date('2026-10-02');
    expect(grantPolicyDate({ sanctionDate: '2026-02-01', dateOfSubmission: '2025-04-01' }, approval)).toMatchObject({ basis: 'sanction_date', label: 'sanction date' });
    expect(grantPolicyDate({ dateOfSubmission: '2025-04-01', submittedAt: '2025-05-01' }, approval)).toMatchObject({ basis: 'date_of_submission' });
    expect(grantPolicyDate({ submittedAt: '2025-05-01' }, approval)).toMatchObject({ basis: 'submitted_at' });
    expect(grantPolicyDate({}, approval)).toMatchObject({ basis: 'approval_date', date: approval });
  });

  test('approveGrant selects the policy by the sanction date and records it', async () => {
    const g = { id: 'g1', status: 'recommended', projectCategory: 'govt', projectType: 'indian', numberOfConsortiumOrgs: 0, sanctionDate: new Date('2026-02-01'), dateOfSubmission: new Date('2025-04-01') };
    const repo = {
      findById: jest.fn().mockResolvedValue(g),
      findActivePolicy: jest.fn().mockResolvedValue({ id: 'gp', baseIncentiveAmount: 25000, basePoints: 30 }),
      update: jest.fn(async (id, data) => ({ ...g, ...data })),
      createReview: jest.fn(),
      createStatusHistory: jest.fn(),
    };
    const result = await new GrantService(repo).approveGrant('g1', 'drd', 'ok');
    expect(repo.findActivePolicy).toHaveBeenCalledWith('govt', 'indian', new Date('2026-02-01'));
    expect(result.incentiveBreakdown).toMatchObject({ policyDateBasis: 'sanction_date', policyDate: '2026-02-01', totalIncentiveAwarded: 25000, policyFound: true });
    expect(repo.createStatusHistory.mock.calls[0][0].comments).toBe('ok [Incentive policy selected by sanction date 2026-02-01]');
  });

  test('without a sanction date the submission date is used; no policy then → 409 naming that date', async () => {
    const g = { id: 'g1', status: 'recommended', projectCategory: 'govt', projectType: 'indian', dateOfSubmission: new Date('2025-04-01') };
    const repo = { findById: jest.fn().mockResolvedValue(g), findActivePolicy: jest.fn().mockResolvedValue(null), update: jest.fn() };
    await expect(new GrantService(repo).approveGrant('g1', 'drd', 'ok')).rejects.toMatchObject({
      code: 'NO_INCENTIVE_POLICY', message: expect.stringContaining('submission date 2025-04-01'),
    });
    expect(repo.findActivePolicy).toHaveBeenCalledWith('govt', 'indian', new Date('2025-04-01'));
  });
});

describe('report-zero-incentives', () => {
  test('its client can read but never write', async () => {
    const client = { researchIncentivePolicy: { findFirst: jest.fn().mockResolvedValue({ id: 'p' }), update: jest.fn() } };
    const ro = readOnlyClient(client, ['researchIncentivePolicy']);
    await expect(ro.researchIncentivePolicy.findFirst({})).resolves.toEqual({ id: 'p' });
    expect(() => ro.researchIncentivePolicy.update({})).toThrow(/read-only/);
    expect(client.researchIncentivePolicy.update).not.toHaveBeenCalled();
  });
});
