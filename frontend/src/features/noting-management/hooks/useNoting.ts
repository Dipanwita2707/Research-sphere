/**
 * Noting Management React Query Hooks
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - useMyCopies: replaces manual fetch-in-useEffect with TanStack Query
 *   → automatic caching, deduplication, background refetch, no loading flicker on tab re-visit
 * - useNotingConfig: 24-hour staleTime (config is static)
 * - useMyManager: 5-minute staleTime (manager rarely changes)
 * - All hooks share a consistent NOTING_QUERY_KEYS registry for targeted invalidation
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notingService } from "../services/noting.service";
import type { NoteCopy } from "../types/noting.types";

export type NotingListParams = {
  filter?: "mine" | "pending" | "handled" | "copies";
  enabled?: boolean;
  status?: string;
  category?: string;
  search?: string;
  createdById?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  includeCounts?: boolean;
  /** Sub-filter for handled tab: 'approved' = approved+recommended, 'rejected' = rejected+not_recommended */
  handledAction?: "approved" | "rejected";
};

export const NOTING_QUERY_KEYS = {
  list: (params: NotingListParams) => ["noting", "list", params],
  detail: (id: string) => ["noting", id],
  counts: () => ["noting", "counts"],
  /** Copies assigned to the current user — keyed by page so pagination works */
  myCopies: (page?: number, limit?: number) => [
    "noting",
    "my-copies",
    { page: page ?? "all", limit: limit ?? "all" },
  ],
  config: () => ["noting", "config"],
  myManager: () => ["noting", "my-manager"],
  creatorInfo: () => ["noting", "creator-info"],
  permissions: () => ["noting", "permissions"],
  noteCopies: (noteId: string) => ["noting", "copies", noteId],
};

// ─── List ──────────────────────────────────────────────────────────────────────

/**
 * Fetch noting list with filters.
 * When includeCounts is true the response includes mine/pending/handled counts
 * for tab badges — avoids a separate /counts call.
 */
export function useNotingList(params: NotingListParams = {}) {
  const {
    filter = "mine",
    page = 1,
    limit = 20,
    search,
    status,
    category,
    startDate,
    endDate,
    includeCounts = true,
    enabled = true,
    handledAction,
  } = params;

  return useQuery({
    queryKey: NOTING_QUERY_KEYS.list(params),
    queryFn: () =>
      notingService.list({
        filter,
        page,
        limit,
        search,
        status,
        category,
        startDate,
        endDate,
        includeCounts,
        handledAction,
      }),
    // 1-minute stale time — short enough to feel fresh, long enough to
    // survive rapid tab switching without redundant requests.
    staleTime: 1 * 60 * 1000,
    enabled: enabled && filter !== "copies",
    // Keep previous page data while the next page loads (no flash of empty)
    placeholderData: (prev) => prev,
  });
}

// ─── Counts ────────────────────────────────────────────────────────────────────

/**
 * Fetch noting counts (mine, pending, handled).
 * @deprecated Counts are now bundled in useNotingList (includeCounts=true).
 *             Use that instead to avoid a separate network round-trip.
 */
export function useNotingCounts() {
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.counts(),
    queryFn: () => notingService.getCounts(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ─── Single note ───────────────────────────────────────────────────────────────

/** Fetch a single note by ID. */
export function useNote(id: string) {
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.detail(id),
    queryFn: () => notingService.getById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ─── Copies (PERFORMANCE: TanStack Query replaces manual useEffect fetch) ──────

/**
 * Fetch copies assigned to the current user.
 *
 * Previously the page used a manual async function inside useEffect which:
 *   • Had no caching — every tab switch re-fetched
 *   • Had no deduplication — rapid renders fired multiple requests
 *   • Required manual loading/error state management
 *
 * Now TanStack Query handles all of that automatically.
 *
 * @param options.page  - Optional page number for pagination (omit for all)
 * @param options.limit - Optional page size for pagination (omit for all)
 * @param options.enabled - Set false to skip the fetch (e.g. when tab is not active)
 */
export function useMyCopies(
  options: {
    page?: number;
    limit?: number;
    enabled?: boolean;
  } = {},
) {
  const { page, limit, enabled = true } = options;

  return useQuery<{
    copies: NoteCopy[];
    myManagerId: string | null;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: NOTING_QUERY_KEYS.myCopies(page, limit),
    queryFn: async () => {
      const params =
        page !== undefined && limit !== undefined ? { page, limit } : undefined;
      return notingService.getMyCopies(params);
    },
    enabled,
    // 2-minute stale time — copies change infrequently; tab re-visits feel instant
    staleTime: 2 * 60 * 1000,
    // Keep last data while refetching (prevents empty flash)
    placeholderData: (prev) => prev,
  });
}

// ─── Config (static — long staleTime) ─────────────────────────────────────────

/**
 * Fetch the noting configuration (categories, dropdown options).
 *
 * Config is completely static at runtime; we cache it for 24 hours so the
 * user only pays the network cost once per session.
 */
export function useNotingConfig() {
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.config(),
    queryFn: () => notingService.getConfig(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours — config never changes at runtime
    gcTime: 24 * 60 * 60 * 1000, // Keep in cache even when no subscribers
  });
}

// ─── My Manager ────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's direct reporting manager.
 * Cached for 5 minutes — managers rarely change within a session.
 */
export function useMyManager(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.myManager(),
    queryFn: () => notingService.getMyManager(),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ─── Creator Info ──────────────────────────────────────────────────────────────

/**
 * Fetch the current user's creator info (name, dept, school, employee ID).
 * Used when pre-filling the "create note" form header.
 * Cached for 10 minutes — profile data is stable within a session.
 */
export function useCreatorInfo(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.creatorInfo(),
    queryFn: () => notingService.getMyCreatorInfo(),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ─── Permissions ───────────────────────────────────────────────────────────────

/**
 * Fetch the current user's noting action permissions.
 * Always fetches fresh — permissions can change when admin updates roles.
 * No caching to ensure buttons always reflect current permissions.
 */
export function useNotingPermissions(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.permissions(),
    queryFn: () => notingService.getMyNotingPermissions(),
    enabled,
    staleTime: 0, // Always refetch — admin can change permissions any time
    gcTime: 30 * 1000, // Keep in garbage collection for 30s only
  });
}

// ─── Note Copies (detail page) ────────────────────────────────────────────────

/**
 * Fetch copies for a specific note (used on the detail page).
 * Replaces manual loadCopies() function that had no caching.
 */
export function useNoteCopies(
  noteId: string,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.noteCopies(noteId),
    queryFn: () => notingService.getCopies(noteId),
    enabled: enabled && !!noteId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

/** Invalidate all note-related queries after a note action. */
function invalidateNoteQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  queryClient.invalidateQueries({ queryKey: ["noting", "list"] });
  queryClient.invalidateQueries({ queryKey: NOTING_QUERY_KEYS.detail(id) });
  queryClient.invalidateQueries({ queryKey: NOTING_QUERY_KEYS.counts() });
}

/** Delete a draft note and invalidate the list + detail caches. */
export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notingService.deleteDraft(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["noting", "list"] });
      queryClient.removeQueries({ queryKey: NOTING_QUERY_KEYS.detail(id) });
    },
  });
}

/** Submit a draft note and refresh the list. */
export function useSubmitDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notingService.submitDraft(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["noting", "list"] });
      queryClient.invalidateQueries({ queryKey: NOTING_QUERY_KEYS.detail(id) });
    },
  });
}

/** Approve a pending note. */
export function useApproveNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      notingService.approve(id, remarks),
    onSuccess: (_, { id }) => {
      invalidateNoteQueries(queryClient, id);
    },
  });
}

/** Reject a pending note. */
export function useRejectNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      notingService.reject(id, remarks),
    onSuccess: (_, { id }) => {
      invalidateNoteQueries(queryClient, id);
    },
  });
}

/** Revert a note back to its creator. */
export function useRevertNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      notingService.revert(id, remarks),
    onSuccess: (_, { id }) => {
      invalidateNoteQueries(queryClient, id);
    },
  });
}

/** Forward a note to the next holder. */
export function useForwardNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { remarks: string; automated?: boolean; nextHolderId?: string };
    }) => notingService.forward(id, payload),
    onSuccess: (_, { id }) => {
      invalidateNoteQueries(queryClient, id);
    },
  });
}

/** Auto-forward a note to reporting manager. */
export function useAutoForwardNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      notingService.autoForward(id, remarks),
    onSuccess: (_, { id }) => {
      invalidateNoteQueries(queryClient, id);
    },
  });
}

/** Recommend a note. */
export function useRecommendNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      notingService.recommend(id, remarks),
    onSuccess: (_, { id }) => {
      invalidateNoteQueries(queryClient, id);
    },
  });
}

/** Not recommend a note. */
export function useNotRecommendNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      notingService.notRecommend(id, remarks),
    onSuccess: (_, { id }) => {
      invalidateNoteQueries(queryClient, id);
    },
  });
}

/** Send copies of a note to users. */
export function useSendCopy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      noteId,
      payload,
    }: {
      noteId: string;
      payload: { userIds: string[]; remarks: string };
    }) => notingService.sendCopy(noteId, payload),
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({
        queryKey: NOTING_QUERY_KEYS.noteCopies(noteId),
      });
    },
  });
}

/** Reply to an assigned copy. */
export function useReplyCopy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      copyId,
      payload,
    }: {
      copyId: string;
      payload: {
        remarks: string;
        attachments?: {
          filePath: string;
          fileName: string;
          fileDescription?: string;
        }[];
      };
    }) => notingService.replyCopy(copyId, payload),
    onSuccess: () => {
      // Invalidate all copy cache variants (page-agnostic pattern)
      queryClient.invalidateQueries({ queryKey: ["noting", "my-copies"] });
    },
  });
}

/** Forward (escalate) a copy. */
export function useForwardCopy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ copyId, remarks }: { copyId: string; remarks: string }) =>
      notingService.forwardCopy(copyId, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["noting", "my-copies"] });
    },
  });
}

/** Mark a copy chain as complete. */
export function useCompleteCopy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (copyId: string) => notingService.completeCopy(copyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["noting", "my-copies"] });
    },
  });
}
