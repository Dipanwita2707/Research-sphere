/**
 * Event Management React Query Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import type { EventFilters } from '../types/event.types';

export const EVENT_QUERY_KEYS = {
  list: (filters: EventFilters, page: number, limit: number) =>
    ['events', 'list', filters, page, limit],
  detail: (id: string) => ['events', id],
};

/**
 * Hook to fetch events list with filters and pagination
 */
export function useEvents(
  filters: EventFilters = {},
  page = 1,
  limit = 20
) {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.list(filters, page, limit),
    queryFn: () => eventService.getEvents(filters, page, limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch a single event by ID
 */
export function useEvent(id: string) {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.detail(id),
    queryFn: () => eventService.getEventById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}
