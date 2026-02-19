/**
 * DSW API Service
 * Handles all HTTP requests to the DSW backend
 * Uses shared API instance for consistent timeout, retry, and auth handling
 */

import api from '@/shared/api/api';
import {
  Club,
  ClubCategory,
  ClubMember,
  ClubAuditLog,
  ClubCreationFormData,
  ClubFilters,
  AuditLogFilters,
  ApiResponse,
  PaginatedResponse,
  DSWStatistics,
  ClubChangeRequest,
} from '../types';
import { DSW_API_ENDPOINTS } from '../constants';

// Club API
export const clubAPI = {
  /**
   * Get all clubs with filters
   */
  getClubs: async (filters?: ClubFilters): Promise<PaginatedResponse<Club>> => {
    const response = await api.get<PaginatedResponse<Club>>(DSW_API_ENDPOINTS.CLUBS, {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get club by ID
   */
  getClubById: async (clubId: string): Promise<ApiResponse<Club>> => {
    const response = await api.get<ApiResponse<Club>>(DSW_API_ENDPOINTS.CLUB_BY_ID(clubId));
    return response.data;
  },

  /**
   * Get my clubs (where user is facilitator, vice chair, or member)
   */
  getMyClubs: async (page = 1, limit = 20): Promise<PaginatedResponse<Club>> => {
    const response = await api.get<PaginatedResponse<Club>>(DSW_API_ENDPOINTS.MY_CLUBS, {
      params: { page, limit },
    });
    return response.data;
  },

  /**
   * Update club editable fields
   */
  updateClub: async (
    clubId: string,
    updates: Partial<Pick<Club, 'proposedEmail' | 'socialMediaHandles' | 'expectedStudentStrength'>>
  ): Promise<ApiResponse<Club>> => {
    const response = await api.patch<ApiResponse<Club>>(
      DSW_API_ENDPOINTS.CLUB_BY_ID(clubId),
      updates
    );
    return response.data;
  },

  /**
   * Get club members
   */
  getClubMembers: async (clubId: string): Promise<ApiResponse<ClubMember[]>> => {
    const response = await api.get<ApiResponse<ClubMember[]>>(
      DSW_API_ENDPOINTS.CLUB_MEMBERS(clubId)
    );
    return response.data;
  },

  /**
   * Add member to club
   */
  addMember: async (clubId: string, studentId: string): Promise<ApiResponse<ClubMember>> => {
    const response = await api.post<ApiResponse<ClubMember>>(
      DSW_API_ENDPOINTS.ADD_MEMBER(clubId),
      { studentId }
    );
    return response.data;
  },

  /**
   * Remove member from club
   */
  removeMember: async (
    clubId: string,
    memberId: string,
    reason?: string
  ): Promise<ApiResponse<ClubMember>> => {
    const response = await api.delete<ApiResponse<ClubMember>>(
      DSW_API_ENDPOINTS.REMOVE_MEMBER(clubId, memberId),
      { data: { reason } }
    );
    return response.data;
  },

  /**
   * Get club audit logs
   */
  getClubAuditLogs: async (
    clubId: string,
    filters?: AuditLogFilters
  ): Promise<ApiResponse<ClubAuditLog[]>> => {
    const response = await api.get<ApiResponse<ClubAuditLog[]>>(
      DSW_API_ENDPOINTS.CLUB_AUDIT_LOGS(clubId),
      { params: filters }
    );
    return response.data;
  },
};

// Category API
export const categoryAPI = {
  /**
   * Get all categories
   */
  getCategories: async (activeOnly = true): Promise<ApiResponse<ClubCategory[]>> => {
    const response = await api.get<ApiResponse<ClubCategory[]>>(
      DSW_API_ENDPOINTS.CATEGORIES,
      {
        params: { activeOnly },
      }
    );
    return response.data;
  },

  /**
   * Get category by ID
   */
  getCategoryById: async (categoryId: string): Promise<ApiResponse<ClubCategory>> => {
    const response = await api.get<ApiResponse<ClubCategory>>(
      DSW_API_ENDPOINTS.CATEGORY_BY_ID(categoryId)
    );
    return response.data;
  },

  /**
   * Create new category (admin only)
   */
  createCategory: async (data: {
    name: string;
    description?: string;
    sortOrder?: number;
  }): Promise<ApiResponse<ClubCategory>> => {
    const response = await api.post<ApiResponse<ClubCategory>>(
      DSW_API_ENDPOINTS.CATEGORIES,
      data
    );
    return response.data;
  },

  /**
   * Update category (admin only)
   */
  updateCategory: async (
    categoryId: string,
    updates: Partial<ClubCategory>
  ): Promise<ApiResponse<ClubCategory>> => {
    const response = await api.patch<ApiResponse<ClubCategory>>(
      DSW_API_ENDPOINTS.CATEGORY_BY_ID(categoryId),
      updates
    );
    return response.data;
  },

  /**
   * Deactivate category (admin only)
   */
  deactivateCategory: async (categoryId: string): Promise<ApiResponse<ClubCategory>> => {
    const response = await api.delete<ApiResponse<ClubCategory>>(
      DSW_API_ENDPOINTS.CATEGORY_BY_ID(categoryId)
    );
    return response.data;
  },

  /**
   * Seed default categories (admin only)
   */
  seedCategories: async (): Promise<ApiResponse<ClubCategory[]>> => {
    const response = await api.post<ApiResponse<ClubCategory[]>>(
      DSW_API_ENDPOINTS.SEED_CATEGORIES
    );
    return response.data;
  },
};

// Noting Integration API
export const notingAPI = {
  /**
   * Create club (creates noting automatically, goes through approval workflow)
   * Workflow: Faculty → HOD → Dean → DSW → Higher Authority
   */
  createClub: async (
    data: ClubCreationFormData
  ): Promise<ApiResponse<{ noting: any }>> => {
    const response = await api.post<ApiResponse<any>>(
      DSW_API_ENDPOINTS.CREATE_CLUB,
      data
    );
    return response.data;
  },

  /**
   * Create club change request noting
   */
  createClubChangeRequest: async (
    clubId: string,
    data: {
      changeType: string;
      requestedChanges: Record<string, any>;
      justification: string;
    }
  ): Promise<ApiResponse<{ noting: any; changeRequest: ClubChangeRequest }>> => {
    const response = await api.post<ApiResponse<any>>(
      DSW_API_ENDPOINTS.CREATE_CHANGE_REQUEST(clubId),
      data
    );
    return response.data;
  },
};

// Statistics API
export const statisticsAPI = {
  /**
   * Get DSW statistics
   */
  getStatistics: async (): Promise<ApiResponse<DSWStatistics>> => {
    const response = await api.get<ApiResponse<DSWStatistics>>(
      DSW_API_ENDPOINTS.STATISTICS
    );
    return response.data;
  },
};

// Audit Log API
export const auditLogAPI = {
  /**
   * Get my audit logs
   */
  getMyAuditLogs: async (filters?: AuditLogFilters): Promise<ApiResponse<ClubAuditLog[]>> => {
    const response = await api.get<ApiResponse<ClubAuditLog[]>>(
      DSW_API_ENDPOINTS.MY_AUDIT_LOGS,
      { params: filters }
    );
    return response.data;
  },
};

// Health Check
export const healthAPI = {
  /**
   * Check DSW module health
   */
  checkHealth: async (): Promise<ApiResponse<{ timestamp: string }>> => {
    const response = await api.get<ApiResponse<{ timestamp: string }>>(
      DSW_API_ENDPOINTS.HEALTH
    );
    return response.data;
  },
};

// Export all APIs
export const dswAPI = {
  clubs: clubAPI,
  categories: categoryAPI,
  noting: notingAPI,
  statistics: statisticsAPI,
  auditLogs: auditLogAPI,
  health: healthAPI,
  // Convenience methods at top level
  getStatistics: statisticsAPI.getStatistics,
  getClubs: clubAPI.getClubs,
  getMyClubs: clubAPI.getMyClubs,
  getCategories: categoryAPI.getCategories,
};

export default dswAPI;
