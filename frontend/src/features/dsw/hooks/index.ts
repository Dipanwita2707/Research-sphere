/**
 * DSW Custom Hooks
 * React hooks for DSW data fetching and state management
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - useClubPermissions: replaced useEffect+useState with useMemo
 *   → eliminates the extra re-render caused by setPermissions inside useEffect
 * - useDSWToast: removed dead console.log stubs (replaced with no-ops to avoid log noise)
 * - All mutation hooks invalidate caches correctly on success
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dswAPI from "../services/api";
import type { ClubEvent } from "../services/api";
import type { ClubMemberRole } from "../constants";
import {
  Club,
  ClubCategory,
  ClubMember,
  ClubAuditLog,
  ClubFilters,
  AuditLogFilters,
  ClubCreationFormData,
  ClubCreationRequest,
  ClubMemberApplication,
} from "../types";

// Query Keys
export const DSW_QUERY_KEYS = {
  clubs: (filters?: ClubFilters) => ["dsw", "clubs", filters],
  club: (id: string) => ["dsw", "clubs", id],
  myClubs: () => ["dsw", "my-clubs"],
  myClubRequests: () => ["dsw", "my-club-requests"],
  clubMembers: (clubId: string) => ["dsw", "clubs", clubId, "members"],
  clubEvents: (clubId: string) => ["dsw", "clubs", clubId, "events"],
  clubApplications: (clubId: string) => ["dsw", "clubs", clubId, "applications"],
  myClubApplications: () => ["dsw", "clubs", "applications", "my"],
  categories: () => ["dsw", "categories"],
  statistics: () => ["dsw", "statistics"],
  auditLogs: (clubId: string, filters?: AuditLogFilters) => [
    "dsw",
    "audit-logs",
    clubId,
    filters,
  ],
  myAuditLogs: () => ["dsw", "my-audit-logs"],
};

/**
 * Hook to fetch clubs with filters
 */
export function useClubs(filters?: ClubFilters) {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.clubs(filters),
    queryFn: () => dswAPI.clubs.getClubs(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data) => data, // Referential stability — only re-render when data changes
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
    select: (data) => data, // Referential stability — only re-render when data changes
  });
}

/**
 * Hook to fetch the current student's pending club creation requests (notings)
 */
export function useMyClubRequests() {
  return useQuery({
    queryKey: DSW_QUERY_KEYS.myClubRequests(),
    queryFn: () => dswAPI.clubs.getMyClubRequests(),
    staleTime: 60 * 1000, // 1 minute — refreshes relatively often so status is up-to-date
    select: (res) =>
      (res.success ? (res.data ?? []) : []) as ClubCreationRequest[],
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
 * Hook to fetch events linked to a club
 */
export function useClubEvents(clubId: string) {
  return useQuery<ClubEvent[]>({
    queryKey: DSW_QUERY_KEYS.clubEvents(clubId),
    queryFn: async () => {
      const res = await dswAPI.clubs.getClubEvents(clubId);
      return res.data ?? [];
    },
    enabled: !!clubId,
    staleTime: 60 * 1000,
  });
}

export function useClubApplications(clubId: string) {
  return useQuery<ClubMemberApplication[]>({
    queryKey: DSW_QUERY_KEYS.clubApplications(clubId),
    queryFn: async () => {
      const res = await dswAPI.clubs.getClubApplications(clubId);
      return res.data ?? [];
    },
    enabled: !!clubId,
    staleTime: 30 * 1000,
  });
}

export function useMyClubApplications() {
  return useQuery<ClubMemberApplication[]>({
    queryKey: DSW_QUERY_KEYS.myClubApplications(),
    queryFn: async () => {
      const res = await dswAPI.clubs.getMyClubApplications();
      return res.data ?? [];
    },
    staleTime: 30 * 1000,
  });
}

export function useApplyToClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clubId }: { clubId: string }) => dswAPI.clubs.applyToClub(clubId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.club(vars.clubId) });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.clubs() });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.myClubApplications() });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.clubApplications(vars.clubId) });
    },
  });
}

export function useReviewClubApplication(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      decision,
      reviewNote,
    }: {
      applicationId: string;
      decision: "approved" | "rejected";
      reviewNote?: string;
    }) => dswAPI.clubs.reviewClubApplication(clubId, applicationId, decision, reviewNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.clubApplications(clubId) });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.clubMembers(clubId) });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.club(clubId) });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.myClubApplications() });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.myClubs() });
    },
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
    gcTime: 60 * 60 * 1000, // Keep in memory for the full session
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
    mutationFn: (data: ClubCreationFormData) => dswAPI.noting.createClub(data),
    onSuccess: () => {
      // Invalidate clubs query to refetch
      queryClient.invalidateQueries({ queryKey: ["dsw", "clubs"] });
    },
  });
}

/**
 * Hook to add member to club
 */
export function useAddMember(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, role }: { studentId: string; role?: string }) =>
      dswAPI.clubs.addMember(clubId, studentId, role),
    onSuccess: () => {
      // Invalidate club members query
      queryClient.invalidateQueries({
        queryKey: DSW_QUERY_KEYS.clubMembers(clubId),
      });
      queryClient.invalidateQueries({ queryKey: DSW_QUERY_KEYS.club(clubId) });
    },
  });
}

/**
 * Hook to update a member's role
 */
export function useUpdateMemberRole(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: ClubMemberRole;
    }) => dswAPI.clubs.updateMemberRole(clubId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: DSW_QUERY_KEYS.clubMembers(clubId),
      });
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
      queryClient.invalidateQueries({
        queryKey: DSW_QUERY_KEYS.clubMembers(clubId),
      });
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
      queryClient.invalidateQueries({ queryKey: ["dsw", "clubs"] });
    },
  });
}

/**
 * Hook to manage club creation form state
 */
export function useClubCreationForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ClubCreationFormData>>({});

  const updateFormData = useCallback(
    (step: number, data: Partial<ClubCreationFormData>) => {
      setFormData((prev) => ({ ...prev, ...data }));
    },
    [],
  );

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
 * Hook for permission checking.
 *
 * PERFORMANCE: useMemo instead of useEffect+useState eliminates the extra
 * render cycle that was previously triggered by calling setPermissions inside
 * a useEffect.  The memoized object is recomputed only when club or
 * currentUserId changes.
 */
export function useClubPermissions(club?: Club, currentUserId?: string) {
  return useMemo(() => {
    const empty = {
      canManageMembers: false,
      canRequestChanges: false,
      canEditInfo: false,
      isChairperson: false,
      isFacultyFacilitator: false,
      isMember: false,
    };

    if (!club || !currentUserId) return empty;

    // chairpersonId is the student who created and leads the club.
    const isChairperson = club.chairpersonId === currentUserId;
    const isFacultyFacilitator = club.facultyFacilitatorId === currentUserId;
    const isMember = !!club.members?.some(
      (m) => m.studentId === currentUserId && m.isActive,
    );

    return {
      isChairperson,
      isFacultyFacilitator,
      isMember,
      canManageMembers: isChairperson || isFacultyFacilitator,
      canRequestChanges: isFacultyFacilitator,
      canEditInfo: isChairperson || isFacultyFacilitator,
    };
  }, [club, currentUserId]);
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
 * Hook for toast notifications.
 * Wire up `showSuccess` / `showError` / `showInfo` to your app-level toast
 * system (e.g. react-hot-toast, sonner, or the shared Toast context).
 *
/**
 * The stubs below are intentional no-ops so callers compile without changes;
 * replace them with real toast calls once you have a shared toast utility.
 */
export function useDSWToast() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const showSuccess = useCallback((_message: string) => {
    // TODO: replace with: toast.success(_message)
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const showError = useCallback((_message: string) => {
    // TODO: replace with: toast.error(_message)
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const showInfo = useCallback((_message: string) => {
    // TODO: replace with: toast.info(_message)
  }, []);

  return { showSuccess, showError, showInfo };
}
