/**
 * Event Settings React Query Hooks
 *
 * Provides optimized data fetching and mutation hooks
 * for the event visibility/settings system.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventSettingsService } from '../services/eventSettings.service';
import type { EventVisibilityUpdate } from '../types/eventSettings.types';

export const EVENT_SETTINGS_KEYS = {
  settings: (eventId: string) => ['events', eventId, 'settings'] as const,
  hierarchy: ['events', 'hierarchy'] as const,
};

/**
 * Fetch event visibility settings
 */
export function useEventSettings(eventId: string) {
  return useQuery({
    queryKey: EVENT_SETTINGS_KEYS.settings(eventId),
    queryFn: () => eventSettingsService.getSettings(eventId),
    enabled: !!eventId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch hierarchy data (schools, departments, programs, sections)
 * Cached aggressively since this data changes rarely.
 */
export function useHierarchyData(enabled = true) {
  return useQuery({
    queryKey: EVENT_SETTINGS_KEYS.hierarchy,
    queryFn: () => eventSettingsService.getHierarchyData(),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,    // 30 minutes garbage collection
  });
}

/**
 * Update event visibility settings
 */
export function useUpdateEventSettings(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EventVisibilityUpdate) =>
      eventSettingsService.updateSettings(eventId, data),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(
        EVENT_SETTINGS_KEYS.settings(eventId),
        updatedSettings
      );
    },
  });
}

/**
 * Toggle event active status
 */
export function useToggleEventActive(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => eventSettingsService.toggleActive(eventId),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(
        EVENT_SETTINGS_KEYS.settings(eventId),
        updatedSettings
      );
      // Also invalidate event detail since visibility affects it
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
  });
}
