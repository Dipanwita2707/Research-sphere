/**
 * POST /research/incentive-preview
 *   - authenticated users only; a university must be selected (tenant-scoped policy lookup)
 *   - malformed input → 400 listing the problems
 *   - read-only: no create/update/delete on any model
 *   - every publication type answers with per-author shares, pool, totals, policy, warnings
 */
const mockPrisma = {
  researchIncentivePolicy: { findFirst: jest.fn() },
  bookIncentivePolicy: { findFirst: jest.fn(async () => null) },
  bookChapterIncentivePolicy: { findFirst: jest.fn(async () => null) },
  conferenceIncentivePolicy: { findFirst: jest.fn(async () => null) },
  userLogin: { findMany: jest.fn(async () => []) },
  researchContribution: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
  researchContributionAuthor: { createMany: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  notification: { createMany: jest.fn(), create: jest.fn() },
};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../modules/core/services/affiliation.service', () => ({
  getUniversityAffiliationVariants: jest.fn(async () => ({ variants: ['sgt university'] })),
}));
jest.mock('../../../shared/middleware/auth', () => {
  const tenantContext = require('../../../shared/tenancy/tenantContext');
  const pass = (req, res, next) => next();
  return {
    protect: (req, res, next) => {
      if (!req.headers.authorization) return res.status(401).json({ success: false, message: 'Not authorized' });
      req.user = { id: 'u1', role: 'faculty', uid: 'DEMO-FAC-01' };
      const tenantId = req.headers['x-test-tenant'] === 'none' ? null : 'uni-demo';
      return tenantContext.run({ tenantId }, () => next());
    },
    requirePermission: () => pass,
    requireAnyPermission: () => pass,
    checkResearchFilePermission: pass,
  };
});

const express = require('express');
const router = require('../../../modules/research/routes/contribution.routes');

const app = express();
app.use(express.json());
app.use('/api/v1/research', router);

const POLICY = {
  id: '481fd480', policyName: 'Research Paper Policy 2026', publicationType: 'research_paper',
  distributionMethod: 'author_role_based', first_author_percentage: 35, corresponding_author_percentage: 30,
  indexingBonuses: { indexingCategoryBonuses: [{ category: 'nature_science_lancet_cell_nejm', incentiveAmount: 200000, points: 100 }] },
};

const author = (name, authorRole, extra = {}) => ({ authorType: 'internal_faculty', name, authorRole, affiliation: 'SGT University', ...extra });
const DEMO_PAYLOAD = {
  publicationType: 'research_paper',
  publicationDate: '2026-05-01T00:00:00.000Z',
  indexingCategories: ['nature_science_lancet_cell_nejm'],
  authors: [
    author('Demo Faculty', 'corresponding_author', { registrationNumber: 'DEMO-FAC-01', isCorresponding: true, orderNumber: 1, authorPosition: null }),
    author('Suresh Patel', 'first_author', { registrationNumber: 'DEMO-FAC-05', orderNumber: 2 }),
    author('Co One', 'co_author', { registrationNumber: 'DEMO-FAC-02', orderNumber: 3 }),
    author('Co Two', 'co_author', { registrationNumber: 'DEMO-FAC-03', orderNumber: 4 }),
  ],
};

let server;
let baseUrl;
beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));

/** Real HTTP round trip (no supertest dependency). */
const post = async (body, headers = { authorization: 'Bearer t' }) => {
  const res = await fetch(`${baseUrl}/api/v1/research/incentive-preview`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const WRITES = [
  mockPrisma.researchContribution.create, mockPrisma.researchContribution.update,
  mockPrisma.researchContributionAuthor.createMany, mockPrisma.researchContributionAuthor.update,
  mockPrisma.researchContributionAuthor.deleteMany, mockPrisma.notification.createMany, mockPrisma.notification.create,
];

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.researchIncentivePolicy.findFirst.mockResolvedValue(POLICY);
});

describe('POST /research/incentive-preview', () => {
  test('401 without authentication', async () => {
    const res = await post(DEMO_PAYLOAD, {});
    expect(res.status).toBe(401);
  });

  test('400 when no university is selected', async () => {
    const res = await post(DEMO_PAYLOAD, { authorization: 'Bearer t', 'x-test-tenant': 'none' });
    expect(res.status).toBe(400);
    expect(mockPrisma.researchIncentivePolicy.findFirst).not.toHaveBeenCalled();
  });

  test.each([
    ['missing publicationType', { authors: [] }],
    ['unknown publicationType', { publicationType: 'grant', authors: [] }],
    ['authors not an array', { publicationType: 'research_paper', authors: 'x' }],
    ['bad date', { publicationType: 'research_paper', publicationDate: 'not-a-date' }],
    ['negative SJR', { publicationType: 'research_paper', sjr: -1 }],
    ['non-numeric impact factor', { publicationType: 'research_paper', impactFactor: 'abc' }],
    ['bad author position', { publicationType: 'research_paper', authors: [{ name: 'A', authorPosition: 0 }] }],
    ['too many authors', { publicationType: 'research_paper', authors: Array.from({ length: 101 }, () => ({ name: 'A' })) }],
  ])('400 for malformed input: %s', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test('the DEMO 4-author paper: per-author shares, pool, totals and policy', async () => {
    const res = await post(DEMO_PAYLOAD);
    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.authors.map((a) => [a.name, a.incentive, a.points])).toEqual([
      ['Demo Faculty', 60000, 30],
      ['Suresh Patel', 70000, 35],
      ['Co One', 35000, 18],
      ['Co Two', 35000, 17],
    ]);
    expect(data.pool).toEqual({ amount: 200000, points: 100 });
    expect(data.totals).toMatchObject({ amount: 200000, points: 100 });
    expect(data.policy).toMatchObject({
      found: true, usedDefault: false, id: '481fd480', name: 'Research Paper Policy 2026',
      distributionMethod: 'author_role_based',
      percentages: { firstAuthor: 35, correspondingAuthor: 30, coAuthors: 35 },
      description: 'role-based: first 35% · corresponding 30% · co-authors share 35%',
    });
    expect(data.warnings).toEqual([]);
    WRITES.forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  test('no policy for the date: ₹0 and NO_INCENTIVE_POLICY', async () => {
    mockPrisma.researchIncentivePolicy.findFirst.mockResolvedValue(null);
    const res = await post({ ...DEMO_PAYLOAD, publicationDate: '2001-01-01' });
    expect(res.status).toBe(200);
    expect(res.body.data.totals.amount).toBe(0);
    expect(res.body.data.policy.found).toBe(false);
    expect(res.body.data.warnings[0].code).toBe('NO_INCENTIVE_POLICY');
  });

  test('position-based: positions ≥ 6 get ₹0, with a warning', async () => {
    mockPrisma.researchIncentivePolicy.findFirst.mockResolvedValue({
      ...POLICY, distributionMethod: 'author_position_based', positionBasedDistribution: { 1: 40, 2: 25, 3: 15, 4: 12, 5: 8 },
    });
    const authors = [1, 2, 3, 4, 5, 6].map((n) => author(`A${n}`, 'co_author', { orderNumber: n, authorPosition: n }));
    const res = await post({ ...DEMO_PAYLOAD, authors });
    expect(res.status).toBe(200);
    expect(res.body.data.authors.map((a) => a.incentive)).toEqual([80000, 50000, 30000, 24000, 16000, 0]);
    expect(res.body.data.warnings.map((w) => w.code)).toContain('POSITION_BEYOND_FIFTH');
  });

  test('students (money, no points) and external authors (forfeited / redistributed)', async () => {
    const res = await post({
      ...DEMO_PAYLOAD,
      authors: [
        author('Applicant', 'first_author', { orderNumber: 1 }),
        { authorType: 'external_academic', name: 'Ext', authorRole: 'corresponding_author', orderNumber: 2 },
        { authorType: 'internal_student', name: 'Stu', authorRole: 'co_author', orderNumber: 3 },
        { authorType: 'external_other', name: 'Ext Co', authorRole: 'co_author', orderNumber: 4 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.authors.map((a) => [a.incentive, a.points, a.isInternal, a.isStudent])).toEqual([
      [70000, 35, true, false], [0, 0, false, false], [70000, 0, true, true], [0, 0, false, false],
    ]);
    expect(res.body.data.warnings.map((w) => w.code)).toEqual(['EXTERNAL_SHARE_FORFEITED', 'EXTERNAL_SHARE_REDISTRIBUTED']);
  });

  test.each([
    ['book', { bookPublicationType: 'authored', bookIndexingType: 'non_indexed' }, 50000, 'Default book policy'],
    ['book_chapter', { bookPublicationType: 'edited' }, 40000, 'Default book chapter policy'],
    ['conference_paper', { conferenceSubType: 'paper_not_indexed', conferenceType: 'international' }, 15000, 'Default conference policy'],
    ['conference_paper', { conferenceSubType: 'paper_indexed_scopus', proceedingsQuartile: 'q2' }, 25000, 'Default conference policy'],
  ])('%s with built-in defaults', async (publicationType, fields, pool, name) => {
    const res = await post({
      publicationType, ...fields,
      authors: [author('A', 'first_author', { orderNumber: 1 }), author('B', 'corresponding_author', { orderNumber: 2 }), author('C', 'co_author', { orderNumber: 3 })],
    });
    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.pool.amount).toBe(pool);
    expect(data.policy).toMatchObject({ found: true, usedDefault: true, name });
    expect(data.totals.amount).toBeLessThanOrEqual(pool);
    expect(data.totals.points).toBeLessThanOrEqual(data.pool.points);
    expect(data.warnings.map((w) => w.code)).toContain('DEFAULT_POLICY_USED');
  });

  test('deterministic: the same payload always gives the same answer', async () => {
    const a = await post(DEMO_PAYLOAD);
    const b = await post(DEMO_PAYLOAD);
    expect(a.body.data).toEqual(b.body.data);
  });
});
