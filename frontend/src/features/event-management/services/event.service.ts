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
  EventAdminOverview,
  EventAdminUserAnalytics,
  EventAdminActivityResponse,
  EventAdminEventFilters,
  EventAdminEventListResponse,
  EventPostReportListResponse,
  EventPostReportSummary,
  EventPrize,
  PrizeFormData,
  StallApplication,
  StallApplicationFormData,
  StallOpportunity,
  Stall,
  EventCoupon,
  CouponFormData,
  CouponValidationResult,
  EventExtraPass,
  PassPreviewData,
  EventRound,
  RoundFormData,
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

  async getAdminOverview(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<EventAdminOverview> {
    const response = await api.get(`${BASE_URL}/admin/analytics/overview`, { params });
    return response.data.data;
  },

  async getAdminUsers(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<EventAdminUserAnalytics> {
    const response = await api.get(`${BASE_URL}/admin/analytics/users`, { params });
    return response.data.data;
  },

  async getAdminActivity(params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<EventAdminActivityResponse> {
    const response = await api.get(`${BASE_URL}/admin/analytics/activity`, { params });
    return response.data.data;
  },

  async getAdminEvents(
    filters: EventAdminEventFilters = {},
    page: number = 1,
    limit: number = 20,
  ): Promise<EventAdminEventListResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    if (filters.search?.trim()) params.append('search', filters.search.trim());
    if (filters.status) params.append('status', filters.status);
    if (filters.createdById) params.append('createdById', filters.createdById);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.approvalStatus) params.append('approvalStatus', filters.approvalStatus);

    const response = await api.get(`${BASE_URL}/admin/events?${params.toString()}`);
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
    status?: string,
    search?: string
  ): Promise<{ registrations: EventRegistration[]; pagination: any }> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status) params.append('status', status);
    if (search?.trim()) params.append('search', search.trim());

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

  async exportEventRegistrationsCsv(
    id: string,
    status?: string,
    filters?: Record<string, string | number | undefined>
  ): Promise<{ blob: Blob; filename: string }> {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);

    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== '' && val !== null) {
          params.append(key, String(val));
        }
      }
    }

    const response = await api.get(`${BASE_URL}/${id}/registrations/export?${params.toString()}`, {
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] || '';
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);

    return {
      blob: response.data,
      filename: filenameMatch?.[1] || `event_registrations_${new Date().toISOString().split('T')[0]}.csv`,
    };
  },

  /**
   * Get registration filter options (distinct values from actual registrations)
   */
  async getRegistrationFilterOptions(id: string): Promise<any> {
    const response = await api.get(`${BASE_URL}/${id}/registrations/filter-options`);
    return response.data.data;
  },

  /**
   * Get detailed registration info (admin-only) — includes full payment records,
   * coupon usage, form data, team members, entry logs.
   */
  async getRegistrationDetails(eventId: string, regId: string): Promise<any> {
    const response = await api.get(`${BASE_URL}/${eventId}/registrations/${regId}/details`);
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
   * Get club members for an event's associated club (for quick volunteer assignment).
   * Returns members with `alreadyAssigned` flag.
   */
  async getClubMembers(eventId: string): Promise<{
    club: { id: string; clubId: string; name: string } | null;
    members: { id: string; uid: string; email: string; name: string; alreadyAssigned: boolean }[];
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/club-members`);
    return response.data.data;
  },

  /**
   * Scan QR code for entry/exit
   */
  async scanQRCode(id: string, data: QRScanData): Promise<EventEntry> {
    const response = await api.post(`${BASE_URL}/${id}/scan`, data);
    return response.data.data;
  },

  async previewQRScan(id: string, qrCode: string, entryType: 'entry' | 'exit'): Promise<PassPreviewData> {
    const response = await api.post(`${BASE_URL}/${id}/scan/preview`, { qrCode, entryType });
    return response.data.data;
  },

  async getScanContext(eventId: string): Promise<Pick<Event, 'id' | 'eventId' | 'name' | 'venue' | 'status'>> {
    const response = await api.get(`${BASE_URL}/${eventId}/scan-context`);
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
  ): Promise<{ entries: any[]; pagination: any; stats: { totalScans: number; totalEntries: number; totalExits: number } }> {
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

  // =====================================
    // Advanced Registration Methods
  // ==============================
    /**
   * Get registration form for an event (with custom fields and user profile)
   */
  async getRegistrationForm(eventId: string): Promise<any> {
    const response = await api.get(`${BASE_URL}/${eventId}/registration-form`);
    return response.data.data;
  },

  async getPaymentContext(eventId: string): Promise<{
    event: {
      id: string;
      name: string;
      paymentType: string;
      participationType: string;
      registrationFee?: number;
    };
    existingRegistration: {
      id: string;
      registrationId: string;
      status: string;
      paymentStatus?: string | null;
      amountPaid?: number | null;
    } | null;
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/payment-context`);
    return response.data.data;
  },

  /**
   * Submit registration form with form data
   */
  async submitRegistrationForm(eventId: string, formData: Record<string, any>): Promise<any> {
    const response = await api.post(`${BASE_URL}/${eventId}/register-with-form`, formData);
    return response.data.data;
  },

  async getMyExtraPasses(eventId: string): Promise<{
    allowExtraPasses: boolean;
    maxExtraPassesPerUser: number;
    registrationId: string;
    guests: EventExtraPass[];
    summary: {
      extraPassCount: number;
      totalAllowedEntries: number;
      checkedInCount: number;
      checkedOutCount?: number;
      currentlyInside?: number;
      availableEntrySlots?: number;
      remainingEntries: number;
      studentInside?: boolean;
    };
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/extra-passes`);
    return response.data.data;
  },

  async createExtraPass(
    eventId: string,
    payload: { guestName: string; guestEmail: string; mobileNumber: string; relationship: string }
  ): Promise<{
    extraPass: EventExtraPass;
    summary: {
      extraPassCount: number;
      totalAllowedEntries: number;
      checkedInCount: number;
      checkedOutCount?: number;
      currentlyInside?: number;
      availableEntrySlots?: number;
      remainingEntries: number;
      studentInside?: boolean;
    };
  }> {
    const response = await api.post(`${BASE_URL}/${eventId}/extra-passes`, payload);
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

  // =====================================
    // Team Management Methods
  // ==============================
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

  // =====================================
    // Custom Field Management Methods
  // ==============================
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

  // =====================================
    // Prize Management Methods
  // ==============================
    /**
   * Get prizes for an event
   */
  async getPrizes(eventId: string): Promise<EventPrize[]> {
    const response = await api.get(`${BASE_URL}/${eventId}/prizes`);
    return response.data?.data ?? response.data;
  },

  /**
   * Get specific prize
   */
  async getPrizeById(eventId: string, prizeId: string): Promise<EventPrize> {
    const response = await api.get(`${BASE_URL}/${eventId}/prizes/${prizeId}`);
    return response.data?.data ?? response.data;
  },

  /**
   * Create prize
   */
  async createPrize(eventId: string, prizeData: PrizeFormData): Promise<EventPrize> {
    const response = await api.post(`${BASE_URL}/${eventId}/prizes`, prizeData);
    return response.data?.data ?? response.data;
  },

  /**
   * Update prize
   */
  async updatePrize(eventId: string, prizeId: string, prizeData: Partial<PrizeFormData>): Promise<EventPrize> {
    const response = await api.patch(`${BASE_URL}/${eventId}/prizes/${prizeId}`, prizeData);
    return response.data?.data ?? response.data;
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
    return response.data?.data ?? response.data;
  },

  /**
   * Reorder prizes
   */
  async reorderPrizes(eventId: string, prizeOrders: Array<{ prizeId: string; sortOrder: number }>): Promise<EventPrize[]> {
    const response = await api.patch(`${BASE_URL}/${eventId}/prizes/reorder`, { prizeOrders });
    return response.data?.data ?? response.data;
  },

  /**
   * Toggle prizes enabled
   */
  async togglePrizesEnabled(eventId: string, enabled: boolean): Promise<Event> {
    const response = await api.patch(`${BASE_URL}/${eventId}/prizes-enabled`, { enabled });
    return response.data?.data ?? response.data;
  },

  // =====================================
    // Stall Management Methods
  // ==============================
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

  // ── Stall Feedback ────────────────────────────────────────────

  /**
   * Get stall info for stall feedback form (public - no auth)
   */
  async getStallFeedbackFormInfo(
    eventId: string,
    stallId: string,
  ): Promise<{ id: string; eventName: string; stallId: string; stallName: string }> {
    const response = await api.get(`${BASE_URL}/${eventId}/stalls/${stallId}/feedback-info`);
    return response.data.data;
  },

  /**
   * Submit stall feedback (public - no auth required)
   */
  async submitStallFeedback(
    eventId: string,
    stallId: string,
    data: { points: number[]; shortDescription?: string },
  ): Promise<{ id: string }> {
    const response = await api.post(`${BASE_URL}/${eventId}/stalls/${stallId}/feedback`, data);
    return response.data.data;
  },

  /**
   * Get stall feedback list (event creator only)
   */
  async getStallFeedback(
    eventId: string,
    stallId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    feedback: Array<{ id: string; points: number[]; shortDescription: string | null; createdAt: string }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
    summary: { totalFeedback: number; overallAvg: number };
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/stalls/${stallId}/feedback`, { params: { page, limit } });
    return response.data.data;
  },

  /**
   * Get stall feedback for the stall owner (auth required, ownership verified)
   */
  async getStallOwnerFeedback(
    eventId: string,
    stallId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    feedback: Array<{ id: string; points: number[]; shortDescription: string | null; createdAt: string }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
    summary: {
      totalFeedback: number;
      overallAvg: number;
      perCriterion: Array<{ label: string; avg: number }>;
    };
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/stalls/${stallId}/owner-feedback`, { params: { page, limit } });
    return response.data.data;
  },

  // =====================================
    // Payment API — Razorpay Integration
  // ==============================
    /**
   * Create a Razorpay order for individual event registration.
   * Backend calculates the amount — never trust frontend values.
   */
  async createIndividualPaymentOrder(eventId: string, couponCode?: string | null) {
    const payload = couponCode ===
   undefined ? {} : { couponCode };
    const response = await api.post(`${BASE_URL}/${eventId}/payments/individual/create-order`, payload);
    return response.data.data;
  },

  /**
   * Verify individual payment after Razorpay Checkout.
   */
  async verifyIndividualPayment(eventId: string, paymentData: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const response = await api.post(`${BASE_URL}/${eventId}/payments/individual/verify`, paymentData);
    return response.data.data;
  },

  /**
   * Create a Razorpay order for team event registration.
   * Only the team leader can initiate this.
   */
  async createTeamPaymentOrder(eventId: string, teamId: string, couponCode?: string) {
    const response = await api.post(`${BASE_URL}/${eventId}/teams/${teamId}/payments/create-order`, { couponCode: couponCode || undefined });
    return response.data.data;
  },

  /**
   * Verify team payment after Razorpay Checkout.
   */
  async verifyTeamPayment(eventId: string, teamId: string, paymentData: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const response = await api.post(`${BASE_URL}/${eventId}/teams/${teamId}/payments/verify`, paymentData);
    return response.data.data;
  },

  /**
   * Get payment status for a registration or team.
   */
  async getPaymentStatus(eventId: string, params?: { registrationId?: string; teamId?: string }) {
    const response = await api.get(`${BASE_URL}/${eventId}/payments/status`, { params });
    return response.data.data;
  },

  // ── Bulk Email ─────────────────────────────────────────────────

  /**
   * Get recipient counts per registration status for the email slider.
   */
  async getEmailRecipientsCount(eventId: string): Promise<{ all: number; confirmed: number; pending: number; cancelled: number }> {
    const response = await api.get(`${BASE_URL}/${eventId}/emails/recipients-count`);
    return response.data.data;
  },

  /**
   * Send a bulk email to event registrants.
   */
  async sendBulkEmail(eventId: string, payload: {
    subject: string;
    body: string;
    filter?: string;
    replyTo?: string;
    testEmail?: string;
    registrationIds?: string[];
    scheduledAt?: string; // ISO date string — if set, schedules the send
  }): Promise<{ success: boolean; sent: number; failed: number; errors: string[]; scheduled?: boolean; scheduledAt?: string; logId?: string; recipientCount?: number; queued?: boolean; jobId?: string }> {
    const response = await api.post(`${BASE_URL}/${eventId}/emails/send`, payload);
    return response.data.data;
  },

  /**
   * Get aggregated email analytics for an event.
   */
  async getEmailAnalytics(eventId: string): Promise<{
    totalCampaigns: number;
    scheduledPending: number;
    totalRecipients: number;
    totalSent: number;
    totalFailed: number;
    totalOpened: number;
    totalDelivered: number;
    deliveryRate: number;
    openRate: number;
    recentCampaigns: Array<{
      id: string;
      subject: string;
      sentAt: string;
      recipientCount: number;
      sentCount: number;
      failedCount: number;
      status: string;
    }>;
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/emails/analytics`);
    return response.data.data;
  },

  /**
   * Get email credit balance for an event.
   */
  async getEmailCredits(eventId: string): Promise<{
    total: number;
    used: number;
    available: number;
    creditsPerRegistration: number;
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/emails/credits`);
    return response.data.data;
  },

  /**
   * Cancel a pending scheduled email.
   */
  async cancelScheduledEmail(eventId: string, logId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${eventId}/emails/scheduled/${logId}`);
  },

  /**
   * Get email sending history for an event.
   */
  async getEmailHistory(eventId: string, page = 1, limit = 20): Promise<{
    logs: Array<{
      id: string;
      subject: string;
      body: string;
      filter: string;
      recipientCount: number;
      sentCount: number;
      failedCount: number;
      status: string;
      replyTo: string | null;
      errors: string[];
      sentAt: string;
      sentByName: string;
      sentByEmail: string | null;
      scheduledAt?: string | null;
      // Aggregated stats
      deliveredCount: number;
      bouncedCount: number;
      openedCount: number;
      notOpenedCount: number;
      // Per-recipient details
      recipientDetails: Array<{
        id: string;
        email: string;
        name: string;
        status: string;
        failureReason: string | null;
        openCount: number;
        firstOpenedAt: string | null;
        lastOpenedAt: string | null;
        deliveredAt: string | null;
        failedAt: string | null;
      }>;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/emails/history?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  // =====================================
    // Coupon Methods
  // ==============================
    /**
   * List coupons for an event (organizer)
   */
  async listCoupons(eventId: string): Promise<EventCoupon[]> {
    const response = await api.get(`${BASE_URL}/${eventId}/coupons`);
    return response.data.data;
  },

  /**
   * Create a coupon for an event (organizer)
   */
  async createCoupon(eventId: string, data: CouponFormData): Promise<EventCoupon> {
    const response = await api.post(`${BASE_URL}/${eventId}/coupons`, data);
    return response.data.data;
  },

  /**
   * Update a coupon (organizer)
   */
  async updateCoupon(eventId: string, couponId: string, data: Partial<CouponFormData>): Promise<EventCoupon> {
    const response = await api.patch(`${BASE_URL}/${eventId}/coupons/${couponId}`, data);
    return response.data.data;
  },

  /**
   * Delete a coupon (organizer)
   */
  async deleteCoupon(eventId: string, couponId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${eventId}/coupons/${couponId}`);
  },

  /**
   * Validate / preview a coupon code (user)
   * Does NOT consume a usage slot — just previews discount.
   */
  async validateCoupon(
    eventId: string,
    code: string,
    amount?: number
  ): Promise<CouponValidationResult> {
    const response = await api.post(`${BASE_URL}/${eventId}/coupons/validate`, { code, amount });
    return response.data.data;
  },

  // ════════════════════════════════════════════════════════════════
  //  Post Event Reports
  // ════════════════════════════════════════════════════════════════

  async uploadPostEventReport(eventId: string, file: File): Promise<EventPostReportSummary> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`${BASE_URL}/${eventId}/post-reports`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data.data;
  },

  async getPostEventReports(eventId: string): Promise<EventPostReportListResponse> {
    const response = await api.get(`${BASE_URL}/${eventId}/post-reports`);
    return response.data.data;
  },

  async downloadPostEventReport(eventId: string, reportId: string): Promise<Blob> {
    const response = await api.get(`${BASE_URL}/${eventId}/post-reports/${reportId}/download`, {
      responseType: 'blob',
    });

    return response.data;
  },

  async previewPostEventReport(eventId: string, reportId: string): Promise<Blob> {
    const response = await api.get(`${BASE_URL}/${eventId}/post-reports/${reportId}/preview`, {
      responseType: 'blob',
    });

    return response.data;
  },

  // ════════════════════════════════════════════════════════════════
  //  Certificate Management
  // ════════════════════════════════════════════════════════════════

  /**
   * Upload a certificate template (image file + text config).
   */
  async uploadCertificateTemplate(eventId: string, formData: FormData): Promise<{
    id: string;
    name: string;
    certificateType: string;
    templateUrl: string | null;
    title: string;
    content: string;
    textColor: string;
  }> {
    const response = await api.post(`${BASE_URL}/${eventId}/certificates/templates`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  /**
   * List certificate templates for an event.
   */
  async getCertificateTemplates(eventId: string): Promise<Array<{
    id: string;
    name: string;
    certificateType: string;
    templateUrl: string | null;
    title: string;
    content: string;
    textColor: string;
    isDefault: boolean;
    createdAt: string;
  }>> {
    const response = await api.get(`${BASE_URL}/${eventId}/certificates/templates`);
    return response.data.data;
  },

  /**
   * Update a certificate template's text configuration.
   */
  async updateCertificateTemplate(eventId: string, templateId: string, data: {
    title?: string;
    content?: string;
    textColor?: string;
    name?: string;
    certificateType?: string;
  }): Promise<void> {
    await api.patch(`${BASE_URL}/${eventId}/certificates/templates/${templateId}`, data);
  },

  /**
   * Delete a certificate template.
   */
  async deleteCertificateTemplate(eventId: string, templateId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${eventId}/certificates/templates/${templateId}`);
  },

  /**
   * Get recipient counts per registration status for the certificate slider.
   */
  async getCertificateRecipientsCount(eventId: string): Promise<{
    all: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/certificates/recipients-count`);
    return response.data.data;
  },

  /**
   * Send certificates to event registrants.
   */
  async sendCertificates(eventId: string, payload: {
    templateId: string;
    canvasWidth: number;
    textFields: Array<{
      text: string;
      x: number;
      y: number;
      fontSize: number;
      color: string;
      fontWeight: string;
      textAlign: string;
    }>;
    imageFields?: Array<{ s3Key: string; x: number; y: number; width: number }>;
    filter?: string;
    registrationIds?: string[];
    duplicateAction?: 'skip' | 'resend';
  }): Promise<{
    success?: boolean;
    sent?: number;
    failed?: number;
    recipientCount?: number;
    skippedCount?: number;
    logId?: string;
    requiresConfirmation?: boolean;
    duplicateCount?: number;
    totalRecipients?: number;
    newRecipients?: number;
  }> {
    const response = await api.post(`${BASE_URL}/${eventId}/certificates/send`, payload);
    return response.data.data;
  },

  /**
   * Send a test certificate to any email for preview.
   */
  async sendTestCertificate(eventId: string, payload: {
    templateId: string;
    canvasWidth: number;
    textFields: Array<{
      text: string;
      x: number;
      y: number;
      fontSize: number;
      color: string;
      fontWeight: string;
      textAlign: string;
    }>;
    imageFields?: Array<{ s3Key: string; x: number; y: number; width: number }>;
    testEmail: string;
  }): Promise<{ sent: number }> {
    const response = await api.post(`${BASE_URL}/${eventId}/certificates/test-send`, payload);
    return response.data.data;
  },

  /**
   * Get certificate sending history for an event.
   */
  async getCertificateHistory(eventId: string, page = 1, limit = 20): Promise<{
    logs: Array<{
      id: string;
      certificateType: string;
      title: string;
      filter: string;
      recipientCount: number;
      sentCount: number;
      failedCount: number;
      status: string;
      errors: string[];
      sentAt: string;
      sentByName: string;
      sentByEmail: string | null;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await api.get(`${BASE_URL}/${eventId}/certificates/history`, { params: { page, limit } });
    return response.data.data;
  },

  /**
   * Get the authenticated user's certificates.
   */
  async getMyCertificates(page = 1, limit = 20): Promise<{
    certificates: Array<{
      id: string;
      certificateTitle: string;
      certificateType: string;
      eventName: string;
      eventId: string;
      holderName: string;
      issueDate: string;
      verificationCode: string;
      hasDownload: boolean;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const response = await api.get(`${BASE_URL}/certificates/my`, { params: { page, limit } });
    return response.data.data;
  },

  /**
   * Download a certificate PDF (returns presigned URL).
   */
  async downloadCertificate(verificationCode: string): Promise<{ downloadUrl: string }> {
    const response = await api.get(`${BASE_URL}/certificates/download/${verificationCode}`);
    return response.data.data;
  },

  // =====================================
    // Rounds
  // ==============================
    async getRounds(eventId: string): Promise<EventRound[]> {
    const response = await api.get(`${BASE_URL}/${eventId}/rounds`);
    return response.data?.data ?? response.data;
  },

  async createRound(eventId: string, data: RoundFormData): Promise<EventRound> {
    const response = await api.post(`${BASE_URL}/${eventId}/rounds`, data);
    return response.data?.data ?? response.data;
  },

  async updateRound(eventId: string, roundId: string, data: Partial<RoundFormData>): Promise<EventRound> {
    const response = await api.patch(`${BASE_URL}/${eventId}/rounds/${roundId}`, data);
    return response.data?.data ?? response.data;
  },

  async deleteRound(eventId: string, roundId: string): Promise<void> {
    await api.delete(`${BASE_URL}/${eventId}/rounds/${roundId}`);
  },

  async reorderRounds(eventId: string, roundOrders: { id: string; sortOrder: number }[]): Promise<EventRound[]> {
    const response = await api.patch(`${BASE_URL}/${eventId}/rounds/reorder`, { roundOrders });
    return response.data?.data ?? response.data;
  },
};
