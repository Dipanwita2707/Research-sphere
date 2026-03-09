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
  published: { label: 'Published', color: 'bg-ev-100 text-ev-800 dark:bg-ev-900/20 dark:text-ev-200' },
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

  // Filter events by active tab (client-side - no refetch, data persists)
  const events = React.useMemo(() => {
    if (activeTab === 'draft') return allEvents.filter((e) => e.status === 'draft');
    if (activeTab === 'published') return allEvents.filter((e) => e.status === 'published' || e.status === 'ongoing');
    return allEvents.filter((e) => e.status === 'completed' || e.status === 'cancelled');
  }, [allEvents, activeTab]);

  // Group events by festival
  const groupedItems = React.useMemo(() => groupEvents(events), [events]);

  // All festival IDs in current tab
  const festivalIds = React.useMemo(
    () => groupedItems.filter((g) => g.type === 'festival').map((g) => (g as { festivalNotingId: string }).festivalNotingId),
    [groupedItems],
  );

  // Show skeleton while checking permissions for students
  if (isStudent && permsLoading) return <PageSkeleton />;
  // Render nothing while redirect is in progress
  if (isStudent && !isChairperson) return null;

  const toggleFestival = (fid: string) => {
    setExpandedFestivals((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid);
      else next.add(fid);
      return next;
    });
  };
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
    <div className="ev-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-ev-900 mb-2">My Created Events</h1>
          <p className="text-ev-400">Events you organized through approved noting requests</p>
        </div>

        {/* Stats Cards - compact */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
          <div className="ev-stat flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-ev-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-ev-400 uppercase tracking-wide">Drafts</p>
              <p className="text-lg font-bold text-ev-900">{draftCount}</p>
            </div>
          </div>
          <div className="ev-stat flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-ev-700 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-ev-400 uppercase tracking-wide">Published</p>
              <p className="text-lg font-bold text-ev-900">{publishedCount}</p>
            </div>
          </div>
          <div className="ev-stat flex items-center gap-3">
            <Users className="h-6 w-6 text-ev-700 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-ev-400 uppercase tracking-wide">Registrations</p>
              <p className="text-lg font-bold text-ev-900">{totalRegistrations}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-ev-200 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <nav className="-mb-px flex space-x-4 min-w-max">
            <button
              onClick={() => setActiveTab('published')}
              className={`ev-tab ${activeTab === 'published' ? 'ev-tab-active' : ''}`}
            >
              Published
            </button>
            <button
              onClick={() => setActiveTab('draft')}
              className={`ev-tab ${activeTab === 'draft' ? 'ev-tab-active' : ''}`}
            >
              Drafts {draftCount > 0 && `(${draftCount})`}
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`ev-tab ${activeTab === 'past' ? 'ev-tab-active' : ''}`}
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
              className="ev-btn-outline text-xs !py-1.5 !px-3"
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
                <AlertCircle className="h-12 w-12 text-ev-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-ev-900 mb-2">No draft events</h3>
                <p className="text-ev-400 mb-4">
                  All your events are published or you haven't created any events yet.
                </p>
              </>
            ) : (
              <>
                <Calendar className="h-12 w-12 text-ev-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-ev-900 mb-2">No events yet</h3>
                <p className="text-ev-400 mb-6">
                  Events are automatically created when your noting requests (with event category) are approved.
                </p>
                <div className="max-w-md mx-auto p-4 ev-card">
                  <p className="text-sm text-ev-900 mb-3">
                    <strong>📝 How to Create an Event?</strong>
                  </p>
                  <ol className="text-xs text-ev-800 text-left space-y-2">
                    <li>1. Create a <Link href="/noting/new" className="underline font-semibold text-ev-700">noting request</Link> with event details</li>
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
                    <div key={`festival-${item.festivalNotingId}`} className="ev-card overflow-hidden">
                      {/* Festival Header — always visible */}
                      <button
                        type="button"
                        onClick={() => toggleFestival(item.festivalNotingId)}
                        className="w-full flex items-center gap-3 px-5 py-4 bg-ev-50 hover:bg-[#e2ecf3] transition-colors text-left"
                      >
                        {isExpanded
                          ? <ChevronDown className="h-5 w-5 text-ev-700 shrink-0" />
                          : <ChevronRight className="h-5 w-5 text-ev-700 shrink-0" />}
                        <Sparkles className="h-5 w-5 text-ev-700 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-ev-900 truncate">
                              🎪 {item.meta.name}
                            </h3>
                            <span className="ev-badge bg-ev-50 text-ev-800 text-[10px] uppercase tracking-wider">
                              Festival
                            </span>
                            <span className={`ev-badge text-[10px] uppercase tracking-wider ${
                              summaryStatus === 'draft' ? 'bg-gray-100 text-gray-600' : summaryStatus === 'published' ? 'bg-ev-50 text-ev-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {summaryStatus === 'mixed' ? 'Partial' : summaryStatus}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-ev-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(item.meta.startDate)} – {formatDate(item.meta.endDate)}
                            </span>
                            <span className="font-medium text-ev-700">
                              {item.events.length} sub-event{item.events.length !== 1 ? 's' : ''}
                            </span>
                            {item.meta.coordinator && (
                              <span className="text-ev-400">Coordinator: {item.meta.coordinator}</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Sub-Events — collapsible */}
                      {isExpanded && (
                        <div className="divide-y divide-ev-200 border-t border-ev-200">
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
          ? 'p-5 hover:bg-ev-50 transition-colors'
          : 'ev-card ev-card-hover p-6'
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
                  : 'bg-ev-100 text-ev-800 dark:bg-ev-900/30 dark:text-ev-200'
              }`}>
                {event.notingEventType === 'stall' ? '🪄 Stall' : '🏛️ Venue'}
              </span>
            )}
          </div>

          {/* Event Name */}
          <h3 className={`font-semibold text-ev-900 mb-2 ${nested ? 'text-base' : 'text-lg'}`}>
            {event.name}
          </h3>

          {/* Date & Venue */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-sm text-ev-800">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(event.startDate)} - {formatDate(event.endDate)}</span>
            </div>

            {event.venue ? (
              <div className="flex items-center gap-2 text-sm text-ev-800">
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
            <div className="flex items-center gap-2 text-ev-800">
              <Users className="h-4 w-4" />
              <span className="font-medium">
                {event.currentRegistrations || 0}
                {event.maxCapacity && ` / ${event.maxCapacity}`}
              </span>
              <span className="text-ev-400">registered</span>
            </div>

            <div className={`px-2 py-1 text-xs font-medium rounded-full ${
              event.paymentType === 'free'
                ? 'bg-green-100 text-green-800'
                : 'bg-ev-100 text-ev-800'
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
            className="ev-btn text-sm"
          >
            <Eye className="h-4 w-4" />
            View
          </Link>

          {event.status === 'draft' && (
            <Link
              href={`/events/${event.id}/manage`}
              className="ev-btn-outline text-sm"
            >
              <Edit className="h-4 w-4" />
              Complete & Publish
            </Link>
          )}

          <Link
            href={`/events/${event.id}/management`}
            className="ev-btn text-sm"
          >
            <BarChart3 className="h-4 w-4" />
            Event Management
          </Link>

          {event.status !== 'draft' && (
            <>
              <Link
                href={`/events/${event.id}/manage`}
                className="ev-btn-outline text-sm"
              >
                <Settings className="h-4 w-4" />
                Event Update
              </Link>
              <Link
                href={`/events/${event.id}/scan`}
                className="ev-btn-outline text-sm"
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