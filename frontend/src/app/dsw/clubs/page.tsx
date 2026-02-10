'use client';

import React, { useEffect, useState } from 'react';
import { Users, Filter, Search, Calendar, UserCheck, Mail, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clubAPI } from '@/features/dsw/services/api';
import { Club, ClubFilters } from '@/features/dsw/types';

export default function AllClubsPage() {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ClubFilters>({
    page: 1,
    limit: 20,
  });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchClubs();
  }, [filters]);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      const response = await clubAPI.getClubs(filters);
      if (response.success) {
        setClubs(response.data);
        setTotal(response.pagination.total);
      }
    } catch (err: any) {
      console.error('Error fetching clubs:', err);
      // Set empty clubs on error so page still shows
      setClubs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (searchTerm: string) => {
    setFilters((prev) => ({ ...prev, search: searchTerm, page: 1 }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status === 'all' ? undefined : (status as any),
      page: 1,
    }));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; className: string }
    > = {
      active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' },
      pending_approval: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' },
      approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' },
      suspended: { label: 'Suspended', className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' },
      archived: { label: 'Archived', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' },
    };

    const config = statusConfig[status] || statusConfig.active;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading clubs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Clubs</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Showing {clubs.length} of {total} clubs
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search clubs by name, purpose, or ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              onChange={(e) => handleSearch(e.target.value)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clubs.map((club) => (
            <div
              key={club.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
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
                {getStatusBadge(club.status)}
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
      {total > filters.limit! && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page! - 1) }))}
            disabled={filters.page === 1}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-white"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
            Page {filters.page} of {Math.ceil(total / filters.limit!)}
          </span>
          <button
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                page: Math.min(Math.ceil(total / filters.limit!), prev.page! + 1),
              }))
            }
            disabled={filters.page! >= Math.ceil(total / filters.limit!)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-white"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
