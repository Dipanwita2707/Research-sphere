'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, Users, Search, Filter, X, Calendar as CalendarIcon, Eye } from 'lucide-react';
import { useEvents } from '@/features/event-management/hooks/useEvents';
import type { Event, EventFilters } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EVENT_TYPE_LABELS, STATUS_CONFIG } from '@/features/event-management/constants';

export default function EventsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<EventFilters>({});
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch || undefined }));
    setPage(1);
  }, [debouncedSearch]);

  const { data: result, isLoading, error } = useEvents(filters, page, 20);
  const events = result?.events ?? [];
  const pagination = result?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error) {
      const msg = getErrorMessage(error);
      if (lastErrorRef.current !== msg) {
        lastErrorRef.current = msg;
        toast({ type: 'error', message: msg });
      }
    } else {
      lastErrorRef.current = null;
    }
  }, [error, toast]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Debounce drives filter updates; prevent form reload
  };

  const resetFilters = () => {
    setSearchInput('');
    setFilters({});
    setPage(1);
    // Debounce will sync filters.search; clearing filters immediately for responsive UX
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isEventUpcoming = (event: Event) => {
    return new Date(event.startDate) > new Date();
  };

  const isEventOngoing = (event: Event) => {
    const now = new Date();
    return new Date(event.startDate) <= now && new Date(event.endDate) >= now;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Browse Events</h1>
          <p className="text-gray-600 dark:text-gray-400">Discover and join university events - workshops, seminars, competitions, and more</p>
        </div>

        {/* Info Banner */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2 sm:gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
                📝 Want to organize an event?
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Create a <Link href="/noting/new" className="underline font-semibold">noting request</Link> with event details. Once approved, your event will appear in <Link href="/events/my-events" className="underline font-semibold">My Created Events</Link> as a draft. Add venue and registration details, then publish to make it live!
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search events..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </form>
          
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <Filter className="h-5 w-5" />
              Filters
            </button>
            
            {(filters.status || filters.eventType || filters.search) && (
              <button
                onClick={resetFilters}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
              >
                <X className="h-5 w-5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, status: (e.target.value || undefined) as EventFilters['status'] }));
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                >
                  <option value="">All</option>
                  <option value="published">Published (Upcoming)</option>
                  <option value="ongoing">Ongoing (Live Now)</option>
                  <option value="completed">Completed (Past)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Event Type
                </label>
                <select
                  value={filters.eventType || ''}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, eventType: (e.target.value || undefined) as EventFilters['eventType'] }));
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                >
                  <option value="">All Types</option>
                  {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Events Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No events found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No events match your search criteria. Try adjusting your filters.
            </p>
            <button
              onClick={resetFilters}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt hover:shadow-sgt-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="p-4 sm:p-5 pt-4">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[event.status]?.color}`}>
                        {STATUS_CONFIG[event.status]?.label}
                      </span>
                      {isEventUpcoming(event) && event.status === 'published' && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Upcoming
                        </span>
                      )}
                      {isEventOngoing(event) && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                          Live
                        </span>
                      )}
                    </div>

                    {/* Event Name */}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                      {event.name}
                    </h3>

                    {/* Event Type */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {EVENT_TYPE_LABELS[event.eventType]}
                    </p>

                    {/* Date */}
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(event.startDate)}</span>
                      {event.startDate !== event.endDate && (
                        <>
                          <span>-</span>
                          <span>{formatDate(event.endDate)}</span>
                        </>
                      )}
                    </div>

                    {/* Venue */}
                    {event.venue && (
                      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{event.venue}</span>
                      </div>
                    )}

                    {/* Registrations */}
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
                      <Users className="h-4 w-4" />
                      <span>
                        {event.currentRegistrations}
                        {event.maxCapacity && ` / ${event.maxCapacity}`} registered
                      </span>
                    </div>

                    {/* Payment Type */}
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        event.paymentType === 'free'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {event.paymentType === 'free' ? 'Free' : `₹${event.registrationFee}`}
                      </span>
                      
                      <Eye className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
