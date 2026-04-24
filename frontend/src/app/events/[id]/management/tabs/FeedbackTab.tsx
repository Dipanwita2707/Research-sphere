'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, QrCode, Loader2, X } from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';
import { CARD } from './constants';
import { ShimmerCard, ShimmerStatCard, ShimmerLine } from '@/components/shimmer';

// ── Props ────────────────────────────────────────────────────────
interface FeedbackTabProps {
  eventId: string;
}

type FeedbackItem = {
  id: string;
  points: number[];
  shortDescription: string | null;
  createdAt: string;
};

type FeedbackSummary = {
  totalFeedback: number;
  overallAvg: number;
};

export default function FeedbackTab({ eventId }: FeedbackTabProps) {
  const { toast } = useToast();

  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showFeedbackQR, setShowFeedbackQR] = useState(false);
  const [feedbackQRUrl, setFeedbackQRUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setFeedbackLoading(true);
    eventService.getFeedback(eventId)
      .then((res) => {
        setFeedbackList(res.feedback);
        setFeedbackSummary(res.summary);
      })
      .catch(() => toast({ type: 'error', message: 'Failed to load feedback' }))
      .finally(() => setFeedbackLoading(false));
  }, [eventId, toast]);

  const handleShowFeedbackQR = async () => {
    if (typeof window ===
   'undefined') return;
    const url = `${window.location.origin}/events/${eventId}/feedback`;
    try {
      const QRCodeGenerator = (await import('qrcode')).default;
      const dataUrl = await QRCodeGenerator.toDataURL(url, { width: 256, margin: 2 });
      setFeedbackQRUrl(dataUrl);
      setShowFeedbackQR(true);
    } catch {
      toast({ type: 'error', message: 'Failed to generate QR code' });
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${CARD} p-5`}>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-ev-700" />
              Event Feedback
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Scan the Feedback QR to collect ratings (10 points) and short description from attendees.
            </p>
          </div>
          <button
            onClick={handleShowFeedbackQR}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-ev-700 rounded-lg hover:bg-ev-800 transition-colors"
          >
            <QrCode className="w-4 h-4" />
            Show Feedback QR
          </button>
        </div>

        {feedbackSummary && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-ev-50 dark:bg-ev-900/20">
              <p className="text-2xl font-bold text-ev-700 dark:text-ev-400">{feedbackSummary.totalFeedback}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Responses</p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{feedbackSummary.overallAvg.toFixed(1)}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Rating (out of 10)</p>
            </div>
          </div>
        )}

        {feedbackLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <ShimmerCard key={i} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <ShimmerLine className="h-3 w-24" />
                  <ShimmerLine className="h-4 w-12" />
                </div>
                <ShimmerLine className="h-4 w-full mt-2" />
              </ShimmerCard>
            ))}
          </div>
        ) : feedbackList.length ===
   0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No feedback yet. Share the QR code with attendees to collect responses.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedbackList.map((fb) => (
              <div key={fb.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(fb.createdAt).toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-ev-700 dark:text-ev-400">
                    Avg: {(fb.points.reduce((a, b) => a + b, 0) / 10).toFixed(1)}/10
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {fb.points.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center justify-center w-7 h-7 rounded bg-ev-50 dark:bg-ev-900/30 text-xs font-medium text-ev-800 dark:text-ev-200"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                {fb.shortDescription && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    {fb.shortDescription}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback QR Modal */}
      {showFeedbackQR && feedbackQRUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowFeedbackQR(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Feedback QR Code</h3>
              <button onClick={() => setShowFeedbackQR(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Scan to give event feedback (10 points + short description)
            </p>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={feedbackQRUrl} alt="Feedback QR" className="w-64 h-64" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
