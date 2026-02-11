'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Shield,
  QrCode,
  Loader2,
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
  Hash,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';

const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt';

interface ScanResult {
  id?: string;
  entryType: 'entry' | 'exit';
  scannedAt: string;
  success: boolean;
  error?: string;
  qrCode?: string;
  gateLocation?: string;
  participantName?: string;
  participantUid?: string;
  participantEmail?: string;
  registrationId?: string;
}

export default function VolunteerEventPage() {
  const params = useParams();
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

  // Stats
  const [sessionStats, setSessionStats] = useState({ entries: 0, exits: 0, failed: 0 });

  const qrInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch event details
        const eventData = await eventService.getEventById(eventId);
        setEvent(eventData);

        // Try to fetch volunteer info for this user
        try {
          const assignments = await eventService.getMyVolunteerAssignments();
          const myAssignment = assignments.find((a: any) => a.eventId === eventId);
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
        toast({ type: 'error', message: error.response?.data?.message || 'Failed to load event' });
      } finally {
        setLoading(false);
      }
    };

    if (eventId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Auto-focus on QR input when in input mode
  useEffect(() => {
    if (scanMode === 'input') {
      qrInputRef.current?.focus();
    }
  }, [scanMode]);

  // Camera scanner
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      toast({ type: 'error', message: 'Could not access camera. Please use manual input.' });
      setScanMode('input');
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (scanMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [scanMode, startCamera, stopCamera]);

  const handleScan = async (qrCode?: string) => {
    const code = qrCode || qrInput.trim();
    if (!code) {
      toast({ type: 'error', message: 'Please enter or scan a QR code' });
      return;
    }

    setScanning(true);
    try {
      const result = await eventService.scanQRCode(eventId, {
        qrCode: code,
        entryType,
        gateLocation: gateLocation || undefined,
        remarks: remarks || undefined,
      });

      // Extract participant info from scan result
      const regData = (result as any).EventRegistration || result.registration;
      const userInfo = regData?.user_login || regData?.user;
      const empDetails = userInfo?.employeeDetails;
      const studentDetails = userInfo?.studentLogin;
      const participantName =
        empDetails?.displayName ||
        `${empDetails?.firstName || ''} ${empDetails?.lastName || ''}`.trim() ||
        studentDetails?.displayName ||
        `${studentDetails?.firstName || ''} ${studentDetails?.lastName || ''}`.trim() ||
        userInfo?.uid || 'Unknown';

      const scan: ScanResult = {
        id: result.id,
        entryType,
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
        entries: entryType === 'entry' ? prev.entries + 1 : prev.entries,
        exits: entryType === 'exit' ? prev.exits + 1 : prev.exits,
      }));

      toast({
        type: 'success',
        message: `${entryType === 'entry' ? 'Check-in' : 'Check-out'} successful for ${participantName}`,
      });

      // Clear & re-focus
      setQrInput('');
      setRemarks('');
      setTimeout(() => qrInputRef.current?.focus(), 100);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Scan failed';
      const scan: ScanResult = {
        entryType,
        scannedAt: new Date().toISOString(),
        success: false,
        error: errorMsg,
        qrCode: code,
      };
      setRecentScans((prev) => [scan, ...prev.slice(0, 19)]);
      setSessionStats((prev) => ({ ...prev, failed: prev.failed + 1 }));
      toast({ type: 'error', message: errorMsg });
    } finally {
      setScanning(false);
    }
  };

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
    if (event.status === 'completed' || event.status === 'cancelled') return event.status;
    if (now >= start && now <= end) return 'ongoing';
    return event.status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-sgt-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Event not found</h2>
          <Link href="/events/volunteer" className="text-sgt-600 hover:underline">
            Back to Volunteer Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const eventStatus = getEventStatus();
  const isLive = eventStatus === 'ongoing';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/events/volunteer"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Volunteer Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
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
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-sgt-100 dark:bg-sgt-900/30 text-sgt-700 dark:text-sgt-300 rounded-full">
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
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
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
                  <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
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
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
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
                <p className={`text-sm font-semibold ${isLive ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
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
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">{sessionStats.entries}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Check-ins</p>
          </div>
          <div className={CARD + ' p-4 text-center'}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <LogOut className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{sessionStats.exits}</span>
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
                <div className="p-3 bg-gradient-to-br from-sgt-600 to-blue-600 rounded-xl">
                  <QrCode className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">QR Scanner</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Scan or enter QR code</p>
                </div>
              </div>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => setScanMode('input')}
                  className={`p-2 rounded-md transition-colors ${scanMode === 'input' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'}`}
                  title="Manual Input"
                >
                  <Keyboard className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setScanMode('camera')}
                  className={`p-2 rounded-md transition-colors ${scanMode === 'camera' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500'}`}
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
                    entryType === 'entry'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 shadow-sm'
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
                    entryType === 'exit'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                  }`}
                >
                  <LogOut className="h-5 w-5" />
                  Check-out
                </button>
              </div>
            </div>

            {scanMode === 'camera' ? (
              <div className="mb-5">
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-2 border-dashed border-white/30 m-8 rounded-lg" />
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <p className="text-white text-xs bg-black/50 inline-block px-3 py-1 rounded-full">
                      Point camera at QR code
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  For best results, use a device with a rear camera. You can also enter codes manually below.
                </p>
              </div>
            ) : null}

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
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-600 focus:border-transparent font-mono text-lg"
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
                <div className="space-y-3 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none text-sm"
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
                  entryType === 'entry'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {entryType === 'entry' ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
                    {entryType === 'entry' ? 'Check-in Participant' : 'Check-out Participant'}
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
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Scans</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">This session ({recentScans.length} scans)</p>
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

            {recentScans.length === 0 ? (
              <div className="text-center py-12">
                <QrCode className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">No scans yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Scanned entries will appear here in real-time
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {recentScans.map((scan, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border transition-all ${
                      scan.success
                        ? scan.entryType === 'entry'
                          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                          : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10'
                        : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {scan.success ? (
                        scan.entryType === 'entry' ? (
                          <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full mt-0.5">
                            <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full mt-0.5">
                            <LogOut className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        )
                      ) : (
                        <div className="p-1.5 bg-red-100 dark:bg-red-900/30 rounded-full mt-0.5">
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {scan.success ? (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {scan.participantName}
                              </p>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                scan.entryType === 'entry'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              }`}>
                                {scan.entryType === 'entry' ? 'IN' : 'OUT'}
                              </span>
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
                            <p className="font-semibold text-red-900 dark:text-red-200">Scan Failed</p>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">{scan.error}</p>
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
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Volunteer Scanning Tips</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200 text-xs">
                <li>Switch between <strong>Check-in</strong> and <strong>Check-out</strong> using the action buttons</li>
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
  );
}
