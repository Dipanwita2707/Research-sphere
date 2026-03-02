'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star, MessageSquare, CheckCircle, Store } from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';

const STALL_POINT_LABELS = [
  'Overall Experience',
  'Product / Food Quality',
  'Pricing & Value',
  'Staff Friendliness',
  'Cleanliness',
  'Presentation & Setup',
  'Wait Time',
  'Variety',
  'Packaging',
  'Would Recommend',
];

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-semibold text-purple-600 dark:text-purple-400 min-w-[2rem] text-right">
          {value}/10
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => {
          const val = i + 1;
          const filled = val <= (hover || value);
          return (
            <button
              key={val}
              type="button"
              onMouseEnter={() => setHover(val)}
              onMouseLeave={() => setHover(0)}
              onClick={() => onChange(val)}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors text-xs font-semibold ${
                filled
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-purple-100 dark:hover:bg-purple-900/20'
              }`}
            >
              {val}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [points, setPoints] = useState<number[]>(Array(10).fill(7));
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
      await eventService.submitStallFeedback(eventId, stallId, {
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
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Stall Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This stall may have been removed or this QR code is no longer active.
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
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
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Thank You! 🎉
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            Your feedback for <span className="font-semibold text-gray-800 dark:text-gray-200">{info?.stallName}</span> has been submitted.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            It helps the stall owner improve their service. We appreciate your time!
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
          >
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  const avgRating = (points.reduce((a, b) => a + b, 0) / points.length).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <p className="text-purple-200 text-xs font-medium uppercase tracking-wide">Stall Feedback</p>
                <h1 className="text-lg font-bold">{info?.stallName}</h1>
              </div>
            </div>
            <p className="text-purple-100 text-sm">{info?.eventName}</p>
            <div className="mt-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
              <span className="text-sm text-purple-100">
                Current average: <span className="font-bold text-white">{avgRating}/10</span>
              </span>
            </div>
          </div>

          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
            <p className="text-sm text-purple-700 dark:text-purple-300 text-center">
              Rate your experience — 1 (poor) to 10 (excellent)
            </p>
          </div>
        </div>

        {/* Feedback Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-5">
            {STALL_POINT_LABELS.map((label, i) => (
              <StarRating
                key={label}
                label={label}
                value={points[i]}
                onChange={(v) => setPoint(i, v)}
              />
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-500" />
              Additional Comments (optional)
            </label>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Share any specific thoughts about your experience at this stall..."
              rows={4}
              maxLength={2000}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{shortDescription.length}/2000</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-base shadow-lg shadow-purple-200 dark:shadow-purple-900 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Star className="w-5 h-5 fill-yellow-300 text-yellow-300" />
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
  );
}
