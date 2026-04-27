'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Shield,
  QrCode,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MapPin,
  AlertCircle,
  Calendar,
  Users,
  Radio,
  LogIn,
  LogOut,
  Camera,
  Keyboard,
  History,
  Tag,
  Mail,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, PassPreviewData } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage, getErrorStatusCode, isNetworkError } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { Skeleton } from "@/components/skeletons";


const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-[#b3cde0] dark:border-ev-700 shadow-ev';

interface ScanResult {
  id?: string;
  entryType: 'entry' | 'exit';
  entryCount?: number;
  scannedAt: string;
  success: boolean;
  isWarning?: boolean; // Business rule (e.g. already entered) - not counted as failed
  error?: string;
  qrCode?: string;
  gateLocation?: string;
  participantName?: string;
  participantUid?: string;
  participantEmail?: string;
  registrationId?: string;
}

interface PersistedVolunteerActivityEntry {
  id: string;
  registrationId: string;
  entryType: 'entry' | 'exit';
  entryCount?: number;
  scannedAt: string;
  gateLocation?: string;
  participant: {
    name: string;
    uid?: string | null;
    email?: string | null;
    registrationNo?: string | null;
  };
}

export default function VolunteerEventPage() {
  const params = useParams() as Record<string, string>;
  const eventId = params?.id as string;
  const { toast } = useToast();

  // Event state
  const [event, setEvent] = useState<Event | null>(null);
  const [volunteerInfo, setVolunteerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Scanner state
  const [entryType, setEntryType] = useState<'entry' | 'exit'>('entry');
  const [qrInput, setQrInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [gateLocation, setGateLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [scanMode, setScanMode] = useState<'input' | 'camera'>('input');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [persistedScans, setPersistedScans] = useState<ScanResult[]>([]);
  const [persistedStats, setPersistedStats] = useState({ entries: 0, exits: 0, total: 0 });

  // Stats
  const [sessionStats, setSessionStats] = useState({ entries: 0, exits: 0, failed: 0 });

  // Group entry modal state
  const [groupModal, setGroupModal] = useState<{ preview: PassPreviewData; qrCode: string } | null>(null);
  const [groupCount, setGroupCount] = useState(1);
  const [groupSubmitting, setGroupSubmitting] = useState(false);

  const qrInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<any>(null);
  const handleScanRef = useRef<(qrCode?: string) => Promise<void>>(() => Promise.resolve());
  const isProcessingRef = useRef(false);
  const cameraActiveRef = useRef(false); // Guards decode callback during mode-switch transitions

  useEffect(() => {
    const fetchData = async () => {
      try {
        const eventData = await eventService.getEventById(eventId);
        setEvent(eventData);

        try {
          const activityData = await eventService.getMyVolunteerActivity(1, 20, { eventId });
          setPersistedScans(
            (activityData.entries || []).map((entry: PersistedVolunteerActivityEntry) => ({
              id: entry.id,
              entryType: entry.entryType,
              entryCount: entry.entryCount || 1,
              scannedAt: entry.scannedAt,
              success: true,
              gateLocation: entry.gateLocation,
              participantName: entry.participant?.name,
              participantUid: entry.participant?.uid || undefined,
              participantEmail: entry.participant?.email || undefined,
              registrationId: entry.registrationId,
            }))
          );
          setPersistedStats({
            entries: activityData.stats?.totalEntries || 0,
            exits: activityData.stats?.totalExits || 0,
            total: activityData.stats?.totalScans || 0,
          });
        } catch (activityError: any) {
          setPersistedScans([]);
          setPersistedStats({ entries: 0, exits: 0, total: 0 });
          toast({ type: 'warning', message: `Unable to load previous scan history: ${getErrorMessage(activityError)}` });
        }

        // Try to fetch volunteer info for this user
        try {
          const assignments = await eventService.getMyVolunteerAssignments();
          const myAssignment = assignments.find((a: any) => a.eventId ===
   eventId);
          if (myAssignment) {
            setVolunteerInfo(myAssignment);
            if (myAssignment.assignedGate) {
              setGateLocation(myAssignment.assignedGate);
            }
          }
        } catch {
          // Okay if this fails
        }
      } catch (error: any) {
        toast({ type: 'error', message: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    };

    if (eventId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Auto-focus on QR input when in input mode
  useEffect(() => {
    if (scanMode ===
   'input') {
      qrInputRef.current?.focus();
    }
  }, [scanMode]);

  const combinedRecentScans = useMemo(() => {
    const merged = [...recentScans, ...persistedScans];
    const uniqueScans = merged.filter((scan, index, scans) => {
      if (!scan.success || !scan.id) return true;
      return index ===
   scans.findIndex((candidate) => candidate.success && candidate.id ===
   scan.id);
    });

    return uniqueScans
      .sort((left, right) => new Date(right.scannedAt).getTime() - new Date(left.scannedAt).getTime())
      .slice(0, 20);
  }, [recentScans, persistedScans]);

  const displayedStats = useMemo(() => ({
    entries: persistedStats.entries + sessionStats.entries,
    exits: persistedStats.exits + sessionStats.exits,
    failed: sessionStats.failed,
  }), [persistedStats, sessionStats]);

  const handleScan = async (qrCode?: string) => {
    const code = qrCode || qrInput.trim();
    if (!code) {
      toast({ type: 'error', message: 'Please enter or scan a QR code' });
      return;
    }
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setScanning(true);
    try {
      // First get pass preview to check capacity
      const preview = await eventService.previewQRScan(eventId, code, entryType);

      if (preview.maxForThisScan <= 0) {
        const msg = entryType ===
   'entry'
          ? `Pass capacity reached (${preview.currentlyInside}/${preview.totalAllowedEntries} currently inside)`
          : 'No one is currently inside for this pass';
        toast({ type: 'warning', message: msg });
        setQrInput('');
        return;
      }

      // If pass allows only 1 person for this scan, proceed directly
      if (preview.maxForThisScan ===
   1) {
        await executeScan(code, 1);
      } else {
        // Show group entry modal
        setGroupCount(preview.maxForThisScan);
        setGroupModal({ preview, qrCode: code });
      }
    } catch (error: any) {
      const errorMsg = getErrorMessage(error);
      const status = getErrorStatusCode(error);
      const isValidationWarning =
        status ===
   400 &&
        (errorMsg.toLowerCase().includes('already entered') ||
          errorMsg.toLowerCase().includes('not checked in') ||
          errorMsg.toLowerCase().includes('check in first') ||
          errorMsg.toLowerCase().includes('check out first') ||
          errorMsg.toLowerCase().includes('not confirmed') ||
          errorMsg.toLowerCase().includes('capacity reached'));
      const isRealFailure =
        !isValidationWarning &&
        (isNetworkError(error) || (status != null && status >= 500) || status ===
   404);

      const scan: ScanResult = {
        entryType,
        scannedAt: new Date().toISOString(),
        success: false,
        isWarning: isValidationWarning,
        error: errorMsg,
        qrCode: code,
      };
      setRecentScans((prev) => [scan, ...prev.slice(0, 19)]);
      if (isRealFailure) {
        setSessionStats((prev) => ({ ...prev, failed: prev.failed + 1 }));
      }
      toast({
        type: isValidationWarning ? 'warning' : 'error',
        message: errorMsg,
      });
    } finally {
      isProcessingRef.current = false;
      setScanning(false);
    }
  };

  const executeScan = async (code: string, peopleCount: number) => {
    const result = await eventService.scanQRCode(eventId, {
      qrCode: code,
      entryType,
      peopleCount,
      gateLocation: gateLocation || undefined,
      remarks: remarks || undefined,
    });

    const regData = (result as any).EventRegistration || result.registration;
    const userInfo = regData?.user_login || regData?.user;
    const empDetails = userInfo?.employeeDetails;
    const studentDetails = userInfo?.studentLogin;
    const participantName =
      userInfo?.name ||
      empDetails?.displayName ||
      `${empDetails?.firstName || ''} ${empDetails?.lastName || ''}`.trim() ||
      studentDetails?.displayName ||
      `${studentDetails?.firstName || ''} ${studentDetails?.lastName || ''}`.trim() ||
      userInfo?.uid || 'Unknown';

    const scan: ScanResult = {
      id: result.id,
      entryType,
      entryCount: peopleCount,
      scannedAt: new Date().toISOString(),
      success: true,
      participantName,
      participantUid: userInfo?.uid,
      participantEmail: userInfo?.email,
      registrationId: regData?.registrationId,
      gateLocation: gateLocation || undefined,
    };

    setRecentScans((prev) => [scan, ...prev.slice(0, 19)]);
    setSessionStats((prev) => ({
      ...prev,
      entries: entryType ===
   'entry' ? prev.entries + peopleCount : prev.entries,
      exits: entryType ===
   'exit' ? prev.exits + peopleCount : prev.exits,
    }));

    const action = entryType ===
   'entry' ? 'Check-in' : 'Check-out';
    const countLabel = peopleCount > 1 ? ` (${peopleCount} people)` : '';
    toast({
      type: 'success',
      message: `${action} successful for ${participantName}${countLabel}`,
    });

    setQrInput('');
    setRemarks('');
    setTimeout(() => qrInputRef.current?.focus(), 100);
  };

  const confirmGroupEntry = async () => {
    if (!groupModal) return;
    setGroupSubmitting(true);
    try {
      await executeScan(groupModal.qrCode, groupCount);
      setGroupModal(null);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setGroupSubmitting(false);
    }
  };

  handleScanRef.current = handleScan;

  // Camera QR scanner using html5-qrcode
  const startCameraScanner = useCallback(async () => {
    if (html5QrCodeRef.current) return;
    const readerEl = document.getElementById('qr-reader');
    if (!readerEl) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;
      cameraActiveRef.current = true;
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          if (!cameraActiveRef.current) return;
          const code = decodedText?.trim();
          if (code) {
            handleScanRef.current?.(code);
          }
        },
        () => {}
      );
    } catch (err) {
      cameraActiveRef.current = false;
      html5QrCodeRef.current = null;
      console.error('Camera scanner error:', err);
      toast({ type: 'error', message: 'Could not access camera. Use manual input below.' });
      setScanMode('input');
    }
  }, [toast]);

  const stopCameraScanner = useCallback(() => {
    cameraActiveRef.current = false;
    const scanner = html5QrCodeRef.current;
    html5QrCodeRef.current = null;
    if (scanner) {
      try {
        scanner.stop().catch(() => {});
      } catch {
        // Ignore synchronous errors from the library during stop
      }
    }
  }, []);

  // Only handle cleanup on unmount — start/stop is driven by click handlers
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScan();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getEventStatus = () => {
    if (!event) return 'draft';
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    if (event.status ===
   'completed' || event.status ===
   'cancelled') return event.status;
    if (now >= start && now <= end) return 'ongoing';
    return event.status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading event details..." />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-ev-900 dark:text-white mb-2">Event not found</h2>
          <Link href="/events/volunteer" className="text-ev-700 hover:underline">
            Back to Volunteer Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const eventStatus = getEventStatus();
  const isLive = eventStatus ===
   'ongoing';

  return (
    <>
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/events/volunteer"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-ev-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Volunteer Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-ev-900 dark:text-white">
                  {event.name}
                </h1>
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                    <Radio className="h-3 w-3 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              {volunteerInfo && (
                <div className="flex items-center gap-3 mt-2">
                  {volunteerInfo.role && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-ev-100 dark:bg-ev-900/30 text-ev-800 dark:text-ev-200 rounded-full">
                      <Tag className="h-3 w-3" />
                      {volunteerInfo.role}
                    </span>
                  )}
                  {volunteerInfo.assignedGate && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                      <MapPin className="h-3 w-3" />
                      {volunteerInfo.assignedGate}
                    </span>
                  )}
                  {volunteerInfo.canScanQr && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      <QrCode className="h-3 w-3" />
                      Scanner Enabled
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Summary Card */}
        <div className={CARD + ' p-5 mb-6'}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ev-100 dark:bg-ev-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-ev-700 dark:text-ev-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
                <p className="text-sm font-semibold text-ev-900 dark:text-white">
                  {formatDate(event.startDate)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(event.startDate)} - {formatTime(event.endDate)}
                </p>
              </div>
            </div>
            {event.venue && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Venue</p>
                  <p className="text-sm font-semibold text-ev-900 dark:text-white line-clamp-1">
                    {event.venue}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Registrations</p>
                <p className="text-sm font-semibold text-ev-900 dark:text-white">
                  {event.currentRegistrations}{event.maxCapacity ? `/${event.maxCapacity}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <p className={`text-sm font-semibold ${isLive ? 'text-green-600 dark:text-green-400' : 'text-ev-900 dark:text-white'}`}>
                  {isLive ? 'Live Now' : eventStatus.charAt(0).toUpperCase() + eventStatus.slice(1)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className={CARD + ' p-4 text-center'}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">{displayedStats.entries}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Check-ins</p>
          </div>
          <div className={CARD + ' p-4 text-center'}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <LogOut className="h-4 w-4 text-ev-700 dark:text-ev-400" />
              <span className="text-2xl font-bold text-ev-700 dark:text-ev-400">{displayedStats.exits}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Check-outs</p>
          </div>
          <div className={CARD + ' p-4 text-center'}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{sessionStats.failed}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Scanner */}
          <div className={CARD + ' p-6'}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-ev-700 to-ev-800 rounded-xl">
                  <QrCode className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ev-900 dark:text-white">QR Scanner</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Scan or enter QR code</p>
                </div>
              </div>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => { stopCameraScanner(); setScanMode('input'); }}
                  className={`p-2 rounded-md transition-colors ${scanMode ===
   'input' ? 'bg-white dark:bg-gray-600 shadow-ev' : 'text-gray-500'}`}
                  title="Manual Input"
                >
                  <Keyboard className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setScanMode('camera'); setTimeout(() => startCameraScanner(), 150); }}
                  className={`p-2 rounded-md transition-colors ${scanMode ===
   'camera' ? 'bg-white dark:bg-gray-600 shadow-ev' : 'text-gray-500'}`}
                  title="Camera Scanner"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Entry Type Toggle */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Action
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEntryType('entry')}
                  className={`py-3.5 px-4 rounded-lg border-2 font-semibold transition-all flex items-center justify-center gap-2 ${
                    entryType ===
   'entry'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 shadow-ev'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                  }`}
                >
                  <LogIn className="h-5 w-5" />
                  Check-in
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('exit')}
                  className={`py-3.5 px-4 rounded-lg border-2 font-semibold transition-all flex items-center justify-center gap-2 ${
                    entryType ===
   'exit'
                      ? 'border-ev-700 bg-ev-50 dark:bg-ev-900/20 text-ev-800 dark:text-ev-400 shadow-ev'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                  }`}
                >
                  <LogOut className="h-5 w-5" />
                  Check-out
                </button>
              </div>
            </div>

            <div className={`mb-5 ${scanMode ===
   'camera' ? '' : 'hidden'}`}>
              <div id="qr-reader" className="rounded-lg overflow-hidden min-h-[250px] [&_video]:!rounded-lg [&_img]:!rounded-lg" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                Point camera at entry pass QR. Use manual input below if camera fails.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* QR Code Input */}
              <div>
                <label htmlFor="qrCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  QR Code *
                </label>
                <input
                  ref={qrInputRef}
                  id="qrCode"
                  type="text"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder="Scan or type QR code value..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-600 focus:border-transparent font-mono text-lg"
                  disabled={scanning}
                  autoComplete="off"
                  autoFocus
                />
              </div>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {showAdvanced ? '▾ Hide options' : '▸ More options (gate, remarks)'}
              </button>

              {showAdvanced && (
                <div className="space-y-3 pl-2 border-l-2 border-[#b3cde0] dark:border-gray-700">
                  <div>
                    <label htmlFor="gateLocation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Gate Location
                    </label>
                    <input
                      id="gateLocation"
                      type="text"
                      value={gateLocation}
                      onChange={(e) => setGateLocation(e.target.value)}
                      placeholder="e.g., Main Gate, Gate A"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white text-sm"
                      disabled={scanning}
                    />
                  </div>
                  <div>
                    <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Remarks
                    </label>
                    <textarea
                      id="remarks"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Any notes..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white resize-none text-sm"
                      disabled={scanning}
                    />
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={scanning || !qrInput.trim()}
                className={`w-full px-6 py-3.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                  entryType ===
   'entry'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                    : 'bg-gradient-to-r from-ev-700 to-ev-900 hover:from-ev-800 hover:to-ev-900 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed shadow-ev`}
              >
                {scanning ? (
                  <>
                    <Skeleton className="w-4 h-4 rounded-sm" />
                    Processing...
                  </>
                ) : (
                  <>
                    {entryType ===
   'entry' ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
                    {entryType ===
   'entry' ? 'Check-in Participant' : 'Check-out Participant'}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Recent Scans */}
          <div className={CARD + ' p-6'}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-ev-900 dark:text-white">Recent Scans</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Stored history + this session ({persistedStats.total + recentScans.length} scans)</p>
                </div>
              </div>
              {recentScans.length > 0 && (
                <button
                  onClick={() => {
                    setRecentScans([]);
                    setSessionStats({ entries: 0, exits: 0, failed: 0 });
                  }}
                  className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {combinedRecentScans.length ===
   0 ? (
              <div className="text-center py-12">
                <QrCode className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">No scans yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Previous and new scans will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {combinedRecentScans.map((scan, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all ${
                      scan.success
                        ? scan.entryType ===
   'entry'
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                          : 'border-ev-200 dark:border-ev-800 bg-ev-50 dark:bg-ev-900/10'
                        : scan.isWarning
                          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {scan.success ? (
                        scan.entryType ===
   'entry' ? (
                          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full mt-0.5">
                            <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-ev-100 dark:bg-ev-900/30 rounded-full mt-0.5">
                            <LogOut className="h-4 w-4 text-ev-700 dark:text-ev-400" />
                          </div>
                        )
                      ) : scan.isWarning ? (
                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-full mt-0.5">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                      ) : (
                        <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full mt-0.5">
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {scan.success ? (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-ev-900 dark:text-white">
                                {scan.participantName}
                              </p>
                              <div className="flex items-center gap-1.5">
                                {(scan.entryCount || 1) > 1 && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                    {scan.entryCount} people
                                  </span>
                                )}
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  scan.entryType ===
   'entry'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-ev-100 dark:bg-ev-900/30 text-ev-800 dark:text-ev-400'
                                }`}>
                                  {scan.entryType ===
   'entry' ? 'IN' : 'OUT'}
                                </span>
                              </div>
                            </div>
                            <div className="mt-1.5 space-y-0.5">
                              <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                <User className="h-3 w-3" /> {scan.participantName} {(scan.entryCount || 1) > 1 ? '(Pass Holder)' : ''}
                              </p>
                              {(scan.entryCount || 1) > 1 && Array.from({ length: (scan.entryCount || 1) - 1 }, (_, i) => (
                                <p key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <Users className="h-3 w-3" /> Guest {i + 1}
                                </p>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {scan.participantUid && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {scan.participantUid}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(scan.scannedAt)}
                              </span>
                            </div>
                            {scan.registrationId && (
                              <p className="text-xs text-gray-400 mt-1">ID: {scan.registrationId}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className={`font-semibold ${scan.isWarning ? 'text-amber-900 dark:text-amber-200' : 'text-red-900 dark:text-red-200'}`}>
                              {scan.isWarning ? 'Warning' : 'Scan Failed'}
                            </p>
                            <p className={`text-sm mt-0.5 ${scan.isWarning ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
                              {scan.error}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              <Clock className="inline h-3 w-3 mr-1" />
                              {formatTime(scan.scannedAt)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 bg-ev-50 dark:bg-ev-900/20 border border-ev-200 dark:border-ev-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-ev-700 dark:text-ev-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-ev-900 dark:text-ev-100">
              <p className="font-medium mb-1">Volunteer Scanning Tips</p>
              <ul className="list-disc list-inside space-y-1 text-ev-800 dark:text-ev-200 text-xs">
                <li>Switch between <strong>Check-in</strong> and <strong>Check-out</strong> using the action buttons</li>
                <li>For group passes, a popup will appear to select how many people are entering/exiting</li>
                <li>Participants cannot check-in twice — the system will prevent duplicate entries</li>
                <li>Participants must check-in before they can check-out</li>
                <li>The QR input auto-focuses after each scan for rapid processing</li>
                <li>Use a barcode scanner device for faster scanning</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Group Entry Modal */}
    {groupModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !groupSubmitting && setGroupModal(null)}>
        <div className={`${CARD} w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200`} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-5">
            <div className={`p-3 rounded-xl ${entryType ===
   'entry' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-ev-100 dark:bg-ev-900/30'}`}>
              <Users className={`h-6 w-6 ${entryType ===
   'entry' ? 'text-green-600 dark:text-green-400' : 'text-ev-700 dark:text-ev-400'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ev-900 dark:text-white">
                Group {entryType ===
   'entry' ? 'Check-in' : 'Check-out'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {groupModal.preview.participant.name}
              </p>
            </div>
          </div>

          {/* Pass Status */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Pass Limit</span>
              <span className="font-semibold text-ev-900 dark:text-white">{groupModal.preview.totalAllowedEntries} people</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Currently Inside</span>
              <span className="font-semibold text-ev-900 dark:text-white">{groupModal.preview.currentlyInside}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {entryType ===
   'entry' ? 'Available Entry Slots' : 'Can Exit'}
              </span>
              <span className={`font-bold text-lg ${groupModal.preview.maxForThisScan > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {groupModal.preview.maxForThisScan}
              </span>
            </div>
          </div>

          {/* People Count Selector */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              How many people are {entryType ===
   'entry' ? 'entering' : 'exiting'}?
            </label>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setGroupCount(Math.max(1, groupCount - 1))}
                disabled={groupCount <= 1}
                className="w-12 h-12 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <span className="text-4xl font-bold text-ev-900 dark:text-white w-16 text-center tabular-nums">
                {groupCount}
              </span>
              <button
                type="button"
                onClick={() => setGroupCount(Math.min(groupModal.preview.maxForThisScan, groupCount + 1))}
                disabled={groupCount >= groupModal.preview.maxForThisScan}
                className="w-12 h-12 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                +
              </button>
            </div>
            {/* Quick-select buttons */}
            {groupModal.preview.maxForThisScan > 2 && (
              <div className="flex justify-center gap-2 mt-3">
                {Array.from({ length: groupModal.preview.maxForThisScan }, (_, i) => i + 1).slice(0, 6).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGroupCount(n)}
                    className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                      groupCount ===
   n
                        ? entryType ===
   'entry'
                          ? 'bg-green-600 text-white'
                          : 'bg-ev-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setGroupModal(null)}
              disabled={groupSubmitting}
              className="flex-1 py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmGroupEntry}
              disabled={groupSubmitting}
              className={`flex-1 py-3 px-4 rounded-lg text-white font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                entryType ===
   'entry'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-ev-700 hover:bg-ev-800'
              }`}
            >
              {groupSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {entryType ===
   'entry' ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
                  {entryType ===
   'entry' ? 'Check-in' : 'Check-out'} {groupCount} {groupCount ===
   1 ? 'person' : 'people'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
