"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
  Users,
  ThumbsUp,
  ThumbsDown,
  Copy,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Upload,
  X,
} from "lucide-react";
import { notingService } from "@/features/noting-management/services/noting.service";
import {
  useNote,
  useNotingPermissions,
  useNoteCopies,
  useApproveNote,
  useRejectNote,
  useRevertNote,
  useForwardNote,
  useAutoForwardNote,
  useRecommendNote,
  useNotRecommendNote,
  useSendCopy,
  useReplyCopy,
  useForwardCopy,
  useCompleteCopy,
  NOTING_QUERY_KEYS,
} from "@/features/noting-management/hooks/useNoting";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Note,
  NoteCopy,
} from "@/features/noting-management/types/noting.types";
import { useToast } from "@/shared/ui-components/Toast";
import { getErrorMessage } from "@/shared/utils/errorHandler";
import { PageSkeleton } from "@/shared/components/PageSkeleton";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useAuthStore } from "@/shared/auth/authStore";

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

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { toast } = useToast();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // TanStack Query: replaces manual useEffect + useState for note + perms
  const {
    data: note,
    isLoading: loading,
  } = useNote(id);
  const {
    data: notingPerms,
    isLoading: permsLoading,
  } = useNotingPermissions();

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
  const [searchResults, setSearchResults] = useState<
    {
      id: string;
      uid: string;
      role: string;
      displayName: string;
      empId: string;
      department: string;
      school: string;
    }[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    uid: string;
    displayName: string;
    department: string;
  } | null>(null);
  const [managerInfo, setManagerInfo] = useState<{
    id: string;
    uid: string;
    displayName: string;
    empId: string;
    department: string;
    school: string;
  } | null>(null);
  const [managerLoading, setManagerLoading] = useState(false);
  // Copy sharing state — copies fetched via useNoteCopies hook above
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copySearchQuery, setCopySearchQuery] = useState("");
  const [copySearchResults, setCopySearchResults] = useState<
    {
      id: string;
      uid: string;
      role: string;
      displayName: string;
      empId: string;
      department: string;
      school: string;
    }[]
  >([]);
  const [copySearchLoading, setCopySearchLoading] = useState(false);
  const [selectedCopyUsers, setSelectedCopyUsers] = useState<
    { id: string; uid: string; displayName: string; department: string }[]
  >([]);
  const [copyRemarks, setCopyRemarks] = useState("");
  const [copySendLoading, setCopySendLoading] = useState(false);
  // Reply state
  const [replyingCopyId, setReplyingCopyId] = useState<string | null>(null);
  const [replyRemarks, setReplyRemarks] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<
    { filePath: string; fileName: string }[]
  >([]);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyUploadLoading, setReplyUploadLoading] = useState(false);
  // Forward copy (escalation) state
  const [forwardingCopyId, setForwardingCopyId] = useState<string | null>(null);
  const [forwardCopyRemarks, setForwardCopyRemarks] = useState("");
  const [forwardCopyLoading, setForwardCopyLoading] = useState(false);
  const [completingCopyId, setCompletingCopyId] = useState<string | null>(null);
  const [completeCopyLoading, setCompleteCopyLoading] = useState(false);
  const [expandedCopyId, setExpandedCopyId] = useState<string | null>(null);

  // Block students from accessing noting system
  useEffect(() => {
    if (
      user &&
      (user.userType === "student" || user.role?.name === "student")
    ) {
      toast({
        type: "error",
        message: "Students are not allowed to access the noting system",
      });
      router.push("/dashboard");
    }
  }, [user, router, toast]);

  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [viewingPath, setViewingPath] = useState<string | null>(null);
  const [autoForwardLoading, setAutoForwardLoading] = useState(false);

  const currentUserId: string | null = user?.id ?? null;
  const isCurrentHolder =
    note?.currentHolderId && typeof window !== "undefined";

  // canAct: user must be the current holder of a pending note AND permissions must be loaded
  const canAct =
    note?.status === "pending" &&
    note?.currentHolderId === currentUserId &&
    !permsLoading;

  // Per-button permission gates (all still require canAct — permissions alone are not enough)
  const showApproveBtn = canAct && (notingPerms?.canApprove ?? false);
  const showRejectBtn = canAct && (notingPerms?.canReject ?? false);
  const showRevertBtn = canAct && (notingPerms?.canRevert ?? false);
  const showForwardBtn = canAct && (notingPerms?.canForward ?? false);
  const showRecommendBtn = canAct && (notingPerms?.canRecommend ?? false);
  const showNotRecommendBtn = canAct && (notingPerms?.canNotRecommend ?? false);

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
      setSearchResults([]);
      setSelectedUser(null);
    }
  }, [actionType]);

  // Search employees with debounce
  useEffect(() => {
    if (forwardMode !== "manual" || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await notingService.searchEmployees(searchQuery.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, forwardMode]);

  // Fetch manager info when auto mode is selected
  useEffect(() => {
    if (forwardMode === "auto" && !managerInfo) {
      setManagerLoading(true);
      notingService
        .getMyManager()
        .then(setManagerInfo)
        .catch((err) => {
          toast({ type: "error", message: getErrorMessage(err) });
          setManagerInfo(null);
        })
        .finally(() => setManagerLoading(false));
    }
  }, [forwardMode, managerInfo, toast]);

  // ── Mutation hooks (replace manual notingService calls + manual re-fetch) ──
  const approveMutation = useApproveNote();
  const rejectMutation = useRejectNote();
  const revertMutation = useRevertNote();
  const forwardMutation = useForwardNote();
  const autoForwardMutation = useAutoForwardNote();
  const recommendMutation = useRecommendNote();
  const notRecommendMutation = useNotRecommendNote();
  const sendCopyMutation = useSendCopy();
  const replyCopyMutation = useReplyCopy();
  const forwardCopyMutation = useForwardCopy();
  const completeCopyMutation = useCompleteCopy();

  // Copies via React Query (replaces manual loadCopies + useEffect)
  const {
    data: copies = [],
    isLoading: copiesLoading,
  } = useNoteCopies(note?.id ?? "", {
    enabled:
      !!note?.id &&
      note?.status === "approved" &&
      note?.createdById === currentUserId,
  });

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

  // Copy search with debounce
  useEffect(() => {
    if (copySearchQuery.trim().length < 2) {
      setCopySearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setCopySearchLoading(true);
      try {
        const results = await notingService.searchEmployees(
          copySearchQuery.trim(),
        );
        const existingCopyUserIds = new Set(
          copies.map((c) => (c as any).assignedToId),
        );
        setCopySearchResults(
          results.filter(
            (r) =>
              !selectedCopyUsers.some((s) => s.id === r.id) &&
              !existingCopyUserIds.has(r.id),
          ),
        );
      } catch {
        setCopySearchResults([]);
      } finally {
        setCopySearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [copySearchQuery, selectedCopyUsers]);

  const doSendCopy = async () => {
    if (!note) return;
    if (selectedCopyUsers.length === 0) {
      toast({ type: "error", message: "Please select at least one user" });
      return;
    }
    if (!copyRemarks.trim()) {
      toast({
        type: "error",
        message: "Please enter remarks explaining what work needs to be done.",
      });
      return;
    }
    setCopySendLoading(true);
    sendCopyMutation.mutate(
      {
        noteId: note.id,
        payload: {
          userIds: selectedCopyUsers.map((u) => u.id),
          remarks: copyRemarks.trim(),
        },
      },
      {
        onSuccess: (res) => {
          toast({
            type: "success",
            message: res?.message || "Copies sent successfully",
          });
          setSelectedCopyUsers([]);
          setCopyRemarks("");
          setShowCopyPanel(false);
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setCopySendLoading(false),
      },
    );
  };

  const doReplyCopy = async (copyId: string) => {
    if (!replyRemarks.trim()) {
      toast({
        type: "error",
        message: "Please enter your remarks before replying.",
      });
      return;
    }
    setReplyLoading(true);
    replyCopyMutation.mutate(
      {
        copyId,
        payload: {
          remarks: replyRemarks.trim(),
          attachments:
            replyAttachments.length > 0 ? replyAttachments : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ type: "success", message: "Reply submitted successfully" });
          setReplyingCopyId(null);
          setReplyRemarks("");
          setReplyAttachments([]);
          // Also invalidate note copies (detail page)
          queryClient.invalidateQueries({
            queryKey: NOTING_QUERY_KEYS.noteCopies(note?.id ?? ""),
          });
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setReplyLoading(false),
      },
    );
  };

  const doForwardCopy = async (copyId: string) => {
    if (!forwardCopyRemarks.trim()) {
      toast({
        type: "error",
        message: "Please enter remarks explaining why you are escalating.",
      });
      return;
    }
    setForwardCopyLoading(true);
    forwardCopyMutation.mutate(
      { copyId, remarks: forwardCopyRemarks.trim() },
      {
        onSuccess: (res) => {
          toast({
            type: "success",
            message: res?.message || "Copy forwarded with escalation",
          });
          setForwardingCopyId(null);
          setForwardCopyRemarks("");
          queryClient.invalidateQueries({
            queryKey: NOTING_QUERY_KEYS.noteCopies(note?.id ?? ""),
          });
        },
        onError: (err) =>
          toast({ type: "error", message: getErrorMessage(err) }),
        onSettled: () => setForwardCopyLoading(false),
      },
    );
  };

  const doCompleteCopy = async (copyId: string) => {
    setCompleteCopyLoading(true);
    setCompletingCopyId(copyId);
    completeCopyMutation.mutate(copyId, {
      onSuccess: (res) => {
        toast({
          type: "success",
          message:
            res?.message || "Work marked as completed. Entire chain closed.",
        });
        queryClient.invalidateQueries({
          queryKey: NOTING_QUERY_KEYS.noteCopies(note?.id ?? ""),
        });
      },
      onError: (err) =>
        toast({ type: "error", message: getErrorMessage(err) }),
      onSettled: () => {
        setCompleteCopyLoading(false);
        setCompletingCopyId(null);
      },
    });
  };

  const handleReplyFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const FILE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
    const oversized = Array.from(files).filter((f) => f.size > FILE_MAX_BYTES);
    if (oversized.length > 0) {
      toast({
        type: "error",
        message: `File size must not exceed 5MB. ${oversized.map((f) => f.name).join(", ")} ${oversized.length === 1 ? "is" : "are"} too large.`,
      });
      e.target.value = "";
      return;
    }
    setReplyUploadLoading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = await notingService.uploadAttachment(file);
        setReplyAttachments((prev) => [
          ...prev,
          { filePath, fileName: file.name },
        ]);
      }
      toast({ type: "success", message: "File(s) uploaded" });
    } catch (err) {
      toast({ type: "error", message: "File upload failed" });
    } finally {
      setReplyUploadLoading(false);
      e.target.value = "";
    }
  };

  if (loading || !note) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-4 sm:py-6 px-4 sm:px-6">
      <div className="max-w-[850px] mx-auto">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <Link
            href="/noting"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-sgt-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Noting
          </Link>
          {canEditOrDelete && (
            <div className="flex items-center gap-2">
              <Link
                href={`/noting/new?draft=${id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sgt-600 text-white text-xs font-medium hover:bg-sgt-700 transition-colors"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Document Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 sm:px-8 py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="px-2 py-0.5 rounded bg-sgt-50 dark:bg-sgt-900/30 text-sgt-700 dark:text-sgt-300 text-xs font-mono font-semibold border border-sgt-100 dark:border-sgt-800/50">
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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                  {note.category}{" "}
                  <span className="text-gray-300 dark:text-gray-600 mx-1 font-light">
                    /
                  </span>{" "}
                  {note.subcategory}
                </h1>
              </div>

              {/* Current Holder Badge */}
              {note.currentHolder && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-sgt-100 dark:bg-sgt-900/50 flex items-center justify-center text-sgt-700 dark:text-sgt-400 font-bold text-[10px] uppercase">
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
                className="noting-rich-content bg-gray-50 dark:bg-gray-900/20 px-4 py-3 rounded-md border border-gray-100 dark:border-gray-800 text-sm text-gray-800 dark:text-gray-200 [&>ol]:!list-decimal [&>ol]:!ml-6 [&>ol]:!pl-4 [&>ul]:!list-disc [&>ul]:!ml-6 [&>ul]:!pl-4 [&_ol]:!list-decimal [&_ol]:!ml-6 [&_ol]:!pl-4 [&_ul]:!list-disc [&_ul]:!ml-6 [&_ul]:!pl-4 [&_li]:!mb-1 [&_p]:!mb-2 [&_p]:!block [&_h1]:!text-2xl [&_h1]:!font-bold [&_h1]:!my-3 [&_h2]:!text-xl [&_h2]:!font-semibold [&_h2]:!my-2 [&_h3]:!text-lg [&_h3]:!font-semibold [&_h3]:!my-2 [&_blockquote]:!border-l-4 [&_blockquote]:!border-sgt-500 [&_blockquote]:!pl-4 [&_blockquote]:!italic [&_blockquote]:!my-2"
                dangerouslySetInnerHTML={{ __html: note.description || "" }}
              />
            </section>

            {/* Event Details */}
            {note.subcategory === "events" && (
              <section>
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                  Event Details
                </h3>

                {/* ── FESTIVAL ── */}
                {note.notingEventType === "festival" ? (
                  <div className="space-y-4">
                    {/* Festival Meta Card */}
                    {note.festivalMeta && (
                      <div className="rounded-md border border-purple-200 dark:border-purple-800 overflow-hidden">
                        <div className="bg-purple-50 dark:bg-purple-900/20 px-3 py-2 border-b border-purple-100 dark:border-purple-800">
                          <p className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                            🎪 Festival Information
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Festival Name
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.festivalMeta.name || "—"}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Coordinator
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.festivalMeta.coordinator || "—"}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Start Date & Time
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.festivalMeta.startDate
                                ? new Date(
                                    note.festivalMeta.startDate,
                                  ).toLocaleString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                : "—"}
                            </p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              End Date & Time
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.festivalMeta.endDate
                                ? new Date(
                                    note.festivalMeta.endDate,
                                  ).toLocaleString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                : "—"}
                            </p>
                          </div>
                          {note.festivalMeta.description && (
                            <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                Description
                              </label>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {note.festivalMeta.description}
                              </p>
                            </div>
                          )}
                        </div>
                        {note.status === "pending" && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900">
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              <span className="font-medium">
                                Auto-Creation:
                              </span>{" "}
                              When approved, all sub-events will be created in{" "}
                              <span className="font-semibold">DRAFT</span>{" "}
                              status.
                            </p>
                          </div>
                        )}
                        {note.status === "approved" && (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900">
                            <p className="text-xs text-emerald-700 dark:text-emerald-400">
                              <span className="font-medium">
                                Events Created.
                              </span>{" "}
                              Visit{" "}
                              <a
                                href="/events/my-events"
                                className="underline font-semibold"
                              >
                                My Created Events
                              </a>{" "}
                              to add details and publish.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sub-Events */}
                    {Array.isArray(note.subEvents) &&
                      note.subEvents.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                            Sub-Events ({note.subEvents.length})
                          </p>
                          <div className="space-y-3">
                            {note.subEvents.map((se, idx) => {
                              const v = se.venueFormData;
                              return (
                                <div
                                  key={idx}
                                  className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden"
                                >
                                  {/* Sub-event header */}
                                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                      #{idx + 1}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">
                                      {v.eventName || "(Unnamed)"}
                                    </span>
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${se.eventType === "stall" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"}`}
                                    >
                                      {se.eventType === "stall"
                                        ? "🪄 Stall-Based"
                                        : "🏛️ Venue"}
                                    </span>
                                  </div>
                                  {/* Sub-event body */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
                                    {v.eventType && (
                                      <div className="bg-white dark:bg-gray-800 p-3">
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                          Event Type
                                        </label>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                          {v.eventType.replace(/_/g, " ")}
                                        </p>
                                      </div>
                                    )}
                                    <div className="bg-white dark:bg-gray-800 p-3">
                                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                        Dates
                                      </label>
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {v.eventStartDate
                                          ? new Date(
                                              v.eventStartDate,
                                            ).toLocaleString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                              hour: "numeric",
                                              minute: "2-digit",
                                              hour12: true,
                                            })
                                          : "—"}
                                        {v.eventEndDate &&
                                        v.eventEndDate !== v.eventStartDate
                                          ? ` – ${new Date(v.eventEndDate).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}`
                                          : ""}
                                      </p>
                                    </div>
                                    {v.eventPaymentType && (
                                      <div className="bg-white dark:bg-gray-800 p-3">
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                          Payment
                                        </label>
                                        <span
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${v.eventPaymentType === "free" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}
                                        >
                                          {v.eventPaymentType.toUpperCase()}
                                          {v.eventPaymentType === "paid" &&
                                            (v.eventRegistrationFeeIndividual !=
                                              null ||
                                              v.eventRegistrationFeeTeam !=
                                                null) && (
                                              <span className="ml-1 font-normal">
                                                — ₹
                                                {Number(
                                                  v.eventParticipationType ===
                                                    "team"
                                                    ? v.eventRegistrationFeeTeam ||
                                                        0
                                                    : v.eventRegistrationFeeIndividual ||
                                                        0,
                                                ).toLocaleString()}{" "}
                                                {v.eventParticipationType ===
                                                "team"
                                                  ? "/team"
                                                  : "/person"}
                                              </span>
                                            )}
                                        </span>
                                      </div>
                                    )}
                                    {v.eventParticipationType && (
                                      <div className="bg-white dark:bg-gray-800 p-3">
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                          Participation
                                        </label>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                          {v.eventParticipationType}
                                        </p>
                                      </div>
                                    )}
                                    {v.eventApproxCapacity != null && (
                                      <div className="bg-white dark:bg-gray-800 p-3">
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                          Approx. Capacity
                                        </label>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                          {v.eventApproxCapacity}
                                        </p>
                                      </div>
                                    )}
                                    {v.eventDutyLeaveAvailable != null && (
                                      <div className="bg-white dark:bg-gray-800 p-3">
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                          Duty Leave
                                        </label>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                          {v.eventDutyLeaveAvailable
                                            ? "Yes"
                                            : "No"}
                                        </p>
                                        {v.eventDutyLeaveAvailable && (
                                          <p className="text-xs text-gray-500 mt-0.5">
                                            {Array.isArray(
                                              v.eventDutyLeaveEligibility,
                                            ) &&
                                            v.eventDutyLeaveEligibility.length >
                                              0
                                              ? `${v.eventDutyLeaveEligibility.map((e: string) => e.toUpperCase()).join(", ")}`
                                              : "All students"}
                                            {v.eventDutyLeaveRoleType
                                              ? ` • For: ${v.eventDutyLeaveRoleType}`
                                              : ""}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {v.eventCertification != null && (
                                      <div className="bg-white dark:bg-gray-800 p-3">
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                          Certificate
                                        </label>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                          {v.eventCertification
                                            ? "📜 Yes"
                                            : "No"}
                                        </p>
                                      </div>
                                    )}
                                    {v.eventHasSponsorship != null && (
                                      <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                          Sponsorship
                                        </label>
                                        {v.eventHasSponsorship &&
                                        Array.isArray(v.eventSponsors) &&
                                        v.eventSponsors.length > 0 ? (
                                          <div className="mt-1 space-y-0.5">
                                            {v.eventSponsors.map(
                                              (s: any, si: number) => (
                                                <p
                                                  key={si}
                                                  className="text-sm text-gray-900 dark:text-white"
                                                >
                                                  <span className="font-medium">
                                                    {s.name}
                                                  </span>
                                                  {s.type === "cash"
                                                    ? ` — ₹${Number(s.amount || 0).toLocaleString()}`
                                                    : ` — In-kind: ${s.notes || "—"}`}
                                                </p>
                                              ),
                                            )}
                                          </div>
                                        ) : (
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {v.eventHasSponsorship
                                              ? "Yes"
                                              : "No"}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {v.eventHasResources != null && (
                                      <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                          Resources
                                        </label>
                                        {v.eventHasResources &&
                                        Array.isArray(v.eventResources) &&
                                        v.eventResources.length > 0 ? (
                                          <div className="mt-1 space-y-0.5">
                                            {v.eventResources.map(
                                              (r: any, ri: number) => (
                                                <p
                                                  key={ri}
                                                  className="text-sm text-gray-900 dark:text-white"
                                                >
                                                  <span className="font-medium capitalize">
                                                    {r.type}
                                                  </span>
                                                  {r.description
                                                    ? ` — ${r.description}`
                                                    : ""}
                                                  {r.pricePerPiece != null &&
                                                  r.quantity != null
                                                    ? ` (₹${r.pricePerPiece} × ${r.quantity} = ₹${Number(r.pricePerPiece) * Number(r.quantity)})`
                                                    : ""}
                                                </p>
                                              ),
                                            )}
                                          </div>
                                        ) : (
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {v.eventHasResources ? "Yes" : "No"}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    {Array.isArray(v.eventPrizesAwards) &&
                                      v.eventPrizesAwards.length > 0 && (
                                        <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                            🏆 Prizes / Awards
                                          </label>
                                          <div className="space-y-1">
                                            {v.eventPrizesAwards.map(
                                              (p: any, pi: number) => (
                                                <div
                                                  key={pi}
                                                  className="flex items-start gap-2 text-sm text-gray-900 dark:text-white"
                                                >
                                                  <span className="font-semibold text-gray-500 min-w-[70px]">
                                                    {p.rank}
                                                  </span>
                                                  <span>
                                                    {p.prizeType === "cash" &&
                                                    p.prizeAmount
                                                      ? `₹${Number(p.prizeAmount).toLocaleString()}`
                                                      : p.title || p.prizeType}
                                                  </span>
                                                  {Array.isArray(
                                                    p.additionalPerks,
                                                  ) &&
                                                    p.additionalPerks.length >
                                                      0 && (
                                                      <span className="text-xs text-gray-400">
                                                        +
                                                        {p.additionalPerks.join(
                                                          ", ",
                                                        )}
                                                      </span>
                                                    )}
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                  {/* Stall config for stall-type sub-events */}
                                  {se.eventType === "stall" &&
                                    se.stallConfig && (
                                      <div className="border-t border-gray-200 dark:border-gray-700 bg-amber-50/30 dark:bg-amber-900/10 p-3">
                                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                                          Stall Configuration
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                                          <div>
                                            <span className="font-medium">
                                              Student-Applied Stalls:
                                            </span>{" "}
                                            {se.stallConfig.enableStudentApplied
                                              ? `Yes (max ${se.stallConfig.maxStudentStalls ?? "—"})`
                                              : "No"}
                                          </div>
                                          {se.stallConfig
                                            .enableStudentApplied &&
                                            se.stallConfig.stallFee != null && (
                                              <div>
                                                <span className="font-medium">
                                                  Stall Fee:
                                                </span>{" "}
                                                ₹{se.stallConfig.stallFee}
                                              </div>
                                            )}
                                          {se.stallConfig
                                            .enableStudentApplied &&
                                            se.stallConfig
                                              .applicationDeadline && (
                                              <div>
                                                <span className="font-medium">
                                                  Application Deadline:
                                                </span>{" "}
                                                {
                                                  se.stallConfig
                                                    .applicationDeadline
                                                }
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  /* ── VENUE / STALL ── */
                  <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {!note.eventName &&
                    !note.eventType &&
                    !note.eventStartDate ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic p-4">
                        Event details not provided.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
                        {note.eventName && (
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Event Name
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.eventName}
                            </p>
                          </div>
                        )}
                        {note.eventType && (
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Event Type
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                              {note.eventType.replace(/_/g, " ")}
                            </p>
                          </div>
                        )}
                        {note.eventStartDate && (
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Start
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(note.eventStartDate).toLocaleString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                },
                              )}
                            </p>
                          </div>
                        )}
                        {note.eventEndDate && (
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              End
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(note.eventEndDate).toLocaleString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                },
                              )}
                            </p>
                          </div>
                        )}
                        {note.eventPaymentType && (
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Payment Type
                            </label>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${note.eventPaymentType === "free" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}
                            >
                              {note.eventPaymentType.toUpperCase()}
                            </span>
                          </div>
                        )}
                        {note.eventParticipationType && (
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Participation
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                              {note.eventParticipationType.replace("_", " ")}
                            </p>
                          </div>
                        )}
                        {note.eventPaymentType === "paid" &&
                          (note.eventRegistrationFeeIndividual != null ||
                            note.eventRegistrationFeeTeam != null) && (
                            <div className="bg-white dark:bg-gray-800 p-3">
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                                Fee
                              </label>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {note.eventParticipationType === "team"
                                  ? `₹ ${Number(note.eventRegistrationFeeTeam || 0).toLocaleString()} per team`
                                  : `₹ ${Number(note.eventRegistrationFeeIndividual || 0).toLocaleString()} per person`}
                              </p>
                            </div>
                          )}
                        {note.eventApproxCapacity != null && (
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Approx. Capacity
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.eventApproxCapacity}
                            </p>
                          </div>
                        )}
                        {note.eventDutyLeaveAvailable != null && (
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Duty Leave
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.eventDutyLeaveAvailable ? "Yes" : "No"}
                            </p>
                            {note.eventDutyLeaveAvailable && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {Array.isArray(
                                  note.eventDutyLeaveEligibility,
                                ) && note.eventDutyLeaveEligibility.length > 0
                                  ? `Eligible: ${(note.eventDutyLeaveEligibility as string[]).map((e) => (e === "ug" ? "UG" : e === "pg" ? "PG" : e === "phd" ? "PhD" : e)).join(", ")}`
                                  : "Students (UG, PG, PhD)"}
                                {note.eventDutyLeaveRoleType
                                  ? ` • For: ${note.eventDutyLeaveRoleType}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        )}
                        {note.eventCertification != null && (
                          <div className="bg-white dark:bg-gray-800 p-3">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Certificate
                            </label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {note.eventCertification ? "📜 Yes" : "No"}
                            </p>
                          </div>
                        )}
                        {note.eventHasSponsorship != null && (
                          <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Sponsorship
                            </label>
                            {note.eventHasSponsorship &&
                            Array.isArray(note.eventSponsors) &&
                            note.eventSponsors.length > 0 ? (
                              <div className="mt-1 space-y-1">
                                {note.eventSponsors.map((s, i) => (
                                  <div
                                    key={i}
                                    className="text-sm text-gray-900 dark:text-white"
                                  >
                                    <span className="font-medium">
                                      {s.name}
                                    </span>
                                    {s.type === "cash" ? (
                                      <span className="text-gray-600 dark:text-gray-300">
                                        {" "}
                                        — ₹{" "}
                                        {Number(s.amount || 0).toLocaleString()}
                                      </span>
                                    ) : (
                                      <span className="text-gray-600 dark:text-gray-300">
                                        {" "}
                                        — In-kind: {s.notes || "—"}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {note.eventHasSponsorship
                                  ? "Yes (details not provided)"
                                  : "No"}
                              </p>
                            )}
                          </div>
                        )}
                        {note.eventHasResources != null && (
                          <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                              Resources
                            </label>
                            {note.eventHasResources &&
                            Array.isArray(note.eventResources) &&
                            note.eventResources.length > 0 ? (
                              <div className="mt-1 space-y-1">
                                {note.eventResources.map((r, i) => (
                                  <div
                                    key={i}
                                    className="text-sm text-gray-900 dark:text-white"
                                  >
                                    <span className="font-medium capitalize">
                                      {r.type}
                                    </span>
                                    {r.description ? ` — ${r.description}` : ""}
                                    {r.pricePerPiece != null &&
                                    r.quantity != null
                                      ? ` (₹${r.pricePerPiece} × ${r.quantity} = ₹${Number(r.pricePerPiece) * Number(r.quantity)})`
                                      : ""}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {note.eventHasResources
                                  ? "Yes (details not provided)"
                                  : "No"}
                              </p>
                            )}
                          </div>
                        )}
                        {Array.isArray(note.eventPrizesAwards) &&
                          note.eventPrizesAwards.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 p-3 sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                🏆 Prizes / Awards
                              </label>
                              <div className="space-y-1">
                                {note.eventPrizesAwards.map((p, i) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-2 text-sm text-gray-900 dark:text-white"
                                  >
                                    <span className="font-semibold text-gray-500 min-w-[90px]">
                                      {p.rank}
                                    </span>
                                    <span>
                                      {p.prizeType === "cash" && p.prizeAmount
                                        ? `₹${Number(p.prizeAmount).toLocaleString()}`
                                        : p.title || p.prizeType}
                                    </span>
                                    {Array.isArray(p.additionalPerks) &&
                                      p.additionalPerks.length > 0 && (
                                        <span className="text-xs text-gray-400">
                                          +{p.additionalPerks.join(", ")}
                                        </span>
                                      )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Stall Config (for stall events) */}
                    {note.notingEventType === "stall" && note.stallConfig && (
                      <div className="border-t border-gray-200 dark:border-gray-700 bg-amber-50/30 dark:bg-amber-900/10 p-3">
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
                          🪄 Stall Configuration
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                          <div>
                            <span className="font-medium">
                              Student-Applied Stalls:
                            </span>{" "}
                            {note.stallConfig.enableStudentApplied
                              ? `Yes (max ${note.stallConfig.maxStudentStalls ?? "—"})`
                              : "No"}
                          </div>
                          {note.stallConfig.enableStudentApplied &&
                            note.stallConfig.stallFee != null && (
                              <div>
                                <span className="font-medium">Stall Fee:</span>{" "}
                                ₹{note.stallConfig.stallFee}
                              </div>
                            )}
                          {note.stallConfig.enableStudentApplied &&
                            note.stallConfig.applicationDeadline && (
                              <div>
                                <span className="font-medium">
                                  Application Deadline:
                                </span>{" "}
                                {note.stallConfig.applicationDeadline}
                              </div>
                            )}
                        </div>
                      </div>
                    )}

                    {note.eventName && note.status === "pending" && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900">
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          <span className="font-medium">Auto-Creation:</span>{" "}
                          When approved, an event will be created in{" "}
                          <span className="font-semibold">DRAFT</span> status.
                        </p>
                      </div>
                    )}
                    {note.eventName && note.status === "approved" && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          <span className="font-medium">Event Created.</span>{" "}
                          Visit{" "}
                          <a
                            href="/events/my-events"
                            className="underline font-semibold"
                          >
                            My Created Events
                          </a>{" "}
                          to add details and publish.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Requirements / Points */}
            {note.points && note.points.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                  Requirements / Points
                </h3>
                <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 p-4">
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                    {note.points.map((pt, i) => (
                      <li key={pt.id || i} className="leading-relaxed">
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
                        className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:border-sgt-200 dark:hover:border-sgt-800 transition-colors"
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
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-sgt-600 transition-colors"
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
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-sgt-600 transition-colors"
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
              <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
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
                      className={`inline-flex items-center gap-1 text-sm font-medium mt-0.5 ${
                        note.policyCompliant === true
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
              <div className="bg-gray-50 dark:bg-gray-900/20 rounded-md border border-gray-100 dark:border-gray-700 p-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-sgt-100 dark:bg-sgt-900/30 flex items-center justify-center text-sgt-700 dark:text-sgt-300 font-bold text-sm">
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
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                  Approval Trail
                </h3>
                <div className="relative pl-5 space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-0 before:w-px before:bg-gray-200 dark:before:bg-gray-700 max-h-[500px] overflow-y-auto">
                  {note.history.map((h) => {
                    let iconColor = "bg-gray-400";
                    let Icon: React.ElementType = Clock;
                    const action = h.action.toLowerCase();
                    if (action.includes("submit")) {
                      Icon = Send;
                      iconColor = "bg-sgt-600";
                    } else if (action.includes("approve")) {
                      Icon = CheckCircle;
                      iconColor = "bg-emerald-600";
                    } else if (action === "recommended") {
                      Icon = ThumbsUp;
                      iconColor = "bg-blue-600";
                    } else if (action === "not_recommended") {
                      Icon = ThumbsDown;
                      iconColor = "bg-rose-600";
                    } else if (action === "copy_sent") {
                      Icon = Copy;
                      iconColor = "bg-indigo-500";
                    } else if (action === "copy_forwarded") {
                      Icon = AlertTriangle;
                      iconColor = "bg-amber-600";
                    } else if (action === "copy_completed") {
                      Icon = CheckCircle;
                      iconColor = "bg-emerald-600";
                    } else if (action.includes("reject")) {
                      Icon = XCircle;
                      iconColor = "bg-red-500";
                    } else if (action.includes("revert")) {
                      Icon = RotateCcw;
                      iconColor = "bg-orange-500";
                    } else if (action.includes("forward")) {
                      Icon = ArrowRight;
                      iconColor = "bg-sgt-500";
                    }

                    return (
                      <div key={h.id} className="relative">
                        <div className="absolute -left-[13px] top-0.5">
                          <div
                            className={`h-[14px] w-[14px] rounded-full ${iconColor} border-2 border-white dark:border-gray-800 flex items-center justify-center`}
                          >
                            <Icon className="w-2 h-2 text-white" />
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-md p-3 border border-gray-100 dark:border-gray-700/50 text-sm">
                          <div className="font-medium text-gray-900 dark:text-white capitalize text-[13px]">
                            {h.action}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                            {getDisplayName(h.performedBy)} •{" "}
                            {new Date(h.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          {h.remarks && (
                            <div className="text-gray-600 dark:text-gray-300 text-[13px] italic mt-2 pl-2.5 border-l-2 border-gray-200 dark:border-gray-600">
                              {h.remarks}
                            </div>
                          )}
                          {h.nextHolder && (
                            <div className="flex items-center gap-1 text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-sgt-600 dark:text-sgt-400 font-medium">
                              <CornerDownLeft className="w-3 h-3" />
                              Assigned: {getDisplayName(h.nextHolder)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ===== Inline Actions ===== */}
            {showActionsSection && (
              <section className="pt-5 mt-2 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                  Actions
                </h3>
                <div className="space-y-3">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none ${!remarks.trim() ? "border-red-300 dark:border-red-600" : "border-gray-200 dark:border-gray-600"}`}
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
                    <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 p-3 space-y-2.5">
                      {/* Radio Options */}
                      <div className="flex items-center gap-5">
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
                              setSearchResults([]);
                            }}
                            className="w-3.5 h-3.5 text-sgt-600 accent-sgt-600"
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
                              setManagerInfo(null);
                            }}
                            className="w-3.5 h-3.5 text-sgt-600 accent-sgt-600"
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
                            className="w-full px-3 py-1.5 text-xs bg-sgt-600 text-white rounded hover:bg-sgt-700 disabled:opacity-50 font-medium inline-flex items-center justify-center gap-1"
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
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
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
                                    setSearchResults([]);
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
                        className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors"
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
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors"
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
                        className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors"
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
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors"
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
                        className="px-4 py-2 text-sm bg-rose-600 text-white rounded-md hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors"
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
                        className={`px-4 py-2 text-sm border rounded-md flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50 ${
                          actionType === "forward"
                            ? "bg-sgt-50 dark:bg-sgt-900/20 border-sgt-300 text-sgt-700 dark:text-sgt-300"
                            : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
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
                        className="px-4 py-2 text-sm bg-sgt-600 text-white rounded-md hover:bg-sgt-700 disabled:opacity-50 font-medium transition-colors"
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
            {/* ===== Post-Approval Copy Sharing ===== */}
            {note.status === "approved" &&
              note.createdById === currentUserId && (
                <section className="pt-5 mt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                      Post-Approval Copy Sharing
                    </h3>
                    <button
                      onClick={() => setShowCopyPanel(!showCopyPanel)}
                      className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1.5 font-medium transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" />
                      {showCopyPanel ? "Cancel" : "Send Copy"}
                    </button>
                  </div>

                  {/* Send Copy Panel */}
                  {showCopyPanel && (
                    <div className="rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 space-y-3 mb-4">
                      {/* Selected Users */}
                      {selectedCopyUsers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedCopyUsers.map((u) => (
                            <span
                              key={u.id}
                              className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium px-2 py-1 rounded-full"
                            >
                              {u.displayName}
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedCopyUsers((prev) =>
                                    prev.filter((p) => p.id !== u.id),
                                  )
                                }
                                className="hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          value={copySearchQuery}
                          onChange={(e) => setCopySearchQuery(e.target.value)}
                          placeholder="Search users by name, UID or emp ID..."
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                        {copySearchLoading && (
                          <LoadingSpinner
                            size="sm"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                          />
                        )}
                      </div>
                      {/* Search Results */}
                      {copySearchQuery.trim().length >= 2 && (
                        <div className="max-h-40 overflow-y-auto rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                          {copySearchResults.length === 0 &&
                            !copySearchLoading && (
                              <p className="px-3 py-2 text-xs text-gray-500 text-center">
                                No users found
                              </p>
                            )}
                          {copySearchResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedCopyUsers((prev) => [
                                  ...prev,
                                  {
                                    id: u.id,
                                    uid: u.uid,
                                    displayName: u.displayName,
                                    department: u.department,
                                  },
                                ]);
                                setCopySearchQuery("");
                                setCopySearchResults([]);
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
                      {/* Remarks */}
                      <textarea
                        value={copyRemarks}
                        onChange={(e) => setCopyRemarks(e.target.value)}
                        rows={2}
                        className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${!copyRemarks.trim() ? "border-red-300" : "border-gray-200 dark:border-gray-600"}`}
                        placeholder="Instructions / remarks for assigned users (mandatory)..."
                      />
                      {/* Send Button */}
                      <button
                        onClick={doSendCopy}
                        disabled={
                          copySendLoading ||
                          selectedCopyUsers.length === 0 ||
                          !copyRemarks.trim()
                        }
                        className="w-full px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {copySendLoading ? (
                          <LoadingSpinner size="sm" className="w-3.5 h-3.5" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        Send Copy to {selectedCopyUsers.length} User(s)
                      </button>
                    </div>
                  )}

                  {/* Copies List */}
                  {copiesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : copies.length > 0 ? (
                    (() => {
                      const groupKey = (c: NoteCopy) => c.rootCopyId || c.id;
                      const groups = new Map<string, NoteCopy[]>();
                      for (const c of copies) {
                        const key = groupKey(c);
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key)!.push(c);
                      }
                      const rootById = new Map(copies.map((c) => [c.id, c]));

                      return (
                        <div className="space-y-3">
                          {Array.from(groups.entries()).map(
                            ([rootId, groupCopies]) => {
                              const rootCopy =
                                rootById.get(rootId) ||
                                groupCopies.find((c) => c.id === rootId) ||
                                groupCopies[0];
                              const assigneeName =
                                rootCopy.assignedTo?.employeeDetails
                                  ?.displayName ||
                                rootCopy.assignedTo?.uid ||
                                "Unknown";
                              const assigneeInitial = assigneeName
                                .charAt(0)
                                .toUpperCase();
                              const sorted = [...groupCopies].sort(
                                (a, b) =>
                                  new Date(a.createdAt).getTime() -
                                  new Date(b.createdAt).getTime(),
                              );
                              const latestStatus = groupCopies.some(
                                (c) => c.status === "completed",
                              )
                                ? "completed"
                                : groupCopies.some(
                                      (c) => c.status === "replied",
                                    )
                                  ? "replied"
                                  : groupCopies.some(
                                        (c) => c.status === "forwarded",
                                      )
                                    ? "forwarded"
                                    : "pending";
                              const statusColor =
                                latestStatus === "completed"
                                  ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                                  : latestStatus === "replied"
                                    ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                                    : latestStatus === "forwarded"
                                      ? "text-amber-600 bg-amber-50 border-amber-200"
                                      : "text-gray-600 bg-gray-50 border-gray-200";
                              const maxLevel = Math.max(
                                ...groupCopies.map(
                                  (c) => c.escalationLevel || 0,
                                ),
                                0,
                              );
                              const isExpanded = expandedCopyId === rootId;
                              const actionCopy = groupCopies.find(
                                (c) => c.status === "replied",
                              );
                              // One reply per level — only show Reply when status is pending (not yet replied)
                              const replyCopy = groupCopies.find(
                                (c) =>
                                  c.assignedToId === currentUserId &&
                                  c.status === "pending",
                              );

                              const getRemarksPreview = (r: string) => {
                                try {
                                  const p = JSON.parse(r);
                                  return (
                                    p.senderRemarks ||
                                    p.systemWarning ||
                                    (typeof p === "string" ? p : r)
                                  );
                                } catch {
                                  return r;
                                }
                              };

                              return (
                                <div
                                  key={rootId}
                                  className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const opening = !isExpanded;
                                      const nextExpanded = opening
                                        ? rootId
                                        : null;
                                      setExpandedCopyId(nextExpanded);
                                      if (opening && nextExpanded) {
                                        const idsInGroup = groupCopies.map(
                                          (c: any) => c.id,
                                        );
                                        if (
                                          forwardingCopyId &&
                                          !idsInGroup.includes(forwardingCopyId)
                                        ) {
                                          setForwardingCopyId(null);
                                          setForwardCopyRemarks("");
                                        }
                                        if (
                                          replyingCopyId &&
                                          !idsInGroup.includes(replyingCopyId)
                                        ) {
                                          setReplyingCopyId(null);
                                          setReplyRemarks("");
                                          setReplyAttachments([]);
                                        }
                                      }
                                    }}
                                    className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left transition-colors"
                                  >
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-xs font-bold">
                                      {assigneeInitial}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                          {assigneeName}
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${statusColor}`}
                                        >
                                          {latestStatus}
                                        </span>
                                        {maxLevel > 0 && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-50 text-red-600 border border-red-200 flex items-center gap-0.5">
                                            <AlertTriangle className="w-2.5 h-2.5" />{" "}
                                            L{maxLevel}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-gray-400">
                                          {groupCopies.length} step
                                          {groupCopies.length > 1 ? "s" : ""}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                        {getRemarksPreview(rootCopy.remarks)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-gray-400">
                                        {new Date(
                                          rootCopy.createdAt,
                                        ).toLocaleString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-gray-400" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                      )}
                                    </div>
                                  </button>

                                  {isExpanded && (
                                    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-900/20 space-y-4">
                                      {/* ── Vertical Flowchart: interleave worker replies with escalation ── */}
                                      {(() => {
                                        const creatorName = getDisplayName(
                                          note?.createdBy,
                                        );
                                        const workerName = assigneeName;
                                        const rootAssigneeId = (rootCopy as any)
                                          .assignedToId;
                                        const filteredCopies = sorted.filter(
                                          (c) =>
                                            (c as any).assignedToId ===
                                            rootAssigneeId,
                                        );
                                        const isDone =
                                          latestStatus === "completed" ||
                                          latestStatus === "replied";

                                        const escalationCopies = sorted
                                          .filter(
                                            (c) =>
                                              (c as any).assignedToId !==
                                              rootAssigneeId,
                                          )
                                          .sort(
                                            (a, b) =>
                                              new Date(a.createdAt).getTime() -
                                              new Date(b.createdAt).getTime(),
                                          );

                                        const allWorkerReplies = filteredCopies
                                          .flatMap((c) =>
                                            (c.replies || []).filter(
                                              (r) =>
                                                r.repliedBy?.id ===
                                                rootAssigneeId,
                                            ),
                                          )
                                          .sort(
                                            (a, b) =>
                                              new Date(a.createdAt).getTime() -
                                              new Date(b.createdAt).getTime(),
                                          );

                                        const creatorReplies = filteredCopies
                                          .flatMap((c) =>
                                            (c.replies || []).filter(
                                              (r) =>
                                                r.repliedBy?.id ===
                                                (note as any)?.createdById,
                                            ),
                                          )
                                          .sort(
                                            (a, b) =>
                                              new Date(a.createdAt).getTime() -
                                              new Date(b.createdAt).getTime(),
                                          );

                                        // Build timeline: interleave worker replies between escalation boundaries
                                        type TimelineItem =
                                          | {
                                              type: "worker-reply";
                                              reply: any;
                                              attempt: number;
                                            }
                                          | {
                                              type: "escalation-group";
                                              copies: NoteCopy[];
                                            };
                                        const timeline: TimelineItem[] = [];

                                        const escTimes = escalationCopies.map(
                                          (c) =>
                                            new Date(c.createdAt).getTime(),
                                        );
                                        let attempt = 1;
                                        for (const r of allWorkerReplies) {
                                          const rTime = new Date(
                                            r.createdAt,
                                          ).getTime();
                                          // Insert any escalations that happened before this reply, grouped by proximity
                                          while (
                                            escalationCopies.length > 0 &&
                                            escTimes[0] <= rTime
                                          ) {
                                            const esc =
                                              escalationCopies.shift()!;
                                            const escTime = escTimes.shift()!;
                                            // Check if this belongs to the last escalation group (within 10s)
                                            const lastItem =
                                              timeline[timeline.length - 1];
                                            if (
                                              lastItem &&
                                              lastItem.type ===
                                                "escalation-group"
                                            ) {
                                              const lastTime = new Date(
                                                lastItem.copies[0].createdAt,
                                              ).getTime();
                                              if (
                                                Math.abs(escTime - lastTime) <
                                                10000
                                              ) {
                                                lastItem.copies.push(esc);
                                                continue;
                                              }
                                            }
                                            timeline.push({
                                              type: "escalation-group",
                                              copies: [esc],
                                            });
                                          }
                                          timeline.push({
                                            type: "worker-reply",
                                            reply: r,
                                            attempt,
                                          });
                                          attempt++;
                                        }
                                        // Any remaining escalations after all replies
                                        for (
                                          let ei = 0;
                                          ei < escalationCopies.length;
                                          ei++
                                        ) {
                                          const esc = escalationCopies[ei];
                                          const escTime = new Date(
                                            esc.createdAt,
                                          ).getTime();
                                          const lastItem =
                                            timeline[timeline.length - 1];
                                          if (
                                            lastItem &&
                                            lastItem.type === "escalation-group"
                                          ) {
                                            const lastTime = new Date(
                                              lastItem.copies[0].createdAt,
                                            ).getTime();
                                            if (
                                              Math.abs(escTime - lastTime) <
                                              10000
                                            ) {
                                              lastItem.copies.push(esc);
                                              continue;
                                            }
                                          }
                                          timeline.push({
                                            type: "escalation-group",
                                            copies: [esc],
                                          });
                                        }

                                        const fmtTime = (d: string) =>
                                          new Date(d).toLocaleString(
                                            undefined,
                                            {
                                              month: "short",
                                              day: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            },
                                          );

                                        const ordinal = (n: number) =>
                                          n === 1
                                            ? "1st"
                                            : n === 2
                                              ? "2nd"
                                              : n === 3
                                                ? "3rd"
                                                : `${n}th`;

                                        return (
                                          <div className="flex flex-col items-center w-full max-w-lg mx-auto">
                                            {/* ── Node: Creator ── */}
                                            <div className="w-full rounded-xl border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                                              <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                  {creatorName.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                  <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 truncate">
                                                    {creatorName}
                                                  </p>
                                                  <p className="text-[10px] text-indigo-500 dark:text-indigo-400">
                                                    Creator
                                                  </p>
                                                </div>
                                              </div>
                                              <div className="px-4 py-2.5">
                                                <p className="text-xs text-gray-600 dark:text-gray-300">
                                                  {filteredCopies.length > 0
                                                    ? getRemarksPreview(
                                                        filteredCopies[0]
                                                          .remarks,
                                                      )
                                                    : "—"}
                                                </p>
                                                {creatorReplies.length > 0 && (
                                                  <div className="mt-2 space-y-1.5">
                                                    {creatorReplies.map(
                                                      (r: any) => (
                                                        <div
                                                          key={r.id}
                                                          className="flex items-start gap-2 bg-indigo-50/60 dark:bg-indigo-900/10 rounded-md px-2.5 py-1.5"
                                                        >
                                                          <MessageSquare className="w-3 h-3 text-indigo-500 mt-0.5 flex-shrink-0" />
                                                          <div className="min-w-0 flex-1">
                                                            <p className="text-xs text-gray-700 dark:text-gray-300">
                                                              {r.remarks}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                              {fmtTime(
                                                                r.createdAt,
                                                              )}
                                                            </p>
                                                          </div>
                                                        </div>
                                                      ),
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>

                                            {/* ── Connector ── */}
                                            <div className="flex flex-col items-center py-0.5">
                                              <div className="w-0.5 h-4 bg-gradient-to-b from-indigo-300 to-emerald-300 dark:from-indigo-600 dark:to-emerald-600 rounded-full" />
                                              <span className="text-[9px] text-gray-400 font-medium">
                                                assigned to
                                              </span>
                                              <div className="w-0.5 h-2 bg-emerald-300 dark:bg-emerald-600 rounded-full" />
                                            </div>

                                            {/* ── Node: Worker header ── */}
                                            <div className="w-full rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                                              <div className="bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                  <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                    {workerName.charAt(0)}
                                                  </div>
                                                  <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 truncate">
                                                      {workerName}
                                                    </p>
                                                    <p className="text-[10px] text-emerald-500 dark:text-emerald-400">
                                                      Worker (Assignee)
                                                    </p>
                                                  </div>
                                                </div>
                                                <span
                                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isDone ? "bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200" : "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"}`}
                                                >
                                                  {isDone ? "Done" : "Not Done"}
                                                </span>
                                              </div>
                                            </div>

                                            {/* ── Timeline: worker replies interleaved with escalations ── */}
                                            {timeline.length > 0 ? (
                                              timeline.map((item, idx) => {
                                                if (
                                                  item.type === "worker-reply"
                                                ) {
                                                  const r = item.reply;
                                                  return (
                                                    <React.Fragment key={r.id}>
                                                      <div className="flex flex-col items-center py-0.5">
                                                        <div className="w-0.5 h-3 bg-emerald-200 dark:bg-emerald-700 rounded-full" />
                                                      </div>
                                                      <div className="w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/10 px-4 py-2.5 shadow-sm">
                                                        <div className="flex items-center gap-2 mb-1">
                                                          <CornerDownLeft className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                                                            {ordinal(
                                                              item.attempt,
                                                            )}{" "}
                                                            reply by{" "}
                                                            {workerName}
                                                          </span>
                                                          <span className="text-[10px] text-gray-400 ml-auto">
                                                            {fmtTime(
                                                              r.createdAt,
                                                            )}
                                                          </span>
                                                        </div>
                                                        <p className="text-xs text-gray-700 dark:text-gray-300 ml-5">
                                                          {r.remarks}
                                                        </p>
                                                        {r.attachments &&
                                                          Array.isArray(
                                                            r.attachments,
                                                          ) &&
                                                          (
                                                            r.attachments as {
                                                              filePath: string;
                                                              fileName: string;
                                                            }[]
                                                          ).length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1 ml-5">
                                                              {(
                                                                r.attachments as {
                                                                  filePath: string;
                                                                  fileName: string;
                                                                }[]
                                                              ).map(
                                                                (
                                                                  att: {
                                                                    filePath: string;
                                                                    fileName: string;
                                                                  },
                                                                  i: number,
                                                                ) => (
                                                                  <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={async () => {
                                                                      try {
                                                                        await notingService.downloadAttachment(
                                                                          att.filePath,
                                                                          att.fileName,
                                                                        );
                                                                      } catch {
                                                                        toast({
                                                                          type: "error",
                                                                          message:
                                                                            "Download failed",
                                                                        });
                                                                      }
                                                                    }}
                                                                    className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5"
                                                                  >
                                                                    <Paperclip className="w-2.5 h-2.5" />{" "}
                                                                    {
                                                                      att.fileName
                                                                    }
                                                                  </button>
                                                                ),
                                                              )}
                                                            </div>
                                                          )}
                                                      </div>
                                                    </React.Fragment>
                                                  );
                                                } else if (
                                                  item.type ===
                                                  "escalation-group"
                                                ) {
                                                  // Parse escalation remarks for display
                                                  let escRemarks = "";
                                                  try {
                                                    const parsed = JSON.parse(
                                                      item.copies[0].remarks,
                                                    );
                                                    escRemarks =
                                                      parsed.senderRemarks ||
                                                      "";
                                                  } catch {
                                                    /* plain text */ escRemarks =
                                                      item.copies[0].remarks ||
                                                      "";
                                                  }

                                                  const highestLevel = Math.max(
                                                    ...item.copies.map(
                                                      (c: any) =>
                                                        c.escalationLevel ?? 1,
                                                    ),
                                                  );

                                                  return (
                                                    <React.Fragment
                                                      key={item.copies[0].id}
                                                    >
                                                      {/* ── Creator's escalation message ── */}
                                                      <div className="flex flex-col items-center py-0.5">
                                                        <div className="w-0.5 h-3 bg-amber-200 dark:bg-amber-700 rounded-full" />
                                                      </div>
                                                      <div className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-900/20 px-4 py-2.5 shadow-sm">
                                                        <div className="flex items-center gap-2 mb-1">
                                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">
                                                            Escalated by{" "}
                                                            {creatorName}
                                                          </span>
                                                          <span className="text-[10px] text-gray-400 ml-auto">
                                                            {fmtTime(
                                                              item.copies[0]
                                                                .createdAt,
                                                            )}
                                                          </span>
                                                        </div>
                                                        {escRemarks && (
                                                          <p className="text-xs text-gray-700 dark:text-gray-300 ml-5 italic">
                                                            &ldquo;{escRemarks}
                                                            &rdquo;
                                                          </p>
                                                        )}
                                                      </div>

                                                      {/* ── Fork: All Bosses + Worker ── */}
                                                      <div className="flex flex-col items-center py-0.5">
                                                        <div className="w-0.5 h-3 border-l-2 border-dashed border-amber-300 dark:border-amber-600" />
                                                      </div>
                                                      <div className="w-full flex gap-2 flex-wrap justify-center">
                                                        {/* Boss branches — sorted by level ascending */}
                                                        {item.copies
                                                          .sort(
                                                            (a: any, b: any) =>
                                                              (a.escalationLevel ??
                                                                1) -
                                                              (b.escalationLevel ??
                                                                1),
                                                          )
                                                          .map(
                                                            (bossCopy: any) => {
                                                              const bossLevel =
                                                                bossCopy.escalationLevel ??
                                                                1;
                                                              const bName =
                                                                bossCopy
                                                                  .assignedTo
                                                                  ?.employeeDetails
                                                                  ?.displayName ||
                                                                bossCopy
                                                                  .assignedTo
                                                                  ?.uid ||
                                                                "Unknown";
                                                              const bColors =
                                                                bossLevel <= 1
                                                                  ? {
                                                                      border:
                                                                        "border-amber-300 dark:border-amber-700",
                                                                      bg: "bg-amber-50 dark:bg-amber-900/30",
                                                                      avatar:
                                                                        "bg-amber-500",
                                                                      text: "text-amber-800 dark:text-amber-200",
                                                                      sub: "text-amber-500 dark:text-amber-400",
                                                                    }
                                                                  : {
                                                                      border:
                                                                        "border-red-300 dark:border-red-700",
                                                                      bg: "bg-red-50 dark:bg-red-900/30",
                                                                      avatar:
                                                                        "bg-red-500",
                                                                      text: "text-red-800 dark:text-red-200",
                                                                      sub: "text-red-500 dark:text-red-400",
                                                                    };
                                                              return (
                                                                <div
                                                                  key={
                                                                    bossCopy.id
                                                                  }
                                                                  className="flex-1 min-w-[120px] flex flex-col items-center"
                                                                >
                                                                  <span className="text-[9px] text-amber-500 font-semibold mb-1">
                                                                    NOTIFIED
                                                                  </span>
                                                                  <div className="w-0.5 h-3 border-l-2 border-dashed border-amber-300 dark:border-amber-600" />
                                                                  <div
                                                                    className={`w-full rounded-xl border-2 ${bColors.border} bg-white dark:bg-gray-800 shadow-sm overflow-hidden`}
                                                                  >
                                                                    <div
                                                                      className={`${bColors.bg} px-3 py-2 flex items-center gap-2`}
                                                                    >
                                                                      <div
                                                                        className={`w-6 h-6 rounded-full ${bColors.avatar} text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0`}
                                                                      >
                                                                        {bName.charAt(
                                                                          0,
                                                                        )}
                                                                      </div>
                                                                      <div className="min-w-0">
                                                                        <p
                                                                          className={`text-[11px] font-semibold ${bColors.text} truncate`}
                                                                        >
                                                                          {
                                                                            bName
                                                                          }
                                                                        </p>
                                                                        <p
                                                                          className={`text-[9px] ${bColors.sub}`}
                                                                        >
                                                                          {bossLevel <=
                                                                          1
                                                                            ? "Boss"
                                                                            : bossLevel ===
                                                                                highestLevel
                                                                              ? `Boss's Boss`
                                                                              : `Boss`}{" "}
                                                                          (L
                                                                          {
                                                                            bossLevel
                                                                          }
                                                                          )
                                                                        </p>
                                                                      </div>
                                                                    </div>
                                                                    <div className="px-3 py-1.5">
                                                                      <p className="text-[10px] text-gray-400 italic text-center">
                                                                        Feedback
                                                                        hidden
                                                                      </p>
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              );
                                                            },
                                                          )}
                                                        {/* Worker branch (reassigned) */}
                                                        <div className="flex-1 min-w-[120px] flex flex-col items-center">
                                                          <span className="text-[9px] text-emerald-500 font-semibold mb-1">
                                                            REASSIGNED
                                                          </span>
                                                          <div className="w-0.5 h-3 border-l-2 border-dashed border-emerald-300 dark:border-emerald-600" />
                                                          <div className="w-full rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                                                            <div className="bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 flex items-center gap-2">
                                                              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                                                {workerName.charAt(
                                                                  0,
                                                                )}
                                                              </div>
                                                              <div className="min-w-0">
                                                                <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 truncate">
                                                                  {workerName}
                                                                </p>
                                                                <p className="text-[9px] text-emerald-500 dark:text-emerald-400">
                                                                  Worker
                                                                  (reassigned)
                                                                </p>
                                                              </div>
                                                            </div>
                                                            <div className="px-3 py-1.5">
                                                              <p className="text-[10px] text-amber-600 dark:text-amber-400 italic text-center">
                                                                Must redo work
                                                              </p>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    </React.Fragment>
                                                  );
                                                }
                                                return null;
                                              })
                                            ) : (
                                              <div className="flex flex-col items-center py-0.5">
                                                <div className="w-0.5 h-3 bg-emerald-200 dark:bg-emerald-700 rounded-full" />
                                                <p className="text-[10px] text-gray-400 italic py-2">
                                                  No replies yet
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}

                                      {/* Creator Actions: Complete | Escalate */}
                                      {/* Complete and Escalate are mutually exclusive: Complete is disabled
                                       while the Escalate textarea for the same copy is open, preventing
                                       contradictory workflow states reaching the backend. */}
                                      {actionCopy &&
                                        actionCopy.sentById ===
                                          currentUserId && (
                                          <div className="flex flex-wrap gap-2">
                                            <button
                                              onClick={() =>
                                                doCompleteCopy(actionCopy.id)
                                              }
                                              disabled={
                                                completeCopyLoading ||
                                                completingCopyId ===
                                                  actionCopy.id ||
                                                forwardingCopyId ===
                                                  actionCopy.id
                                              }
                                              className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 font-medium flex items-center gap-1 transition-colors"
                                              title={
                                                forwardingCopyId ===
                                                actionCopy.id
                                                  ? "Cancel escalation first before completing"
                                                  : undefined
                                              }
                                            >
                                              {completingCopyId ===
                                              actionCopy.id ? (
                                                <LoadingSpinner
                                                  size="sm"
                                                  className="w-3 h-3"
                                                />
                                              ) : (
                                                <CheckCircle className="w-3 h-3" />
                                              )}
                                              Complete
                                            </button>
                                            {forwardingCopyId ===
                                            actionCopy.id ? (
                                              <div className="flex-1 min-w-[200px] space-y-2">
                                                <textarea
                                                  value={forwardCopyRemarks}
                                                  onChange={(e) =>
                                                    setForwardCopyRemarks(
                                                      e.target.value,
                                                    )
                                                  }
                                                  rows={2}
                                                  className="w-full px-3 py-2 text-xs border border-amber-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-amber-500 outline-none"
                                                  placeholder="Explain why the work is not complete (mandatory)..."
                                                />
                                                <div className="flex gap-2">
                                                  <button
                                                    onClick={() =>
                                                      doForwardCopy(
                                                        actionCopy.id,
                                                      )
                                                    }
                                                    disabled={
                                                      forwardCopyLoading ||
                                                      !forwardCopyRemarks.trim()
                                                    }
                                                    className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 font-medium flex items-center gap-1 transition-colors"
                                                  >
                                                    {forwardCopyLoading ? (
                                                      <LoadingSpinner
                                                        size="sm"
                                                        className="w-3 h-3"
                                                      />
                                                    ) : (
                                                      <AlertTriangle className="w-3 h-3" />
                                                    )}
                                                    Escalate
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setForwardingCopyId(null);
                                                      setForwardCopyRemarks("");
                                                    }}
                                                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                                <p className="text-[10px] text-amber-600">
                                                  ⚠ This will escalate to the
                                                  assignee&apos;s boss (Level{" "}
                                                  {(actionCopy.escalationLevel ||
                                                    0) + 1}
                                                  )
                                                </p>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => {
                                                  setForwardingCopyId(
                                                    actionCopy.id,
                                                  );
                                                  setReplyingCopyId(null);
                                                  setReplyRemarks("");
                                                  setReplyAttachments([]);
                                                }}
                                                disabled={!!replyingCopyId}
                                                className="px-3 py-1.5 text-xs border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 font-medium flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                <AlertTriangle className="w-3 h-3" />
                                                Escalate
                                              </button>
                                            )}
                                          </div>
                                        )}

                                      {/* Assignee Action: Reply — only when boss has given you an order */}
                                      {replyCopy &&
                                        (() => {
                                          const hasOrderForMe =
                                            groupCopies.some((c: any) => {
                                              const isBossCopy =
                                                c.rootCopy?.assignedToId &&
                                                c.assignedToId !==
                                                  c.rootCopy.assignedToId;
                                              if (
                                                !isBossCopy ||
                                                !c.replies?.length
                                              )
                                                return false;
                                              try {
                                                const parsed = c.remarks
                                                  ? JSON.parse(c.remarks)
                                                  : {};
                                                if (parsed.orderTargetId)
                                                  return (
                                                    parsed.orderTargetId ===
                                                    currentUserId
                                                  );
                                              } catch {
                                                /* ignore */
                                              }
                                              const creatorEscalated =
                                                c.note?.createdById &&
                                                c.sentById ===
                                                  c.note.createdById;
                                              return (
                                                (creatorEscalated &&
                                                  c.rootCopy?.assignedToId ===
                                                    currentUserId) ||
                                                (!creatorEscalated &&
                                                  c.sentById === currentUserId)
                                              );
                                            });
                                          return hasOrderForMe;
                                        })() && (
                                          <div>
                                            {replyingCopyId === replyCopy.id ? (
                                              <div className="space-y-2">
                                                <textarea
                                                  value={replyRemarks}
                                                  onChange={(e) =>
                                                    setReplyRemarks(
                                                      e.target.value,
                                                    )
                                                  }
                                                  rows={2}
                                                  className={`w-full px-3 py-2 text-xs border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-indigo-500 outline-none ${!replyRemarks.trim() ? "border-red-300" : "border-gray-200 dark:border-gray-600"}`}
                                                  placeholder="Your reply / status update (mandatory)..."
                                                />
                                                {/* Attached files */}
                                                {replyAttachments.length >
                                                  0 && (
                                                  <div className="flex flex-wrap gap-1.5">
                                                    {replyAttachments.map(
                                                      (att, i) => (
                                                        <span
                                                          key={i}
                                                          className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded"
                                                        >
                                                          <Paperclip className="w-2.5 h-2.5" />{" "}
                                                          {att.fileName}
                                                          <button
                                                            type="button"
                                                            onClick={() =>
                                                              setReplyAttachments(
                                                                (prev) =>
                                                                  prev.filter(
                                                                    (_, idx) =>
                                                                      idx !== i,
                                                                  ),
                                                              )
                                                            }
                                                            className="hover:text-red-500"
                                                          >
                                                            <X className="w-2.5 h-2.5" />
                                                          </button>
                                                        </span>
                                                      ),
                                                    )}
                                                  </div>
                                                )}
                                                <div className="flex gap-2">
                                                  <label className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 cursor-pointer flex items-center gap-1">
                                                    {replyUploadLoading ? (
                                                      <LoadingSpinner
                                                        size="sm"
                                                        className="w-3 h-3"
                                                      />
                                                    ) : (
                                                      <Upload className="w-3 h-3" />
                                                    )}
                                                    Attach File
                                                    <input
                                                      type="file"
                                                      multiple
                                                      className="hidden"
                                                      onChange={
                                                        handleReplyFileUpload
                                                      }
                                                      disabled={
                                                        replyUploadLoading
                                                      }
                                                    />
                                                  </label>
                                                  <button
                                                    onClick={() =>
                                                      doReplyCopy(replyCopy.id)
                                                    }
                                                    disabled={
                                                      replyLoading ||
                                                      !replyRemarks.trim()
                                                    }
                                                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center gap-1 transition-colors"
                                                  >
                                                    {replyLoading ? (
                                                      <LoadingSpinner
                                                        size="sm"
                                                        className="w-3 h-3"
                                                      />
                                                    ) : (
                                                      <MessageSquare className="w-3 h-3" />
                                                    )}
                                                    Submit Reply
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setReplyingCopyId(null);
                                                      setReplyRemarks("");
                                                      setReplyAttachments([]);
                                                    }}
                                                    className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => {
                                                  setReplyingCopyId(
                                                    replyCopy.id,
                                                  );
                                                  setForwardingCopyId(null);
                                                  setForwardCopyRemarks("");
                                                  setReplyRemarks("");
                                                  setReplyAttachments([]);
                                                }}
                                                disabled={!!forwardingCopyId}
                                                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                              >
                                                <MessageSquare className="w-3 h-3" />
                                                Reply
                                              </button>
                                            )}
                                          </div>
                                        )}
                                    </div>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-2">
                      No copies sent yet
                    </p>
                  )}
                </section>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
