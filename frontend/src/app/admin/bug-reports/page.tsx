'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bug, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import { BugReportTable } from './components/BugReportTable';
import { BugReportFilters } from './components/BugReportFilters';
import { BugReportSearch } from './components/BugReportSearch';
import { useBugReportsQuery, useUpdateBugReportStatus } from '@/features/bug-reports/hooks/useBugReportsQuery';
import type {
  BugReportFilters as FilterType,
  ResolutionStatus,
} from '@/features/bug-reports/types/bugReport.types';

export default function BugReportsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [filters, setFilters] = useState<FilterType>({
    status: 'all',
    search: '',
    sortBy: 'createdAt',
    order: 'desc',
    page: 1,
    limit: 50,
  });

  // Check if user is admin
  const isAdmin = user && (user.userType === 'admin' || user.role?.name === 'superadmin');

  useEffect(() => {
    if (user && !isAdmin) {
      router.push('/dashboard');
    }
  }, [user, isAdmin, router]);

  // Use React Query for data fetching with caching
  const { data, isLoading, error: queryError } = useBugReportsQuery(filters, {
    enabled: !!isAdmin,
  });

  // Use mutation for status updates with automatic cache invalidation
  const updateStatusMutation = useUpdateBugReportStatus();

  const handleStatusFilterChange = useCallback((status: 'all' | ResolutionStatus) => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
  }, []);

  const handleSearchChange = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  }, []);

  const handleSortChange = useCallback((sortBy: FilterType['sortBy'], order: 'asc' | 'desc') => {
    setFilters((prev) => ({ ...prev, sortBy, order }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleReportClick = useCallback(
    (id: string) => {
      router.push(`/admin/bug-reports/${id}`);
    },
    [router]
  );

  const handleStatusUpdate = useCallback(
    async (id: string, status: ResolutionStatus) => {
      try {
        await updateStatusMutation.mutateAsync({ id, status });
      } catch (err) {
        console.error('Failed to update bug report status:', err);
        alert('Failed to update status. Please try again.');
      }
    },
    [updateStatusMutation]
  );

  const error = queryError ? 
    (queryError as any).response?.status === 404
      ? 'Bug reports feature is not available. Please ensure the backend service is running.'
      : (queryError as any).response?.status === 403 
        ? 'You do not have permission to view bug reports'
        : 'Failed to load bug reports. Please try again.'
    : null;

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Bug className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bug Reports</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Manage and track reported issues</p>
            </div>
          </div>

          {/* Stats */}
          {data?.counts && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
              <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-600">Total Reports</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{data?.counts?.total ?? 0}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-600">Unresolved</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-600 mt-1">{data?.counts?.unresolved ?? 0}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-600">Resolved</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{data?.counts?.resolved ?? 0}</p>
              </div>
            </div>
          )}
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <BugReportSearch searchTerm={filters.search} onSearchChange={handleSearchChange} debounceMs={300} />
            </div>
            <div className="overflow-x-auto">
              <BugReportFilters
                currentStatus={filters.status}
                onStatusChange={handleStatusFilterChange}
                unresolvedCount={data?.counts?.unresolved ?? 0}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-sm sm:text-base text-red-800">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {data.reports?.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-8 sm:p-12 text-center">
                <Bug className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No bug reports found</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  {filters.search || filters.status !== 'all'
                    ? 'Try adjusting your filters or search term'
                    : 'No bug reports have been submitted yet'}
                </p>
              </div>
            ) : (
              <BugReportTable
                reports={data.reports || []}
                onReportClick={handleReportClick}
                onStatusChange={handleStatusUpdate}
                sortBy={filters.sortBy}
                sortOrder={filters.order}
                onSort={handleSortChange}
                pagination={data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 }}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
