'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, QrCode, Camera, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/shared/ui-components/Toast';

function navigateToFeedback(router: ReturnType<typeof useRouter>, path: string) {
  // Defer navigation to avoid "Cannot transition to a new state, already under transition"
  setTimeout(() => router.push(path), 0);
}

const FEEDBACK_URL_PATTERN = /\/events\/[^/]+\/feedback/;

function isFeedbackUrl(text: string): boolean {
  try {
    const url = new URL(text, window.location.origin);
    return FEEDBACK_URL_PATTERN.test(url.pathname);
  } catch {
    return FEEDBACK_URL_PATTERN.test(text);
  }
}

function getFeedbackPath(text: string): string | null {
  try {
    const url = new URL(text, window.location.origin);
    const match = url.pathname.match(FEEDBACK_URL_PATTERN);
    return match ? match[0] : null;
  } catch {
    const match = text.match(FEEDBACK_URL_PATTERN);
    return match ? match[0] : null;
  }
}

export default function EventFeedbackScanner() {
  const router = useRouter();
  const { toast } = useToast();
  const html5QrCodeRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const navigatingRef = useRef(false);
  const [scanMode, setScanMode] = useState<'camera' | 'input'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);

  const startCameraScanner = useCallback(async () => {
    const readerEl = document.getElementById('event-feedback-qr-reader');
    if (!readerEl || html5QrCodeRef.current) return;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode('event-feedback-qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          const code = decodedText?.trim();
          if (!code || navigatingRef.current) return;

          if (isFeedbackUrl(code)) {
            const path = getFeedbackPath(code);
            if (path) {
              navigatingRef.current = true;
              navigateToFeedback(router, path);
            }
          } else {
            setLastError('Not a valid event feedback QR code');
            toast({ type: 'warning', message: 'Invalid QR - scan an event feedback QR code' });
          }
        },
        () => {}
      );
    } catch (err) {
      console.error('Camera scanner error:', err);
      toast({ type: 'error', message: 'Could not access camera. Use manual input below.' });
      setScanMode('input');
    }
  }, [toast, router]);

  const stopCameraScanner = useCallback((): Promise<void> => {
    if (html5QrCodeRef.current) {
      const scanner = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      return scanner.stop().catch(() => {});
    }
    return Promise.resolve();
  }, []);

  const switchToInputMode = useCallback(() => {
    stopCameraScanner().then(() => {
      setScanMode('input');
    });
  }, [stopCameraScanner]);

  const switchToCameraMode = useCallback(() => {
    setScanMode('camera');
  }, []);

  useEffect(() => {
    if (scanMode === 'camera') {
      const t = setTimeout(() => startCameraScanner(), 100);
      return () => {
        clearTimeout(t);
        stopCameraScanner();
      };
    }
    return undefined;
  }, [scanMode, startCameraScanner, stopCameraScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualInput.trim();
    if (!trimmed) {
      toast({ type: 'error', message: 'Enter or paste a feedback URL' });
      return;
    }

    if (isFeedbackUrl(trimmed)) {
      const path = getFeedbackPath(trimmed);
      if (path) {
        navigateToFeedback(router, path);
      } else {
        toast({ type: 'error', message: 'Could not parse feedback URL' });
      }
    } else {
      setLastError('Not a valid event feedback URL');
      toast({ type: 'warning', message: 'Invalid URL - use an event feedback link' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-sgt-600 dark:hover:text-sgt-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-6 h-6 text-sgt-500" />
              Event Feedback Scanner
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Scan the event feedback QR code to open the feedback form
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Mode Toggle */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={switchToCameraMode}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md transition-colors ${
                  scanMode === 'camera' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Camera className="w-4 h-4" />
                Camera
              </button>
              <button
                type="button"
                onClick={switchToInputMode}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md transition-colors ${
                  scanMode === 'input' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Paste URL
              </button>
            </div>

            {scanMode === 'camera' ? (
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
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
                    onChange={(e) => {
                      setManualInput(e.target.value);
                      setLastError(null);
                    }}
                    placeholder="Paste event feedback URL (e.g. .../events/EVT-123/feedback)"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-sgt-600 text-white rounded-lg hover:bg-sgt-700 font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Open Feedback Form
                </button>
              </form>
            )}

            {lastError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {lastError}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">How to use</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>Event organizers display a feedback QR on the Event Management page</li>
                <li>Scan that QR to open the feedback form for that event</li>
                <li>Or paste the feedback URL if you received it via link</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
