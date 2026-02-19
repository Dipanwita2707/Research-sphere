'use client';

import React from 'react';
import { BarChart3, TrendingUp, Users, Calendar, Award, Activity } from 'lucide-react';
import { useStatistics } from '@/features/dsw/hooks';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';

export default function StatisticsPage() {
  const { data: response, isLoading, error } = useStatistics();
  const stats = response?.success
    ? response.data
    : {
        totalClubs: 0,
        activeClubs: 0,
        totalMembers: 0,
        totalCategories: 0,
        pendingApprovals: 0,
        clubsByCategory: [],
        clubsByStatus: [],
      };
  const errorMessage = error ? getErrorMessage(error) : null;

  if (isLoading) {
    return <PageSkeleton message="Loading statistics..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Club Statistics
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Analytics and insights for student clubs
        </p>
      </div>

      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Clubs
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.totalClubs || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {stats?.activeClubs || 0} active
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Members
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.totalMembers || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Across all clubs
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Categories
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.totalCategories || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Club types
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Award className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Pending Approvals
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.pendingApprovals || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Awaiting review
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {stats?.clubsByCategory && stats.clubsByCategory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Clubs by Category
          </h2>
          <div className="space-y-3">
            {stats.clubsByCategory.map((category: { categoryId: string; categoryName: string; _count: number }) => (
              <div key={category.categoryId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {category.categoryName}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {category._count} club{category._count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Breakdown */}
      {stats?.clubsByStatus && stats.clubsByStatus.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Clubs by Status
          </h2>
          <div className="space-y-3">
            {stats.clubsByStatus.map((status: { status: string; _count: number }) => (
              <div key={status.status} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                    {status.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {status._count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Placeholder */}
      {(!stats?.clubsByCategory || stats.clubsByCategory.length === 0) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Data Available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Detailed analytics will be available once clubs are created and active.
          </p>
        </div>
      )}
    </div>
  );
}
