'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  History,
  LogIn,
  LogOut,
  XCircle,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Download,
  Shield,
  Hash,
  Mail,
  Tag,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt';

interface ActivityEntry {
  id: string;
  eventId: string;
  registrationId: string;
  entryType: 'entry' | 'exit';
  scannedAt: string;
  gateLocation?: string;
  remarks?: string;
  event?: {
    id: string;
    eventId: string;
    name: string;
    eventType: string;
    venue?: string;
    startDate: string;
    endDate: string;
  };
  participant: {
    id?: string;
    uid?: string;
    email?: string;
    name: string;
    registrationNo?: string;
  };
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  seminar: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  workshop: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  fest: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  conference: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  competition: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  cultural: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  technical: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  sports: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export default function VolunteerActivityPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'entry' | 'exit'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Unique events for filter dropdown
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const data = await eventService.getMyVolunteerAssignments();
        setAssignments(data);
      } catch {
        // Non-critical
      }
    };
    fetchAssignments();
  }, []);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (eventFilter) filters.eventId = eventFilter;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await eventService.getMyVolunteerActivity(page, 20, filters);
      setEntries(result.entries || []);
      setPagination(result.pagination || { total: 0, totalPages: 0 });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [page, eventFilter, startDate, endDate, toast]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Client-side search + type filter
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch =
        !search ||
        e.participant.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.participant.uid && e.participant.uid.toLowerCase().includes(search.toLowerCase())) ||
        (e.participant.registrationNo && e.participant.registrationNo.toLowerCase().includes(search.toLowerCase())) ||
        (e.event?.name && e.event.name.toLowerCase().includes(search.toLowerCase()));
      const matchesType = typeFilter === 'all' || e.entryType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [entries, search, typeFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalEntries = entries.filter((e) => e.entryType === 'entry').length;
    const totalExits = entries.filter((e) => e.entryType === 'exit').length;
    const uniqueEvents = new Set(entries.map((e) => e.eventId)).size;
    const uniqueParticipants = new Set(entries.map((e) => e.participant.uid)).size;
    return { totalEntries, totalExits, total: entries.length, uniqueEvents, uniqueParticipants };
  }, [entries]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDateTime = (dateString: string) => {
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
  };

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {};
    filteredEntries.forEach((entry) => {
      const date = new Date(entry.scannedAt).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(entry);
    });
    return groups;
  }, [filteredEntries]);

  const resetFilters = () => {
    setSearch('');
    setEventFilter('');
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasActiveFilters = search || eventFilter || typeFilter !== 'all' || startDate || endDate;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/events/volunteer"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Volunteer Dashboard
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-gradient-to-br from-sgt-600 to-blue-600 rounded-xl">
                  <History className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Activity History</h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Complete record of all your volunteer check-in and check-out scans
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Scans', value: pagination.total, icon: History, color: 'from-blue-500 to-blue-600' },
            { label: 'Check-ins', value: stats.totalEntries, icon: LogIn, color: 'from-green-500 to-green-600' },
            { label: 'Check-outs', value: stats.totalExits, icon: LogOut, color: 'from-indigo-500 to-indigo-600' },
            { label: 'Events', value: stats.uniqueEvents, icon: Calendar, color: 'from-amber-500 to-amber-600' },
          ].map((stat) => (
            <div key={stat.label} className={CARD + ' p-4'}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filters */}
        <div className={CARD + ' p-4 mb-6'}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by participant name, UID, or event..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-600"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Types</option>
                <option value="entry">Check-ins Only</option>
                <option value="exit">Check-outs Only</option>
              </select>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center gap-2 text-sm transition-colors ${showFilters ? 'bg-sgt-50 dark:bg-sgt-900/20 border-sgt-300' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-3 py-2.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Event
                </label>
                <select
                  value={eventFilter}
                  onChange={(e) => { setEventFilter(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">All Events</option>
                  {assignments.map((a: any) => (
                    <option key={a.eventId} value={a.eventId}>
                      {a.event?.name || a.eventId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Activity List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Skeleton className="w-8 h-8 rounded-sm" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className={CARD + ' p-12 text-center'}>
            <History className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {hasActiveFilters ? 'No matching activity' : 'No Activity Yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : "Once you start scanning QR codes at events, your activity history will appear here."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 text-sm bg-sgt-600 text-white rounded-lg hover:bg-sgt-700 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Grouped by Date */}
            <div className="space-y-6">
              {Object.entries(groupedEntries).map(([date, dateEntries]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg">
                      <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{date}</h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500">({dateEntries.length} scans)</span>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  </div>

                  {/* Entries for this date */}
                  <div className="space-y-3">
                    {dateEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`${CARD} p-4 hover:shadow-sgt-lg transition-shadow`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Entry type icon */}
                          <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                            entry.entryType === 'entry'
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                            {entry.entryType === 'entry' ? (
                              <LogIn className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <LogOut className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="font-semibold text-gray-900 dark:text-white">
                                    {entry.participant.name}
                                  </p>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    entry.entryType === 'entry'
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  }`}>
                                    {entry.entryType === 'entry' ? 'CHECK-IN' : 'CHECK-OUT'}
                                  </span>
                                </div>

                                {/* Participant details */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {entry.participant.uid && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {entry.participant.uid}
                                    </span>
                                  )}
                                  {entry.participant.registrationNo && (
                                    <span className="flex items-center gap-1">
                                      <Hash className="h-3 w-3" />
                                      {entry.participant.registrationNo}
                                    </span>
                                  )}
                                  {entry.participant.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {entry.participant.email}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Time */}
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {formatTime(entry.scannedAt)}
                                </p>
                              </div>
                            </div>

                            {/* Event + Gate info */}
                            <div className="flex flex-wrap items-center gap-2 mt-2.5">
                              {entry.event && (
                                <Link
                                  href={`/events/volunteer/${entry.event.id}`}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                  <Calendar className="h-3 w-3" />
                                  {entry.event.name}
                                </Link>
                              )}
                              {entry.event?.eventType && (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${EVENT_TYPE_COLORS[entry.event.eventType] || EVENT_TYPE_COLORS.other}`}>
                                  {entry.event.eventType.charAt(0).toUpperCase() + entry.event.eventType.slice(1)}
                                </span>
                              )}
                              {entry.gateLocation && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-750 rounded-full">
                                  <MapPin className="h-3 w-3" />
                                  {entry.gateLocation}
                                </span>
                              )}
                              {entry.remarks && (
                                <span className="text-xs text-gray-400 italic">&ldquo;{entry.remarks}&rdquo;</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, pagination.total)} of {pagination.total} entries
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                            page === pageNum
                              ? 'bg-sgt-600 text-white'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page === pagination.totalPages}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
