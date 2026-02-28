/**
 * Event Settings Service
 *
 * API calls for event visibility/settings configuration.
 * Separate from main event.service.ts for clean architecture.
 */

import api from '@/shared/api/api';
import type {
  EventVisibility,
  EventVisibilityUpdate,
  HierarchyData,
} from '../types/eventSettings.types';

const BASE_URL = '/events';

export const eventSettingsService = {
  /**
   * Get event visibility settings
   */
  async getSettings(eventId: string): Promise<EventVisibility> {
    const response = await api.get(`${BASE_URL}/${eventId}/settings`);
    return response.data.data;
  },

  /**
   * Update event visibility settings
   */
  async updateSettings(eventId: string, data: EventVisibilityUpdate): Promise<EventVisibility> {
    const response = await api.put(`${BASE_URL}/${eventId}/settings`, data);
    return response.data.data;
  },

  /**
   * Toggle event active status (ON/OFF)
   */
  async toggleActive(eventId: string): Promise<EventVisibility> {
    const response = await api.patch(`${BASE_URL}/${eventId}/settings/toggle-active`);
    return response.data.data;
  },

  /**
   * Get hierarchy data for settings UI
   */
  async getHierarchyData(): Promise<HierarchyData> {
    const response = await api.get(`${BASE_URL}/hierarchy/data`);
    return response.data.data;
  },
};
