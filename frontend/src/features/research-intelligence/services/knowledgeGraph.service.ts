import api from '@/shared/api/api';
import type {
  CollaborationNetworkData,
  CollaborationNetworkParams,
  DomainMapDomain,
  EntitySearchResult,
  ExpertSearchParams,
  ExpertSearchResult,
  KeywordCooccurrence,
  KeywordKpis,
  KeywordNetworkData,
  KeywordNetworkParams,
  PublicationSearchParams,
  PublicationSearchResult,
  RipUnits,
  TrendingKeywordsData,
} from '../graph.types';
import { cleanParams } from '../utils/graphUtils';

const BASE = '/research-intelligence';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T>(p: Promise<{ data: Envelope<T> }>) => p.then((r) => r.data.data);

/**
 * Knowledge graph, keyword intelligence and search endpoints.
 * Graph routes need rip_view_knowledge_graph, keyword routes rip_view_keyword_intelligence,
 * search routes any Research Intelligence "use" capability.
 */
export const knowledgeGraphService = {
  getCollaborationNetwork: (params: CollaborationNetworkParams = {}) =>
    unwrap<CollaborationNetworkData>(api.get(`${BASE}/graph/collaboration`, { params: cleanParams(params) })),
  getKeywordNetwork: (params: KeywordNetworkParams = {}) =>
    unwrap<KeywordNetworkData>(api.get(`${BASE}/graph/keywords`, { params: cleanParams(params) })),
  findExperts: (params: ExpertSearchParams) => unwrap<ExpertSearchResult>(api.get(`${BASE}/graph/experts`, { params: cleanParams(params) })),
  getDomainMap: () => unwrap<DomainMapDomain[]>(api.get(`${BASE}/graph/domain-map`)),

  getTrendingKeywords: (params: { limit?: number; minPubs?: number } = {}) =>
    unwrap<TrendingKeywordsData>(api.get(`${BASE}/keywords/trending`, { params: cleanParams(params) })),
  getKeywordKpis: () => unwrap<KeywordKpis>(api.get(`${BASE}/keywords/kpis`)),
  getKeywordCooccurrences: (keywordId: string, limit = 12) =>
    unwrap<KeywordCooccurrence[]>(api.get(`${BASE}/keywords/${keywordId}/cooccurrences`, { params: { limit } })),

  searchPublications: (params: PublicationSearchParams) =>
    unwrap<PublicationSearchResult>(
      api.get(`${BASE}/search/publications`, { params: cleanParams({ ...params, sort: params.sort === 'relevance' ? undefined : params.sort }) })
    ),
  getUnits: () => unwrap<RipUnits>(api.get(`${BASE}/units`)),
  searchEntities: (q: string) => unwrap<EntitySearchResult>(api.get(`${BASE}/search/entities`, { params: { q } })),
};
