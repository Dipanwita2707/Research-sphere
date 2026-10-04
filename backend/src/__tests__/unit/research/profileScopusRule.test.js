/**
 * Unit tests: which works a profile counts, and non-research records.
 *   - with a Scopus author ID only Scopus-indexed synced works count (plus anything DRD approved),
 *     and citations / h-index use Scopus's own counts; without one every synced work counts
 *   - the sync never imports front/back matter, retraction or correction notices, or machine
 *     translations, but keeps prefaces and editorials
 *   - citations are kept per source when candidates merge
 */
const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/tenancy/tenantContext', () => ({ getTenantId: () => 'uni-1', get: () => ({ tenantId: 'uni-1' }) }));

const svc = require('../../../modules/research/services/authorProfile.service');
const PublicationSyncService = require('../../../modules/research/services/publicationSync.service');

const author = (scopusAuthorId) => ({ id: 'u1', uid: 'FAC1', email: null, employeeDetails: {}, researchProfileIdentity: scopusAuthorId ? { scopusAuthorId } : null });

beforeEach(() => {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  mockPrisma.researchContribution = { findMany: jest.fn().mockResolvedValue([]) };
});

test('with a Scopus ID: approved works, plus synced works Scopus has', async () => {
  await svc._publications(author('57219768446'));
  const [which] = mockPrisma.researchContribution.findMany.mock.calls[0][0].where.AND;
  expect(which).toEqual({ OR: [
    { status: { in: ['approved', 'completed'] } },
    { sourceType: 'auto_import', status: { not: 'rejected' }, sourceSystems: { has: 'scopus' } },
  ] });
});

test('without a Scopus ID: every synced work counts', async () => {
  await svc._publications(author(null));
  const [which] = mockPrisma.researchContribution.findMany.mock.calls[0][0].where.AND;
  expect(which.OR[1]).toEqual({ sourceType: 'auto_import', status: { not: 'rejected' } });
});

test('Scopus counts win for citations and h-index; Research Intelligence figures are not mixed in', () => {
  const works = [
    { indexingDetails: { citationCount: 76, citationsBySource: { scopus: 60, openalex: 76 } } },
    { indexingDetails: { citationCount: 9 } },
  ];
  const scopus = svc._buildMetrics(works, { totalCitations: 999, hIndex: 30 }, { scopusOnly: true });
  expect(scopus).toMatchObject({ totalCitations: 69, hIndex: 2 });
  const any = svc._buildMetrics(works, { totalCitations: 999, hIndex: 30 });
  expect(any).toMatchObject({ totalCitations: 999, hIndex: 30 });
});

test('non-research records are never imported; prefaces and real papers are', () => {
  const s = new PublicationSyncService({}, {});
  const skip = ['Front Matter', 'Index', 'Also of Interest', 'Table of Contents', 'Retracted: ML Techniques for Employee Performance Prediction',
    'Correction to: Deep learning for X', '糖尿病患者の入院率の予測【JST・京大機械翻訳】', ''];
  const keep = ['Preface', 'Editorial', 'Index-based retrieval of images', 'Retraction behaviour in social networks', 'Classification of Clinical Dataset of Cervical Cancer using KNN'];
  skip.forEach((title) => expect([title, s._isNonResearchRecord({ title })]).toEqual([title, true]));
  keep.forEach((title) => expect([title, s._isNonResearchRecord({ title })]).toEqual([title, false]));
});

test('_upsertCandidate skips a non-research record before touching the database', async () => {
  const prisma = { researchContribution: { findFirst: jest.fn() } };
  const s = new PublicationSyncService(prisma, { createContribution: jest.fn() });
  const r = await s._upsertCandidate({ id: 'u1' }, { id: 'i1' }, { title: 'Front Matter' });
  expect(r).toMatchObject({ outcome: 'skippedCount', nonResearch: true });
  expect(prisma.researchContribution.findFirst).not.toHaveBeenCalled();
});
