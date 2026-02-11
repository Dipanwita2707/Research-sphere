/**
 * Event Management Service
 * Handles all API calls for event management
 */

import api from '@/shared/api/api';
import type {
  Event,
  EventRegistration,
  EventVolunteer,
  EventEntry,
  EventStatistics,
  EventFormData,
  VolunteerFormData,
  QRScanData,
  EventFilters,
  EventListResponse,
} from '../types/event.types';

const BASE_URL = '/events';

export const eventService = {
  /**
   * Get list of events with filters
   */
  async getEvents(
    filters: EventFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<EventListResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    if (filters.status) params.append('status', filters.status);
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.search) params.append('search', filters.search);
    if (filters.myEvents) params.append('myEvents', 'true');
    
    const response = await api.get(`${BASE_URL}?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Get event by ID
   */
  async getEventById(id: string): Promise<Event> {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data.data;
  },

  /**
   * Get event by ID (alias for getEventById)
   */
  async getEvent(id: string): Promise<Event> {
    return this.getEventById(id);
  },

  /**
   * Update event details
   */
  async updateEvent(id: string, data: EventFormData): Promise<Event> {
    const response = await api.patch(`${BASE_URL}/${id}`, data);
    return response.data.data;
  },

  /**
   * Publish event
   */
  async publishEvent(id: string): Promise<Event> {
    const response = await api.post(`${BASE_URL}/${id}/publish`);
    return response.data.data;
  },

  /**
   * Register for an event
   */
  async registerForEvent(id: string): Promise<EventRegistration> {
    const response = await api.post(`${BASE_URL}/${id}/register`);
    return response.data.data;
  },

  /**
   * Get my registrations
   */
  async getMyRegistrations(
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<{ registrations: EventRegistration[]; pagination: any }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status) params.append('status', status);
    
    const response = await api.get(`${BASE_URL}/registrations/my?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Get event registrations (for event creator)
   */
  async getEventRegistrations(
    id: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<{ registrations: EventRegistration[]; pagination: any }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status) params.append('status', status);
    
    const response = await api.get(`${BASE_URL}/${id}/registrations?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Get event statistics
   */
  async getEventStatistics(id: string): Promise<EventStatistics> {
    const response = await api.get(`${BASE_URL}/${id}/statistics`);
    return response.data.data;
  },

  /**
   * Get event statistics (alias for getEventStatistics)
   */
  async getStatistics(id: string): Promise<EventStatistics> {
    return this.getEventStatistics(id);
  },

  /**
   * Assign volunteer to event
   */
  async assignVolunteer(id: string, data: VolunteerFormData): Promise<EventVolunteer> {
    const response = await api.post(`${BASE_URL}/${id}/volunteers`, data);
    return response.data.data;
  },


  /**
   * Get event volunteers (alias for getEventVolunteers)
   */
  async getVolunteers(id: string): Promise<EventVolunteer[]> {
    return this.getEventVolunteers(id);
  },

  /**
   * Remove volunteer from event
   */
  async removeVolunteer(eventId: string, volunteerId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${eventId}/volunteers/${volunteerId}`);
  },

  /**
   * Update volunteer details
   */
  async updateVolunteer(
    eventId: string,
    volunteerId: string,
    data: Partial<VolunteerFormData>
  ): Promise<EventVolunteer> {
    const response = await api.patch(`${BASE_URL}/${eventId}/volunteers/${volunteerId}`, data);
    return response.data.data;
  },
  /**
   * Get event volunteers
   */
  async getEventVolunteers(id: string): Promise<EventVolunteer[]> {
    const response = await api.get(`${BASE_URL}/${id}/volunteers`);
    return response.data.data;
  },

  /**
   * Scan QR code for entry/exit
   */
  async scanQRCode(id: string, data: QRScanData): Promise<EventEntry> {
    const response = await api.post(`${BASE_URL}/${id}/scan`, data);
    return response.data.data;
  },

  /**
   * Cancel registration
   */
  async cancelRegistration(registrationId: string): Promise<void> {
    await api.delete(`${BASE_URL}/registrations/${registrationId}`);
  },

  /**
   * Get my volunteer assignments (events where user is a volunteer)
   */
  async getMyVolunteerAssignments(): Promise<any[]> {
    const response = await api.get(`${BASE_URL}/volunteers/my`);
    return response.data.data;
  },

  /**
   * Get my volunteer activity (scan history)
   */
  async getMyVolunteerActivity(
    page: number = 1,
    limit: number = 30,
    filters: { eventId?: string; search?: string; startDate?: string; endDate?: string } = {}
  ): Promise<{ entries: any[]; pagination: any }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters.eventId) params.append('eventId', filters.eventId);
    if (filters.search) params.append('search', filters.search);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    const response = await api.get(`${BASE_URL}/volunteers/my/activity?${params.toString()}`);
    return response.data.data;
  },
};
