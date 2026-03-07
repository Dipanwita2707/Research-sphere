"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Send,
  User,
  Clock,
  Hand,
  Paperclip,
  FileText,
  Pencil,
  Download,
  Eye,
  Trash2,
  RotateCcw,
  ArrowRight,
  CornerDownLeft,
  Building2,
  Search,
  ArrowUpRight,
  ThumbsUp,
  ThumbsDown,
  Copy,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { notingService } from "@/features/noting-management/services/noting.service";
import {
  useNote,
  useNotingPermissions,
  useMyManager,
  useSearchEmployees,
  useApproveNote,
  useRejectNote,
  useRevertNote,
  useForwardNote,
  useAutoForwardNote,
  useRecommendNote,
  useNotRecommendNote,
} from "@/features/noting-management/hooks/useNoting";
import type {
  Note,
} from "@/features/noting-management/types/noting.types";
import { useToast } from "@/shared/ui-components/Toast";
import { getErrorMessage } from "@/shared/utils/errorHandler";
import { PageSkeleton } from "@/shared/components/PageSkeleton";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useAuthStore } from "@/shared/auth/authStore";

/* -- Lazy-loaded heavy sections (code-split) -- */
const NoteEventDetails = dynamic(() => import("./components/NoteEventDetails"), { ssr: false });
const CopySharingSection = dynamic(() => import("./components/CopySharingSection"), { ssr: false });

function getDisplayName(
  obj:
    | {
      uid?: string;
      employeeDetails?: {
        displayName?: string;
        firstName?: string;
        lastName?: string;
      };
      studentLogin?: { displayName?: string };
    }
    | null
    | undefined,
): string {
  if (!obj) return "—";
  if (obj.employeeDetails?.displayName) return obj.employeeDetails.displayName;
  if (obj.employeeDetails?.firstName || obj.employeeDetails?.lastName)
    return [obj.employeeDetails?.firstName, obj.employeeDetails?.lastName]
      .filter(Boolean)
      .join(" ");
  if ((obj as any).studentLogin?.displayName)
    return (obj as any).studentLogin.displayName;
  return obj.uid ?? "—";
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  reverted: "bg-orange-50 text-orange-700 border-orange-200",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  draft: Clock,
  pending: Send,
  approved: CheckCircle,
  rejected: XCircle,
  reverted: RotateCcw,
};

function getModulePermissionKey(note?: Note | null): string | null {
  if (!note?.subcategory) return null;

  const permissionMap: Record<string, string> = {
    dsw_club_creation: 'dsw_approve_noting',
    dsw_club_change: 'dsw_approve_noting',
    events: 'event_approve',
    curriculum: 'curriculum_approve',
    exam: 'exam_approve',
    infrastructure: 'infrastructure_approve',
    accounts_purchase: 'accounts_purchase_approve',
    student_related: 'student_related_approve',
    miscellaneous: 'noting_approve',
    non_academic_resources: 'non_academic_resources_approve',
  };

  return permissionMap[note.subcategory] || 'noting_approve';
}

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { toast } = useToast();
  const { user } = useAuthStore();

  // TanStack Query: replaces manual useEffect + useState for note + perms
  const {
    data: note,
    isLoading: loading,
    error: noteError,
  } = useNote(id);
  const {
    data: notingPerms,
    isLoading: permsLoading,
  } = useNotingPermissions();

  // ── Security: redirect if user has no access to this noting ──
  useEffect(() => {
    if (noteError) {
      const status = (noteError as any)?.response?.status;
      if (status === 403) {
        toast({ type: 'error', message: 'You do not have access to this noting' });
        router.push('/noting');
      }
    }
  }, [noteError, router, toast]);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<
    | "approve"
    | "reject"
    | "revert"
    | "forward"
    | "recommend"
    | "not_recommend"
    | null
  >(null);
  const [remarks, setRemarks] = useState("");
  const [forwardUserId, setForwardUserId] = useState("");
  const [forwardMode, setForwardMode] = useState<"auto" | "manual" | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  // TanStack Query hook with built-in 500ms debounce + caching
  const { data: searchResults = [], isLoading: searchLoading } = useSearchEmployees(
    searchQuery,
    { enabled: forwardMode === "manual" },
  );
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    uid: string;
    displayName: string;
    department: string;
  } | null>(null);
  // PERF FIX: Use TanStack Query hook instead of raw notingService.getMyManager().
  // useMyManager has 5-min staleTime — switching between auto/manual forward modes
  // no longer fires a fresh request each time.
  const { data: managerInfo = null, isLoading: managerLoading } = useMyManager({ enabled: forwardMode === 'auto' });

  // Block students without noting_create permission (chairpersons ARE allowed)
  useEffect(() => {
    if (
      user &&
      (user.userType === "student" || user.role?.name === "student") &&
      notingPerms &&
      !notingPerms.noting_create
    ) {
      toast({
        type: "error",
        message: "Students are not allowed to access the noting system",
      });
      router.push("/dashboard");
    }
  }, [user, notingPerms, router, toast]);

  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [viewingPath, setViewingPath] = useState<string | null>(null);
  const [autoForwardLoading, setAutoForwardLoading] = useState(false);

  const currentUserId: string | null = user?.id ?? null;
  const isCurrentHolder =
    note?.currentHolderId && typeof window !== "undefined";
  const currentUserRole =
    typeof user?.role === 'string' ? user.role.toLowerCase() : user?.role?.name?.toLowerCase();
  const isPrivilegedApprover =
    currentUserRole === 'admin' ||
    currentUserRole === 'superadmin' ||
    currentUserRole === 'dean' ||
    user?.roleCode === 'DEAN';
  const modulePermissionKey = getModulePermissionKey(note);
  const hasSubcategoryApproval =
    isPrivilegedApprover ||
    (modulePermissionKey
      ? Boolean((notingPerms as Record<string, boolean | undefined> | undefined)?.[modulePermissionKey])
      : false);

  // canAct: user must be the current holder of a pending note AND permissions must be loaded
  const canAct =
    note?.status === "pending" &&
    note?.currentHolderId === currentUserId &&
    !permsLoading;

  // Per-button permission gates (all still require canAct — permissions alone are not enough)
  const showApproveBtn = canAct && hasSubcategoryApproval && (notingPerms?.canApprove ?? false);
  const showRejectBtn = canAct && hasSubcategoryApproval && (notingPerms?.canReject ?? false);
  const showRevertBtn = canAct && hasSubcategoryApproval && (notingPerms?.canRevert ?? false);
  const showForwardBtn = canAct && hasSubcategoryApproval && (notingPerms?.canForward ?? false);
  const showRecommendBtn = canAct && hasSubcategoryApproval && (notingPerms?.canRecommend ?? false);
  const showNotRecommendBtn = canAct && hasSubcategoryApproval && (notingPerms?.canNotRecommend ?? false);

  // The whole Actions section is visible only if the user has at least one action available
  const showActionsSection =
    showApproveBtn ||
    showRejectBtn ||
    showRevertBtn ||
    showForwardBtn ||
    showRecommendBtn ||
    showNotRecommendBtn;

  useEffect(() => {
    if (actionType === "forward") {
      setForwardUserId("");
      setForwardMode(null);
      setSearchQuery("");
      setSelectedUser(null);
    }
  }, [actionType]);

  // Search is now handled by useSearchEmployees hook above (debounce + caching built-in)

  // Manager info now fetched by useMyManager hook above (enabled when forwardMode === 'auto')

  // ── Mutation hooks (replace manual notingService calls + manual re-fetch) ──
  const approveMutation = useApproveNote();
  const rejectMutation = useRejectNote();
  const revertMutation = useRevertNote();
  const forwardMutation = useForwardNote();
  const autoForwardMutation = useAutoForwardNote();
  const recommendMutation = useRecommendNote();
  const notRecommendMutation = useNotRecommendNote();

  const doApprove = () => {
    if (!note) return;
    if (!remarks.trim()) {
      toast({ type: "error", message: "Remarks are mandatory for approval" });
      return;
    }
    setActionType(null);
    setActionLoading(true);
    approveMutation.mutate(
      { id: note.id, remarks },
      {
        onSuccess: (response) => {
          const data = response?.data || response;
          if (
            data.eventCreated &&
            data.isFestivalNoting &&
            data.eventIds?.length
          ) {
            toast({
              type: "success",
              message: `Note approved! ${data.eventIds.length} sub-event(s) created in DRAFT status. Visit My Created Events to add details and publish.`,
              duration: 8000,
            });
          } else if (data.eventCreated && data.eventId) {
            toast({
              type: "success",
              message: `Note approved! Event ${data.eventId} created in DRAFT status. Visit Event Management to add details and publish.`,
              duration: 8000,
            });
          } else {
            toast({
              type: "success",
              message: response?.message || "Note approved successfully",
            });
          }
          setRemarks("");
          setActionType(null);
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setActionLoading(false),
      },
    );
  };

  const doReject = () => {
    if (!note || !remarks.trim()) {
      toast({ type: "error", message: "Remarks are mandatory for rejection" });
      return;
    }
    setActionType(null);
    setActionLoading(true);
    rejectMutation.mutate(
      { id: note.id, remarks },
      {
        onSuccess: () => {
          toast({ type: "success", message: "Note rejected" });
          setRemarks("");
          setActionType(null);
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setActionLoading(false),
      },
    );
  };

  const doRevert = () => {
    if (!note || !remarks.trim()) {
      toast({ type: "error", message: "Remarks are required for revert back" });
      return;
    }
    setActionType(null);
    setActionLoading(true);
    revertMutation.mutate(
      { id: note.id, remarks },
      {
        onSuccess: () => {
          toast({ type: "success", message: "Note reverted back to creator" });
          setRemarks("");
          setActionType(null);
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setActionLoading(false),
      },
    );
  };

  const doForward = () => {
    if (!note || !remarks.trim()) {
      toast({ type: "error", message: "Remarks are required for forward" });
      return;
    }
    if (!forwardUserId.trim()) {
      toast({ type: "error", message: "Please select a user to forward to" });
      return;
    }
    setActionLoading(true);
    forwardMutation.mutate(
      {
        id: note.id,
        payload: {
          remarks: remarks.trim(),
          nextHolderId: forwardUserId.trim(),
        },
      },
      {
        onSuccess: () => {
          toast({
            type: "success",
            message: `Note forwarded to ${selectedUser?.displayName || "selected user"}`,
          });
          setRemarks("");
          setForwardUserId("");
          setSelectedUser(null);
          setForwardMode(null);
          setActionType(null);
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setActionLoading(false),
      },
    );
  };

  const doAutoForward = () => {
    if (!note) return;
    if (!remarks.trim()) {
      toast({ type: "error", message: "Remarks are mandatory for forwarding" });
      return;
    }
    setAutoForwardLoading(true);
    autoForwardMutation.mutate(
      { id: note.id, remarks: remarks.trim() },
      {
        onSuccess: (response) => {
          toast({
            type: "success",
            message:
              response?.message || "Note forwarded to your reporting manager",
          });
          setRemarks("");
          setForwardMode(null);
          setActionType(null);
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setAutoForwardLoading(false),
      },
    );
  };

  const doRecommend = () => {
    if (!note || !remarks.trim()) {
      toast({
        type: "error",
        message: "Remarks are mandatory for recommendation",
      });
      return;
    }
    setActionType(null);
    setActionLoading(true);
    recommendMutation.mutate(
      { id: note.id, remarks },
      {
        onSuccess: (response) => {
          toast({
            type: "success",
            message: response?.message || "Note recommended and forwarded",
          });
          setRemarks("");
          setActionType(null);
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setActionLoading(false),
      },
    );
  };

  const doNotRecommend = () => {
    if (!note || !remarks.trim()) {
      toast({
        type: "error",
        message: "Remarks are mandatory when not recommending",
      });
      return;
    }
    setActionType(null);
    setActionLoading(true);
    notRecommendMutation.mutate(
      { id: note.id, remarks },
      {
        onSuccess: (response) => {
          toast({
            type: "success",
            message: response?.message || "Note not recommended",
          });
          setRemarks("");
          setActionType(null);
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setActionLoading(false),
      },
    );
  };

  if (loading || !note) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading note..." />
      </div>
    );
  }

  const approverActions =
    note.history?.filter((h) => h.performedById !== note.createdById) || [];
  const canEditOrDelete =
    note.createdById === currentUserId &&
    (note.status === "reverted" ||
      (approverActions.length === 0 &&
        note.status !== "approved" &&
        note.status !== "rejected"));

  const StatusIcon = STATUS_ICONS[note.status] || Clock;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 py-4 sm:py-6 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <Link
            href="/noting"
            className="inline-flex items-center gap-1.5 text-sm text-[#6497b1] dark:text-gray-400 hover:text-[#005b96] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Noting
          </Link>
          {canEditOrDelete && (
            <div className="flex items-center gap-2">
              <Link
                href={`/noting/new?draft=${id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-xl bg-[#005b96] text-white text-xs font-medium hover:bg-[#03396c] transition-all duration-200"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Link>
              <button
                onClick={() => {
                  if (
                    window.confirm("Delete this note? This cannot be undone.")
                  ) {
                    notingService
                      .deleteDraft(note.id)
                      .then(() => {
                        toast({ type: "success", message: "Note deleted" });
                        router.push("/noting");
                      })
                      .catch((err) => {
                        const message = getErrorMessage(err);
                        toast({ type: "error", message });
                      });
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-xl border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-all duration-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Reverted Notice */}
        {note.status === "reverted" && note.createdById === currentUserId && (
          <div className="mb-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <div className="flex items-start gap-2.5">
              <RotateCcw className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Note Reverted Back
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                  This note has been sent back for modifications. Review the
                  remarks, make changes, and resubmit.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== A4 Document Sheet ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#b3cde0]/40 dark:border-gray-700 shadow-[0_2px_8px_rgba(100,151,177,0.1)] overflow-hidden">
          {/* Document Header */}
          <div className="border-b border-[#b3cde0]/30 dark:border-gray-700 px-4 sm:px-8 py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="px-2 py-0.5 rounded-lg bg-[#b3cde0]/20 dark:bg-[#011f4b]/30 text-[#005b96] dark:text-[#b3cde0] text-xs font-mono font-semibold border border-[#b3cde0]/40 dark:border-[#011f4b]/50">
                    {note.notingId}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_STYLES[note.status] || STATUS_STYLES.draft}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {note.status === "pending"
                      ? "IN REVIEW"
                      : note.status.toUpperCase()}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-[#011f4b] dark:text-white capitalize">
                  {note.category}{" "}
                  <span className="text-gray-300 dark:text-gray-600 mx-1 font-light">
                    /
                  </span>{" "}
                  {note.subcategory}
                </h1>
              </div>

              {/* Current Holder Badge */}
              {note.currentHolder && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#b3cde0]/10 dark:bg-gray-900/30 border border-[#b3cde0]/30 dark:border-gray-700 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-[#b3cde0]/30 dark:bg-[#011f4b]/50 flex items-center justify-center text-[#005b96] dark:text-[#6497b1] font-bold text-[10px] uppercase">
                    {getDisplayName(note.currentHolder).substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                      Current Holder{" "}
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-none mt-0.5">
                      {getDisplayName(note.currentHolder)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Document Body */}
          <div className="px-4 sm:px-8 py-4 sm:py-6 space-y-6">
            {/* Description */}
            <section>
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                Description
              </h3>
              <div
                className="noting-rich-content bg-[#f8fafc] dark:bg-gray-900/20 px-4 py-3 rounded-xl border border-[#b3cde0]/30 dark:border-gray-800 text-sm text-gray-800 dark:text-gray-200 [&>ol]:!list-decimal [&>ol]:!ml-6 [&>ol]:!pl-4 [&>ul]:!list-disc [&>ul]:!ml-6 [&>ul]:!pl-4 [&_ol]:!list-decimal [&_ol]:!ml-6 [&_ol]:!pl-4 [&_ul]:!list-disc [&_ul]:!ml-6 [&_ul]:!pl-4 [&_li]:!mb-1 [&_p]:!mb-2 [&_p]:!block [&_h1]:!text-2xl [&_h1]:!font-bold [&_h1]:!my-3 [&_h2]:!text-xl [&_h2]:!font-semibold [&_h2]:!my-2 [&_h3]:!text-lg [&_h3]:!font-semibold [&_h3]:!my-2 [&_blockquote]:!border-l-4 [&_blockquote]:!border-[#005b96] [&_blockquote]:!pl-4 [&_blockquote]:!italic [&_blockquote]:!my-2"
                dangerouslySetInnerHTML={{ __html: note.description || "" }}
              />
            </section>

            {/* DSW Club + Event Details - extracted to component */}
            <NoteEventDetails note={note} />

            {/* Requirements / Points */}
            {note.points && note.points.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                  Requirements / Points
                </h3>
                <div className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-900/20 p-4">
                  <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 divide-y divide-[#b3cde0]/20 dark:divide-gray-700">
                    {note.points.map((pt, i) => (
                      <li key={pt.id || i} className="leading-relaxed py-2.5 first:pt-0 last:pb-0">
                        {pt.content}
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            )}

            {/* Attachments */}
            {note.attachments && note.attachments.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                  <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Attachments
                  </h3>
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {note.attachments.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {note.attachments.map((att) => {
                    const isDownloading = downloadingPath === att.filePath;
                    const isViewing = viewingPath === att.filePath;
                    return (
                      <div
                        key={att.id}
                        className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:border-[#6497b1] dark:hover:border-[#03396c] transition-all duration-200"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded bg-gray-50 dark:bg-gray-900/30 flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-700">
                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {att.fileName}
                            </p>
                            {att.fileDescription && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                                {att.fileDescription}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  setViewingPath(att.filePath);
                                  try {
                                    const blobUrl =
                                      await notingService.viewAttachment(
                                        att.filePath,
                                      );
                                    const w = window.open(
                                      blobUrl,
                                      "_blank",
                                      "noopener",
                                    );
                                    if (w)
                                      setTimeout(
                                        () => URL.revokeObjectURL(blobUrl),
                                        30000,
                                      );
                                  } catch {
                                    toast({
                                      type: "error",
                                      message: "Failed to open file",
                                    });
                                  } finally {
                                    setViewingPath(null);
                                  }
                                }}
                                disabled={isViewing}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6497b1] hover:text-[#005b96] transition-all duration-200"
                              >
                                {isViewing ? (
                                  <LoadingSpinner
                                    size="sm"
                                    className="w-3 h-3"
                                  />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setDownloadingPath(att.filePath);
                                  try {
                                    await notingService.downloadAttachment(
                                      att.filePath,
                                      att.fileName,
                                    );
                                    toast({
                                      type: "success",
                                      message: "Download started",
                                    });
                                  } catch {
                                    toast({
                                      type: "error",
                                      message: "Failed to download file",
                                    });
                                  } finally {
                                    setDownloadingPath(null);
                                  }
                                }}
                                disabled={isDownloading}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6497b1] hover:text-[#005b96] transition-all duration-200"
                              >
                                {isDownloading ? (
                                  <LoadingSpinner
                                    size="sm"
                                    className="w-3 h-3"
                                  />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                                Download
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Metadata Grid */}
            <section>
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                Details
              </h3>
              <div className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#b3cde0]/20 dark:bg-gray-700">
                  <div className="bg-white dark:bg-gray-800 p-3">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Approval Period
                    </span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 capitalize">
                      {note.approvalPeriod.replace("_", " ")}
                    </p>
                  </div>
                  {note.recurringFrequency && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                        Frequency
                      </span>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 capitalize">
                        {note.recurringFrequency}
                      </p>
                    </div>
                  )}
                  <div className="bg-white dark:bg-gray-800 p-3">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Amount Required
                    </span>
                    <p
                      className={`text-sm font-medium mt-0.5 ${note.amountRequired ? "text-gray-900 dark:text-white" : "text-gray-400"}`}
                    >
                      {note.amountRequired
                        ? `₹ ${Number(note.amount || 0).toLocaleString()}`
                        : "—"}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Policy Compliance
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-medium mt-0.5 ${note.policyCompliant === true
                          ? "text-emerald-700"
                          : note.policyCompliant === false
                            ? "text-red-700"
                            : "text-gray-400"
                        }`}
                    >
                      {note.policyCompliant === true ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Yes
                        </>
                      ) : note.policyCompliant === false ? (
                        <>
                          <XCircle className="w-3 h-3" /> No
                        </>
                      ) : (
                        "N/A"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Originator */}
            <section>
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                Originator
              </h3>
              <div className="bg-[#f8fafc] dark:bg-gray-900/20 rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#b3cde0]/30 dark:bg-[#011f4b]/30 flex items-center justify-center text-[#005b96] dark:text-[#b3cde0] font-bold text-sm">
                    {getDisplayName(note.createdBy).charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">
                        {getDisplayName(note.createdBy)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {note.createdBy?.role}
                      </span>
                    </div>
                    <div className="flex flex-wrap text-xs text-gray-500 dark:text-gray-400 gap-x-4">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {note.createdBy?.employeeDetails?.primaryDepartment
                          ?.departmentName ??
                          note.createdBy?.studentLogin?.program?.department
                            ?.departmentName ??
                          "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(note.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Approval Trail */}
            {note.history && note.history.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="inline-block w-8 h-px bg-gradient-to-r from-[#005b96] to-transparent" />
                  Approval Trail
                  <span className="text-[10px] font-normal text-gray-300 dark:text-gray-600 ml-1">
                    ({note.history.length} {note.history.length === 1 ? "entry" : "entries"})
                  </span>
                </h3>
                <div className="max-h-[560px] overflow-y-auto pr-1 scrollbar-thin">
                  {note.history.map((h, idx) => {
                    let iconColor = "bg-gray-400";
                    let glowColor = "shadow-gray-400/20";
                    let badgeBg = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
                    let lineColor = "#d1d5db";
                    let Icon: React.ElementType = Clock;
                    const action = h.action.toLowerCase();

                    if (action.includes("submit")) {
                      Icon = Send;
                      iconColor = "bg-gradient-to-br from-[#005b96] to-[#011f4b]";
                      glowColor = "shadow-[#005b96]/40";
                      lineColor = "#005b96";
                      badgeBg = "bg-[#b3cde0]/20 text-[#005b96] dark:bg-[#005b96]/10 dark:text-[#b3cde0] ring-1 ring-[#b3cde0]/40 dark:ring-[#005b96]/50";
                    } else if (action.includes("approve")) {
                      Icon = CheckCircle;
                      iconColor = "bg-gradient-to-br from-emerald-400 to-emerald-600";
                      glowColor = "shadow-emerald-500/40";
                      lineColor = "#10b981";
                      badgeBg = "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-700/50";
                    } else if (action === "recommended") {
                      Icon = ThumbsUp;
                      iconColor = "bg-gradient-to-br from-blue-400 to-blue-600";
                      glowColor = "shadow-blue-500/40";
                      lineColor = "#3b82f6";
                      badgeBg = "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-700/50";
                    } else if (action === "not_recommended") {
                      Icon = ThumbsDown;
                      iconColor = "bg-gradient-to-br from-rose-400 to-rose-600";
                      glowColor = "shadow-rose-500/40";
                      lineColor = "#f43f5e";
                      badgeBg = "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-700/50";
                    } else if (action === "copy_sent") {
                      Icon = Copy;
                      iconColor = "bg-gradient-to-br from-indigo-400 to-indigo-600";
                      glowColor = "shadow-indigo-500/40";
                      lineColor = "#6366f1";
                      badgeBg = "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-700/50";
                    } else if (action === "copy_forwarded") {
                      Icon = AlertTriangle;
                      iconColor = "bg-gradient-to-br from-amber-400 to-amber-600";
                      glowColor = "shadow-amber-500/40";
                      lineColor = "#f59e0b";
                      badgeBg = "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-700/50";
                    } else if (action === "copy_completed") {
                      Icon = CheckCircle;
                      iconColor = "bg-gradient-to-br from-emerald-400 to-emerald-600";
                      glowColor = "shadow-emerald-500/40";
                      lineColor = "#10b981";
                      badgeBg = "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-700/50";
                    } else if (action.includes("reject")) {
                      Icon = XCircle;
                      iconColor = "bg-gradient-to-br from-red-400 to-red-600";
                      glowColor = "shadow-red-500/40";
                      lineColor = "#ef4444";
                      badgeBg = "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-700/50";
                    } else if (action.includes("revert")) {
                      Icon = RotateCcw;
                      iconColor = "bg-gradient-to-br from-orange-400 to-orange-600";
                      glowColor = "shadow-orange-500/40";
                      lineColor = "#f97316";
                      badgeBg = "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 ring-1 ring-orange-200 dark:ring-orange-700/50";
                    } else if (action.includes("forward")) {
                      Icon = ArrowRight;
                      iconColor = "bg-gradient-to-br from-[#6497b1] to-[#005b96]";
                      glowColor = "shadow-[#005b96]/40";
                      lineColor = "#005b96";
                      badgeBg = "bg-[#b3cde0]/20 text-[#005b96] dark:bg-[#005b96]/10 dark:text-[#b3cde0] ring-1 ring-[#b3cde0]/40 dark:ring-[#005b96]/50";
                    }

                    const isLast = idx === note.history!.length - 1;
                    const actionLabel = h.action
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c: string) => c.toUpperCase());

                    return (
                      <div
                        key={h.id}
                        className="flex group"
                        style={{
                          animation: `fadeInUp 0.4s ease-out ${idx * 0.08}s both`,
                        }}
                      >
                        {/* Left column: icon + connector line */}
                        <div className="flex flex-col items-center flex-shrink-0" style={{ width: "32px" }}>
                          {/* Icon node */}
                          <div className="relative z-10">
                            {isLast && (
                              <div
                                className={`absolute inset-0 rounded-full ${iconColor} opacity-30 animate-ping`}
                                style={{ animationDuration: "2s" }}
                              />
                            )}
                            <div
                              className={`h-7 w-7 rounded-full ${iconColor} shadow-lg ${glowColor} flex items-center justify-center ring-[3px] ring-white dark:ring-gray-800 transition-transform duration-200 group-hover:scale-110`}
                            >
                              <Icon className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                            </div>
                          </div>
                          {/* Connector line — grows to fill remaining height */}
                          {!isLast && (
                            <div
                              className="w-[2px] flex-1 rounded-full my-1"
                              style={{ backgroundColor: lineColor, opacity: 0.3 }}
                            />
                          )}
                        </div>

                        {/* Right column: content card */}
                        <div className="flex-1 min-w-0 pb-5 pl-3">
                          <div
                            className={`rounded-xl border transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-[1px] ${isLast
                                ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm"
                                : "bg-gray-50/80 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/40"
                              }`}
                          >
                            <div className="p-3.5">
                              {/* Action badge + timestamp row */}
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${badgeBg}`}
                                >
                                  <Icon className="w-3 h-3" />
                                  {actionLabel}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap">
                                  {new Date(h.createdAt).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              {/* User info */}
                              <div className="flex items-center gap-1.5 text-[12px] text-gray-600 dark:text-gray-300">
                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center flex-shrink-0">
                                  <User className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" />
                                </div>
                                <span className="font-medium truncate">
                                  {getDisplayName(h.performedBy)}
                                </span>
                                {h.performedBy?.uid && (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                                    {h.performedBy.uid}
                                  </span>
                                )}
                              </div>

                              {/* Remarks */}
                              {h.remarks && (
                                <div className="mt-2.5 pl-3 py-1.5 border-l-2 border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/20 rounded-r-md">
                                  <p className="text-[12px] text-gray-600 dark:text-gray-300 italic leading-relaxed">
                                    &ldquo;{h.remarks}&rdquo;
                                  </p>
                                </div>
                              )}

                              {/* Assignment */}
                              {h.nextHolder && (
                                <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#b3cde0]/20 dark:bg-[#005b96]/10 text-[#005b96] dark:text-[#b3cde0]">
                                    <CornerDownLeft className="w-3 h-3" />
                                    <span className="text-[11px] font-semibold">
                                      Assigned: {getDisplayName(h.nextHolder)}
                                    </span>
                                    {h.nextHolder?.uid && (
                                      <span className="text-[10px] font-mono opacity-70">
                                        ({h.nextHolder.uid})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ===== Inline Actions ===== */}
            {showActionsSection && (
              <section className="pt-5 mt-2 border-t border-[#b3cde0]/30 dark:border-gray-700">
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                  Actions
                </h3>
                <div className="space-y-3">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white placeholder:text-[#6497b1]/60 focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200 ${!remarks.trim() ? "border-red-300 dark:border-red-600" : "border-[#b3cde0]/50 dark:border-gray-600"}`}
                    placeholder="Remarks (mandatory for ALL actions)..."
                  />
                  {!remarks.trim() && (
                    <p className="text-[11px] text-red-500 -mt-1">
                      ⚠ Remarks are mandatory. No action can be performed
                      without entering remarks.
                    </p>
                  )}

                  {/* Forward Panel */}
                  {actionType === "forward" && (
                    <div className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-600 bg-[#f8fafc] dark:bg-gray-700/30 p-3 space-y-2.5">
                      {/* Radio Options */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="forwardMode"
                            checked={forwardMode === "auto"}
                            onChange={() => {
                              setForwardMode("auto");
                              setForwardUserId("");
                              setSelectedUser(null);
                              setSearchQuery("");
                            }}
                            className="w-3.5 h-3.5 text-[#005b96] accent-[#005b96]"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Auto (to manager)
                          </span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="forwardMode"
                            checked={forwardMode === "manual"}
                            onChange={() => {
                              setForwardMode("manual");
                              setForwardUserId("");
                              setSelectedUser(null);
                            }}
                            className="w-3.5 h-3.5 text-[#005b96] accent-[#005b96]"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Manual (search faculty)
                          </span>
                        </label>
                      </div>

                      {/* Auto Forward */}
                      {forwardMode === "auto" && (
                        <div className="space-y-2">
                          {managerLoading ? (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <LoadingSpinner size="sm" className="w-3 h-3" />
                              Loading manager info...
                            </div>
                          ) : managerInfo ? (
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5">
                              <div className="flex-1">
                                <p className="text-xs text-gray-500">
                                  Forwarding to:
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {managerInfo.displayName}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    ({managerInfo.uid})
                                  </span>
                                  {managerInfo.department && (
                                    <span className="text-xs text-gray-400">
                                      • {managerInfo.department}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-red-500">
                              No reporting manager found
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={doAutoForward}
                            disabled={
                              autoForwardLoading ||
                              !remarks.trim() ||
                              !managerInfo
                            }
                            className="w-full px-3 py-1.5 text-xs bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] disabled:opacity-50 font-medium inline-flex items-center justify-center gap-1 transition-all duration-200"
                          >
                            {autoForwardLoading ? (
                              <LoadingSpinner size="sm" className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            Forward
                          </button>
                        </div>
                      )}

                      {/* Manual Forward */}
                      {forwardMode === "manual" && (
                        <>
                          {/* Selected user or search input */}
                          {selectedUser ? (
                            <div className="flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {selectedUser.displayName}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({selectedUser.uid})
                              </span>
                              {selectedUser.department && (
                                <span className="text-xs text-gray-400">
                                  • {selectedUser.department}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUser(null);
                                  setForwardUserId("");
                                  setSearchQuery("");
                                }}
                                className="ml-auto text-gray-400 hover:text-red-500"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                  setSearchQuery(e.target.value);
                                  setForwardUserId("");
                                  setSelectedUser(null);
                                }}
                                placeholder="Type UID, name or emp ID..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white placeholder:text-[#6497b1]/60 focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200"
                                autoFocus
                              />
                              {searchLoading && (
                                <LoadingSpinner
                                  size="sm"
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 !border-gray-400"
                                />
                              )}
                            </div>
                          )}

                          {/* Search Results Dropdown */}
                          {!selectedUser && searchQuery.trim().length >= 2 && (
                            <div className="max-h-40 overflow-y-auto rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                              {searchResults.length === 0 && !searchLoading && (
                                <p className="px-3 py-2 text-xs text-gray-500 text-center">
                                  No employees found
                                </p>
                              )}
                              {searchResults.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedUser({
                                      id: u.id,
                                      uid: u.uid,
                                      displayName: u.displayName,
                                      department: u.department,
                                    });
                                    setForwardUserId(u.id);
                                    setSearchQuery("");
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left text-sm"
                                >
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {u.displayName}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    ({u.uid})
                                  </span>
                                  {u.department && (
                                    <span className="text-xs text-gray-400 ml-auto truncate max-w-[140px]">
                                      {u.department}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Action Buttons
                       Rules:
                       - Only buttons whose permission flag is true are rendered (not hidden, not disabled — absent entirely)
                       - All buttons are additionally disabled while Forward panel is open (actionType === 'forward')
                         to prevent double-actions on the same note.
                       - The Forward toggle is disabled while any async action is in flight (actionLoading).
                  */}
                  <div className="flex gap-2 flex-wrap">
                    {showApproveBtn && (
                      <button
                        onClick={doApprove}
                        disabled={
                          actionLoading ||
                          !remarks.trim() ||
                          actionType === "forward"
                        }
                        className="px-4 py-2.5 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-all duration-200"
                      >
                        {actionLoading && actionType === null ? (
                          <LoadingSpinner size="sm" className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        Approve
                      </button>
                    )}
                    {showRejectBtn && (
                      <button
                        onClick={doReject}
                        disabled={
                          actionLoading ||
                          !remarks.trim() ||
                          actionType === "forward"
                        }
                        className="px-4 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-all duration-200"
                      >
                        {actionLoading && actionType === null ? (
                          <LoadingSpinner size="sm" className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        Reject
                      </button>
                    )}
                    {showRevertBtn && (
                      <button
                        onClick={doRevert}
                        disabled={
                          actionLoading ||
                          !remarks.trim() ||
                          actionType === "forward"
                        }
                        className="px-4 py-2.5 text-sm bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-all duration-200"
                        title="Send back to creator for modifications"
                      >
                        {actionLoading && actionType === null ? (
                          <LoadingSpinner size="sm" className="w-3.5 h-3.5" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Revert Back
                      </button>
                    )}
                    {showRecommendBtn && (
                      <button
                        onClick={doRecommend}
                        disabled={
                          actionLoading ||
                          !remarks.trim() ||
                          actionType === "forward"
                        }
                        className="px-4 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-all duration-200"
                        title="Recommend and forward to next authority"
                      >
                        {actionLoading && actionType === null ? (
                          <LoadingSpinner size="sm" className="w-3.5 h-3.5" />
                        ) : (
                          <ThumbsUp className="w-3.5 h-3.5" />
                        )}
                        Recommend
                      </button>
                    )}
                    {showNotRecommendBtn && (
                      <button
                        onClick={doNotRecommend}
                        disabled={
                          actionLoading ||
                          !remarks.trim() ||
                          actionType === "forward"
                        }
                        className="px-4 py-2.5 text-sm bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-all duration-200"
                        title="Not recommend — reject with recommendation label"
                      >
                        {actionLoading && actionType === null ? (
                          <LoadingSpinner size="sm" className="w-3.5 h-3.5" />
                        ) : (
                          <ThumbsDown className="w-3.5 h-3.5" />
                        )}
                        Not Recommend
                      </button>
                    )}
                    {/* Forward toggle — only rendered if user has noting_forward permission */}
                    {showForwardBtn && (
                      <button
                        onClick={() =>
                          setActionType(
                            actionType === "forward" ? null : "forward",
                          )
                        }
                        disabled={actionLoading}
                        className={`px-4 py-2.5 text-sm border rounded-xl flex items-center gap-1.5 font-medium transition-all duration-200 disabled:opacity-50 ${actionType === "forward"
                            ? "bg-[#b3cde0]/20 dark:bg-[#005b96]/10 border-[#6497b1] text-[#005b96] dark:text-[#b3cde0]"
                            : "border-[#b3cde0]/50 dark:border-gray-600 hover:bg-[#f8fafc] dark:hover:bg-gray-700 text-[#03396c] dark:text-gray-300"
                          }`}
                        title="Forward note"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {actionType === "forward"
                          ? "Cancel Forward"
                          : "Forward"}
                      </button>
                    )}
                    {actionType === "forward" && forwardMode === "manual" && (
                      <button
                        onClick={doForward}
                        disabled={
                          actionLoading ||
                          !remarks.trim() ||
                          !forwardUserId.trim()
                        }
                        className="px-4 py-2.5 text-sm bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] disabled:opacity-50 font-medium transition-all duration-200"
                      >
                        {actionLoading ? (
                          <LoadingSpinner size="sm" className="w-3.5 h-3.5" />
                        ) : (
                          "Forward"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}
            {/* Copy Sharing - extracted to component */}
            <CopySharingSection
              note={note}
              currentUserId={currentUserId}
              getDisplayName={getDisplayName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
