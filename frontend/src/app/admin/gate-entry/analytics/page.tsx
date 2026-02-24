'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, TrendingUp, Users, Clock, CheckCircle, XCircle,
  AlertCircle, Calendar, Filter, RefreshCw, Download, Eye,
  Car, Building2, DollarSign, UserCheck, FileText, ArrowUpRight,
  Activity, Shield, Package
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { gateEntryService } from '@/shared/services/gateEntry.service';
import { useAuthStore } from '@/shared/auth/authStore';
import { hasGateEntryPermission, GATE_ENTRY_PERMISSIONS } from '@/shared/utils/gateEntryPermissions';

// Status colors matching the design system
const STATUS_COLORS = {
  created: '#3B82F6',      // Blue
  checked_in: '#22C55E',   // Green
  checked_out: '#6B7280',  // Gray
  cancelled: '#F59E0B',    // Orange
  expired: '#EF4444',      // Red
};

const CHART_COLORS = ['#1565C0', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

interface AnalyticsData {
  overview: {
    total: number;
    activeToday: number;
    checkedInNow: number;
    completedToday: number;
    totalCompleted: number;
    pending: number;
    expired: number;
    cancelled: number;
  };
  byPurpose: Array<{ purpose: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  vehicleStats: {
    total: number;
    withoutVehicle: number;
    twoWheeler: number;
    fourWheeler: number;
    other: number;
  };
  hostelStats?: {
    totalBookings: number;
    totalRevenue: number;
    avgRevenue: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    completed: number;
  };
  topHostels?: Array<{ name: string; bookings: number; revenue: number }>;
  extensionStats: {
    totalExtensions: number;
    avgExtensionCount: number;
    extensionRate: number;
  };
  guardPerformance: Array<{
    guardId: string;
    guardName: string;
    checkIns: number;
    checkOuts: number;
    total: number;
  }>;
  dailyTrend: Array<{ date: string; count: number }>;
  recentActivity: Array<{
    passId: string;
    visitorName: string;
    action: string;
    performedBy: string;
    role: string;
    timestamp: string;
    remarks?: string;
  }>;
  topCreators: Array<{
    creatorId: string;
    creatorName: string;
    department: string;
    passesCreated: number;
  }>;
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    purpose: string;
    status: string;
    vehicleType: string;
  };
}

export default function GateEntryAnalyticsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all');

  // Check permission on mount
  useEffect(() => {
    const canViewAnalytics = hasGateEntryPermission(
      user?.role?.name,
      GATE_ENTRY_PERMISSIONS.ANALYTICS
    );

    if (!canViewAnalytics) {
      setTimeout(() => {
        router.push('/admin/gate-entry');
      }, 3000);
    }
  }, [user, router]);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (purposeFilter !== 'all') filters.purpose = purposeFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (vehicleTypeFilter !== 'all') filters.vehicleType = vehicleTypeFilter;

      const response = await gateEntryService.getAnalytics(filters);
      
      if (response.success) {
        setAnalyticsData(response.data);
      } else {
        setError(response.message || 'Failed to fetch analytics');
      }
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Apply filters
  const handleApplyFilters = () => {
    fetchAnalytics();
  };

  // Reset filters
  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setPurposeFilter('all');
    setStatusFilter('all');
    setVehicleTypeFilter('all');
    setTimeout(() => fetchAnalytics(), 100);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!analyticsData) return;

    const csvRows = [];
    csvRows.push(['Gate Entry Analytics Report']);
    csvRows.push(['Generated:', new Date().toLocaleString()]);
    csvRows.push([]);
    
    csvRows.push(['Overview Statistics']);
    csvRows.push(['Metric', 'Count']);
    csvRows.push(['Total Passes', analyticsData.overview.total]);
    csvRows.push(['Active Today', analyticsData.overview.activeToday]);
    csvRows.push(['Checked In Now', analyticsData.overview.checkedInNow]);
    csvRows.push(['Completed Today', analyticsData.overview.completedToday]);
    csvRows.push(['Pending', analyticsData.overview.pending]);
    csvRows.push(['Expired', analyticsData.overview.expired]);
    csvRows.push(['Cancelled', analyticsData.overview.cancelled]);
    csvRows.push([]);
    
    csvRows.push(['Passes by Purpose']);
    csvRows.push(['Purpose', 'Count']);
    analyticsData.byPurpose.forEach(item => {
      csvRows.push([item.purpose, item.count]);
    });
    csvRows.push([]);
    
    csvRows.push(['Guard Performance']);
    csvRows.push(['Guard Name', 'Check-ins', 'Check-outs', 'Total']);
    analyticsData.guardPerformance.forEach(guard => {
      csvRows.push([guard.guardName, guard.checkIns, guard.checkOuts, guard.total]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gate-entry-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format action name
  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Check permission
  const canViewAnalytics = hasGateEntryPermission(
    user?.role?.name,
    GATE_ENTRY_PERMISSIONS.ANALYTICS
  );

  if (!canViewAnalytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            Only Admins can view the Gate Entry Analytics Dashboard.
          </p>
          <p className="text-sm text-gray-500">Redirecting to Gate Entry...</p>
        </div>
      </div>
    );
  }

  if (loading && !analyticsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Analytics</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                    Gate Entry Analytics
                  </h1>
                  <p className="text-sm text-gray-500">
                    Comprehensive insights and statistics
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Refresh</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden md:inline">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purpose
              </label>
              <select
                value={purposeFilter}
                onChange={(e) => setPurposeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Purposes</option>
                <option value="meeting">Meeting</option>
                <option value="delivery">Delivery</option>
                <option value="maintenance">Maintenance</option>
                <option value="event">Event</option>
                <option value="interview">Interview</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="created">Created</option>
                <option value="checked_in">Checked In</option>
                <option value="checked_out">Checked Out</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle
              </label>
              <select
                value={vehicleTypeFilter}
                onChange={(e) => setVehicleTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="none">Without Vehicle</option>
                <option value="two_wheeler">Two Wheeler</option>
                <option value="four_wheeler">Four Wheeler</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleApplyFilters}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Apply Filters
            </button>
            <button
              onClick={handleResetFilters}
              className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Overview Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <StatCard
            icon={Users}
            label="Total Passes"
            value={analyticsData.overview.total}
            color="blue"
          />
          <StatCard
            icon={Calendar}
            label="Active Today"
            value={analyticsData.overview.activeToday}
            color="indigo"
          />
          <StatCard
            icon={Activity}
            label="Checked In Now"
            value={analyticsData.overview.checkedInNow}
            color="green"
          />
          <StatCard
            icon={CheckCircle}
            label="Completed Today"
            value={analyticsData.overview.completedToday}
            color="green"
          />
          <StatCard
            icon={CheckCircle}
            label="Total Completed"
            value={analyticsData.overview.totalCompleted}
            color="purple"
          />
          <StatCard
            icon={Clock}
            label="Pending"
            value={analyticsData.overview.pending}
            color="yellow"
          />
          <StatCard
            icon={AlertCircle}
            label="Expired"
            value={analyticsData.overview.expired}
            color="red"
          />
          <StatCard
            icon={XCircle}
            label="Cancelled"
            value={analyticsData.overview.cancelled}
            color="orange"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Trend Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Daily Visitor Trend (Last 30 Days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }}
                  labelFormatter={(date) => formatDate(date)}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#1565C0"
                  strokeWidth={2}
                  fill="#1565C0"
                  fillOpacity={0.1}
                  dot={{ fill: '#1565C0', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Purpose Distribution */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Passes by Purpose
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.byPurpose} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="purpose"
                  width={100}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(purpose) => purpose.charAt(0).toUpperCase() + purpose.slice(1)}
                />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#1565C0" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.byStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => 
                    `${entry.status}: ${entry.count} (${((entry.percent || 0) * 100).toFixed(0)}%)`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analyticsData.byStatus.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Vehicle Stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              Vehicle Statistics
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  { type: 'Without Vehicle', count: analyticsData.vehicleStats.withoutVehicle },
                  { type: 'Two Wheeler', count: analyticsData.vehicleStats.twoWheeler },
                  { type: 'Four Wheeler', count: analyticsData.vehicleStats.fourWheeler },
                  { type: 'Other', count: analyticsData.vehicleStats.other }
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="type" tick={{ fontSize: 12 }} angle={-15} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }} />
                <Bar dataKey="count" fill="#1565C0" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hostel & Revenue Section - Disabled for performance optimization */}
        {/* {analyticsData.hostelStats && analyticsData.hostelStats.totalBookings > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            ... Hostel stats content ...
          </div>
        )} */}

        {/* Extension Stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Pass Extension Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-2">Total Extensions</p>
              <p className="text-3xl font-bold text-gray-900">{analyticsData.extensionStats.totalExtensions}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Avg Extensions per Pass</p>
              <p className="text-3xl font-bold text-gray-900">{analyticsData.extensionStats.avgExtensionCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Extension Rate</p>
              <p className="text-3xl font-bold text-purple-600">{analyticsData.extensionStats.extensionRate}%</p>
            </div>
          </div>
        </div>

        {/* Guard Performance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Guard Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guard Name</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Check-ins</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Check-outs</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analyticsData.guardPerformance.slice(0, 10).map((guard, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{guard.guardName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{guard.checkIns}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{guard.checkOuts}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-blue-600 text-right">{guard.total}</td>
                  </tr>
                ))}
                {analyticsData.guardPerformance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No guard activity yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Pass Creators */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            Top Pass Creators
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Passes Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analyticsData.topCreators.map((creator, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{creator.creatorName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{creator.department}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-blue-600 text-right">{creator.passesCreated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Recent Activity
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pass ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visitor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performed By</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analyticsData.recentActivity.map((activity, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">{activity.passId}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{activity.visitorName}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {formatAction(activity.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{activity.performedBy}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(activity.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
                {analyticsData.recentActivity.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No recent activity
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: 'blue' | 'indigo' | 'green' | 'yellow' | 'red' | 'orange' | 'purple';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('en-IN').format(value)}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
