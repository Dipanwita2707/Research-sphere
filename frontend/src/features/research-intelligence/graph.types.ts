// ─── Knowledge graph, keywords & search ───────────────────────────────────────
// Shapes returned by /research-intelligence/graph/*, /keywords/* and /search/* (backend graph.service,
// analytics.service and search.service).

/** Researcher identity as the backend describes people (researchSummary). */
export interface RipResearcherSummary {
  id: string;
  name: string;
  designation: string | null;
  department: string | null;
  school: string | null;
}

export interface CollaborationNode extends RipResearcherSummary {
  departmentId: string | null;
  schoolId: string | null;
  pubs: number;
  collaborators: number;
  /** sum of joint papers with everyone in the university (all links, whatever the threshold) */
  strength: number;
  hIndex: number;
  citations: number;
  primaryTopic: string | null;
  domain: string | null;
  color: string | null;
}

export interface WeightedEdge {
  source: string;
  target: string;
  weight: number;
}

export interface CollaborationNetworkData {
  focusUserId: string | null;
  /** threshold the server applied to links */
  minJointPapers: number;
  nodes: CollaborationNode[];
  edges: WeightedEdge[];
}

export interface CollaborationNetworkParams {
  userId?: string;
  schoolId?: string;
  departmentId?: string;
  limit?: number;
  minJointPapers?: number;
}

export interface KeywordNode {
  id: string;
  name: string;
  pubs: number;
  momentum: number | null;
  categoryId: string | null;
  category: string | null;
}

export interface KeywordNetworkData {
  nodes: KeywordNode[];
  edges: WeightedEdge[];
}

export interface KeywordNetworkParams {
  categoryId?: string;
  limit?: number;
  minWeight?: number;
}

export interface KeywordCooccurrence {
  id: string;
  name: string;
  shared: number;
  pubs: number;
}

export interface TrendingKeyword {
  id: string;
  canonicalName: string;
  publicationCount: number;
  researcherCount: number;
  totalCitations: number;
  growthRate: number | null;
  momentum: number | null;
  yearlyVolume: Record<string, number> | null;
  firstSeenYear: number | null;
}

export interface EmergingKeyword {
  id: string;
  canonicalName: string;
  publicationCount: number;
  researcherCount: number;
  firstSeenYear: number | null;
}

export interface TrendingKeywordsData {
  trending: TrendingKeyword[];
  emerging: EmergingKeyword[];
}

export interface KeywordKpis {
  total: number;
  mapped: number;
  taxonomyCoverage: number;
  pendingReview: number;
  growing: number;
}

export interface Expert extends RipResearcherSummary {
  expertiseScore: number;
  matchingPublications: number;
  citations: number;
  lastActiveYear: number | null;
  topic: string | null;
  samplePapers: string[];
}

export interface ExpertSearchResult {
  topic: string | null;
  matchedCategories: string[];
  matchedTaxonomy: string[];
  expandedWith: { aliases: string[]; keywords: string[] } | null;
  experts: Expert[];
}

export interface ExpertSearchParams {
  topic?: string;
  categoryId?: string;
  domainId?: string;
  departmentId?: string;
  limit?: number;
}

export interface DomainMapLeader extends RipResearcherSummary {
  score: number;
}

export interface DomainMapSpecialization {
  id: string;
  name: string;
  publicationCount: number;
  researcherCount: number;
}

export interface DomainMapCategory {
  id: string;
  name: string;
  publicationCount: number;
  researcherCount: number;
  specializations: DomainMapSpecialization[];
  leaders: DomainMapLeader[];
}

export interface DomainMapDomain {
  id: string;
  name: string;
  colorHex: string | null;
  iconCode: string | null;
  publicationCount: number;
  researcherCount: number;
  categories: DomainMapCategory[];
}

export type PublicationSort = 'relevance' | 'recent' | 'citations';

export interface PublicationSearchParams {
  q?: string;
  yearFrom?: number;
  yearTo?: number;
  categoryId?: string;
  domainId?: string;
  authorId?: string;
  schoolId?: string;
  departmentId?: string;
  type?: string;
  sort?: PublicationSort;
  page?: number;
  /** up to 100 */
  pageSize?: number;
}

export interface PublicationHit {
  id: string;
  title: string;
  journal: string | null;
  year: number | null;
  citations: number;
  doi: string | null;
  quartile: string | null;
  type: string | null;
  department: string | null;
  school: string | null;
  authors: string[];
  matchedVia: string[];
  relevance: number;
}

export interface PublicationSearchResult {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  expansion: {
    aliases: string[];
    direct: string[];
    taxonomy: { domains: string[]; categories: string[]; specializations: string[] };
    related: string[];
  } | null;
  results: PublicationHit[];
}

export interface EntitySearchResult {
  departments: { id: string; name: string; shortName: string | null; school: string | null; schoolId: string | null }[];
  schools: { id: string; name: string; shortName: string | null }[];
  researchers: RipResearcherSummary[];
  keywords: { id: string; canonicalName: string; publicationCount: number }[];
  categories: { id: string; name: string; domain: { id: string; name: string } | null }[];
}

export interface RipDepartmentUnit {
  id: string;
  name: string;
  shortName: string | null;
}

export interface RipSchoolUnit extends RipDepartmentUnit {
  departments: RipDepartmentUnit[];
}

/** GET /units — the university's schools and departments for filters. */
export interface RipUnits {
  schools: RipSchoolUnit[];
}
