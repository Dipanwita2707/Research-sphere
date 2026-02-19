/**
 * DSW Custom Hooks
 * React hooks for DSW data fetching and state management
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dswAPI from '../services/api';
import {
  Club,
  ClubCategory,
  ClubMember,
  ClubAuditLog,
  ClubFilters,
  AuditLogFilters,
  ClubCreationFormData,
} from '../types';

// Query Keys
export const DSW_QUERY_KEYS = {
  clubs: (filters?: ClubFilters) => ['dsw', 'clubs', filters],
  club: (id: string) => ['dsw', 'clubs', id],
  myClubs: () => ['dsw', 'my-clubs'],
  clubMembers: (clubId: string) => ['dsw', 'clubs', clubId, 'members'],
  categories: () => ['dsw', 'categories'],
  statistics: () => ['dsw', 'statistics'],
  auditLogs: (clubId: string, filters?: AuditLogFilters) => [
    'dsw',
    'audit-logs',
    clubId,
    filters,
  ],
  myAuditLogs: () => ['dsw', 'my-audit-logs'],
};

/**
 * Hook to fetch clubs with filters
 */
export function useClubs(filters?: ClubFilters) {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.clubs(filters),
    queryFn: () => dswAPI.clubs.getClubs(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single club by ID
 */
export function useClub(clubId: string) {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.club(clubId),
    queryFn: () => dswAPI.clubs.getClubById(clubId),
    enabled: !!clubId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch user's clubs
 */
export function useMyClubs() {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.myClubs(),
    queryFn: () => dswAPI.clubs.getMyClubs(),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch club members
 */
export function useClubMembers(clubId: string) {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.clubMembers(clubId),
    queryFn: () => dswAPI.clubs.getClubMembers(clubId),
    enabled: !!clubId,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to fetch categories
 */
export function useCategories(activeOnly = true) {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.categories(),
    queryFn: () => dswAPI.categories.getCategories(activeOnly),
    staleTime: 1000 * 60 * 60, // 1 hour (categories rarely change)
  });
}

/**
 * Hook to fetch statistics
 */
export function useStatistics() {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.statistics(),
    queryFn: () => dswAPI.statistics.getStatistics(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch club audit logs
 */
export function useClubAuditLogs(clubId: string, filters?: AuditLogFilters) {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.auditLogs(clubId, filters),
    queryFn: () => dswAPI.clubs.getClubAuditLogs(clubId, filters),
    enabled: !!clubId,
  });
}

/**
 * Hook to create club noting
 */
export function useCreateClubNoting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClubCreationFormData) =>
      dswAPI.noting.createClubCreationNoting(data),
    onSuccess: () => {
      // Invalidate clubs query to refetch
      queryClient.invalidateQueries({ queryKey: ['dsw', 'clubs'] });
    },
  });
}

/**
 * Hook to add member to club
 */
export function useAddMember(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (studentId: string) => dswAPI.clubs.addMember(clubId, studentId),
    onSuccess: () => {
      // Invalidate club members query
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.clubMembers(clubId) });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.club(clubId) });
    },
  });
}

/**
 * Hook to remove member from club
 */
export function useRemoveMember(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, reason }: { memberId: string; reason?: string }) =>
      dswAPI.clubs.removeMember(clubId, memberId, reason),
    onSuccess: () => {
      // Invalidate club members query
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.clubMembers(clubId) });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.club(clubId) });
    },
  });
}

/**
 * Hook to update club editable fields
 */
export function useUpdateClub(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Parameters<typeof dswAPI.clubs.updateClub>[1]) =>
      dswAPI.clubs.updateClub(clubId, updates),
    onSuccess: () => {
      // Invalidate club query
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.club(clubId) });
      queryClient.invalidateQueries({ queryKey: ['dsw', 'clubs'] });
    },
  });
}

/**
 * Hook to manage club creation form state
 */
export function useClubCreationForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ClubCreationFormData>>({});

  const updateFormData = useCallback((step: number, data: Partial<ClubCreationFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(1, Math.min(step, 6)));
  }, []);

  const resetForm = useCallback(() => {
    setCurrentStep(1);
    setFormData({});
  }, []);

  return {
    currentStep,
    formData,
    updateFormData,
    nextStep,
    previousStep,
    goToStep,
    resetForm,
  };
}

/**
 * Hook for permission checking
 */
export function useClubPermissions(club?: Club, currentUserId?: string) {
  const [permissions, setPermissions] = useState({
    canManageMembers: false,
    canRequestChanges: false,
    canEditInfo: false,
    isViceChairperson: false,
    isFacultyFacilitator: false,
    isMember: false,
  });

  useEffect(() => {
    if (!club || !currentUserId) {
      setPermissions({
        canManageMembers: false,
        canRequestChanges: false,
        canEditInfo: false,
        isViceChairperson: false,
        isFacultyFacilitator: false,
        isMember: false,
      });
      return;
    }

    const isViceChairperson = club.viceChairpersonId === currentUserId;
    const isFacultyFacilitator = club.facultyFacilitatorId === currentUserId;
    const isMember = club.members?.some(
      (m) => m.studentId === currentUserId && m.isActive
    );

    setPermissions({
      isViceChairperson,
      isFacultyFacilitator,
      isMember: !!isMember,
      canManageMembers: isViceChairperson || isFacultyFacilitator,
      canRequestChanges: isFacultyFacilitator,
      canEditInfo: isViceChairperson || isFacultyFacilitator,
    });
  }, [club, currentUserId]);

  return permissions;
}

/**
 * Hook for search and filtering
 */
export function useClubSearch() {
  const [filters, setFilters] = useState<ClubFilters>({
    page: 1,
    limit: 20,
  });

  const updateFilter = useCallback((key: keyof ClubFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filter changes
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 20,
    });
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  return {
    filters,
    updateFilter,
    clearFilters,
    setPage,
  };
}

/**
 * Hook for toast notifications (integrate with your toast system)
 */
export function useDSWToast() {
  const showSuccess = useCallback((message: string) => {
    // Integrate with your toast notification system
    console.log('SUCCESS:', message);
    // toast.success(message);
  }, []);

  const showError = useCallback((message: string) => {
    // Integrate with your toast notification system
    console.error('ERROR:', message);
    // toast.error(message);
  }, []);

  const showInfo = useCallback((message: string) => {
    console.log('INFO:', message);
    // toast.info(message);
  }, []);

  return {
    showSuccess,
    showError,
    showInfo,
  };
}
