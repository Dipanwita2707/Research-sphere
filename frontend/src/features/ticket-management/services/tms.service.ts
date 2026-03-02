import api from '@/shared/api/api';
import type {
  TmsTicket,
  TmsMasterCategory,
  CreateTicketPayload,
  RemarkPayload,
  EscalatePayload,
  ResolvePayload,
  ClosePayload,
  RatePayload,
  TicketListParams,
  AdminTicketListParams,
  TmsOverviewStats,
  TmsEmployeeStat,
  TmsCategoryStats,
  Pagination,
  CreateMasterCategoryPayload,
  CreateCategoryPayload,
  CreateSubCategoryPayload,
  UpdateCategoryPayload,
} from '../types/tms.types';

const BASE = '/tms';

// ============================================
// Ticket APIs
// ============================================
export const tmsService = {
  // Student: Create ticket
  createTicket: (payload: CreateTicketPayload) =>
    api.post(`${BASE}/tickets`, payload).then((res) => res.data),

  // Student: List my tickets
  getMyTickets: (params?: TicketListParams): Promise<{ tickets: TmsTicket[]; pagination: Pagination }> =>
    api.get(`${BASE}/tickets/my`, { params }).then((res) => ({
      tickets: res.data.data.tickets,
      pagination: res.data.data.pagination,
    })),

  // Employee: List assigned tickets
  getAssignedTickets: (params?: TicketListParams): Promise<{ tickets: TmsTicket[]; pagination: Pagination }> =>
    api.get(`${BASE}/tickets/assigned`, { params }).then((res) => ({
      tickets: res.data.data.tickets,
      pagination: res.data.data.pagination,
    })),

  // Employee: Request history
  getMyHistory: (params?: TicketListParams): Promise<{ tickets: TmsTicket[]; pagination: Pagination }> =>
    api.get(`${BASE}/tickets/history`, { params }).then((res) => ({
      tickets: res.data.data.tickets,
      pagination: res.data.data.pagination,
    })),

  // View ticket detail
  getTicketById: (id: string): Promise<TmsTicket> =>
    api.get(`${BASE}/tickets/${id}`).then((res) => res.data.data),

  // Employee: Add remark
  addRemark: (id: string, payload: RemarkPayload) =>
    api.post(`${BASE}/tickets/${id}/remark`, payload).then((res) => res.data),

  // Employee: Escalate
  escalateTicket: (id: string, payload?: EscalatePayload) =>
    api.post(`${BASE}/tickets/${id}/escalate`, payload).then((res) => res.data),

  // Employee: Resolve
  resolveTicket: (id: string, payload: ResolvePayload) =>
    api.post(`${BASE}/tickets/${id}/resolve`, payload).then((res) => res.data),

  // Employee/Admin: Close
  closeTicket: (id: string, payload?: ClosePayload) =>
    api.post(`${BASE}/tickets/${id}/close`, payload).then((res) => res.data),

  // Student: Rate ticket
  rateTicket: (id: string, payload: RatePayload) =>
    api.post(`${BASE}/tickets/${id}/rate`, payload).then((res) => res.data),

  // Upload attachment (uses shared file-upload endpoint)
  uploadAttachment: (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'tms');
      api
        .post('/file-upload/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        .then((res) => {
          if (res.data?.success && res.data?.data?.filePath) resolve(res.data.data.filePath);
          else reject(new Error(res.data?.message || 'Upload failed'));
        })
        .catch(reject);
    }),

  // ============================================
  // Category APIs
  // ============================================

  // Get active categories (for ticket form)
  getActiveCategories: (): Promise<TmsMasterCategory[]> =>
    api.get(`${BASE}/categories`).then((res) => res.data.data),

  // Admin: Get all categories
  getAllCategories: (): Promise<TmsMasterCategory[]> =>
    api.get(`${BASE}/categories/all`).then((res) => res.data.data),

  // Admin: CRUD Master Categories
  createMasterCategory: (payload: CreateMasterCategoryPayload) =>
    api.post(`${BASE}/categories/master`, payload).then((res) => res.data),
  updateMasterCategory: (id: string, payload: UpdateCategoryPayload) =>
    api.patch(`${BASE}/categories/master/${id}`, payload).then((res) => res.data),
  deleteMasterCategory: (id: string) =>
    api.delete(`${BASE}/categories/master/${id}`).then((res) => res.data),

  // Admin: CRUD Categories
  createCategory: (payload: CreateCategoryPayload) =>
    api.post(`${BASE}/categories/category`, payload).then((res) => res.data),
  updateCategory: (id: string, payload: UpdateCategoryPayload) =>
    api.patch(`${BASE}/categories/category/${id}`, payload).then((res) => res.data),
  deleteCategory: (id: string) =>
    api.delete(`${BASE}/categories/category/${id}`).then((res) => res.data),

  // Admin: CRUD Sub-Categories
  createSubCategory: (payload: CreateSubCategoryPayload) =>
    api.post(`${BASE}/categories/sub-category`, payload).then((res) => res.data),
  updateSubCategory: (id: string, payload: UpdateCategoryPayload) =>
    api.patch(`${BASE}/categories/sub-category/${id}`, payload).then((res) => res.data),
  deleteSubCategory: (id: string) =>
    api.delete(`${BASE}/categories/sub-category/${id}`).then((res) => res.data),

  // ============================================
  // Admin Analytics APIs
  // ============================================

  getOverviewAnalytics: (params?: { startDate?: string; endDate?: string }): Promise<TmsOverviewStats> =>
    api.get(`${BASE}/admin/analytics/overview`, { params }).then((res) => res.data.data),

  getEmployeeAnalytics: (params?: { startDate?: string; endDate?: string }): Promise<TmsEmployeeStat[]> =>
    api.get(`${BASE}/admin/analytics/employees`, { params }).then((res) => res.data.data),

  getCategoryAnalytics: (params?: { startDate?: string; endDate?: string }): Promise<TmsCategoryStats> =>
    api.get(`${BASE}/admin/analytics/categories`, { params }).then((res) => res.data.data),

  // Admin: List all tickets
  getAllTickets: (params?: AdminTicketListParams): Promise<{ tickets: TmsTicket[]; pagination: Pagination }> =>
    api.get(`${BASE}/admin/tickets`, { params }).then((res) => ({
      tickets: res.data.data.tickets,
      pagination: res.data.data.pagination,
    })),

  // ============================================
  // Role Handler APIs (Registrar, Dean, VC)
  // ============================================

  getRoleHandlers: () =>
    api.get(`${BASE}/role-handlers`).then((res) => res.data.data),

  upsertRoleHandler: (payload: { role: string; employeeId: string }) =>
    api.put(`${BASE}/role-handlers`, payload).then((res) => res.data),

  deleteRoleHandler: (role: string) =>
    api.delete(`${BASE}/role-handlers/${role}`).then((res) => res.data),
};
