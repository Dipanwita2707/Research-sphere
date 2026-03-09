'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, QrCode, CheckCircle, XCircle, Clock, MapPin, AlertCircle, Users } from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function QRScannerPage() {
  const params = useParams();
  const eventId = params?.id as string;
  const { toast } = useToast();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [entryType, setEntryType] = useState<'entry' | 'exit'>('entry');
  const [entriesToCheckIn, setEntriesToCheckIn] = useState(1);
  const [markStudentExit, setMarkStudentExit] = useState(false);
  const [gateLocation, setGateLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [recentScans, setRecentScans] = useState<any[]>([]);
  
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const data = await eventService.getEventById(eventId);
        setEvent(data);
      } catch (error: any) {
        toast({ type: 'error', message: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
    };

    if (eventId) fetchEvent();
  }, [eventId]);

  // Auto-focus on QR input
  useEffect(() => {
    qrInputRef.current?.focus();
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!qrInput.trim()) {
      toast({ type: 'error', message: 'Please enter a QR code' });
      return;
    }

    setScanning(true);
    try {
      const result = await eventService.scanQRCode(eventId, {
        qrCode: qrInput.trim(),
        entryType,
        entriesToCheckIn,
        peopleCount: entriesToCheckIn,
        markStudentExit: entryType === 'exit' ? markStudentExit : undefined,
        gateLocation: gateLocation || undefined,
        remarks: remarks || undefined,
      });

      // Add to recent scans
      setRecentScans(prev => [{
        ...result,
        scannedAt: new Date().toISOString(),
        success: true,
      }, ...prev.slice(0, 9)]);

      toast({ 
        type: 'success', 
        message:
          result.message ||
          (entryType === 'exit'
            ? `Checked out ${entriesToCheckIn} attendee(s)`
            : `Checked in ${entriesToCheckIn} attendee(s)`),
      });

      // Clear form
      setQrInput('');
      setRemarks('');
      
      // Re-focus on input
      setTimeout(() => qrInputRef.current?.focus(), 100);
    } catch (error: any) {
      // Add failed scan to recent scans
      setRecentScans(prev => [{
        qrCode: qrInput,
        scannedAt: new Date().toISOString(),
        success: false,
        error: getErrorMessage(error),
      }, ...prev.slice(0, 9)]);

      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setScanning(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <PageSkeleton message="Loading event..." />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-ev-900 dark:text-white mb-2">Event not found</h2>
          <Link href="/events" className="text-ev-700 hover:underline">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-ev-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Event
          </Link>
          
          <h1 className="text-3xl font-bold text-ev-900 dark:text-white mb-2">QR Code Scanner</h1>
          <p className="text-gray-600 dark:text-gray-400">{event.name}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-[#b3cde0] dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-ev-100 dark:bg-ev-900/30 rounded-lg">
                <QrCode className="h-6 w-6 text-ev-700 dark:text-ev-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ev-900 dark:text-white">Scan Attendee</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Enter or scan the QR code</p>
              </div>
            </div>

            <form onSubmit={handleScan} className="space-y-4">
              <div>
                <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Action
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryType('entry')}
                    disabled={scanning}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                      entryType === 'entry'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    Entry +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType('exit')}
                    disabled={scanning}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                      entryType === 'exit'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    Exit +1
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="entriesToCheckIn" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Number of People {entryType === 'exit' ? 'Exiting' : 'Entering'} Now
                </label>
                <input
                  id="entriesToCheckIn"
                  type="number"
                  min={1}
                  max={50}
                  value={entriesToCheckIn}
                  onChange={(e) => setEntriesToCheckIn(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white"
                  disabled={scanning}
                />
              </div>

              {entryType === 'exit' && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={markStudentExit}
                    onChange={(e) => setMarkStudentExit(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                    disabled={scanning}
                  />
                  Explicitly mark pass holder (student) as exited
                </label>
              )}

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
                  placeholder="Scan or enter QR code"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 font-mono"
                  disabled={scanning}
                  autoComplete="off"
                />
              </div>

              {/* Gate Location */}
              <div>
                <label htmlFor="gateLocation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gate Location (Optional)
                </label>
                <input
                  id="gateLocation"
                  type="text"
                  value={gateLocation}
                  onChange={(e) => setGateLocation(e.target.value)}
                  placeholder="e.g., Main Entrance, Gate A"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white"
                  disabled={scanning}
                />
              </div>

              {/* Remarks */}
              <div>
                <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Remarks (Optional)
                </label>
                <textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any notes"
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white resize-none"
                  disabled={scanning}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={scanning || !qrInput.trim()}
                className="w-full px-6 py-3 bg-ev-700 text-white rounded-lg hover:bg-ev-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {scanning ? (
                  <>
                    <Skeleton className="w-4 h-4 rounded-sm" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <QrCode className="h-5 w-5" />
                    {entryType === 'exit' ? 'Scan For Exit' : 'Scan For Entry'}
                  </>
                )}
              </button>
            </form>

            {/* Quick Stats */}
            <div className="mt-6 pt-6 border-t border-[#b3cde0] dark:border-gray-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {recentScans.filter(s => s.success).length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Successful</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {recentScans.filter(s => !s.success).length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Scans */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-[#b3cde0] dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-ev-900 dark:text-white mb-4">Recent Scans</h2>
            
            {recentScans.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No scans yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Recent scans will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {recentScans.map((scan, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      scan.success
                        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                        : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {scan.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        {scan.success ? (
                          <>
                            <p className="font-medium text-ev-900 dark:text-white">
                              {scan.registration?.user?.name || 'Unknown User'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {scan.entryType === 'exit' ? 'Checked out' : 'Checked in'} {scan.entryCount || 1} attendee(s) at {formatTime(scan.scannedAt)}
                            </p>
                            {scan.registration?.totalAllowedEntries !== undefined && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
                                <p className="inline-flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  Capacity: {scan.registration.totalAllowedEntries}
                                  {' | '}Entries: {scan.registration.checkedInCount ?? 0}
                                  {' | '}Exits: {scan.registration.checkedOutCount ?? 0}
                                </p>
                                <p>
                                  Inside: {scan.registration.currentlyInside ?? 0}
                                  {' | '}Available Entry Slots: {scan.registration.availableEntrySlots ?? scan.registration.remainingEntries ?? 0}
                                  {' | '}Student: {scan.registration.studentInside ? 'Inside' : 'Outside'}
                                </p>
                              </div>
                            )}
                            {scan.gateLocation && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                <MapPin className="inline h-3 w-3 mr-1" />
                                {scan.gateLocation}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="font-medium text-red-900 dark:text-red-100">Scan Failed</p>
                            <p className="text-sm text-red-700 dark:text-red-300">{scan.error}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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

        {/* Help Text */}
        <div className="mt-6 bg-ev-50 dark:bg-ev-900/20 border border-ev-200 dark:border-ev-800 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-ev-700 dark:text-ev-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-ev-900 dark:text-ev-100">
              <p className="font-medium mb-1">Scanning Tips:</p>
              <ul className="list-disc list-inside space-y-1 text-ev-800 dark:text-ev-200">
                <li>The QR input field auto-focuses for quick scanning</li>
                <li>Use a barcode scanner for faster processing</li>
                <li>Select Entry or Exit, then set how many attendees are moving</li>
                <li>Entry is blocked when current inside reaches pass capacity</li>
                <li>Exit frees up slots, allowing re-entry under the same pass</li>
                <li>Recent scans show the last 10 scan attempts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
