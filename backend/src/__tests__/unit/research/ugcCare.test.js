/**
 * UGC-CARE listing: normalisation rules and the DRD PATCH /research/:id/ugc-care endpoint.
 */
const mockPrisma = {
  researchContribution: { findUnique: jest.fn(), update: jest.fn() },
  researchContributionStatusHistory: { create: jest.fn().mockResolvedValue({}) },
};
mockPrisma.$transaction = jest.fn(async (fn) => fn(mockPrisma));

jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../modules/audit/services/audit.service', () => ({
  auditService: { log: jest.fn().mockResolvedValue(null) },
  AuditActionType: { UPDATE: 'UPDATE' },
  AuditModule: { RESEARCH: 'research' },
}));

const { normalizeUgcCare, UGC_CARE_GROUPS, UgcCareValidationError } = require('../../../modules/research/utils/ugcCare');
const { APPLICANT_EDITABLE_FIELDS } = require('../../../modules/research/utils/editableFields');
const { updateUgcCare } = require('../../../modules/research/controllers/ugcCare.controller');

const mockRes = () => ({
  statusCode: 200,
  body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

beforeEach(() => jest.clearAllMocks());

describe('normalizeUgcCare', () => {
  it('defines exactly two groups', () => {
    expect(UGC_CARE_GROUPS).toEqual(['group_1', 'group_2']);
  });
  it('maps yes/no/unknown', () => {
    expect(normalizeUgcCare('yes', 'group_2')).toEqual({ ugcCareListed: true, ugcCareGroup: 'group_2' });
    expect(normalizeUgcCare('no', null)).toEqual({ ugcCareListed: false, ugcCareGroup: null });
    expect(normalizeUgcCare('', '')).toEqual({ ugcCareListed: null, ugcCareGroup: null });
    expect(normalizeUgcCare(undefined, undefined)).toEqual({ ugcCareListed: null, ugcCareGroup: null });
    expect(normalizeUgcCare(true, undefined)).toEqual({ ugcCareListed: true, ugcCareGroup: null });
  });
  it('rejects a group when the journal is not listed', () => {
    expect(() => normalizeUgcCare('no', 'group_1')).toThrow(UgcCareValidationError);
    expect(() => normalizeUgcCare(null, 'group_1')).toThrow(UgcCareValidationError);
  });
  it('rejects unknown values', () => {
    expect(() => normalizeUgcCare('maybe', null)).toThrow(UgcCareValidationError);
    expect(() => normalizeUgcCare('yes', 'group_3')).toThrow(UgcCareValidationError);
  });
  it('partial mode leaves unsent fields alone', () => {
    expect(normalizeUgcCare(undefined, undefined, { partial: true })).toEqual({});
  });
  it('is applicant-editable', () => {
    expect(APPLICANT_EDITABLE_FIELDS.has('ugcCareListed')).toBe(true);
    expect(APPLICANT_EDITABLE_FIELDS.has('ugcCareGroup')).toBe(true);
  });
});

describe('PATCH /research/:id/ugc-care', () => {
  const call = async (body, row) => {
    mockPrisma.researchContribution.findUnique.mockResolvedValue(row);
    mockPrisma.researchContribution.update.mockImplementation(async ({ data }) => ({ id: 'c-1', status: row?.status, ...data }));
    const res = mockRes();
    await updateUgcCare({ params: { id: 'c-1' }, body, user: { id: 'rev-1' }, originalUrl: '/x', method: 'PATCH' }, res);
    return res;
  };
  const paper = (over = {}) => ({ id: 'c-1', title: 'T', status: 'under_review', publicationType: 'research_paper', ugcCareListed: null, ugcCareGroup: null, ...over });

  it('requires ugcCareListed', async () => {
    const res = await call({}, paper());
    expect(res.statusCode).toBe(400);
  });
  it('rejects a group without listing', async () => {
    const res = await call({ ugcCareListed: 'no', ugcCareGroup: 'group_1' }, paper());
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.researchContribution.update).not.toHaveBeenCalled();
  });
  it('rejects non-journal publications', async () => {
    const res = await call({ ugcCareListed: 'yes' }, paper({ publicationType: 'book' }));
    expect(res.statusCode).toBe(400);
  });
  it('404s when not found in this tenant', async () => {
    const res = await call({ ugcCareListed: 'yes' }, null);
    expect(res.statusCode).toBe(404);
  });
  it('updates and writes a status-history note without changing status', async () => {
    const res = await call({ ugcCareListed: 'yes', ugcCareGroup: 'group_1', comment: 'checked on UGC-CARE site' }, paper());
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.researchContribution.update.mock.calls[0][0].data).toEqual({ ugcCareListed: true, ugcCareGroup: 'group_1' });
    const hist = mockPrisma.researchContributionStatusHistory.create.mock.calls[0][0].data;
    expect(hist).toEqual(expect.objectContaining({ fromStatus: 'under_review', toStatus: 'under_review', changedById: 'rev-1' }));
    expect(hist.comments).toContain('Group I');
    expect(hist.comments).toContain('checked on UGC-CARE site');
  });
});

describe('UGC-CARE from indexing (Scopus / Web of Science → Group II)', () => {
  const { ugcCareFromIndexing, resolveUgcCare, SCOPUS_WOS_CATEGORIES } = require('../../../modules/research/utils/ugcCare');

  test.each(SCOPUS_WOS_CATEGORIES)('%s implies listed, Group II', (cat) => {
    expect(ugcCareFromIndexing([cat])).toEqual({ ugcCareListed: true, ugcCareGroup: 'group_2' });
  });

  test.each([[['pubmed']], [['naas_rating_6_plus']], [['sgtu_in_house']], [['case_centre_uk']], [[]], [undefined]])(
    '%j implies nothing (author answers)', (cats) => {
      expect(ugcCareFromIndexing(cats)).toBeNull();
    },
  );

  test('indexing overrides whatever the author sent', () => {
    expect(resolveUgcCare('no', null, ['pubmed', 'scie_wos'])).toEqual({ ugcCareListed: true, ugcCareGroup: 'group_2' });
    expect(resolveUgcCare(null, null, ['scopus'])).toEqual({ ugcCareListed: true, ugcCareGroup: 'group_2' });
  });

  test('without Scopus / WoS the author answer is used and still validated', () => {
    expect(resolveUgcCare('yes', 'group_1', ['pubmed'])).toEqual({ ugcCareListed: true, ugcCareGroup: 'group_1' });
    expect(resolveUgcCare('no', null, ['pubmed'])).toEqual({ ugcCareListed: false, ugcCareGroup: null });
    expect(() => resolveUgcCare('no', 'group_1', ['pubmed'])).toThrow(UgcCareValidationError);
  });
});
