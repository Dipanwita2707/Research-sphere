'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Calendar, MapPin, Users, Edit, CheckCircle, AlertCircle, Eye, Trash2, QrCode, Settings, BarChart3, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useMyCreatedEvents } from '@/features/event-management/hooks/useEvents';
import { EVENT_TYPE_LABELS } from '@/features/event-management/constants';
import type { Event } from '@/features/event-management/types/event.types';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { useAuthStore } from '@/shared/auth/authStore';
import { useNotingPermissions } from '@/features/noting-management/hooks/useNoting';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  // Show skeleton while checking permissions for students
  if (isStudent && permsLoading) return <PageSkeleton />;
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
    <div className="ev-page relative overflow-hidden pb-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden">
        <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-indigo-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1450px] px-4 pt-0 sm:px-6 sm:pt-0 lg:px-8 lg:pt-0">
        <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/92 shadow-[0_24px_70px_-48px_rgba(1,31,75,0.35)] backdrop-blur-xl">
          <div className="space-y-5 px-5 pb-5 pt-2 sm:px-8 sm:pb-7 sm:pt-3 lg:px-10 lg:pb-10 lg:pt-3">
            <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(1,31,75,0.98),rgba(23,76,150,0.96))] py-0 text-white shadow-[0_18px_50px_-36px_rgba(1,31,75,0.48)]">
              <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border border-white/12 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-100">
                        Events
                      </Badge>
                      <Badge className="border border-emerald-300/20 bg-emerald-300/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100">
                        {publishedCount} live now
                      </Badge>
                    </div>
                    <CardTitle className="mt-3 text-2xl font-black tracking-[-0.04em] text-white sm:text-[2rem]">
                      Manage drafts, published events, and festival-linked events.
                    </CardTitle>
                    <CardDescription className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                      Review the events you created, finish incomplete drafts, open event management, and handle updates or QR scanning from one workspace.
                    </CardDescription>
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
                    <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Drafts</p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">{draftCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Published</p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">{publishedCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Registrations</p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">{totalRegistrations}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as 'draft' | 'published' | 'past')}
              className="flex-col gap-5"
            >
              <Card className="mx-auto w-full max-w-[1120px] overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,rgba(248,250,252,0.96))] py-0 shadow-[0_16px_40px_-38px_rgba(1,31,75,0.14)]">
                <CardContent className="px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center xl:gap-4">
                    <div className="shrink-0">
                      <CardTitle className="text-base font-bold tracking-[-0.03em] text-slate-900 sm:text-lg">
                        Browse events
                      </CardTitle>
                    </div>

                    <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[0.95rem] bg-slate-100/80 p-1.5 xl:w-full xl:justify-center">
                      <TabsTrigger
                        value="published"
                        className="rounded-xl px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                      >
                        Published
                      </TabsTrigger>
                      <TabsTrigger
                        value="draft"
                        className="rounded-xl px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                      >
                        Drafts {draftCount > 0 ? `(${draftCount})` : ''}
                      </TabsTrigger>
                      <TabsTrigger
                        value="past"
                        className="rounded-xl px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                      >
                        Past events {pastCount > 0 ? `(${pastCount})` : ''}
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex flex-wrap items-center gap-2 xl:shrink-0">
                      <Badge className="border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">
                        {events.length} in view
                      </Badge>
                      {festivalIds.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="default"
                          onClick={toggleAll}
                          className="rounded-full border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                        >
                          {allExpanded ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
                          {allExpanded ? 'Collapse festivals' : 'Expand festivals'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Events List */}
              {loading ? (
                <PageSkeleton message="Loading events..." />
              ) : events.length === 0 ? (
                <Card className="rounded-[1.5rem] border border-slate-200/80 bg-white/92 py-0 text-center shadow-[0_18px_50px_-40px_rgba(1,31,75,0.18)]">
                  <CardContent className="px-6 py-14">
            {activeTab === 'draft' ? (
              <>
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No draft events</h3>
                <p className="text-slate-500 mb-4">
                  All your events are published or you haven't created any events yet.
                </p>
              </>
            ) : (
              <>
                <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">No events yet</h3>
                <p className="mx-auto max-w-xl text-slate-500 mb-6">
                  Events are automatically created when your noting requests (with event category) are approved.
                </p>
                <Card className="mx-auto max-w-lg rounded-[1.25rem] border border-slate-200/80 bg-slate-50/70 py-0 text-left shadow-none">
                  <CardContent className="px-5 py-5">
                    <p className="text-sm font-semibold text-slate-900 mb-3">How event creation flows</p>
                    <ol className="space-y-2.5 text-sm text-slate-600">
                      <li>1. Create a noting request with event details.</li>
                      <li>2. Wait for the approval chain to complete.</li>
                      <li>3. The event appears here as a draft.</li>
                      <li>4. Add venue and registration dates.</li>
                      <li>5. Publish when the event is ready to go live.</li>
                    </ol>
                    <div className="mt-5 flex justify-start">
                      <Button asChild size="lg" className="rounded-full px-5">
                        <Link href="/noting/new">
                          Create noting request
                          <ArrowRight data-icon="inline-end" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
                  </CardContent>
                </Card>
              ) : (
                <div className="mb-8 space-y-5">
              {groupedItems.map((item) => {
                if (item.type === 'festival') {
                  const isExpanded = expandedFestivals.has(item.festivalNotingId);
                  const allDraft = item.events.every((e) => e.status === 'draft');
                  const allPublished = item.events.every((e) => e.status === 'published' || e.status === 'ongoing');
                  const summaryStatus = allDraft ? 'draft' : allPublished ? 'published' : 'mixed';

                  return (
                    <Card key={`festival-${item.festivalNotingId}`} className="overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white py-0 shadow-[0_18px_48px_-40px_rgba(1,31,75,0.18)]">
                      {/* Festival Header — always visible */}
                      <button
                        type="button"
                        onClick={() => toggleFestival(item.festivalNotingId)}
                        className="w-full flex items-start gap-3 bg-[linear-gradient(180deg,#ffffff,rgba(247,249,252,0.96))] px-5 py-4 text-left transition-colors hover:bg-[linear-gradient(180deg,#ffffff,rgba(244,246,248,0.98))]"
                      >
                        {isExpanded
                          ? <ChevronDown className="h-5 w-5 text-sky-700 shrink-0" />
                          : <ChevronRight className="h-5 w-5 text-sky-700 shrink-0" />}
                        <Sparkles className="h-5 w-5 text-sky-700 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold tracking-[-0.03em] text-slate-900 truncate">
                              {item.meta.name}
                            </h3>
                            <Badge className="border border-fuchsia-100 bg-fuchsia-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-700">
                              Festival
                            </Badge>
                            <Badge className={`px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
                              summaryStatus === 'draft'
                                ? 'border border-slate-200 bg-slate-100 text-slate-700'
                                : summaryStatus === 'published'
                                  ? 'border border-sky-100 bg-sky-50 text-sky-700'
                                  : 'border border-amber-100 bg-amber-50 text-amber-700'
                            }`}>
                              {summaryStatus === 'mixed' ? 'Partial' : summaryStatus}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-sky-600" />
                              {formatDate(item.meta.startDate)} – {formatDate(item.meta.endDate)}
                            </span>
                            <span className="font-medium text-sky-700">
                              {item.events.length} sub-event{item.events.length !== 1 ? 's' : ''}
                            </span>
                            {item.meta.coordinator && (
                              <span className="text-slate-400">Coordinator: {item.meta.coordinator}</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Sub-Events — collapsible */}
                      {isExpanded && (
                        <div className="divide-y divide-slate-200 border-t border-slate-200">
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
        </section>
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
          ? 'p-5 transition-colors hover:bg-slate-50/80'
          : 'rounded-[1.35rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_48px_-40px_rgba(1,31,75,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_22px_52px_-42px_rgba(1,31,75,0.22)] sm:p-6'
      }
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
          <h3 className={`font-bold tracking-[-0.03em] text-slate-900 mb-2 ${nested ? 'text-base' : 'text-xl'}`}>
            {event.name}
          </h3>

          {/* Date & Venue */}
          <div className="mb-3 space-y-2">
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <Calendar className="h-4 w-4 text-sky-600" />
              <span>{formatDate(event.startDate)} - {formatDate(event.endDate)}</span>
            </div>

            {event.venue ? (
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <MapPin className="h-4 w-4 text-sky-600" />
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
            <div className="flex items-center gap-2 text-slate-700">
              <Users className="h-4 w-4 text-sky-600" />
              <span className="text-slate-500">Few seats left</span>
            </div>

            <div className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              event.paymentType === 'free'
                ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border border-sky-100 bg-sky-50 text-sky-700'
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
          <Button asChild variant="outline" size="default" className="w-full justify-start rounded-lg border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:text-slate-900">
            <Link href={`/events/${event.id}`}>
              <Eye className="h-4 w-4" />
              View
            </Link>
          </Button>

          {event.status === 'draft' && (
            <Button asChild variant="default" size="default" className="w-full justify-start">
              <Link href={`/events/${event.id}/manage`}>
                <Edit className="h-4 w-4" />
                Complete & Publish
              </Link>
            </Button>
          )}

          <Button asChild variant="default" size="default" className="w-full justify-start rounded-lg bg-slate-900 text-white shadow-sm hover:bg-slate-800">
            <Link href={`/events/${event.id}/management`}>
              <BarChart3 className="h-4 w-4" />
              Event Management
            </Link>
          </Button>

          {event.status !== 'draft' && (
            <>
              <Button asChild variant="outline" size="default" className="group w-full justify-start rounded-lg border-slate-300/90 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-ev-300 hover:bg-gradient-to-r hover:from-ev-50 hover:to-cyan-50 hover:text-slate-900 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ev-300 focus-visible:ring-offset-1">
                <Link href={`/events/${event.id}/manage`}>
                  <Settings className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                  <span className="truncate text-[13px] font-semibold tracking-tight">Event Edit/Publish/Republish</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="default" className="w-full justify-start rounded-lg border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:text-slate-900">
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