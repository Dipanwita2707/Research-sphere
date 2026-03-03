'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, TrendingUp, TrendingDown, Users, UserCheck, UserX, UserMinus, Clock,
  Calendar, Loader2, AlertCircle, Download, BarChart3, PieChart, Activity,
  IndianRupee, Search, Filter, RefreshCw, Eye, LogIn, LogOut, Shield,
  ChevronDown, ChevronUp, FileSpreadsheet, Percent, Target, Zap, CheckCircle2,
  XCircle, ArrowUpRight, Settings, QrCode, UserPlus, MapPin, Globe, Award,
  Trash2, Store, CheckCheck, XCircle as XCircleIcon,
  FileText, ExternalLink, X, MessageSquare, Plus, Pencil,
  Crown, CreditCard, Hash, LayoutList, LayoutGrid,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event, EventStatistics, EventVolunteer, StallApplication, Stall, StallMetadata, StallType } from '@/features/event-management/types/event.types';
import CreateStallForm, { type CreateStallFormData } from '@/features/event-management/components/CreateStallForm';
import EventSettings from '@/features/event-management/components/EventSettings';
import RegistrationFilters from '@/features/event-management/components/RegistrationFilters';
import type { RegistrationFilterParams, RegistrationFilterOptions, RegistrationRow } from '@/features/event-management/types/registrationFilter.types';
import { getRegistrationDisplayName, getRegistrationIdentifier, getRegistrationSchool, getRegistrationDepartment, getRegistrationProgram } from '@/features/event-management/types/registrationFilter.types';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';

// NOTE: recharts is tree-shaken via next.config.js `optimizePackageImports`.
// This page is already code-split by Next.js App Router, so recharts only loads
// when the user navigates to the management page.
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend,
} from 'recharts';

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

type TabType = 'overview' | 'registrations' | 'volunteers' | 'analytics' | 'stalls' | 'feedback' | 'settings';

const VALID_TABS: TabType[] = ['overview', 'registrations', 'volunteers', 'analytics', 'stalls', 'feedback', 'settings'];

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

  // Stall Management State
  const [stallApplications, setStallApplications] = useState<StallApplication[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [stallsLoading, setStallsLoading] = useState(false);
  const [stallStatusFilter, setStallStatusFilter] = useState<string>('all');
  const [stallActionLoading, setStallActionLoading] = useState<string | null>(null);
  const [stallToggleLoading, setStallToggleLoading] = useState(false);
  const [selectedStallApp, setSelectedStallApp] = useState<StallApplication | null>(null);
  const [showStallAppModal, setShowStallAppModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [showCreateStallModal, setShowCreateStallModal] = useState(false);
  const [selectedStall, setSelectedStall] = useState<Stall | null>(null);
  const [selectedStallForEdit, setSelectedStallForEdit] = useState<Stall | null>(null);

  // Feedback tab state
  const [feedbackList, setFeedbackList] = useState<Array<{ id: string; points: number[]; shortDescription: string | null; createdAt: string }>>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<{ totalFeedback: number; overallAvg: number } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [showFeedbackQR, setShowFeedbackQR] = useState(false);
  const [feedbackQRUrl, setFeedbackQRUrl] = useState<string | null>(null);
  // Stall-level QR modal
  const [stallQrModal, setStallQrModal] = useState<{ stallId: string; stallName: string; qrDataUrl: string } | null>(null);

  // Registration Advanced Filtering State
  const [regFilters, setRegFilters] = useState<RegistrationFilterParams>({ page: 1, limit: 20 });
  const [regFilterOptions, setRegFilterOptions] = useState<RegistrationFilterOptions | null>(null);
  const [regFilterOptionsLoading, setRegFilterOptionsLoading] = useState(false);
  const [regData, setRegData] = useState<RegistrationRow[]>([]);
  const [regPagination, setRegPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [regViewMode, setRegViewMode] = useState<'table' | 'teams'>('table');
  const regDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data Loading ───────────────────────────────────────────────
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Load stall data when stalls tab is active
  useEffect(() => {
    if (activeTab === 'stalls' && event?.hasStalls) {
      loadStallData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, event?.hasStalls]);

  // Load feedback when feedback tab is active
  useEffect(() => {
    if (activeTab === 'feedback' && eventId) {
      setFeedbackLoading(true);
      eventService.getFeedback(eventId)
        .then((res) => {
          setFeedbackList(res.feedback);
          setFeedbackSummary(res.summary);
        })
        .catch(() => toast({ type: 'error', message: 'Failed to load feedback' }))
        .finally(() => setFeedbackLoading(false));
    }
  }, [activeTab, eventId, toast]);

  // Load registrations when registrations tab is active or filters change
  const loadRegistrations = useCallback(async (f: RegistrationFilterParams) => {
    setRegLoading(true);
    try {
      const { page, limit, status, search, ...advancedFilters } = f;
      const result = await eventService.getEventRegistrations(
        eventId,
        page || 1,
        limit || 20,
        status,
        { search, ...advancedFilters } as Record<string, string | number | undefined>,
      );
      setRegData(result.registrations as RegistrationRow[]);
      setRegPagination(result.pagination);
    } catch {
      toast({ type: 'error', message: 'Failed to load registrations' });
    } finally {
      setRegLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (activeTab === 'registrations' && eventId) {
      // Load filter options once
      if (!regFilterOptions && !regFilterOptionsLoading) {
        setRegFilterOptionsLoading(true);
        eventService.getRegistrationFilterOptions(eventId)
          .then((opts: RegistrationFilterOptions) => setRegFilterOptions(opts))
          .catch(() => {}) // silently fail — filters just won't show
          .finally(() => setRegFilterOptionsLoading(false));
      }
      // Load registration data (debounced for text searches)
      if (regDebounceRef.current) clearTimeout(regDebounceRef.current);
      regDebounceRef.current = setTimeout(() => loadRegistrations(regFilters), 300);
    }
    return () => { if (regDebounceRef.current) clearTimeout(regDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, eventId, regFilters]);

  const handleRegFilterChange = useCallback((newFilters: RegistrationFilterParams) => {
    setRegFilters(newFilters);
  }, []);

  const handleRegPageChange = useCallback((page: number) => {
    setRegFilters(prev => ({ ...prev, page }));
  }, []);

  const loadStallData = async () => {
    setStallsLoading(true);
    try {
      const [appsResult, stallsResult] = await Promise.allSettled([
        eventService.getStallApplications(eventId, { limit: 100 }),
        eventService.getStalls(eventId),
      ]);
      if (appsResult.status === 'fulfilled') {
        const appsData = appsResult.value as any;
        setStallApplications(appsData.applications || appsData || []);
      }
      if (stallsResult.status === 'fulfilled') {
        const v = stallsResult.value as any;
        // backend returns { stalls: [...] }; service returns that object directly
        setStalls(Array.isArray(v) ? v : Array.isArray(v?.stalls) ? v.stalls : []);
      }
    } catch {
      toast({ type: 'error', message: 'Failed to load stall data' });
    } finally {
      setStallsLoading(false);
    }
  };

  const handleStallApplicationAction = async (appId: string, status: 'approved' | 'rejected', reason?: string) => {
    if (status === 'rejected' && !reason) {
      setRejectingAppId(appId);
      setRejectReason('');
      setShowRejectModal(true);
      return;
    }

    setStallActionLoading(appId);
    try {
      await eventService.updateStallApplication(eventId, appId, { status, rejectionReason: reason });
      await loadStallData(); // Reload to get updated status
      toast({ type: 'success', message: `Application ${status}` });
      if (status === 'rejected') {
        setShowRejectModal(false);
        setRejectingAppId(null);
      }
      // If we are in the details modal, close it or update it?
      // Better to close it if rejected/approved to update list view context
      if (showStallAppModal && selectedStallApp?.id === appId) {
        setShowStallAppModal(false);
      }
    } catch (err: any) {
      toast({ type: 'error', message: err?.response?.data?.message || `Failed to ${status}` });
    } finally {
      setStallActionLoading(null);
    }
  };

  const handleConfirmRejection = () => {
    if (!rejectingAppId) return;
    if (!rejectReason.trim()) {
      toast({ type: 'error', message: 'Please provide a reason for rejection' });
      return;
    }
    handleStallApplicationAction(rejectingAppId, 'rejected', rejectReason);
  };

  const stallToFormData = (stall: Stall & { stallCategory?: string; description?: string; size?: string; stallMetadata?: { businessName?: string; electricityRequired?: boolean; waterRequired?: boolean; specialRequirements?: string; products?: string[] } }): CreateStallFormData => {
    const meta = stall.stallMetadata && typeof stall.stallMetadata === 'object' ? stall.stallMetadata : {};
    const spaceMatch = stall.size?.match(/(\d+)/);
    return {
      stallName: stall.stallName,
      stallType: (stall.stallType as StallType) || 'non_food',
      category: stall.stallCategory || stall.category || '',
      businessName: meta.businessName || '',
      businessDescription: stall.description || '',
      products: (meta.products && meta.products.length > 0) ? meta.products : [''],
      spaceRequired: spaceMatch ? parseInt(spaceMatch[1], 10) : undefined,
      electricityRequired: meta.electricityRequired ?? false,
      waterRequired: meta.waterRequired ?? false,
      specialRequirements: meta.specialRequirements || '',
    };
  };

  const handleUpdateStall = async (data: CreateStallFormData) => {
    if (!selectedStallForEdit) return;
    const descParts = [
      data.businessDescription,
      data.products?.filter(Boolean).join(', '),
      data.specialRequirements,
    ].filter(Boolean);
    const description = descParts.length > 0 ? descParts.join('\n\n') : undefined;
    const size = data.spaceRequired ? `${data.spaceRequired} sq ft` : undefined;
    try {
      const updated = await eventService.updateStall(eventId, selectedStallForEdit.stallId, {
        stallName: data.stallName,
        stallType: data.stallType,
        category: data.category,
        description,
        size,
        businessName: data.businessName,
        electricityRequired: data.electricityRequired,
        waterRequired: data.waterRequired,
        specialRequirements: data.specialRequirements,
        products: data.products?.filter(Boolean),
      });
      setStalls((prev) => prev.map((s) => (s.stallId === updated.stallId || s.id === updated.id ? { ...s, ...updated } : s)));
      setSelectedStallForEdit(null);
      toast({ type: 'success', message: 'Stall updated successfully' });
    } catch (err: unknown) {
      toast({ type: 'error', message: getErrorMessage(err) });
      throw err;
    }
  };

  const handleCreateStall = async (data: CreateStallFormData) => {
    const descParts = [
      data.businessDescription,
      data.products?.filter(Boolean).join(', '),
      data.specialRequirements,
    ].filter(Boolean);
    const description = descParts.length > 0 ? descParts.join('\n\n') : undefined;
    const size = data.spaceRequired ? `${data.spaceRequired} sq ft` : undefined;
    try {
      const created = await eventService.createStall(eventId, {
        stallName: data.stallName,
        stallType: data.stallType,
        category: data.category,
        description,
        size,
        businessName: data.businessName,
        electricityRequired: data.electricityRequired,
        waterRequired: data.waterRequired,
        specialRequirements: data.specialRequirements,
        products: data.products?.filter(Boolean),
      });
      setStalls((prev) => [...prev, created]);
      toast({ type: 'success', message: 'Stall created successfully' });
    } catch (err: unknown) {
      toast({ type: 'error', message: getErrorMessage(err) });
      throw err;
    }
  };

  const handleToggleStallApplications = async () => {
    setStallToggleLoading(true);
    try {
      const result = await eventService.toggleStallApplications(eventId);
      setEvent((prev) => prev ? { ...prev, stallConfig: result.stallConfig } : prev);
      toast({
        type: 'success',
        message: result.stallApplicationsOpen
          ? 'Student stall applications are now OPEN'
          : 'Student stall applications are now CLOSED',
      });
    } catch (err: any) {
      toast({ type: 'error', message: err?.response?.data?.message || 'Failed to toggle stall applications' });
    } finally {
      setStallToggleLoading(false);
    }
  };

  const openStallAppDetails = (app: StallApplication) => {
    setSelectedStallApp(app);
    setShowStallAppModal(true);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const eventData = await eventService.getEventById(eventId);
      setEvent(eventData);

      // Load stats and volunteers in parallel - stats may fail for draft events
      const [statsData, volunteersData] = await Promise.allSettled([
        eventService.getStatistics(eventId),
        eventService.getVolunteers(eventId)
      ]);

      if (statsData.status === 'fulfilled') {
        setStatistics(statsData.value);
      } else {
        // Provide empty statistics for draft events
        setStatistics({
          totalRegistrations: 0,
          confirmedRegistrations: 0,
          pendingRegistrations: 0,
          cancelledRegistrations: 0,
          waitlistedRegistrations: 0,
          totalAttended: 0,
          totalEntries: 0,
          totalExits: 0,
          currentlyInside: 0,
          totalRevenue: 0,
          volunteerCount: 0,
          recentRegistrations: [],
          registrationsByDate: [],
        } as unknown as EventStatistics);
      }

      if (volunteersData.status === 'fulfilled') {
        setVolunteers(volunteersData.value);
      }
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


  // ── Tab Navigation ─────────────────────────────────────────────
  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'registrations', label: 'Registrations', icon: Users },
    { id: 'volunteers', label: 'Volunteer Management', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'feedback', label: 'Feedback Section', icon: MessageSquare },
  ];

  if (event?.hasStalls) {
    tabs.push({ id: 'stalls', label: 'Stall Management', icon: Store });
  }

  // Settings tab is always available (uses Settings icon already imported)
  tabs.push({ id: 'settings', label: 'Event Settings', icon: Settings });

  const handleShowFeedbackQR = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/events/${eventId}/feedback`;
    try {
      const QRCodeGenerator = (await import('qrcode')).default;
      const dataUrl = await QRCodeGenerator.toDataURL(url, { width: 256, margin: 2 });
      setFeedbackQRUrl(dataUrl);
      setShowFeedbackQR(true);
    } catch {
      toast({ type: 'error', message: 'Failed to generate QR code' });
    }
  };

  const handleShowStallQR = async (stall: Stall & { stallQrCode?: string | null; stallName: string; stallId: string }) => {
    if (typeof window === 'undefined') return;
    // stallQrCode is stored as a relative path; prefix with origin
    const qrPath = stall.stallQrCode || `/events/${eventId}/stalls/${stall.stallId}/feedback`;
    const url = qrPath.startsWith('http') ? qrPath : `${window.location.origin}${qrPath}`;
    try {
      const QRCodeGenerator = (await import('qrcode')).default;
      const dataUrl = await QRCodeGenerator.toDataURL(url, { width: 260, margin: 2 });
      setStallQrModal({ stallId: stall.stallId, stallName: stall.stallName, qrDataUrl: dataUrl });
    } catch {
      toast({ type: 'error', message: 'Failed to generate stall QR code' });
    }
  };

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
                onClick={handleShowFeedbackQR}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Feedback QR Code"
              >
                <QrCode className="w-4 h-4" />
                Feedback QR
              </button>
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
                className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-lg transition-all whitespace-nowrap ${activeTab === tab.id
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
        {/* Draft Mode Banner */}
        {event.status === 'draft' && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Draft Event</h4>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                You can assign volunteers now. Registrations & analytics will be available after publishing.
              </p>
            </div>
          </div>
        )}
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

        {/* Registrations Tab — Server-side filtered + paginated */}
        {activeTab === 'registrations' && (
          <div className="space-y-4">
            {/* Search + Filter + View Toggle */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={regFilters.search || ''}
                  onChange={(e) => setRegFilters(prev => ({ ...prev, search: e.target.value || undefined, page: 1 }))}
                  placeholder="Search by name, email, UID, reg ID, or team name..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sgt-500 focus:border-sgt-500 transition-all"
                />
              </div>
              {/* View Mode Toggle */}
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRegViewMode('table')}
                  title="Table view"
                  className={`px-3.5 py-2.5 flex items-center gap-1.5 text-sm font-medium transition-all ${regViewMode === 'table' ? 'bg-sgt-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  <LayoutList className="w-4 h-4" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegViewMode('teams')}
                  title="Team groups view"
                  className={`px-3.5 py-2.5 flex items-center gap-1.5 text-sm font-medium border-l border-gray-300 dark:border-gray-600 transition-all ${regViewMode === 'teams' ? 'bg-sgt-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span className="hidden sm:inline">Teams</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  showFilters
                    ? 'bg-sgt-50 dark:bg-sgt-900/30 border-sgt-500 text-sgt-700 dark:text-sgt-300'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {(() => {
                  let cnt = 0;
                  if (regFilters.role) cnt++;
                  if (regFilters.gender) cnt++;
                  if (regFilters.schoolId) cnt++;
                  if (regFilters.departmentId) cnt++;
                  if (regFilters.programId) cnt++;
                  if (regFilters.passOutYear) cnt++;
                  if (regFilters.uid) cnt++;
                  if (regFilters.empId) cnt++;
                  if (regFilters.status && regFilters.status !== 'all') cnt++;
                  if (regFilters.paymentStatus && regFilters.paymentStatus !== 'all') cnt++;
                  if (regFilters.teamSearch) cnt++;
                  return cnt > 0 ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sgt-500 text-white text-[10px] font-bold">{cnt}</span>
                  ) : null;
                })()}
              </button>
            </div>

            {/* Payment Status + Team Quick Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Payment:</span>
              {([
                { value: 'all',       label: 'All',     color: '#6366f1' },
                { value: 'completed', label: 'Paid',    color: '#10b981' },
                { value: 'pending',   label: 'Pending', color: '#f59e0b' },
                { value: 'failed',    label: 'Failed',  color: '#ef4444' },
              ] as const).map((ps) => {
                const active = (regFilters.paymentStatus || 'all') === ps.value;
                return (
                  <button
                    key={ps.value}
                    type="button"
                    onClick={() => setRegFilters(prev => ({ ...prev, paymentStatus: ps.value === 'all' ? undefined : ps.value, page: 1 }))}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all`}
                    style={active
                      ? { backgroundColor: ps.color, color: 'white', borderColor: ps.color }
                      : { backgroundColor: 'transparent', borderColor: '#d1d5db' }
                    }
                  >
                    {ps.label}
                  </button>
                );
              })}
              <div className="ml-2 h-4 w-px bg-gray-300 dark:bg-gray-600" />
              <div className="relative">
                <input
                  type="text"
                  value={regFilters.teamSearch || ''}
                  onChange={(e) => setRegFilters(prev => ({ ...prev, teamSearch: e.target.value || undefined, page: 1 }))}
                  placeholder="Filter by team name..."
                  className="pl-3 pr-8 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 transition-all w-44"
                />
                {regFilters.teamSearch && (
                  <button
                    type="button"
                    onClick={() => setRegFilters(prev => ({ ...prev, teamSearch: undefined, page: 1 }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Layout: Filters sidebar (if open) + Content */}
            <div className={`flex gap-4 ${showFilters ? 'flex-col lg:flex-row' : ''}`}>
              {/* Filter Panel */}
              {showFilters && (
                <div className="w-full lg:w-72 lg:min-w-[18rem] flex-shrink-0">
                  <div className="lg:sticky lg:top-24">
                    <RegistrationFilters
                      filters={regFilters}
                      options={regFilterOptions}
                      optionsLoading={regFilterOptionsLoading}
                      onFilterChange={handleRegFilterChange}
                      onClose={() => setShowFilters(false)}
                    />
                  </div>
                </div>
              )}

              {/* Content Area */}
              <div className="flex-1 min-w-0">

                {/* ── TEAM GROUPS VIEW ─────────────────────────────── */}
                {regViewMode === 'teams' && (() => {
                  // Derive a stable team color palette
                  const TEAM_PALETTE = [
                    { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
                    { bg: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-300 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-300', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
                    { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
                    { bg: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
                    { bg: 'bg-rose-500', light: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-300', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
                    { bg: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
                    { bg: 'bg-cyan-500', light: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-700 dark:text-cyan-300', badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
                    { bg: 'bg-pink-500', light: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-300 dark:border-pink-700', text: 'text-pink-700 dark:text-pink-300', badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
                  ];

                  // Group registrations by teamId
                  const teamMap = new Map<string, typeof regData>();
                  const soloRegs: typeof regData = [];
                  regData.forEach(r => {
                    if (r.teamId && r.team) {
                      const key = r.teamId;
                      if (!teamMap.has(key)) teamMap.set(key, []);
                      teamMap.get(key)!.push(r);
                    } else {
                      soloRegs.push(r);
                    }
                  });

                  const teamEntries = Array.from(teamMap.entries());
                  const teamColorMap = new Map<string, typeof TEAM_PALETTE[0]>();
                  teamEntries.forEach(([tid], idx) => {
                    teamColorMap.set(tid, TEAM_PALETTE[idx % TEAM_PALETTE.length]);
                  });

                  const formatPayment = (reg: (typeof regData)[0]) => {
                    if (reg.paymentStatus === 'completed' || reg.latestPayment?.razorpayPaymentId) {
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Paid
                            {reg.amountPaid ? ` ₹${reg.amountPaid.toLocaleString('en-IN')}` : ''}
                          </span>
                          {reg.latestPayment?.razorpayPaymentId && (
                            <span className="text-[10px] font-mono text-gray-400 break-all">{reg.latestPayment.razorpayPaymentId}</span>
                          )}
                        </div>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 dark:text-red-400">
                        <XCircle className="w-3 h-3" /> Not Paid
                      </span>
                    );
                  };

                  const renderMemberRow = (reg: (typeof regData)[0], color: typeof TEAM_PALETTE[0], isLast: boolean) => {
                    const name = getRegistrationDisplayName(reg);
                    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                    const identifier = getRegistrationIdentifier(reg);
                    const school = getRegistrationSchool(reg);
                    const dept = getRegistrationDepartment(reg);
                    return (
                      <div key={reg.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 ${!isLast ? 'border-b border-gray-100 dark:border-gray-700' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}>
                        {/* Color dot + avatar */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
                              {reg.isTeamLeader && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  <Crown className="w-2.5 h-2.5" /> Leader
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {reg.user_login?.email} {identifier ? `· ${identifier}` : ''}
                            </p>
                            {school && <p className="text-[11px] text-gray-400 truncate">{school}{dept ? ` · ${dept}` : ''}</p>}
                          </div>
                        </div>
                        {/* Status + Payment + Attendance */}
                        <div className="flex items-center gap-3 flex-shrink-0 ml-11 sm:ml-0">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.bg || 'bg-gray-100'} ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.text || 'text-gray-600'}`}>
                            {reg.status}
                          </span>
                          {formatPayment(reg)}
                          {reg.hasEntered
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" title="Attended" />
                            : <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" title="Not attended" />
                          }
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-4">
                      {regLoading && (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-sgt-500" />
                        </div>
                      )}

                      {/* Team Groups */}
                      {teamEntries.map(([teamId, members], idx) => {
                        const color = teamColorMap.get(teamId)!;
                        const teamInfo = members[0]?.team;
                        const paidCount = members.filter(m => m.paymentStatus === 'completed' || m.latestPayment?.razorpayPaymentId).length;
                        const txId = members.find(m => m.latestPayment?.razorpayPaymentId)?.latestPayment?.razorpayPaymentId;
                        return (
                          <div key={teamId} className={`${CARD} overflow-hidden border-l-4 ${color.border}`}>
                            {/* Team Header */}
                            <div className={`px-4 py-3 ${color.light} flex flex-col sm:flex-row sm:items-center justify-between gap-2`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg ${color.bg} flex items-center justify-center text-white text-xs font-bold`}>
                                  {(teamInfo?.name || 'T').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className={`text-sm font-bold ${color.text}`}>{teamInfo?.name || 'Unknown Team'}</p>
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{teamInfo?.teamId}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap ml-11 sm:ml-0">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${color.badge}`}>
                                  <Users className="w-3 h-3 inline mr-1" />{members.length} members
                                </span>
                                {teamInfo?.isComplete
                                  ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Finalized</span>
                                  : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Forming</span>
                                }
                                {paidCount > 0
                                  ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                      <CreditCard className="w-3 h-3" /> Paid
                                    </span>
                                  : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                      <CreditCard className="w-3 h-3" /> Unpaid
                                    </span>
                                }
                                {txId && (
                                  <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 hidden lg:inline">
                                    TXN: {txId}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Members */}
                            <div>
                              {members.map((reg, mIdx) => renderMemberRow(reg, color, mIdx === members.length - 1))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Solo Registrations */}
                      {soloRegs.length > 0 && (
                        <div className={`${CARD} overflow-hidden`}>
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-500" />
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Individual Registrations ({soloRegs.length})</p>
                          </div>
                          {soloRegs.map((reg, idx) => {
                            const soloColor = TEAM_PALETTE[7]; // gray-ish pink for solo
                            return renderMemberRow(reg, soloColor, idx === soloRegs.length - 1);
                          })}
                        </div>
                      )}

                      {!regLoading && regData.length === 0 && (
                        <div className={`${CARD} px-5 py-12 text-center`}>
                          <p className="text-gray-500 dark:text-gray-400">No registrations found</p>
                        </div>
                      )}

                      {/* Pagination */}
                      {regPagination && regPagination.totalPages > 1 && (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Showing {((regPagination.page - 1) * regPagination.limit) + 1}–{Math.min(regPagination.page * regPagination.limit, regPagination.total)} of {regPagination.total}
                          </p>
                          <div className="flex items-center gap-1">
                            <button type="button" disabled={regPagination.page <= 1} onClick={() => handleRegPageChange(regPagination.page - 1)} className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                            <button type="button" disabled={regPagination.page >= regPagination.totalPages} onClick={() => handleRegPageChange(regPagination.page + 1)} className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── TABLE VIEW ───────────────────────────────────── */}
                {regViewMode === 'table' && (
                  <div className={CARD}>
                    <div className={`${CARD_HEADER} flex items-center justify-between`}>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        Registrations {regPagination ? `(${regPagination.total})` : ''}
                      </h3>
                      {regLoading && <Loader2 className="w-4 h-4 animate-spin text-sgt-600" />}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Participant</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">ID / Reg No</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">School / Dept</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Team</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Payment</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Registered</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Entry</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {regData.length > 0 ? (
                            regData.map((reg) => (
                              <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-4 py-3.5">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {getRegistrationDisplayName(reg)}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {reg.user_login?.email || reg.user_login?.uid || 'N/A'}
                                    </p>
                                    {reg.user_login?.role && (
                                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 capitalize">
                                        {reg.user_login.role}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="text-sm font-mono text-gray-900 dark:text-white">{getRegistrationIdentifier(reg)}</p>
                                  <p className="text-[10px] font-mono text-gray-400 mt-0.5">{reg.registrationId}</p>
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="text-xs text-gray-700 dark:text-gray-300">{getRegistrationSchool(reg) || '—'}</p>
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{getRegistrationDepartment(reg)}</p>
                                  {getRegistrationProgram(reg) && <p className="text-[10px] text-gray-400">{getRegistrationProgram(reg)}</p>}
                                </td>
                                {/* Team Column */}
                                <td className="px-4 py-3.5">
                                  {reg.team ? (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{reg.team.name}</p>
                                      <p className="text-[10px] font-mono text-gray-400">{reg.team.teamId}</p>
                                      {reg.isTeamLeader && (
                                        <span className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                          <Crown className="w-2.5 h-2.5" /> Leader
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </td>
                                {/* Payment Column */}
                                <td className="px-4 py-3.5">
                                  {reg.paymentStatus === 'completed' || reg.latestPayment?.razorpayPaymentId ? (
                                    <div>
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Paid {reg.amountPaid ? `₹${reg.amountPaid.toLocaleString('en-IN')}` : ''}
                                      </span>
                                      {reg.latestPayment?.razorpayPaymentId && (
                                        <p className="text-[10px] font-mono text-gray-400 mt-0.5 max-w-[140px] truncate" title={reg.latestPayment.razorpayPaymentId}>
                                          {reg.latestPayment.razorpayPaymentId}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 dark:text-red-400">
                                      <XCircle className="w-3.5 h-3.5" /> Not Paid
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.bg || 'bg-gray-100'} ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.text || 'text-gray-600'}`}>
                                    {reg.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {reg.registeredAt ? new Date(reg.registeredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                  </p>
                                </td>
                                <td className="px-4 py-3.5">
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
                              <td colSpan={8} className="px-5 py-12 text-center">
                                <p className="text-gray-500 dark:text-gray-400">
                                  {regLoading ? 'Loading registrations...' : 'No registrations found'}
                                </p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {regPagination && regPagination.totalPages > 1 && (
                      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Showing {((regPagination.page - 1) * regPagination.limit) + 1}–{Math.min(regPagination.page * regPagination.limit, regPagination.total)} of {regPagination.total}
                        </p>
                        <div className="flex items-center gap-1">
                          <button type="button" disabled={regPagination.page <= 1} onClick={() => handleRegPageChange(regPagination.page - 1)} className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Previous</button>
                          {Array.from({ length: Math.min(regPagination.totalPages, 5) }, (_, i) => {
                            let pageNum: number;
                            if (regPagination.totalPages <= 5) { pageNum = i + 1; }
                            else if (regPagination.page <= 3) { pageNum = i + 1; }
                            else if (regPagination.page >= regPagination.totalPages - 2) { pageNum = regPagination.totalPages - 4 + i; }
                            else { pageNum = regPagination.page - 2 + i; }
                            return (
                              <button key={pageNum} type="button" onClick={() => handleRegPageChange(pageNum)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${regPagination.page === pageNum ? 'bg-sgt-500 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{pageNum}</button>
                            );
                          })}
                          <button type="button" disabled={regPagination.page >= regPagination.totalPages} onClick={() => handleRegPageChange(regPagination.page + 1)} className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${volunteer.canScanQr
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

        {/* Feedback Section Tab */}
        {activeTab === 'feedback' && (
          <div className="space-y-6">
            <div className={`${CARD} p-5`}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-sgt-500" />
                    Event Feedback
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Scan the Feedback QR to collect ratings (10 points) and short description from attendees.
                  </p>
                </div>
                <button
                  onClick={handleShowFeedbackQR}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sgt-600 rounded-lg hover:bg-sgt-700 transition-colors"
                >
                  <QrCode className="w-4 h-4" />
                  Show Feedback QR
                </button>
              </div>
              {feedbackSummary && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-sgt-50 dark:bg-sgt-900/20">
                    <p className="text-2xl font-bold text-sgt-600 dark:text-sgt-400">{feedbackSummary.totalFeedback}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Responses</p>
                  </div>
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{feedbackSummary.overallAvg.toFixed(1)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Avg Rating (out of 10)</p>
                  </div>
                </div>
              )}
              {feedbackLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-sgt-600" /></div>
              ) : feedbackList.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No feedback yet. Share the QR code with attendees to collect responses.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedbackList.map((fb) => (
                    <div key={fb.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(fb.createdAt).toLocaleString()}
                        </span>
                        <span className="text-sm font-semibold text-sgt-600 dark:text-sgt-400">
                          Avg: {(fb.points.reduce((a, b) => a + b, 0) / 10).toFixed(1)}/10
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {fb.points.map((p, i) => (
                          <span key={i} className="inline-flex items-center justify-center w-7 h-7 rounded bg-sgt-100 dark:bg-sgt-900/30 text-xs font-medium text-sgt-700 dark:text-sgt-300">
                            {p}
                          </span>
                        ))}
                      </div>
                      {fb.shortDescription && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          {fb.shortDescription}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stall Management Tab */}
        {activeTab === 'stalls' && (
          <div className="space-y-6">
            {/* Toggle Banner */}
            <div className={`${CARD} p-4`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Store className="w-4 h-4 text-sgt-500" />
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Student Stall Applications Portal</h4>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {event.stallConfig?.enableStudentApplied
                      ? 'Portal is OPEN — students can apply for stalls right now'
                      : 'Portal is CLOSED — students cannot apply for stalls'}
                  </p>
                  {event.status === 'draft' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Event is in draft mode but you can still open applications early.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-semibold ${event.stallConfig?.enableStudentApplied ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {event.stallConfig?.enableStudentApplied ? 'OPEN' : 'CLOSED'}
                  </span>
                  <button
                    onClick={handleToggleStallApplications}
                    disabled={stallToggleLoading}
                    title={event.stallConfig?.enableStudentApplied ? 'Click to close applications' : 'Click to open applications'}
                    className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sgt-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${event.stallConfig?.enableStudentApplied
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                      }`}
                  >
                    {stallToggleLoading ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin mx-auto" />
                    ) : (
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${event.stallConfig?.enableStudentApplied ? 'translate-x-8' : 'translate-x-1'
                          }`}
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {stallsLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-sgt-600" /></div>
            ) : (
              <>
                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Applications', value: stallApplications.length, color: 'text-sgt-600', bg: 'bg-sgt-50 dark:bg-sgt-900/20' },
                    { label: 'Pending', value: stallApplications.filter((a) => a.status === 'pending').length, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                    { label: 'Approved', value: stallApplications.filter((a) => a.status === 'approved').length, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'Active Stalls', value: stalls.filter((s) => s.isActive).length, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                  ].map((m) => (
                    <div key={m.label} className={`${CARD} p-4 flex flex-col gap-1`}>
                      <span className={`text-2xl font-bold ${m.color}`}>{m.value}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{m.label}</span>
                    </div>
                  ))}
                </div>

                {/* Applications */}
                <div className={`${CARD} overflow-hidden`}>
                  <div className={`${CARD_HEADER} flex items-center justify-between flex-wrap gap-2`}>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Store className="w-4 h-4 text-sgt-500" />
                      Stall Applications
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateStallModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sgt-600 hover:bg-sgt-700 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create Stall
                      </button>
                      <select
                        value={stallStatusFilter}
                        onChange={(e) => setStallStatusFilter(e.target.value)}
                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      >
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>

                  {stallApplications.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400">No stall applications yet.</div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {stallApplications
                        .filter((a) => stallStatusFilter === 'all' || a.status === stallStatusFilter)
                        .map((app) => (
                          <div key={app.id} className="px-5 py-4 flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-sm text-gray-900 dark:text-white">{app.stallName}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{app.stallType}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${app.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
                                  : app.status === 'rejected' ? 'bg-red-100 text-red-700'
                                    : app.status === 'pending' ? 'bg-amber-100 text-amber-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>{app.status}</span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                <p>{app.ownerName || 'Unknown'} · {app.ownerEmail} </p>
                                {(app.ownerSchool || app.ownerDepartment) && (
                                  <p className="text-gray-400 dark:text-gray-500">
                                    {app.ownerSchool || ''} {app.ownerSchool && app.ownerDepartment ? '•' : ''} {app.ownerDepartment || ''}
                                  </p>
                                )}
                              </div>
                              {app.businessName && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{app.businessName}</p>
                              )}
                              {app.rejectionReason && (
                                <p className="text-xs text-red-500 italic mt-0.5">Note: {app.rejectionReason}</p>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => openStallAppDetails(app)}
                                className="p-1.5 text-gray-500 hover:text-sgt-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {app.status === 'pending' && (
                                <>
                                  <button
                                    disabled={stallActionLoading === app.id}
                                    onClick={() => handleStallApplicationAction(app.id, 'approved')}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {stallActionLoading === app.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                                    Approve
                                  </button>
                                  <button
                                    disabled={stallActionLoading === app.id}
                                    onClick={() => handleStallApplicationAction(app.id, 'rejected')}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    <XCircleIcon className="w-3 h-3" />
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Active Stalls */}
                {stalls.length > 0 && (
                  <div className={`${CARD} overflow-hidden`}>
                    <div className={CARD_HEADER}>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Store className="w-4 h-4 text-purple-500" />
                        Active Stalls
                      </h3>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {stalls.map((stall) => (
                        <div key={stall.id} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-900 dark:text-white">{stall.stallName}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">{stall.stallType}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${stall.source === 'creator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {stall.source === 'creator' ? 'Organizer' : 'Student'}
                              </span>
                            </div>
                            {stall.location && <p className="text-xs text-gray-400 mt-0.5">Location: {stall.location}</p>}
                            {(stall as Stall & { ownerName?: string; owner?: { name?: string } }).ownerName && (
                              <p className="text-xs text-gray-400">{(stall as Stall & { ownerName?: string }).ownerName}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedStall(stall)}
                              className="p-1.5 text-gray-500 hover:text-sgt-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleShowStallQR(stall as any)}
                              className="p-1.5 text-gray-500 hover:text-purple-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md transition-colors"
                              title="Show Feedback QR"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            {stall.source === 'creator' && (
                              <button
                                onClick={() => setSelectedStallForEdit(stall)}
                                className="p-1.5 text-gray-500 hover:text-sgt-600 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <span className="text-xs font-mono text-gray-400 ml-1">{stall.stallId}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Event Settings Tab */}
        {activeTab === 'settings' && (
          <EventSettings
            eventId={event.id}
            onToast={toast}
          />
        )}

      </div>

      {/* ===== Stall Application Details Modal ===== */}
      {showStallAppModal && selectedStallApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stall Application Details</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Applied on {new Date(selectedStallApp.appliedAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setShowStallAppModal(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Band */}
              <div className={`px-4 py-2 rounded-md flex items-center justify-between ${selectedStallApp.status === 'approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' :
                selectedStallApp.status === 'rejected' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
                  selectedStallApp.status === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' :
                    'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300'
                }`}>
                <span className="text-sm font-medium">Status: {selectedStallApp.status.toUpperCase()}</span>
                {selectedStallApp.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { handleStallApplicationAction(selectedStallApp.id, 'approved'); setShowStallAppModal(false); }}
                      className="px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { handleStallApplicationAction(selectedStallApp.id, 'rejected'); setShowStallAppModal(false); }}
                      className="px-3 py-1 bg-white border border-red-200 text-red-600 text-xs font-medium rounded-md hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {/* Applicant Info */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Applicant Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-xs text-gray-500 mb-1">Name</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.ownerName || 'N/A'}</span>
                    <div className="mt-2">
                      <span className="block text-xs text-gray-500 mb-1">School/Faculty</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.ownerSchool || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-xs text-gray-500 mb-1">Email</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.ownerEmail || 'N/A'}</span>
                    <div className="mt-2">
                      <span className="block text-xs text-gray-500 mb-1">Department</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.ownerDepartment || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stall Basic Info */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Stall Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg">
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Stall Name</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.stallName}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Type</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">{selectedStallApp.stallType.replace('_', ' ')}</span>
                  </div>
                  {selectedStallApp.category && (
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Category</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.category}</span>
                    </div>
                  )}
                  {selectedStallApp.spaceRequired && (
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Space Required</span>
                      <span className="font-medium text-gray-900 dark:text-white">{selectedStallApp.spaceRequired} sq ft</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Details */}
              {(selectedStallApp.businessName || selectedStallApp.businessDescription || selectedStallApp.products) && (
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Business Details</h4>
                  <div className="space-y-3 text-sm">
                    {selectedStallApp.businessName && (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Business Name</span>
                        <p className="text-gray-900 dark:text-white">{selectedStallApp.businessName}</p>
                      </div>
                    )}
                    {selectedStallApp.businessDescription && (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Description</span>
                        <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/20 p-3 rounded-md">{selectedStallApp.businessDescription}</p>
                      </div>
                    )}
                    {selectedStallApp.products && selectedStallApp.products.length > 0 && (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Products/Services</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedStallApp.products.map((prod, i) => (
                            <span key={i} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-md">
                              {prod}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Requirements & Licenses */}
              <div>
                <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Requirements & Compliance</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedStallApp.electricityRequired ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-gray-700 dark:text-gray-300">Electricity Required</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedStallApp.waterRequired ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-gray-700 dark:text-gray-300">Water Required</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-gray-500">GST Number: </span>
                      <span className="text-gray-900 dark:text-white font-mono">{selectedStallApp.gstNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Food License: </span>
                      <span className="text-gray-900 dark:text-white font-mono">{selectedStallApp.foodLicenseNumber || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                {selectedStallApp.specialRequirements && (
                  <div className="mt-3">
                    <span className="block text-xs text-gray-500 mb-1">Special Requirements</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic">{selectedStallApp.specialRequirements}</p>
                  </div>
                )}
              </div>

              {/* Documents */}
              {selectedStallApp.documentUrls && selectedStallApp.documentUrls.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Documents</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedStallApp.documentUrls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-sgt-600 dark:text-sgt-400"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Document {i + 1}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowStallAppModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Rejection Feedack Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reject Application</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Please provide a reason for rejecting this stall application. This will be shared with the applicant.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="E.g., Incomplete documentation, stall type not allowed..."
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-gray-200 transition-colors"
                disabled={stallActionLoading !== null}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejection}
                disabled={stallActionLoading !== null || !rejectReason.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stallActionLoading === rejectingAppId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircleIcon className="w-4 h-4" />
                )}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback QR Modal */}
      {showFeedbackQR && feedbackQRUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowFeedbackQR(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Feedback QR Code</h3>
              <button onClick={() => setShowFeedbackQR(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Scan to give event feedback (10 points + short description)</p>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={feedbackQRUrl} alt="Feedback QR" className="w-64 h-64" />
            </div>
          </div>
        </div>
      )}

      {/* Stall Feedback QR Modal */}
      {stallQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setStallQrModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stall Feedback QR</h3>
              <button onClick={() => setStallQrModal(null)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">{stallQrModal.stallName}</p>
            <p className="text-xs text-gray-400 mb-4">
              Place this QR at the stall — customers scan it to leave feedback anonymously.
            </p>
            <div className="flex justify-center p-4 bg-white rounded-lg border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stallQrModal.qrDataUrl} alt="Stall Feedback QR" className="w-64 h-64" />
            </div>
            <p className="text-center text-xs text-gray-400 mt-3 font-mono">{stallQrModal.stallId}</p>
            <a
              href={stallQrModal.qrDataUrl}
              download={`stall-feedback-qr-${stallQrModal.stallId}.png`}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Download QR
            </a>
          </div>
        </div>
      )}

      {/* Create Stall Modal */}
      {showCreateStallModal && (
        <CreateStallForm
          onClose={() => setShowCreateStallModal(false)}
          onSubmit={handleCreateStall}
        />
      )}

      {/* Stall Details Modal (View) */}
      {selectedStall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stall Details</h3>
              <button onClick={() => setSelectedStall(null)} className="p-2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-white">{selectedStall.stallName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">{selectedStall.stallType}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${selectedStall.source === 'creator' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {selectedStall.source === 'creator' ? 'Organizer' : 'Student'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-xs text-gray-500 mb-1">Stall ID</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">{selectedStall.stallId}</span>
                </div>
                {(selectedStall as { stallCategory?: string }).stallCategory && (
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Category</span>
                    <span className="font-medium text-gray-900 dark:text-white">{(selectedStall as { stallCategory?: string }).stallCategory}</span>
                  </div>
                )}
                {(selectedStall as { size?: string }).size && (
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Size</span>
                    <span className="font-medium text-gray-900 dark:text-white">{(selectedStall as { size?: string }).size}</span>
                  </div>
                )}
                {(selectedStall as { location?: string }).location && (
                  <div>
                    <span className="block text-xs text-gray-500 mb-1">Location</span>
                    <span className="font-medium text-gray-900 dark:text-white">{(selectedStall as { location?: string }).location}</span>
                  </div>
                )}
                {(selectedStall as { ownerName?: string }).ownerName && (
                  <div className="col-span-2">
                    <span className="block text-xs text-gray-500 mb-1">Owner</span>
                    <span className="font-medium text-gray-900 dark:text-white">{(selectedStall as { ownerName?: string }).ownerName}</span>
                  </div>
                )}
              </div>
              {(selectedStall as { description?: string }).description && (
                <div>
                  <span className="block text-xs text-gray-500 mb-1">Description</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{(selectedStall as { description?: string }).description}</p>
                </div>
              )}
              {(() => {
                const meta = (selectedStall as Stall & { stallMetadata?: StallMetadata }).stallMetadata;
                if (!meta) return null;
                return (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Infrastructure & Business</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {meta.businessName && (
                        <div>
                          <span className="block text-xs text-gray-500 mb-1">Business Name</span>
                          <span className="font-medium text-gray-900 dark:text-white">{meta.businessName}</span>
                        </div>
                      )}
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Electricity</span>
                        <span className="font-medium text-gray-900 dark:text-white">{meta.electricityRequired ? 'Yes' : 'No'}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Water</span>
                        <span className="font-medium text-gray-900 dark:text-white">{meta.waterRequired ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    {meta.specialRequirements && (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Special Requirements</span>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{meta.specialRequirements}</p>
                      </div>
                    )}
                    {meta.products?.length ? (
                      <div>
                        <span className="block text-xs text-gray-500 mb-1">Products / Services</span>
                        <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
                          {meta.products.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Stall Modal */}
      {selectedStallForEdit && (
        <CreateStallForm
          onClose={() => setSelectedStallForEdit(null)}
          onSubmit={handleUpdateStall}
          initialData={stallToFormData(selectedStallForEdit as Stall & { stallCategory?: string; description?: string; size?: string; stallMetadata?: { businessName?: string; electricityRequired?: boolean; waterRequired?: boolean; specialRequirements?: string; products?: string[] } })}
        />
      )}
    </div>
  );
}
