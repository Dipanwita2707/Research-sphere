import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { knowledgeGraphService as svc } from '../services/knowledgeGraph.service';
import type {
  CollaborationNetworkParams,
  ExpertSearchParams,
  KeywordNetworkParams,
  PublicationSearchParams,
} from '../graph.types';

const KEY = ['research-intelligence', 'graph'] as const;
const STALE = 5 * 60 * 1000;
// 403/400 will not fix themselves; retry other failures once.
const retry = (count: number, err: unknown) => {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return !(status && status < 500) && count < 1;
};

export function useCollaborationNetwork(params: CollaborationNetworkParams, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'collaboration', params],
    queryFn: () => svc.getCollaborationNetwork(params),
    enabled,
    staleTime: STALE,
    retry,
    placeholderData: keepPreviousData,
  });
}

export function useKeywordNetwork(params: KeywordNetworkParams, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'keywords', params],
    queryFn: () => svc.getKeywordNetwork(params),
    enabled,
    staleTime: STALE,
    retry,
    placeholderData: keepPreviousData,
  });
}

export function useExperts(params: ExpertSearchParams, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'experts', params],
    queryFn: () => svc.findExperts(params),
    enabled: enabled && !!(params.topic || params.categoryId || params.domainId),
    staleTime: STALE,
    retry,
  });
}

export function useDomainMap(enabled = true) {
  return useQuery({ queryKey: [...KEY, 'domain-map'], queryFn: () => svc.getDomainMap(), enabled, staleTime: STALE, retry });
}

export function useTrendingKeywords(limit = 15, enabled = true) {
  return useQuery({ queryKey: [...KEY, 'trending', limit], queryFn: () => svc.getTrendingKeywords({ limit }), enabled, staleTime: STALE, retry });
}

export function useKeywordKpis(enabled = true) {
  return useQuery({ queryKey: [...KEY, 'keyword-kpis'], queryFn: () => svc.getKeywordKpis(), enabled, staleTime: STALE, retry });
}

export function useKeywordCooccurrences(keywordId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'cooccurrences', keywordId],
    queryFn: () => svc.getKeywordCooccurrences(keywordId!, 15),
    enabled: enabled && !!keywordId,
    staleTime: STALE,
    retry,
  });
}

export function usePublicationSearch(params: PublicationSearchParams, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'publications', params],
    queryFn: () => svc.searchPublications(params),
    enabled,
    staleTime: 60 * 1000,
    retry,
    placeholderData: keepPreviousData,
  });
}

/** Schools and departments (rarely change: cached for the session). */
export function useUnits(enabled = true) {
  return useQuery({ queryKey: [...KEY, 'units'], queryFn: () => svc.getUnits(), enabled, staleTime: 30 * 60 * 1000, retry });
}

export function useEntitySearch(q: string, enabled = true) {
  const term = q.trim();
  return useQuery({
    queryKey: [...KEY, 'entities', term],
    queryFn: () => svc.searchEntities(term),
    enabled: enabled && term.length >= 2,
    staleTime: 60 * 1000,
    retry,
    placeholderData: keepPreviousData,
  });
}

/** Debounce a fast-changing value (typeahead input). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
