'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
 ArrowLeft, TrendingUp, TrendingDown, Users, UserCheck, UserX, UserMinus, Clock,
  Calendar, Loader2, AlertCircle, Download, BarChart3, PieChart, Activity,
  IndianRupee, Search, Filter, RefreshCw, Eye, LogIn, LogOut, Shield,
  ChevronDown, ChevronUp, FileSpreadsheet, Percent, Target, Zap, CheckCircle2,
  XCircle, ArrowUpRight, Settings, QrCode, UserPlus, MapPin, Globe, Award,
  Trash2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend,
} from 'recharts';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, EventStatistics, EventVolunteer } from '@/features/event-management/types/event.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';

// ── Design System Constants ──────────────────────────────────────
const CARD = 'bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-sgt-300 dark:border-sgt-600 shadow-sgt';
const CARD_HEADER = 'px-5 py-3.5 border-b border-gray-100 dark:border-gray-700';
const METRIC_CARD = `${CARD} p-5 hover:shadow-sgt-lg hover:-translate-y-0.5 transition-all duration-200`;

const STATUS_COLORS = {
  confirmed: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', chart: '#10b981' },
  pending: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', chart: '#f59e0b' },
  cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500', chart: '#ef4444' },
  waitlisted: { bg: 'bg-gray-50 dark:bg-gray-700/30', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-500', chart: '#6b7280' },
};

const CHART_COLORS = ['#0F2573', '#266CA9', '#4BBAF2', '#ADE1FB', '#041D56'];

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  department?: string;
  uid?: string;
}

type TabType = 'overview' | 'registrations' | 'volunteers' | 'analytics';

const VALID_TABS: TabType[] = ['overview', 'registrations', 'volunteers', 'analytics'];

export default function EventManagementPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const eventId = params.id as string;

  // Tab from URL (persists on refresh & back navigation)
  const tabFromUrl = searchParams.get('tab') as TabType | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview';

  // ── State ──────────────────────────────────────────────────────
  const [event, setEvent] = useState<Event | null>(null);
  const [statistics, setStatistics] = useState<EventStatistics | null>(null);
  const [volunteers, setVolunteers] = useState<EventVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Sync activeTab when URL tab changes (e.g. back from volunteer detail)
  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Volunteer Management State
  const [assigning, setAssigning] = useState(false);
  const [volunteerSearchQuery, setVolunteerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');
  const [volunteerRole, setVolunteerRole] = useState('');
  const [assignedGate, setAssignedGate] = useState('');
  const [canScanQr, setCanScanQr] = useState(false);

  // ── Data Loading ───────────────────────────────────────────────
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventData, statsData, volunteersData] = await Promise.all([
        eventService.getEventById(eventId),
        eventService.getStatistics(eventId),
        eventService.getVolunteers(eventId)
      ]);
      setEvent(eventData);
      setStatistics(statsData);
      setVolunteers(volunteersData);
    } catch (error: any) {
      toast({
        type: 'error',
        message: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [statsData, volunteersData] = await Promise.all([
        eventService.getStatistics(eventId),
        eventService.getVolunteers(eventId)
      ]);
      setStatistics(statsData);
      setVolunteers(volunteersData);
      toast({ type: 'success', message: 'Data refreshed' });
    } catch (error: any) {
      toast({ type: 'error', message: 'Failed to refresh data' });
    } finally {
      setRefreshing(false);
    }
  };

  // ── Computed Metrics ───────────────────────────────────────────
  const attendanceRate = useMemo(() => {
    if (!statistics || statistics.confirmedRegistrations === 0) return 0;
    const attended = statistics.totalAttended ?? 0;
    return Math.round((attended / statistics.confirmedRegistrations) * 100);
  }, [statistics]);

  const confirmationRate = useMemo(() => {
    if (!statistics || statistics.totalRegistrations === 0) return 0;
    return Math.round((statistics.confirmedRegistrations / statistics.totalRegistrations) * 100);
  }, [statistics]);

  const capacityUsage = useMemo(() => {
    if (!event?.maxCapacity || !statistics) return null;
    return Math.round((statistics.totalRegistrations / event.maxCapacity) * 100);
  }, [event, statistics]);

  const registrationData = useMemo(() => {
    if (!statistics) return [];
    return [
      { name: 'Confirmed', value: statistics.confirmedRegistrations, color: STATUS_COLORS.confirmed.chart },
      { name: 'Pending', value: statistics.pendingRegistrations, color: STATUS_COLORS.pending.chart },
      { name: 'Cancelled', value: statistics.cancelledRegistrations, color: STATUS_COLORS.cancelled.chart },
      { name: 'Waitlisted', value: statistics.waitlistedRegistrations, color: STATUS_COLORS.waitlisted.chart },
    ].filter((d) => d.value > 0);
  }, [statistics]);

  const pieData = useMemo(() => registrationData, [registrationData]);

  const trendData = useMemo(() => {
    if (!statistics?.registrationsByDate) return [];
    let cumulative = 0;
    return statistics.registrationsByDate.map((d) => {
      cumulative += d.count;
      return {
        date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        daily: d.count,
        cumulative,
      };
    });
  }, [statistics]);

  const filteredRegistrations = useMemo(() => {
    if (!statistics?.recentRegistrations) return [];
    let list = statistics.recentRegistrations;
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.user?.name?.toLowerCase().includes(q) ||
          r.user?.email?.toLowerCase().includes(q) ||
          r.user?.uid?.toLowerCase().includes(q) ||
          r.registrationId?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [statistics, statusFilter, searchQuery]);

  // ── Volunteer Management Functions ────────────────────────────
  const handleSearchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const results = await eventService.searchStudentsForVolunteer(query.trim());
      setSearchResults(results.map(r => ({
        id: r.id,
        name: r.name || r.uid || 'Unknown',
        email: r.email || '',
        department: r.department,
        uid: r.uid,
      })));
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUserId(user.id);
    setSelectedUserName(user.name);
    setVolunteerSearchQuery('');
    setSearchResults([]);
  };

  const handleAssignVolunteer = async () => {
    if (!selectedUserId) {
      toast({ type: 'error', message: 'Please select a user' });
      return;
    }

    if (!volunteerRole.trim()) {
      toast({ type: 'error', message: 'Please specify a role' });
      return;
    }

    try {
      setAssigning(true);
      await eventService.assignVolunteer(eventId, {
        userId: selectedUserId,
        role: volunteerRole.trim(),
        assignedGate: assignedGate.trim() || undefined,
        canScanQr
      });

      toast({ type: 'success', message: 'Volunteer assigned successfully' });
      
      // Reset form
      setSelectedUserId('');
      setSelectedUserName('');
      setVolunteerRole('');
      setAssignedGate('');
      setCanScanQr(false);
      
      // Reload volunteers
      const volunteersData = await eventService.getVolunteers(eventId);
      setVolunteers(volunteersData);
    } catch (error: any) {
      toast({
        type: 'error',
        message: getErrorMessage(error)
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveVolunteer = async (volunteerId: string) => {
    if (!confirm('Are you sure you want to remove this volunteer?')) {
      return;
    }

    try {
      await eventService.removeVolunteer(eventId, volunteerId);
      toast({ type: 'success', message: 'Volunteer removed successfully' });
      const volunteersData = await eventService.getVolunteers(eventId);
      setVolunteers(volunteersData);
    } catch (error: any) {
      toast({
        type: 'error',
        message: getErrorMessage(error)
      });
    }
  };

  const handleToggleQrPermission = async (volunteerId: string, currentStatus: boolean) => {
    try {
      await eventService.updateVolunteer(eventId, volunteerId, {
        canScanQr: !currentStatus
      });
      toast({ 
        type: 'success', 
        message: `QR scanning permission ${!currentStatus ? 'granted' : 'revoked'}` 
      });
      const volunteersData = await eventService.getVolunteers(eventId);
      setVolunteers(volunteersData);
    } catch (error: any) {
      toast({
        type: 'error',
        message: getErrorMessage(error)
      });
    }
  };

  // ── CSV Export ─────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (!statistics?.recentRegistrations || !event) return;

    const headers = ['Registration ID', 'Name', 'UID', 'Email', 'Status', 'Payment Status', 'Amount Paid', 'Entered', 'Registered At'];
    const rows = statistics.recentRegistrations.map((r) => [
      r.registrationId,
      r.user?.name || 'N/A',
      r.user?.uid || 'N/A',
      r.user?.email || 'N/A',
      r.status,
      r.paymentStatus || 'N/A',
      r.amountPaid || '0',
      r.hasEntered ? 'Yes' : 'No',
      r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : 'N/A',
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.name.replace(/\s+/g, '_')}_registrations_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', message: 'CSV exported' });
  }, [statistics, event, toast]);

  // ── Loading & Error States ─────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-sgt-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading event management...</p>
        </div>
      </div>
    );
  }

  if (!event || !statistics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Data Not Available</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Unable to load event management data</p>
          <Link
            href="/events/my-events"
            className="inline-flex items-center gap-2 px-6 py-3 bg-sgt-600 text-white rounded-lg hover:bg-sgt-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Events
          </Link>
        </div>
      </div>
    );
  }

  // ── Event Status Badge ─────────────────────────────────────────
  const statusBadge = () => {
    const map: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      published: 'bg-sgt-50 text-sgt-700 dark:bg-sgt-900/30 dark:text-sgt-300',
      ongoing: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${map[event.status] || map.draft}`}>
        {event.status}
      </span>
    );
  };

  // ── Metric Card Component ──────────────────────────────────────
  const MetricCard = ({
    icon: Icon,
    iconBg,
    label,
    value,
    subtitle,
    trend,
  }: {
    icon: any;
    iconBg: string;
    label: string;
    value: string | number;
    subtitle?: string;
    trend?: { value: string; positive: boolean } | null;
  }) => (
    <div className={METRIC_CARD}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trend.positive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
            {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.value}
          </span>
        )}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{subtitle}</p>}
    </div>
  );

  // ── Tab Navigation ─────────────────────────────────────────────
  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'registrations', label: 'Registrations', icon: Users },
    { id: 'volunteers', label: 'Volunteer Management', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/events/${eventId}`}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sgt-600 dark:text-sgt-400"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Event Management
                  </h1>
                  {statusBadge()}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-md truncate">
                  {event.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {activeTab === 'registrations' && (
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-sgt-600 rounded-lg hover:bg-sgt-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  router.replace(`/events/${eventId}/management?tab=${tab.id}`, { scroll: false });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-sgt-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard
                icon={Users}
                iconBg="bg-sgt-50 text-sgt-600 dark:bg-sgt-900/30 dark:text-sgt-400"
                label="Total Registrations"
                value={statistics.totalRegistrations}
                subtitle={capacityUsage ? `${capacityUsage}% of capacity` : undefined}
              />
              <MetricCard
                icon={UserCheck}
                iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                label="Confirmed"
                value={statistics.confirmedRegistrations}
                trend={{ value: `${confirmationRate}%`, positive: confirmationRate >= 50 }}
              />
              <MetricCard
                icon={Clock}
                iconBg="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                label="Pending"
                value={statistics.pendingRegistrations}
              />
              <MetricCard
                icon={UserX}
                iconBg="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                label="Cancelled"
                value={statistics.cancelledRegistrations}
              />
              <MetricCard
                icon={Activity}
                iconBg="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                label="Attended"
                value={statistics.totalAttended}
                trend={{ value: `${attendanceRate}%`, positive: attendanceRate >= 50 }}
              />
              <MetricCard
                icon={Shield}
                iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                label="Volunteers"
                value={volunteers.length}
              />
            </div>

            {/* Revenue + Capacity Row (conditional) */}
            {(event.paymentType === 'paid' || event.maxCapacity) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {event.paymentType === 'paid' && (
                  <div className={METRIC_CARD}>
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-sgt-500 to-sgt-700 text-white">
                        <IndianRupee className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          ₹{statistics.totalRevenue?.toLocaleString('en-IN') || 0}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Fee: ₹{event.registrationFee?.toLocaleString('en-IN') || 0} × {statistics.confirmedRegistrations} confirmed
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {event.maxCapacity && (
                  <div className={METRIC_CARD}>
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                        <Target className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Capacity</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                          {statistics.totalRegistrations} / {event.maxCapacity}
                        </p>
                        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sgt-400 to-sgt-600 transition-all duration-500"
                            style={{ width: `${Math.min(Number(capacityUsage || 0), 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {Number(capacityUsage || 0) >= 90 ? '⚠️ Almost full' : `${capacityUsage}% filled`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Registration Trend */}
              <div className={`${CARD} lg:col-span-2 overflow-hidden`}>
                <div className={CARD_HEADER}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sgt-500" />
                    Registration Trend
                  </h3>
                </div>
                <div className="p-4 h-[280px]">
                  {trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0F2573" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#0F2573" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorDaily" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4BBAF2" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4BBAF2" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 14px rgba(4,29,86,0.15)',
                            fontSize: '12px',
                          }}
                        />
                        <Area type="monotone" dataKey="cumulative" stroke="#0F2573" strokeWidth={2} fill="url(#colorCum)" name="Cumulative" />
                        <Area type="monotone" dataKey="daily" stroke="#4BBAF2" strokeWidth={2} fill="url(#colorDaily)" name="Daily" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                      <div className="text-center">
                        <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No registration data yet</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Breakdown Pie */}
              <div className={`${CARD} overflow-hidden`}>
                <div className={CARD_HEADER}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-sgt-500" />
                    Status Breakdown
                  </h3>
                </div>
                <div className="p-4 h-[280px]">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="45%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            fontSize: '12px',
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                          iconSize={8}
                          formatter={(value: string) => (
                            <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>
                          )}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <div className="text-center">
                        <PieChart className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No status data</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Entry/Exit + Conversion Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Attendance Ring */}
              <div className={`${CARD} overflow-hidden`}>
                <div className={CARD_HEADER}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sgt-500" />
                    Attendance Rate
                  </h3>
                </div>
                <div className="p-6 flex flex-col items-center">
                  <div className="relative w-32 h-32 mb-4">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                      <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
                      <circle
                        cx="64" cy="64" r="56"
                        stroke="url(#attendGrad)"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        strokeDashoffset={`${2 * Math.PI * 56 * (1 - attendanceRate / 100)}`}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="attendGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#0F2573" />
                          <stop offset="100%" stopColor="#4BBAF2" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">{attendanceRate}%</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Attended</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    {statistics.totalAttended} of {statistics.totalRegistrations} registered
                  </p>
                </div>
              </div>

              {/* Entry/Exit Card */}
              <div className={`${CARD} overflow-hidden`}>
                <div className={CARD_HEADER}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-sgt-500" />
                    Entry &amp; Exit
                  </h3>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <LogIn className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{statistics.totalEntries || 0}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Entries</p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <LogOut className="w-5 h-5 text-red-600 dark:text-red-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-red-600 dark:text-red-400">{statistics.totalExits || 0}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Exits</p>
                    </div>
                    <div className="p-3 bg-sgt-50 dark:bg-sgt-900/20 rounded-lg">
                      <Eye className="w-5 h-5 text-sgt-600 dark:text-sgt-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-sgt-600 dark:text-sgt-400">{statistics.currentlyInside || 0}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Inside</p>
                    </div>
                  </div>
                  {(statistics.totalEntries || 0) > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Entry flow</span>
                        <span>{(statistics.totalExits || 0) > 0 ? (((statistics.totalExits || 0) / (statistics.totalEntries || 1)) * 100).toFixed(0) : 0}% exited</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full" style={{ width: `${(statistics.totalEntries || 0) > 0 ? (((statistics.totalEntries || 0) - (statistics.totalExits || 0)) / (statistics.totalEntries || 1)) * 100 : 0}%` }} />
                        <div className="bg-red-400 h-full" style={{ width: `${(statistics.totalEntries || 0) > 0 ? ((statistics.totalExits || 0) / (statistics.totalEntries || 1)) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Conversion Funnel */}
              <div className={`${CARD} overflow-hidden`}>
                <div className={CARD_HEADER}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Percent className="w-4 h-4 text-sgt-500" />
                    Conversion Funnel
                  </h3>
                </div>
                <div className="p-6 space-y-3">
                  {[
                    { label: 'Registered', value: statistics.totalRegistrations, pct: 100, color: 'bg-sgt-500' },
                    { label: 'Confirmed', value: statistics.confirmedRegistrations, pct: statistics.totalRegistrations > 0 ? (statistics.confirmedRegistrations / statistics.totalRegistrations) * 100 : 0, color: 'bg-emerald-500' },
                    { label: 'Attended', value: statistics.totalAttended, pct: statistics.totalRegistrations > 0 ? (statistics.totalAttended / statistics.totalRegistrations) * 100 : 0, color: 'bg-purple-500' },
                  ].map((step) => (
                    <div key={step.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{step.label}</span>
                        <span className="text-gray-500">{step.value} ({step.pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${step.color} transition-all duration-700`} style={{ width: `${step.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 text-center">
                      Overall Conversion: <span className="font-bold text-gray-700 dark:text-gray-300">
                        {statistics.totalRegistrations > 0 ? ((statistics.totalAttended / statistics.totalRegistrations) * 100).toFixed(1) : 0}%
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Registrations Tab */}
        {activeTab === 'registrations' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, UID, or registration ID..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
              >
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
                <option value="waitlisted">Waitlisted</option>
              </select>
            </div>

            {/* Registrations List */}
            <div className={CARD}>
              <div className={CARD_HEADER}>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Registrations ({filteredRegistrations.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Participant
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Registration ID
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Registered At
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Attendance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRegistrations.length > 0 ? (
                      filteredRegistrations.map((reg) => (
                        <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-5 py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {reg.user?.name || 'N/A'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {reg.user?.email || 'N/A'}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-mono text-gray-900 dark:text-white">
                              {reg.registrationId}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.bg || 'bg-gray-100'} ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.text || 'text-gray-600'}`}>
                              {reg.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }) : 'N/A'}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            {reg.hasEntered ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-400" />
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center">
                          <p className="text-gray-500 dark:text-gray-400">No registrations found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Volunteers Tab */}
        {activeTab === 'volunteers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Assign New Volunteer Form */}
            <div className="lg:col-span-1">
              <div className={`${CARD} overflow-hidden sticky top-24`}>
                <div className="bg-gradient-to-r from-sgt-500 to-indigo-600 px-5 py-3">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Assign Volunteer
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  {/* User Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Search Student <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Students only</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={selectedUserName || volunteerSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVolunteerSearchQuery(val);
                          if (!val) {
                            setSelectedUserId('');
                            setSelectedUserName('');
                            setSearchResults([]);
                            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                            return;
                          }
                          if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                          searchDebounceRef.current = setTimeout(() => handleSearchUsers(val), 300);
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                        placeholder="Search by UID, name or email..."
                        disabled={!!selectedUserId}
                      />
                      {selectedUserId && (
                        <button
                          onClick={() => {
                            setSelectedUserId('');
                            setSelectedUserName('');
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    {/* Search Results Dropdown */}
                    {searching && (
                      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-sgt-500 mx-auto" />
                      </div>
                    )}
                    {searchResults.length > 0 && !selectedUserId && (
                      <div className="mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => handleSelectUser(user)}
                            className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.name}
                              {user.uid && <span className="text-gray-500 font-normal ml-1">({user.uid})</span>}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {user.email}
                              {user.department && ` • ${user.department}`}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={volunteerRole}
                      onChange={(e) => setVolunteerRole(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                      placeholder="e.g., Entry Manager, Support Staff"
                    />
                  </div>

                  {/* Assigned Gate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Assigned Gate
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={assignedGate}
                        onChange={(e) => setAssignedGate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                        placeholder="e.g., Gate A, Main Entry"
                      />
                    </div>
                  </div>

                  {/* QR Scanning Permission */}
                  <div>
                    <label className="flex items-center gap-3 p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-sgt-400 dark:hover:border-sgt-500 transition-all">
                      <input
                        type="checkbox"
                        checked={canScanQr}
                        onChange={(e) => setCanScanQr(e.target.checked)}
                        className="w-4 h-4 text-sgt-600 focus:ring-sgt-500 rounded"
                      />
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Allow QR Scanning
                        </span>
                      </div>
                    </label>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Grant permission to scan attendee QR codes
                    </p>
                  </div>

                  {/* Assign Button */}
                  <button
                    onClick={handleAssignVolunteer}
                    disabled={assigning || !selectedUserId}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-sgt-500 to-indigo-600 text-white font-medium rounded-lg hover:from-sgt-600 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assigning ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Assign Volunteer
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Volunteers List */}
            <div className="lg:col-span-2">
              <div className={CARD}>
                <div className={CARD_HEADER}>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Current Volunteers ({volunteers.length})
                  </h3>
                </div>
                <div className="p-5">
                  {volunteers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        No volunteers assigned yet
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        Assign volunteers using the form on the left
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {volunteers.map((volunteer) => (
                        <div
                          key={volunteer.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => router.push(`/events/${eventId}/volunteers/${volunteer.id}`)}
                          onKeyDown={(e) => e.key === 'Enter' && router.push(`/events/${eventId}/volunteers/${volunteer.id}`)}
                          className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-sgt-300 dark:hover:border-sgt-600 transition-all cursor-pointer group"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-base font-semibold text-gray-900 dark:text-white group-hover:text-sgt-600 dark:group-hover:text-sgt-400 transition-colors">
                                  {volunteer.user?.name || 'Unknown User'}
                                </h4>
                                <span className="px-2 py-1 bg-sgt-100 text-sgt-800 dark:bg-sgt-900/30 dark:text-sgt-300 rounded-full text-xs font-medium">
                                  {volunteer.role}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-sgt-600 dark:group-hover:text-sgt-400">
                                  View activity →
                                </span>
                              </div>
                              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                <p>{volunteer.user?.email || 'No email'}</p>
                                {volunteer.assignedGate && (
                                  <p className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {volunteer.assignedGate}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleQrPermission(volunteer.id, volunteer.canScanQr); }}
                                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                      volunteer.canScanQr
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                                    }`}
                                  >
                                    {volunteer.canScanQr ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3" />
                                        QR Enabled
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-3 h-3" />
                                        QR Disabled
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveVolunteer(volunteer.id); }}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Remove volunteer"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Daily Registrations Bar Chart */}
            <div className={`${CARD} overflow-hidden`}>
              <div className={CARD_HEADER}>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sgt-500" />
                  Daily Registrations
                </h3>
              </div>
              <div className="p-4 h-[320px]">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="daily" fill="#0F2573" radius={[4, 4, 0, 0]} name="Registrations" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No daily data yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analytics Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Registration Velocity */}
              <div className={`${CARD} overflow-hidden`}>
                <div className={CARD_HEADER}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-sgt-500" />
                    Registration Velocity
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  {(() => {
                    const days = trendData.length || 1;
                    const avgPerDay = (statistics.totalRegistrations / days).toFixed(1);
                    const peakDay = trendData.reduce((max, d) => (d.daily > max.daily ? d : max), trendData[0] || { date: 'N/A', daily: 0 });
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Avg / Day</span>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{avgPerDay}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Peak Day</span>
                          <span className="text-sm font-semibold text-sgt-600 dark:text-sgt-400">{peakDay.date} ({peakDay.daily})</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Total Days</span>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{days}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Registration Health */}
              <div className={`${CARD} overflow-hidden`}>
                <div className={CARD_HEADER}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sgt-500" />
                    Registration Health
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { label: 'Confirmation Rate', value: confirmationRate, color: confirmationRate >= 70 ? 'text-emerald-600' : confirmationRate >= 40 ? 'text-amber-600' : 'text-red-600' },
                    { label: 'Attendance Rate', value: attendanceRate, color: attendanceRate >= 70 ? 'text-emerald-600' : attendanceRate >= 40 ? 'text-amber-600' : 'text-red-600' },
                    { label: 'Cancellation Rate', value: statistics.totalRegistrations > 0 ? Number(((statistics.cancelledRegistrations / statistics.totalRegistrations) * 100).toFixed(1)) : 0, color: 'text-red-500' },
                  ].map((metric) => (
                    <div key={metric.label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{metric.label}</span>
                      <span className={`text-lg font-bold ${metric.color}`}>{metric.value}%</span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      {confirmationRate >= 60 && attendanceRate >= 40 ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs text-emerald-600 font-medium">Healthy event metrics</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <span className="text-xs text-amber-600 font-medium">Some metrics need attention</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Score Card */}
              <div className={`${CARD} overflow-hidden`}>
                <div className={CARD_HEADER}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-sgt-500" />
                    Event Score
                  </h3>
                </div>
                <div className="p-5 flex flex-col items-center">
                  {(() => {
                    let score = 0;
                    if (statistics.totalRegistrations > 0) score += 20;
                    if (statistics.totalRegistrations >= 10) score += 10;
                    if (confirmationRate >= 50) score += 20;
                    if (confirmationRate >= 80) score += 10;
                    if (attendanceRate >= 30) score += 15;
                    if (attendanceRate >= 60) score += 10;
                    if (volunteers.length >= 1) score += 10;
                    if (statistics.cancelledRegistrations / Math.max(statistics.totalRegistrations, 1) < 0.2) score += 5;
                    score = Math.min(score, 100);
                    const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
                    const gradeColor = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-sgt-500' : score >= 40 ? 'text-amber-500' : 'text-red-500';
                    return (
                      <>
                        <div className={`text-5xl font-black ${gradeColor} mb-1`}>{grade}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">{score}/100 points</div>
                        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-sgt-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-3 text-center">
                          Based on registrations, confirmation, attendance &amp; team
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Cumulative Growth Chart */}
            <div className={`${CARD} overflow-hidden`}>
              <div className={CARD_HEADER}>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sgt-500" />
                  Cumulative Growth
                </h3>
              </div>
              <div className="p-4 h-[280px]">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#266CA9" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#266CA9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 14px rgba(4,29,86,0.15)',
                          fontSize: '12px',
                        }}
                      />
                      <Area type="monotone" dataKey="cumulative" stroke="#266CA9" strokeWidth={2} fill="url(#growthGrad)" name="Total Registrations" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No growth data yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
