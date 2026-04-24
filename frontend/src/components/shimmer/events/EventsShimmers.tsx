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
 * Events Browse/List Page Shimmer
 * Matches: filters, event cards grouped by festival, pagination
 */
export function EventsBrowseShimmer() {
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

      {/* Search and Filters */}
      <ShimmerCard>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <ShimmerSearchBar className="flex-1" />
        </div>
        <ShimmerFilters count={4} />
      </ShimmerCard>

      {/* Festival Group */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Shimmer className="h-6 w-48" />
          <Shimmer className="h-6 w-6" rounded="md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <EventCardShimmer key={i} />
          ))}
        </div>
      </div>

      {/* Standalone Events */}
      <div className="space-y-4">
        <Shimmer className="h-6 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardShimmer key={i} />
          ))}
        </div>
      </div>

      {/* Pagination */}
      <ShimmerPagination />
    </div>
  );
}

/**
 * Single Event Card Shimmer
 * Matches: thumbnail, title, dates, location, registration, status, action
 */
export function EventCardShimmer() {
  return (
    <ShimmerCard className="overflow-hidden p-0">
      {/* Thumbnail */}
      <Shimmer className="h-40 w-full" rounded="none" />
      
      <div className="p-5 space-y-4">
        {/* Title and Status */}
        <div className="flex items-start justify-between">
          <Shimmer className="h-5 w-48" />
          <Shimmer className="h-6 w-20" rounded="full" />
        </div>

        {/* Date and Location */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shimmer className="h-4 w-4" rounded="md" />
            <Shimmer className="h-4 w-36" />
          </div>
          <div className="flex items-center gap-2">
            <Shimmer className="h-4 w-4" rounded="md" />
            <Shimmer className="h-4 w-28" />
          </div>
        </div>

        {/* Registration Progress */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-3 w-16" />
          </div>
          <Shimmer className="h-2 w-full" rounded="full" />
        </div>

        {/* Action Button */}
        <Shimmer className="h-10 w-full" rounded="lg" />
      </div>
    </ShimmerCard>
  );
}

/**
 * Event Detail Page Shimmer
 * Matches: banner, tabs, content, sidebar
 */
export function EventDetailShimmer() {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative">
        <Shimmer className="h-64 md:h-80 w-full" rounded="2xl" />
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent rounded-b-2xl">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Shimmer className="h-7 w-20 bg-white/30" rounded="full" />
              <Shimmer className="h-7 w-24 bg-white/30" rounded="full" />
            </div>
            <Shimmer className="h-9 w-96 bg-white/30" />
            <div className="flex items-center gap-4">
              <Shimmer className="h-4 w-32 bg-white/30" />
              <Shimmer className="h-4 w-40 bg-white/30" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Tabs */}
          <ShimmerTabs count={3} />

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

          {/* Key Dates */}
          <ShimmerCard>
            <Shimmer className="h-5 w-24 mb-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Shimmer className="h-3 w-24" />
                  <Shimmer className="h-5 w-32" />
                </div>
              ))}
            </div>
          </ShimmerCard>

          {/* FAQ */}
          <ShimmerCard>
            <Shimmer className="h-5 w-32 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <Shimmer className="h-4 w-64" />
                  <Shimmer className="h-5 w-5" rounded="md" />
                </div>
              ))}
            </div>
          </ShimmerCard>
        </div>

        {/* Sidebar */}
        <div className="lg:w-80 space-y-6">
          <EventSidebarShimmer />
        </div>
      </div>
    </div>
  );
}

/**
 * Event Sidebar Shimmer
 */
export function EventSidebarShimmer() {
  return (
    <div className="space-y-6">
      {/* Registration Card */}
      <ShimmerCard>
        <Shimmer className="h-8 w-24 mx-auto mb-4" rounded="full" />
        
        {/* Capacity */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-16" />
          </div>
          <Shimmer className="h-3 w-full" rounded="full" />
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Shimmer className="h-8 w-8" rounded="lg" />
          <div className="space-y-1">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-5 w-16" />
          </div>
        </div>

        {/* Key Info */}
        <div className="space-y-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Shimmer className="h-8 w-8" rounded="lg" />
              <div className="space-y-1">
                <Shimmer className="h-3 w-16" />
                <Shimmer className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <Shimmer className="h-12 w-full" rounded="lg" />
      </ShimmerCard>

      {/* Social Links */}
      <ShimmerCard>
        <Shimmer className="h-5 w-28 mb-4" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="h-10 w-10" rounded="lg" />
          ))}
        </div>
      </ShimmerCard>
    </div>
  );
}

/**
 * Event Management Hub Shimmer
 * Matches: tabs, overview, registrations, analytics, etc.
 */
export function EventManagementShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Shimmer className="h-10 w-10" rounded="lg" />
          <div className="space-y-2">
            <Shimmer className="h-7 w-56" />
            <Shimmer className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-3">
          <Shimmer className="h-10 w-28" rounded="lg" />
          <Shimmer className="h-10 w-32" rounded="lg" />
        </div>
      </div>

      {/* Tabs */}
      <ShimmerTabs count={7} />

      {/* Overview Tab Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerStatCard key={i} />
        ))}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShimmerCard>
          <Shimmer className="h-5 w-40 mb-4" />
          <Shimmer className="h-48 w-full" rounded="lg" />
        </ShimmerCard>
        <ShimmerCard>
          <Shimmer className="h-5 w-40 mb-4" />
          <Shimmer className="h-48 w-full" rounded="lg" />
        </ShimmerCard>
      </div>

      {/* Recent Activity */}
      <ShimmerCard>
        <div className="flex items-center justify-between mb-4">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-8 w-24" rounded="lg" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Shimmer className="h-10 w-10" rounded="full" />
              <div className="flex-1 space-y-1.5">
                <Shimmer className="h-4 w-48" />
                <Shimmer className="h-3 w-32" />
              </div>
              <Shimmer className="h-6 w-20" rounded="full" />
            </div>
          ))}
        </div>
      </ShimmerCard>
    </div>
  );
}

/**
 * Event Registrations Table Shimmer
 */
export function EventRegistrationsShimmer() {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <ShimmerCard>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <ShimmerSearchBar className="flex-1" />
          <div className="flex gap-3">
            <Shimmer className="h-10 w-28" rounded="lg" />
            <Shimmer className="h-10 w-28" rounded="lg" />
          </div>
        </div>
        <ShimmerFilters count={6} />
      </ShimmerCard>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shimmer className="h-5 w-5" rounded="md" />
          <Shimmer className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-24" rounded="lg" />
          <Shimmer className="h-9 w-28" rounded="lg" />
          <Shimmer className="h-9 w-24" rounded="lg" />
        </div>
      </div>

      {/* Table */}
      <ShimmerCard className="p-0 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          <Shimmer className="h-5 w-5" rounded="md" />
          {['w-32', 'w-24', 'w-20', 'w-24', 'w-28', 'w-28', 'w-24', 'w-20'].map((w, i) => (
            <Shimmer key={i} className={`h-4 ${w}`} />
          ))}
        </div>
        {/* Table Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-700">
            <Shimmer className="h-5 w-5" rounded="md" />
            <div className="flex items-center gap-3 w-32">
              <Shimmer className="h-8 w-8" rounded="full" />
              <Shimmer className="h-4 w-20" />
            </div>
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-6 w-20" rounded="full" />
            <Shimmer className="h-6 w-24" rounded="full" />
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-4 w-24" />
            <div className="flex gap-2">
              <Shimmer className="h-8 w-8" rounded="lg" />
              <Shimmer className="h-8 w-8" rounded="lg" />
            </div>
          </div>
        ))}
      </ShimmerCard>

      {/* Pagination */}
      <ShimmerPagination />
    </div>
  );
}

/**
 * My Events Page Shimmer
 */
export function EventsMyEventsShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-36" />
        <Shimmer className="h-4 w-64" />
      </div>

      {/* Tabs */}
      <ShimmerTabs count={3} />

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardShimmer key={i} />
        ))}
      </div>

      {/* Pagination */}
      <ShimmerPagination />
    </div>
  );
}

/**
 * My Certificates Page Shimmer
 */
export function EventsCertificatesShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-4 w-72" />
      </div>

      {/* Certificates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerCard key={i}>
            {/* Certificate Preview */}
            <Shimmer className="h-40 w-full mb-4" rounded="lg" />
            {/* Event Name */}
            <Shimmer className="h-5 w-48 mb-2" />
            {/* Date */}
            <Shimmer className="h-4 w-32 mb-4" />
            {/* Actions */}
            <div className="flex gap-3">
              <Shimmer className="h-9 flex-1" rounded="lg" />
              <Shimmer className="h-9 flex-1" rounded="lg" />
            </div>
          </ShimmerCard>
        ))}
      </div>
    </div>
  );
}

/**
 * Registrations Page Shimmer (User's registrations)
 */
export function EventsUserRegistrationsShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-48" />
        <Shimmer className="h-4 w-64" />
      </div>

      {/* Filter Tabs */}
      <ShimmerTabs count={4} />

      {/* Registrations List */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerCard key={i}>
            <div className="flex items-start gap-4">
              <Shimmer className="h-20 w-28 flex-shrink-0" rounded="lg" />
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <Shimmer className="h-5 w-48" />
                    <Shimmer className="h-4 w-32" />
                  </div>
                  <Shimmer className="h-6 w-24" rounded="full" />
                </div>
                <div className="flex items-center gap-4">
                  <Shimmer className="h-4 w-28" />
                  <Shimmer className="h-4 w-24" />
                </div>
              </div>
              <Shimmer className="h-9 w-24" rounded="lg" />
            </div>
          </ShimmerCard>
        ))}
      </div>

      {/* Pagination */}
      <ShimmerPagination />
    </div>
  );
}

/**
 * Stall Opportunities Page Shimmer
 */
export function EventsStallOpportunitiesShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-52" />
        <Shimmer className="h-4 w-80" />
      </div>

      {/* Filters */}
      <ShimmerCard>
        <ShimmerFilters count={3} />
      </ShimmerCard>

      {/* Stall Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerCard key={i}>
            <div className="flex items-start gap-4">
              <Shimmer className="h-16 w-16 flex-shrink-0" rounded="xl" />
              <div className="flex-1 space-y-3">
                <Shimmer className="h-5 w-40" />
                <Shimmer className="h-4 w-full" />
                <div className="flex items-center gap-4">
                  <Shimmer className="h-4 w-24" />
                  <Shimmer className="h-4 w-20" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <Shimmer className="h-9 flex-1" rounded="lg" />
              <Shimmer className="h-9 w-28" rounded="lg" />
            </div>
          </ShimmerCard>
        ))}
      </div>
    </div>
  );
}

/**
 * Volunteer Page Shimmer
 */
export function EventsVolunteerShimmer() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
        <Shimmer className="h-10 w-36" rounded="lg" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <ShimmerStatCard key={i} />
        ))}
      </div>

      {/* Volunteer Opportunities */}
      <ShimmerCard>
        <Shimmer className="h-5 w-48 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <Shimmer className="h-12 w-12" rounded="xl" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-5 w-48" />
                <Shimmer className="h-4 w-32" />
              </div>
              <Shimmer className="h-6 w-20" rounded="full" />
              <Shimmer className="h-9 w-24" rounded="lg" />
            </div>
          ))}
        </div>
      </ShimmerCard>
    </div>
  );
}

/**
 * Event Settings Shimmer
 */
export function EventSettingsShimmer() {
  return (
    <div className="space-y-6">
      {/* Registration Toggle */}
      <ShimmerCard>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Shimmer className="h-5 w-40" />
            <Shimmer className="h-4 w-64" />
          </div>
          <Shimmer className="h-8 w-16" rounded="full" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Shimmer className="h-6 w-32" rounded="full" />
          <Shimmer className="h-6 w-40" rounded="full" />
        </div>
      </ShimmerCard>

      {/* Settings Form */}
      <ShimmerCard>
        <Shimmer className="h-5 w-32 mb-6" />
        <div className="space-y-6">
          {/* Toggle Fields */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Shimmer className="h-4 w-40" />
                <Shimmer className="h-3 w-64" />
              </div>
              <Shimmer className="h-6 w-12" rounded="full" />
            </div>
          ))}

          {/* Select Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Shimmer className="h-4 w-28" />
                <Shimmer className="h-10 w-full" rounded="lg" />
              </div>
            ))}
          </div>

          {/* Multi-select */}
          <div className="space-y-2">
            <Shimmer className="h-4 w-32" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Shimmer className="h-5 w-5" rounded="md" />
                  <Shimmer className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ShimmerCard>

      {/* Unsaved Changes Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shimmer className="h-5 w-5" rounded="md" />
            <Shimmer className="h-4 w-40" />
          </div>
          <div className="flex gap-3">
            <Shimmer className="h-10 w-24" rounded="lg" />
            <Shimmer className="h-10 w-28" rounded="lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
