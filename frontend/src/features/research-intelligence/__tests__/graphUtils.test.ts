import {
  assignGroupColors,
  buildCollaborationGraph,
  buildKeywordGraph,
  categoryOptions,
  cleanParams,
  domainMapTotals,
  edgeTableRows,
  edgeWidth,
  errorMessage,
  hasAnyCapability,
  indexUnits,
  localCooccurrences,
  MUTED_COLOR,
  nodeRadius,
  OTHER_GROUP,
  pageWindow,
  ripGateState,
  topCollaborators,
  UNASSIGNED_GROUP,
  visibleRipViews,
  yearlySeries,
} from '../utils/graphUtils';
import type { RipAccess, RipPermissionKey } from '../types';
import type { CollaborationNetworkData, DomainMapDomain, KeywordNetworkData } from '../graph.types';

const ALL: RipPermissionKey[] = [
  'rip_view_overview',
  'rip_view_keyword_intelligence',
  'rip_view_taxonomy',
  'rip_manage_taxonomy',
  'rip_view_knowledge_graph',
  'rip_view_citation_analytics',
  'rip_manage_access',
  'rip_access_research_gpt',
];
const access = (granted: RipPermissionKey[], enabled = true): RipAccess => ({
  enabled,
  source: granted.length ? 'role' : 'none',
  permissions: Object.fromEntries(ALL.map((k) => [k, granted.includes(k)])) as RipAccess['permissions'],
});

const person = (id: string, over: Partial<CollaborationNetworkData['nodes'][number]> = {}): CollaborationNetworkData['nodes'][number] => ({
  id,
  name: `Dr ${id.toUpperCase()}`,
  designation: 'Professor',
  department: 'CSE',
  departmentId: 'd-cse',
  school: 'SET',
  schoolId: 's-set',
  pubs: 10,
  collaborators: 2,
  strength: 5,
  hIndex: 3,
  citations: 40,
  primaryTopic: null,
  domain: null,
  color: null,
  ...over,
});

describe('access gating', () => {
  it('reports loading, error, disabled, denied and allowed states', () => {
    expect(ripGateState({ isLoading: true }, ['rip_view_knowledge_graph'])).toBe('loading');
    expect(ripGateState({ isError: true }, ['rip_view_knowledge_graph'])).toBe('error');
    expect(ripGateState({ data: access(ALL, false) }, ['rip_view_knowledge_graph'])).toBe('disabled');
    expect(ripGateState({ data: access(['rip_access_research_gpt']) }, ['rip_view_knowledge_graph'])).toBe('denied');
    expect(ripGateState({ data: access(['rip_view_keyword_intelligence']) }, ['rip_view_knowledge_graph', 'rip_view_keyword_intelligence'])).toBe('allowed');
  });

  it('never grants anything when the module is disabled', () => {
    expect(hasAnyCapability(access(ALL, false), ALL)).toBe(false);
    expect(hasAnyCapability(null, ALL)).toBe(false);
  });

  it('shows only the views a user can open, in menu order', () => {
    expect(visibleRipViews(access(['rip_access_research_gpt'])).map((v) => v.key)).toEqual(['assistant', 'search']);
    expect(visibleRipViews(access(['rip_view_keyword_intelligence'])).map((v) => v.key)).toEqual(['keywords', 'search']);
    expect(visibleRipViews(access(['rip_view_knowledge_graph'])).map((v) => v.key)).toEqual(['network', 'keywords', 'experts', 'domains', 'search']);
    expect(visibleRipViews(access(['rip_manage_access'])).map((v) => v.key)).toEqual(['access']);
    expect(visibleRipViews(access([]))).toEqual([]);
    expect(visibleRipViews(undefined)).toEqual([]);
  });
});

describe('assignGroupColors', () => {
  it('gives each group its own slot, largest first', () => {
    const { legend, colorOf } = assignGroupColors(['A', 'B', 'B', null], ['c1', 'c2', 'c3']);
    expect(legend).toEqual([
      { key: 'B', color: 'c1', count: 2 },
      { key: 'A', color: 'c2', count: 1 },
      { key: UNASSIGNED_GROUP, color: MUTED_COLOR, count: 1 },
    ]);
    expect(colorOf('A')).toBe('c2');
    expect(colorOf(null)).toBe(MUTED_COLOR);
  });

  it('folds overflow groups into Other instead of cycling colours', () => {
    const { legend, groupOf, colorOf } = assignGroupColors(['A', 'A', 'B', 'C', 'D'], ['c1', 'c2', 'c3']);
    expect(legend.map((l) => l.key)).toEqual(['A', 'B', OTHER_GROUP]);
    expect(legend[2].count).toBe(2);
    expect(groupOf('D')).toBe(OTHER_GROUP);
    expect(colorOf('D')).toBe(MUTED_COLOR);
  });
});

describe('scales', () => {
  it('maps node size by sqrt and clamps', () => {
    expect(nodeRadius(0, 100)).toBe(5);
    expect(nodeRadius(100, 100)).toBe(22);
    expect(nodeRadius(25, 100)).toBeCloseTo(5 + 17 * 0.5);
    expect(nodeRadius(500, 100)).toBe(22);
  });
  it('maps edge width linearly from 1', () => {
    expect(edgeWidth(1, 10)).toBe(1);
    expect(edgeWidth(10, 10)).toBe(6);
    expect(edgeWidth(5, 1)).toBe(1);
  });
});

describe('buildCollaborationGraph', () => {
  const data: CollaborationNetworkData = {
    focusUserId: null,
    minJointPapers: 1,
    nodes: [person('a', { pubs: 30, school: 'SET' }), person('b', { school: 'SOPS', department: 'Pharma' }), person('c', { school: null }), person('d')],
    edges: [
      { source: 'a', target: 'b', weight: 4 },
      { source: 'a', target: 'c', weight: 1 },
      { source: 'a', target: 'zz', weight: 9 },
    ],
  };

  it('maps nodes, drops edges to unknown nodes and colours by school', () => {
    const g = buildCollaborationGraph(data);
    expect(g.nodes).toHaveLength(4);
    expect(g.links).toHaveLength(2);
    expect(g.nodes.find((n) => n.id === 'a')).toMatchObject({ label: 'Dr A', value: 30, group: 'SET' });
    expect(g.nodes.find((n) => n.id === 'c')?.group).toBe(UNASSIGNED_GROUP);
    expect(g.nodes[0].ariaLabel).toBe('Dr A, CSE: 30 publications, 2 collaborators');
  });

  it('keeps every node the server returned (threshold is applied server-side)', () => {
    const g = buildCollaborationGraph({ ...data, minJointPapers: 5 });
    expect(g.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(g.links).toHaveLength(2);
  });

  it('can colour by department', () => {
    const g = buildCollaborationGraph(data, { colorBy: 'department' });
    expect(g.legend.map((l) => l.key)).toContain('Pharma');
  });

  it('handles missing data', () => {
    expect(buildCollaborationGraph(undefined).nodes).toEqual([]);
  });

  it('lists edges strongest first for the table view and top collaborators', () => {
    const g = buildCollaborationGraph(data);
    const rows = edgeTableRows(g.nodes, g.links);
    expect(rows.map((r) => [r.sourceName, r.targetName, r.weight])).toEqual([
      ['Dr A', 'Dr B', 4],
      ['Dr A', 'Dr C', 1],
    ]);
    expect(topCollaborators(data, 'b')).toEqual([{ id: 'a', name: 'Dr A', weight: 4 }]);
  });
});

describe('keyword graph helpers', () => {
  const kw: KeywordNetworkData = {
    nodes: [
      { id: 'k1', name: 'Medicine', pubs: 89, momentum: 1.2, categoryId: 'c1', category: 'Clinical Research' },
      { id: 'k2', name: 'Radiology', pubs: 48, momentum: 0.4, categoryId: 'c2', category: 'Imaging' },
      { id: 'k3', name: 'Surgery', pubs: 31, momentum: null, categoryId: null, category: null },
    ],
    edges: [
      { source: 'k1', target: 'k2', weight: 25 },
      { source: 'k3', target: 'k1', weight: 31 },
    ],
  };

  it('colours keywords by category', () => {
    const g = buildKeywordGraph(kw);
    expect(g.nodes.map((n) => n.group)).toEqual(['Clinical Research', 'Imaging', UNASSIGNED_GROUP]);
    expect(g.nodes[0].ariaLabel).toBe('Medicine, Clinical Research: 89 publications');
  });

  it('derives co-occurrences from the loaded graph', () => {
    expect(localCooccurrences(kw, 'k1')).toEqual([
      { id: 'k3', name: 'Surgery', shared: 31, pubs: 31 },
      { id: 'k2', name: 'Radiology', shared: 25, pubs: 48 },
    ]);
    expect(localCooccurrences(undefined, 'k1')).toEqual([]);
  });

  it('zero-fills yearly volume', () => {
    expect(yearlySeries({ 2024: 2, 2026: 1 }, 3, 2026)).toEqual([
      { year: 2024, count: 2 },
      { year: 2025, count: 0 },
      { year: 2026, count: 1 },
    ]);
    expect(yearlySeries(null, 2, 2020)).toEqual([
      { year: 2019, count: 0 },
      { year: 2020, count: 0 },
    ]);
  });
});

describe('domain map helpers', () => {
  const domains: DomainMapDomain[] = [
    {
      id: 'd1', name: 'Medical', colorHex: null, iconCode: null, publicationCount: 100, researcherCount: 5,
      categories: [
        { id: 'c2', name: 'Radiology', publicationCount: 30, researcherCount: 2, specializations: [], leaders: [] },
        { id: 'c1', name: 'Clinical', publicationCount: 70, researcherCount: 3, specializations: [{ id: 's1', name: 'ICU', publicationCount: 20, researcherCount: 1 }], leaders: [] },
      ],
    },
    { id: 'd2', name: 'Computing', colorHex: null, iconCode: null, publicationCount: 40, researcherCount: 4, categories: [] },
  ];
  it('flattens categories for dropdowns, sorted by domain then name', () => {
    expect(categoryOptions(domains)).toEqual([
      { id: 'c1', name: 'Clinical', domain: 'Medical' },
      { id: 'c2', name: 'Radiology', domain: 'Medical' },
    ]);
  });
  it('totals the map', () => {
    expect(domainMapTotals(domains)).toEqual({ domains: 2, categories: 2, specializations: 1, publications: 140 });
    expect(domainMapTotals(undefined).domains).toBe(0);
  });
});

describe('units index', () => {
  const units = {
    schools: [
      { id: 's1', name: 'Engineering', shortName: 'SET', departments: [{ id: 'd2', name: 'Mechanical', shortName: null }, { id: 'd1', name: 'CSE', shortName: null }] },
      { id: 's2', name: 'Dental', shortName: null, departments: [{ id: 'd3', name: 'Oral Pathology', shortName: null }] },
    ],
  };
  it('resolves names and the school of a department', () => {
    const u = indexUnits(units);
    expect(u.schoolName('s2')).toBe('Dental');
    expect(u.departmentName('d1')).toBe('CSE');
    expect(u.schoolOfDepartment('d3')).toBe('s2');
    expect(u.schoolName(null)).toBeNull();
    expect(u.departmentName('nope')).toBeNull();
  });
  it('lists departments for one school or all, sorted', () => {
    const u = indexUnits(units);
    expect(u.departmentsOf('s1').map((d) => d.name)).toEqual(['CSE', 'Mechanical']);
    expect(u.departmentsOf(null).map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
    expect(indexUnits(undefined).departmentsOf(null)).toEqual([]);
  });
});

describe('pageWindow', () => {
  it('shows first, last and neighbours with gaps', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 20)).toEqual([1, null, 4, 5, 6, null, 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, null, 20]);
  });
  it('fills a single-page gap with the page instead of an ellipsis', () => {
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, null, 8]);
  });
});

describe('request helpers', () => {
  it('drops empty params', () => {
    expect(cleanParams({ a: 1, b: '', c: undefined, d: null, e: 0 })).toEqual({ a: 1, e: 0 });
  });
  it('prefers the API message for errors', () => {
    expect(errorMessage({ response: { data: { message: 'Select a university' } } })).toBe('Select a university');
    expect(errorMessage({ message: 'Request failed with status code 500' }, 'fallback')).toBe('fallback');
    expect(errorMessage(null, 'fallback')).toBe('fallback');
  });
});
