'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users, Edit, TrendingUp, CheckCircle, AlertCircle, Eye, Trash2, QrCode, UserPlus, Settings, BarChart3 } from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, EventFilters } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';

const EVENT_TYPE_LABELS: Record<string, string> = {
  seminar: 'Seminar',
  workshop: 'Workshop',
  fest: 'Fest',
  conference: 'Conference',
  competition: 'Competition',
  cultural: 'Cultural',
  technical: 'Technical',
  sports: 'Sports',
  other: 'Other',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
  published: { label: 'Published', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  ongoing: { label: 'Ongoing', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: Trash2 },
};

export default function MyCreatedEventsPage() {
  const { toast } = useToast();
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'draft' | 'published' | 'past'>('published');

  // Fetch ALL my events once - used for both summary boxes and tab-filtered list
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const result = await eventService.getEvents(
        { myEvents: true },
        1,
        100
      );
      setAllEvents(result.events);
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Filter events by active tab (client-side - no refetch, data persists)
  const events = React.useMemo(() => {
    if (activeTab === 'draft') return allEvents.filter((e) => e.status === 'draft');
    if (activeTab === 'published') return allEvents.filter((e) => e.status === 'published' || e.status === 'ongoing');
    return allEvents.filter((e) => e.status === 'completed' || e.status === 'cancelled');
  }, [allEvents, activeTab]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDraftCompletionStatus = (event: Event) => {
    const missingFields = [];
    if (!event.venue) missingFields.push('Venue');
    if (!event.registrationStartDate) missingFields.push('Registration Start Date');
    if (!event.registrationEndDate) missingFields.push('Registration End Date');

    return {
      isComplete: missingFields.length === 0,
      missingFields
    };
  };

  // Summary counts from ALL events (not filtered by tab)
  const draftCount = allEvents.filter((e) => e.status === 'draft').length;
  const publishedCount = allEvents.filter((e) => e.status === 'published' || e.status === 'ongoing').length;
  const pastCount = allEvents.filter((e) => e.status === 'completed' || e.status === 'cancelled').length;
  const totalRegistrations = allEvents.reduce((sum, e) => sum + (e.currentRegistrations || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">My Created Events</h1>
          <p className="text-gray-600 dark:text-gray-400">Events you organized through approved noting requests</p>
        </div>

        {/* Stats Cards - compact */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-sgt-200 dark:border-sgt-700 p-3 flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Drafts</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{draftCount}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-sgt-200 dark:border-sgt-700 p-3 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Published</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{publishedCount}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-sgt-200 dark:border-sgt-700 p-3 flex items-center gap-3">
            <Users className="h-6 w-6 text-green-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Registrations</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{totalRegistrations}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <nav className="-mb-px flex space-x-4 min-w-max">
            <button
              onClick={() => setActiveTab('published')}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${activeTab === 'published'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Published
            </button>
            <button
              onClick={() => setActiveTab('draft')}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${activeTab === 'draft'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Drafts {draftCount > 0 && `(${draftCount})`}
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${activeTab === 'past'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Past Events {pastCount > 0 && `(${pastCount})`}
            </button>
          </nav>
        </div>

        {/* Events List */}
        {loading ? (
          <PageSkeleton message="Loading events..." />
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            {activeTab === 'draft' ? (
              <>
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No draft events</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  All your events are published or you haven't created any events yet.
                </p>
              </>
            ) : (
              <>
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No events yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Events are automatically created when your noting requests (with event category) are approved.
                </p>
                <div className="max-w-md mx-auto p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-300 mb-3">
                    <strong>📝 How to Create an Event?</strong>
                  </p>
                  <ol className="text-xs text-blue-800 dark:text-blue-400 text-left space-y-2">
                    <li>1. Create a <Link href="/noting/new" className="underline font-semibold">noting request</Link> with event details</li>
                    <li>2. Wait for approval from authorities</li>
                    <li>3. Event appears here as a <strong>DRAFT</strong></li>
                    <li>4. Add venue & registration dates</li>
                    <li>5. Publish to make it live!</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {events.map((event) => {
                const StatusIcon = STATUS_CONFIG[event.status]?.icon;
                const { isComplete, missingFields } = getDraftCompletionStatus(event);

                return (
                  <div
                    key={event.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt hover:shadow-sgt-lg hover:-translate-y-0.5 transition-all duration-200 p-6"
                  >
                    <div className="flex items-start justify-between">
                      {/* Event Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {/* Status Badge */}
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[event.status]?.color}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {STATUS_CONFIG[event.status]?.label}
                          </span>

                          {/* Draft Warning */}
                          {event.status === 'draft' && !isComplete && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Incomplete
                            </span>
                          )}

                          {/* Event Type */}
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {EVENT_TYPE_LABELS[event.eventType]}
                          </span>
                        </div>

                        {/* Event Name */}
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {event.name}
                        </h3>

                        {/* Date & Venue */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(event.startDate)} - {formatDate(event.endDate)}</span>
                          </div>

                          {event.venue ? (
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                              <MapPin className="h-4 w-4" />
                              <span>{event.venue}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                              <MapPin className="h-4 w-4" />
                              <span className="italic">Venue not set</span>
                            </div>
                          )}
                        </div>

                        {/* Registrations */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Users className="h-4 w-4" />
                            <span className="font-medium">
                              {event.currentRegistrations || 0}
                              {event.maxCapacity && ` / ${event.maxCapacity}`}
                            </span>
                            <span className="text-gray-500">registered</span>
                          </div>

                          <div className={`px-2 py-1 text-xs font-medium rounded-full ${event.paymentType === 'free'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                            }`}>
                            {event.paymentType === 'free' ? 'Free' : `₹${event.registrationFee}`}
                          </div>
                        </div>

                        {/* Draft Checklist */}
                        {event.status === 'draft' && missingFields.length > 0 && (
                          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-xs font-medium text-yellow-900 dark:text-yellow-300 mb-2">
                              ⚠️ Complete these fields to publish:
                            </p>
                            <ul className="text-xs text-yellow-800 dark:text-yellow-400 space-y-1">
                              {missingFields.map((field) => (
                                <li key={field}>• {field}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 ml-4">
                        <Link
                          href={`/events/${event.id}`}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sgt-600 hover:bg-sgt-700 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Link>

                        {event.status === 'draft' && (
                          <Link
                            href={`/events/${event.id}/manage`}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-sgt-600 dark:text-sgt-400 bg-sgt-50 dark:bg-sgt-900/20 hover:bg-sgt-100 dark:hover:bg-sgt-900/30 rounded-lg transition-colors border border-sgt-200 dark:border-sgt-800"
                          >
                            <Edit className="h-4 w-4" />
                            Complete & Publish
                          </Link>
                        )}

                        <Link
                          href={`/events/${event.id}/management`}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sgt-600 hover:bg-sgt-700 rounded-lg transition-colors shadow-sm"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Event Management
                        </Link>

                        {event.status !== 'draft' && (
                          <>
                            <Link
                              href={`/events/${event.id}/manage`}
                              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
                            >
                              <Settings className="h-4 w-4" />
                              Event Update
                            </Link>
                            <Link
                              href={`/events/${event.id}/scan`}
                              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
                            >
                              <QrCode className="h-4 w-4" />
                              QR Scan
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </>
        )}
      </div>
    </div>
  );
}
