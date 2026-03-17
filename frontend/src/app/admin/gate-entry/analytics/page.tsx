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
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { AnalyticsShimmer } from '../components/ShimmerUI';
import '../styles/animations.css';

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
  guestHouseStats?: {
    totalBookings: number;
    totalRevenue: number;
    avgRevenue: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    completed: number;
  };
  topGuestHouses?: Array<{ name: string; bookings: number; revenue: number }>;
  recentBookings?: Array<{
    id: string;
    guestHouse: string;
    roomNumber: string;
    checkIn: string;
    checkOut: string;
    visitorName: string;
    visitorPhone: string;
    passId: string;
    totalPrice: number;
    bookingStatus: string;
    paymentStatus: string;
    guestCount: number;
    createdAt: string;
    refund: {
      refundAmount: number;
      refundStatus: string;
      cancellationFee: number;
      cancellationFeePercent: number;
      originalAmount: number;
      remarks: string | null;
    } | null;
  }>;
  refundStats?: {
    totalRefunds: number;
    totalRefundAmount: number;
    totalOriginalAmount: number;
    totalCancellationFees: number;
  };
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
  checkedInVisitors?: Array<{
    passId: string;
    visitorName: string;
    phone: string;
    purpose: string;
    entryTime: string;
    entryGate: string;
    persons: number;
    hasVehicle: boolean;
    vehicleType: string | null;
    vehicleNumber: string | null;
    personToMeet: string;
    department: string;
  }>;
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    purpose: string;
    status: string;
    vehicleType: string;
  };
}

function GateEntryAnalyticsPageContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLanguage(); // Get translation function
  
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
    csvRows.push([t('analytics.csv.title')]);
    csvRows.push([t('analytics.csv.generated'), new Date().toLocaleString()]);
    csvRows.push([]);
    
    csvRows.push([t('analytics.csv.overviewStats')]);
    csvRows.push([t('analytics.csv.metric'), t('analytics.csv.count')]);
    csvRows.push([t('analytics.totalPasses'), analyticsData.overview.total]);
    csvRows.push([t('analytics.activeToday'), analyticsData.overview.activeToday]);
    csvRows.push([t('analytics.checkedInNow'), analyticsData.overview.checkedInNow]);
    csvRows.push([t('analytics.completedToday'), analyticsData.overview.completedToday]);
    csvRows.push([t('analytics.pending'), analyticsData.overview.pending]);
    csvRows.push([t('analytics.expired'), analyticsData.overview.expired]);
    csvRows.push([t('analytics.cancelled'), analyticsData.overview.cancelled]);
    csvRows.push([]);
    
    csvRows.push([t('analytics.csv.passesByPurpose')]);
    csvRows.push([t('analytics.csv.purpose'), t('analytics.csv.count')]);
    analyticsData.byPurpose.forEach(item => {
      csvRows.push([item.purpose, item.count]);
    });
    csvRows.push([]);
    
    csvRows.push([t('analytics.csv.guardPerformance')]);
    csvRows.push([t('analytics.table.guardName'), t('analytics.table.checkIns'), t('analytics.table.checkOuts'), t('analytics.csv.total')]);
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('analytics.msg.accessDenied')}</h2>
          <p className="text-gray-600 mb-4">
            {t('analytics.msg.accessDeniedDesc')}
          </p>
          <p className="text-sm text-gray-500">{t('analytics.msg.redirecting')}</p>
        </div>
      </div>
    );
  }

  if (loading && !analyticsData) {
    return <AnalyticsShimmer />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('analytics.msg.errorLoading')}</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('analytics.msg.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        
        {/* Hero Header with Gradient Background - Master Dashboard Style */}
        <div className="relative bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl shadow-[0_8px_30px_rgba(37,99,235,0.25)] p-6 md:p-8 overflow-visible animate-fade-in">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-10 overflow-hidden rounded-2xl">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse-glow"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-300 rounded-full blur-3xl animate-pulse-glow" style={{animationDelay: '1s'}}></div>
          </div>
          
          {/* Content */}
          <div className="relative z-10">
            <div className="flex flex-col gap-4">
              {/* Top Row: Title and Language Selector */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                    <BarChart3 className="w-7 h-7 md:w-8 md:h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl md:text-4xl font-bold text-white">
                      {t('analytics.title')}
                    </h1>
                    <p className="text-blue-100 text-sm md:text-base mt-1">
                      {t('analytics.subtitle')}
                    </p>
                  </div>
                </div>
                {/* Language Selector */}
                <div className="flex-shrink-0">
                  <LanguageSelector />
                </div>
              </div>
              
              {/* Bottom Row: Action Buttons */}
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={fetchAnalytics}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-xl hover:bg-white/30 transition-all font-medium hover-lift disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">{t('analytics.refresh')}</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all font-bold shadow-lg hover:shadow-xl hover-lift"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden md:inline">{t('analytics.export')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-5 md:p-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 rounded-xl shadow-lg">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">{t('analytics.filterData')}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {t('analytics.dateFrom')}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {t('analytics.dateTo')}
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {t('analytics.purpose')}
              </label>
              <div className="relative">
                <select
                  value={purposeFilter}
                  onChange={(e) => setPurposeFilter(e.target.value)}
                  className="w-full px-3 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 bg-white"
                >
                  <option value="all">{t('common.allPurposes')}</option>
                  <option value="meeting">{t('analytics.purpose.meeting')}</option>
                  <option value="delivery">{t('analytics.purpose.delivery')}</option>
                  <option value="maintenance">{t('analytics.purpose.maintenance')}</option>
                  <option value="event">{t('analytics.purpose.event')}</option>
                  <option value="interview">{t('analytics.purpose.interview')}</option>
                  <option value="personal">{t('analytics.purpose.personal')}</option>
                  <option value="other">{t('analytics.purpose.other')}</option>
                </select>
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {t('allPasses.status')}
              </label>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 bg-white"
                >
                  <option value="all">{t('common.allStatus')}</option>
                  <option value="created">{t('analytics.status.created')}</option>
                  <option value="checked_in">{t('analytics.status.checkedIn')}</option>
                  <option value="checked_out">{t('analytics.status.checkedOut')}</option>
                  <option value="cancelled">{t('analytics.status.cancelled')}</option>
                  <option value="expired">{t('analytics.status.expired')}</option>
                </select>
                <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {t('analytics.vehicle')}
              </label>
              <div className="relative">
                <select
                  value={vehicleTypeFilter}
                  onChange={(e) => setVehicleTypeFilter(e.target.value)}
                  className="w-full px-3 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 bg-white"
                >
                  <option value="all">{t('common.allTypes')}</option>
                  <option value="none">{t('analytics.vehicle.none')}</option>
                  <option value="two_wheeler">{t('analytics.vehicle.twoWheeler')}</option>
                  <option value="four_wheeler">{t('analytics.vehicle.fourWheeler')}</option>
                  <option value="other">{t('analytics.vehicle.other')}</option>
                </select>
                <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleApplyFilters}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {t('analytics.applyFilters')}
            </button>
            <button
              onClick={handleResetFilters}
              className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              {t('analytics.reset')}
            </button>
          </div>
        </div>

        {/* Overview Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 animate-slide-up">
          <StatCard
            icon={Users}
            label={t('analytics.totalPasses')}
            value={analyticsData.overview.total}
            color="blue"
          />
          <StatCard
            icon={Calendar}
            label={t('analytics.activeToday')}
            value={analyticsData.overview.activeToday}
            color="indigo"
          />
          <StatCard
            icon={Activity}
            label={t('analytics.checkedInNow')}
            value={analyticsData.overview.checkedInNow}
            color="green"
          />
          <StatCard
            icon={CheckCircle}
            label={t('analytics.completedToday')}
            value={analyticsData.overview.completedToday}
            color="green"
          />
          <StatCard
            icon={CheckCircle}
            label={t('analytics.totalCompleted')}
            value={analyticsData.overview.totalCompleted}
            color="purple"
          />
          <StatCard
            icon={Clock}
            label={t('analytics.pending')}
            value={analyticsData.overview.pending}
            color="yellow"
          />
          <StatCard
            icon={AlertCircle}
            label={t('analytics.expired')}
            value={analyticsData.overview.expired}
            color="red"
          />
          <StatCard
            icon={XCircle}
            label={t('analytics.cancelled')}
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
              {t('analytics.chart.dailyTrend')}
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
              {t('analytics.chart.passesByPurpose')}
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
              {t('analytics.chart.statusDistribution')}
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
              {t('analytics.chart.vehicleStats')}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  { type: t('analytics.vehicle.none'), count: analyticsData.vehicleStats.withoutVehicle },
                  { type: t('analytics.vehicle.twoWheeler'), count: analyticsData.vehicleStats.twoWheeler },
                  { type: t('analytics.vehicle.fourWheeler'), count: analyticsData.vehicleStats.fourWheeler },
                  { type: t('analytics.vehicle.other'), count: analyticsData.vehicleStats.other }
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

        {/* Guest House Booking Analytics */}
        {analyticsData.guestHouseStats && analyticsData.guestHouseStats.totalBookings > 0 && (
          <>
            {/* Guest House Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-indigo-500 to-purple-500">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">{analyticsData.guestHouseStats.totalBookings}</p>
                    <p className="text-xs font-medium text-gray-600">{t('analytics.gh.totalBookings')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-green-500 to-emerald-500">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(analyticsData.guestHouseStats.totalRevenue)}</p>
                    <p className="text-xs font-medium text-gray-600">{t('analytics.gh.totalRevenue')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(analyticsData.guestHouseStats.avgRevenue)}</p>
                    <p className="text-xs font-medium text-gray-600">{t('analytics.gh.avgRevenue')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-red-500 to-pink-500">
                    <XCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{analyticsData.guestHouseStats.cancelled}</p>
                    <p className="text-xs font-medium text-gray-600">{t('analytics.gh.cancelledBookings')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Guest House Booking Status + Top Guest Houses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Booking Status Breakdown */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  {t('analytics.gh.bookingStatus')}
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: t('analytics.gh.status.pending'), value: analyticsData.guestHouseStats.pending },
                        { name: t('analytics.gh.status.confirmed'), value: analyticsData.guestHouseStats.confirmed },
                        { name: t('analytics.gh.status.completed'), value: analyticsData.guestHouseStats.completed },
                        { name: t('analytics.gh.status.cancelled'), value: analyticsData.guestHouseStats.cancelled },
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.name}: ${entry.value}`}
                      outerRadius={90}
                      dataKey="value"
                    >
                      <Cell fill="#F59E0B" />
                      <Cell fill="#22C55E" />
                      <Cell fill="#6B7280" />
                      <Cell fill="#EF4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top Guest Houses */}
              {analyticsData.topGuestHouses && analyticsData.topGuestHouses.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    {t('analytics.gh.topGuestHouses')}
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={analyticsData.topGuestHouses}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }}
                        formatter={(value: any, name: string) => [name === 'revenue' ? formatCurrency(value) : value, name === 'revenue' ? t('analytics.gh.revenue') : t('analytics.gh.bookingsCount')]}
                      />
                      <Legend />
                      <Bar dataKey="bookings" fill="#6366F1" name={t('analytics.gh.bookingsCount')} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Refund Summary */}
            {analyticsData.refundStats && analyticsData.refundStats.totalRefunds > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-red-600" />
                  {t('analytics.gh.refundSummary')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('analytics.gh.totalRefunds')}</p>
                    <p className="text-2xl font-bold text-gray-900">{analyticsData.refundStats.totalRefunds}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('analytics.gh.refundedAmount')}</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(analyticsData.refundStats.totalRefundAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('analytics.gh.originalAmount')}</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(analyticsData.refundStats.totalOriginalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{t('analytics.gh.cancellationFees')}</p>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(analyticsData.refundStats.totalCancellationFees)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Bookings Table */}
            {analyticsData.recentBookings && analyticsData.recentBookings.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  {t('analytics.gh.recentBookings')}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.gh.table.visitor')}</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.gh.table.guestHouse')}</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.gh.table.room')}</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.gh.table.dates')}</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('analytics.gh.table.price')}</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('analytics.gh.table.status')}</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('analytics.gh.table.payment')}</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.gh.table.refund')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {analyticsData.recentBookings.map((booking, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-3 text-sm">
                            <div className="font-medium text-gray-900">{booking.visitorName}</div>
                            <div className="text-xs text-gray-500">{booking.passId}</div>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900">{booking.guestHouse}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">{booking.roomNumber}</td>
                          <td className="px-3 py-3 text-sm text-gray-700">
                            {booking.checkIn ? formatDate(booking.checkIn) : '-'} → {booking.checkOut ? formatDate(booking.checkOut) : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(booking.totalPrice)}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              booking.bookingStatus === 'confirmed' ? 'bg-green-100 text-green-800' :
                              booking.bookingStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
                              booking.bookingStatus === 'completed' ? 'bg-gray-100 text-gray-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {booking.bookingStatus}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              booking.paymentStatus === 'verified' ? 'bg-green-100 text-green-800' :
                              booking.paymentStatus === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {booking.paymentStatus}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {booking.refund ? (
                              <div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  booking.refund.refundStatus === 'completed' || booking.refund.refundStatus === 'processed' ? 'bg-green-100 text-green-800' :
                                  booking.refund.refundStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {formatCurrency(booking.refund.refundAmount)}
                                </span>
                                <div className="text-xs text-gray-500 mt-1">
                                  Fee: {booking.refund.cancellationFeePercent}% ({formatCurrency(booking.refund.cancellationFee)})
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Extension Stats */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            {t('analytics.chart.extensionStats')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-2">{t('analytics.extension.total')}</p>
              <p className="text-3xl font-bold text-gray-900">{analyticsData.extensionStats.totalExtensions}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">{t('analytics.extension.avgPerPass')}</p>
              <p className="text-3xl font-bold text-gray-900">{analyticsData.extensionStats.avgExtensionCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">{t('analytics.extension.rate')}</p>
              <p className="text-3xl font-bold text-purple-600">{analyticsData.extensionStats.extensionRate}%</p>
            </div>
          </div>
        </div>

        {/* Guard Performance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            {t('analytics.chart.guardPerformance')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.table.guardName')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('analytics.table.checkIns')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('analytics.table.checkOuts')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('analytics.table.totalProcessed')}</th>
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
                      {t('analytics.empty.noGuardActivity')}
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
            {t('analytics.chart.topCreators')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.table.name')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.table.department')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('analytics.table.passesCreated')}</th>
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

        {/* Currently Checked-In Visitors (Inside Campus) */}
        <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-green-600" />
            {t('analytics.checkedIn.title')}
            {analyticsData.checkedInVisitors && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                {analyticsData.checkedInVisitors.length} {t('analytics.checkedIn.inside')}
              </span>
            )}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-green-50 border-b border-green-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.checkedIn.visitor')}</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.checkedIn.purpose')}</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.checkedIn.entryTime')}</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.checkedIn.gate')}</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.checkedIn.meetingWith')}</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('analytics.checkedIn.vehicle')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analyticsData.checkedInVisitors && analyticsData.checkedInVisitors.map((visitor, index) => (
                  <tr key={index} className="hover:bg-green-50">
                    <td className="px-3 py-3 text-sm">
                      <div className="font-medium text-gray-900">{visitor.visitorName}</div>
                      <div className="text-xs text-gray-500">{visitor.phone} · {visitor.passId}</div>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {formatAction(visitor.purpose)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {visitor.entryTime ? new Date(visitor.entryTime).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      }) : '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{visitor.entryGate}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <div>{visitor.personToMeet}</div>
                      <div className="text-xs text-gray-500">{visitor.department}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {visitor.hasVehicle ? (
                        <div>
                          <span className="text-xs">{visitor.vehicleType?.replace('_', ' ')}</span>
                          {visitor.vehicleNumber && <div className="text-xs font-mono text-gray-500">{visitor.vehicleNumber}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!analyticsData.checkedInVisitors || analyticsData.checkedInVisitors.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {t('analytics.checkedIn.noVisitors')}
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
    blue: { bg: 'bg-gradient-to-br from-blue-500 to-cyan-500', text: 'text-blue-600' },
    indigo: { bg: 'bg-gradient-to-br from-indigo-500 to-purple-500', text: 'text-indigo-600' },
    green: { bg: 'bg-gradient-to-br from-green-500 to-emerald-500', text: 'text-green-600' },
    yellow: { bg: 'bg-gradient-to-br from-yellow-500 to-orange-500', text: 'text-yellow-600' },
    red: { bg: 'bg-gradient-to-br from-red-500 to-pink-500', text: 'text-red-600' },
    orange: { bg: 'bg-gradient-to-br from-orange-500 to-amber-500', text: 'text-orange-600' },
    purple: { bg: 'bg-gradient-to-br from-purple-500 to-pink-500', text: 'text-purple-600' },
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 hover-lift animate-fade-in">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${colorClasses[color].bg}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className={`text-2xl font-bold ${colorClasses[color].text}`}>{new Intl.NumberFormat('en-IN').format(value)}</p>
          <p className="text-xs font-medium text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Wrap with LanguageProvider
export default function GateEntryAnalyticsPage() {
  return (
    <LanguageProvider>
      <GateEntryAnalyticsPageContent />
    </LanguageProvider>
  );
}
