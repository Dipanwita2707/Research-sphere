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
  EventPrize,
  PrizeFormData,
  StallApplication,
  StallApplicationFormData,
  StallOpportunity,
  Stall,
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
   * Get event registrations (for event creator) — with advanced server-side filters
   */
  async getEventRegistrations(
    id: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
    filters?: Record<string, string | number | undefined>
  ): Promise<{ registrations: any[]; pagination: any }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status && status !== 'all') params.append('status', status);

    // Append advanced filter params
    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== '' && val !== null) {
          params.append(key, String(val));
        }
      }
    }

    const response = await api.get(`${BASE_URL}/${id}/registrations?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Get registration filter options (distinct values from actual registrations)
   */
  async getRegistrationFilterOptions(id: string): Promise<any> {
    const response = await api.get(`${BASE_URL}/${id}/registrations/filter-options`);
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
   * Get volunteer activity for a specific volunteer (event creator view)
   */
  async getVolunteerActivity(
    eventId: string,
    volunteerId: string,
    page: number = 1,
    limit: number = 50,
    filters?: { startDate?: string; endDate?: string }
  ): Promise<{
    volunteer: any;
    event: any;
    entries: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const response = await api.get(`${BASE_URL}/${eventId}/volunteers/${volunteerId}/activity?${params.toString()}`);
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

  // ============================================
  // Advanced Registration Methods
  // ============================================

  /**
   * Get registration form for an event (with custom fields and user profile)
   */
  async getRegistrationForm(eventId: string): Promise<any> {
    const response = await api.get(`${BASE_URL}/${eventId}/registration-form`);
    return response.data.data;
  },

  /**
   * Submit registration form with form data
   */
  async submitRegistrationForm(eventId: string, formData: Record<string, any>): Promise<any> {
    const response = await api.post(`${BASE_URL}/${eventId}/register-with-form`, formData);
    return response.data.data;
  },

  /**
   * Get registration dashboard
   */
  async getRegistrationDashboard(): Promise<any> {
    const response = await api.get(`${BASE_URL}/registration-dashboard`);
    return response.data.data;
  },

  /**
   * Get user profile data for auto-fill
   */
  async getProfileData(): Promise<any> {
    const response = await api.get(`${BASE_URL}/profile-data`);
    return response.data.data;
  },

  // ============================================
  // Team Management Methods
  // ============================================

  /**
   * Create a team for an event
   */
  async createTeam(eventId: string, teamName: string): Promise<any> {
    const response = await api.post(`${BASE_URL}/${eventId}/teams`, { teamName });
    return response.data.data;
  },

  /**
   * Finalize/Submit team registration
   * Allows team leader to complete registration when minimum requirements are met
   */
  async finalizeTeamRegistration(eventId: string, teamId: string): Promise<any> {
    const response = await api.post(`${BASE_URL}/${eventId}/teams/${teamId}/finalize`);
    return response.data.data;
  },

  /**
   * Get team details
   */
  async getTeamDetails(eventId: string, teamId?: string): Promise<any> {
    // If no teamId provided, get user's current team
    if (!teamId) {
      const response = await api.get(`${BASE_URL}/${eventId}/my-team`);
      return response.data.data;
    }
    const response = await api.get(`${BASE_URL}/${eventId}/teams/${teamId}`);
    return response.data.data;
  },

  /**
   * Get teams looking for members
   */
  async getTeamsLookingForMembers(eventId: string): Promise<any[]> {
    const response = await api.get(`${BASE_URL}/${eventId}/teams/looking-for-members`);
    return response.data.data;
  },

  /**
   * Get users looking for teammates
   */
  async getUsersLookingForTeammates(eventId: string): Promise<any[]> {
    const response = await api.get(`${BASE_URL}/${eventId}/users-looking-for-teammates`);
    return response.data.data;
  },

  /**
   * Search users to invite
   */
  async searchUsersToInvite(eventId: string, query: string): Promise<any[]> {
    const response = await api.get(`${BASE_URL}/${eventId}/search-users?q=${encodeURIComponent(query)}`);
    return response.data.data;
  },

  /**
   * Search students for volunteer assignment (by UID, name, or email)
   * Only returns students with login access
   */
  async searchStudentsForVolunteer(query: string): Promise<{ id: string; uid: string; name: string; email: string; department?: string }[]> {
    if (!query.trim() || query.length < 2) return [];
    const response = await api.get(`/users/suggestions/${encodeURIComponent(query.trim())}?role=student`);
    return response.data?.data ?? [];
  },

  /**
   * Invite user to team
   */
  async inviteToTeam(eventId: string, teamId: string, inviteeId: string, message?: string): Promise<any> {
    const response = await api.post(`${BASE_URL}/${eventId}/teams/${teamId}/invite`, { inviteeId, message });
    return response.data.data;
  },

  /**
   * Respond to team invitation
   */
  async respondToInvitation(eventId: string, invitationId: string, accept: boolean): Promise<any> {
    const response = await api.post(`${BASE_URL}/${eventId}/invitations/${invitationId}/respond`, { accept });
    return response.data.data;
  },

  /**
   * Request to join a team
   */
  async requestToJoinTeam(eventId: string, teamId: string, message?: string): Promise<any> {
    const response = await api.post(`${BASE_URL}/${eventId}/teams/${teamId}/request-join`, { message });
    return response.data.data;
  },

  /**
   * Respond to join request
   */
  async respondToJoinRequest(eventId: string, requestId: string, accept: boolean): Promise<any> {
    const response = await api.post(`${BASE_URL}/${eventId}/requests/${requestId}/respond`, { accept });
    return response.data.data;
  },

  /**
   * Toggle looking for teammates
   */
  async toggleLookingForTeammates(eventId: string, looking: boolean): Promise<any> {
    const response = await api.patch(`${BASE_URL}/${eventId}/looking-for-teammates`, { looking });
    return response.data.data;
  },

  /**
   * Toggle team looking for members
   */
  async toggleTeamLookingForMembers(eventId: string, teamId: string, looking: boolean): Promise<any> {
    const response = await api.patch(`${BASE_URL}/${eventId}/teams/${teamId}/looking-for-members`, { looking });
    return response.data.data;
  },

  /**
   * Remove member from team
   */
  async removeMemberFromTeam(eventId: string, teamId: string, memberId: string): Promise<any> {
    const response = await api.delete(`${BASE_URL}/${eventId}/teams/${teamId}/members/${memberId}`);
    return response.data.data;
  },

  /**
   * Cancel team
   */
  async cancelTeam(eventId: string, teamId: string): Promise<any> {
    const response = await api.delete(`${BASE_URL}/${eventId}/teams/${teamId}`);
    return response.data.data;
  },

  /**
   * Get my invitations (received and sent)
   */
  async getMyInvitations(eventId: string): Promise<{ received: any[]; sent: any[] }> {
    const response = await api.get(`${BASE_URL}/${eventId}/invitations/my`);
    return response.data.data;
  },

  /**
   * Get my requests (received and sent)
   */
  async getMyRequests(eventId: string): Promise<{ received: any[]; sent: any[] }> {
    const response = await api.get(`${BASE_URL}/${eventId}/requests/my`);
    return response.data.data;
  },

  // ============================================
  // Custom Field Management Methods
  // ============================================

  /**
   * Get custom fields for an event
   */
  async getCustomFields(eventId: string): Promise<any[]> {
    const response = await api.get(`${BASE_URL}/${eventId}/custom-fields`);
    return response.data.data;
  },

  /**
   * Create custom field
   */
  async createCustomField(eventId: string, fieldData: any): Promise<any> {
    const response = await api.post(`${BASE_URL}/${eventId}/custom-fields`, fieldData);
    return response.data.data;
  },

  /**
   * Update custom field
   */
  async updateCustomField(eventId: string, fieldId: string, fieldData: any): Promise<any> {
    const response = await api.patch(`${BASE_URL}/${eventId}/custom-fields/${fieldId}`, fieldData);
    return response.data.data;
  },

  /**
   * Delete custom field
   */
  async deleteCustomField(eventId: string, fieldId: string): Promise<any> {
    const response = await api.delete(`${BASE_URL}/${eventId}/custom-fields/${fieldId}`);
    return response.data.data;
  },

  /**
   * Reorder custom fields
   */
  async reorderCustomFields(eventId: string, fieldOrderMap: Record<string, number>): Promise<any> {
    const response = await api.patch(`${BASE_URL}/${eventId}/custom-fields/reorder`, { fieldOrderMap });
    return response.data.data;
  },

  /**
   * Get registration settings
   */
  async getRegistrationSettings(eventId: string): Promise<any> {
    const response = await api.get(`${BASE_URL}/${eventId}/registration-settings`);
    return response.data.data;
  },

  /**
   * Update registration settings
   */
  async updateRegistrationSettings(eventId: string, settings: any): Promise<any> {
    const response = await api.patch(`${BASE_URL}/${eventId}/registration-settings`, settings);
    return response.data.data;
  },

  // ============================================
  // Prize Management Methods
  // ============================================

  /**
   * Get prizes for an event
   */
  async getPrizes(eventId: string): Promise<EventPrize[]> {
    const response = await api.get(`${BASE_URL}/${eventId}/prizes`);
    return response.data;
  },

  /**
   * Get specific prize
   */
  async getPrizeById(eventId: string, prizeId: string): Promise<EventPrize> {
    const response = await api.get(`${BASE_URL}/${eventId}/prizes/${prizeId}`);
    return response.data;
  },

  /**
   * Create prize
   */
  async createPrize(eventId: string, prizeData: PrizeFormData): Promise<EventPrize> {
    const response = await api.post(`${BASE_URL}/${eventId}/prizes`, prizeData);
    return response.data;
  },

  /**
   * Update prize
   */
  async updatePrize(eventId: string, prizeId: string, prizeData: Partial<PrizeFormData>): Promise<EventPrize> {
    const response = await api.patch(`${BASE_URL}/${eventId}/prizes/${prizeId}`, prizeData);
    return response.data;
  },

  /**
   * Delete prize
   */
  async deletePrize(eventId: string, prizeId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${eventId}/prizes/${prizeId}`);
  },

  /**
   * Bulk upsert prizes (create/update/delete in one call)
   */
  async bulkUpsertPrizes(eventId: string, prizes: EventPrize[]): Promise<EventPrize[]> {
    const response = await api.post(`${BASE_URL}/${eventId}/prizes/bulk`, { prizes });
    return response.data;
  },

  /**
   * Reorder prizes
   */
  async reorderPrizes(eventId: string, prizeOrders: Array<{ prizeId: string; sortOrder: number }>): Promise<EventPrize[]> {
    const response = await api.patch(`${BASE_URL}/${eventId}/prizes/reorder`, { prizeOrders });
    return response.data;
  },

  /**
   * Toggle prizes enabled
   */
  async togglePrizesEnabled(eventId: string, enabled: boolean): Promise<Event> {
    const response = await api.patch(`${BASE_URL}/${eventId}/prizes-enabled`, { enabled });
    return response.data;
  },

  // ============================================
  // Stall Management Methods
  // ============================================

  /**
   * Get events open for stall applications (browse page)
   */
  async getStallOpportunities(): Promise<StallOpportunity[]> {
    const response = await api.get(`${BASE_URL}/stall-opportunities`);
    const data = response.data?.data;
    const events = data?.events ?? [];
    return events.map((e: Record<string, unknown>) => ({
      id: e.id,
      eventId: e.eventId,
      name: e.eventName ?? e.name ?? '',
      startDate: e.eventDate ?? e.startDate ?? '',
      endDate: e.endDate ?? '',
      venue: e.venue,
      applicationDeadline: e.applicationDeadline,
      maxStudentStalls: e.maxStudentStalls,
      stallFee: e.stallFee,
      stallsApproved: e.appliedCount ?? 0,
      stallsRemaining: e.spotsLeft,
      myApplication: e.myApplication,
    }));
  },

  /**
   * Submit a stall application for an event
   */
  async submitStallApplication(
    eventId: string,
    data: StallApplicationFormData
  ): Promise<StallApplication> {
    const response = await api.post(`${BASE_URL}/${eventId}/stall-applications`, data);
    return response.data.data;
  },

  /**
   * Get my stall application for an event
   */
  async getMyStallApplication(eventId: string): Promise<StallApplication | null> {
    const response = await api.get(`${BASE_URL}/${eventId}/stall-applications/my`);
    return response.data.data;
  },

  /**
   * Get all stall applications for an event (creator view)
   */
  async getStallApplications(
    eventId: string,
    params: { status?: string; page?: number; limit?: number } = {}
  ): Promise<{ applications: StallApplication[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    const response = await api.get(`${BASE_URL}/${eventId}/stall-applications?${query}`);
    return response.data.data;
  },

  /**
   * Toggle student stall application portal open / closed.
   * Works regardless of event draft/publish status.
   */
  async toggleStallApplications(
    eventId: string
  ): Promise<{ stallApplicationsOpen: boolean; stallConfig: any }> {
    const response = await api.patch(`${BASE_URL}/${eventId}/stall-applications/toggle-open`);
    return response.data.data;
  },

  /**
   * Approve or reject a stall application
   */
  async updateStallApplication(
    eventId: string,
    appId: string,
    data: { status: 'approved' | 'rejected'; rejectionReason?: string }
  ): Promise<StallApplication> {
    const response = await api.patch(`${BASE_URL}/${eventId}/stall-applications/${appId}`, data);
    return response.data.data;
  },

  /**
   * Bulk approve/reject stall applications
   */
  async bulkUpdateStallApplications(
    eventId: string,
    data: { applicationIds: string[]; status: 'approved' | 'rejected'; reviewNote?: string }
  ): Promise<{ updated: number }> {
    const response = await api.patch(`${BASE_URL}/${eventId}/stall-applications/bulk`, data);
    return response.data.data;
  },

  /**
   * Get all stalls for an event (creator view)
   */
  async getStalls(eventId: string): Promise<Stall[]> {
    const response = await api.get(`${BASE_URL}/${eventId}/stalls`);
    const data = response.data?.data;
    return Array.isArray(data) ? data : (data?.stalls ?? []);
  },

  /**
   * Create a stall directly (creator-made, no approval needed)
   */
  async createStall(
    eventId: string,
    data: {
      stallName: string;
      stallType: string;
      category?: string;
      description?: string;
      size?: string;
      location?: string;
      businessName?: string;
      electricityRequired?: boolean;
      waterRequired?: boolean;
      specialRequirements?: string;
      products?: string[];
    }
  ): Promise<Stall> {
    const payload: Record<string, unknown> = {
      stallName: data.stallName,
      stallType: data.stallType,
      stallCategory: data.category,
      description: data.description,
      size: data.size,
      location: data.location,
      businessName: data.businessName,
      electricityRequired: data.electricityRequired,
      waterRequired: data.waterRequired,
      specialRequirements: data.specialRequirements,
      products: data.products,
    };
    const response = await api.post(`${BASE_URL}/${eventId}/stalls`, payload);
    return response.data.data;
  },

  /**
   * Update a stall (creator-made only)
   */
  async updateStall(
    eventId: string,
    stallId: string,
    data: {
      stallName?: string;
      stallType?: string;
      category?: string;
      description?: string;
      size?: string;
      location?: string;
      businessName?: string;
      electricityRequired?: boolean;
      waterRequired?: boolean;
      specialRequirements?: string;
      products?: string[];
    }
  ): Promise<Stall> {
    const payload: Record<string, unknown> = {};
    if (data.stallName !== undefined) payload.stallName = data.stallName;
    if (data.stallType !== undefined) payload.stallType = data.stallType;
    if (data.category !== undefined) payload.stallCategory = data.category;
    if (data.description !== undefined) payload.description = data.description;
    if (data.size !== undefined) payload.size = data.size;
    if (data.location !== undefined) payload.location = data.location;
    if (data.businessName !== undefined) payload.businessName = data.businessName;
    if (data.electricityRequired !== undefined) payload.electricityRequired = data.electricityRequired;
    if (data.waterRequired !== undefined) payload.waterRequired = data.waterRequired;
    if (data.specialRequirements !== undefined) payload.specialRequirements = data.specialRequirements;
    if (data.products !== undefined) payload.products = data.products;
    const response = await api.patch(`${BASE_URL}/${eventId}/stalls/${stallId}`, payload);
    return response.data.data;
  },

  /**
   * Delete a stall
   */
  async deleteStall(eventId: string, stallId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${eventId}/stalls/${stallId}`);
  },

  /**
   * Get minimal event info for feedback form (public - no auth, for QR scanner users)
   */
  async getFeedbackFormInfo(eventId: string): Promise<{ id: string; name: string }> {
    const response = await api.get(`${BASE_URL}/${eventId}/feedback-info`);
    return response.data.data;
  },

  /**
   * Submit event feedback (public - no auth required)
   */
  async submitFeedback(eventId: string, data: { points: number[]; shortDescription?: string }): Promise<{ id: string }> {
    const response = await api.post(`${BASE_URL}/${eventId}/feedback`, data);
    return response.data.data;
  },

  /**
   * Get event feedback list (event creator only)
   */
  async getFeedback(eventId: string, page = 1, limit = 20): Promise<{
    feedback: Array<{ id: string; points: number[]; shortDescription: string | null; createdAt: string }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
    summary: { totalFeedback: number; overallAvg: number };
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/feedback`, { params: { page, limit } });
    return response.data.data;
  },
};
