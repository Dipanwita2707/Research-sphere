import React from 'react';

// Base Shimmer Animation
export const Shimmer = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-gradient-to-r from-[#dbe7f3] via-[#b3cde0] to-[#dbe7f3] bg-[length:200%_100%] ${className}`} 
       style={{ animation: 'shimmer 1.5s infinite' }} />
);

// Analytics Page Shimmer
export const AnalyticsShimmer = () => (
  <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
    <div className="max-w-[1800px] mx-auto space-y-6">
      {/* Header Shimmer */}
      <div className="bg-gradient-to-r from-[#011f4b] via-[#03396c] to-[#005b96] rounded-2xl border border-[#03396c] shadow-[0_12px_28px_rgba(1,31,75,0.28)] p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Shimmer className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/20" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-8 md:h-10 w-64 rounded bg-white/20" />
              <Shimmer className="h-4 w-48 rounded bg-white/10" />
            </div>
          </div>
          <Shimmer className="w-32 h-10 rounded-xl bg-white/20" />
        </div>
      </div>

      {/* Filter Section Shimmer */}
      <div className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-5 md:p-6">
        <div className="flex items-center gap-3 mb-5">
          <Shimmer className="w-10 h-10 rounded-xl" />
          <Shimmer className="h-6 w-48 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <Shimmer className="h-4 w-24 rounded mb-2" />
              <Shimmer className="h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <Shimmer className="h-10 w-32 rounded-xl" />
          <Shimmer className="h-10 w-24 rounded-xl" />
        </div>
      </div>

      {/* Stats Cards Shimmer */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-4">
            <div className="flex items-center gap-3">
              <Shimmer className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-6 w-12 rounded" />
                <Shimmer className="h-3 w-20 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Shimmer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-6 space-y-4">
          <Shimmer className="h-6 w-48 rounded" />
          <Shimmer className="h-[300px] w-full rounded" />
        </div>
        <div className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-6 space-y-4">
          <Shimmer className="h-6 w-48 rounded" />
          <Shimmer className="h-[300px] w-full rounded" />
        </div>
      </div>

      {/* Tables Shimmer */}
      <div className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-6 space-y-4">
        <Shimmer className="h-6 w-40 rounded" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Shimmer key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Verify Pass Shimmer
export const VerifyPassShimmer = () => (
  <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#011f4b] via-[#03396c] to-[#005b96] rounded-2xl border border-[#03396c] shadow-[0_12px_28px_rgba(1,31,75,0.28)] p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Shimmer className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/20" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-8 md:h-10 w-56 rounded bg-white/20" />
              <Shimmer className="h-4 w-64 rounded bg-white/10" />
            </div>
          </div>
          <Shimmer className="w-32 h-10 rounded-xl bg-white/20" />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-2">
        <div className="flex gap-2">
          <Shimmer className="h-12 flex-1 rounded-xl" />
          <Shimmer className="h-12 flex-1 rounded-xl" />
        </div>
      </div>

      {/* Search/Scan Area */}
      <div className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-6 space-y-4">
        <Shimmer className="h-6 w-48 rounded" />
        <Shimmer className="h-12 w-full rounded-xl" />
        <Shimmer className="h-12 w-32 rounded-xl" />
      </div>

      {/* Result Card Placeholder */}
      <div className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-6 space-y-6">
        <div className="space-y-3">
          <Shimmer className="h-6 w-40 rounded" />
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-3/4 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Shimmer className="h-4 w-24 rounded" />
              <Shimmer className="h-6 w-full rounded" />
            </div>
          ))}
        </div>
        <Shimmer className="h-12 w-full rounded-xl" />
      </div>
    </div>
  </div>
);

// Create Pass Shimmer
export const CreatePassShimmer = () => (
  <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#011f4b] via-[#03396c] to-[#005b96] rounded-2xl border border-[#03396c] shadow-[0_12px_28px_rgba(1,31,75,0.28)] p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Shimmer className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/20" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-8 md:h-10 w-64 rounded bg-white/20" />
              <Shimmer className="h-4 w-80 rounded bg-white/10" />
            </div>
          </div>
          <Shimmer className="w-32 h-10 rounded-xl bg-white/20" />
        </div>
      </div>

      {/* Form Sections */}
      {[...Array(3)].map((_, sectionIdx) => (
        <div key={sectionIdx} className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            <Shimmer className="w-8 h-8 rounded-xl" />
            <Shimmer className="h-6 w-48 rounded" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, fieldIdx) => (
              <div key={fieldIdx} className="space-y-2">
                <Shimmer className="h-4 w-32 rounded" />
                <Shimmer className="h-12 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <Shimmer className="h-12 w-32 rounded-xl" />
        <Shimmer className="h-12 w-40 rounded-xl" />
      </div>
    </div>
  </div>
);

// Dashboard/Main Page Shimmer
export const DashboardShimmer = () => (
  <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
    <div className="max-w-[1800px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#011f4b] via-[#03396c] to-[#005b96] rounded-2xl border border-[#03396c] shadow-[0_12px_28px_rgba(1,31,75,0.28)] p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Shimmer className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-white/20" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-8 md:h-10 w-72 rounded bg-white/20" />
              <Shimmer className="h-4 w-96 rounded bg-white/10" />
            </div>
          </div>
          <Shimmer className="w-32 h-10 rounded-xl bg-white/20" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-6">
            <div className="flex items-center gap-4">
              <Shimmer className="w-14 h-14 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-8 w-20 rounded" />
                <Shimmer className="h-4 w-32 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Shimmer className="w-12 h-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-6 w-40 rounded" />
                <Shimmer className="h-4 w-full rounded" />
              </div>
            </div>
            <Shimmer className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-[0_10px_24px_rgba(3,57,108,0.12)] border border-[#6497b1] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Shimmer className="h-6 w-48 rounded" />
          <Shimmer className="h-8 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl">
              <Shimmer className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-4 w-48 rounded" />
                <Shimmer className="h-3 w-32 rounded" />
              </div>
              <Shimmer className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Generic Loading Shimmer (fallback)
export const GenericShimmer = () => (
  <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
    <div className="max-w-7xl mx-auto space-y-6">
      <Shimmer className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Shimmer key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
      <Shimmer className="h-96 w-full rounded-2xl" />
    </div>
  </div>
);

// Add shimmer animation to global CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(style);
}
