'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchTrackers();
  }, [page, statusFilter, typeFilter, debouncedSearch]);

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
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 transition-colors duration-200">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monthly Research Progress Tracker</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your research from writing to publication
            </p>
          </div>
          <Link
            href="/research/progress-tracker/new"
            className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Research
          </Link>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          {Object.entries(stats.byStatus).map(([status, count]) => (
            <div key={status} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 transition-colors">
              <div className="text-sm text-gray-500 dark:text-gray-400">{statusLabels[status as ResearchTrackerStatus]}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 border border-gray-200 dark:border-gray-700 transition-colors">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (page !== 1) setPage(1);
                }}
                placeholder="Search by title or tracking number..."
                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors"
              />
              {searchQuery && searchQuery !== debouncedSearch && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ResearchTrackerStatus | '');
                setPage(1);
              }}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors"
            >
              <option value="">All Statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as TrackerPublicationType | '');
                setPage(1);
              }}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors"
            >
              <option value="">All Types</option>
              {Object.entries(publicationTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : trackers.length ===
   0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No research tracked yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Start tracking your research journey from writing to publication
          </p>
          <Link
            href="/research/progress-tracker/new"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Start Your First Research
          </Link>
        </div>
      ) : (
        /* Trackers List */
        <div className="space-y-4">
          {trackers.map((tracker) => (
            <div
              key={tracker.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-all cursor-pointer border border-gray-200 dark:border-gray-700"
              onClick={() => router.push(`/research/progress-tracker/${tracker.id}`)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{publicationTypeIcons[tracker.publicationType]}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[tracker.currentStatus]}`}>
                        {statusLabels[tracker.currentStatus]}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {tracker.trackingNumber}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-4">
                      {tracker.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {publicationTypeLabels[tracker.publicationType]}
                      {tracker.school && ` • ${tracker.school.name}`}
                      {tracker.department && ` • ${tracker.department.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {tracker.currentStatus ===
   'published' && !tracker.researchContributionId && (
                      <Link
                        href={`/research/apply?type=${tracker.publicationType}&trackerId=${tracker.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 whitespace-nowrap"
                      >
                        File for Incentive
                      </Link>
                    )}
                    {tracker.researchContributionId && (
                      <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg whitespace-nowrap">
                        Incentive Filed
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(tracker.id);
                      }}
                      disabled={!!tracker.researchContributionId}
                      className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={tracker.researchContributionId ? 'Cannot delete - incentive filed' : 'Delete'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-4 text-sm text-gray-500">
                  <span>Started: {formatDate(tracker.createdAt)}</span>
                  {tracker.expectedCompletionDate && (
                    <span>Expected: {formatDate(tracker.expectedCompletionDate)}</span>
                  )}
                  {tracker.actualCompletionDate && (
                    <span className="text-green-600">Completed: {formatDate(tracker.actualCompletionDate)}</span>
                  )}
                </div>
              </div>
              {/* Progress Bar */}
              <div className="px-6 pb-4">
                <div className="relative">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    {['writing', 'communicated', 'submitted', 'accepted', 'published'].map((status, index) => {
                      const statusOrder = ['writing', 'communicated', 'submitted', 'accepted', 'published'];
                      const currentIndex = statusOrder.indexOf(tracker.currentStatus);
                      const thisIndex = statusOrder.indexOf(status);
                      const isComplete = thisIndex <= currentIndex && tracker.currentStatus !== 'rejected';
                      const isCurrent = status ===
   tracker.currentStatus;
                      
                      return (
                        <div 
                          key={status} 
                          className={`text-center ${isComplete ? 'text-indigo-600 font-medium' : ''} ${isCurrent ? 'font-bold' : ''} ${tracker.currentStatus ===
   'rejected' && status ===
   'submitted' ? 'text-red-600 font-bold' : ''}`}
                        >
                          {status ===
   'submitted' && tracker.currentStatus ===
   'rejected' ? 'Rejected' : statusLabels[status as ResearchTrackerStatus]}
                        </div>
                      );
                    })}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    {(() => {
                      const statusOrder = ['writing', 'communicated', 'submitted', 'accepted', 'published'];
                      const currentIndex = statusOrder.indexOf(tracker.currentStatus);
                      // Rejected shows progress up to submitted (index 2) with red color
                      const progress = tracker.currentStatus ===
   'rejected' 
                        ? ((2 + 1) / statusOrder.length) * 100 
                        : ((currentIndex + 1) / statusOrder.length) * 100;
                      return (
                        <div 
                          className={`h-full ${tracker.currentStatus ===
   'rejected' ? 'bg-red-500' : 'bg-indigo-600'} transition-all duration-300`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page ===
   1}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page ===
   totalPages}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
