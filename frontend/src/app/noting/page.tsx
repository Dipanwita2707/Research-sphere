"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  FileText,
  Plus,
  Inbox,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  History,
  Pencil,
  Search,
  X,
  Filter,
  RotateCcw,
  Copy,
  AlertTriangle,
  Briefcase,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  useNotingList,
  useNotingTabSummary,
  useDeleteDraft,
  useMyCopies,
  useNotingPermissions,
  NOTING_QUERY_KEYS,
} from "@/features/noting-management/hooks/useNoting";
import { notingService } from "@/features/noting-management/services/noting.service";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Note,
  NoteCopy,
} from "@/features/noting-management/types/noting.types";
import { useToast } from "@/shared/ui-components/Toast";
import { useAuthStore } from "@/shared/auth/authStore";
import { useNotingDraftStore } from "@/features/noting-management/stores/notingDraftStore";

import { getErrorMessage } from "@/shared/utils/errorHandler";
import { useDebounce } from "@/shared/hooks/useDebounce";
import {
  STATUS_CONFIG,
  MY_ACTION_CONFIG,
  PAGE_SIZE,
} from "@/features/noting-management/constants";
import { CardSkeleton, Skeleton } from "@/components/skeletons";
import { NotingCardShimmer } from "@/components/shimmer";

function getDisplayName(note: Note): string {
  const c = note.createdBy;
  if (c?.employeeDetails?.displayName) return c.employeeDetails.displayName;
  if (c?.employeeDetails?.firstName || c?.employeeDetails?.lastName) {
    return [c.employeeDetails.firstName, c.employeeDetails.lastName]
      .filter(Boolean)
      .join(" ");
  }
  if (c?.studentLogin?.displayName) return c.studentLogin.displayName;
  return c?.uid ?? "—";
}

const stripHtml = (html: string) => {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
};

const NOTE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "reverted", label: "Reverted" },
] as const;

const COPY_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "replied", label: "Replied" },
  { value: "forwarded", label: "Forwarded" },
  { value: "completed", label: "Completed" },
] as const;

const CATEGORY_OPTIONS = [
  { value: "academic", label: "Academic" },
  { value: "administrative", label: "Administrative" },
] as const;

export default function NotingListPage() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [, startTransition] = useTransition();

  // ── Student access check (computed early to disable queries) ──────────────
  // Noting is blocked for ALL students, including club chairpersons
  const isStudent = !!user && (user.role?.name === "student" || user.userType === "student");
  const roleName = user?.role?.name || user?.userType || "";
  const { data: notingPerms, isLoading: permsLoading } = useNotingPermissions();
  const canViewAdminDashboard = roleName === "admin" || roleName === "superadmin";
  const studentHasAccess = !isStudent;

  // ── URL is the single source of truth ────────────────────────────────────
  // Read directly from searchParams — no useState mirrors, no sync useEffect.
  const VALID_FILTERS = ["mine", "pending", "handled_approved", "handled_rejected", "copies"] as const;
  const VALID_COPIES_FILTERS = ["all", "my_work", "complaints"] as const;

  const rawTab = searchParams.get("tab") ?? "mine";
  const filter = VALID_FILTERS.includes(rawTab as any)
    ? (rawTab as "mine" | "pending" | "handled_approved" | "handled_rejected" | "copies")
    : "mine";

  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const status = searchParams.get("status") ?? "";
  const category = searchParams.get("category") ?? "";
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  const rawCopiesFilter = searchParams.get("copies") ?? "all";
  const copiesFilter = VALID_COPIES_FILTERS.includes(rawCopiesFilter as any)
    ? (rawCopiesFilter as "all" | "my_work" | "complaints")
    : "all";

  const tabStatusOptions = {
    mine: NOTE_STATUS_OPTIONS,
    pending: [],
    handled_approved: [],
    handled_rejected: [],
    copies: COPY_STATUS_OPTIONS,
  } as const;
  const currentStatusOptions = tabStatusOptions[filter];
  const currentStatusValues: string[] = currentStatusOptions.map((option) => option.value);
  const currentSearchPlaceholder =
    filter === "copies"
      ? "Search by Note ID, sender, or description..."
      : "Search by Note ID or description...";

  const hasActiveFilters = !!(status || category || startDate || endDate);
  const [filterPanelOpenByUser, setFilterPanelOpenByUser] = useState(false);
  const isFilterPanelOpen = hasActiveFilters || filterPanelOpenByUser;

  // ── Search input: local state, debounced before hitting URL/query ─────────
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("search") ?? "",
  );

  // ── Single URL-param updater ──────────────────────────────────────────────
  // Wrapping router.replace in startTransition marks the navigation as
  // non-urgent so React can keep the current UI interactive while the new
  // search-params take effect — no extra useState needed.
  const setParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      startTransition(() => {
        const next = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, val]) => {
          if (val === undefined || val === "") {
            next.delete(key);
          } else {
            next.set(key, val);
          }
        });
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const debouncedSearch = useDebounce(searchInput, {
    delay: 350,
    onSettle: (v) => {
      const str = (v as string) || "";
      const current = searchParams.get("search") ?? "";
      if (str === current) return;
      setParams({ search: str || undefined, page: undefined });
    },
  });

  useEffect(() => {
    if (!status) return;
    if (currentStatusValues.includes(status)) return;
    setParams({ status: undefined, page: undefined });
  }, [currentStatusValues, setParams, status]);

  // Convenience setters — each resets page to 1 on user-driven filter changes
  const setFilter = useCallback(
    (val: typeof filter) => {
      const nextStatusValues: string[] = tabStatusOptions[val].map((option) => option.value);
      setParams({
        tab: val === "mine" ? undefined : val,
        page: undefined,
        copies: val === "copies" && copiesFilter !== "all" ? copiesFilter : undefined,
        status:
          status && nextStatusValues.includes(status)
            ? status
            : undefined,
      });
    },
    [copiesFilter, setParams, status, tabStatusOptions],
  );
  const setPage = useCallback(
    (val: number | ((prev: number) => number)) => {
      const next = typeof val === "function" ? val(page) : val;
      setParams({ page: next === 1 ? undefined : String(next) });
    },
    [setParams, page],
  );
  const setStatus = useCallback(
    (val: string) => setParams({ status: val || undefined, page: undefined }),
    [setParams],
  );
  const setCategoryFilter = useCallback(
    (val: string) => setParams({ category: val || undefined, page: undefined }),
    [setParams],
  );
  const setStartDate = useCallback(
    (val: string) =>
      setParams({ startDate: val || undefined, page: undefined }),
    [setParams],
  );
  const setEndDate = useCallback(
    (val: string) => setParams({ endDate: val || undefined, page: undefined }),
    [setParams],
  );
  const setCopiesFilter = useCallback(
    (val: typeof copiesFilter) =>
      setParams({ copies: val === "all" ? undefined : val, page: undefined }),
    [setParams],
  );

  // ── Notes list query ──────────────────────────────────────────────────────
  // Map UI filter keys to API filter + handledAction params
  const apiFilter = (filter === "handled_approved" || filter === "handled_rejected") ? "handled" : filter;
  const apiHandledAction = filter === "handled_approved" ? "approved" : filter === "handled_rejected" ? "rejected" : undefined;

  const listParams = {
    filter: apiFilter as "mine" | "pending" | "handled" | "copies",
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
    category: category || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    handledAction: apiHandledAction as 'approved' | 'rejected' | undefined,
    // disable list query when on Copies tab
    // disable list query when on Copies tab OR for unauthorized students
    enabled: filter !== "copies" && studentHasAccess,
  };

  const { data: listResult, isLoading: listLoading } =
    useNotingList(listParams);
  const { data: tabSummary } = useNotingTabSummary({ enabled: studentHasAccess });
  const deleteMutation = useDeleteDraft();

  const notes = listResult?.data ?? [];
  const listPagination = listResult?.pagination;
  const counts = listResult?.counts ?? { mine: 0, pending: 0, handled: 0 };

  // ── Copies query (TanStack Query replaces manual useEffect fetch) ─────────
  // Only enabled when the Copies tab is active AND the user is authenticated.
  // TanStack Query caches the result so tab re-visits are instant.
  const {
    data: copiesData,
    isLoading: copiesLoading,
    error: copiesError,
  } = useMyCopies({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: filter === "copies" && currentStatusValues.includes(status) ? status : undefined,
    category: category || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    enabled: filter === "copies" && !!user && studentHasAccess,
  });
  const myCopies: NoteCopy[] = copiesData?.copies ?? [];
  const myManagerId = copiesData?.myManagerId ?? null;
  const copiesPagination = copiesData?.pagination;
  const pendingPreviewIds = tabSummary?.pendingPreviewIds ?? [];
  const copyPreviewIds = tabSummary?.copyPreviewIds ?? [];

  const [seenPendingIds, setSeenPendingIds] = useState<string[]>([]);
  const [seenCopyIds, setSeenCopyIds] = useState<string[]>([]);

  const persistSeenIds = useCallback((key: string, ids: string[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(ids));
  }, []);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;
    try {
      const pendingRaw = window.localStorage.getItem(`noting:pending-seen:${user.id}`);
      const copyRaw = window.localStorage.getItem(`noting:copy-seen:${user.id}`);
      setSeenPendingIds(pendingRaw ? JSON.parse(pendingRaw) : []);
      setSeenCopyIds(copyRaw ? JSON.parse(copyRaw) : []);
    } catch {
      setSeenPendingIds([]);
      setSeenCopyIds([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (filter !== "pending" || !user?.id || pendingPreviewIds.length === 0) return;
    setSeenPendingIds((prev) => {
      const next = Array.from(new Set([...prev, ...pendingPreviewIds]));
      persistSeenIds(`noting:pending-seen:${user.id}`, next);
      return next;
    });
  }, [filter, pendingPreviewIds, persistSeenIds, user?.id]);

  useEffect(() => {
    if (filter !== "copies" || !user?.id || copyPreviewIds.length === 0) return;
    setSeenCopyIds((prev) => {
      const next = Array.from(new Set([...prev, ...copyPreviewIds]));
      persistSeenIds(`noting:copy-seen:${user.id}`, next);
      return next;
    });
  }, [copyPreviewIds, filter, persistSeenIds, user?.id]);

  const pendingNewCount = useMemo(
    () => pendingPreviewIds.filter((id) => !seenPendingIds.includes(id)).length,
    [pendingPreviewIds, seenPendingIds],
  );
  const copiesNewCount = useMemo(
    () => copyPreviewIds.filter((id) => !seenCopyIds.includes(id)).length,
    [copyPreviewIds, seenCopyIds],
  );

  const pagination =
    filter === "copies"
      ? (copiesPagination ?? {
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0,
      })
      : (listPagination ?? {
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0,
      });

  const isLoading = listLoading || (filter === "copies" && copiesLoading);

  // Show error toast for copies fetch failures (once per unique error)
  const lastCopiesErrRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (copiesError) {
      const msg = getErrorMessage(copiesError);
      if (lastCopiesErrRef.current !== msg) {
        lastCopiesErrRef.current = msg;
        toast({ type: "error", message: msg || "Failed to load copies." });
      }
    } else {
      lastCopiesErrRef.current = null;
    }
  }, [copiesError, toast]);

  // Block ALL students from accessing noting system
  useEffect(() => {
    if (isStudent) {
      toast({
        type: "error",
        message: "Students are not allowed to access the noting system",
      });
      router.push("/dashboard");
    }
  }, [isStudent, router, toast]);


  const handleDeleteDraft = useCallback(
    (e: React.MouseEvent, note: Note) => {
      e.preventDefault();
      e.stopPropagation();

      const approverActions =
        note.history?.filter((h) => h.performedById !== note.createdById) || [];
      if (approverActions.length > 0) {
        toast({
          type: "error",
          message: "Cannot delete note after an approver has taken action",
        });
        return;
      }

      if (!window.confirm("Delete this note? This cannot be undone.")) return;

      deleteMutation.mutate(note.id, {
        onSuccess: () => {
          toast({ type: "success", message: "Note deleted" });
        },
        onError: (err) => {
          toast({ type: "error", message: getErrorMessage(err) });
        },
      });
    },
    [deleteMutation, toast],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({
      search: searchInput.trim() || undefined,
      page: undefined,
    });
  };

  const resetFilters = useCallback(() => {
    setSearchInput("");
    setFilterPanelOpenByUser(false);
    setParams({
      search: undefined,
      status: undefined,
      category: undefined,
      startDate: undefined,
      endDate: undefined,
      copies: undefined,
      page: undefined,
    });
  }, [setParams]);

  // ── Memoized tab definitions (avoids re-creating array every render) ──────
  const TABS = useMemo(
    () => [
      {
        key: "mine" as const,
        label: "My Notes",
        desc: "Notes created by you",
        icon: Send,
        count: tabSummary?.mine ?? counts.mine,
      },
      {
        key: "pending" as const,
        label: "Pending for Me",
        desc: "Awaiting your review",
        icon: Inbox,
        count: tabSummary?.pending ?? counts.pending,
        newCount: pendingNewCount,
      },
      {
        key: "handled_approved" as const,
        label: "Approved / Recommended",
        desc: "Notes you approved or recommended",
        icon: CheckCircle,
        count: tabSummary?.handledApproved ?? 0,
      },
      {
        key: "handled_rejected" as const,
        label: "Rejected / Not Recommended",
        desc: "Notes you rejected or did not recommend",
        icon: XCircle,
        count: tabSummary?.handledRejected ?? 0,
      },
      {
        key: "copies" as const,
        label: "Copies for Me",
        desc: "Copies assigned to you",
        icon: Copy,
        count: tabSummary?.copies ?? copiesPagination?.total ?? 0,
        newCount: copiesNewCount,
      },
    ],
    [
      copiesNewCount,
      copiesPagination?.total,
      counts.mine,
      counts.pending,
      pendingNewCount,
      tabSummary?.copies,
      tabSummary?.handledApproved,
      tabSummary?.handledRejected,
      tabSummary?.mine,
      tabSummary?.pending,
    ],
  );

  // ── Memoized copies filtering (avoids re-filtering on every render) ───────
  const currentUserId = user?.id;

  const isMyWork = useCallback(
    (c: NoteCopy) => {
      const rootAssignee = (c as any).rootCopy?.assignedToId;
      if (!rootAssignee) return true;
      return rootAssignee === currentUserId;
    },
    [currentUserId],
  );

  const filteredCopies = useMemo(() => {
    if (filter !== "copies") return [];
    if (copiesFilter === "my_work") return myCopies.filter(isMyWork);
    if (copiesFilter === "complaints")
      return myCopies.filter((c) => !isMyWork(c));
    return myCopies;
  }, [filter, copiesFilter, myCopies, isMyWork]);

  // Memoize sub-filter counts to avoid redundant array scans on every render
  const myWorkCount = useMemo(
    () => myCopies.filter(isMyWork).length,
    [myCopies, isMyWork],
  );
  const complaintsCount = useMemo(
    () => myCopies.filter((c) => !isMyWork(c)).length,
    [myCopies, isMyWork],
  );

  // ── Student access gate (after all hooks) ─────────────────────────────────
  // While permissions are loading for students, show skeleton — page never renders.
  if (isStudent && (permsLoading || !notingPerms)) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  // If student was checked and has no access, don't render (redirect is in progress)
  if (isStudent && !notingPerms?.noting_create) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page header — TMS-style */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#011f4b] to-[#005b96] shadow-md">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#011f4b] dark:text-white">
                  Noting &amp; Approval System
                </h1>
                <p className="mt-0.5 text-sm text-[#6497b1] dark:text-gray-400">
                  Create, track, and manage approval requests
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {canViewAdminDashboard && (
                <Link
                  href="/noting/admin"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#b3cde0]/60 bg-white px-4 py-2.5 text-sm font-medium text-[#03396c] transition-all hover:bg-[#f8fafc] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-auto sm:px-5"
                  style={{ boxShadow: "0 2px 8px 0 rgba(0, 91, 150, 0.06)" }}
                >
                  <History className="h-4 w-4 shrink-0" />
                  Admin Dashboard
                </Link>
              )}
              {notingPerms?.noting_create && (
                <Link
                  href="/noting/new"
                  onClick={() => useNotingDraftStore.getState().clearDraft()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#005b96] px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-[#005b96]/20 transition-all hover:bg-[#03396c] sm:w-auto sm:px-5"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Create New Note
                </Link>
              )}
            </div>
          </div>
          <div
            className="mt-3 h-0.5 rounded-full bg-gradient-to-r from-[#005b96] via-[#b3cde0] to-transparent"
            aria-hidden
          />
        </div>

        {/* Tabs — pill bar inside card (TMS-aligned) */}
        <div
          className="mb-6 rounded-2xl border border-[#b3cde0]/40 bg-white p-2 dark:border-gray-700 dark:bg-gray-800"
          style={{ boxShadow: "0 2px 12px 0 rgba(0, 91, 150, 0.06)" }}
        >
          <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-4 ${
                    isActive
                      ? "bg-[#005b96] text-white shadow-md shadow-[#005b96]/25 dark:bg-[#005b96]"
                      : "text-[#6497b1] hover:bg-[#b3cde0]/15 dark:text-gray-400 dark:hover:bg-gray-700/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-[#b3cde0]/35 text-[#03396c] dark:bg-gray-600 dark:text-gray-200"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {"newCount" in tab && !!tab.newCount && (
                    <span className="ml-0.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      New {tab.newCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & filters — TMS filter card */}
        <div
          className="mb-6 rounded-2xl border border-[#b3cde0]/40 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
          style={{ boxShadow: "0 2px 12px 0 rgba(0, 91, 150, 0.06)" }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#005b96]" />
            <span className="text-sm font-semibold text-[#03396c] dark:text-gray-200">
              Search &amp; filters
            </span>
          </div>
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6497b1]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                }}
                placeholder={currentSearchPlaceholder}
                className="w-full rounded-xl border border-[#b3cde0]/60 bg-[#f8fafc] py-2.5 pl-9 pr-9 text-sm text-[#011f4b] outline-none transition-all placeholder:text-[#6497b1]/60 focus:border-[#005b96] focus:ring-2 focus:ring-[#005b96]/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#03396c] dark:hover:text-gray-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="submit"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#005b96] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#03396c] sm:flex-none"
              >
                <Search className="h-3.5 w-3.5" />
                Search
              </button>
              <button
                type="button"
                onClick={() => setFilterPanelOpenByUser((prev) => !prev)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all sm:flex-none ${
                  isFilterPanelOpen || hasActiveFilters
                    ? "border-[#005b96]/30 bg-[#005b96]/10 text-[#005b96] dark:border-[#6497b1]/40 dark:bg-[#005b96]/20 dark:text-[#b3cde0]"
                    : "border-[#b3cde0]/60 bg-[#f8fafc] text-[#03396c] hover:bg-[#b3cde0]/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
              </button>
            </div>
          </form>

          {isFilterPanelOpen && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#b3cde0]/30 pt-4 dark:border-gray-700 md:grid-cols-2 lg:grid-cols-4">
              {currentStatusOptions.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6497b1] dark:text-gray-400">
                    {filter === "copies" ? "Copy Status" : "Status"}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-[#b3cde0]/60 bg-[#f8fafc] px-3 py-2.5 text-sm text-[#03396c] outline-none transition-all focus:border-[#005b96] focus:ring-2 focus:ring-[#005b96]/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">
                      {filter === "copies" ? "All Copy Statuses" : "All Statuses"}
                    </option>
                    {currentStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6497b1] dark:text-gray-400">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full rounded-xl border border-[#b3cde0]/60 bg-[#f8fafc] px-3 py-2.5 text-sm text-[#03396c] outline-none transition-all focus:border-[#005b96] focus:ring-2 focus:ring-[#005b96]/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">All Categories</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6497b1] dark:text-gray-400">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-[#b3cde0]/60 bg-[#f8fafc] px-3 py-2.5 text-sm text-[#03396c] outline-none transition-all focus:border-[#005b96] focus:ring-2 focus:ring-[#005b96]/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6497b1] dark:text-gray-400">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-[#b3cde0]/60 bg-[#f8fafc] px-3 py-2.5 text-sm text-[#03396c] outline-none transition-all focus:border-[#005b96] focus:ring-2 focus:ring-[#005b96]/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end md:col-span-2 lg:col-span-4">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl border border-[#005b96]/20 bg-[#005b96]/10 px-4 py-2.5 text-sm font-medium text-[#005b96] transition-all hover:bg-[#005b96]/20 dark:border-[#6497b1]/30 dark:bg-[#005b96]/15 dark:text-[#b3cde0] dark:hover:bg-[#005b96]/25"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Copies sub-filters: My Work | Complaints (only when Copies tab is active) */}
        {filter === "copies" && (
          <div
            className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-[#b3cde0]/40 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
            style={{ boxShadow: "0 2px 12px 0 rgba(0, 91, 150, 0.06)" }}
          >
            <button
              type="button"
              onClick={() => setCopiesFilter("all")}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${copiesFilter === "all"
                ? "bg-[#005b96] text-white border-[#005b96] shadow-[0_2px_8px_rgba(0,91,150,0.25)]"
                : "bg-white dark:bg-gray-800 text-[#03396c] dark:text-gray-300 border-[#b3cde0]/50 dark:border-gray-600 hover:bg-[#b3cde0]/10 dark:hover:bg-gray-700"
                }`}
            >
              All
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${copiesFilter === "all" ? "bg-white/20" : "bg-[#b3cde0]/30 dark:bg-gray-600 text-[#03396c] dark:text-gray-300"}`}
              >
                {copiesPagination?.total ?? myCopies.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCopiesFilter("my_work")}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${copiesFilter === "my_work"
                ? "bg-[#005b96] text-white border-[#005b96] shadow-[0_2px_8px_rgba(0,91,150,0.25)]"
                : "bg-white dark:bg-gray-800 text-[#03396c] dark:text-gray-300 border-[#b3cde0]/50 dark:border-gray-600 hover:bg-[#b3cde0]/10 dark:hover:bg-gray-700"
                }`}
            >
              <Briefcase className="w-4 h-4" />
              My Work
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${copiesFilter === "my_work" ? "bg-white/20" : "bg-[#b3cde0]/30 dark:bg-gray-600 text-[#03396c] dark:text-gray-300"}`}
              >
                {myWorkCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCopiesFilter("complaints")}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${copiesFilter === "complaints"
                ? "bg-[#005b96] text-white border-[#005b96] shadow-[0_2px_8px_rgba(0,91,150,0.25)]"
                : "bg-white dark:bg-gray-800 text-[#03396c] dark:text-gray-300 border-[#b3cde0]/50 dark:border-gray-600 hover:bg-[#b3cde0]/10 dark:hover:bg-gray-700"
                }`}
            >
              <AlertCircle className="w-4 h-4" />
              Complaints
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${copiesFilter === "complaints" ? "bg-white/20" : "bg-[#b3cde0]/30 dark:bg-gray-600 text-[#03396c] dark:text-gray-300"}`}
              >
                {complaintsCount}
              </span>
            </button>
          </div>
        )}

        {/* Content */}
        {filter === "copies" ? (
          /* ===== Copies For Me Tab ===== */
          copiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <NotingCardShimmer key={i} />
              ))}
            </div>
          ) : myCopies.length === 0 ? (
            <div
              className="rounded-2xl border border-[#b3cde0]/40 bg-white p-12 dark:border-gray-700 dark:bg-gray-800"
              style={{ boxShadow: "0 2px 16px 0 rgba(0, 91, 150, 0.07)" }}
            >
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b3cde0]/20 dark:bg-indigo-900/20">
                  <Copy className="h-7 w-7 text-[#6497b1] dark:text-indigo-400" />
                </div>
                <h3 className="text-base font-semibold text-[#011f4b] dark:text-white mb-1.5">
                  No Copies Assigned
                </h3>
                <p className="text-sm text-[#6497b1] dark:text-gray-400">
                  When someone sends you a copy of an approved note, it will
                  appear here.
                </p>
              </div>
            </div>
          ) : filteredCopies.length === 0 ? (
            <div
              className="rounded-2xl border border-[#b3cde0]/40 bg-white p-12 dark:border-gray-700 dark:bg-gray-800"
              style={{ boxShadow: "0 2px 16px 0 rgba(0, 91, 150, 0.07)" }}
            >
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b3cde0]/20 dark:bg-gray-700">
                  <Filter className="h-7 w-7 text-[#6497b1]" />
                </div>
                <h3 className="text-base font-semibold text-[#011f4b] dark:text-white mb-1.5">
                  No {copiesFilter === "my_work" ? "My Work" : "Complaints"}{" "}
                  Copies
                </h3>
                <p className="text-sm text-[#6497b1] dark:text-gray-400">
                  {copiesFilter === "my_work"
                    ? 'You have no work assignment copies. Try "Complaints" or "All" to see other copies.'
                    : 'You have no complaint/escalation copies. Try "My Work" or "All" to see other copies.'}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="space-y-3 overflow-hidden rounded-2xl border border-[#b3cde0]/40 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              style={{ boxShadow: "0 2px 16px 0 rgba(0, 91, 150, 0.07)" }}
            >
              {filteredCopies.map((copy) => {
                const statusColor =
                  copy.status === "completed"
                    ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                    : copy.status === "replied"
                      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                      : copy.status === "forwarded"
                        ? "text-amber-600 bg-amber-50 border-amber-200"
                        : "text-indigo-600 bg-indigo-50 border-indigo-200";
                const noteData = copy.note;
                return (
                  <div
                    key={copy.id}
                    className="overflow-hidden rounded-2xl border border-[#b3cde0]/40 bg-[#f8fafc]/80 dark:border-gray-600 dark:bg-gray-900/50"
                    style={{
                      boxShadow: "0 2px 12px 0 rgba(0, 91, 150, 0.06)",
                    }}
                  >
                    {/* Copy Card Header — click navigates to separate page */}
                    <Link
                      href={`/noting/${copy.noteId}/copy/${copy.id}`}
                      className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 hover:bg-[#b3cde0]/10 dark:hover:bg-gray-700/50 text-left transition-all duration-200"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#b3cde0]/25 dark:bg-indigo-900/30 flex items-center justify-center text-[#005b96] text-sm font-bold flex-shrink-0">
                        <Copy className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 mb-0.5">
                          <span className="font-mono text-xs font-semibold text-[#005b96] dark:text-[#6497b1]">
                            {noteData?.notingId || "N/A"}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${statusColor}`}
                          >
                            {copy.status}
                          </span>
                          {copy.escalationLevel > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-50 text-red-600 border border-red-200 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Escalation L{copy.escalationLevel}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold capitalize text-[#011f4b] dark:text-white">
                          {noteData?.category} / {noteData?.subcategory}
                        </h3>
                        <p className="mt-0.5 text-xs text-[#6497b1] dark:text-gray-400">
                          Sent by:{" "}
                          {copy.sentBy?.employeeDetails?.displayName ||
                            copy.sentBy?.uid}{" "}
                          •{" "}
                          {new Date(copy.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </p>
                        {copy.escalationLevel > 0 &&
                          (() => {
                            try {
                              const p = JSON.parse(copy.remarks);
                              if (p.type === "reassigned") {
                                const imm = p.immediateBossName;
                                const bosses: string[] =
                                  p.bossesNotified ||
                                  (p.bossNotified ? [p.bossNotified] : []);
                                const level = p.level || copy.escalationLevel;
                                if (level === 1 && imm) {
                                  return (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                      Your work has been escalated to your boss:{" "}
                                      {imm}
                                    </p>
                                  );
                                }
                                if (level >= 2) {
                                  return (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                      Escalation L{level} —{" "}
                                      {bosses.length > 0
                                        ? `${bosses.join(", ")} notified`
                                        : "Higher authority notified"}
                                    </p>
                                  );
                                }
                              }
                              if (p.type === "escalation") {
                                return (
                                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                    Escalation notice — assigned to you as
                                    supervisor
                                  </p>
                                );
                              }
                            } catch {
                              /* not JSON */
                            }
                            return (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                Escalated to Level {copy.escalationLevel}
                              </p>
                            );
                          })()}
                      </div>
                      <div className="flex-shrink-0">
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <NotingCardShimmer key={i} />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div
            className="rounded-2xl border border-[#b3cde0]/40 bg-white p-12 dark:border-gray-700 dark:bg-gray-800"
            style={{ boxShadow: "0 2px 16px 0 rgba(0, 91, 150, 0.07)" }}
          >
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b3cde0]/20 dark:bg-[#011f4b]/20">
                <FileText className="h-7 w-7 text-[#6497b1] dark:text-[#6497b1]" />
              </div>
              <h3 className="text-base font-semibold text-[#011f4b] dark:text-white mb-1.5">
                {filter === "mine" && "No Notes Created Yet"}
                {filter === "pending" && "No Pending Approvals"}
                {filter === "handled_approved" && "No Approved / Recommended Notes"}
                {filter === "handled_rejected" && "No Rejected / Not Recommended Notes"}
              </h3>
              <p className="text-sm text-[#6497b1] dark:text-gray-400 mb-5 max-w-sm mx-auto">
                {filter === "mine" &&
                  "Start by creating your first approval request."}
                {filter === "pending" &&
                  "No notes waiting for your review right now."}
                {filter === "handled_approved" &&
                  "You haven't approved or recommended any notes yet."}
                {filter === "handled_rejected" &&
                  "You haven't rejected or not-recommended any notes yet."}
              </p>
              {filter === "mine" && (
                <Link
                  href="/noting/new"
                  onClick={() => useNotingDraftStore.getState().clearDraft()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#005b96] px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-[#005b96]/20 transition-all duration-200 hover:bg-[#03396c]"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Note
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div
            className="space-y-3 overflow-hidden rounded-2xl border border-[#b3cde0]/40 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            style={{ boxShadow: "0 2px 16px 0 rgba(0, 91, 150, 0.07)" }}
          >
            {(notes as Note[]).map((note) => {
              const statusConf =
                STATUS_CONFIG[note.status] || STATUS_CONFIG.draft;
              const StatusIcon = statusConf.icon;
              const isDeleting =
                deleteMutation.isPending &&
                deleteMutation.variables === note.id;

              const approverActions =
                note.history?.filter(
                  (h: { performedById: string }) =>
                    h.performedById !== note.createdById,
                ) || [];
              // A note can only be deleted if:
              // 1. We're on "My Notes" tab
              // 2. The note is not finalized (approved/rejected)
              // 3. No approver has taken action (checked from history if loaded,
              //    falling back to _count.history — list API doesn't return history items)
              const hasApproverActed =
                approverActions.length > 0 ||
                (note.history === undefined && (note._count?.history ?? 0) > 1);
              // For reverted notes, only the creator can edit (revert sends it back for modifications)
              // Reverted notes cannot be deleted since they've been through the approval flow
              const canEdit =
                filter === "mine" &&
                note.status !== "approved" &&
                note.status !== "rejected" &&
                (note.status === "reverted"
                  ? note.createdById === currentUserId
                  : !hasApproverActed);
              const canDelete =
                filter === "mine" &&
                note.status !== "approved" &&
                note.status !== "rejected" &&
                note.status !== "reverted" &&
                !hasApproverActed;

              return (
                <Link
                  key={note.id}
                  href={
                    note.status === "draft" || (note.status === "reverted" && note.createdById === currentUserId)
                      ? `/noting/new?draft=${note.id}`
                      : `/noting/${note.id}`
                  }
                  className="group block"
                  onMouseEnter={() => {
                    if (note.status !== "draft" && !(note.status === "reverted" && note.createdById === currentUserId)) {
                      queryClient.prefetchQuery({
                        queryKey: NOTING_QUERY_KEYS.detail(note.id),
                        queryFn: () => notingService.getById(note.id),
                        staleTime: 2 * 60 * 1000,
                      });
                    }
                  }}
                >
                  <div
                    className="rounded-2xl border border-[#b3cde0]/40 bg-[#f8fafc]/80 transition-all duration-200 hover:border-[#6497b1] dark:border-gray-600 dark:bg-gray-900/50 dark:hover:border-[#03396c]"
                    style={{
                      boxShadow: "0 2px 12px 0 rgba(0, 91, 150, 0.06)",
                    }}
                  >
                    <div className="px-4 sm:px-5 py-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <span className="font-mono text-xs font-semibold text-[#005b96] dark:text-[#6497b1]">
                              {note.notingId}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">
                              •
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(note.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </span>
                          </div>
                          <h3 className="mb-1 text-base font-semibold capitalize text-[#011f4b] transition-colors group-hover:text-[#005b96] dark:text-white dark:group-hover:text-[#6497b1]">
                            {note.category} / {note.subcategory}
                          </h3>
                          {note.description && (
                            <p className="line-clamp-1 text-sm text-[#03396c]/80 dark:text-gray-400">
                              {stripHtml(note.description)}
                            </p>
                          )}
                          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-[#b3cde0]/30 dark:bg-[#011f4b]/30 flex items-center justify-center text-[#005b96] dark:text-[#6497b1] text-[10px] font-bold">
                                {getDisplayName(note).charAt(0).toUpperCase()}
                              </span>
                              {getDisplayName(note)}
                            </span>
                            {filter !== "handled_approved" && filter !== "handled_rejected" && note.currentHolder && (
                              <span className="flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                With{" "}
                                {note.currentHolder.employeeDetails
                                  ?.displayName || note.currentHolder.uid}
                              </span>
                            )}
                            {(note._count?.history ?? 0) > 0 && (
                              <span className="flex items-center gap-1">
                                <History className="w-3 h-3" />
                                {note._count!.history}{" "}
                                {note._count!.history === 1
                                  ? "action"
                                  : "actions"}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row flex-wrap items-center justify-end gap-2 shrink-0">
                          {(filter === "handled_approved" || filter === "handled_rejected") && note.myAction ? (
                            <div className="flex flex-col items-end gap-1.5">
                              {(() => {
                                const actionConf =
                                  MY_ACTION_CONFIG[note.myAction.action] ||
                                  MY_ACTION_CONFIG.forwarded;
                                const ActionIcon = actionConf.icon;
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${actionConf.color}`}
                                  >
                                    <ActionIcon className="w-3 h-3" />
                                    {actionConf.label}
                                  </span>
                                );
                              })()}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${statusConf.color}`}
                              >
                                <StatusIcon className="w-3 h-3" />
                                {statusConf.label}
                              </span>
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${statusConf.color}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {statusConf.label}
                            </span>
                          )}

                          <div
                            className="flex items-center gap-0.5"
                            onClick={(e) => e.preventDefault()}
                          >
                            {canEdit &&
                              note.status !== "approved" &&
                              note.status !== "rejected" && (
                                <Link
                                  href={`/noting/new?draft=${note.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 text-gray-400 hover:text-[#005b96] hover:bg-[#b3cde0]/20 dark:hover:bg-[#011f4b]/20 rounded-md transition-colors"
                                  title="Edit note"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Link>
                              )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteDraft(e, note)}
                                disabled={isDeleting}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
                                title="Delete note"
                              >
                                {isDeleting ? (
                                  <Skeleton className="w-3.5 h-3.5 rounded-sm" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 0 && (
          <div
            className="mt-6 rounded-2xl border border-[#b3cde0]/40 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800"
            style={{ boxShadow: "0 2px 12px 0 rgba(0, 91, 150, 0.06)" }}
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-[#6497b1] dark:text-gray-400">
                Showing{" "}
                <span className="font-medium text-[#011f4b] dark:text-gray-200">
                  {(pagination.page - 1) * PAGE_SIZE + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {Math.min(pagination.page * PAGE_SIZE, pagination.total)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {pagination.total}
                </span>
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1 || isLoading}
                  className="inline-flex items-center gap-1 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-xl border border-[#b3cde0]/50 dark:border-gray-600 text-xs font-medium text-[#03396c] dark:text-gray-300 hover:bg-[#b3cde0]/10 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPage(pageNum)}
                          disabled={isLoading}
                          className={`w-8 h-8 rounded-xl text-xs font-medium transition-all duration-200 ${pagination.page === pageNum
                            ? "bg-[#005b96] text-white shadow-[0_2px_6px_rgba(0,91,150,0.3)]"
                            : "text-[#03396c] dark:text-gray-300 hover:bg-[#b3cde0]/20 dark:hover:bg-gray-700"
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    },
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                  disabled={
                    pagination.page >= pagination.totalPages || isLoading
                  }
                  className="inline-flex items-center gap-1 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-xl border border-[#b3cde0]/50 dark:border-gray-600 text-xs font-medium text-[#03396c] dark:text-gray-300 hover:bg-[#b3cde0]/10 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
