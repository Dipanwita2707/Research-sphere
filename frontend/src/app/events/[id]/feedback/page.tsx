'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star, MessageSquare, CheckCircle } from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';

export default function EventFeedbackPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { toast } = useToast();
  const [event, setEvent] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [shortDescription, setShortDescription] = useState('');

  useEffect(() => {
    eventService.getFeedbackFormInfo(eventId)
      .then((data) => {
        setEvent(data);
        setNotFound(false);
      })
      .catch(() => {
        setEvent(null);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      toast({ type: 'warning', message: 'Please select a rating before submitting.' });
      return;
    }
    setSubmitting(true);
    try {
      await eventService.submitFeedback(eventId, {
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
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 text-center">
          <h2 className="text-xl font-bold text-ev-900 dark:text-white mb-2">Event Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This event may have been removed or is not yet published.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium text-ev-700 dark:text-ev-400 hover:underline"
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
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-ev-900 dark:text-white mb-2">Thank You!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your feedback has been submitted successfully.
          </p>
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium text-ev-700 dark:text-ev-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event
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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 py-6 sm:py-8 px-4">
      <div className="max-w-md mx-auto">
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-ev-700 dark:hover:text-ev-400 mb-4 sm:mb-6 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Event
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-[#b3cde0] dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-[#b3cde0] dark:border-gray-700 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-ev-50 dark:bg-ev-900/30 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-ev-700" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-ev-900 dark:text-white">
              Event Feedback
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {event?.name || 'Event'}
            </p>
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
                          ? 'bg-ev-700 text-white shadow-md scale-105'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-ev-50 dark:hover:bg-ev-900/20'
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
                activeRating <= 7 ? 'text-ev-700' :
                'text-emerald-500'
              }`}>
                {activeRating > 0 && <span className="mr-1">{activeRating}/10</span>}
                {ratingLabel}
              </p>
            </div>

            {/* Optional text feedback */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Write additional feedback (optional)
              </label>
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-ev-700 focus:border-ev-700 bg-white dark:bg-gray-700 text-ev-900 dark:text-white resize-none"
                placeholder="Any additional comments or suggestions..."
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{shortDescription.length}/2000</p>
            </div>

            <button
              type="submit"
              disabled={submitting || rating < 1}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] text-sm font-semibold text-white bg-ev-700 rounded-lg hover:bg-ev-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </div>
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
