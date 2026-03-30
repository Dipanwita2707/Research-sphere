"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  X,
  Search,
  Send,
  Copy,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Upload,
  ArrowUpRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  ArrowRight,
  CornerDownLeft,
  Paperclip,
} from "lucide-react";
import {
  useSendCopy,
  useReplyCopy,
  useForwardCopy,
  useCompleteCopy,
  useNoteCopies,
  useSearchEmployees,
  NOTING_QUERY_KEYS,
} from "@/features/noting-management/hooks/useNoting";
import { notingService } from "@/features/noting-management/services/noting.service";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Note,
  NoteCopy,
} from "@/features/noting-management/types/noting.types";
import { useToast } from "@/shared/ui-components/Toast";
import { getErrorMessage } from "@/shared/utils/errorHandler";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

interface CopySharingSectionProps {
  note: Note;
  currentUserId: string | null;
  getDisplayName: (u: any) => string;
}

export default function CopySharingSection({
  note,
  currentUserId,
  getDisplayName,
}: CopySharingSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Copy sharing state ──
  const [showCopyPanel, setShowCopyPanel] = useState(false);
  const [copySearchQuery, setCopySearchQuery] = useState("");
  // TanStack Query hook with built-in 500ms debounce + caching
  const { data: rawCopySearchResults = [], isLoading: copySearchLoading } =
    useSearchEmployees(copySearchQuery);
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

  // ── Hooks ──
  const sendCopyMutation = useSendCopy();
  const replyCopyMutation = useReplyCopy();
  const forwardCopyMutation = useForwardCopy();
  const completeCopyMutation = useCompleteCopy();

  const {
    data: copies = [],
    isLoading: copiesLoading,
  } = useNoteCopies(note?.id ?? "", {
    enabled:
      !!note?.id &&
      note?.status === "approved" &&
      note?.createdById === currentUserId,
  });

  // Derive filtered search results — exclude already-selected and existing copy recipients
  const copySearchResults = useMemo(() => {
    const existingCopyUserIds = new Set(
      copies.map((c) => (c as any).assignedToId),
    );
    return rawCopySearchResults.filter(
      (r) =>
        !selectedCopyUsers.some((s) => s.id === r.id) &&
        !existingCopyUserIds.has(r.id),
    );
  }, [rawCopySearchResults, selectedCopyUsers, copies]);

  // ── Handler functions ──
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

  // ── Guard ──
  if (note.status !== "approved" || note.createdById !== currentUserId) return null;

  return (
    <section className="pt-5 mt-2 border-t border-[#b3cde0]/30 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          Post-Approval Copy Sharing
        </h3>
        <button
          onClick={() => setShowCopyPanel(!showCopyPanel)}
          className="px-3 py-1.5 text-xs bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] flex items-center gap-1.5 font-medium transition-all duration-200 shadow-[0_2px_8px_rgba(0,91,150,0.25)]"
        >
          <Users className="w-3.5 h-3.5" />
          {showCopyPanel ? "Cancel" : "Send Copy"}
        </button>
      </div>

      {/* Send Copy Panel */}
      {showCopyPanel && (
        <div className="rounded-xl border border-[#b3cde0]/40 dark:border-[#005b96]/30 bg-[#b3cde0]/10 dark:bg-[#005b96]/5 p-4 space-y-3 mb-4">
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
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white placeholder:text-[#6497b1]/60 focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200"
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
            className={`w-full px-3 py-2 text-sm border rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white placeholder:text-[#6497b1]/60 focus:ring-1 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200 ${!copyRemarks.trim() ? "border-red-300" : "border-[#b3cde0]/50 dark:border-gray-600"}`}
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
            className="w-full px-3 py-2 text-sm bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] disabled:opacity-50 font-medium flex items-center justify-center gap-1.5 transition-all duration-200 shadow-[0_2px_8px_rgba(0,91,150,0.25)]"
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
                  const assigneeUid =
                    rootCopy.assignedTo?.uid || null;
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
                          : "text-[#03396c] bg-[#b3cde0]/10 border-[#b3cde0]/40";
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
                      className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 overflow-hidden"
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
                        className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 hover:bg-[#f8fafc] dark:hover:bg-gray-700/50 text-left transition-all duration-200"
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
                          {assigneeUid && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                              UID: {assigneeUid}
                            </p>
                          )}
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
                        <div className="border-t border-[#b3cde0]/30 dark:border-gray-700 p-4 bg-[#f8fafc]/50 dark:bg-gray-900/20 space-y-4">
                          {/* ── Vertical Flowchart: interleave worker replies with escalation ── */}
                          {(() => {
                            const creatorName = getDisplayName(
                              note?.createdBy,
                            );
                            const creatorUid =
                              note?.createdBy?.uid || null;
                            const workerName = assigneeName;
                            const workerUid = assigneeUid;
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
                                <div className="w-full rounded-xl border-2 border-[#6497b1] dark:border-[#005b96] bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
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
                                      {creatorUid && (
                                        <p className="text-[10px] text-indigo-500/90 dark:text-indigo-300 truncate">
                                          UID: {creatorUid}
                                        </p>
                                      )}
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
                                              className="flex items-start gap-2 bg-[#b3cde0]/10 dark:bg-[#005b96]/10 rounded-xl px-2.5 py-1.5"
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
                                        {workerUid && (
                                          <p className="text-[10px] text-emerald-500/90 dark:text-emerald-300 truncate">
                                            UID: {workerUid}
                                          </p>
                                        )}
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
                                        className="px-3 py-1.5 text-xs border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl text-[#03396c] dark:text-gray-400 hover:bg-[#f8fafc] transition-all duration-200"
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
                                      className={`w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white placeholder:text-[#6497b1]/60 focus:ring-1 focus:ring-[#005b96]/40 outline-none transition-all duration-200 ${!replyRemarks.trim() ? "border-red-300" : "border-[#b3cde0]/50 dark:border-gray-600"}`}
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
                                      <label className="px-3 py-1.5 text-xs border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl text-[#03396c] dark:text-gray-400 hover:bg-[#f8fafc] cursor-pointer flex items-center gap-1 transition-all duration-200">
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
                                        className="px-3 py-1.5 text-xs bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] disabled:opacity-50 font-medium flex items-center gap-1 transition-all duration-200"
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
                                        className="px-3 py-1.5 text-xs border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl text-[#03396c] dark:text-gray-400 hover:bg-[#f8fafc] transition-all duration-200"
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
                                    className="px-3 py-1.5 text-xs bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] font-medium flex items-center gap-1 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
}
