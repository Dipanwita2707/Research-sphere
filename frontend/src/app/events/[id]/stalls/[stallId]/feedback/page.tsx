'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star, MessageSquare, CheckCircle, Store } from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';

export default function StallFeedbackPage() {
  const params = useParams();
  const eventId = params.id as string;
  const stallId = params.stallId as string;
  const { toast } = useToast();

  const [info, setInfo] = useState<{ eventName: string; stallName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [shortDescription, setShortDescription] = useState('');

  useEffect(() => {
    eventService
      .getStallFeedbackFormInfo(eventId, stallId)
      .then((data) => {
        setInfo(data);
        setNotFound(false);
      })
      .catch(() => {
        setInfo(null);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [eventId, stallId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      toast({ type: 'warning', message: 'Please select a rating before submitting.' });
      return;
    }
    setSubmitting(true);
    try {
      await eventService.submitStallFeedback(eventId, stallId, {
        points: [rating],
        shortDescription: shortDescription.trim() || undefined,
      });
      setSubmitted(true);
      toast({ type: 'success', message: 'Thank you for your feedback!' });
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 text-center">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Stall Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This stall may have been removed or this QR code is no longer active.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium text-sgt-600 dark:text-sgt-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Thank You!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Your feedback for <span className="font-semibold text-gray-800 dark:text-gray-200">{info?.stallName}</span> has been submitted.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            It helps the stall owner improve their service.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] bg-sgt-600 hover:bg-sgt-700 text-white rounded-lg font-semibold transition-colors"
          >
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  const activeRating = hoverRating || rating;
  const ratingLabel = activeRating === 0 ? 'Tap to rate' :
    activeRating <= 3 ? 'Poor' :
    activeRating <= 5 ? 'Average' :
    activeRating <= 7 ? 'Good' :
    activeRating <= 9 ? 'Great' : 'Excellent';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 sm:py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-sgt-600 to-sgt-700 p-4 sm:p-5 text-white">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sgt-200 text-xs font-medium uppercase tracking-wide">Stall Feedback</p>
                <h1 className="text-lg font-bold truncate">{info?.stallName}</h1>
              </div>
            </div>
            <p className="text-sgt-100 text-sm">{info?.eventName}</p>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
            {/* Single Rating (1–10) */}
            <div className="text-center">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Rate your overall experience
              </label>
              <div className="flex justify-center flex-wrap gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => {
                  const filled = val <= activeRating;
                  return (
                    <button
                      key={val}
                      type="button"
                      onMouseEnter={() => setHoverRating(val)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(val)}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-150 ${
                        filled
                          ? 'bg-sgt-600 text-white shadow-md scale-105'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-sgt-50 dark:hover:bg-sgt-900/20'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
              <p className={`mt-2 text-sm font-medium transition-colors ${
                activeRating === 0 ? 'text-gray-400 dark:text-gray-500' :
                activeRating <= 3 ? 'text-red-500' :
                activeRating <= 5 ? 'text-amber-500' :
                activeRating <= 7 ? 'text-blue-500' :
                'text-emerald-500'
              }`}>
                {activeRating > 0 && <span className="mr-1">{activeRating}/10</span>}
                {ratingLabel}
              </p>
            </div>

            {/* Optional text feedback */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sgt-500" />
                Write additional feedback (optional)
              </label>
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Share any specific thoughts about your experience at this stall..."
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-sgt-500 focus:border-transparent resize-none text-sm"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{shortDescription.length}/2000</p>
            </div>

            <button
              type="submit"
              disabled={submitting || rating < 1}
              className="w-full py-3 min-h-[48px] bg-sgt-600 hover:bg-sgt-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Star className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              No login required · Anonymous feedback
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
