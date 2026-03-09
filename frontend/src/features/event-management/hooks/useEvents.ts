/**
 * Event Management React Query Hooks
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - useEvent: caches event detail for 2 min, prevents re-fetch on back-navigation
 * - useMyCreatedEvents: replaces manual useEffect with cached query + select transform
 * - All hooks share EVENT_QUERY_KEYS for targeted invalidation
 */

import { useQuery } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import type { EventFilters } from '../types/event.types';

export const EVENT_QUERY_KEYS = {
  list: (filters: EventFilters, page: number, limit: number) =>
    ['events', 'list', filters, page, limit],
  detail: (id: string) => ['events', id],
  myCreated: () => ['events', 'my-created'],
};

/**
 * Hook to fetch events list with filters and pagination
 */
export function useEvents(
  filters: EventFilters = {},
  page = 1,
  limit = 20,
  enabled = true,
) {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.list(filters, page, limit),
    queryFn: () => eventService.getEvents(filters, page, limit),
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch a single event by ID.
 * Caches for 2 min so back-navigation is instant (no re-fetch).
 */
export function useEvent(id: string) {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.detail(id),
    queryFn: () => eventService.getEventById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000, // Keep cached for 10 min even after unmount
  });
}

/**
 * Hook to fetch all events created by the current user.
 * Replaces manual useEffect + useState pattern with cached TanStack Query.
 * Uses `select` for referential stability — only the events array is returned.
 */
export function useMyCreatedEvents() {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.myCreated(),
    queryFn: () => eventService.getEvents({ myEvents: true }, 1, 100),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.events,
  });
}
