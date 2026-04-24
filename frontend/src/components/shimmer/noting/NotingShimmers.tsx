'use client';

import React from 'react';
import { 
  Shimmer, 
  ShimmerCard, 
  ShimmerTabs, 
  ShimmerSearchBar, 
  ShimmerFilters,
  ShimmerPagination,
  ShimmerStatCard
} from '../ShimmerBase';

/**
 * Noting List Page Shimmer
 * Matches: tabs, search/filter, note cards grid, pagination
 */
export function NotingListShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
        <Shimmer className="h-10 w-32" rounded="lg" />
      </div>

      {/* Tabs */}
      <ShimmerTabs count={5} />

      {/* Search and Filter Card */}
      <ShimmerCard>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <ShimmerSearchBar showButton className="flex-1" />
            <Shimmer className="h-10 w-10" rounded="lg" />
          </div>
          {/* Collapsed filters placeholder */}
          <ShimmerFilters count={4} />
          <Shimmer className="h-9 w-28" rounded="lg" />
        </div>
      </ShimmerCard>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <NotingCardShimmer key={i} />
        ))}
      </div>

      {/* Pagination */}
      <ShimmerPagination />
    </div>
  );
}

/**
 * Single Note Card Shimmer
 * Matches: creator avatar, title, excerpt, status, category, timestamp, actions
 */
export function NotingCardShimmer() {
  return (
    <ShimmerCard>
      {/* Header with avatar and status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Shimmer className="h-10 w-10" rounded="full" />
          <div className="space-y-1.5">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-3 w-24" />
          </div>
        </div>
        <Shimmer className="h-6 w-20" rounded="full" />
      </div>

      {/* Title and excerpt */}
      <div className="space-y-3 mb-4">
        <Shimmer className="h-5 w-full" />
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-3/4" />
      </div>

      {/* Category and timestamp */}
      <div className="flex items-center justify-between mb-4">
        <Shimmer className="h-6 w-24" rounded="full" />
        <Shimmer className="h-4 w-28" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
        <Shimmer className="h-8 w-8" rounded="lg" />
        <Shimmer className="h-8 w-8" rounded="lg" />
        <Shimmer className="h-8 w-8" rounded="lg" />
        <div className="flex-1" />
        <Shimmer className="h-8 w-8" rounded="lg" />
      </div>
    </ShimmerCard>
  );
}

/**
 * Noting Form Shimmer
 * Matches: event type selector, form fields, attachments, actions
 */
export function NotingFormShimmer() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Shimmer className="h-10 w-10" rounded="lg" />
        <div className="space-y-2">
          <Shimmer className="h-7 w-48" />
          <Shimmer className="h-4 w-64" />
        </div>
      </div>

      {/* Event Type Selector */}
      <ShimmerCard>
        <Shimmer className="h-5 w-32 mb-4" />
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="h-12 w-28" rounded="lg" />
          ))}
        </div>
      </ShimmerCard>

      {/* Main Form Fields */}
      <ShimmerCard>
        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-10 w-full" rounded="lg" />
          </div>

          {/* Description (Rich Editor) */}
          <div className="space-y-2">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-48 w-full" rounded="lg" />
          </div>

          {/* Category and Department Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-10 w-full" rounded="lg" />
            </div>
            <div className="space-y-2">
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-10 w-full" rounded="lg" />
            </div>
          </div>

          {/* Note Points */}
          <div className="space-y-2">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-32 w-full" rounded="lg" />
          </div>
        </div>
      </ShimmerCard>

      {/* Attachments Section */}
      <ShimmerCard>
        <Shimmer className="h-5 w-28 mb-4" />
        <Shimmer className="h-32 w-full border-2 border-dashed border-gray-200 dark:border-gray-600" rounded="lg" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Shimmer className="h-8 w-8" rounded="lg" />
              <Shimmer className="h-4 flex-1" />
              <Shimmer className="h-6 w-6" rounded="md" />
            </div>
          ))}
        </div>
      </ShimmerCard>

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <Shimmer className="h-10 w-10" rounded="lg" />
        <div className="flex gap-3">
          <Shimmer className="h-10 w-28" rounded="lg" />
          <Shimmer className="h-10 w-36" rounded="lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * Noting Detail Page Shimmer
 * Matches: header, creator panel, content, attachments, workflow sidebar
 */
export function NotingDetailShimmer() {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Shimmer className="h-10 w-10" rounded="lg" />
              <Shimmer className="h-7 w-64" />
            </div>
            <Shimmer className="h-4 w-48" />
          </div>
          <Shimmer className="h-8 w-24" rounded="full" />
        </div>

        {/* Creator Panel */}
        <ShimmerCard>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shimmer className="h-14 w-14" rounded="full" />
              <div className="space-y-2">
                <Shimmer className="h-5 w-40" />
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-48" />
              </div>
            </div>
            <Shimmer className="h-8 w-8" rounded="lg" />
          </div>
          {/* Expanded details placeholder */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Shimmer className="h-3 w-16" />
                <Shimmer className="h-4 w-32" />
              </div>
            ))}
          </div>
        </ShimmerCard>

        {/* Event Details (if applicable) */}
        <ShimmerCard>
          <Shimmer className="h-5 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Shimmer className="h-10 w-10" rounded="lg" />
                <div className="space-y-1.5">
                  <Shimmer className="h-3 w-20" />
                  <Shimmer className="h-4 w-32" />
                </div>
              </div>
            ))}
          </div>
        </ShimmerCard>

        {/* Description */}
        <ShimmerCard>
          <Shimmer className="h-5 w-28 mb-4" />
          <div className="space-y-3">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-2/3" />
          </div>
        </ShimmerCard>

        {/* Attachments */}
        <ShimmerCard>
          <Shimmer className="h-5 w-28 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Shimmer className="h-10 w-10" rounded="lg" />
                <div className="flex-1 space-y-1.5">
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </ShimmerCard>

        {/* History Timeline */}
        <ShimmerCard>
          <Shimmer className="h-5 w-20 mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <Shimmer className="h-8 w-8" rounded="full" />
                  {i < 2 && <Shimmer className="w-0.5 h-12 mt-2" />}
                </div>
                <div className="flex-1 space-y-2 pb-4">
                  <Shimmer className="h-4 w-48" />
                  <Shimmer className="h-3 w-32" />
                  <Shimmer className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </ShimmerCard>
      </div>

      {/* Workflow Sidebar */}
      <div className="lg:w-80 space-y-6">
        {/* Status Card */}
        <ShimmerCard>
          <Shimmer className="h-5 w-28 mb-4" />
          <div className="text-center space-y-4">
            <Shimmer className="h-10 w-32 mx-auto" rounded="full" />
            <div className="space-y-2">
              <Shimmer className="h-4 w-24 mx-auto" />
              <Shimmer className="h-5 w-40 mx-auto" />
            </div>
          </div>
        </ShimmerCard>

        {/* Action Buttons */}
        <ShimmerCard>
          <Shimmer className="h-5 w-20 mb-4" />
          <div className="space-y-3">
            <Shimmer className="h-12 w-full" rounded="lg" />
            <Shimmer className="h-12 w-full" rounded="lg" />
            <Shimmer className="h-12 w-full" rounded="lg" />
          </div>
        </ShimmerCard>

        {/* Copy Sharing Section */}
        <ShimmerCard>
          <Shimmer className="h-5 w-24 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <Shimmer className="h-8 w-8" rounded="full" />
                <div className="flex-1 space-y-1">
                  <Shimmer className="h-4 w-28" />
                  <Shimmer className="h-3 w-20" />
                </div>
                <Shimmer className="h-6 w-16" rounded="full" />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Shimmer className="h-10 w-full" rounded="lg" />
          </div>
        </ShimmerCard>
      </div>
    </div>
  );
}

/**
 * Noting Admin Dashboard Shimmer
 * Matches: 4-tab dashboard with stats, tables, activity
 */
export function NotingAdminShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-56" />
          <Shimmer className="h-4 w-80" />
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-10 w-32" rounded="lg" />
          <Shimmer className="h-10 w-28" rounded="lg" />
        </div>
      </div>

      {/* Tabs */}
      <ShimmerTabs count={4} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerStatCard key={i} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShimmerCard>
          <Shimmer className="h-5 w-40 mb-4" />
          <Shimmer className="h-64 w-full" rounded="lg" />
        </ShimmerCard>
        <ShimmerCard>
          <Shimmer className="h-5 w-40 mb-4" />
          <Shimmer className="h-64 w-full" rounded="lg" />
        </ShimmerCard>
      </div>

      {/* Table */}
      <ShimmerCard>
        <div className="flex items-center justify-between mb-4">
          <Shimmer className="h-5 w-32" />
          <Shimmer className="h-8 w-24" rounded="lg" />
        </div>
        {/* Table Header */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-t-lg">
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className={`h-4 ${i === 0 ? 'w-8' : 'flex-1'}`} />
          ))}
        </div>
        {/* Table Rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-700">
            {Array.from({ length: 5 }).map((_, j) => (
              <Shimmer key={j} className={`h-4 ${j === 0 ? 'w-8' : 'flex-1'}`} />
            ))}
          </div>
        ))}
        <ShimmerPagination className="mt-4" />
      </ShimmerCard>
    </div>
  );
}

/**
 * Noting Copy Detail Shimmer
 */
export function NotingCopyDetailShimmer() {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Content - reuse detail shimmer structure */}
      <div className="flex-1 space-y-6">
        <ShimmerCard>
          <Shimmer className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-3/4" />
          </div>
        </ShimmerCard>
        
        <ShimmerCard>
          <Shimmer className="h-5 w-32 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-4 w-full" />
            ))}
          </div>
        </ShimmerCard>
      </div>

      {/* Copy Workflow Sidebar */}
      <div className="lg:w-80 space-y-6">
        <ShimmerCard>
          <Shimmer className="h-5 w-24 mb-4" />
          <div className="space-y-4">
            <Shimmer className="h-8 w-24 mx-auto" rounded="full" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Shimmer className="h-4 w-24" />
                  <Shimmer className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
        </ShimmerCard>

        <ShimmerCard>
          <Shimmer className="h-5 w-20 mb-4" />
          <Shimmer className="h-24 w-full mb-4" rounded="lg" />
          <Shimmer className="h-10 w-full" rounded="lg" />
        </ShimmerCard>
      </div>
    </div>
  );
}
