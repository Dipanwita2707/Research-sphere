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
  User,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { notingService } from '@/features/noting-management/services/noting.service';
import type { Note, NoteCopy } from '@/features/noting-management/types/noting.types';
import { useNote, useMyCopies, useReplyCopy } from '@/features/noting-management/hooks/useNoting';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";
import { useAuthStore } from '@/shared/auth/authStore';

export default function CopyDetailPage() {
  const params = useParams();
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
    return (copiesData.copies as NoteCopy[]).find((c) => c.id === copyId && c.noteId === noteId) ?? null;
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

  // One reply per level — reply form only when status is pending (not yet replied)
  const canReply =
    copy &&
    user &&
    (copy as any).assignedToId === user.id &&
    copy.status === 'pending';

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

  const displayNote = copy.note || note;
  const statusColor =
    copy.status === 'completed'
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : copy.status === 'replied'
        ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
        : copy.status === 'forwarded'
          ? 'text-amber-600 bg-amber-50 border-amber-200'
          : 'text-indigo-600 bg-indigo-50 border-indigo-200';

  const allReplies = (copy as any).allReplies || copy.replies || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Link
        href="/noting"
        className="inline-flex items-center gap-2 text-sm text-sgt-600 hover:text-sgt-700 dark:text-sgt-400 dark:hover:text-sgt-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Copies
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-sgt-600 dark:text-sgt-400">
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
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

        {/* Note Description */}
        {displayNote?.description && (
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Note Description
              </h4>
              <div
                className="text-sm text-gray-700 dark:text-gray-300 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: displayNote.description }}
              />
            </div>
          </div>
        )}

        {/* Timeline / Replies */}
        {allReplies.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Replies &amp; Updates</h4>
            <div className="space-y-3">
              {allReplies.map((r: any) => {
                const isOwnReply = r.repliedBy?.id === user?.id;
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
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 sm:p-4">
            <h4 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
              Instructions from Sender
            </h4>
            {(() => {
              try {
                const parsed = JSON.parse(copy.remarks);
                if (parsed.type === 'escalation') {
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
                if (parsed.type === 'reassigned') {
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
        {copy.status === 'replied' && (copy as any).assignedToId === user?.id && (
          <div className="px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You have replied. The noting creator will review and take action (complete or forward). The reply form will open again when a new copy is assigned to you.
            </p>
          </div>
        )}
        {canReply && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
            <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
              Your Reply
            </h4>
            <div className="space-y-3">
              <textarea
                value={replyRemarks}
                onChange={(e) => setReplyRemarks(e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${!replyRemarks.trim() ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-600'
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
                <label className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer flex items-center gap-1.5">
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
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center gap-1.5"
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
