'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Filter,
  MapPin,
  Search,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEvents, EVENT_QUERY_KEYS } from '@/features/event-management/hooks/useEvents';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, EventFilters } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { CardSkeleton, PageHeaderSkeleton } from '@/components/skeletons';
import { EventCardShimmer } from '@/components/shimmer';
import { EVENT_TYPE_LABELS } from '@/features/event-management/constants';
import { useAuthStore } from '@/shared/auth/authStore';
import { useMyClubs } from '@/features/dsw/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface BrowseGroupedItem {
  type: 'standalone' | 'festival';
  event?: Event;
  festivalNotingId?: string;
  meta?: {
    name: string;
    startDate: string;
    endDate: string;
    description?: string;
    coordinator?: string;
  };
  events?: Event[];
}

type DayPhase = 'live' | 'upcoming' | 'end';

function getEventDayPhase(event: Event, now: Date): DayPhase {
  const eventStartDate = new Date(event.startDate);
  const eventEndDate = new Date(event.endDate);

  if (eventEndDate < now) return 'end';
  if (eventStartDate > now) return 'upcoming';
  return 'live';
}

function getRegistrationDayPhase(event: Event, now: Date): DayPhase {
  if (event.status !== 'published') return 'end';

  const eventEndDate = new Date(event.endDate);
  const registrationStartDate = event.registrationStartDate ? new Date(event.registrationStartDate) : null;
  const registrationEndDate = event.registrationEndDate ? new Date(event.registrationEndDate) : null;

  if (eventEndDate < now) return 'end';
  if (registrationEndDate && registrationEndDate < now) return 'end';
  if (registrationStartDate && registrationStartDate > now) return 'upcoming';
  return 'live';
}

function groupBrowseEvents(eventList: Event[]): BrowseGroupedItem[] {
  const festivalMap: Record<string, Event[]> = {};
  const standalone: Event[] = [];

  for (const event of eventList) {
    if (event.festivalNotingId) {
      if (!festivalMap[event.festivalNotingId]) festivalMap[event.festivalNotingId] = [];
      festivalMap[event.festivalNotingId].push(event);
    } else {
      standalone.push(event);
    }
  }

  const items: BrowseGroupedItem[] = [];

  for (const festivalNotingId of Object.keys(festivalMap)) {
    const grouped = festivalMap[festivalNotingId];
    const meta = grouped[0]?.festivalMeta;
    items.push({
      type: 'festival',
      festivalNotingId,
      meta: meta || {
        name: 'Festival',
        startDate: grouped[0]?.startDate || '',
        endDate: grouped[0]?.endDate || '',
      },
      events: grouped,
    });
  }

  for (const event of standalone) {
    items.push({ type: 'standalone', event });
  }

  return items;
}

export default function EventsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<EventFilters>({});
  const [registrationDayFilter, setRegistrationDayFilter] = useState<'all' | DayPhase>('all');
  const [eventDayFilter, setEventDayFilter] = useState<'all' | DayPhase>('all');
  const debouncedSearch = useDebounce(searchInput, {
    delay: 300,
    onSettle: () => setPage(1),
  });
  const isStudent = user?.role?.name === 'student' || user?.userType === 'student';
  const { data: myClubsData } = useMyClubs();
  const isClubChairperson = !!(
    isStudent &&
    user?.id &&
    myClubsData?.data?.some((club) => club.chairpersonId === user.id && club.status === 'active')
  );
  const canBrowseEvents = true;
  const isAccessCheckLoading = false;

  const handlePrefetch = useCallback(
    (eventId: string) => {
      queryClient.prefetchQuery({
        queryKey: EVENT_QUERY_KEYS.detail(eventId),
        queryFn: () => eventService.getEventById(eventId),
        staleTime: 60 * 1000,
      });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!isAccessCheckLoading && !canBrowseEvents) {
      router.replace('/dashboard');
    }
  }, [canBrowseEvents, isAccessCheckLoading, router]);

  const enforcedFilters = React.useMemo<EventFilters>(
    () => ({ ...filters, search: debouncedSearch || undefined, status: 'published' }),
    [filters, debouncedSearch],
  );

  const { data: result, isLoading, error } = useEvents(enforcedFilters, page, 20, canBrowseEvents);
  const events = result?.events ?? [];
  const pagination = result?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };
  const lastErrorRef = useRef<string | null>(null);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const isEventUpcoming = (event: Event) => new Date(event.startDate) > new Date();

  const isEventOngoing = (event: Event) => {
    const now = new Date();
    return new Date(event.startDate) <= now && new Date(event.endDate) >= now;
  };

  const prioritizedEvents = React.useMemo(() => {
    return [...events].sort((left, right) => {
      const leftLive = isEventOngoing(left);
      const rightLive = isEventOngoing(right);

      if (leftLive !== rightLive) return leftLive ? -1 : 1;

      const leftUpcoming = isEventUpcoming(left);
      const rightUpcoming = isEventUpcoming(right);

      if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;

      return new Date(left.startDate).getTime() - new Date(right.startDate).getTime();
    });
  }, [events]);

  const filteredEvents = React.useMemo(() => {
    const now = new Date();

    return prioritizedEvents.filter((event) => {
      if (registrationDayFilter !== 'all' && getRegistrationDayPhase(event, now) !== registrationDayFilter) {
        return false;
      }

      if (eventDayFilter !== 'all' && getEventDayPhase(event, now) !== eventDayFilter) {
        return false;
      }

      return true;
    });
  }, [prioritizedEvents, registrationDayFilter, eventDayFilter]);

  const groupedItems = React.useMemo(() => groupBrowseEvents(filteredEvents), [filteredEvents]);
  const [expandedFestivals, setExpandedFestivals] = useState<Set<string>>(new Set());

  const toggleFestival = (festivalNotingId: string) => {
    setExpandedFestivals((prev) => {
      const next = new Set(prev);
      if (next.has(festivalNotingId)) next.delete(festivalNotingId);
      else next.add(festivalNotingId);
      return next;
    });
  };

  const festivalIds = React.useMemo(
    () => groupedItems.filter((item) => item.type === 'festival' && item.festivalNotingId).map((item) => item.festivalNotingId as string),
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

  useEffect(() => {
    if (error) {
      const message = getErrorMessage(error);
      if (lastErrorRef.current !== message) {
        lastErrorRef.current = message;
        toast({ type: 'error', message });
      }
    } else {
      lastErrorRef.current = null;
    }
  }, [error, toast]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const resetFilters = () => {
    setSearchInput('');
    setFilters({});
    setRegistrationDayFilter('all');
    setEventDayFilter('all');
    setPage(1);
  };

  const liveCount = events.filter(isEventOngoing).length;
  const upcomingCount = events.filter((event) => event.status === 'published' && isEventUpcoming(event)).length;
  const freeCount = events.filter((event) => event.paymentType === 'free').length;
  const activeFilterCount = [
    filters.eventType,
    debouncedSearch || undefined,
    registrationDayFilter !== 'all' ? registrationDayFilter : undefined,
    eventDayFilter !== 'all' ? eventDayFilter : undefined,
  ].filter(Boolean).length;
  const paginationWindowStart = Math.max(1, Math.min(page - 2, Math.max(1, pagination.totalPages - 4)));
  const visiblePages = Array.from(
    { length: Math.min(5, pagination.totalPages) },
    (_, index) => paginationWindowStart + index,
  );

  if (isAccessCheckLoading || !canBrowseEvents) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PageHeaderSkeleton />
          <div className="mt-6">
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 dark:bg-gray-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page header — TMS-style */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#011f4b] to-[#005b96] shadow-md">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#011f4b] dark:text-white">
                  Events
                </h1>
                <p className="mt-0.5 text-sm text-[#6497b1] dark:text-gray-400">
                  Browse published campus events, search, and filter by registration or event timing.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {liveCount > 0 ? (
                    <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {liveCount} live now
                    </span>
                  ) : null}
                  <span className="rounded-full border border-[#b3cde0]/60 bg-[#f8fafc] px-2.5 py-0.5 text-[11px] font-semibold text-[#03396c] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {upcomingCount} upcoming
                  </span>
                  <span className="rounded-full border border-[#b3cde0]/60 bg-[#f8fafc] px-2.5 py-0.5 text-[11px] font-semibold text-[#03396c] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {freeCount} free
                  </span>
                  {isClubChairperson ? (
                    <span className="rounded-full border border-fuchsia-200/80 bg-fuchsia-50 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-300">
                      Club chairperson
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6497b1] dark:text-gray-400">
              <span className="font-semibold text-[#03396c] dark:text-gray-300">{pagination.total} total</span>
              {activeFilterCount > 0 ? (
                <span>
                  · {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                </span>
              ) : null}
            </div>
          </div>
          <div
            className="mt-3 h-0.5 rounded-full bg-gradient-to-r from-[#005b96] via-[#b3cde0] to-transparent"
            aria-hidden
          />
        </div>

        {/* Search & filters — TMS filter card */}
        <div
          className="mb-6 rounded-2xl border border-[#b3cde0]/40 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
          style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}
        >
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#005b96]" />
            <span className="text-sm font-semibold text-[#03396c] dark:text-gray-200">
              Search &amp; filters
            </span>
          </div>
          <form onSubmit={handleSearch} className="flex flex-col flex-wrap gap-3 lg:flex-row lg:items-stretch">
                  <div className="relative min-w-0 flex-1 lg:min-w-[200px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6497b1]" />
                    <Input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search events"
                      className="h-10 w-full rounded-xl border border-[#b3cde0]/60 bg-[#f8fafc] pl-9 pr-4 text-sm text-[#011f4b] shadow-none transition-all placeholder:text-[#6497b1]/60 focus-visible:border-[#005b96] focus-visible:ring-2 focus-visible:ring-[#005b96]/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="w-full min-w-[180px] lg:w-[200px]">
                    <Select
                      value={filters.eventType || 'all'}
                      onValueChange={(value) => {
                        setFilters((prev) => ({
                          ...prev,
                          eventType: value === 'all' ? undefined : (value as EventFilters['eventType']),
                        }));
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border border-[#b3cde0]/60 bg-[#f8fafc] px-3 text-sm text-[#03396c] shadow-none focus:ring-2 focus:ring-[#005b96]/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
                        <SelectValue placeholder="All event types" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        avoidCollisions={false}
                        sideOffset={8}
                        className="z-[120] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] rounded-xl border border-slate-200 bg-white/98 p-1.5 shadow-[0_20px_45px_-20px_rgba(2,18,48,0.38)] backdrop-blur-sm"
                      >
                        <SelectItem value="all" className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">All event types</SelectItem>
                        {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value} className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full min-w-[180px] lg:w-[200px]">
                    <Select
                      value={registrationDayFilter}
                      onValueChange={(value) => {
                        setRegistrationDayFilter(value as 'all' | DayPhase);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border border-[#b3cde0]/60 bg-[#f8fafc] px-3 text-sm text-[#03396c] shadow-none focus:ring-2 focus:ring-[#005b96]/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
                        <SelectValue placeholder="Registration day" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        avoidCollisions={false}
                        sideOffset={8}
                        className="z-[120] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] rounded-xl border border-slate-200 bg-white/98 p-1.5 shadow-[0_20px_45px_-20px_rgba(2,18,48,0.38)] backdrop-blur-sm"
                      >
                        <SelectItem value="all" className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">Registration day: All</SelectItem>
                        <SelectItem value="live" className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">Registration day: Live</SelectItem>
                        <SelectItem value="upcoming" className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">Registration day: Upcoming</SelectItem>
                        <SelectItem value="end" className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">Registration day: End</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full min-w-[180px] lg:w-[200px]">
                    <Select
                      value={eventDayFilter}
                      onValueChange={(value) => {
                        setEventDayFilter(value as 'all' | DayPhase);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border border-[#b3cde0]/60 bg-[#f8fafc] px-3 text-sm text-[#03396c] shadow-none focus:ring-2 focus:ring-[#005b96]/30 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
                        <SelectValue placeholder="Event day" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        avoidCollisions={false}
                        sideOffset={8}
                        className="z-[120] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] rounded-xl border border-slate-200 bg-white/98 p-1.5 shadow-[0_20px_45px_-20px_rgba(2,18,48,0.38)] backdrop-blur-sm"
                      >
                        <SelectItem value="all" className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">Event day: All</SelectItem>
                        <SelectItem value="live" className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">Event day: Live</SelectItem>
                        <SelectItem value="upcoming" className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">Event day: Upcoming</SelectItem>
                        <SelectItem value="end" className="min-h-9 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium outline-none transition-all focus:bg-blue-100 focus:text-slate-900 data-[highlighted]:bg-blue-100 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-50 data-[state=checked]:font-semibold data-[state=checked]:text-sky-700">Event day: End</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {activeFilterCount > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={resetFilters}
                      className="h-10 shrink-0 rounded-xl border border-[#005b96]/20 bg-[#005b96]/10 px-4 text-sm font-medium text-[#005b96] hover:bg-[#005b96]/20 dark:border-[#6497b1]/30 dark:bg-[#005b96]/15 dark:text-[#b3cde0]"
                    >
                      <X className="mr-1.5 h-4 w-4" />
                      Clear filters
                    </Button>
                  ) : null}
                </form>
        </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <EventCardShimmer key={i} />
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div
                className="rounded-2xl border border-[#b3cde0]/40 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-800"
                style={{ boxShadow: '0 2px 16px 0 rgba(0, 91, 150, 0.07)' }}
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b3cde0]/20">
                  <CalendarIcon className="h-7 w-7 text-[#6497b1]" />
                </div>
                <p className="font-semibold text-[#03396c] dark:text-gray-200">No events found</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-[#6497b1] dark:text-gray-400">
                  No events match the current search or filters. Try resetting filters or a broader search.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={resetFilters}
                    className="rounded-xl bg-[#005b96] px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-[#005b96]/20 hover:bg-[#03396c]"
                  >
                    Reset filters
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6497b1]">Event feed</p>
                    <h2 className="mt-0.5 text-lg font-bold text-[#011f4b] dark:text-white sm:text-xl">
                      {pagination.total} result{pagination.total === 1 ? '' : 's'}
                    </h2>
                  </div>

                  {festivalIds.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={toggleAll}
                      className="rounded-xl border-[#b3cde0]/60 bg-white text-[#03396c] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    >
                      {allExpanded ? <ChevronDown className="mr-1.5 h-4 w-4" /> : <ChevronRight className="mr-1.5 h-4 w-4" />}
                      {allExpanded ? 'Collapse festivals' : 'Expand festivals'}
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-6">
                  {(() => {
                    const elements: React.ReactNode[] = [];
                    let standaloneBuffer: Event[] = [];

                    const flushStandalone = () => {
                      if (standaloneBuffer.length === 0) return;

                      elements.push(
                        <div key={`standalone-${standaloneBuffer[0].id}`} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                          {standaloneBuffer.map((event) => (
                            <BrowseEventCard
                              key={event.id}
                              event={event}
                              formatDate={formatDate}
                              handlePrefetch={handlePrefetch}
                            />
                          ))}
                        </div>
                      );
                      standaloneBuffer = [];
                    };

                    for (const item of groupedItems) {
                      if (item.type === 'standalone') {
                        if (item.event) {
                          standaloneBuffer.push(item.event);
                        }
                        continue;
                      }

                      flushStandalone();

                      if (!item.festivalNotingId) {
                        continue;
                      }

                      const festivalId = item.festivalNotingId;
                      const isExpanded = expandedFestivals.has(festivalId);
                      elements.push(
                        <Collapsible
                          key={`festival-${festivalId}`}
                          open={isExpanded}
                          onOpenChange={() => toggleFestival(festivalId)}
                        >
                          <Card
                            className="overflow-hidden rounded-2xl border border-[#b3cde0]/40 bg-white py-0 dark:border-gray-700 dark:bg-gray-800"
                            style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}
                          >
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex w-full items-center gap-4 bg-[#f8fafc]/80 px-5 py-5 text-left transition hover:bg-[#b3cde0]/10 dark:bg-gray-800/80 dark:hover:bg-gray-700/50 sm:px-6"
                              >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b3cde0]/25 text-[#005b96] dark:bg-[#011f4b]/40 dark:text-[#6497b1]">
                                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-bold text-[#011f4b] dark:text-white sm:text-xl">
                                      {item.meta?.name}
                                    </h3>
                                    <Badge className="border border-fuchsia-200/80 bg-fuchsia-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-300">
                                      Festival
                                    </Badge>
                                  </div>
                                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6497b1] dark:text-gray-400">
                                    <span className="inline-flex items-center gap-1.5">
                                      <Calendar className="h-4 w-4 text-[#005b96]" />
                                      {formatDate(item.meta?.startDate || '')} - {formatDate(item.meta?.endDate || '')}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <Users className="h-4 w-4 text-[#005b96]" />
                                      {item.events?.length} linked event{(item.events?.length || 0) > 1 ? 's' : ''}
                                    </span>
                                  </p>
                                  {item.meta?.description ? (
                                    <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-[#03396c]/80 dark:text-gray-400">
                                      {item.meta.description}
                                    </p>
                                  ) : null}
                                </div>
                              </button>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <Separator className="bg-[#b3cde0]/30 dark:bg-gray-600" />
                              <CardContent className="bg-white px-5 py-5 dark:bg-gray-800 sm:px-6 sm:py-6">
                                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                  {item.events?.map((event) => (
                                    <BrowseEventCard
                                      key={event.id}
                                      event={event}
                                      formatDate={formatDate}
                                      handlePrefetch={handlePrefetch}
                                    />
                                  ))}
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      );
                    }

                    flushStandalone();
                    return elements;
                  })()}
                </div>

                {pagination.totalPages > 1 ? (
                  <Card
                    className="mt-6 rounded-2xl border border-[#b3cde0]/40 bg-white py-0 dark:border-gray-700 dark:bg-gray-800"
                    style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}
                  >
                    <CardContent className="px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-[#6497b1] dark:text-gray-400">
                          Page {pagination.page} of {pagination.totalPages}
                        </p>

                        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (page > 1) setPage((current) => Math.max(1, current - 1));
                                }}
                                className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                              />
                            </PaginationItem>

                            {visiblePages.map((pageNumber) => {
                              return (
                                <PaginationItem key={pageNumber}>
                                  <PaginationLink
                                    href="#"
                                    isActive={page === pageNumber}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setPage(pageNumber);
                                    }}
                                  >
                                    {pageNumber}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            })}

                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (page < pagination.totalPages) {
                                    setPage((current) => Math.min(pagination.totalPages, current + 1));
                                  }
                                }}
                                className={page === pagination.totalPages ? 'pointer-events-none opacity-50' : ''}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            )}
      </div>
    </div>
  );
}

function BrowseEventCard({
  event,
  formatDate,
  handlePrefetch,
}: {
  event: Event;
  formatDate: (d: string) => string;
  handlePrefetch: (id: string) => void;
}) {
  const formatDateTime = (dateValue?: string | null) => {
    if (!dateValue) return 'Not set';

    return new Date(dateValue).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const eventStartDateTime = formatDateTime(event.startDate);
  const eventEndDateTime = formatDateTime(event.endDate);
  const registrationStartDateTime = formatDateTime(event.registrationStartDate);
  const registrationEndDateTime = formatDateTime(event.registrationEndDate);
  const now = new Date();
  const registrationPhase = getRegistrationDayPhase(event, now);
  const eventPhase = getEventDayPhase(event, now);
  const isRegistrationOpen = registrationPhase === 'live';
  const totalPrizePool = event.prizes?.reduce((sum, prize) => sum + (prize.prizeAmount || 0), 0) || 0;

  return (
    <Link href={`/events/${event.id}`} onMouseEnter={() => handlePrefetch(event.id)} className="block">
      <Card
        className="h-full rounded-2xl border border-[#b3cde0]/40 bg-[#f8fafc]/80 py-0 transition duration-200 hover:border-[#6497b1] dark:border-gray-600 dark:bg-gray-900/50"
        style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}
      >
        <CardHeader className="px-5 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  isRegistrationOpen
                    ? 'border border-emerald-200/80 bg-emerald-50 text-emerald-800'
                    : 'border border-rose-200/80 bg-rose-50 text-rose-800'
                }`}
              >
                Registration {isRegistrationOpen ? 'Open' : 'Closed'}
              </Badge>
              <Badge
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  eventPhase === 'live'
                    ? 'border border-amber-200/80 bg-amber-50 text-amber-800'
                    : eventPhase === 'upcoming'
                      ? 'border border-[#b3cde0]/80 bg-[#b3cde0]/20 text-[#03396c]'
                      : 'border border-slate-200 bg-slate-100 text-slate-700'
                }`}
              >
                Event {eventPhase === 'live' ? 'Live' : eventPhase === 'upcoming' ? 'Upcoming' : 'End'}
              </Badge>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b3cde0]/25 text-[#005b96]">
              <Calendar className="h-4 w-4" />
            </div>
          </div>

          <CardTitle className="mt-2.5 line-clamp-2 text-lg font-bold leading-snug tracking-tight text-[#011f4b] dark:text-white sm:text-xl">
            {event.name}
          </CardTitle>
          <CardDescription className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-[#6497b1] dark:text-gray-400">
            <span className="text-[#03396c] dark:text-gray-300">{EVENT_TYPE_LABELS[event.eventType]}</span>
            {event.festivalMeta?.name ? (
              <>
                <span className="text-[#b3cde0]">•</span>
                <span>{event.festivalMeta.name}</span>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#b3cde0]/40 bg-white p-3 dark:border-gray-600 dark:bg-gray-800/80">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#6497b1]">Event Start-End</p>
              <p className="mt-2 text-sm font-bold leading-tight text-[#011f4b] dark:text-white">{eventStartDateTime}</p>
              <p className="mt-1 text-sm leading-5 text-[#6497b1] dark:text-gray-400">to {eventEndDateTime}</p>
            </div>

            <div className="rounded-xl border border-[#b3cde0]/40 bg-white p-3 dark:border-gray-600 dark:bg-gray-800/80">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#6497b1]">Registration Start-End</p>
              <p className="mt-2 text-sm font-bold leading-tight text-[#011f4b] dark:text-white">{registrationStartDateTime}</p>
              <p className="mt-1 text-sm leading-5 text-[#6497b1] dark:text-gray-400">to {registrationEndDateTime}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-[#03396c] dark:text-gray-300">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#005b96]" />
              <span className="line-clamp-1 leading-6">{event.venue || 'Venue update soon'}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#005b96]" />
              <span className="capitalize leading-6">
                {event.participationType}
                {event.participationType === 'team' ? ` • ${event.minTeamSize}-${event.maxTeamSize} members` : ' registration'}
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <WalletCards className="mt-0.5 h-4 w-4 shrink-0 text-[#005b96]" />
              <span className="leading-6">
                {totalPrizePool > 0
                  ? `Prize pool ₹${totalPrizePool.toLocaleString()}`
                  : event.certificateAvailable
                    ? 'Certificate reward included'
                    : 'Reward details soon'}
              </span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="mt-auto flex items-center justify-between border-t border-[#b3cde0]/30 px-5 py-4 dark:border-gray-600">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                event.paymentType === 'free'
                  ? 'border border-emerald-200/80 bg-emerald-50 text-emerald-800'
                  : 'border border-[#b3cde0]/80 bg-[#b3cde0]/15 text-[#03396c]'
              }`}
            >
              {event.paymentType === 'free' ? 'Free entry' : `₹${event.registrationFee}`}
            </Badge>
            {event.certificateAvailable ? (
              <Badge className="border border-amber-200/80 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                Certificate
              </Badge>
            ) : null}
          </div>

          <div className="inline-flex items-center gap-1 text-sm font-bold text-[#005b96] dark:text-[#6497b1]">
            View event
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
