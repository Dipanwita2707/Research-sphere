'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Calendar, MapPin, Users, Edit, CheckCircle, AlertCircle, Eye, Trash2, QrCode, Settings, BarChart3, ChevronDown, ChevronRight, Sparkles, LayoutGrid } from 'lucide-react';
import { useMyCreatedEvents } from '@/features/event-management/hooks/useEvents';
import { EVENT_TYPE_LABELS } from '@/features/event-management/constants';
import type { Event } from '@/features/event-management/types/event.types';
import { useAuthStore } from '@/shared/auth/authStore';
import { useNotingPermissions } from '@/features/noting-management/hooks/useNoting';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventsMyEventsShimmer, EventCardShimmer } from '@/components/shimmer';

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

  // Show TMS-style loading while checking permissions for students
  if (isStudent && permsLoading) {
    return <EventsMyEventsShimmer />;
  }
  // Access guard: students who are not club chairpersons cannot access this page
  if (isStudent && !isChairperson) {
    router.replace('/events');
    return null;
  }

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
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 dark:bg-gray-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page header — TMS-style */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#011f4b] to-[#005b96] shadow-md">
                <LayoutGrid className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#011f4b] dark:text-white">My events</h1>
                <p className="mt-0.5 text-sm text-[#6497b1] dark:text-gray-400">
                  Manage drafts, published events, and festival-linked events from one place.
                </p>
                <div className="mt-3 grid max-w-md grid-cols-3 gap-2 sm:max-w-lg">
                  <div className="rounded-xl border border-[#b3cde0]/40 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800" style={{ boxShadow: '0 2px 8px 0 rgba(0, 91, 150, 0.06)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6497b1]">Drafts</p>
                    <p className="text-lg font-bold text-[#011f4b] dark:text-white">{draftCount}</p>
                  </div>
                  <div className="rounded-xl border border-[#b3cde0]/40 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800" style={{ boxShadow: '0 2px 8px 0 rgba(0, 91, 150, 0.06)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6497b1]">Published</p>
                    <p className="text-lg font-bold text-[#011f4b] dark:text-white">{publishedCount}</p>
                  </div>
                  <div className="rounded-xl border border-[#b3cde0]/40 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800" style={{ boxShadow: '0 2px 8px 0 rgba(0, 91, 150, 0.06)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6497b1]">Registrations</p>
                    <p className="text-lg font-bold text-[#011f4b] dark:text-white">{totalRegistrations}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 h-0.5 rounded-full bg-gradient-to-r from-[#005b96] via-[#b3cde0] to-transparent" aria-hidden />
        </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as 'draft' | 'published' | 'past')}
              className="flex flex-col gap-6"
            >
              <div
                className="rounded-2xl border border-[#b3cde0]/40 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <p className="text-sm font-semibold text-[#03396c] dark:text-gray-200">View</p>
                  <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-[#f8fafc] p-1 dark:bg-gray-900 xl:flex-1 xl:justify-center">
                    <TabsTrigger
                      value="published"
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-[#005b96] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#005b96]/25 dark:data-[state=active]:bg-[#005b96]"
                    >
                      Published
                    </TabsTrigger>
                    <TabsTrigger
                      value="draft"
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-[#005b96] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#005b96]/25 dark:data-[state=active]:bg-[#005b96]"
                    >
                      Drafts {draftCount > 0 ? `(${draftCount})` : ''}
                    </TabsTrigger>
                    <TabsTrigger
                      value="past"
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-[#005b96] data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-[#005b96]/25 dark:data-[state=active]:bg-[#005b96]"
                    >
                      Past {pastCount > 0 ? `(${pastCount})` : ''}
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-[#b3cde0]/60 bg-[#f8fafc] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#03396c] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {events.length} in view
                    </Badge>
                    {festivalIds.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        onClick={toggleAll}
                        className="rounded-xl border-[#b3cde0]/60 bg-white text-[#03396c] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      >
                        {allExpanded ? <ChevronDown className="mr-1.5 h-4 w-4" /> : <ChevronRight className="mr-1.5 h-4 w-4" />}
                        {allExpanded ? 'Collapse festivals' : 'Expand festivals'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Events List */}
              {loading ? (
                <div className="grid grid-cols-1 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <EventCardShimmer key={i} />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div
                  className="rounded-2xl border border-[#b3cde0]/40 bg-white py-14 text-center dark:border-gray-700 dark:bg-gray-800"
                  style={{ boxShadow: '0 2px 16px 0 rgba(0, 91, 150, 0.07)' }}
                >
                  <div className="px-6">
                    {activeTab === 'draft' ? (
                      <>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b3cde0]/20">
                          <AlertCircle className="h-7 w-7 text-[#6497b1]" />
                        </div>
                        <p className="font-semibold text-[#03396c] dark:text-gray-200">No draft events</p>
                        <p className="mt-1 text-sm text-[#6497b1] dark:text-gray-400">
                          All your events are published or you haven&apos;t created any events yet.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b3cde0]/20">
                          <Calendar className="h-7 w-7 text-[#6497b1]" />
                        </div>
                        <p className="font-semibold text-[#03396c] dark:text-gray-200">No events yet</p>
                        <p className="mx-auto mt-1 max-w-xl text-sm text-[#6497b1] dark:text-gray-400">
                          Events are automatically created when your noting requests (with event category) are approved.
                        </p>
                        <Card className="mx-auto mt-6 max-w-lg rounded-2xl border border-[#b3cde0]/40 bg-[#f8fafc] py-0 text-left dark:border-gray-600 dark:bg-gray-900/50" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                          <CardContent className="px-5 py-5">
                            <p className="mb-3 text-sm font-semibold text-[#011f4b] dark:text-white">How event creation flows</p>
                            <ol className="space-y-2.5 text-sm text-[#03396c]/90 dark:text-gray-400">
                              <li>1. Create a noting request with event details.</li>
                              <li>2. Wait for the approval chain to complete.</li>
                              <li>3. The event appears here as a draft.</li>
                              <li>4. Add venue and registration dates.</li>
                              <li>5. Publish when the event is ready to go live.</li>
                            </ol>
                            <div className="mt-5 flex justify-start">
                              <Button asChild className="rounded-xl bg-[#005b96] px-5 shadow-md shadow-[#005b96]/20 hover:bg-[#03396c]">
                                <Link href="/noting/new">
                                  Create noting request
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mb-8 space-y-5">
              {groupedItems.map((item) => {
                if (item.type === 'festival') {
                  const isExpanded = expandedFestivals.has(item.festivalNotingId);
                  const allDraft = item.events.every((e) => e.status === 'draft');
                  const allPublished = item.events.every((e) => e.status === 'published' || e.status === 'ongoing');
                  const summaryStatus = allDraft ? 'draft' : allPublished ? 'published' : 'mixed';

                  return (
                    <Card
                      key={`festival-${item.festivalNotingId}`}
                      className="overflow-hidden rounded-2xl border border-[#b3cde0]/40 bg-white py-0 dark:border-gray-700 dark:bg-gray-800"
                      style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}
                    >
                      {/* Festival Header — always visible */}
                      <button
                        type="button"
                        onClick={() => toggleFestival(item.festivalNotingId)}
                        className="flex w-full items-start gap-3 bg-[#f8fafc]/80 px-5 py-4 text-left transition-colors hover:bg-[#b3cde0]/10 dark:bg-gray-800/80 dark:hover:bg-gray-700/50"
                      >
                        {isExpanded
                          ? <ChevronDown className="h-5 w-5 shrink-0 text-[#005b96]" />
                          : <ChevronRight className="h-5 w-5 shrink-0 text-[#005b96]" />}
                        <Sparkles className="h-5 w-5 shrink-0 text-[#005b96]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-bold text-[#011f4b] dark:text-white">
                              {item.meta.name}
                            </h3>
                            <Badge className="border border-fuchsia-200/80 bg-fuchsia-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-300">
                              Festival
                            </Badge>
                            <Badge className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                              summaryStatus === 'draft'
                                ? 'border border-slate-200 bg-slate-100 text-slate-700'
                                : summaryStatus === 'published'
                                  ? 'border border-[#b3cde0]/80 bg-[#b3cde0]/20 text-[#03396c]'
                                  : 'border border-amber-200/80 bg-amber-50 text-amber-800'
                            }`}>
                              {summaryStatus === 'mixed' ? 'Partial' : summaryStatus}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6497b1] dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-[#005b96]" />
                              {formatDate(item.meta.startDate)} – {formatDate(item.meta.endDate)}
                            </span>
                            <span className="font-medium text-[#03396c] dark:text-gray-300">
                              {item.events.length} sub-event{item.events.length !== 1 ? 's' : ''}
                            </span>
                            {item.meta.coordinator && (
                              <span className="text-[#6497b1]/80">Coordinator: {item.meta.coordinator}</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Sub-Events — collapsible */}
                      {isExpanded && (
                        <div className="divide-y divide-[#b3cde0]/30 border-t border-[#b3cde0]/30 dark:divide-gray-600 dark:border-gray-600">
                          {item.events.map((event) => (
                            <EventCard key={event.id} event={event} formatDate={formatDate} getDraftCompletionStatus={getDraftCompletionStatus} nested />
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                }

                // Standalone event
                return <EventCard key={item.event.id} event={item.event} formatDate={formatDate} getDraftCompletionStatus={getDraftCompletionStatus} />;
              })}
                </div>
              )}
            </Tabs>
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
          ? 'p-5 transition-colors hover:bg-[#005b96]/[0.03] dark:hover:bg-gray-700/30'
          : 'rounded-2xl border border-[#b3cde0]/40 bg-[#f8fafc]/80 p-5 transition duration-200 hover:border-[#6497b1] dark:border-gray-600 dark:bg-gray-900/50 sm:p-6'
      }
      style={nested ? undefined : { boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        {/* Event Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
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
            <span className="text-xs font-medium text-slate-500">
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
          <h3 className={`mb-2 font-bold text-[#011f4b] dark:text-white ${nested ? 'text-base' : 'text-xl'}`}>
            {event.name}
          </h3>

          {/* Date & Venue */}
          <div className="mb-3 space-y-2">
            <div className="flex items-start gap-2 text-sm text-[#03396c] dark:text-gray-300">
              <Calendar className="h-4 w-4 text-[#005b96]" />
              <span>{formatDate(event.startDate)} - {formatDate(event.endDate)}</span>
            </div>

            {event.venue ? (
              <div className="flex items-start gap-2 text-sm text-[#03396c] dark:text-gray-300">
                <MapPin className="h-4 w-4 text-[#005b96]" />
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
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2 text-[#03396c] dark:text-gray-300">
              <Users className="h-4 w-4 text-[#005b96]" />
              <span className="text-[#6497b1] dark:text-gray-400">Few seats left</span>
            </div>

            <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              event.paymentType === 'free'
                ? 'border border-emerald-200/80 bg-emerald-50 text-emerald-800'
                : 'border border-[#b3cde0]/80 bg-[#b3cde0]/15 text-[#03396c]'
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:w-[348px] xl:grid-cols-1">
          <Button asChild variant="outline" size="default" className="w-full justify-start rounded-xl border-[#b3cde0]/60 bg-white text-[#03396c] hover:bg-[#f8fafc] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
            <Link href={`/events/${event.id}`}>
              <Eye className="h-4 w-4" />
              View
            </Link>
          </Button>

          {event.status === 'draft' && (
            <Button asChild size="default" className="w-full justify-start rounded-xl bg-[#005b96] shadow-md shadow-[#005b96]/20 hover:bg-[#03396c]">
              <Link href={`/events/${event.id}/manage`}>
                <Edit className="h-4 w-4" />
                Complete & Publish
              </Link>
            </Button>
          )}

          <Button asChild size="default" className="w-full justify-start rounded-xl bg-[#011f4b] text-white shadow-sm hover:bg-[#03396c]">
            <Link href={`/events/${event.id}/management`}>
              <BarChart3 className="h-4 w-4" />
              Event Management
            </Link>
          </Button>

          {event.status !== 'draft' && (
            <>
              <Button asChild variant="outline" size="default" className="group w-full justify-start rounded-xl border-[#b3cde0]/60 bg-white transition-all hover:border-[#005b96]/40 hover:bg-[#005b96]/5 dark:border-gray-600 dark:bg-gray-800">
                <Link href={`/events/${event.id}/manage`}>
                  <Settings className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                  <span className="truncate text-[13px] font-semibold tracking-tight">Event Edit/Publish/Republish</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="default" className="w-full justify-start rounded-xl border-[#b3cde0]/60 bg-white hover:bg-[#f8fafc] dark:border-gray-600 dark:bg-gray-800">
                <Link href={`/events/${event.id}/scan`}>
                  <QrCode className="h-4 w-4" />
                  QR Scan
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}