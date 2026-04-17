'use client';

import React from 'react';
import { BarChart3, TrendingUp, Users, Calendar, Award, Activity } from 'lucide-react';
import { useStatistics } from '@/features/dsw/hooks';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { PageSkeleton } from '@/shared/components/PageSkeleton';
import { DSWStatisticsShimmer } from '@/components/shimmer';

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
    return <DSWStatisticsShimmer />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ev-900">Club Statistics</h1>
        <p className="mt-2 text-ev-400">Analytics and insights for student clubs</p>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Total Clubs</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">{stats?.totalClubs || 0}</p>
              <p className="text-xs text-ev-400 mt-1">{stats?.activeClubs || 0} active</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><Users className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Total Members</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">{stats?.totalMembers || 0}</p>
              <p className="text-xs text-ev-400 mt-1">Across all clubs</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><TrendingUp className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Categories</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">{stats?.totalCategories || 0}</p>
              <p className="text-xs text-ev-400 mt-1">Club types</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><Award className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Pending Approvals</p>
              <p className="text-2xl font-bold text-ev-900 mt-1">{stats?.pendingApprovals || 0}</p>
              <p className="text-xs text-ev-400 mt-1">Awaiting review</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg"><Calendar className="w-6 h-6 text-ev-700" /></div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {stats?.clubsByCategory && stats.clubsByCategory.length > 0 && (
        <div className="ev-card">
          <div className="px-6 py-4 border-b border-[#b3cde0]/40">
            <h2 className="ev-section-title">Clubs by Category</h2>
          </div>
          <div className="p-6 space-y-1">
            {stats.clubsByCategory.map((category: { categoryId: string; categoryName: string; _count: number }) => (
              <div key={category.categoryId} className="flex items-center justify-between py-2 border-b border-[#edf4f8] last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-ev-700"></div>
                  <span className="text-sm text-ev-800">{category.categoryName}</span>
                </div>
                <span className="text-sm font-semibold text-ev-900">
                  {category._count} club{category._count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Breakdown */}
      {stats?.clubsByStatus && stats.clubsByStatus.length > 0 && (
        <div className="ev-card">
          <div className="px-6 py-4 border-b border-[#b3cde0]/40">
            <h2 className="ev-section-title">Clubs by Status</h2>
          </div>
          <div className="p-6 space-y-1">
            {stats.clubsByStatus.map((status: { status: string; _count: number }) => (
              <div key={status.status} className="flex items-center justify-between py-2 border-b border-[#edf4f8] last:border-0">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-ev-400" />
                  <span className="text-sm text-ev-800 capitalize">{status.status.replace('_', ' ')}</span>
                </div>
                <span className="text-sm font-semibold text-ev-900">{status._count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!stats?.clubsByCategory || stats.clubsByCategory.length === 0) && (
        <div className="ev-card p-12 text-center">
          <BarChart3 className="w-14 h-14 text-ev-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ev-900 mb-2">No Data Available</h3>
          <p className="text-ev-400 text-sm">
            Detailed analytics will be available once clubs are created and active.
          </p>
        </div>
      )}
    </div>
  );
}
