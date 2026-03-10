'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Loader2, Plus, Eye, CheckCheck, XCircle as XCircleIcon,
  QrCode, Pencil, FileText, ExternalLink, X,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, StallApplication, Stall, StallMetadata, StallType } from '@/features/event-management/types/event.types';
import CreateStallForm, { type CreateStallFormData } from '@/features/event-management/components/CreateStallForm';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { CARD, CARD_HEADER } from './constants';

// ── Props ────────────────────────────────────────────────────────
interface StallsTabProps {
  eventId: string;
  event: Event;
  onEventChange: (event: Event) => void;
}

export default function StallsTab({ eventId, event, onEventChange }: StallsTabProps) {
  const { toast } = useToast();

  // State
  const [stallApplications, setStallApplications] = useState<StallApplication[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [stallsLoading, setStallsLoading] = useState(false);
  const [stallStatusFilter, setStallStatusFilter] = useState<string>('all');
  const [stallActionLoading, setStallActionLoading] = useState<string | null>(null);
  const [stallToggleLoading, setStallToggleLoading] = useState(false);
  const [selectedStallApp, setSelectedStallApp] = useState<StallApplication | null>(null);
  const [showStallAppModal, setShowStallAppModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [showCreateStallModal, setShowCreateStallModal] = useState(false);
  const [selectedStall, setSelectedStall] = useState<Stall | null>(null);
  const [selectedStallForEdit, setSelectedStallForEdit] = useState<Stall | null>(null);
  const [stallQrModal, setStallQrModal] = useState<{ stallId: string; stallName: string; qrDataUrl: string } | null>(null);

  // Load stall data on mount
  useEffect(() => {
    if (event?.hasStalls) loadStallData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStallData = useCallback(async () => {
    setStallsLoading(true);
    try {
      const [appsResult, stallsResult] = await Promise.allSettled([
        eventService.getStallApplications(eventId, { limit: 100 }),
        eventService.getStalls(eventId),
      ]);
      if (appsResult.status === 'fulfilled') {
        const appsData = appsResult.value as any;
        setStallApplications(appsData.applications || appsData || []);
      }
      if (stallsResult.status === 'fulfilled') {
        const v = stallsResult.value as any;
        setStalls(Array.isArray(v) ? v : Array.isArray(v?.stalls) ? v.stalls : []);
      }
    } catch {
      toast({ type: 'error', message: 'Failed to load stall data' });
    } finally {
      setStallsLoading(false);
    }
  }, [eventId, toast]);

  const handleStallApplicationAction = async (appId: string, status: 'approved' | 'rejected', reason?: string) => {
    if (status === 'rejected' && !reason) {
      setRejectingAppId(appId);
      setRejectReason('');
      setShowRejectModal(true);
      return;
    }
    setStallActionLoading(appId);
    try {
      await eventService.updateStallApplication(eventId, appId, { status, rejectionReason: reason });
      await loadStallData();
      toast({ type: 'success', message: `Application ${status}` });
      if (status === 'rejected') {
        setShowRejectModal(false);
        setRejectingAppId(null);
      }
      if (showStallAppModal && selectedStallApp?.id === appId) {
        setShowStallAppModal(false);
      }
    } catch (err: any) {
      toast({ type: 'error', message: err?.response?.data?.message || `Failed to ${status}` });
    } finally {
      setStallActionLoading(null);
    }
  };

  const handleConfirmRejection = () => {
    if (!rejectingAppId) return;
    if (!rejectReason.trim()) {
      toast({ type: 'error', message: 'Please provide a reason for rejection' });
      return;
    }
    handleStallApplicationAction(rejectingAppId, 'rejected', rejectReason);
  };

  const stallToFormData = (stall: Stall & { stallCategory?: string; description?: string; size?: string; stallMetadata?: { businessName?: string; electricityRequired?: boolean; waterRequired?: boolean; specialRequirements?: string; products?: string[] } }): CreateStallFormData => {
    const meta = stall.stallMetadata && typeof stall.stallMetadata === 'object' ? stall.stallMetadata : {};
    const spaceMatch = stall.size?.match(/(\d+)/);
    return {
      stallName: stall.stallName,
      stallType: (stall.stallType as StallType) || 'non_food',
      category: stall.stallCategory || stall.category || '',
      businessName: meta.businessName || '',
      businessDescription: stall.description || '',
      products: (meta.products && meta.products.length > 0) ? meta.products : [''],
      spaceRequired: spaceMatch ? parseInt(spaceMatch[1], 10) : undefined,
      electricityRequired: meta.electricityRequired ?? false,
      waterRequired: meta.waterRequired ?? false,
      specialRequirements: meta.specialRequirements || '',
    };
  };

  const handleUpdateStall = async (data: CreateStallFormData) => {
    if (!selectedStallForEdit) return;
    const descParts = [data.businessDescription, data.products?.filter(Boolean).join(', '), data.specialRequirements].filter(Boolean);
    try {
      const updated = await eventService.updateStall(eventId, selectedStallForEdit.stallId, {
        stallName: data.stallName,
        stallType: data.stallType,
        category: data.category,
        description: descParts.length > 0 ? descParts.join('\n\n') : undefined,
        size: data.spaceRequired ? `${data.spaceRequired} sq ft` : undefined,
        businessName: data.businessName,
        electricityRequired: data.electricityRequired,
        waterRequired: data.waterRequired,
        specialRequirements: data.specialRequirements,
        products: data.products?.filter(Boolean),
      });
      setStalls((prev) => prev.map((s) => (s.stallId === updated.stallId || s.id === updated.id ? { ...s, ...updated } : s)));
      setSelectedStallForEdit(null);
      toast({ type: 'success', message: 'Stall updated successfully' });
    } catch (err: unknown) {
      toast({ type: 'error', message: getErrorMessage(err) });
      throw err;
    }
  };

  const handleCreateStall = async (data: CreateStallFormData) => {
    const descParts = [data.businessDescription, data.products?.filter(Boolean).join(', '), data.specialRequirements].filter(Boolean);
    try {
      const created = await eventService.createStall(eventId, {
        stallName: data.stallName,
        stallType: data.stallType,
        category: data.category,
        description: descParts.length > 0 ? descParts.join('\n\n') : undefined,
        size: data.spaceRequired ? `${data.spaceRequired} sq ft` : undefined,
        businessName: data.businessName,
        electricityRequired: data.electricityRequired,
        waterRequired: data.waterRequired,
        specialRequirements: data.specialRequirements,
        products: data.products?.filter(Boolean),
      });
      setStalls((prev) => [...prev, created]);
      toast({ type: 'success', message: 'Stall created successfully' });
    } catch (err: unknown) {
      toast({ type: 'error', message: getErrorMessage(err) });
      throw err;
    }
  };

  const handleToggleStallApplications = async () => {
    setStallToggleLoading(true);
    try {
      const result = await eventService.toggleStallApplications(eventId);
      onEventChange({ ...event, stallConfig: result.stallConfig });
      toast({
        type: 'success',
        message: result.stallApplicationsOpen
          ? 'Student stall applications are now OPEN'
          : 'Student stall applications are now CLOSED',
      });
    } catch (err: any) {
      toast({ type: 'error', message: err?.response?.data?.message || 'Failed to toggle stall applications' });
    } finally {
      setStallToggleLoading(false);
    }
  };

  const openStallAppDetails = (app: StallApplication) => {
    setSelectedStallApp(app);
    setShowStallAppModal(true);
  };

  const handleShowStallQR = async (stall: Stall & { stallQrCode?: string | null }) => {
    if (typeof window === 'undefined') return;
    const qrPath = stall.stallQrCode || `/events/${eventId}/stalls/${stall.stallId}/feedback`;
    const url = qrPath.startsWith('http') ? qrPath : `${window.location.origin}${qrPath}`;
    try {
      const QRCodeGenerator = (await import('qrcode')).default;
      const dataUrl = await QRCodeGenerator.toDataURL(url, { width: 260, margin: 2 });
      setStallQrModal({ stallId: stall.stallId, stallName: stall.stallName, qrDataUrl: dataUrl });
    } catch {
      toast({ type: 'error', message: 'Failed to generate stall QR code' });
    }
  };

  // ── JSX ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toggle Banner */}
      <div className={`${CARD} p-4`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Store className="w-4 h-4 text-ev-700" />
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Student Stall Applications Portal</h4>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {event.stallConfig?.enableStudentApplied
                ? 'Portal is OPEN — students can apply for stalls right now'
                : 'Portal is CLOSED — students cannot apply for stalls'}
            </p>
            {event.status === 'draft' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Event is in draft mode but you can still open applications early.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-xs font-semibold ${event.stallConfig?.enableStudentApplied ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {event.stallConfig?.enableStudentApplied ? 'OPEN' : 'CLOSED'}
            </span>
            <button
              onClick={handleToggleStallApplications}
              disabled={stallToggleLoading}
              title={event.stallConfig?.enableStudentApplied ? 'Click to close applications' : 'Click to open applications'}
              className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ev-700 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${event.stallConfig?.enableStudentApplied
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
            >
              {stallToggleLoading ? (
                <Loader2 className="w-4 h-4 text-white animate-spin mx-auto" />
              ) : (
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${event.stallConfig?.enableStudentApplied ? 'translate-x-8' : 'translate-x-1'}`} />
              )}
            </button>
          </div>
        </div>
      </div>

      {stallsLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-ev-700" /></div>
      ) : (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Applications', value: stallApplications.length, color: 'text-ev-700', bg: 'bg-ev-50 dark:bg-ev-900/20' },
              { label: 'Pending', value: stallApplications.filter((a) => a.status === 'pending').length, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
              { label: 'Approved', value: stallApplications.filter((a) => a.status === 'approved').length, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Active Stalls', value: stalls.filter((s) => s.isActive).length, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
            ].map((m) => (
              <div key={m.label} className={`${CARD} p-4 flex flex-col gap-1`}>
                <span className={`text-2xl font-bold ${m.color}`}>{m.value}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{m.label}</span>
              </div>
            ))}
          </div>

          {/* Applications */}
          <div className={`${CARD} overflow-hidden`}>
            <div className={`${CARD_HEADER} flex items-center justify-between flex-wrap gap-2`}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-ev-700" />
                Stall Applications
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateStallModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-ev-700 hover:bg-ev-800 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Stall
                </button>
                <select
                  value={stallStatusFilter}
                  onChange={(e) => setStallStatusFilter(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {stallApplications.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No stall applications yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {stallApplications
                  .filter((a) => stallStatusFilter === 'all' || a.status === stallStatusFilter)
                  .map((app) => (
                    <div key={app.id} className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm text-gray-900 dark:text-white">{app.stallName}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{app.stallType}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${app.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : app.status === 'rejected' ? 'bg-red-100 text-red-700' : app.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                            {app.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          <p>{app.ownerName || 'Unknown'} · {app.ownerEmail}</p>
                          {(app.ownerSchool || app.ownerDepartment) && (
                            <p className="text-gray-400 dark:text-gray-500">
                              {app.ownerSchool || ''} {app.ownerSchool && app.ownerDepartment ? '•' : ''} {app.ownerDepartment || ''}
                            </p>
                          )}
                        </div>
                        {app.businessName && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{app.businessName}</p>}
                        {app.rejectionReason && <p className="text-xs text-red-500 italic mt-0.5">Note: {app.rejectionReason}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => openStallAppDetails(app)}
                          className="p-1.5 text-gray-500 hover:text-ev-700 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {app.status === 'pending' && (
                          <>
                            <button
                              disabled={stallActionLoading === app.id}
                              onClick={() => handleStallApplicationAction(app.id, 'approved')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {stallActionLoading === app.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                              Approve
                            </button>
                            <button
                              disabled={stallActionLoading === app.id}
                              onClick={() => handleStallApplicationAction(app.id, 'rejected')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <XCircleIcon className="w-3 h-3" />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Active Stalls */}
          {stalls.length > 0 && (
            <div className={`${CARD} overflow-hidden`}>
              <div className={CARD_HEADER}>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Store className="w-4 h-4 text-purple-500" />
                  Active Stalls
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {stalls.map((stall) => (
                  <div key={stall.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{stall.stallName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">{stall.stallType}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${stall.source === 'creator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {stall.source === 'creator' ? 'Organizer' : 'Student'}
                        </span>
                      </div>
                      {stall.location && <p className="text-xs text-gray-400 mt-0.5">Location: {stall.location}</p>}
                      {(stall as Stall & { ownerName?: string }).ownerName && (
                        <p className="text-xs text-gray-400">{(stall as Stall & { ownerName?: string }).ownerName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedStall(stall)}
                        className="p-1.5 text-gray-500 hover:text-ev-700 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShowStallQR(stall as any)}
                        className="p-1.5 text-gray-500 hover:text-purple-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md transition-colors"
                        title="Show Feedback QR"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      {stall.source === 'creator' && (
                        <button
                          onClick={() => setSelectedStallForEdit(stall)}
                          className="p-1.5 text-gray-500 hover:text-ev-700 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <span className="text-xs font-mono text-gray-400 ml-1">{stall.stallId}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modals ─────────────────────────────────────────────── */}
      {/* Stall Application Details Modal */}
      {showStallAppModal && selectedStallApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stall Application Details</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Applied on {new Date(selectedStallApp.appliedAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setShowStallAppModal(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Status Band */}
              <div className={`px-4 py-2 rounded-md flex items-center justify-between ${selectedStallApp.status === 'approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : selectedStallApp.status === 'rejected' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' : selectedStallApp.status === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300'}`}>
                <span className="text-sm font-medium">Status: {selectedStallApp.status.toUpperCase()}</span>
                {selectedStallApp.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { handleStallApplicationAction(selectedStallApp.id, 'approved'); setShowStallAppModal(false); }}
                      className="px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700"
                    >Approve</button>
                    <button
                      onClick={() => { handleStallApplicationAction(selectedStallApp.id, 'rejected'); setShowStallAppModal(false); }}
                      className="px-3 py-1 bg-white border border-red-200 text-red-600 text-xs font-medium rounded-md hover:bg-red-50"
                    >Reject</button>
                  </div>
                )}
              </div>

              {/* Applicant Info */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Applicant Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-xs text-gray-500 mb-1">Name</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.ownerName || 'N/A'}</span>
                    <div className="mt-2">
                      <span className="block text-xs text-gray-500 mb-1">School/Faculty</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.ownerSchool || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-xs text-gray-500 mb-1">Email</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.ownerEmail || 'N/A'}</span>
                    <div className="mt-2">
                      <span className="block text-xs text-gray-500 mb-1">Department</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.ownerDepartment || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stall Info */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Stall Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg">
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Stall Name</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.stallName}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Type</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">{selectedStallApp.stallType.replace('_', ' ')}</span>
                  </div>
                  {selectedStallApp.category && (
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Category</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.category}</span>
                    </div>
                  )}
                  {selectedStallApp.spaceRequired && (
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Space Required</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.spaceRequired} sq ft</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Details */}
              {(selectedStallApp.businessName || selectedStallApp.businessDescription || selectedStallApp.products) && (
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Business Details</h4>
                  <div className="space-y-3 text-sm">
                    {selectedStallApp.businessName && (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Business Name</span>
                        <p className="text-gray-900 dark:text-white">{selectedStallApp.businessName}</p>
                      </div>
                    )}
                    {selectedStallApp.businessDescription && (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Description</span>
                        <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/20 p-3 rounded-md">{selectedStallApp.businessDescription}</p>
                      </div>
                    )}
                    {selectedStallApp.products && selectedStallApp.products.length > 0 && (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Products/Services</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedStallApp.products.map((prod, i) => (
                            <span key={i} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-md">{prod}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Requirements */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Requirements & Compliance</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedStallApp.electricityRequired ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-gray-700 dark:text-gray-300">Electricity Required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedStallApp.waterRequired ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-gray-700 dark:text-gray-300">Water Required</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">GST Number: </span>
                      <span className="text-gray-900 dark:text-white font-mono">{selectedStallApp.gstNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Food License: </span>
                      <span className="text-gray-900 dark:text-white font-mono">{selectedStallApp.foodLicenseNumber || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                {selectedStallApp.specialRequirements && (
                  <div className="mt-3">
                    <span className="block text-xs text-gray-500 mb-1">Special Requirements</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">{selectedStallApp.specialRequirements}</p>
                  </div>
                )}
              </div>

              {/* Documents */}
              {selectedStallApp.documentUrls && selectedStallApp.documentUrls.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Documents</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedStallApp.documentUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-ev-700 dark:text-ev-400"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Document {i + 1}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button onClick={() => setShowStallAppModal(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reject Application</h3>
              <button onClick={() => setShowRejectModal(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Please provide a reason for rejecting this stall application. This will be shared with the applicant.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  placeholder="E.g., Incomplete documentation, stall type not allowed..."
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={stallActionLoading !== null}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejection}
                disabled={stallActionLoading !== null || !rejectReason.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stallActionLoading === rejectingAppId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircleIcon className="w-4 h-4" />
                )}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stall QR Modal */}
      {stallQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setStallQrModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stall Feedback QR</h3>
              <button onClick={() => setStallQrModal(null)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">{stallQrModal.stallName}</p>
            <p className="text-xs text-gray-400 mb-4">Place this QR at the stall — customers scan it to leave feedback anonymously.</p>
            <div className="flex justify-center p-4 bg-white rounded-lg border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stallQrModal.qrDataUrl} alt="Stall Feedback QR" className="w-64 h-64" />
            </div>
            <p className="text-center text-xs text-gray-400 mt-3 font-mono">{stallQrModal.stallId}</p>
            <a
              href={stallQrModal.qrDataUrl}
              download={`stall-feedback-qr-${stallQrModal.stallId}.png`}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Download QR
            </a>
          </div>
        </div>
      )}

      {/* Create Stall Modal */}
      {showCreateStallModal && (
        <CreateStallForm
          onClose={() => setShowCreateStallModal(false)}
          onSubmit={handleCreateStall}
        />
      )}

      {/* Stall Details Modal */}
      {selectedStall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stall Details</h3>
              <button onClick={() => setSelectedStall(null)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-white">{selectedStall.stallName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">{selectedStall.stallType}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${selectedStall.source === 'creator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {selectedStall.source === 'creator' ? 'Organizer' : 'Student'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-xs text-gray-500 mb-1">Stall ID</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">{selectedStall.stallId}</span>
                </div>
                {(selectedStall as { stallCategory?: string }).stallCategory && (
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Category</span>
                    <span className="font-medium text-gray-900 dark:text-white">{(selectedStall as { stallCategory?: string }).stallCategory}</span>
                  </div>
                )}
                {(selectedStall as { size?: string }).size && (
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Size</span>
                    <span className="font-medium text-gray-900 dark:text-white">{(selectedStall as { size?: string }).size}</span>
                  </div>
                )}
                {(selectedStall as { location?: string }).location && (
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Location</span>
                    <span className="font-medium text-gray-900 dark:text-white">{(selectedStall as { location?: string }).location}</span>
                  </div>
                )}
                {(selectedStall as { ownerName?: string }).ownerName && (
                  <div className="col-span-2">
                    <span className="block text-xs text-gray-500 mb-1">Owner</span>
                    <span className="font-medium text-gray-900 dark:text-white">{(selectedStall as { ownerName?: string }).ownerName}</span>
                  </div>
                )}
              </div>
              {(selectedStall as { description?: string }).description && (
                <div>
                  <span className="block text-xs text-gray-500 mb-1">Description</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{(selectedStall as { description?: string }).description}</p>
                </div>
              )}
              {(() => {
                const meta = (selectedStall as Stall & { stallMetadata?: StallMetadata }).stallMetadata;
                if (!meta) return null;
                return (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Infrastructure & Business</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {meta.businessName && (
                        <div>
                          <span className="block text-xs text-gray-500 mb-1">Business Name</span>
                          <span className="font-medium text-gray-900 dark:text-white">{meta.businessName}</span>
                        </div>
                      )}
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Electricity</span>
                        <span className="font-medium text-gray-900 dark:text-white">{meta.electricityRequired ? 'Yes' : 'No'}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Water</span>
                        <span className="font-medium text-gray-900 dark:text-white">{meta.waterRequired ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    {meta.specialRequirements && (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Special Requirements</span>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{meta.specialRequirements}</p>
                      </div>
                    )}
                    {meta.products?.length ? (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Products / Services</span>
                        <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
                          {meta.products.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Stall Modal */}
      {selectedStallForEdit && (
        <CreateStallForm
          onClose={() => setSelectedStallForEdit(null)}
          onSubmit={handleUpdateStall}
          initialData={stallToFormData(selectedStallForEdit as Stall & { stallCategory?: string; description?: string; size?: string; stallMetadata?: { businessName?: string; electricityRequired?: boolean; waterRequired?: boolean; specialRequirements?: string; products?: string[] } })}
        />
      )}
    </div>
  );
}
