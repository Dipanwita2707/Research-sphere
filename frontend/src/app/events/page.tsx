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
import { EVENT_TYPE_LABELS, STATUS_CONFIG } from '@/features/event-management/constants';
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
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<EventFilters>({});
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

  const { data: result, isLoading, error } = useEvents(filters, page, 20, canBrowseEvents);
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

  const groupedItems = React.useMemo(() => groupBrowseEvents(prioritizedEvents), [prioritizedEvents]);
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
    setPage(1);
  };

  const liveCount = events.filter(isEventOngoing).length;
  const upcomingCount = events.filter((event) => event.status === 'published' && isEventUpcoming(event)).length;
  const freeCount = events.filter((event) => event.paymentType === 'free').length;
  const activeFilterCount = [filters.status, filters.eventType, filters.search].filter(Boolean).length;
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
        <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/92 shadow-[0_24px_70px_-48px_rgba(1,31,75,0.35)] backdrop-blur-xl">
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

            <Card className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,rgba(248,250,252,0.96))] py-0 shadow-[0_18px_50px_-40px_rgba(1,31,75,0.22)]">
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

              <CardContent className="space-y-3 px-5 py-4 sm:px-6">
                <form onSubmit={handleSearch} className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search events"
                      className="h-10 rounded-lg border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setShowFilters((prev) => !prev)}
                    className="h-10 rounded-lg border-slate-200 px-4 text-sm"
                  >
                    <Filter data-icon="inline-start" />
                    {showFilters ? 'Hide filters' : 'Filters'}
                  </Button>

                  {activeFilterCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      onClick={resetFilters}
                      className="h-10 rounded-lg px-4 text-slate-600 hover:text-slate-900 text-sm"
                    >
                      <X data-icon="inline-start" />
                      Clear all
                    </Button>
                  ) : null}
                </form>

                <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                          Status
                        </label>
                        <Select
                          value={filters.status || 'all'}
                          onValueChange={(value) => {
                            setFilters((prev) => ({
                              ...prev,
                              status: value === 'all' ? undefined : (value as EventFilters['status']),
                            }));
                            setPage(1);
                          }}
                        >
                          <SelectTrigger className="h-10 w-full rounded-lg border-slate-200 bg-white px-4 text-sm">
                            <SelectValue placeholder="All statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                          Event type
                        </label>
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
                          <SelectTrigger className="h-10 w-full rounded-lg border-slate-200 bg-white px-4 text-sm">
                            <SelectValue placeholder="All event types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All event types</SelectItem>
                            {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

              </CardContent>
            </Card>

            

            {isLoading ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <CardSkeleton key={index} className="h-[280px]" />
                ))}
              </div>
            ) : events.length === 0 ? (
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
                              isEventUpcoming={isEventUpcoming}
                              isEventOngoing={isEventOngoing}
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
                                      isEventUpcoming={isEventUpcoming}
                                      isEventOngoing={isEventOngoing}
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
  isEventUpcoming,
  isEventOngoing,
  handlePrefetch,
}: {
  event: Event;
  formatDate: (d: string) => string;
  isEventUpcoming: (e: Event) => boolean;
  isEventOngoing: (e: Event) => boolean;
  handlePrefetch: (id: string) => void;
}) {
  const publicRegistrationCount = event.currentRegistrations || 0;
  const shouldRevealRegistrationCount = publicRegistrationCount >= 100;
  const remainingSeats = event.maxCapacity
    ? Math.max(0, event.maxCapacity - publicRegistrationCount)
    : null;
  const registrationHeadline = shouldRevealRegistrationCount
    ? event.maxCapacity
      ? `${publicRegistrationCount}/${event.maxCapacity} joined`
      : `${publicRegistrationCount}+ joined`
    : 'Few seats left';
  const registrationSubline = shouldRevealRegistrationCount
    ? remainingSeats !== null
      ? `${remainingSeats} spots left`
      : 'Unlimited capacity'
    : event.maxCapacity
      ? `Capacity ${event.maxCapacity}`
      : 'Unlimited capacity';
  const totalPrizePool = event.prizes?.reduce((sum, prize) => sum + (prize.prizeAmount || 0), 0) || 0;

  return (
    <Link href={`/events/${event.id}`} onMouseEnter={() => handlePrefetch(event.id)} className="block">
      <Card className="h-full rounded-[1.25rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,rgba(248,250,252,0.96))] py-0 shadow-[0_18px_48px_-40px_rgba(1,31,75,0.2)] transition duration-200 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_24px_56px_-40px_rgba(1,31,75,0.24)]">
        <CardHeader className="px-5 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge className={`${STATUS_CONFIG[event.status]?.color || 'bg-slate-100 text-slate-700'} border-0 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]`}>
                {STATUS_CONFIG[event.status]?.label || event.status}
              </Badge>
              {isEventUpcoming(event) && event.status === 'published' ? (
                <Badge className="border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                  Upcoming
                </Badge>
              ) : null}
              {isEventOngoing(event) ? (
                <Badge className="border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
                  Live now
                </Badge>
              ) : null}
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
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Timeline</p>
              <p className="mt-2 text-[1.05rem] font-bold leading-tight text-slate-900">{formatDate(event.startDate)}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                {event.startDate !== event.endDate ? `to ${formatDate(event.endDate)}` : 'Single day event'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/85 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Availability</p>
              <p className="mt-2 text-[1.05rem] font-bold leading-tight text-slate-900">{registrationHeadline}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">{registrationSubline}</p>
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
