'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Send, User, Clock, Zap, Hand, Paperclip, FileText, Pencil, Building2, Download, Eye, Trash2, RotateCcw, ArrowRight, CornerDownLeft } from 'lucide-react';
import { notingService } from '@/features/noting-management/services/noting.service';
import type { Note } from '@/features/noting-management/types/noting.types';
import { useToast } from '@/shared/ui-components/Toast';
import { useAuthStore } from '@/shared/auth/authStore';
import api from '@/shared/api/api';

function getDisplayName(obj: { uid?: string; employeeDetails?: { displayName?: string; firstName?: string; lastName?: string }; studentLogin?: { displayName?: string } } | null | undefined): string {
  if (!obj) return '—';
  if (obj.employeeDetails?.displayName) return obj.employeeDetails.displayName;
  if (obj.employeeDetails?.firstName || obj.employeeDetails?.lastName)
    return [obj.employeeDetails?.firstName, obj.employeeDetails?.lastName].filter(Boolean).join(' ');
  if ((obj as any).studentLogin?.displayName) return (obj as any).studentLogin.displayName;
  return obj.uid ?? '—';
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  reverted: 'bg-orange-50 text-orange-700 border-orange-200',
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
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'revert' | 'forward' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [forwardMode, setForwardMode] = useState<'automated' | 'manual' | null>(null);
  const [forwardUserId, setForwardUserId] = useState('');
  const [schools, setSchools] = useState<{ id: string; facultyName: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; departmentName: string }[]>([]);

  // Block students from accessing noting system
  useEffect(() => {
    if (user && user.role?.name === 'student') {
      toast({ type: 'error', message: 'Students are not allowed to access the noting system' });
      router.push('/dashboard');
    }
  }, [user, router, toast]);
  const [programs, setPrograms] = useState<{ id: string; programName: string; programCode?: string }[]>([]);
  const [forwardUsers, setForwardUsers] = useState<{ id: string; uid: string; role: string; displayName: string }[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [programId, setProgramId] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [viewingPath, setViewingPath] = useState<string | null>(null);

  const isCurrentHolder = note?.currentHolderId && typeof window !== 'undefined';
  let currentUserId: string | null = null;
  try {
    const authStr = localStorage.getItem('auth-storage');
    if (authStr) {
      const auth = JSON.parse(authStr);
      currentUserId = auth?.state?.user?.id ?? null;
    }
  } catch (_) { }

  const isCentralDeptMember = note?.currentStep?.isCentralDepartment && note.currentStep.members?.some((m) => m.id === currentUserId);
  const canAct = note?.status === 'pending' && (note?.currentHolderId === currentUserId || (note?.currentHolderId == null && isCentralDeptMember));

  useEffect(() => {
    if (!id) return;
    notingService
      .getById(id)
      .then(setNote)
      .catch(() => toast({ type: 'error', message: 'Failed to load note' }))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const fetchSchools = useCallback(async () => {
    try {
      const res = await api.get('/schools');
      const data = res.data?.data ?? res.data ?? [];
      setSchools(Array.isArray(data) ? data : []);
    } catch {
      setSchools([]);
    }
  }, []);

  useEffect(() => {
    if (actionType === 'forward') {
      setForwardMode(null);
      setForwardUserId('');
      setSchoolId('');
      setDepartmentId('');
      setProgramId('');
      setDepartments([]);
      setPrograms([]);
      setForwardUsers([]);
      fetchSchools();
    }
  }, [actionType, fetchSchools]);

  useEffect(() => {
    if (!schoolId) {
      setDepartments([]);
      setDepartmentId('');
      setProgramId('');
      setPrograms([]);
      setForwardUsers([]);
      setForwardUserId('');
      return;
    }
    setOptionsLoading(true);
    api
      .get(`/departments/by-school/${schoolId}`)
      .then((res) => {
        const data = res.data?.data ?? res.data ?? [];
        setDepartments(Array.isArray(data) ? data : []);
        setDepartmentId('');
        setProgramId('');
        setPrograms([]);
        setForwardUsers([]);
        setForwardUserId('');
      })
      .catch(() => setDepartments([]))
      .finally(() => setOptionsLoading(false));
  }, [schoolId]);

  useEffect(() => {
    if (!departmentId) {
      setPrograms([]);
      setForwardUsers([]);
      setProgramId('');
      setForwardUserId('');
      return;
    }
    setOptionsLoading(true);
    Promise.all([
      notingService.getForwardPrograms(departmentId),
      notingService.getForwardUsers(departmentId),
    ])
      .then(([progs, users]) => {
        setPrograms(progs ?? []);
        setForwardUsers(users ?? []);
        setProgramId('');
        setForwardUserId('');
      })
      .catch(() => {
        setPrograms([]);
        setForwardUsers([]);
      })
      .finally(() => setOptionsLoading(false));
  }, [departmentId]);

  const doApprove = () => {
    if (!note) return;
    setActionLoading(true);
    setActionType('approve');
    notingService
      .approve(note.id, remarks || undefined)
      .then((response) => {
        const data = response?.data || response;
        if (data.eventCreated && data.eventId) {
          toast({
            type: 'success',
            message: `Note approved! Event ${data.eventId} created in DRAFT status. Visit Event Management to add details and publish.`,
            duration: 8000
          });
        } else {
          toast({ type: 'success', message: response?.message || 'Note approved successfully' });
        }
        notingService.getById(note.id).then(setNote);
        setRemarks('');
        setActionType(null);
      })
      .catch((err) => toast({ type: 'error', message: err.response?.data?.message || 'Failed to approve' }))
      .finally(() => setActionLoading(false));
  };

  const doReject = () => {
    if (!note || !remarks.trim()) {
      toast({ type: 'error', message: 'Remarks are mandatory for rejection' });
      return;
    }
    setActionLoading(true);
    setActionType('reject');
    notingService
      .reject(note.id, remarks)
      .then(() => {
        toast({ type: 'success', message: 'Note rejected' });
        notingService.getById(note.id).then(setNote);
        setRemarks('');
        setActionType(null);
      })
      .catch((err) => toast({ type: 'error', message: err.response?.data?.message || 'Failed to reject' }))
      .finally(() => setActionLoading(false));
  };

  const doRevert = () => {
    if (!note || !remarks.trim()) {
      toast({ type: 'error', message: 'Remarks are required for revert back' });
      return;
    }
    setActionLoading(true);
    setActionType('revert');
    notingService
      .revert(note.id, remarks)
      .then(() => {
        toast({ type: 'success', message: 'Note reverted back to creator' });
        notingService.getById(note.id).then(setNote);
        setRemarks('');
        setActionType(null);
      })
      .catch((err) => toast({ type: 'error', message: err.response?.data?.message || 'Failed to revert' }))
      .finally(() => setActionLoading(false));
  };

  const doForward = () => {
    if (!note || !remarks.trim()) {
      toast({ type: 'error', message: 'Remarks are required for forward' });
      return;
    }
    if (forwardMode === 'manual' && !forwardUserId.trim()) {
      toast({ type: 'error', message: 'Please select a user to forward to' });
      return;
    }
    if (!forwardMode) {
      toast({ type: 'error', message: 'Please choose Automated or Manual forward' });
      return;
    }
    setActionLoading(true);
    setActionType('forward');
    const payload = forwardMode === 'automated'
      ? { remarks: remarks.trim(), automated: true }
      : { remarks: remarks.trim(), nextHolderId: forwardUserId.trim() };
    notingService
      .forward(note.id, payload)
      .then(() => {
        toast({ type: 'success', message: 'Note forwarded' });
        notingService.getById(note.id).then(setNote);
        setRemarks('');
        setForwardMode(null);
        setForwardUserId('');
        setActionType(null);
      })
      .catch((err) => toast({ type: 'error', message: err.response?.data?.message || 'Failed to forward' }))
      .finally(() => setActionLoading(false));
  };

  if (loading || !note) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-sgt-600" />
      </div>
    );
  }

  const approverActions = note.history?.filter(h => h.performedById !== note.createdById) || [];
  const canEditOrDelete = note.createdById === currentUserId && (
    note.status === 'reverted' ||
    (approverActions.length === 0 && note.status !== 'approved' && note.status !== 'rejected')
  );

  const StatusIcon = STATUS_ICONS[note.status] || Clock;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-[850px] mx-auto">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/noting" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-sgt-600 transition-colors">
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
                  if (window.confirm('Delete this note? This cannot be undone.')) {
                    notingService.deleteDraft(note.id)
                      .then(() => {
                        toast({ type: 'success', message: 'Note deleted' });
                        router.push('/noting');
                      })
                      .catch((err) => {
                        const message = err.response?.data?.message || 'Failed to delete note';
                        toast({ type: 'error', message });
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
        {note.status === 'reverted' && note.createdById === currentUserId && (
          <div className="mb-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <div className="flex items-start gap-2.5">
              <RotateCcw className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Note Reverted Back</p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                  This note has been sent back for modifications. Review the remarks, make changes, and resubmit.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== A4 Document Sheet ===== */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

          {/* Document Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-8 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="px-2 py-0.5 rounded bg-sgt-50 dark:bg-sgt-900/30 text-sgt-700 dark:text-sgt-300 text-xs font-mono font-semibold border border-sgt-100 dark:border-sgt-800/50">
                    {note.notingId}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_STYLES[note.status] || STATUS_STYLES.draft}`}>
                    <StatusIcon className="w-3 h-3" />
                    {note.status === 'pending' ? 'IN REVIEW' : note.status.toUpperCase()}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                  {note.category} <span className="text-gray-300 dark:text-gray-600 mx-1 font-light">/</span> {note.subcategory}
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
                      Current Holder <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white leading-none mt-0.5">
                      {getDisplayName(note.currentHolder)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Central Department Step */}
            {note.currentStep?.isCentralDepartment && (
              <div className="mt-3 bg-sgt-50 dark:bg-sgt-900/10 px-3 py-2.5 rounded-md border border-sgt-100 dark:border-sgt-800">
                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-sgt-600 dark:text-sgt-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-sgt-700 dark:text-sgt-300 uppercase tracking-wide">Current Step: {note.currentStep.centralDepartmentName ?? note.currentStep.authorityType}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Central Department Approval</p>
                    {note.currentStep.members?.length > 0 && (
                      <div className="mt-1.5 flex -space-x-1.5 overflow-hidden">
                        {note.currentStep.members.slice(0, 3).map((m, i) => (
                          <div key={i} title={m.displayName} className="flex h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 items-center justify-center text-[9px] font-bold overflow-hidden">
                            {m.displayName.substring(0, 2)}
                          </div>
                        ))}
                        {note.currentStep.members.length > 3 && (
                          <div className="flex h-6 w-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 items-center justify-center text-[9px] text-gray-500 font-bold">
                            +{note.currentStep.members.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Document Body */}
          <div className="px-8 py-6 space-y-6">
            {/* Description */}
            <section>
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Description</h3>
              <div className="bg-gray-50 dark:bg-gray-900/20 px-4 py-3 rounded-md border border-gray-100 dark:border-gray-800 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                {note.description}
              </div>
            </section>

            {/* Event Details */}
            {note.subcategory === 'events' && (
              <section>
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Event Details</h3>
                <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {!note.eventName && !note.eventType && !note.eventStartDate ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic p-4">Event details not provided.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
                      {note.eventName && (
                        <div className="bg-white dark:bg-gray-800 p-3">
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Event Name</label>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{note.eventName}</p>
                        </div>
                      )}
                      {note.eventType && (
                        <div className="bg-white dark:bg-gray-800 p-3">
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Event Type</label>
                          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{note.eventType.replace('_', ' ')}</p>
                        </div>
                      )}
                      {note.eventStartDate && (
                        <div className="bg-white dark:bg-gray-800 p-3">
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Start Date</label>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(note.eventStartDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {note.eventEndDate && (
                        <div className="bg-white dark:bg-gray-800 p-3">
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">End Date</label>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(note.eventEndDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      )}
                      {note.eventPaymentType && (
                        <div className="bg-white dark:bg-gray-800 p-3">
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Payment Type</label>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${note.eventPaymentType === 'free'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                            {note.eventPaymentType.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {note.eventName && note.status === 'pending' && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        <span className="font-medium">Auto-Creation:</span> When approved, an event will be created in <span className="font-semibold">DRAFT</span> status.
                      </p>
                    </div>
                  )}

                  {note.eventName && note.status === 'approved' && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        <span className="font-medium">Event Created.</span> Visit <a href="/events/my-events" className="underline font-semibold">My Created Events</a> to add details and publish.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Requirements / Points */}
            {note.points && note.points.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Requirements / Points</h3>
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
                  <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Attachments</h3>
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {note.attachments.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {note.attachments.map((att) => {
                    const isDownloading = downloadingPath === att.filePath;
                    const isViewing = viewingPath === att.filePath;
                    return (
                      <div key={att.id} className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:border-sgt-200 dark:hover:border-sgt-800 transition-colors">
                        <div className="flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded bg-gray-50 dark:bg-gray-900/30 flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-700">
                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{att.fileName}</p>
                            {att.fileDescription && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{att.fileDescription}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  setViewingPath(att.filePath);
                                  try {
                                    const blobUrl = await notingService.viewAttachment(att.filePath);
                                    const w = window.open(blobUrl, '_blank', 'noopener');
                                    if (w) setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
                                  } catch {
                                    toast({ type: 'error', message: 'Failed to open file' });
                                  } finally {
                                    setViewingPath(null);
                                  }
                                }}
                                disabled={isViewing}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-sgt-600 transition-colors"
                              >
                                {isViewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                                Preview
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  setDownloadingPath(att.filePath);
                                  try {
                                    await notingService.downloadAttachment(att.filePath, att.fileName);
                                    toast({ type: 'success', message: 'Download started' });
                                  } catch {
                                    toast({ type: 'error', message: 'Failed to download file' });
                                  } finally {
                                    setDownloadingPath(null);
                                  }
                                }}
                                disabled={isDownloading}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-sgt-600 transition-colors"
                              >
                                {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
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
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Details</h3>
              <div className="rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-gray-700">
                  <div className="bg-white dark:bg-gray-800 p-3">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Approval Period</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 capitalize">{note.approvalPeriod.replace('_', ' ')}</p>
                  </div>
                  {note.recurringFrequency && (
                    <div className="bg-white dark:bg-gray-800 p-3">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Frequency</span>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 capitalize">{note.recurringFrequency}</p>
                    </div>
                  )}
                  <div className="bg-white dark:bg-gray-800 p-3">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Amount Required</span>
                    <p className={`text-sm font-medium mt-0.5 ${note.amountRequired ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                      {note.amountRequired ? `₹ ${Number(note.amount || 0).toLocaleString()}` : '—'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Policy Compliance</span>
                    <span className={`inline-flex items-center gap-1 text-sm font-medium mt-0.5 ${note.policyCompliant === true ? 'text-emerald-700' :
                        note.policyCompliant === false ? 'text-red-700' : 'text-gray-400'
                      }`}>
                      {note.policyCompliant === true ? <><CheckCircle className="w-3 h-3" /> Yes</> :
                        note.policyCompliant === false ? <><XCircle className="w-3 h-3" /> No</> : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Originator */}
            <section>
              <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Originator</h3>
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
                        {note.createdBy?.employeeDetails?.primaryDepartment?.departmentName ?? note.createdBy?.studentLogin?.program?.department?.departmentName ?? '—'}
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
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Approval Trail</h3>
                <div className="relative pl-5 space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-0 before:w-px before:bg-gray-200 dark:before:bg-gray-700 max-h-[500px] overflow-y-auto">
                  {note.history.map((h) => {
                    let iconColor = 'bg-gray-400';
                    let Icon: React.ElementType = Clock;
                    const action = h.action.toLowerCase();
                    if (action.includes('submit')) { Icon = Send; iconColor = 'bg-sgt-600'; }
                    else if (action.includes('approve')) { Icon = CheckCircle; iconColor = 'bg-emerald-600'; }
                    else if (action.includes('reject')) { Icon = XCircle; iconColor = 'bg-red-500'; }
                    else if (action.includes('revert')) { Icon = RotateCcw; iconColor = 'bg-orange-500'; }
                    else if (action.includes('forward')) { Icon = ArrowRight; iconColor = 'bg-sgt-500'; }

                    return (
                      <div key={h.id} className="relative">
                        <div className="absolute -left-[13px] top-0.5">
                          <div className={`h-[14px] w-[14px] rounded-full ${iconColor} border-2 border-white dark:border-gray-800 flex items-center justify-center`}>
                            <Icon className="w-2 h-2 text-white" />
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-md p-3 border border-gray-100 dark:border-gray-700/50 text-sm">
                          <div className="font-medium text-gray-900 dark:text-white capitalize text-[13px]">{h.action}</div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                            {getDisplayName(h.performedBy)} • {new Date(h.createdAt).toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
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
            {canAct && (
              <section className="pt-5 mt-2 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Actions</h3>
                <div className="space-y-3">
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                    placeholder="Remarks (mandatory for Reject, Revert & Forward)"
                  />

                  {/* Forward Panel */}
                  {actionType === 'forward' && (
                    <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 p-4 space-y-3">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Forward Method</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="forwardMode" checked={forwardMode === 'automated'} onChange={() => setForwardMode('automated')} className="rounded border-gray-300 text-sgt-600 focus:ring-sgt-500" />
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-sm">Automated</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="forwardMode" checked={forwardMode === 'manual'} onChange={() => setForwardMode('manual')} className="rounded border-gray-300 text-sgt-600 focus:ring-sgt-500" />
                          <Hand className="w-3.5 h-3.5 text-sgt-500" />
                          <span className="text-sm">Manual</span>
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Automated: forwards to next authority automatically. Manual: choose School → Department → User.
                      </p>
                      {forwardMode === 'manual' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">School</label>
                            <select
                              value={schoolId}
                              onChange={(e) => setSchoolId(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                            >
                              <option value="">Select school</option>
                              {schools.map((s) => (
                                <option key={s.id} value={s.id}>{s.facultyName}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                            <select
                              value={departmentId}
                              onChange={(e) => setDepartmentId(e.target.value)}
                              disabled={!schoolId || optionsLoading}
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                            >
                              <option value="">Select department</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.departmentName}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Program</label>
                            <select
                              value={programId}
                              onChange={(e) => setProgramId(e.target.value)}
                              disabled={!departmentId || optionsLoading}
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                            >
                              <option value="">Select program (optional)</option>
                              {programs.map((p) => (
                                <option key={p.id} value={p.id}>{p.programName}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Forward to user</label>
                            <select
                              value={forwardUserId}
                              onChange={(e) => setForwardUserId(e.target.value)}
                              disabled={!departmentId || optionsLoading}
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none"
                            >
                              <option value="">Select user</option>
                              {forwardUsers.map((u) => (
                                <option key={u.id} value={u.id}>{u.displayName} ({u.uid})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={doApprove}
                      disabled={actionLoading}
                      className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors"
                    >
                      {actionType === 'approve' && actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={doReject}
                      disabled={actionLoading || !remarks.trim()}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors"
                    >
                      {actionType === 'reject' && actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Reject
                    </button>
                    <button
                      onClick={doRevert}
                      disabled={actionLoading || !remarks.trim()}
                      className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5 font-medium transition-colors"
                      title="Send back to creator for modifications"
                    >
                      {actionType === 'revert' && actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Revert Back
                    </button>
                    <button
                      onClick={() => setActionType(actionType === 'forward' ? null : 'forward')}
                      className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-300 transition-colors"
                      title="Forward note"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {actionType === 'forward' ? 'Cancel' : 'Forward…'}
                    </button>
                    {actionType === 'forward' && (
                      <button
                        onClick={doForward}
                        disabled={
                          actionLoading ||
                          !remarks.trim() ||
                          !forwardMode ||
                          (forwardMode === 'manual' && !forwardUserId.trim())
                        }
                        className="px-4 py-2 text-sm bg-sgt-600 text-white rounded-md hover:bg-sgt-700 disabled:opacity-50 font-medium transition-colors"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Forward'}
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
