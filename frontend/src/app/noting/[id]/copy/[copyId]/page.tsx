'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Copy,
  MessageSquare,
  AlertTriangle,
  Paperclip,
  Upload,
  X,
  ArrowRight,
  Building2,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  XCircle,
} from 'lucide-react';
import { notingService } from '@/features/noting-management/services/noting.service';
import type { Note, NoteCopy } from '@/features/noting-management/types/noting.types';
import { useNote, useMyCopies, useReplyCopy } from '@/features/noting-management/hooks/useNoting';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { useAuthStore } from '@/shared/auth/authStore';
import NoteEventDetails from '../../components/NoteEventDetails';

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
  if (!obj) return '—';
  if (obj.employeeDetails?.displayName) return obj.employeeDetails.displayName;
  if (obj.employeeDetails?.firstName || obj.employeeDetails?.lastName) {
    return [obj.employeeDetails?.firstName, obj.employeeDetails?.lastName]
      .filter(Boolean)
      .join(' ');
  }
  if (obj.studentLogin?.displayName) return obj.studentLogin.displayName;
  return obj.uid ?? '—';
}

export default function CopyDetailPage() {
  const params = useParams() as Record<string, string>;
  const router = useRouter();
  const noteId = params?.id as string;
  const copyId = params?.copyId as string;
  const { toast } = useToast();
  const { user } = useAuthStore();

  // PERF FIX: Use TanStack Query hooks instead of raw service calls.
  // useNote has 2-min staleTime, useMyCopies has 2-min staleTime.
  // Navigating back to this page within 2 min serves from cache instantly.
  const { data: noteData, isLoading: noteLoading } = useNote(noteId);
  const { data: copiesData, isLoading: copiesLoading } = useMyCopies();
  const replyCopyMutation = useReplyCopy();
  const loading = noteLoading || copiesLoading;

  // Derive note and copy from TanStack Query data
  const note = noteData ?? null;
  const copy = useMemo(() => {
    if (!copiesData?.copies || !copyId || !noteId) return null;
    return (copiesData.copies as NoteCopy[]).find((c) => c.id ===
   copyId && c.noteId ===
   noteId) ?? null;
  }, [copiesData, copyId, noteId]);

  // Redirect if copy not found after data loads
  useEffect(() => {
    if (!loading && copiesData && !copy) {
      toast({ type: 'error', message: 'Copy not found or you do not have access' });
      router.push('/noting');
    }
  }, [loading, copiesData, copy, toast, router]);

  const [replyRemarks, setReplyRemarks] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<{ filePath: string; fileName: string }[]>([]);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyUploadLoading, setReplyUploadLoading] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [viewingPath, setViewingPath] = useState<string | null>(null);

  // One reply per level — reply form only when status is pending (not yet replied)
  const canReply =
    copy &&
    user &&
    (copy as any).assignedToId ===
   user.id &&
    copy.status ===
   'pending';

  const doReplyCopy = async () => {
    if (!copy || !replyRemarks.trim()) {
      toast({ type: 'error', message: 'Please enter your remarks before replying.' });
      return;
    }
    setReplyLoading(true);
    try {
      // PERF FIX: Use mutation hook — it invalidates ["noting", "my-copies"] automatically
      // so TanStack Query refetches in the background. No manual raw re-fetch needed.
      await replyCopyMutation.mutateAsync({
        copyId: copy.id,
        payload: {
          remarks: replyRemarks.trim(),
          attachments: replyAttachments.length > 0 ? replyAttachments : undefined,
        },
      });
      toast({ type: 'success', message: 'Reply submitted successfully' });
      setReplyRemarks('');
      setReplyAttachments([]);
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setReplyLoading(false);
    }
  };

  const handleReplyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setReplyUploadLoading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const filePath = await notingService.uploadAttachment(files[i]);
        setReplyAttachments((prev) => [...prev, { filePath, fileName: files[i].name }]);
      }
    } catch {
      toast({ type: 'error', message: 'File upload failed' });
    } finally {
      setReplyUploadLoading(false);
      e.target.value = '';
    }
  };

  if (loading || !copy || !note) {
    return <PageSkeleton />;
  }

  const displayNote = note;
  const statusColor =
    copy.status ===
   'completed'
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : copy.status ===
   'replied'
        ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
        : copy.status ===
   'forwarded'
          ? 'text-amber-600 bg-amber-50 border-amber-200'
          : 'text-indigo-600 bg-indigo-50 border-indigo-200';

  const allReplies = (copy as any).allReplies || copy.replies || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link
        href="/noting"
        className="inline-flex items-center gap-2 text-sm text-[#6497b1] hover:text-[#005b96] dark:text-[#b3cde0] dark:hover:text-[#6497b1] mb-6 transition-all duration-200"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Copies
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#b3cde0]/40 dark:border-gray-700 shadow-[0_2px_8px_rgba(100,151,177,0.1)] overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#b3cde0]/30 dark:border-gray-700">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-[#005b96] dark:text-[#b3cde0]">
              {displayNote?.notingId || 'N/A'}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase border ${statusColor}`}>
              {copy.status}
            </span>
            {copy.escalationLevel > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-red-50 text-red-600 border border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Escalation L{copy.escalationLevel}
              </span>
            )}
          </div>
          <h1 className="text-lg font-bold text-[#011f4b] dark:text-white capitalize">
            {displayNote?.category} / {displayNote?.subcategory}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Sent by: {(copy as any).sentBy?.employeeDetails?.displayName || (copy as any).sentBy?.uid} •{' '}
            {new Date(copy.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-6">
          {displayNote?.description && (
            <section>
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                Description
              </h3>
              <div
                className="noting-rich-content bg-[#f8fafc] dark:bg-gray-900/20 px-4 py-3 rounded-xl border border-[#b3cde0]/30 dark:border-gray-800 text-sm text-gray-800 dark:text-gray-200 [&>ol]:!list-decimal [&>ol]:!ml-6 [&>ol]:!pl-4 [&>ul]:!list-disc [&>ul]:!ml-6 [&>ul]:!pl-4 [&_ol]:!list-decimal [&_ol]:!ml-6 [&_ol]:!pl-4 [&_ul]:!list-disc [&_ul]:!ml-6 [&_ul]:!pl-4 [&_li]:!mb-1 [&_p]:!mb-2 [&_p]:!block [&_h1]:!text-2xl [&_h1]:!font-bold [&_h1]:!my-3 [&_h2]:!text-xl [&_h2]:!font-semibold [&_h2]:!my-2 [&_h3]:!text-lg [&_h3]:!font-semibold [&_h3]:!my-2 [&_blockquote]:!border-l-4 [&_blockquote]:!border-[#005b96] [&_blockquote]:!pl-4 [&_blockquote]:!italic [&_blockquote]:!my-2"
                dangerouslySetInnerHTML={{ __html: displayNote.description }}
              />
            </section>
          )}

          <NoteEventDetails note={displayNote} />

          {displayNote.points && displayNote.points.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                Requirements / Points
              </h3>
              <div className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-900/20 p-4">
                <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 divide-y divide-[#b3cde0]/20 dark:divide-gray-700">
                  {displayNote.points.map((point, index) => (
                    <li key={point.id || index} className="leading-relaxed py-2.5 first:pt-0 last:pb-0">
                      {point.content}
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {displayNote.attachments && displayNote.attachments.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Attachments
                </h3>
                <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {displayNote.attachments.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {displayNote.attachments.map((attachment) => {
                  const isDownloading = downloadingPath ===
   attachment.filePath;
                  const isViewing = viewingPath ===
   attachment.filePath;

                  return (
                    <div
                      key={attachment.id}
                      className="rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:border-[#6497b1] dark:hover:border-[#03396c] transition-all duration-200"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded bg-gray-50 dark:bg-gray-900/30 flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-700">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {attachment.fileName}
                          </p>
                          {attachment.fileDescription && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                              {attachment.fileDescription}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              type="button"
                              onClick={async () => {
                                setViewingPath(attachment.filePath);
                                try {
                                  const blobUrl = await notingService.viewAttachment(attachment.filePath);
                                  const popup = window.open(blobUrl, '_blank', 'noopener');
                                  if (popup) {
                                    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
                                  }
                                } catch {
                                  toast({ type: 'error', message: 'Failed to open file' });
                                } finally {
                                  setViewingPath(null);
                                }
                              }}
                              disabled={isViewing}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6497b1] hover:text-[#005b96] transition-all duration-200"
                            >
                              {isViewing ? (
                                <LoadingSpinner size="sm" className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setDownloadingPath(attachment.filePath);
                                try {
                                  await notingService.downloadAttachment(attachment.filePath, attachment.fileName);
                                  toast({ type: 'success', message: 'Download started' });
                                } catch {
                                  toast({ type: 'error', message: 'Failed to download file' });
                                } finally {
                                  setDownloadingPath(null);
                                }
                              }}
                              disabled={isDownloading}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6497b1] hover:text-[#005b96] transition-all duration-200"
                            >
                              {isDownloading ? (
                                <LoadingSpinner size="sm" className="w-3 h-3" />
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
                    {displayNote.approvalPeriod ? displayNote.approvalPeriod.replace('_', ' ') : '—'}
                  </p>
                </div>
                {displayNote.recurringFrequency && (
                  <div className="bg-white dark:bg-gray-800 p-3">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Frequency
                    </span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 capitalize">
                      {displayNote.recurringFrequency}
                    </p>
                  </div>
                )}
                <div className="bg-white dark:bg-gray-800 p-3">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Amount Required
                  </span>
                  <p
                    className={`text-sm font-medium mt-0.5 ${displayNote.amountRequired ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
                  >
                    {displayNote.amountRequired
                      ? `₹ ${Number(displayNote.amount || 0).toLocaleString()}`
                      : '—'}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Policy Compliance
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-sm font-medium mt-0.5 ${displayNote.policyCompliant ===
   true
                      ? 'text-emerald-700'
                      : displayNote.policyCompliant ===
   false
                        ? 'text-red-700'
                        : 'text-gray-400'}`}
                  >
                    {displayNote.policyCompliant ===
   true ? (
                      <>
                        <CheckCircle className="w-3 h-3" /> Yes
                      </>
                    ) : displayNote.policyCompliant ===
   false ? (
                      <>
                        <XCircle className="w-3 h-3" /> No
                      </>
                    ) : (
                      'N/A'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
              Originator
            </h3>
            <div className="bg-[#f8fafc] dark:bg-gray-900/20 rounded-xl border border-[#b3cde0]/30 dark:border-gray-700 p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#b3cde0]/30 dark:bg-[#011f4b]/30 flex items-center justify-center text-[#005b96] dark:text-[#b3cde0] font-bold text-sm">
                  {getDisplayName(displayNote.createdBy).charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                      {getDisplayName(displayNote.createdBy)}
                    </span>
                    {displayNote.createdBy?.role && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {displayNote.createdBy.role}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap text-xs text-gray-500 dark:text-gray-400 gap-x-4">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {displayNote.createdBy?.employeeDetails?.primaryDepartment?.departmentName ??
                        displayNote.createdBy?.studentLogin?.program?.department?.departmentName ??
                        '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(displayNote.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Timeline / Replies */}
        {allReplies.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t border-[#b3cde0]/30 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-[#6497b1] uppercase tracking-wider mb-3">Replies &amp; Updates</h4>
            <div className="space-y-3">
              {allReplies.map((r: any) => {
                const isOwnReply = r.repliedBy?.id ===
   user?.id;
                const replierName =
                  r.repliedBy?.employeeDetails?.displayName || r.repliedBy?.uid || 'Unknown';
                return (
                  <div
                    key={r.id}
                    className={`rounded-lg border p-3 ${isOwnReply
                      ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                      : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                      }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{replierName}</span>
                      {isOwnReply && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200">
                          You
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{r.remarks}</p>
                    {r.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(r.attachments as { filePath: string; fileName: string }[]).map((att: any, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() =>
                              notingService.downloadAttachment(att.filePath, att.fileName).catch(() =>
                                toast({ type: 'error', message: 'Download failed' })
                              )
                            }
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                          >
                            <Paperclip className="w-3 h-3" /> {att.fileName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Instructions / Escalation Context — shown after replies so context is near the reply box */}
        <div className="px-4 sm:px-6 py-4 border-t border-[#b3cde0]/30 dark:border-gray-700">
          <div className="bg-[#b3cde0]/10 dark:bg-indigo-900/20 border border-[#b3cde0]/40 dark:border-indigo-800 rounded-xl p-3 sm:p-4">
            <h4 className="text-xs font-semibold text-[#005b96] dark:text-indigo-400 uppercase tracking-wider mb-2">
              Instructions from Sender
            </h4>
            {(() => {
              try {
                const parsed = JSON.parse(copy.remarks);
                if (parsed.type ===
   'escalation') {
                  return (
                    <div className="space-y-3">
                      {/* System Warning */}
                      {parsed.systemWarning && (
                        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-md px-3 py-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">{parsed.systemWarning}</p>
                        </div>
                      )}
                      {/* Escalation details */}
                      <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                        {parsed.senderName && (
                          <p><span className="font-semibold text-gray-900 dark:text-white">Escalated by:</span> {parsed.senderName}</p>
                        )}
                        {parsed.assigneeName && (
                          <p><span className="font-semibold text-gray-900 dark:text-white">Complaint about:</span> {parsed.assigneeName} (Worker)</p>
                        )}
                        {parsed.senderRemarks && (
                          <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 mt-1">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Reason for escalation</p>
                            <p className="text-sm text-gray-800 dark:text-gray-200">{parsed.senderRemarks}</p>
                          </div>
                        )}
                        {parsed.orderTargetName && (
                          <div className="flex items-center gap-2 mt-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-md px-3 py-2">
                            <ArrowRight className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <p className="text-xs text-indigo-800 dark:text-indigo-200 font-medium">
                              Please ensure <span className="font-bold">{parsed.orderTargetName}</span> completes the pending work
                            </p>
                          </div>
                        )}
                      </div>
                      {/* Higher bosses notification warning — tells this boss their superiors were also informed */}
                      {parsed.higherBossesNotified && parsed.higherBossesNotified.length > 0 && (
                        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-md px-3 py-2.5">
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-red-800 dark:text-red-200 font-bold">
                              ⚠ Your higher authorities have also been notified about this matter:
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300 font-semibold mt-0.5">
                              {(parsed.higherBossesNotified as string[]).join(', ')}
                            </p>
                            <p className="text-[10px] text-red-500 dark:text-red-400 mt-1 italic">
                              Please ensure the assigned work is completed at the earliest.
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Escalation chain history */}
                      {parsed.escalationChain && parsed.escalationChain.length > 0 && (
                        <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">Previous Escalation History</p>
                          <div className="space-y-1">
                            {(parsed.escalationChain as any[]).map((ec: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                                <span className="font-mono font-bold text-gray-400">L{ec.level}</span>
                                <span>{ec.notifiedPerson} — {ec.creatorRemarks || 'No remarks'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                if (parsed.type ===
   'reassigned') {
                  return (
                    <div className="space-y-3">
                      {parsed.systemWarning && (
                        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-md px-3 py-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">{parsed.systemWarning}</p>
                        </div>
                      )}
                      <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                        {parsed.senderRemarks && (
                          <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Creator&apos;s remarks</p>
                            <p className="text-sm text-gray-800 dark:text-gray-200">{parsed.senderRemarks}</p>
                          </div>
                        )}
                        {parsed.bossesNotified && parsed.bossesNotified.length > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ⚠ Your bosses have been notified: {(parsed.bossesNotified as string[]).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                // Other JSON types — show raw
                return <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{copy.remarks}</p>;
              } catch {
                // Plain text remarks
                return <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{copy.remarks}</p>;
              }
            })()}
          </div>
        </div>

        {/* Reply Section — one reply per level; after replying, wait for creator's action */}
        {copy.status ===
   'replied' && (copy as any).assignedToId ===
   user?.id && (
          <div className="px-4 sm:px-6 py-3 border-t border-[#b3cde0]/30 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You have replied. The noting creator will review and take action (complete or forward). The reply form will open again when a new copy is assigned to you.
            </p>
          </div>
        )}
        {canReply && (
          <div className="px-4 sm:px-6 py-4 border-t border-[#b3cde0]/30 dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-900/20">
            <h4 className="text-xs font-semibold text-[#03396c] dark:text-gray-400 uppercase tracking-wider mb-3">
              Your Reply
            </h4>
            <div className="space-y-3">
              <textarea
                value={replyRemarks}
                onChange={(e) => setReplyRemarks(e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 text-sm border rounded-xl bg-white dark:bg-gray-700 text-[#011f4b] dark:text-white placeholder:text-[#6497b1]/60 focus:ring-2 focus:ring-[#005b96]/40 focus:border-[#005b96] outline-none transition-all duration-200 ${!replyRemarks.trim() ? 'border-red-300 dark:border-red-600' : 'border-[#b3cde0]/50 dark:border-gray-600'
                  }`}
                placeholder="Your reply / status update (mandatory)..."
              />
              {replyAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {replyAttachments.map((att, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-2 py-1 rounded"
                    >
                      <Paperclip className="w-3 h-3" /> {att.fileName}
                      <button
                        type="button"
                        onClick={() => setReplyAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        className="hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label className="px-3 py-2 text-sm border border-[#b3cde0]/50 dark:border-gray-600 rounded-xl text-[#03396c] dark:text-gray-400 hover:bg-[#f8fafc] dark:hover:bg-gray-700 cursor-pointer flex items-center gap-1.5 transition-all duration-200">
                  {replyUploadLoading ? (
                    <Skeleton className="w-4 h-4 rounded-sm" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Attach File
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleReplyFileUpload}
                    disabled={replyUploadLoading}
                  />
                </label>
                <button
                  onClick={doReplyCopy}
                  disabled={replyLoading || !replyRemarks.trim()}
                  className="px-4 py-2 text-sm bg-[#005b96] text-white rounded-xl hover:bg-[#03396c] disabled:opacity-50 font-medium flex items-center gap-1.5 transition-all duration-200 shadow-[0_2px_8px_rgba(0,91,150,0.25)]"
                >
                  {replyLoading ? (
                    <Skeleton className="w-4 h-4 rounded-sm" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  Submit Reply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
