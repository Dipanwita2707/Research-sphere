'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, QrCode, Camera, AlertCircle, CheckCircle, Store } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';

function navigateToFeedback(router: ReturnType<typeof useRouter>, path: string) {
  setTimeout(() => router.push(path), 0);
}

// Matches: /events/{id}/feedback  (event feedback)
const EVENT_FEEDBACK_PATTERN = /\/events\/[^/]+\/feedback$/;
// Matches: /events/{id}/stalls/{stallId}/feedback  (stall feedback)
const STALL_FEEDBACK_PATTERN = /\/events\/[^/]+\/stalls\/[^/]+\/feedback$/;

type FeedbackType = 'event' | 'stall' | null;

function detectFeedbackType(text: string): FeedbackType {
  const tryPath = (t: string) => {
    try { return new URL(t, window.location.origin).pathname; } catch { return t; }
  };
  const path = tryPath(text);
  if (STALL_FEEDBACK_PATTERN.test(path)) return 'stall';
  if (EVENT_FEEDBACK_PATTERN.test(path)) return 'event';
  return null;
}

function getFeedbackPath(text: string): string | null {
  try {
    const url = new URL(text, window.location.origin);
    const p = url.pathname;
    if (STALL_FEEDBACK_PATTERN.test(p)) return p;
    if (EVENT_FEEDBACK_PATTERN.test(p)) return p;
    return null;
  } catch {
    if (STALL_FEEDBACK_PATTERN.test(text)) return text;
    if (EVENT_FEEDBACK_PATTERN.test(text)) return text;
    return null;
  }
}

export default function EventFeedbackScanner() {
  const router = useRouter();
  const { toast } = useToast();
  const html5QrCodeRef = useRef<{ stop: () => Promise<void>; getState?: () => number } | null>(null);
  const scannerStartedRef = useRef(false);
  const navigatingRef = useRef(false);
  const [scanMode, setScanMode] = useState<'camera' | 'input'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastDetected, setLastDetected] = useState<FeedbackType>(null);

  const startCameraScanner = useCallback(async () => {
    const readerEl = document.getElementById('event-feedback-qr-reader');
    if (!readerEl || html5QrCodeRef.current) return;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('event-feedback-qr-reader');
      html5QrCodeRef.current = html5QrCode;
      scannerStartedRef.current = false;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          const code = decodedText?.trim();
          if (!code || navigatingRef.current) return;

          const type = detectFeedbackType(code);
          if (type) {
            const path = getFeedbackPath(code);
            if (path) {
              navigatingRef.current = true;
              setLastDetected(type);
              toast({
                type: 'success',
                message: type === 'stall' ? 'Stall feedback QR detected! Opening...' : 'Event feedback QR detected! Opening...',
              });
              navigateToFeedback(router, path);
            }
          } else {
            setLastError('Not a valid feedback QR code');
            toast({ type: 'warning', message: 'Invalid QR — scan an event or stall feedback QR' });
          }
        },
        () => {}
      );
      scannerStartedRef.current = true;
    } catch (err) {
      console.error('Camera scanner error:', err);
      toast({ type: 'error', message: 'Could not access camera. Use manual input below.' });
      setScanMode('input');
    }
  }, [toast, router]);

  const stopCameraScanner = useCallback((): Promise<void> => {
    if (html5QrCodeRef.current && scannerStartedRef.current) {
      const scanner = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      scannerStartedRef.current = false;
      try {
        return scanner.stop().catch(() => {});
      } catch {
        return Promise.resolve();
      }
    }
    html5QrCodeRef.current = null;
    scannerStartedRef.current = false;
    return Promise.resolve();
  }, []);

  const switchToInputMode = useCallback(() => {
    stopCameraScanner().then(() => setScanMode('input'));
  }, [stopCameraScanner]);

  const switchToCameraMode = useCallback(() => setScanMode('camera'), []);

  useEffect(() => {
    if (scanMode === 'camera') {
      const t = setTimeout(() => startCameraScanner(), 100);
      return () => { clearTimeout(t); stopCameraScanner(); };
    }
    return undefined;
  }, [scanMode, startCameraScanner, stopCameraScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualInput.trim();
    if (!trimmed) { toast({ type: 'error', message: 'Enter or paste a feedback URL' }); return; }

    const type = detectFeedbackType(trimmed);
    if (type) {
      const path = getFeedbackPath(trimmed);
      if (path) {
        navigateToFeedback(router, path);
      } else {
        toast({ type: 'error', message: 'Could not parse feedback URL' });
      }
    } else {
      setLastError('Not a valid feedback URL');
      toast({ type: 'warning', message: 'Invalid URL — use an event or stall feedback link' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-ev-700 dark:hover:text-ev-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-[#b3cde0] dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-[#b3cde0] dark:border-gray-700">
            <h1 className="text-xl font-bold text-ev-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-6 h-6 text-ev-700" />
              Feedback QR Scanner
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Scan an event <em>or</em> stall feedback QR code — it auto-detects which type it is
            </p>

            {/* Type legend */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <QrCode className="w-3.5 h-3.5 text-ev-700" />
                Event feedback
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Store className="w-3.5 h-3.5 text-purple-500" />
                Stall feedback
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Mode Toggle */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={switchToCameraMode}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md transition-colors ${
                  scanMode === 'camera' ? 'bg-white dark:bg-gray-600 shadow-ev' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Camera className="w-4 h-4" />
                Camera
              </button>
              <button
                type="button"
                onClick={switchToInputMode}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md transition-colors ${
                  scanMode === 'input' ? 'bg-white dark:bg-gray-600 shadow-ev' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Paste URL
              </button>
            </div>

            {scanMode === 'camera' ? (
              <div className="rounded-lg overflow-hidden border border-[#b3cde0] dark:border-gray-600">
                <div id="event-feedback-qr-reader" className="w-full" />
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Feedback URL
                  </label>
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => { setManualInput(e.target.value); setLastError(null); }}
                    placeholder="Paste event or stall feedback URL"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700"
                  />
                  {lastError && (
                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {lastError}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full bg-ev-700 hover:bg-ev-800 text-white py-3 rounded-lg font-semibold transition-colors"
                >
                  Open Feedback Form
                </button>
              </form>
            )}

            {lastDetected && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {lastDetected === 'stall' ? 'Stall feedback QR detected — redirecting...' : 'Event feedback QR detected — redirecting...'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
