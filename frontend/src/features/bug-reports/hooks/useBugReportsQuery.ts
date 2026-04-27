'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { unwrapResponse } from '@/shared/api/api';
import type {
  BugReportListResponse,
  BugReportFilters,
  BugReport,
  BugReportDetail,
  ResolutionStatus,
} from '../types/bugReport.types';

// Query keys for React Query
export const bugReportKeys = {
  all: ['bug-reports'] as const,
  lists: () => [...bugReportKeys.all, 'list'] as const,
  list: (filters: BugReportFilters) => [...bugReportKeys.lists(), filters] as const,
  details: () => [...bugReportKeys.all, 'detail'] as const,
  detail: (id: string) => [...bugReportKeys.details(), id] as const,
  counts: () => [...bugReportKeys.all, 'counts'] as const,
};

/**
 * Hook to fetch bug reports with caching and automatic refetching
 * @param filters - Filter options for bug reports
 * @param options - React Query options
 */
export function useBugReportsQuery(
  filters: BugReportFilters,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
  }
) {
  return useQuery({
    queryKey: bugReportKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      params.append('sortBy', filters.sortBy);
      params.append('order', filters.order);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await api.get<BugReportListResponse>(
        `/admin/bug-reports?${params.toString()}`
      );
      return unwrapResponse<BugReportListResponse>(response);
    },
    staleTime: options?.staleTime ?? 30000, // 30 seconds - data is considered fresh
    gcTime: options?.cacheTime ?? 5 * 60 * 1000, // 5 minutes - cache time
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to fetch a single bug report by ID
 * @param id - Bug report ID
 * @param options - React Query options
 */
export function useBugReportQuery(
  id: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  return useQuery({
    queryKey: bugReportKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<BugReportDetail>(`/admin/bug-reports/${id}`);
      return unwrapResponse<BugReportDetail>(response);
    },
    staleTime: options?.staleTime ?? 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: options?.enabled ?? !!id,
  });
}

/**
 * Hook to update bug report resolution status with cache invalidation
 */
export function useUpdateBugReportStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ResolutionStatus;
    }) => {
      const response = await api.patch(`/admin/bug-reports/${id}/status`, {
        status,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch bug report lists
      queryClient.invalidateQueries({ queryKey: bugReportKeys.lists() });
      
      // Invalidate the specific bug report detail
      queryClient.invalidateQueries({ queryKey: bugReportKeys.detail(variables.id) });
      
      // Invalidate counts
      queryClient.invalidateQueries({ queryKey: bugReportKeys.counts() });
    },
  });
}

/**
 * Hook to get bug report counts (for navigation badge)
 */
export function useBugReportCounts() {
  return useQuery({
    queryKey: bugReportKeys.counts(),
    queryFn: async () => {
      const response = await api.get<BugReportListResponse>(
        '/admin/bug-reports?limit=1'
      );
      const data = unwrapResponse<BugReportListResponse>(response);
      return data.counts;
    },
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60000, // Refetch every minute for real-time updates
  });
}
