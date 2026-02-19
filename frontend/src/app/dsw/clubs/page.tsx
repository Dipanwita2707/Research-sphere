'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Calendar, UserCheck, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useClubs } from '@/features/dsw/hooks';
import { ClubStatusBadge } from '@/features/dsw/components/ClubStatusBadge';
import { ClubFilters } from '@/features/dsw/types';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { PageSkeleton } from '@/shared/components/PageSkeleton';

export default function AllClubsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<ClubFilters>({
    page: 1,
    limit: 20,
  });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: debouncedSearch || undefined, page: 1 }));
  }, [debouncedSearch]);

  const { data: response, isLoading, error } = useClubs(filters);
  const clubs = response?.success ? response.data ?? [] : [];
  const total = response?.pagination?.total ?? 0;
  const errorMessage = error ? getErrorMessage(error) : null;

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status === 'all' ? undefined : (status as ClubFilters['status']),
      page: 1,
    }));
  };

  if (isLoading) {
    return <PageSkeleton message="Loading clubs..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">All Clubs</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Showing {clubs.length} of {total} clubs
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search clubs by name, purpose, or ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            onChange={(e) => handleStatusFilter(e.target.value)}
            value={filters.status || 'all'}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending</option>
            <option value="approved">Approved</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Clubs Grid */}
      {clubs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Clubs Found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No clubs match your current filters. Try adjusting your search criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {clubs.map((club) => (
            <div
              key={club.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/dsw/clubs/${club.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {club.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {club.clubId}
                  </p>
                </div>
                <ClubStatusBadge status={club.status} size="sm" />
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {club.purpose}
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{club._count?.members || 0} members</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Session {club.academicSession}</span>
                </div>
                {club.facultyFacilitator && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <UserCheck className="w-4 h-4" />
                    <span className="truncate">
                      {club.facultyFacilitator.employeeDetails?.firstName}{' '}
                      {club.facultyFacilitator.employeeDetails?.lastName}
                    </span>
                  </div>
                )}
              </div>

              {club.proposedEmail && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{club.proposedEmail}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > (filters.limit ?? 20) && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page ?? 1) - 1) }))}
            disabled={filters.page === 1}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-white"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
            Page {filters.page} of {Math.ceil(total / (filters.limit ?? 20))}
          </span>
          <button
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                page: Math.min(Math.ceil(total / (filters.limit ?? 20)), (prev.page ?? 1) + 1),
              }))
            }
            disabled={(filters.page ?? 1) >= Math.ceil(total / (filters.limit ?? 20))}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-white"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
