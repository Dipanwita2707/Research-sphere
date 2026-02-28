'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star, MessageSquare, CheckCircle } from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';

const POINT_LABELS = [
  'Overall Experience',
  'Organization',
  'Content Quality',
  'Venue & Facilities',
  'Registration Process',
  'Communication',
  'Value for Time',
  'Would Recommend',
  'Speaker/Presenter Quality',
  'Networking Opportunity',
];

export default function EventFeedbackPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { toast } = useToast();
  const [event, setEvent] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [points, setPoints] = useState<number[]>([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
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

  const setPoint = (index: number, value: number) => {
    setPoints((prev) => {
      const next = [...prev];
      next[index] = Math.min(10, Math.max(1, value));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await eventService.submitFeedback(eventId, {
        points,
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
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Event Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This event may have been removed or is not yet published.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-sgt-600 dark:text-sgt-400 hover:underline"
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
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Thank You!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your feedback has been submitted successfully.
          </p>
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-sgt-600 dark:text-sgt-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-sgt-600 dark:hover:text-sgt-400 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Event
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-sgt-500" />
              Event Feedback
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {event?.name || 'Event'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Rate each point from 1 to 10 (1 = Poor, 10 = Excellent)
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {POINT_LABELS.map((label, i) => (
              <div key={i}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {i + 1}. {label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={points[i] ?? 5}
                    onChange={(e) => setPoint(i, parseInt(e.target.value, 10))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-sgt-600"
                  />
                  <span className="w-8 text-sm font-semibold text-sgt-600 dark:text-sgt-400 text-right">
                    {points[i] ?? 5}
                  </span>
                </div>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Short Description (optional)
              </label>
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="Any additional comments or suggestions..."
              />
              <p className="text-xs text-gray-400 mt-1">{shortDescription.length}/2000</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-sgt-600 rounded-lg hover:bg-sgt-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>Submitting...</>
              ) : (
                <>
                  <Star className="w-4 h-4" />
                  Submit Feedback
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
