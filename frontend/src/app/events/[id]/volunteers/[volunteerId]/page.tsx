'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  History,
  LogIn,
  LogOut,
  Search,
  Clock,
  User,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Shield,
  Tag,
  Mail,
  Hash,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { Skeleton, CardSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-[#b3cde0] dark:border-ev-700 shadow-ev';

interface ActivityEntry {
  id: string;
  entryType: 'entry' | 'exit';
  entryCount?: number;
  scannedAt: string;
  gateLocation?: string;
  remarks?: string;
  participant: { uid?: string; email?: string; name: string; registrationNo?: string };
}

export default function VolunteerActivityDetailPage() {
  const params = useParams();
  const eventId = params?.id as string;
  const volunteerId = params?.volunteerId as string;
  const { toast } = useToast();

  const [volunteer, setVolunteer] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'entry' | 'exit'>('all');

  const fetchActivity = useCallback(async () => {
    if (!eventId || !volunteerId) return;
    setLoading(true);
    try {
      const result = await eventService.getVolunteerActivity(eventId, volunteerId, page, 30);
      setVolunteer(result.volunteer);
      setEvent(result.event);
      setEntries(result.entries || []);
      setPagination(result.pagination || { page: 1, total: 0, totalPages: 0 });
    } catch (error: any) {
      toast({ type: 'error', message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [eventId, volunteerId, page, toast]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const matchesSearch =
        !search ||
        e.participant.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.participant.uid && e.participant.uid.toLowerCase().includes(search.toLowerCase())) ||
        (e.participant.registrationNo && e.participant.registrationNo.toLowerCase().includes(search.toLowerCase()));
      const matchesType = typeFilter ===
   'all' || e.entryType ===
   typeFilter;
      return matchesSearch && matchesType;
    });
  }, [entries, search, typeFilter]);

  const stats = useMemo(() => {
    const checkIns = entries.reduce((sum, e) => sum + (e.entryType ===
   'entry' ? (e.entryCount || 1) : 0), 0);
    const checkOuts = entries.reduce((sum, e) => sum + (e.entryType ===
   'exit' ? (e.entryCount || 1) : 0), 0);
    return { checkIns, checkOuts, total: entries.length };
  }, [entries]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDateTime = (dateString: string) => `${formatDate(dateString)} at ${formatTime(dateString)}`;

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

  if (!eventId || !volunteerId) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">Invalid route</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/events/${eventId}/management?tab=volunteers`}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-ev-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Volunteer Management
        </Link>

        {loading && !volunteer ? (
          <div className="flex justify-center py-20">
            <CardSkeleton className="w-full max-w-sm" />
          </div>
        ) : (
          <>
            {/* Volunteer Profile Card */}
            <div className={CARD + ' p-6 mb-6'}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-ev-700 to-ev-800 rounded-xl">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-ev-900 dark:text-white">
                      {volunteer?.user?.name || 'Volunteer'}
                    </h1>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {volunteer?.role && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-ev-100 dark:bg-ev-900/30 text-ev-800 dark:text-ev-200 rounded-full text-sm">
                          <Tag className="h-3 w-3" />
                          {volunteer.role}
                        </span>
                      )}
                      {volunteer?.assignedGate && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm">
                          <MapPin className="h-3 w-3" />
                          {volunteer.assignedGate}
                        </span>
                      )}
                      {volunteer?.canScanQr && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm">
                          <CheckCircle2 className="h-3 w-3" />
                          QR Enabled
                        </span>
                      )}
                    </div>
                    {volunteer?.user?.email && (
                      <p className="flex items-center gap-1 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <Mail className="h-4 w-4" />
                        {volunteer.user.email}
                      </p>
                    )}
                  </div>
                </div>
                {event && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <p className="font-medium text-gray-700 dark:text-gray-300">{event.name}</p>
                    <p>{formatDate(event.startDate)} – {formatDate(event.endDate)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className={CARD + ' p-4'}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-green-600">
                    <LogIn className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ev-900 dark:text-white">{stats.checkIns}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Check-ins</p>
                  </div>
                </div>
              </div>
              <div className={CARD + ' p-4'}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-ev-700 to-ev-800">
                    <LogOut className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ev-900 dark:text-white">{stats.checkOuts}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Check-outs</p>
                  </div>
                </div>
              </div>
              <div className={CARD + ' p-4'}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-ev-700 to-ev-800">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-ev-900 dark:text-white">{stats.total}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Scans</p>
                  </div>
                </div>
              </div>
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
                    placeholder="Search by participant name, UID..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white focus:ring-2 focus:ring-ev-600"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-ev-900 dark:text-white text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="entry">Check-ins Only</option>
                  <option value="exit">Check-outs Only</option>
                </select>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className={CARD}>
              <div className="px-5 py-3.5 border-b border-[#b3cde0]/30 dark:border-gray-700">
                <h2 className="text-base font-semibold text-ev-900 dark:text-white flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Activity Log
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Complete record of scans by this volunteer
                </p>
              </div>
              <div className="p-5">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Skeleton className="w-5 h-5 rounded-sm" />
                  </div>
                ) : Object.keys(groupedEntries).length ===
   0 ? (
                  <div className="text-center py-16">
                    <History className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">No activity yet</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Scans by this volunteer will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(groupedEntries).map(([date, dayEntries]) => (
                      <div key={date}>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 sticky top-0 bg-white dark:bg-gray-800 py-1">
                          {date}
                        </h3>
                        <div className="space-y-2">
                          {dayEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className={`p-4 rounded-lg border transition-all ${
                                entry.entryType ===
   'entry'
                                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                                  : 'border-ev-200 dark:border-ev-800 bg-ev-50 dark:bg-ev-900/10'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  {entry.entryType ===
   'entry' ? (
                                    <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full mt-0.5">
                                      <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </div>
                                  ) : (
                                    <div className="p-1.5 bg-ev-100 dark:bg-ev-900/30 rounded-full mt-0.5">
                                      <LogOut className="h-4 w-4 text-ev-700 dark:text-ev-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-semibold text-ev-900 dark:text-white">
                                      {entry.participant.name}
                                    </p>
                                    <div className="mt-1.5 space-y-0.5">
                                      <p className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                        <User className="h-3 w-3" /> {entry.participant.name} {(entry.entryCount || 1) > 1 ? '(Pass Holder)' : ''}
                                      </p>
                                      {(entry.entryCount || 1) > 1 && Array.from({ length: (entry.entryCount || 1) - 1 }, (_, i) => (
                                        <p key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                          <User className="h-3 w-3" /> Guest {i + 1}
                                        </p>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
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
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatTime(entry.scannedAt)}
                                      </span>
                                      {entry.gateLocation && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {entry.gateLocation}
                                        </span>
                                      )}
                                    </div>
                                    {entry.remarks && (
                                      <p className="text-xs text-gray-500 mt-1 italic">{entry.remarks}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span
                                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                                      entry.entryType ===
   'entry'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : 'bg-ev-100 dark:bg-ev-900/30 text-ev-800 dark:text-ev-400'
                                    }`}
                                  >
                                    {entry.entryType ===
   'entry' ? 'IN' : 'OUT'}
                                  </span>
                                  {(entry.entryCount || 1) > 1 && (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                                      {entry.entryCount} people
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#b3cde0] dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={page >= pagination.totalPages}
                        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Note about errors */}
            <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> This log shows successful check-ins and check-outs only. Failed scan attempts (e.g. invalid QR, already entered) are not stored in the system.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
