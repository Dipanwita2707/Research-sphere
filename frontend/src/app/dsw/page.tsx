"use client";

import React from "react";
import {
  Users,
  TrendingUp,
  Calendar,
  Award,
  Plus,
  Search,
  BarChart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useStatistics } from "@/features/dsw/hooks";
import { getErrorMessage } from "@/shared/utils/errorHandler";
import { PageSkeleton } from "@/shared/components/PageSkeleton";

export default function DSWDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ev-900">
            Division of Student Welfare
          </h1>
          <p className="mt-2 text-ev-400">
            Manage student clubs, activities, and member engagement
          </p>
        </div>
        <button
          onClick={() => router.push("/dsw/create-club")}
          className="ev-btn w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Create New Club
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Total Clubs</p>
              <p className="text-3xl font-bold text-ev-900 mt-1">{stats?.totalClubs || 0}</p>
              <p className="text-xs text-ev-400 mt-1">{stats?.activeClubs || 0} active</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg">
              <Users className="w-8 h-8 text-ev-700" />
            </div>
          </div>
        </div>

        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Total Members</p>
              <p className="text-3xl font-bold text-ev-900 mt-1">{stats?.totalMembers || 0}</p>
              <p className="text-xs text-ev-400 mt-1">Across all clubs</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg">
              <TrendingUp className="w-8 h-8 text-ev-700" />
            </div>
          </div>
        </div>

        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Categories</p>
              <p className="text-3xl font-bold text-ev-900 mt-1">{stats?.totalCategories || 0}</p>
              <p className="text-xs text-ev-400 mt-1">Club categories</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg">
              <Award className="w-8 h-8 text-ev-700" />
            </div>
          </div>
        </div>

        <div className="ev-stat">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Pending Approvals</p>
              <p className="text-3xl font-bold text-ev-900 mt-1">{stats?.pendingApprovals || 0}</p>
              <p className="text-xs text-ev-400 mt-1">Need attention</p>
            </div>
            <div className="p-3 bg-ev-50 rounded-lg">
              <Calendar className="w-8 h-8 text-ev-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <button
          onClick={() => router.push("/dsw/clubs")}
          onMouseEnter={() =>
            queryClient.prefetchQuery({ queryKey: ["dsw", "clubs"] })
          }
          className="ev-card ev-card-hover p-6 text-left group w-full"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ev-50 rounded-lg group-hover:bg-ev-200 transition-colors">
              <Search className="w-6 h-6 text-ev-700" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ev-900">Browse All Clubs</h3>
              <p className="text-sm text-ev-400 mt-0.5">Explore {stats?.totalClubs || 0} clubs</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => router.push("/dsw/my-clubs")}
          onMouseEnter={() =>
            queryClient.prefetchQuery({ queryKey: ["dsw", "my-clubs"] })
          }
          className="ev-card ev-card-hover p-6 text-left group w-full"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ev-50 rounded-lg group-hover:bg-ev-200 transition-colors">
              <Award className="w-6 h-6 text-ev-700" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ev-900">My Clubs</h3>
              <p className="text-sm text-ev-400 mt-0.5">View your memberships</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => router.push("/dsw/statistics")}
          onMouseEnter={() =>
            queryClient.prefetchQuery({ queryKey: ["dsw", "statistics"] })
          }
          className="ev-card ev-card-hover p-6 text-left group w-full"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-ev-50 rounded-lg group-hover:bg-ev-200 transition-colors">
              <BarChart className="w-6 h-6 text-ev-700" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ev-900">View Analytics</h3>
              <p className="text-sm text-ev-400 mt-0.5">Club statistics & insights</p>
            </div>
          </div>
        </button>
      </div>

      {/* Info Notice */}
      <div className="ev-card bg-ev-50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-white border border-[#b3cde0] rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-ev-700" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold text-ev-900 mb-2">
              Club Creation Approval Workflow
            </h3>
            <p className="text-ev-800 text-sm mb-3">
              Faculty members can create new clubs through a structured approval
              workflow. Click &quot;Create New Club&quot; above to fill the
              6-step creation form.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ev-800">
              <span className="font-semibold">Approval Chain:</span>
              <span className="px-2 py-0.5 bg-white border border-[#b3cde0] rounded text-ev-800 text-xs font-medium">Faculty</span>
              <span className="text-ev-400">→</span>
              <span className="px-2 py-0.5 bg-white border border-[#b3cde0] rounded text-ev-800 text-xs font-medium">HOD</span>
              <span className="text-ev-400">→</span>
              <span className="px-2 py-0.5 bg-white border border-[#b3cde0] rounded text-ev-800 text-xs font-medium">Dean</span>
              <span className="text-ev-400">→</span>
              <span className="px-2 py-0.5 bg-white border border-[#b3cde0] rounded text-ev-800 text-xs font-medium">DSW</span>
              <span className="text-ev-400">→</span>
              <span className="px-2 py-0.5 bg-white border border-[#b3cde0] rounded text-ev-800 text-xs font-medium">Higher Authority</span>
            </div>
            <p className="text-xs text-ev-700 mt-2">
              ✓ Track your request in the Noting System • ✓ Club auto-created
              after final approval
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
