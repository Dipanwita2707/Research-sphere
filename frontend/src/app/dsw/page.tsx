'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  TrendingUp,
  Calendar,
  Award,
  Plus,
  Search,
  BarChart3,
  Bell,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { dswAPI } from '@/features/dsw/services/api';
import { DSWStatistics } from '@/features/dsw/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  active: '#0f766e',
  approved: '#0e7490',
  pending_approval: '#d97706',
  suspended: '#b91c1c',
  archived: '#64748b',
  draft: '#7c3aed',
};

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
      if (response.success && response.data) {
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
        clubsBySession: [],
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

  const topCategories = (stats?.clubsByCategory || []).slice(0, 6).map((entry) => ({
    name: entry.categoryName,
    clubs: entry._count,
  }));

  const statusBreakdown = (stats?.clubsByStatus || []).map((entry) => ({
    name: entry.status,
    value: entry.count,
    color: STATUS_COLORS[entry.status] || '#2563eb',
  }));

  const utilization = stats?.totalClubs
    ? Math.round(((stats.activeClubs || 0) / stats.totalClubs) * 100)
    : 0;

  const alertItems = [
    {
      title: 'Pending approvals queue',
      value: `${stats?.pendingApprovals || 0} requests`,
      severity: (stats?.pendingApprovals || 0) > 10 ? 'high' : 'medium',
      action: () => router.push('/notings?status=pending'),
    },
    {
      title: 'Club activation ratio',
      value: `${utilization}% active clubs`,
      severity: utilization < 60 ? 'high' : 'low',
      action: () => router.push('/dsw/clubs?status=active'),
    },
    {
      title: 'Category coverage',
      value: `${stats?.totalCategories || 0} active categories`,
      severity: (stats?.totalCategories || 0) < 6 ? 'medium' : 'low',
      action: () => router.push('/dsw/categories'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-[#b3cde0] bg-gradient-to-br from-[#011f4b] via-[#03396c] to-[#005b96] p-6 sm:p-8 text-white shadow-ev-lg">
        <div className="absolute -top-8 -right-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/70 font-semibold">
              University Operations Console
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black text-white">
              Division of Student Welfare
            </h1>
            <p className="mt-2 text-sm text-indigo-100 max-w-2xl">
              Live operational intelligence for clubs, participation, governance, and approvals.
            </p>
          </div>
          <button
            onClick={() => router.push('/dsw/create-club')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#03396c] hover:bg-[#f0f9ff] font-semibold transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Club
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ev-900">Operations Snapshot</h2>
          <p className="mt-1 text-ev-400">
            Monitor portfolio health and drill down into bottlenecks in one click.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="ev-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Total Clubs</p>
              <p className="text-3xl font-bold text-ev-900 mt-1">
                {stats?.totalClubs || 0}
              </p>
              <p className="text-xs text-ev-400 mt-1">
                {stats?.activeClubs || 0} active
              </p>
            </div>
            <div className="p-3 bg-cyan-100 rounded-lg">
              <Users className="w-8 h-8 text-cyan-700" />
            </div>
          </div>
        </div>

        <div className="ev-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">
                Total Members
              </p>
              <p className="text-3xl font-bold text-ev-900 mt-1">
                {stats?.totalMembers || 0}
              </p>
              <p className="text-xs text-ev-400 mt-1">
                Across all clubs
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-8 h-8 text-emerald-700" />
            </div>
          </div>
        </div>

        <div className="ev-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">Categories</p>
              <p className="text-3xl font-bold text-ev-900 mt-1">
                {stats?.totalCategories || 0}
              </p>
              <p className="text-xs text-ev-400 mt-1">
                Club categories
              </p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <Award className="w-8 h-8 text-amber-700" />
            </div>
          </div>
        </div>

        <div className="ev-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ev-400">
                Pending Approvals
              </p>
              <p className="text-3xl font-bold text-ev-900 mt-1">
                {stats?.pendingApprovals || 0}
              </p>
              <p className="text-xs text-ev-400 mt-1">
                Need attention
              </p>
            </div>
            <div className="p-3 bg-rose-100 rounded-lg">
              <Calendar className="w-8 h-8 text-rose-700" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 ev-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-ev-900">Top Categories by Club Volume</h3>
              <p className="text-sm text-ev-400">Distribution of active club portfolio</p>
            </div>
            <button className="ev-btn-outline" onClick={() => router.push('/dsw/categories')}>
              Drill Down
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCategories} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="clubs" radius={[8, 8, 0, 0]} fill="#0369a1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ev-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-ev-900">Status Mix</h3>
              <p className="text-sm text-ev-400">Lifecycle health signal</p>
            </div>
            <BarChart3 className="w-5 h-5 text-ev-400" />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82}>
                  {statusBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 text-sm">
            {statusBreakdown.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="capitalize text-ev-700">{entry.name.replace('_', ' ')}</span>
                </div>
                <span className="font-semibold text-ev-900">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => router.push('/dsw/clubs')}
          className="ev-card p-6 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-100 rounded-lg group-hover:bg-cyan-200 transition-colors">
              <Search className="w-6 h-6 text-cyan-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ev-900">
                Browse All Clubs
              </h3>
              <p className="text-sm text-ev-400 mt-1">
                Explore {stats?.totalClubs || 0} clubs
              </p>
            </div>
            <ChevronRight className="ml-auto w-4 h-4 text-ev-400" />
          </div>
        </button>

        <button
          onClick={() => router.push('/dsw/my-clubs')}
          className="ev-card p-6 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
              <Award className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ev-900">My Clubs</h3>
              <p className="text-sm text-ev-400 mt-1">
                View your memberships
              </p>
            </div>
            <ChevronRight className="ml-auto w-4 h-4 text-ev-400" />
          </div>
        </button>

        <button
          onClick={() => router.push('/dsw/statistics')}
          className="ev-card p-6 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
              <BarChart3 className="w-6 h-6 text-indigo-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ev-900">
                View Analytics
              </h3>
              <p className="text-sm text-ev-400 mt-1">
                Club statistics & insights
              </p>
            </div>
            <ChevronRight className="ml-auto w-4 h-4 text-ev-400" />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="ev-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-ev-900">Operational Alerts</h3>
            <Bell className="w-5 h-5 text-ev-400" />
          </div>
          <div className="space-y-3">
            {alertItems.map((item) => (
              <button
                key={item.title}
                onClick={item.action}
                className="w-full text-left border border-[#b3cde0] rounded-xl p-3 hover:bg-ev-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ev-900">{item.title}</p>
                  <span
                    className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full ${
                      item.severity === 'high'
                        ? 'bg-red-100 text-red-700'
                        : item.severity === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>
                <p className="text-xs text-ev-400 mt-1">{item.value}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="ev-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-ev-900">Action Feed</h3>
            <Activity className="w-5 h-5 text-ev-400" />
          </div>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-[#b3cde0] p-3 bg-ev-50/60">
              <p className="font-semibold text-ev-900">Approval pipeline refreshed</p>
              <p className="text-xs text-ev-400 mt-1">
                {(stats?.pendingApprovals || 0) > 0
                  ? `${stats?.pendingApprovals} notings are waiting for decision.`
                  : 'No pending club approvals right now.'}
              </p>
            </div>
            <div className="rounded-xl border border-[#b3cde0] p-3 bg-ev-50/60">
              <p className="font-semibold text-ev-900">Category portfolio reviewed</p>
              <p className="text-xs text-ev-400 mt-1">
                {stats?.clubsByCategory?.length
                  ? `Top category: ${stats.clubsByCategory[0]?.categoryName} (${stats.clubsByCategory[0]?._count} clubs)`
                  : 'No category spread data available yet.'}
              </p>
            </div>
            <div className="rounded-xl border border-[#b3cde0] p-3 bg-ev-50/60">
              <p className="font-semibold text-ev-900">Engagement baseline</p>
              <p className="text-xs text-ev-400 mt-1">
                {(stats?.totalMembers || 0) > 0
                  ? `${stats?.totalMembers} total members currently mapped across clubs.`
                  : 'Member enrollment data will appear here as clubs onboard students.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
