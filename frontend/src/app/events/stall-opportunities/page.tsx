'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar, MapPin, Clock, Store, ChevronRight, Search,
  AlertCircle, CheckCircle, XCircle, Clock3, Filter
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { StallOpportunity } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

type TabType = 'all' | 'upcoming' | 'ongoing' | 'past' | 'applied';

const TABS: { id: TabType; label: string }[] = [
  { id: 'all', label: 'All Events' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'applied', label: 'My Applications' },
  { id: 'past', label: 'Past' },
];

export default function StallOpportunitiesPage() {
  const { toast } = useToast();
  const [opportunities, setOpportunities] = useState<StallOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = () => {
    setLoading(true);
    eventService
      .getStallOpportunities()
      .then(setOpportunities)
      .catch(() => toast({ type: 'error', message: 'Failed to load stall opportunities' }))
      .finally(() => setLoading(false));
  };

  const now = new Date();

  // Filter Logic
  const filtered = opportunities.filter((o) => {
    // 1. Search Filter
    if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;

    const start = new Date(o.startDate);
    const end = new Date(o.endDate);

    // 2. Tab Filter
    switch (activeTab) {
      case 'upcoming':
        return start > now;
      case 'ongoing':
        return start <= now && end >= now;
      case 'past':
        return end < now;
      case 'applied':
        return !!o.myApplication;
      case 'all':
      default:
        // Hide past events from 'all' unless user applied to them, to keep view clean?
        // Or show all. Let's show all for now but prioritize current.
        // Actually, standard practice is 'all' shows everything.
        return true;
    }
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const deadlinePassed = (deadline?: string) =>
    deadline ? new Date(deadline) < now : false;

  const getStatusBadge = (o: StallOpportunity) => {
    if (!o.myApplication) return null;

    const status = o.myApplication.status;
    const config = {
      pending: { label: 'Under Review', icon: Clock3, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
      approved: { label: 'Accepted', icon: CheckCircle, color: 'text-green-700 bg-green-50 border-green-200' },
      rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-700 bg-red-50 border-red-200' },
      withdrawn: { label: 'Withdrawn', icon: AlertCircle, color: 'text-gray-600 bg-gray-50 border-[#b3cde0]' },
    };

    const s = config[status as keyof typeof config] || config.pending;
    const Icon = s.icon;

    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {s.label}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center p-6">
        <CardSkeleton className="w-full max-w-sm" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-ev-100 dark:bg-ev-900/30 rounded-lg">
                <Store className="w-6 h-6 text-ev-700" />
              </div>
              <h1 className="text-2xl font-bold text-ev-900 dark:text-white">Stall Opportunities</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
              Discover events, apply for stalls, and manage your applications. showcase your business to the community.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-[#b3cde0] dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-700 outline-none transition-shadow"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-[#b3cde0] dark:border-gray-700 pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${activeTab ===
   tab.id
                ? 'border-ev-700 text-ev-700 bg-ev-50/50 dark:bg-ev-900/10'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filtered.length ===
   0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#b3cde0] dark:border-gray-700 p-12 text-center shadow-ev">
            <div className="bg-gray-50 dark:bg-gray-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-ev-900 dark:text-white mb-1">No events found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {search
                ? `No results for "${search}" in ${activeTab} tab`
                : `There are no ${activeTab ===
   'all' ? '' : activeTab} stall opportunities at the moment.`}
            </p>
            {activeTab !== 'all' && (
              <button
                onClick={() => setActiveTab('all')}
                className="mt-4 text-sm text-ev-700 hover:text-ev-800 font-medium"
              >
                View all events
              </button>
            )}
          </div>
        )}

        {/* Opportunities Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => {
            const hasApplied = !!o.myApplication;
            const status = o.myApplication?.status;
            const isRejected = status ===
   'rejected';
            const isApproved = status ===
   'approved';
            const expired = deadlinePassed(o.applicationDeadline);
            // Can apply if NOT applied AND NOT expired
            // If rejected, user cannot re-apply immediately (usually) unless we allow it.
            // Requirement: "stall reject ho chukka... fir bhi display apply stall" -> means we should NOT display apply.
            const canApply = !hasApplied && !expired;

            return (
              <div
                key={o.id}
                className="group bg-white dark:bg-gray-800 rounded-xl border border-[#b3cde0] dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
              >
                {/* Card Header / Status */}
                <div className="p-5 pb-3">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${o.status ===
   'published' ? 'bg-ev-100 text-ev-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {o.status}
                    </span>
                    {getStatusBadge(o)}
                  </div>

                  <h3 className="font-bold text-lg text-ev-900 dark:text-white leading-snug group-hover:text-ev-700 transition-colors line-clamp-2 mb-2">
                    {o.name}
                  </h3>

                  {o.venue && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{o.venue}</span>
                    </div>
                  )}
                </div>

                {/* Info Grid */}
                <div className="px-5 py-3 border-t border-b border-gray-50 dark:border-gray-700/50 grid grid-cols-2 gap-y-3 text-sm">
                  {/* Dates */}
                  <div className="col-span-2 flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{formatDate(o.startDate)} – {formatDate(o.endDate)}</span>
                  </div>

                  {/* Deadline */}
                  <div className="col-span-2 flex items-center gap-2">
                    <Clock className={`w-4 h-4 shrink-0 ${expired ? 'text-red-400' : 'text-amber-400'}`} />
                    <span className={expired ? 'text-red-600 font-medium' : 'text-gray-600 dark:text-gray-300'}>
                      {expired ? 'Deadline Passed' : `Apply by ${formatDate(o.applicationDeadline || '')}`}
                    </span>
                  </div>

                  {/* Fee */}
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase font-semibold">Stall Fee</span>
                    <span className={`font-medium ${!o.stallFee ? 'text-green-600' : 'text-ev-900 dark:text-white'}`}>
                      {!o.stallFee ? 'Free' : `₹${o.stallFee}`}
                    </span>
                  </div>

                  {/* Slots */}
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase font-semibold">Availability</span>
                    <span className="font-medium text-ev-900 dark:text-white">
                      {o.stallsRemaining != null && o.stallsRemaining > 0
                        ? `${o.stallsRemaining} spots left`
                        : 'Filling fast'}
                    </span>
                  </div>
                </div>

                {/* Rejection Feedback */}
                {isRejected && o.myApplication?.rejectionReason && (
                  <div className="px-5 py-3 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/20">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">Rejection Reason:</p>
                    <p className="text-sm text-red-600 dark:text-red-400 italic">"{o.myApplication.rejectionReason}"</p>
                  </div>
                )}

                {/* Footer Action */}
                <div className="mt-auto p-4 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between gap-3">
                  <Link
                    href={`/events/${o.eventId}`}
                    className="text-sm text-gray-600 hover:text-ev-900 dark:text-gray-400 dark:hover:text-white font-medium transition-colors"
                  >
                    View Details
                  </Link>

                  {canApply ? (
                    <Link
                      href={`/events/${o.eventId}/apply-stall`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-ev-700 text-white text-sm font-semibold rounded-lg hover:bg-ev-800 shadow-ev hover:shadow transition-all"
                    >
                      Apply Now
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : hasApplied ? (
                    <Link
                      href={`/events/${o.eventId}/apply-stall`}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${isRejected
                        ? 'border-red-200 text-red-700 bg-white hover:bg-red-50'
                        : 'border-[#b3cde0] text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'
                        }`}
                    >
                      {isRejected ? 'View Application' : 'Track Status'}
                    </Link>
                  ) : (
                    <span className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed">
                      Applications Closed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
