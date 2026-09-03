'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Filter, FileText, Trash2, ArrowRight, BarChart3 } from 'lucide-react';
import progressTrackerService, {
  ResearchProgressTracker,
  ResearchTrackerStatus,
  TrackerPublicationType,
  TrackerStats,
  statusLabels,
  statusColors,
  publicationTypeLabels,
  publicationTypeIcons,
} from '@/features/research-management/services/progressTracker.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useConfirm } from '@/shared/ui-components/ConfirmModal';
import { extractErrorMessage } from '@/shared/types/api.types';
import { logger } from '@/shared/utils/logger';

const STATUS_STEPS = ['writing', 'communicated', 'submitted', 'accepted', 'published'] as const;

export default function ProgressTrackerListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirmDelete } = useConfirm();
  const [trackers, setTrackers] = useState<ResearchProgressTracker[]>([]);
  const [stats, setStats] = useState<TrackerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ResearchTrackerStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<TrackerPublicationType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const fetchTrackers = async () => {
    try {
      setLoading(true);
      const params: Record<string, unknown> = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.publicationType = typeFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const [trackersRes, statsRes] = await Promise.all([
        progressTrackerService.getMyTrackers(params as Parameters<typeof progressTrackerService.getMyTrackers>[0]),
        progressTrackerService.getStats(),
      ]);

      setTrackers(trackersRes.data);
      setTotalPages(trackersRes.pagination.totalPages);
      setStats(statsRes.data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trackers';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => { fetchTrackers(); }, [page, statusFilter, typeFilter, debouncedSearch]);

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDelete('Delete Tracker', 'Are you sure you want to delete this tracker?');
    if (!confirmed) return;
    try {
      await progressTrackerService.deleteTracker(id);
      fetchTrackers();
    } catch (err: unknown) {
      logger.error('Error deleting tracker:', err);
      toast({ type: 'error', message: extractErrorMessage(err) });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getProgress = (status: ResearchTrackerStatus) => {
    if (status === 'rejected') return 60;
    const idx = STATUS_STEPS.indexOf(status as typeof STATUS_STEPS[number]);
    return idx >= 0 ? ((idx + 1) / STATUS_STEPS.length) * 100 : 0;
  };

  return (
    <div className="min-h-screen bg-[#fdf5ec] dark:bg-gray-950">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 border-b border-[#f0e2d2] dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-wine" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Research Management</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Monthly Progress Tracker
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Track your research from writing to publication</p>
          </div>
          <Link
            href="/research/progress-tracker/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-wine to-[#6E1738] rounded-xl hover:from-[#6E1738] hover:to-[#4A0F26] shadow-sm shadow-wine/20 transition-all duration-200 flex-shrink-0 mt-1"
          >
            <Plus className="w-4 h-4" />
            New Research
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-5">

        {/* ── Stats Bar ──────────────────────────────────────── */}
        {stats && (
          <div className="bg-white dark:bg-gray-900 border border-[#f0e2d2] dark:border-gray-800 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-x divide-y md:divide-y-0 divide-[#f0e2d2] dark:divide-gray-800">
              <div className="p-4 sm:p-5 flex flex-col">
                <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{stats.total}</span>
                <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wide">Total</span>
              </div>
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="p-4 sm:p-5 flex flex-col">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{count}</span>
                  <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wide">{statusLabels[status as ResearchTrackerStatus]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters Bar ────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 border border-[#f0e2d2] dark:border-gray-800 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-1">
          <div className="px-3 py-2 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); if (page !== 1) setPage(1); }}
                placeholder="Search by title or tracking number…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-[#f0e2d2] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-wine/20 focus:border-wine/40 transition-all text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as ResearchTrackerStatus | ''); setPage(1); }}
                className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-[#f0e2d2] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-wine/20 focus:border-wine/40 text-gray-900 dark:text-gray-100 outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value as TrackerPublicationType | ''); setPage(1); }}
                className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-[#f0e2d2] dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-wine/20 focus:border-wine/40 text-gray-900 dark:text-gray-100 outline-none cursor-pointer"
              >
                <option value="">All Types</option>
                {Object.entries(publicationTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl px-5 py-4">
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* ── Loading Skeleton ──────────────────────────────── */}
        {loading ? (
          <div className="bg-white dark:bg-gray-900 border border-[#f0e2d2] dark:border-gray-800 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] divide-y divide-[#f0e2d2] dark:divide-gray-800">
            {[1,2,3,4].map(i => (
              <div key={i} className="px-6 py-5 flex items-start gap-4">
                <div className="flex-1">
                  <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse mb-2.5" />
                  <div className="h-3 w-1/3 bg-white dark:bg-gray-800/60 rounded-lg animate-pulse mb-4" />
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
                </div>
                <div className="h-6 w-20 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : trackers.length === 0 ? (
          /* ── Empty State ──────────────────────────────────── */
          <div className="bg-white dark:bg-gray-900 border border-[#f0e2d2] dark:border-gray-800 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-peach/40 dark:bg-wine/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-wine dark:text-amber-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5">No research tracked yet</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6 max-w-xs mx-auto">
              Start tracking your research journey from writing to publication
            </p>
            <Link
              href="/research/progress-tracker/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-wine to-[#6E1738] rounded-xl hover:from-[#6E1738] hover:to-[#4A0F26] shadow-sm shadow-wine/20 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Start Your First Research
            </Link>
          </div>
        ) : (
          /* ── Trackers List ────────────────────────────────── */
          <div className="bg-white dark:bg-gray-900 border border-[#f0e2d2] dark:border-gray-800 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="divide-y divide-[#f0e2d2] dark:divide-gray-800">
              {trackers.map((tracker) => {
                const progress = getProgress(tracker.currentStatus);
                const isRejected = tracker.currentStatus === 'rejected';
                return (
                  <div
                    key={tracker.id}
                    className="px-6 py-5 hover:bg-white/70 dark:hover:bg-gray-800/30 cursor-pointer transition-colors duration-150 group"
                    onClick={() => router.push(`/research/progress-tracker/${tracker.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-base">{publicationTypeIcons[tracker.publicationType]}</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColors[tracker.currentStatus]}`}>
                            {statusLabels[tracker.currentStatus]}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono bg-white dark:bg-gray-800 px-2 py-0.5 rounded-md">{tracker.trackingNumber}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-wine dark:group-hover:text-amber-400 transition-colors">{tracker.title}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {publicationTypeLabels[tracker.publicationType]}
                          {tracker.school && ` \u2022 ${tracker.school.facultyName ?? tracker.school.name}`}
                          {tracker.department && ` \u2022 ${tracker.department.departmentName ?? tracker.department.name}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {tracker.currentStatus === 'published' && !tracker.researchContributionId && (
                          <Link
                            href={`/research/apply?type=${tracker.publicationType}&trackerId=${tracker.id}`}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl hover:from-emerald-700 hover:to-emerald-800 whitespace-nowrap transition-all duration-200 shadow-sm"
                          >
                            File for Incentive
                          </Link>
                        )}
                        {tracker.researchContributionId && (
                          <span className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl whitespace-nowrap">
                            Incentive Filed
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(tracker.id)}
                          disabled={!!tracker.researchContributionId}
                          className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
                          title={tracker.researchContributionId ? 'Cannot delete - incentive filed' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ArrowRight className="w-4 h-4 text-gray-200 dark:text-gray-700 group-hover:text-wine dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all duration-200" />
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-medium text-gray-400 dark:text-gray-600 mb-1.5">
                        {STATUS_STEPS.map((status) => {
                          const currentIdx = STATUS_STEPS.indexOf(tracker.currentStatus as typeof STATUS_STEPS[number]);
                          const thisIdx = STATUS_STEPS.indexOf(status);
                          const isComplete = thisIdx <= currentIdx && !isRejected;
                          return (
                            <span key={status} className={isComplete ? 'text-wine dark:text-amber-400 font-semibold' : ''}>
                              {status === 'submitted' && isRejected ? 'Rejected' : statusLabels[status as ResearchTrackerStatus]}
                            </span>
                          );
                        })}
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${isRejected ? 'bg-red-500' : 'bg-gradient-to-r from-wine to-amber'}`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400 dark:text-gray-600 font-medium">
                      <span>Started {formatDate(tracker.createdAt)}</span>
                      {tracker.expectedCompletionDate && <span>Expected {formatDate(tracker.expectedCompletionDate)}</span>}
                      {tracker.actualCompletionDate && <span className="text-emerald-600 dark:text-emerald-400">Completed {formatDate(tracker.actualCompletionDate)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-[#f0e2d2] dark:border-gray-700 rounded-xl hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-[#f0e2d2] dark:border-gray-700 rounded-xl hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}

      </div>
    </div>
  );
}