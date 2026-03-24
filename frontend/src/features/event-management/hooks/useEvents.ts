/**
 * Event Management React Query Hooks
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - useEvent: caches event detail for 2 min, prevents re-fetch on back-navigation
 * - useMyCreatedEvents: replaces manual useEffect with cached query + select transform
 * - All hooks share EVENT_QUERY_KEYS for targeted invalidation
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { eventService } from '../services/event.service';
import type { EventAdminEventFilters, EventFilters } from '../types/event.types';

export const EVENT_QUERY_KEYS = {
  list: (filters: EventFilters, page: number, limit: number) =>
    ['events', 'list', filters, page, limit],
  detail: (id: string) => ['events', id],
  myCreated: () => ['events', 'my-created'],
  rounds: (eventId: string) => ['events', eventId, 'rounds'] as const,
  customFields: (eventId: string) => ['events', eventId, 'custom-fields'] as const,
  registrationSettings: (eventId: string) => ['events', eventId, 'registration-settings'] as const,
  prizes: (eventId: string) => ['events', eventId, 'prizes'] as const,
  adminOverview: (params?: { startDate?: string; endDate?: string }) =>
    ['events', 'admin', 'overview', params] as const,
  adminUsers: (params?: { startDate?: string; endDate?: string }) =>
    ['events', 'admin', 'users', params] as const,
  adminActivity: (params?: { startDate?: string; endDate?: string; page?: number; limit?: number }) =>
    ['events', 'admin', 'activity', params] as const,
  adminEvents: (filters: EventAdminEventFilters, page: number, limit: number) =>
    ['events', 'admin', 'list', filters, page, limit] as const,
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
 * Hook to fetch rounds for an event.
 */
export function useRounds(eventId: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.rounds(eventId),
    queryFn: () => eventService.getRounds(eventId),
    enabled: !!eventId && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to fetch custom fields for an event.
 */
export function useEventCustomFields(eventId: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.customFields(eventId),
    queryFn: () => eventService.getCustomFields(eventId),
    enabled: !!eventId && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to fetch registration settings for an event.
 */
export function useRegistrationSettings(eventId: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.registrationSettings(eventId),
    queryFn: () => eventService.getRegistrationSettings(eventId),
    enabled: !!eventId && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to fetch prizes for an event.
 */
export function useEventPrizes(eventId: string, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.prizes(eventId),
    queryFn: () => eventService.getPrizes(eventId),
    enabled: !!eventId && enabled,
    staleTime: 60 * 1000,
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

export function useEventAdminOverview(
  params?: { startDate?: string; endDate?: string },
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: EVENT_QUERY_KEYS.adminOverview(params),
    queryFn: () => eventService.getAdminOverview(params),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useEventAdminUsers(
  params?: { startDate?: string; endDate?: string },
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: EVENT_QUERY_KEYS.adminUsers(params),
    queryFn: () => eventService.getAdminUsers(params),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useEventAdminActivity(
  params?: { startDate?: string; endDate?: string; page?: number; limit?: number },
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: EVENT_QUERY_KEYS.adminActivity(params),
    queryFn: () => eventService.getAdminActivity(params),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useEventAdminEvents(
  filters: EventAdminEventFilters = {},
  page = 1,
  limit = 20,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: EVENT_QUERY_KEYS.adminEvents(filters, page, limit),
    queryFn: () => eventService.getAdminEvents(filters, page, limit),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
