import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tmsService } from '../services/tms.service';
import type {
  TicketListParams,
  AdminTicketListParams,
  CreateTicketPayload,
  RemarkPayload,
  EscalatePayload,
  ResolvePayload,
  ClosePayload,
  RatePayload,
  CreateMasterCategoryPayload,
  CreateCategoryPayload,
  CreateSubCategoryPayload,
  UpdateCategoryPayload,
  TmsRoleHandlerLevel,
} from '../types/tms.types';

// =====================================
  // Query Keys
// =====================================
  export const TMS_QUERY_KEYS = {
  myTickets: (params?: TicketListParams) => ['tms', 'my-tickets', params] as const,
  assignedTickets: (params?: TicketListParams) => ['tms', 'assigned-tickets', params] as const,
  history: (params?: TicketListParams) => ['tms', 'history', params] as const,
  ticket: (id: string) => ['tms', 'ticket', id] as const,
  categories: () => ['tms', 'categories'] as const,
  allCategories: () => ['tms', 'categories', 'all'] as const,
  overviewAnalytics: (params?: Record<string, string>) => ['tms', 'analytics', 'overview', params] as const,
  employeeAnalytics: (params?: Record<string, string>) => ['tms', 'analytics', 'employees', params] as const,
  categoryAnalytics: (params?: Record<string, string>) => ['tms', 'analytics', 'categories', params] as const,
  allTickets: (params?: AdminTicketListParams) => ['tms', 'admin', 'tickets', params] as const,
  roleHandlers: () => ['tms', 'role-handlers'] as const,
};

// =====================================
  // Student Hooks
// ==============================
  export function useMyTickets(params?: TicketListParams) {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.myTickets(params),
    queryFn: () => tmsService.getMyTickets(params),
    enabled: !!params,
    staleTime: 1 * 60 * 1000,
  });
}

export function useTicketDetail(id: string) {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.ticket(id),
    queryFn: () => tmsService.getTicketById(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTicketPayload) => tmsService.createTicket(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'my-tickets'] });
    },
  });
}

export function useRateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RatePayload }) =>
      tmsService.rateTicket(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TMS_QUERY_KEYS.ticket(id) });
      queryClient.invalidateQueries({ queryKey: ['tms', 'my-tickets'] });
    },
  });
}

// =====================================
  // Employee Hooks
// ==============================
  export function useAssignedTickets(params?: TicketListParams) {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.assignedTickets(params),
    queryFn: () => tmsService.getAssignedTickets(params),
    staleTime: 1 * 60 * 1000,
  });
}

export function useMyHistory(params?: TicketListParams) {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.history(params),
    queryFn: () => tmsService.getMyHistory(params),
    staleTime: 1 * 60 * 1000,
  });
}

export function useAddRemark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RemarkPayload }) =>
      tmsService.addRemark(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TMS_QUERY_KEYS.ticket(id) });
    },
  });
}

export function useEscalateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: EscalatePayload }) =>
      tmsService.escalateTicket(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TMS_QUERY_KEYS.ticket(id) });
      queryClient.invalidateQueries({ queryKey: ['tms', 'assigned-tickets'] });
    },
  });
}

export function useResolveTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ResolvePayload }) =>
      tmsService.resolveTicket(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TMS_QUERY_KEYS.ticket(id) });
      queryClient.invalidateQueries({ queryKey: ['tms', 'assigned-tickets'] });
    },
  });
}

export function useCloseTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: ClosePayload }) =>
      tmsService.closeTicket(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TMS_QUERY_KEYS.ticket(id) });
      queryClient.invalidateQueries({ queryKey: ['tms'] });
    },
  });
}

// =====================================
  // Category Hooks
// ==============================
  export function useActiveCategories() {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.categories(),
    queryFn: () => tmsService.getActiveCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllCategories() {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.allCategories(),
    queryFn: () => tmsService.getAllCategories(),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateMasterCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMasterCategoryPayload) => tmsService.createMasterCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'categories'] });
    },
  });
}

export function useUpdateMasterCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCategoryPayload }) =>
      tmsService.updateMasterCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'categories'] });
    },
  });
}

export function useDeleteMasterCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tmsService.deleteMasterCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'categories'] });
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCategoryPayload) => tmsService.createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCategoryPayload }) =>
      tmsService.updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tmsService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'categories'] });
    },
  });
}

export function useCreateSubCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSubCategoryPayload) => tmsService.createSubCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'categories'] });
    },
  });
}

export function useUpdateSubCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCategoryPayload }) =>
      tmsService.updateSubCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'categories'] });
    },
  });
}

export function useDeleteSubCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tmsService.deleteSubCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tms', 'categories'] });
    },
  });
}

// =====================================
  // Admin Analytics Hooks
// ==============================
  export function useOverviewAnalytics(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.overviewAnalytics(params),
    queryFn: () => tmsService.getOverviewAnalytics(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useEmployeeAnalytics(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.employeeAnalytics(params),
    queryFn: () => tmsService.getEmployeeAnalytics(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCategoryAnalytics(params?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.categoryAnalytics(params),
    queryFn: () => tmsService.getCategoryAnalytics(params),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAllTickets(params?: AdminTicketListParams) {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.allTickets(params),
    queryFn: () => tmsService.getAllTickets(params),
    staleTime: 1 * 60 * 1000,
  });
}

// =====================================
  // Role Handler Hooks
// ==============================
  export function useRoleHandlers() {
  return useQuery({
    queryKey: TMS_QUERY_KEYS.roleHandlers(),
    queryFn: () => tmsService.getRoleHandlers(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertRoleHandler() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { role: TmsRoleHandlerLevel; employeeId: string }) =>
      tmsService.upsertRoleHandler(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TMS_QUERY_KEYS.roleHandlers() });
    },
  });
}

export function useDeleteRoleHandler() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: string) => tmsService.deleteRoleHandler(role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TMS_QUERY_KEYS.roleHandlers() });
    },
  });
}
