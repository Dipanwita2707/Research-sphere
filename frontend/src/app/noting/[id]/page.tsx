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
    if (user && user.role === 'student') {
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
  } catch (_) {}

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
        // Check if an event was auto-created
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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Check if user can edit or delete
  // Can edit/delete if: (1) creator with no approver actions yet, OR (2) note is reverted back to creator
  const approverActions = note.history?.filter(h => h.performedById !== note.createdById) || [];
  const canEditOrDelete = note.createdById === currentUserId && (
    note.status === 'reverted' || // Reverted notes can always be edited by creator
    (approverActions.length === 0 && note.status !== 'approved' && note.status !== 'rejected')
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Link href="/noting" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600">
            <ArrowLeft className="w-4 h-4" />
            Back to Noting
          </Link>
          {canEditOrDelete && (
            <>
              <Link
                href={`/noting/new?draft=${id}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
              >
                <Pencil className="w-4 h-4" />
                Edit note
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
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete note
              </button>
            </>
          )}
        </div>

        {/* Reverted Notice for Creator */}
        {note.status === 'reverted' && note.createdById === currentUserId && (
          <div className="mb-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-200">Note Reverted Back</h3>
                <p className="text-sm text-orange-800 dark:text-orange-300 mt-1">
                  This note has been sent back to you for modifications. Please review the remarks below, make the necessary changes, and resubmit the note.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6">
          {/* Left Column - Main Content */}
          <div className="xl:col-span-8 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header Section */}
              <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-medium border border-indigo-100 dark:border-indigo-800/50">
                    {note.notingId}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${
                    note.status === 'approved' ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/20' :
                    note.status === 'rejected' ? 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-500/20' :
                    note.status === 'reverted' ? 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-900/30 dark:text-orange-400 dark:ring-orange-500/20' :
                    note.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-500/20' : 
                    'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700'
                  }`}>
                    {note.status === 'draft' && <Clock className="w-3 h-3" />}
                    {note.status === 'pending' && <Send className="w-3 h-3" />}
                    {note.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                    {note.status === 'rejected' && <XCircle className="w-3 h-3" />}
                    {note.status === 'reverted' && <RotateCcw className="w-3 h-3" />}
                    {note.status === 'pending' ? 'IN REVIEW' : note.status.toUpperCase()}
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white capitalize">
                  {note.category} <span className="text-gray-400 mx-2 font-light">/</span> {note.subcategory}
                </h1>
              </div>

              {note.currentHolder && (
                <div className="flex items-center gap-3 bg-white dark:bg-gray-900/50 px-4 py-2 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase">
                    {getDisplayName(note.currentHolder).substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-xs items-center flex gap-1 uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                      Current Holder <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    </p>
                    <p className="text-base font-semibold text-gray-900 dark:text-white leading-none mt-0.5">
                      {getDisplayName(note.currentHolder)}
                    </p>
                  </div>
                </div>
              )}
              
              {note.currentStep?.isCentralDepartment && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                   <div>
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide mb-1">Current Step</p>
                      <p className="font-semibold text-base text-gray-900 dark:text-white">{note.currentStep.centralDepartmentName ?? note.currentStep.authorityType}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Central Department Approval</p>
                      
                      {note.currentStep.members?.length > 0 && (
                         <div className="mt-2 flex -space-x-2 overflow-hidden">
                            {note.currentStep.members.slice(0, 3).map((m, i) => (
                              <div key={i} title={m.displayName} className="flex h-7 w-7 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 items-center justify-center text-[10px] font-bold overflow-hidden">
                                {m.displayName.substring(0,2)}
                              </div>
                            ))}
                             {note.currentStep.members.length > 3 && (
                                <div className="flex h-7 w-7 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 items-center justify-center text-[10px] text-gray-500 font-bold">
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
          </div>

          <div className="px-4 py-5 space-y-6">
            {/* Description Section */}
            <section>
              <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Description</h3>
              <div className="prose dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed text-base">
                {note.description}
              </div>
            </section>

            {/* Event Details Section - Only show when subcategory is events */}
            {note.subcategory === 'events' && (
              <section>
                <div className="rounded-xl border border-teal-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                   <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-3 py-2 border-b border-teal-100 dark:border-gray-700 flex items-center gap-2">
                      <div className="p-1 rounded bg-white/20 text-white">
                         <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                         </svg>
                      </div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                        Event Details
                      </h3>
                   </div>
                   <div className="p-4">
                    {!note.eventName && !note.eventType && !note.eventStartDate ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">Event details not provided or not yet filled.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {note.eventName && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Event Name</label>
                            <p className="text-base font-medium text-gray-900 dark:text-white">{note.eventName}</p>
                          </div>
                        )}
                        {note.eventType && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Event Type</label>
                            <p className="text-base font-medium text-gray-900 dark:text-white capitalize">{note.eventType.replace('_', ' ')}</p>
                          </div>
                        )}
                        {note.eventStartDate && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Start Date</label>
                            <p className="text-base font-medium text-gray-900 dark:text-white">
                              {new Date(note.eventStartDate).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </p>
                          </div>
                        )}
                        {note.eventEndDate && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">End Date</label>
                            <p className="text-base font-medium text-gray-900 dark:text-white">
                              {new Date(note.eventEndDate).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </p>
                          </div>
                        )}
                        {note.eventPaymentType && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Payment Type</label>
                            <p className="text-base font-medium text-gray-900 dark:text-white">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                note.eventPaymentType === 'free' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {note.eventPaymentType.toUpperCase()}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Info box for event creation */}
                    {note.eventName && note.status === 'pending' && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                              Event Auto-Creation
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                              When this noting is approved, an event will be automatically created in <span className="font-semibold">DRAFT</span> status. 
                              The creator can then add venue, registration dates, and other details before publishing it.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Success message after approval */}
                    {note.eventName && note.status === 'approved' && (
                      <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-900 dark:text-green-300">
                              Event Created Successfully
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                              An event has been created in DRAFT status. Visit <a href="/events/my-events" className="underline font-semibold">My Created Events</a> to add details and publish it.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                   </div>
                </div>
              </section>
            )}

            {/* Points */}
            {note.points && note.points.length > 0 && (
              <section>
                <div className="rounded-xl border border-indigo-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                   <div className="bg-indigo-50/50 dark:bg-indigo-900/10 px-3 py-2 border-b border-indigo-100 dark:border-gray-700 flex items-center gap-2">
                      <div className="p-1 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                         <FileText className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                        Requirements / Points
                      </h3>
                   </div>
                   <div className="p-3">
                    <ol className="list-decimal list-inside space-y-2 text-base text-gray-700 dark:text-gray-300">
                      {note.points.map((pt, i) => (
                        <li key={pt.id || i} className="pl-1 leading-relaxed">
                          <span className="font-medium text-gray-900 dark:text-white">{pt.content}</span>
                        </li>
                      ))}
                    </ol>
                   </div>
                </div>
              </section>
            )}

            {/* Attachments Section */}
            {note.attachments && note.attachments.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="w-4 h-4 text-gray-400" />
                  <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Attachments</h3>
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    {note.attachments.length}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {note.attachments.map((att) => {
                    const isDownloading = downloadingPath === att.filePath;
                    const isViewing = viewingPath === att.filePath;
                    return (
                      <div key={att.id} className="group relative rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200">
                        <div className="flex items-start gap-3">
                           <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                           </div>
                           <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate" title={att.fileName}>
                                {att.fileName}
                              </p>
                              {att.fileDescription && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1" title={att.fileDescription}>
                                  {att.fileDescription}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50 dark:border-gray-700/50">
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
                                  className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                  {isViewing ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Eye className="w-2.5 h-2.5" />}
                                  Preview
                                </button>
                                <div className="w-px h-2 bg-gray-200 dark:bg-gray-700"></div>
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
                                  className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                  {isDownloading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
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

            {/* Created By */}
            <section className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Originator</h3>
              <div className="flex items-start gap-3">
                 <div className="w-10 h-10 rounded-full ring-2 ring-white dark:ring-gray-700 shadow-sm bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold">
                    {getDisplayName(note.createdBy).charAt(0)}
                 </div>
                 <div>
                    <div className="flex items-center gap-2 mb-0.5">
                       <span className="font-bold text-gray-900 dark:text-white text-base">
                          {getDisplayName(note.createdBy)}
                       </span>
                       <span className="px-1.5 py-0.5 rounded text-xs font-bold uppercase bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {note.createdBy?.role}
                       </span>
                    </div>
                    <div className="flex flex-wrap text-sm text-gray-500 dark:text-gray-400 gap-x-4 gap-y-0.5">
                       <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {note.createdBy?.employeeDetails?.primaryDepartment?.departmentName ?? note.createdBy?.studentLogin?.program?.department?.departmentName ?? '—'}
                       </span>
                       <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(note.createdAt).toLocaleString()}
                       </span>
                    </div>
                 </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Right Column - Metadata & Timeline */}
      <div className="xl:col-span-4 space-y-4">
        {/* Metadata Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">Details</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 border-dashed">
              <span className="text-sm text-gray-500">Approval Period</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 capitalize">
                {note.approvalPeriod.replace('_', ' ')}
              </span>
            </div>
            {note.recurringFrequency && (
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 border-dashed">
                 <span className="text-sm text-gray-500">Frequency</span>
                 <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{note.recurringFrequency}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 border-dashed">
               <span className="text-sm text-gray-500">Amount Required</span>
               <span className={`text-sm font-bold ${note.amountRequired ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                 {note.amountRequired ? `₹ ${Number(note.amount || 0).toLocaleString()}` : '—'}
               </span>
            </div>
            <div className="flex justify-between items-center pt-1">
               <span className="text-sm text-gray-500">Policy Compliance</span>
               <span className={`flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full ${
                  note.policyCompliant === true ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  note.policyCompliant === false ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-gray-100 text-gray-500'
               }`}>
                  {note.policyCompliant === true ? <CheckCircle className="w-3 h-3" /> : note.policyCompliant === false ? <XCircle className="w-3 h-3" /> : null}
                  {note.policyCompliant === true ? 'Yes' : note.policyCompliant === false ? 'No' : 'N/A'}
               </span>
            </div>
          </div>
        </div>

        {/* Approval Trail */}
        {note.history && note.history.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Approval Trail</h3>
              <div className="h-px flex-1 bg-gray-200 dark:border-gray-700"></div>
            </div>
                
            <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-gradient-to-b before:from-indigo-200 before:via-gray-200 before:to-transparent dark:before:from-indigo-800 dark:before:via-gray-700 max-h-[600px] overflow-y-auto pr-1">
              {note.history.map((h) => {
                // Determine style based on action
                let config = {icon: Clock, iconColor: 'bg-gray-500'};
                const action = h.action.toLowerCase();

                if (action.includes('submit')) config = {icon: Send, iconColor: 'bg-blue-600'};
                else if (action.includes('approve')) config = {icon: CheckCircle, iconColor: 'bg-green-600'};
                else if (action.includes('reject')) config = {icon: XCircle, iconColor: 'bg-red-600'};
                else if (action.includes('revert')) config = {icon: RotateCcw, iconColor: 'bg-orange-500'};
                else if (action.includes('forward')) config = {icon: ArrowRight, iconColor: 'bg-violet-600'};

                const Icon = config.icon;

                return (
                  <div key={h.id} className="relative">
                    {/* Timeline Icon */}
                    <div className="absolute -left-[1.1rem] top-0.5">
                      <div className={`h-5 w-5 rounded-full ${config.iconColor} border-2 border-white dark:border-gray-800 flex items-center justify-center shadow-sm`}>
                        <Icon className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 text-sm">
                      <div className="font-semibold text-gray-900 dark:text-white capitalize mb-1">{h.action}</div>
                      <div className="text-gray-600 dark:text-gray-400 text-xs mb-1">
                        {getDisplayName(h.performedBy)} • {new Date(h.createdAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                      {h.remarks && (
                        <div className="text-gray-700 dark:text-gray-300 text-sm italic mt-2 pl-2 border-l-2 border-gray-300 dark:border-gray-600">
                          {h.remarks}
                        </div>
                      )}
                      {h.nextHolder && (
                        <div className="flex items-center gap-1 text-xs mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 font-medium">
                          <CornerDownLeft className="w-3 h-3" />
                          Assigned: {getDisplayName(h.nextHolder)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Actions Section - Full Width */}
    <div className="py-6">
      {canAct && (
        <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Actions</h3>
          <div className="space-y-3">
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Remarks (mandatory for Reject and Forward)"
            />
            {actionType === 'forward' && (
              <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Forward Selection</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="forwardMode"
                      checked={forwardMode === 'automated'}
                      onChange={() => setForwardMode('automated')}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-sm">Automated Forward</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="forwardMode"
                      checked={forwardMode === 'manual'}
                      onChange={() => setForwardMode('manual')}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    <Hand className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm">Manual Forward</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Automated: system forwards to the next authority in the approval flow. Manual: choose School → Department → Program, then select a user.
                </p>
                {forwardMode === 'manual' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">School</label>
                      <select
                        value={schoolId}
                        onChange={(e) => setSchoolId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="">Select school</option>
                        {schools.map((s) => (
                          <option key={s.id} value={s.id}>{s.facultyName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        disabled={!schoolId || optionsLoading}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                      >
                        <option value="">Select department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.departmentName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Program</label>
                      <select
                        value={programId}
                        onChange={(e) => setProgramId(e.target.value)}
                        disabled={!departmentId || optionsLoading}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                      >
                        <option value="">Select program (optional)</option>
                        {programs.map((p) => (
                          <option key={p.id} value={p.id}>{p.programName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Forward to user</label>
                      <select
                        value={forwardUserId}
                        onChange={(e) => setForwardUserId(e.target.value)}
                        disabled={!departmentId || optionsLoading}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
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
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={doApprove}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {actionType === 'approve' && actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve
              </button>
              <button
                onClick={doReject}
                disabled={actionLoading || !remarks.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {actionType === 'reject' && actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject
              </button>
              <button
                onClick={doRevert}
                disabled={actionLoading || !remarks.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                title="Send back to creator for modifications"
              >
                {actionType === 'revert' && actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Revert Back
              </button>
              <button
                onClick={() => setActionType(actionType === 'forward' ? null : 'forward')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                title="Choose forward method (automated or manual)"
              >
                {actionType === 'forward' ? 'Cancel forward' : 'Forward note…'}
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Forward'}
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
    </div>
  </div>
);
}

