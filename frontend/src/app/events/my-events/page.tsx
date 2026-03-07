'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, Users, Edit, CheckCircle, AlertCircle, Eye, Trash2, QrCode, Settings, BarChart3, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useMyCreatedEvents } from '@/features/event-management/hooks/useEvents';
import { EVENT_TYPE_LABELS } from '@/features/event-management/constants';
import type { Event } from '@/features/event-management/types/event.types';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { useAuthStore } from '@/shared/auth/authStore';
import { useNotingPermissions } from '@/features/noting-management/hooks/useNoting';

/** Status → icon mapping (page-specific) */
const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  draft: AlertCircle,
  published: CheckCircle,
  ongoing: CheckCircle,
  completed: CheckCircle,
  cancelled: Trash2,
};

/** Status → style mapping (page-specific badge colors) */
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
  published: { label: 'Published', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' },
  ongoing: { label: 'Ongoing', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' },
};

/** A grouped item: either a standalone event or a festival with sub-events */
type GroupedItem =
  | { type: 'standalone'; event: Event }
  | { type: 'festival'; festivalNotingId: string; meta: { name: string; startDate: string; endDate: string; description?: string; coordinator?: string }; events: Event[] };

/** Group events: festivals are collapsed into a single group card */
function groupEvents(eventList: Event[]): GroupedItem[] {
  const festivalMap: Record<string, Event[]> = {};
  const standalone: Event[] = [];

  for (const e of eventList) {
    if (e.festivalNotingId) {
      if (!festivalMap[e.festivalNotingId]) festivalMap[e.festivalNotingId] = [];
      festivalMap[e.festivalNotingId].push(e);
    } else {
      standalone.push(e);
    }
  }

  const items: GroupedItem[] = [];

  // Festivals first
  for (const fid of Object.keys(festivalMap)) {
    const fevents = festivalMap[fid];
    const meta = fevents[0]?.festivalMeta;
    items.push({
      type: 'festival',
      festivalNotingId: fid,
      meta: meta || { name: 'Festival', startDate: fevents[0]?.startDate || '', endDate: fevents[0]?.endDate || '' },
      events: fevents,
    });
  }

  // Then standalone events
  for (const e of standalone) {
    items.push({ type: 'standalone', event: e });
  }

  return items;
}

export default function MyCreatedEventsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isStudent = user?.role?.name === 'student' || user?.userType === 'student';
  const { data: notingPerms, isLoading: permsLoading } = useNotingPermissions({ enabled: !!isStudent });
  const isChairperson = !!(notingPerms?.isClubChairperson);

  // Access guard: students who are not club chairpersons cannot access this page
  useEffect(() => {
    if (isStudent && !permsLoading && !isChairperson) {
      router.replace('/events');
    }
  }, [isStudent, permsLoading, isChairperson, router]);

  const { data: allEvents = [], isLoading: loading } = useMyCreatedEvents();
  const [activeTab, setActiveTab] = useState<'draft' | 'published' | 'past'>('published');
  const [expandedFestivals, setExpandedFestivals] = useState<Set<string>>(new Set());

  // Show skeleton while checking permissions for students
  if (isStudent && permsLoading) return <PageSkeleton />;
  // Render nothing while redirect is in progress
  if (isStudent && !isChairperson) return null;

  // Filter events by active tab (client-side - no refetch, data persists)
  const events = React.useMemo(() => {
    if (activeTab === 'draft') return allEvents.filter((e) => e.status === 'draft');
    if (activeTab === 'published') return allEvents.filter((e) => e.status === 'published' || e.status === 'ongoing');
    return allEvents.filter((e) => e.status === 'completed' || e.status === 'cancelled');
  }, [allEvents, activeTab]);

  // Group events by festival
  const groupedItems = React.useMemo(() => groupEvents(events), [events]);

  const toggleFestival = (fid: string) => {
    setExpandedFestivals((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid);
      else next.add(fid);
      return next;
    });
  };

  // All festival IDs in current tab
  const festivalIds = React.useMemo(
    () => groupedItems.filter((g) => g.type === 'festival').map((g) => (g as { festivalNotingId: string }).festivalNotingId),
    [groupedItems],
  );
  const allExpanded = festivalIds.length > 0 && festivalIds.every((id) => expandedFestivals.has(id));
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedFestivals(new Set());
    } else {
      setExpandedFestivals(new Set(festivalIds));
    }
  };

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

        {/* Expand / Collapse All */}
        {!loading && festivalIds.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg transition-colors"
            >
              {allExpanded ? (
                <><ChevronDown className="h-3.5 w-3.5" /> Collapse All</>
              ) : (
                <><ChevronRight className="h-3.5 w-3.5" /> Expand All</>
              )}
            </button>
          </div>
        )}

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
              {groupedItems.map((item) => {
                if (item.type === 'festival') {
                  const isExpanded = expandedFestivals.has(item.festivalNotingId);
                  const allDraft = item.events.every((e) => e.status === 'draft');
                  const allPublished = item.events.every((e) => e.status === 'published' || e.status === 'ongoing');
                  const summaryStatus = allDraft ? 'draft' : allPublished ? 'published' : 'mixed';

                  return (
                    <div key={`festival-${item.festivalNotingId}`} className="rounded-xl border-[1.5px] border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 overflow-hidden shadow-sgt">
                      {/* Festival Header — always visible */}
                      <button
                        type="button"
                        onClick={() => toggleFestival(item.festivalNotingId)}
                        className="w-full flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 transition-colors text-left"
                      >
                        {isExpanded
                          ? <ChevronDown className="h-5 w-5 text-purple-500 shrink-0" />
                          : <ChevronRight className="h-5 w-5 text-purple-500 shrink-0" />}
                        <Sparkles className="h-5 w-5 text-purple-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                              🎪 {item.meta.name}
                            </h3>
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 uppercase tracking-wider">
                              Festival
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${
                              summaryStatus === 'draft' ? 'bg-gray-100 text-gray-600' : summaryStatus === 'published' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {summaryStatus === 'mixed' ? 'Partial' : summaryStatus}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(item.meta.startDate)} – {formatDate(item.meta.endDate)}
                            </span>
                            <span className="font-medium text-purple-600 dark:text-purple-400">
                              {item.events.length} sub-event{item.events.length !== 1 ? 's' : ''}
                            </span>
                            {item.meta.coordinator && (
                              <span className="text-gray-400">Coordinator: {item.meta.coordinator}</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Sub-Events — collapsible */}
                      {isExpanded && (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
                          {item.events.map((event) => (
                            <EventCard key={event.id} event={event} formatDate={formatDate} getDraftCompletionStatus={getDraftCompletionStatus} nested />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                // Standalone event
                return <EventCard key={item.event.id} event={item.event} formatDate={formatDate} getDraftCompletionStatus={getDraftCompletionStatus} />;
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Reusable event card — used for standalone events and festival sub-events */
function EventCard({
  event,
  formatDate,
  getDraftCompletionStatus,
  nested = false,
}: {
  event: Event;
  formatDate: (d: string) => string;
  getDraftCompletionStatus: (e: Event) => { isComplete: boolean; missingFields: string[] };
  nested?: boolean;
}) {
  const StatusIcon = STATUS_ICONS[event.status] ?? AlertCircle;
  const { isComplete, missingFields } = getDraftCompletionStatus(event);

  return (
    <div
      className={
        nested
          ? 'p-5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors'
          : 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt hover:shadow-sgt-lg hover:-translate-y-0.5 transition-all duration-200 p-6'
      }
    >
      <div className="flex items-start justify-between">
        {/* Event Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            {/* Status Badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full ${STATUS_BADGE[event.status]?.color}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {STATUS_BADGE[event.status]?.label}
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

            {/* Sub-event type badge (Venue / Stall) when nested */}
            {nested && event.notingEventType && event.notingEventType !== 'festival' && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                event.notingEventType === 'stall'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              }`}>
                {event.notingEventType === 'stall' ? '🪄 Stall' : '🏛️ Venue'}
              </span>
            )}
          </div>

          {/* Event Name */}
          <h3 className={`font-semibold text-gray-900 dark:text-white mb-2 ${nested ? 'text-base' : 'text-lg'}`}>
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

            <div className={`px-2 py-1 text-xs font-medium rounded-full ${
              event.paymentType === 'free'
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
}