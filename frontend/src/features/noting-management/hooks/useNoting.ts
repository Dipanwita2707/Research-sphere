/**
 * Noting Management React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notingService } from '../services/noting.service';

export type NotingListParams = {
  filter?: 'mine' | 'pending' | 'handled';
  status?: string;
  category?: string;
  search?: string;
  createdById?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  includeCounts?: boolean;
};

export const NOTING_QUERY_KEYS = {
  list: (params: NotingListParams) => ['noting', 'list', params],
  detail: (id: string) => ['noting', id],
  counts: () => ['noting', 'counts'],
};

/**
 * Hook to fetch noting list with filters
 * When includeCounts is true, response includes counts for tab badges (avoids separate /counts call)
 */
export function useNotingList(params: NotingListParams = {}) {
  const { filter = 'mine', page = 1, limit = 20, search, status, category, startDate, endDate, includeCounts = true } = params;
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.list(params),
    queryFn: () =>
      notingService.list({
        filter,
        page,
        limit,
        search,
        status,
        category,
        startDate,
        endDate,
        includeCounts,
      }),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch noting counts (mine, pending, handled).
 * @deprecated Counts are now included in useNotingList when includeCounts=true. Use that instead.
 */
export function useNotingCounts(filter?: 'mine' | 'pending' | 'handled') {
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.counts(),
    queryFn: () => notingService.getCounts(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch a single note by ID
 */
export function useNote(id: string) {
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.detail(id),
    queryFn: () => notingService.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook to delete a draft note
 */
export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notingService.deleteDraft(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['noting', 'list'] });
      queryClient.removeQueries({ queryKey: NOTING_QUERY_KEYS.detail(id) });
    },
  });
}
