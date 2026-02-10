'use client';

import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, Calendar, Award, Plus, Search, BarChart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { dswAPI } from '@/features/dsw/services/api';
import { DSWStatistics } from '@/features/dsw/types';

export default function DSWDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DSWStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await dswAPI.getStatistics();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching DSW statistics:', err);
      setError(err.response?.data?.message || 'Failed to load statistics');
      // Set default stats so page still shows
      setStats({
        totalClubs: 0,
        activeClubs: 0,
        totalMembers: 0,
        totalCategories: 0,
        pendingApprovals: 0,
        clubsByCategory: [],
        clubsByStatus: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Division of Student Welfare
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage student clubs, activities, and member engagement
          </p>
        </div>
        <button
          onClick={() => router.push('/dsw/create-club')}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Create New Club
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Clubs</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.totalClubs || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {stats?.activeClubs || 0} active
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Members
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.totalMembers || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Across all clubs
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Categories</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.totalCategories || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Club categories
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Award className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Pending Approvals
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats?.pendingApprovals || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Need attention
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Calendar className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => router.push('/dsw/clubs')}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
              <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Browse All Clubs
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Explore {stats?.totalClubs || 0} clubs
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => router.push('/dsw/my-clubs')}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/30 transition-colors">
              <Award className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">My Clubs</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                View your memberships
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => router.push('/dsw/statistics')}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/30 transition-colors">
              <BarChart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                View Analytics
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Club statistics & insights
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Club Creation Approval Workflow
            </h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm mb-3">
              Faculty members can create new clubs through a structured approval workflow. Click
              "Create New Club" above to fill the 6-step creation form.
            </p>
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Approval Chain:</span>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 rounded">Faculty</span>
              <span>→</span>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 rounded">HOD</span>
              <span>→</span>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 rounded">Dean</span>
              <span>→</span>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 rounded">DSW</span>
              <span>→</span>
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 rounded">Higher Authority</span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              ✓ Track your request in the Noting System • ✓ Club auto-created after final approval
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
