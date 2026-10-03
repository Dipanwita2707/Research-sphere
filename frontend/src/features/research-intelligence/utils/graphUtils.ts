/**
 * Pure data-mapping helpers for the Research Intelligence knowledge-graph views.
 * No React, d3 or network imports here so they stay cheap to unit-test.
 */
import { VIZ } from '@/components/analytics/theme';
import type { RipAccess, RipPermissionKey } from '../types';
import type {
  CollaborationNetworkData,
  CollaborationNode,
  DomainMapDomain,
  KeywordNetworkData,
  KeywordNode,
  RipUnits,
  WeightedEdge,
} from '../graph.types';

// ─── Request helpers ──────────────────────────────────────────────────────────

/** Drop empty query params so the backend only sees real filters. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;
}

// ─── Access gating ────────────────────────────────────────────────────────────

/** Capabilities that open publication / entity search (mirrors the backend ANY_USE list). */
export const RIP_USE_CAPABILITIES: RipPermissionKey[] = [
  'rip_view_overview',
  'rip_access_research_gpt',
  'rip_view_knowledge_graph',
  'rip_view_keyword_intelligence',
  'rip_view_taxonomy',
  'rip_view_citation_analytics',
];

export type RipViewKey = 'assistant' | 'network' | 'keywords' | 'experts' | 'domains' | 'search' | 'access';

export interface RipView {
  key: RipViewKey;
  label: string;
  href: string;
  description: string;
  /** the view opens when the user holds any one of these */
  anyOf: RipPermissionKey[];
}

export const RIP_VIEWS: RipView[] = [
  { key: 'assistant', label: 'Assistant', href: '/research/intelligence', description: 'Ask about experts, publications, topics & trends', anyOf: ['rip_access_research_gpt'] },
  { key: 'network', label: 'Collaboration Network', href: '/research/intelligence/network', description: 'Who co-authors with whom', anyOf: ['rip_view_knowledge_graph'] },
  { key: 'keywords', label: 'Keyword Graph', href: '/research/intelligence/keywords', description: 'Topic co-occurrence, trends & KPIs', anyOf: ['rip_view_knowledge_graph', 'rip_view_keyword_intelligence'] },
  { key: 'experts', label: 'Expert Finder', href: '/research/intelligence/experts', description: 'Ranked experts for any topic', anyOf: ['rip_view_knowledge_graph'] },
  { key: 'domains', label: 'Domain Map', href: '/research/intelligence/domains', description: 'Research domains, categories & leaders', anyOf: ['rip_view_knowledge_graph'] },
  { key: 'search', label: 'Search', href: '/research/intelligence/search', description: 'Publications, people & topics', anyOf: RIP_USE_CAPABILITIES },
  { key: 'access', label: 'Access', href: '/research/intelligence/access', description: 'Choose who can use Research Intelligence', anyOf: ['rip_manage_access'] },
];

export const ripView = (key: RipViewKey) => RIP_VIEWS.find((v) => v.key === key)!;

export function hasAnyCapability(access: RipAccess | undefined | null, anyOf: RipPermissionKey[]): boolean {
  if (!access?.enabled) return false;
  return anyOf.some((k) => !!access.permissions?.[k]);
}

/** Views the user can open, in menu order. */
export function visibleRipViews(access: RipAccess | undefined | null): RipView[] {
  return RIP_VIEWS.filter((v) => hasAnyCapability(access, v.anyOf));
}

export type RipGateState = 'loading' | 'error' | 'disabled' | 'denied' | 'allowed';

/** Resolve what a gated view should render. */
export function ripGateState(
  q: { data?: RipAccess | null; isLoading?: boolean; isError?: boolean },
  anyOf: RipPermissionKey[]
): RipGateState {
  if (q.isLoading) return 'loading';
  if (q.isError || !q.data) return 'error';
  if (!q.data.enabled) return 'disabled';
  return hasAnyCapability(q.data, anyOf) ? 'allowed' : 'denied';
}

// ─── Colour groups & legends ──────────────────────────────────────────────────

export const OTHER_GROUP = 'Other';
export const UNASSIGNED_GROUP = 'Not assigned';
export const MUTED_COLOR = 'var(--viz-ink-muted)';

export interface LegendItem {
  key: string;
  color: string;
  count: number;
}

/**
 * Give each group a palette slot by size. With more groups than slots, the largest
 * (slots - 1) keep their colour and the rest share a neutral "Other"; missing values
 * are "Not assigned". The palette order is fixed, never cycled.
 */
export function assignGroupColors(values: (string | null | undefined)[], slots: readonly string[] = VIZ) {
  const counts = new Map<string, number>();
  let unassigned = 0;
  for (const v of values) {
    const k = v?.trim();
    if (!k) unassigned++;
    else counts.set(k, (counts.get(k) || 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const room = ordered.length > slots.length ? slots.length - 1 : slots.length;
  const colorBy = new Map<string, string>();
  ordered.slice(0, room).forEach(([k], i) => colorBy.set(k, slots[i]));
  const otherCount = ordered.slice(room).reduce((s, [, c]) => s + c, 0);

  const legend: LegendItem[] = ordered.slice(0, room).map(([k, c]) => ({ key: k, color: colorBy.get(k)!, count: c }));
  if (otherCount) legend.push({ key: OTHER_GROUP, color: MUTED_COLOR, count: otherCount });
  if (unassigned) legend.push({ key: UNASSIGNED_GROUP, color: MUTED_COLOR, count: unassigned });

  const groupOf = (v: string | null | undefined) => {
    const k = v?.trim();
    if (!k) return UNASSIGNED_GROUP;
    return colorBy.has(k) ? k : OTHER_GROUP;
  };
  const colorOf = (v: string | null | undefined) => colorBy.get(v?.trim() || '') || MUTED_COLOR;
  return { legend, groupOf, colorOf };
}

// ─── Scales ───────────────────────────────────────────────────────────────────

/** Area-true node radius: sqrt scale from [0, max] to [minR, maxR]. */
export function nodeRadius(value: number, max: number, minR = 5, maxR = 22): number {
  if (!(max > 0) || !(value > 0)) return minR;
  return minR + (maxR - minR) * Math.sqrt(Math.min(value, max) / max);
}

/** Edge stroke width from 1px to maxW by weight. */
export function edgeWidth(weight: number, maxWeight: number, maxW = 6): number {
  if (!(maxWeight > 1) || !(weight > 1)) return 1;
  return 1 + (maxW - 1) * ((Math.min(weight, maxWeight) - 1) / (maxWeight - 1));
}

// ─── Generic graph helpers ────────────────────────────────────────────────────

export interface GraphNodeView {
  id: string;
  label: string;
  value: number;
  group: string;
  color: string;
  ariaLabel: string;
}

export interface GraphLinkView {
  source: string;
  target: string;
  weight: number;
}

export function neighbourIds(edges: WeightedEdge[], id: string): Set<string> {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.source === id) out.add(e.target);
    else if (e.target === id) out.add(e.source);
  }
  return out;
}

/** Edges at or above minWeight whose two ends are both present. */
export function filterEdges(edges: WeightedEdge[], nodeIds: Set<string>, minWeight = 1): WeightedEdge[] {
  return edges.filter((e) => e.weight >= minWeight && nodeIds.has(e.source) && nodeIds.has(e.target));
}

// ─── Collaboration network ────────────────────────────────────────────────────

export type CollabColorBy = 'school' | 'department';

export interface CollaborationGraphOptions {
  colorBy?: CollabColorBy;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Map the API network to drawable nodes/links. The joint-paper threshold and school/department
 * scope are applied by the server (minJointPapers, schoolId, departmentId); this only drops
 * links whose ends are not in the node list and assigns colours.
 */
export function buildCollaborationGraph(data: CollaborationNetworkData | undefined, opts: CollaborationGraphOptions = {}) {
  const colorBy = opts.colorBy || 'school';
  if (!data) return { nodes: [] as GraphNodeView[], links: [] as GraphLinkView[], legend: [] as LegendItem[], byId: new Map<string, CollaborationNode>() };

  const kept = data.nodes;
  const links = filterEdges(data.edges, new Set(kept.map((n) => n.id)));

  const { legend, colorOf, groupOf } = assignGroupColors(kept.map((n) => n[colorBy]));
  const nodes: GraphNodeView[] = kept.map((n) => ({
    id: n.id,
    label: n.name,
    value: n.pubs,
    group: groupOf(n[colorBy]),
    color: colorOf(n[colorBy]),
    ariaLabel: `${n.name}${n.department ? `, ${n.department}` : ''}: ${plural(n.pubs, 'publication')}, ${plural(n.collaborators, 'collaborator')}`,
  }));
  return { nodes, links, legend, byId: new Map(kept.map((n) => [n.id, n])) };
}

export interface EdgeRow {
  key: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  weight: number;
}

/** Table alternative to the graph: one row per link, strongest first. */
export function edgeTableRows(nodes: { id: string; label: string }[], links: WeightedEdge[]): EdgeRow[] {
  const name = new Map(nodes.map((n) => [n.id, n.label]));
  return links
    .filter((e) => name.has(e.source) && name.has(e.target))
    .map((e) => ({
      key: `${e.source}|${e.target}`,
      sourceId: e.source,
      targetId: e.target,
      sourceName: name.get(e.source)!,
      targetName: name.get(e.target)!,
      weight: e.weight,
    }))
    .sort((a, b) => b.weight - a.weight || a.sourceName.localeCompare(b.sourceName));
}

/** A researcher's direct collaborators in the loaded network, strongest first. */
export function topCollaborators(data: CollaborationNetworkData | undefined, userId: string, limit = 5) {
  if (!data) return [];
  const name = new Map(data.nodes.map((n) => [n.id, n.name]));
  return data.edges
    .filter((e) => e.source === userId || e.target === userId)
    .map((e) => {
      const other = e.source === userId ? e.target : e.source;
      return { id: other, name: name.get(other) || 'Unknown researcher', weight: e.weight };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

// ─── Keyword network ──────────────────────────────────────────────────────────

export function buildKeywordGraph(data: KeywordNetworkData | undefined) {
  if (!data) return { nodes: [] as GraphNodeView[], links: [] as GraphLinkView[], legend: [] as LegendItem[], byId: new Map<string, KeywordNode>() };
  const ids = new Set(data.nodes.map((n) => n.id));
  const links = filterEdges(data.edges, ids);
  const { legend, colorOf, groupOf } = assignGroupColors(data.nodes.map((n) => n.category));
  const nodes: GraphNodeView[] = data.nodes.map((n) => ({
    id: n.id,
    label: n.name,
    value: n.pubs,
    group: groupOf(n.category),
    color: colorOf(n.category),
    ariaLabel: `${n.name}${n.category ? `, ${n.category}` : ''}: ${plural(n.pubs, 'publication')}`,
  }));
  return { nodes, links, legend, byId: new Map(data.nodes.map((n) => [n.id, n])) };
}

/** Co-occurring keywords from the loaded graph (fallback when the keyword API is not available). */
export function localCooccurrences(data: KeywordNetworkData | undefined, keywordId: string, limit = 12) {
  if (!data) return [];
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  return data.edges
    .filter((e) => e.source === keywordId || e.target === keywordId)
    .map((e) => {
      const other = byId.get(e.source === keywordId ? e.target : e.source);
      return other ? { id: other.id, name: other.name, shared: e.weight, pubs: other.pubs } : null;
    })
    .filter((x): x is { id: string; name: string; shared: number; pubs: number } => !!x)
    .sort((a, b) => b.shared - a.shared || b.pubs - a.pubs)
    .slice(0, limit);
}

/** Last `span` years of a keyword's yearly volume, zero-filled, ending at the latest year present (or `endYear`). */
export function yearlySeries(volume: Record<string, number> | null | undefined, span = 6, endYear?: number) {
  const years = Object.keys(volume || {}).map(Number).filter(Number.isFinite);
  const end = endYear ?? (years.length ? Math.max(...years) : new Date().getFullYear());
  return Array.from({ length: span }, (_, i) => {
    const year = end - span + 1 + i;
    return { year, count: Number(volume?.[String(year)]) || 0 };
  });
}

// ─── Units (schools & departments) ────────────────────────────────────────────

export interface UnitIndex {
  schoolName: (id: string | null | undefined) => string | null;
  departmentName: (id: string | null | undefined) => string | null;
  /** departments of one school, or of every school when none is chosen */
  departmentsOf: (schoolId: string | null | undefined) => { id: string; name: string; school: string }[];
  /** the school a department belongs to */
  schoolOfDepartment: (departmentId: string | null | undefined) => string | null;
}

export function indexUnits(units: RipUnits | undefined): UnitIndex {
  const schools = units?.schools || [];
  const school = new Map(schools.map((s) => [s.id, s]));
  const dept = new Map(schools.flatMap((s) => s.departments.map((d) => [d.id, { ...d, schoolId: s.id, school: s.name }] as const)));
  return {
    schoolName: (id) => (id ? school.get(id)?.name ?? null : null),
    departmentName: (id) => (id ? dept.get(id)?.name ?? null : null),
    departmentsOf: (schoolId) =>
      (schoolId ? schools.filter((s) => s.id === schoolId) : schools)
        .flatMap((s) => s.departments.map((d) => ({ id: d.id, name: d.name, school: s.name })))
        .sort((a, b) => a.name.localeCompare(b.name)),
    schoolOfDepartment: (id) => (id ? dept.get(id)?.schoolId ?? null : null),
  };
}

// ─── Paging ───────────────────────────────────────────────────────────────────

/** Page numbers to show around the current page, with null marking a gap: 1 … 4 5 6 … 20. */
export function pageWindow(page: number, pages: number, radius = 1): (number | null)[] {
  if (pages <= 1) return [1];
  const want = new Set([1, pages]);
  for (let p = page - radius; p <= page + radius; p++) if (p >= 1 && p <= pages) want.add(p);
  const sorted = [...want].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : null);
    out.push(p);
  });
  return out;
}

// ─── Domain map ───────────────────────────────────────────────────────────────

export interface CategoryOption {
  id: string;
  name: string;
  domain: string;
}

/** Flat, alphabetised category list for filter dropdowns. */
export function categoryOptions(domains: DomainMapDomain[] | undefined): CategoryOption[] {
  return (domains || [])
    .flatMap((d) => d.categories.map((c) => ({ id: c.id, name: c.name, domain: d.name })))
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
}

/** Domain totals for the map header. */
export function domainMapTotals(domains: DomainMapDomain[] | undefined) {
  const list = domains || [];
  return {
    domains: list.length,
    categories: list.reduce((s, d) => s + d.categories.length, 0),
    specializations: list.reduce((s, d) => s + d.categories.reduce((x, c) => x + c.specializations.length, 0), 0),
    publications: list.reduce((s, d) => s + (d.publicationCount || 0), 0),
  };
}

/** Share of a value in a total, as a whole-number percentage. */
export const sharePct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Pull a user-facing message out of an axios-style error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as { response?: { data?: { message?: string }; status?: number }; message?: string } | null;
  return e?.response?.data?.message || (e?.message && !/status code/i.test(e.message) ? e.message : fallback);
}

export const isForbidden = (err: unknown) => (err as { response?: { status?: number } } | null)?.response?.status === 403;
