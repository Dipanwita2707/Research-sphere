'use client';

import React from 'react';
import { 
  Shimmer, 
  ShimmerCard, 
  ShimmerSearchBar,
  ShimmerPagination,
  ShimmerStatCard
} from '../ShimmerBase';

/**
 * DSW Dashboard Shimmer
 * Matches: stats cards, quick action cards, info notice
 */
export function DSWDashboardShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-64" />
          <Shimmer className="h-4 w-96" />
        </div>
        <Shimmer className="h-10 w-36" rounded="lg" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerStatCard key={i} />
        ))}
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <ShimmerCard key={i}>
            <div className="flex items-start gap-4">
              <Shimmer className="h-12 w-12" rounded="xl" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-5 w-32" />
                <Shimmer className="h-4 w-full" />
                <Shimmer className="h-4 w-3/4" />
              </div>
            </div>
            <Shimmer className="h-10 w-full mt-4" rounded="lg" />
          </ShimmerCard>
        ))}
      </div>

      {/* Info Notice */}
      <ShimmerCard className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-4">
          <Shimmer className="h-10 w-10 bg-blue-200 dark:bg-blue-700" rounded="lg" />
          <div className="flex-1 space-y-3">
            <Shimmer className="h-5 w-48 bg-blue-200 dark:bg-blue-700" />
            <Shimmer className="h-4 w-full bg-blue-200 dark:bg-blue-700" />
            <div className="flex gap-2 pt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Shimmer key={i} className="h-6 w-20 bg-blue-200 dark:bg-blue-700" rounded="full" />
              ))}
            </div>
          </div>
        </div>
      </ShimmerCard>
    </div>
  );
}

/**
 * DSW Clubs List Shimmer
 * Matches: pending banner, search/filter, club cards grid, pagination
 */
export function DSWClubsListShimmer() {
  return (
    <div className="space-y-6">
      {/* Pending Banner */}
      <ShimmerCard className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-4">
          <Shimmer className="h-10 w-10 bg-amber-200 dark:bg-amber-700" rounded="lg" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-5 w-48 bg-amber-200 dark:bg-amber-700" />
            <Shimmer className="h-4 w-96 bg-amber-200 dark:bg-amber-700" />
          </div>
          <Shimmer className="h-8 w-8 bg-amber-200 dark:bg-amber-700" rounded="lg" />
        </div>
      </ShimmerCard>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-4 w-64" />
        </div>
        <Shimmer className="h-10 w-32" rounded="lg" />
      </div>

      {/* Search and Filter */}
      <ShimmerCard>
        <div className="flex flex-col md:flex-row gap-4">
          <ShimmerSearchBar showButton={false} className="flex-1" />
          <Shimmer className="h-10 w-40" rounded="lg" />
        </div>
      </ShimmerCard>

      {/* Clubs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <DSWClubCardShimmer key={i} />
        ))}
      </div>

      {/* Pagination */}
      <ShimmerPagination />
    </div>
  );
}

/**
 * Single Club Card Shimmer
 * Matches: name, ID, status, purpose, member count, session, facilitator, email
 */
export function DSWClubCardShimmer() {
  return (
    <ShimmerCard>
      {/* Header with name and status */}
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-1.5">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-3 w-24" />
        </div>
        <Shimmer className="h-6 w-20" rounded="full" />
      </div>

      {/* Application status (optional) */}
      <Shimmer className="h-5 w-36 mb-3" rounded="full" />

      {/* Purpose */}
      <div className="space-y-2 mb-4">
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-3/4" />
      </div>

      {/* Info rows */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Shimmer className="h-4 w-4" rounded="md" />
          <Shimmer className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Shimmer className="h-4 w-4" rounded="md" />
          <Shimmer className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Shimmer className="h-4 w-4" rounded="md" />
          <Shimmer className="h-4 w-40" />
        </div>
      </div>

      {/* Email */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <Shimmer className="h-4 w-4" rounded="md" />
        <Shimmer className="h-4 w-48" />
      </div>
    </ShimmerCard>
  );
}

/**
 * DSW Club Detail Shimmer
 * Matches: header, info tabs, members, events, applications
 */
export function DSWClubDetailShimmer() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Shimmer className="h-10 w-10" rounded="lg" />
          <div className="space-y-2">
            <Shimmer className="h-7 w-56" />
            <Shimmer className="h-4 w-32" />
          </div>
        </div>
        <Shimmer className="h-8 w-24" rounded="full" />
      </div>

      {/* Overview Card */}
      <ShimmerCard>
        <Shimmer className="h-5 w-24 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-3/4" />
            </div>
            <div className="space-y-1">
              <Shimmer className="h-3 w-20" />
              <Shimmer className="h-4 w-32" />
            </div>
            <div className="space-y-1">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-4 w-28" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <Shimmer className="h-3 w-12" />
              <Shimmer className="h-4 w-48" />
            </div>
            <div className="space-y-1">
              <Shimmer className="h-3 w-24" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Shimmer key={i} className="h-8 w-8" rounded="lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </ShimmerCard>

      {/* Members Section */}
      <ShimmerCard>
        <div className="flex items-center justify-between mb-4">
          <Shimmer className="h-5 w-24" />
          <Shimmer className="h-9 w-28" rounded="lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <DSWMemberCardShimmer key={i} />
          ))}
        </div>
      </ShimmerCard>

      {/* Applications Section */}
      <ShimmerCard>
        <Shimmer className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Shimmer className="h-10 w-10" rounded="full" />
              <div className="flex-1 space-y-1.5">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-48" />
              </div>
              <div className="flex gap-2">
                <Shimmer className="h-8 w-20" rounded="lg" />
                <Shimmer className="h-8 w-20" rounded="lg" />
              </div>
            </div>
          ))}
        </div>
      </ShimmerCard>

      {/* Events Section */}
      <ShimmerCard>
        <Shimmer className="h-5 w-20 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
              <Shimmer className="h-5 w-48" />
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-6 w-20" rounded="full" />
            </div>
          ))}
        </div>
      </ShimmerCard>
    </div>
  );
}

/**
 * Member Card Shimmer
 */
export function DSWMemberCardShimmer() {
  return (
    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
      <Shimmer className="h-12 w-12" rounded="full" />
      <div className="flex-1 space-y-1.5">
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-3 w-40" />
      </div>
      <Shimmer className="h-6 w-20" rounded="full" />
    </div>
  );
}

/**
 * DSW Categories Shimmer
 */
export function DSWCategoriesShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
        <Shimmer className="h-10 w-28" rounded="lg" />
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerCard key={i}>
            <div className="flex items-start justify-between mb-3">
              <Shimmer className="h-6 w-40" />
              <Shimmer className="h-6 w-12" rounded="full" />
            </div>
            <div className="space-y-2 mb-4">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-2/3" />
            </div>
            <Shimmer className="h-4 w-24" />
          </ShimmerCard>
        ))}
      </div>
    </div>
  );
}

/**
 * DSW My Clubs Shimmer
 * Matches: pending requests + my clubs sections
 */
export function DSWMyClubsShimmer() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-36" />
        <Shimmer className="h-4 w-64" />
      </div>

      {/* Pending Requests Section */}
      <div className="space-y-4">
        <Shimmer className="h-6 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <DSWPendingRequestCardShimmer key={i} />
          ))}
        </div>
      </div>

      {/* My Clubs Section */}
      <div className="space-y-4">
        <Shimmer className="h-6 w-28" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <DSWClubCardShimmer key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Pending Request Card Shimmer
 */
export function DSWPendingRequestCardShimmer() {
  return (
    <ShimmerCard className="border-amber-200 dark:border-amber-800">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Shimmer className="h-10 w-10 bg-amber-200 dark:bg-amber-700" rounded="lg" />
          <div className="space-y-1.5">
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-3 w-32" />
          </div>
        </div>
        <Shimmer className="h-6 w-28" rounded="full" />
      </div>

      {/* Approval Chain */}
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <React.Fragment key={i}>
            <Shimmer className="h-8 w-20" rounded="full" />
            {i < 4 && <Shimmer className="h-4 w-4" rounded="full" />}
          </React.Fragment>
        ))}
      </div>

      {/* Noting ID */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-40" />
        <Shimmer className="h-6 w-6 ml-auto" rounded="md" />
      </div>
    </ShimmerCard>
  );
}

/**
 * DSW Statistics Shimmer
 */
export function DSWStatisticsShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-4 w-64" />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerStatCard key={i} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShimmerCard>
          <Shimmer className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Shimmer className="h-3 w-3" rounded="full" />
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-4 w-8 ml-auto" />
              </div>
            ))}
          </div>
        </ShimmerCard>
        <ShimmerCard>
          <Shimmer className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Shimmer className="h-8 w-8" rounded="lg" />
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-4 w-8 ml-auto" />
              </div>
            ))}
          </div>
        </ShimmerCard>
      </div>
    </div>
  );
}

/**
 * DSW Club Form Shimmer
 * Matches: multi-step club creation form
 */
export function DSWClubFormShimmer() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-4 w-72" />
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2">
              <Shimmer className="h-10 w-10" rounded="full" />
              <Shimmer className="h-4 w-24" />
            </div>
            {i < 2 && <Shimmer className="h-1 w-16" />}
          </React.Fragment>
        ))}
      </div>

      {/* Form Content */}
      <ShimmerCard>
        <Shimmer className="h-6 w-32 mb-6" />
        <div className="space-y-6">
          {/* Form Fields */}
          <div className="space-y-2">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-10 w-full" rounded="lg" />
          </div>
          <div className="space-y-2">
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-10 w-full" rounded="lg" />
          </div>
          <div className="space-y-2">
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-32 w-full" rounded="lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-10 w-full" rounded="lg" />
            </div>
            <div className="space-y-2">
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-10 w-full" rounded="lg" />
            </div>
          </div>
          {/* Checkbox Group */}
          <div className="space-y-3">
            <Shimmer className="h-4 w-40" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Shimmer className="h-5 w-5" rounded="md" />
                  <Shimmer className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ShimmerCard>

      {/* Form Actions */}
      <div className="flex justify-between">
        <Shimmer className="h-10 w-24" rounded="lg" />
        <Shimmer className="h-10 w-28" rounded="lg" />
      </div>
    </div>
  );
}
