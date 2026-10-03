/**
 * External collaboration analysis (partner institutions, countries, international/industry)
 * and its chat tool. Prisma is mocked; the SQL text is checked for tenant scoping.
 */

const mockQueryRaw = jest.fn();
jest.mock('../../../shared/config/database', () => ({
  $queryRaw: (...args) => mockQueryRaw(...args),
  university: { findFirst: jest.fn(async () => ({ name: 'Home University', country: 'India' })) },
  userLogin: {
    findMany: jest.fn(async ({ where }) => where.id.in.map((id) => ({ id, uid: id, employeeDetails: { displayName: `Dr ${id}`, designation: 'Professor', primaryDepartment: { departmentName: 'CSE' } } }))),
  },
}));
jest.mock('../../core/services/affiliation.service', () => ({
  getUniversityAffiliationVariants: jest.fn(async () => ({ variants: ['home university'] })),
}));

const svc = require('../services/externalCollaboration.service');
const tools = require('../services/chat/tools');

const ROWS = [
  {
    id: 'p1', title: 'Paper One', journal: 'J1', year: 2024, citations: 10, doi: null, intl_flag: false, foreign_count: 0, industry: false,
    applicant_user_id: 'u1', summary_authors: null,
    authors: [
      { name: 'Dr u1', userId: 'u1', isInternal: true, affiliation: 'Home University' },
      { name: 'A. Svensson', userId: null, isInternal: false, affiliation: 'Dept of CS, KTH Royal Institute of Technology, Stockholm, Sweden', isInternational: true },
    ],
  },
  {
    id: 'p2', title: 'Paper Two', journal: 'J2', year: 2023, citations: 3, doi: null, intl_flag: false, foreign_count: 0, industry: false,
    applicant_user_id: 'u2', summary_authors: null,
    authors: [
      { name: 'Dr u2', userId: 'u2', isInternal: true },
      { name: 'R. Kumar', userId: null, isInternal: false, affiliation: 'AIIMS New Delhi, India', isInternational: false },
      { name: 'S. Rao', userId: null, isInternal: false, affiliation: 'Tata Consultancy Services Ltd, Mumbai, India', isInternational: false },
    ],
  },
  {
    // Scopus summary authors; home affiliation is ignored
    id: 'p3', title: 'Paper Three', journal: null, year: 2022, citations: 0, doi: null, intl_flag: true, foreign_count: 1, industry: false,
    applicant_user_id: 'u1',
    summary_authors: [{ affiliation: 'Home University, Gurugram', isSgtAffiliated: true }, { affiliation: 'University of Lagos', country: 'Nigeria' }],
    authors: [],
  },
  {
    // no external signal at all → not counted
    id: 'p4', title: 'Internal only', year: 2022, citations: 0, intl_flag: false, foreign_count: 0, industry: false, applicant_user_id: 'u3', summary_authors: null,
    authors: [{ name: 'Dr u3', userId: 'u3', isInternal: true }],
  },
];

describe('aggregate', () => {
  const isHome = (a) => /home university/i.test(a);
  const r = svc._internals.aggregate(ROWS, { homeCountry: 'India', isHome });

  it('counts international, domestic and industry collaboration', () => {
    expect(r.summary.papers_with_external_collaboration).toBe(3);
    expect(r.summary.international_papers).toBe(2);
    expect(r.summary.domestic_only_papers).toBe(1);
    expect(r.summary.industry_papers).toBe(1);
  });

  it('lists partner institutions with countries, excluding the home university', () => {
    const names = r.partners.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['KTH Royal Institute of Technology', 'AIIMS New Delhi', 'University of Lagos']));
    expect(names.some((n) => /home/i.test(n))).toBe(false);
    expect(r.partners.find((p) => p.name === 'University of Lagos')).toMatchObject({ country: 'Nigeria', international: true });
    expect(r.partners.find((p) => p.name === 'AIIMS New Delhi')).toMatchObject({ country: 'India', international: false });
    expect(r.partners.find((p) => /Tata/.test(p.name)).industry).toBe(true);
  });

  it('ranks internal researchers by external papers', () => {
    expect(r.researchers[0]).toMatchObject({ userId: 'u1', externalPapers: 2, internationalPapers: 2 });
    expect(r.researchers.map((x) => x.userId)).not.toContain('u3');
  });
});

describe('getExternalCollaborations', () => {
  beforeEach(() => mockQueryRaw.mockReset().mockResolvedValue(ROWS));

  it('scopes the raw query by tenant and approved/completed status', async () => {
    await svc.getExternalCollaborations('T1', { departmentIds: ['d1'], yearFrom: 2023 });
    const { Prisma } = require('@prisma/client');
    const [strings, ...values] = mockQueryRaw.mock.calls[0];
    const q = Prisma.sql(strings, ...values);
    expect(q.sql).toMatch(/rc\.university_id = \?::uuid/);
    expect(q.sql).toMatch(/a\.university_id = \?::uuid/);
    expect(q.sql).toMatch(/x\.university_id = \?::uuid/);
    expect(q.values).toEqual(expect.arrayContaining(['T1', 'approved', 'completed', ['d1'], 2023]));
    expect(q.values).not.toContain('submitted');
  });

  it('requires a tenant', async () => {
    await expect(svc.getExternalCollaborations(null)).rejects.toThrow(/tenantId/);
  });
});

describe('get_external_collaborations tool', () => {
  beforeEach(() => mockQueryRaw.mockReset().mockResolvedValue(ROWS));

  it('is registered with a description that covers external / international / partner questions', () => {
    const decl = tools.declarations().find((d) => d.name === 'get_external_collaborations');
    expect(decl).toBeDefined();
    expect(decl.description).toMatch(/external/i);
    expect(decl.description).toMatch(/international/i);
    expect(decl.description).toMatch(/partner institution/i);
    expect(tools.declarations().find((d) => d.name === 'get_collaborations').description).toMatch(/get_external_collaborations/);
  });

  it('returns partners, countries, researchers and cited papers', async () => {
    const sources = new tools.SourceRegistry();
    const { result, failed } = await tools.execute('get_external_collaborations', { limit: 5 }, { tenantId: 'T1', sources });
    expect(failed).toBeFalsy();
    expect(result.top_partner_institutions.length).toBeGreaterThan(0);
    expect(result.countries.map((c) => c.country)).toEqual(expect.arrayContaining(['Sweden', 'Nigeria']));
    expect(result.researchers_with_most_external_collaboration[0]).toMatchObject({ name: 'Dr u1', external_papers: 2 });
    expect(result.papers_with_international_coauthors.every((p) => typeof p.ref === 'number')).toBe(true);
    expect(sources.items.length).toBeGreaterThan(0);
  });
});
