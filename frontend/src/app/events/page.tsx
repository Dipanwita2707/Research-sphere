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
  const debouncedSearch = useDebounce(searchInput, 300);
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
    setFilters((prev) => ({ ...prev, search: debouncedSearch || undefined }));
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!isAccessCheckLoading && !canBrowseEvents) {
      router.replace('/dashboard');
    }
  }, [canBrowseEvents, isAccessCheckLoading, router]);

  const enforcedFilters = React.useMemo<EventFilters>(
    () => ({ ...filters, status: 'published' }),
    [filters],
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
    filters.search,
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
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
          <PageHeaderSkeleton />
          <div className="mt-6">
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ev-page relative overflow-hidden pb-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden">
        <div className="absolute -left-20 top-0 h-52 w-52 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-indigo-200/25 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1450px] px-4 pt-0 sm:px-6 sm:pt-0 lg:px-8 lg:pt-0">
        <section className="overflow-visible rounded-[1.75rem] border border-white/70 bg-white/92 shadow-[0_24px_70px_-48px_rgba(1,31,75,0.35)] backdrop-blur-xl">
          <div className="space-y-5 px-5 pb-5 pt-2 sm:px-8 sm:pb-7 sm:pt-3 lg:px-10 lg:pb-10 lg:pt-3">
            <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(1,31,75,0.98),rgba(23,76,150,0.96))] py-0 text-white shadow-[0_18px_50px_-36px_rgba(1,31,75,0.48)]">
              <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border border-white/12 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-100">
                        Events
                      </Badge>
                      {liveCount > 0 ? (
                        <Badge className="border border-emerald-300/20 bg-emerald-300/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100">
                          {liveCount} live now
                        </Badge>
                      ) : null}
                    </div>

                    <CardTitle className="mt-3 text-2xl font-black tracking-[-0.04em] text-white sm:text-[2rem]">
                      Find live, upcoming, and open campus events in one place.
                    </CardTitle>
                    <CardDescription className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                      Browse published events, search quickly, apply filters, and open event details or festival lineups without extra steps.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Upcoming</p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">{upcomingCount}</p>
                    </div>
                    <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Free</p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">{freeCount}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-visible rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,rgba(248,250,252,0.96))] py-0 shadow-[0_18px_50px_-40px_rgba(1,31,75,0.22)]">
              <CardHeader className="gap-3 border-b border-slate-200/80 px-5 py-3 sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold tracking-[-0.03em] text-slate-900 sm:text-xl">
                      Browse events
                    </CardTitle>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">
                      {pagination.total} total
                    </Badge>
                    {activeFilterCount > 0 ? (
                      <Badge className="border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
                        {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                    {isClubChairperson ? (
                      <Badge className="border border-fuchsia-100 bg-fuchsia-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-fuchsia-700">
                        Club chairperson
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-5 py-4 sm:px-6">
                <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
                  <div className="relative w-full lg:w-[250px] xl:w-[300px] 2xl:flex-1">
                    <Search className="pointer-events-none absolute left-3 w-4 h-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search events"
                      className="h-10 w-full rounded-lg border-slate-300 bg-white pl-10 pr-4 text-sm font-medium text-slate-800 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-300/80 focus-visible:ring-offset-1 placeholder:font-normal placeholder:text-slate-500"
                    />
                  </div>

                  <div className="w-full lg:w-[205px] xl:w-[220px]">
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
                      <SelectTrigger className="h-10 w-full rounded-lg border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-300/80 focus-visible:ring-offset-1">
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

                  <div className="w-full lg:w-[205px] xl:w-[220px]">
                    <Select
                      value={registrationDayFilter}
                      onValueChange={(value) => {
                        setRegistrationDayFilter(value as 'all' | DayPhase);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-lg border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-300/80 focus-visible:ring-offset-1">
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

                  <div className="w-full lg:w-[205px] xl:w-[220px]">
                    <Select
                      value={eventDayFilter}
                      onValueChange={(value) => {
                        setEventDayFilter(value as 'all' | DayPhase);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="h-10 w-full rounded-lg border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-300/80 focus-visible:ring-offset-1">
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
                      variant="ghost"
                      size="lg"
                      onClick={resetFilters}
                      className="h-10 rounded-lg px-3.5 text-slate-600 hover:text-slate-900 text-sm whitespace-nowrap shrink-0"
                    >
                      <X data-icon="inline-start" className="mr-1.5 h-4 w-4" />
                      Clear
                    </Button>
                  ) : null}
                </form>

              </CardContent>
            </Card>

            

            {isLoading ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <CardSkeleton key={index} className="h-[280px]" />
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <Card className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 py-0 text-center shadow-[0_24px_60px_-42px_rgba(1,31,75,0.22)]">
                <CardContent className="px-6 py-14">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50 text-sky-700">
                    <CalendarIcon className="h-8 w-8" />
                  </div>
                  <h3 className="mt-5 text-2xl font-black tracking-[-0.04em] text-slate-900">
                    No events found
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
                    No events match the current search or filter combination. Reset the filters and try a broader query.
                  </p>
                  <div className="mt-6 flex justify-center">
                    <Button onClick={resetFilters} size="lg" className="rounded-full px-5">
                      Reset filters
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-600">
                      Event feed
                    </p>
                    <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-slate-900 sm:text-2xl">
                      {pagination.total} result{pagination.total === 1 ? '' : 's'} available
                    </h2>
                  </div>

                  {festivalIds.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={toggleAll}
                      className="rounded-full border-slate-200 px-4"
                    >
                      {allExpanded ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
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
                          <Card className="overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white py-0 shadow-[0_18px_48px_-40px_rgba(1,31,75,0.18)]">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex w-full items-center gap-4 bg-[linear-gradient(180deg,#ffffff,rgba(247,249,252,0.96))] px-5 py-5 text-left transition hover:bg-[linear-gradient(180deg,#ffffff,rgba(241,246,250,0.96))] sm:px-6"
                              >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-bold tracking-[-0.03em] text-slate-900 sm:text-xl">
                                      {item.meta?.name}
                                    </h3>
                                    <Badge className="border border-fuchsia-100 bg-fuchsia-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-700">
                                      Festival
                                    </Badge>
                                  </div>
                                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                                    <span className="inline-flex items-center gap-1.5">
                                      <Calendar className="h-4 w-4 text-sky-600" />
                                      {formatDate(item.meta?.startDate || '')} - {formatDate(item.meta?.endDate || '')}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <Users className="h-4 w-4 text-sky-600" />
                                      {item.events?.length} linked event{(item.events?.length || 0) > 1 ? 's' : ''}
                                    </span>
                                  </p>
                                  {item.meta?.description ? (
                                    <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-500">
                                      {item.meta.description}
                                    </p>
                                  ) : null}
                                </div>
                              </button>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <Separator className="bg-slate-200/80" />
                              <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
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
                  <Card className="rounded-[1.35rem] border border-slate-200/80 bg-white/88 py-0 shadow-[0_18px_40px_-36px_rgba(1,31,75,0.18)]">
                    <CardContent className="px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-500">
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
        </section>
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
      <Card className="h-full rounded-[1.25rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,rgba(248,250,252,0.96))] py-0 shadow-[0_18px_48px_-40px_rgba(1,31,75,0.2)] transition duration-200 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_24px_56px_-40px_rgba(1,31,75,0.24)]">
        <CardHeader className="px-5 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
                  isRegistrationOpen
                    ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                    : 'border border-rose-100 bg-rose-50 text-rose-700'
                }`}
              >
                Registration {isRegistrationOpen ? 'Open' : 'Closed'}
              </Badge>
              <Badge
                className={`px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
                  eventPhase === 'live'
                    ? 'border border-amber-100 bg-amber-50 text-amber-700'
                    : eventPhase === 'upcoming'
                      ? 'border border-sky-100 bg-sky-50 text-sky-700'
                      : 'border border-slate-200 bg-slate-100 text-slate-700'
                }`}
              >
                Event {eventPhase === 'live' ? 'Live' : eventPhase === 'upcoming' ? 'Upcoming' : 'End'}
              </Badge>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Calendar className="h-4 w-4" />
            </div>
          </div>

          <CardTitle className="mt-2.5 line-clamp-2 text-[1.7rem] font-black leading-[1.05] tracking-[-0.045em] text-slate-900">
            {event.name}
          </CardTitle>
          <CardDescription className="mt-2 flex flex-wrap items-center gap-2 text-[1rem] font-medium text-slate-500">
            <span className="text-slate-600">{EVENT_TYPE_LABELS[event.eventType]}</span>
            {event.festivalMeta?.name ? (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">{event.festivalMeta.name}</span>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/80 bg-white/85 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Event Start-End</p>
              <p className="mt-2 text-[0.98rem] font-bold leading-tight text-slate-900">{eventStartDateTime}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">to {eventEndDateTime}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/85 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Registration Start-End</p>
              <p className="mt-2 text-[0.98rem] font-bold leading-tight text-slate-900">{registrationStartDateTime}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">to {registrationEndDateTime}</p>
            </div>
          </div>

          <div className="space-y-3 text-[1.02rem] text-slate-600">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4.5 w-4.5 shrink-0 text-sky-600" />
              <span className="line-clamp-1 leading-6">{event.venue || 'Venue update soon'}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-4.5 w-4.5 shrink-0 text-sky-600" />
              <span className="capitalize leading-6">
                {event.participationType}
                {event.participationType === 'team' ? ` • ${event.minTeamSize}-${event.maxTeamSize} members` : ' registration'}
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <WalletCards className="mt-0.5 h-4.5 w-4.5 shrink-0 text-sky-600" />
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

        <CardFooter className="mt-auto flex items-center justify-between border-t border-slate-200/80 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
              event.paymentType === 'free'
                ? 'border border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border border-sky-100 bg-sky-50 text-sky-700'
            }`}>
              {event.paymentType === 'free' ? 'Free entry' : `₹${event.registrationFee}`}
            </Badge>
            {event.certificateAvailable ? (
              <Badge className="border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
                Certificate
              </Badge>
            ) : null}
          </div>

          <div className="inline-flex items-center gap-1 text-base font-bold text-sgt-700">
            View event
            <ArrowRight className="h-4 w-4" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
