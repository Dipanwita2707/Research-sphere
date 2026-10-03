/**
 * Knowledge-graph filter parameters and search paging: collaboration minJointPapers and unit ids,
 * keyword-node categoryId, publication search paging, and the schools/departments listing.
 * Prisma is mocked; SQL is checked through the Prisma.sql text and bound values.
 */

const mockQueryRaw = jest.fn();
const mockUsers = jest.fn();
const mockSchools = jest.fn();
jest.mock('../../../shared/config/database', () => ({
  $queryRaw: (...args) => mockQueryRaw(...args),
  userLogin: { findMany: (...args) => mockUsers(...args) },
  ripResearcherExpertiseProfile: { findMany: jest.fn(async () => []) },
  ripTaxonomyCategory: { findMany: jest.fn(async () => []) },
  researchContribution: { findMany: jest.fn(async () => []) },
  facultySchoolList: { findMany: (...args) => mockSchools(...args) },
}));
jest.mock('../services/retrieval.service', () => ({ expandQuery: jest.fn(), matchTaxonomyNodes: jest.fn() }));
jest.mock('../services/expertise.service', () => ({ topExpertsForCategories: jest.fn() }));

const graph = require('../services/graph.service');
const search = require('../services/search.service');

const TENANT = '22c2ea18-7b30-49b7-b2cf-3a5b4857ab24';
/** Text of a tagged-template $queryRaw call (nested Prisma.sql inlined, bound values shown as ‹v›). */
const render = (strings, values) =>
  strings.reduce((acc, str, i) => {
    if (i >= values.length) return acc + str;
    const v = values[i];
    const inner = v && Array.isArray(v.strings) && Array.isArray(v.values) ? render(v.strings, v.values) : `‹${JSON.stringify(v)}›`;
    return acc + str + inner;
  }, '');
const sqlText = (call) => render(call[0], call.slice(1));

beforeEach(() => {
  mockQueryRaw.mockReset();
  mockUsers.mockReset();
  mockSchools.mockReset();
});

describe('getCollaborationNetwork', () => {
  const person = (id, dept, school) => ({
    id,
    uid: id,
    employeeDetails: { displayName: `Dr ${id}`, designation: 'Professor', primaryDepartment: { id: `${dept}-id`, departmentName: dept }, primarySchool: { id: `${school}-id`, facultyName: school } },
  });

  it('applies minJointPapers to links and node selection, and returns unit ids', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        { id: 'u1', pubs: 10, strength: 7, collaborators: 3 },
        { id: 'u2', pubs: 4, strength: 5, collaborators: 1 },
      ])
      .mockResolvedValueOnce([{ source: 'u1', target: 'u2', weight: 5 }]);
    mockUsers.mockResolvedValue([person('u1', 'CSE', 'SET'), person('u2', 'ECE', 'SET')]);

    const out = await graph.getCollaborationNetwork(TENANT, { minJointPapers: '3', limit: 50 });

    const nodeSql = sqlText(mockQueryRaw.mock.calls[0]);
    expect(nodeSql).toMatch(/strong AS \(SELECT a, b FROM pairs WHERE w >= ‹3›\)/);
    expect(nodeSql).toMatch(/EXISTS \(SELECT 1 FROM strong s/);
    // node stats keep counting every link
    expect(nodeSql).toMatch(/SELECT a AS u, w FROM pairs UNION ALL SELECT b AS u, w FROM pairs/);
    expect(sqlText(mockQueryRaw.mock.calls[1])).toMatch(/HAVING COUNT\(\*\) >= ‹3›/);

    expect(out.minJointPapers).toBe(3);
    expect(out.edges).toEqual([{ source: 'u1', target: 'u2', weight: 5 }]);
    expect(out.nodes[0]).toMatchObject({ id: 'u1', name: 'Dr u1', department: 'CSE', departmentId: 'CSE-id', school: 'SET', schoolId: 'SET-id', pubs: 10 });
  });

  it('defaults to every link and keeps the ego researcher', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'u1', pubs: 1, strength: 0, collaborators: 0 }]).mockResolvedValueOnce([]);
    mockUsers.mockResolvedValue([person('u1', 'CSE', 'SET')]);
    const ego = '1a3804d1-97d6-4ea2-a25a-e49949370a74';

    const out = await graph.getCollaborationNetwork(TENANT, { userId: ego });
    const nodeSql = sqlText(mockQueryRaw.mock.calls[0]);
    expect(nodeSql).toMatch(/w >= ‹1›/);
    expect(nodeSql).not.toMatch(/EXISTS \(SELECT 1 FROM strong s/);
    expect(nodeSql).toMatch(/FROM strong WHERE a = /);
    expect(out.minJointPapers).toBe(1);
    expect(out.focusUserId).toBe(ego);
  });

  it('clamps nonsense thresholds to 1', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    const out = await graph.getCollaborationNetwork(TENANT, { minJointPapers: 'abc' });
    expect(out.minJointPapers).toBe(1);
    expect(out.nodes).toEqual([]);
  });
});

describe('getKeywordNetwork', () => {
  it('returns each keyword with its primary category id and name', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'k1', name: 'Medicine', pubs: 9, momentum: 1, categoryId: 'c1', category: 'Clinical Research' }])
      .mockResolvedValueOnce([]);
    const out = await graph.getKeywordNetwork(TENANT, { limit: 10 });
    expect(sqlText(mockQueryRaw.mock.calls[0])).toMatch(/cat\.id AS "categoryId", cat\.name AS category/);
    expect(out.nodes[0]).toMatchObject({ categoryId: 'c1', category: 'Clinical Research' });
  });
});

describe('searchPublications paging', () => {
  it('keeps the original top-N behaviour without paging params', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    const out = await search.searchPublications(TENANT, { limit: 500 });
    const q = sqlText(mockQueryRaw.mock.calls[0]);
    expect(q).toMatch(/LIMIT ‹25› OFFSET ‹0›/);
    expect(out).toEqual({ total: 0, results: [], expansion: null });
  });

  it('pages with OFFSET and reports page info', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ id: 'p1', title: 'T', year: 2024, citations: 1, relevance: 0, matched_via: [], total: 230 }]);
    const out = await search.searchPublications(TENANT, { page: '3', pageSize: '50' });
    expect(sqlText(mockQueryRaw.mock.calls[0])).toMatch(/LIMIT ‹50› OFFSET ‹100›/);
    expect(out).toMatchObject({ total: 230, page: 3, pageSize: 50, pages: 5 });
    expect(out.results).toHaveLength(1);
  });

  it('caps the page size at 100', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await search.searchPublications(TENANT, { page: 1, pageSize: 1000 });
    expect(sqlText(mockQueryRaw.mock.calls[0])).toMatch(/LIMIT ‹100› OFFSET ‹0›/);
  });

  it('still reports the total when asked for a page past the end', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([]) // page 9: no rows
      .mockResolvedValueOnce([{ id: 'p1', title: 'T', year: 2024, citations: 1, relevance: 0, matched_via: [], total: 12 }]); // page-1 probe
    const out = await search.searchPublications(TENANT, { page: 9, pageSize: 10 });
    expect(out).toMatchObject({ total: 12, page: 9, pageSize: 10, pages: 2, results: [] });
  });
});

describe('listUnits', () => {
  it('lists the tenant’s active schools with departments', async () => {
    mockSchools.mockResolvedValue([
      { id: 's1', facultyName: 'School of Engineering', shortName: 'SET', departments: [{ id: 'd1', departmentName: 'CSE', shortName: null }] },
    ]);
    const out = await search.listUnits(TENANT);
    expect(mockSchools.mock.calls[0][0].where).toEqual({ universityId: TENANT, isActive: true });
    expect(out).toEqual({ schools: [{ id: 's1', name: 'School of Engineering', shortName: 'SET', departments: [{ id: 'd1', name: 'CSE', shortName: null }] }] });
  });
});
