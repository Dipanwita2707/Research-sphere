'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3, Users, FolderTree, Ticket, TrendingUp, Clock, Star, Eye,
  AlertTriangle, CheckCircle, XCircle, ArrowUpCircle, Layers, ChevronLeft, ChevronRight, FileText,
  Search, Filter, Calendar, X,
} from 'lucide-react';
import {
  useOverviewAnalytics,
  useEmployeeAnalytics,
  useCategoryAnalytics,
  useAllTickets,
  useActiveCategories,
} from '@/features/ticket-management/hooks/useTickets';
import { STATUS_CONFIG, PRIORITY_CONFIG, MESSAGE_TYPE_CONFIG, ESCALATION_LEVEL_LABELS, PAGE_SIZE } from '@/features/ticket-management/constants';
import type { TmsTicketStatus, TmsMessageType, TmsPriority, TmsEscalationLevel, AdminTicketListParams } from '@/features/ticket-management/types/tms.types';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof BarChart3; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-5 transition-all hover:shadow-md" style={{ boxShadow: '0 2px 8px 0 rgba(0, 91, 150, 0.05)' }}>
      <div className="flex items-center gap-3.5">
        <div className={`p-2.5 rounded-xl ${color} shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-[#011f4b]">{value}</p>
          <p className="text-[11px] font-semibold text-[#6497b1] uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#03396c] font-medium">{label}</span>
        <span className="font-bold text-[#011f4b]">{value} ({pct}%)</span>
      </div>
      <div className="h-2 bg-[#b3cde0]/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TmsTicketStatus }) {
  const config = STATUS_CONFIG[status];
  if (!config) return <span className="text-xs">{status}</span>;
  const colorMap: Record<string, string> = {
    open: 'bg-[#005b96] text-white',
    in_progress: 'bg-amber-500 text-white',
    escalated: 'bg-red-500 text-white',
    resolved: 'bg-emerald-600 text-white',
    closed: 'bg-[#03396c] text-white',
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${colorMap[status] || 'bg-gray-200 text-gray-700'}`}>
      {config.label}
    </span>
  );
}

export default function TmsAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TmsTicketStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<TmsMessageType | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TmsPriority | ''>('');
  const [masterCatFilter, setMasterCatFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [subCatFilter, setSubCatFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<TmsEscalationLevel | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const tabOptions: { key: 'overview' | 'tickets' | 'employees' | 'categories'; label: string; icon: typeof BarChart3 }[] = [
    { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { key: 'tickets' as const, label: 'All Tickets', icon: Ticket },
    { key: 'employees' as const, label: 'Employee Performance', icon: Users },
    { key: 'categories' as const, label: 'Category Analytics', icon: FolderTree },
  ];
  const rawTab = searchParams.get('tab');
  const tab = rawTab && tabOptions.some((item) => item.key ===
   rawTab) ? rawTab as typeof tabOptions[number]['key'] : 'overview';

  const setActiveTab = useCallback(
    (nextTab: typeof tabOptions[number]['key']) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', nextTab);
      router.replace(`?${params.toString()}`, { scroll: false });
      setPage(1);
    },
    [router, searchParams],
  );

  const { data: overview, isLoading: overviewLoading } = useOverviewAnalytics();
  const { data: employees } = useEmployeeAnalytics();
  const { data: categories } = useCategoryAnalytics();
  const { data: activeCats } = useActiveCategories();

  // Derived category/sub-category lists based on selected master/category
  const filteredCats = useMemo(() => {
    if (!activeCats) return [];
    if (!masterCatFilter) return activeCats.flatMap((mc) => mc.categories || []);
    const mc = activeCats.find((m) => m.id ===
   masterCatFilter);
    return mc?.categories || [];
  }, [activeCats, masterCatFilter]);

  const filteredSubCats = useMemo(() => {
    if (!catFilter) return filteredCats.flatMap((c) => (c as any).subCategories || []);
    const cat = filteredCats.find((c) => c.id ===
   catFilter);
    return (cat as any)?.subCategories || [];
  }, [filteredCats, catFilter]);

  const hasActiveTicketFilters = searchQuery || statusFilter || typeFilter || priorityFilter || masterCatFilter || catFilter || subCatFilter || levelFilter || startDate || endDate;

  const clearTicketFilters = () => {
    setSearchQuery(''); setStatusFilter(''); setTypeFilter(''); setPriorityFilter('');
    setMasterCatFilter(''); setCatFilter(''); setSubCatFilter('');
    setLevelFilter(''); setStartDate(''); setEndDate(''); setPage(1);
  };

  const ticketParams: AdminTicketListParams = {
    page,
    limit: PAGE_SIZE,
    ...(searchQuery && { search: searchQuery }),
    ...(statusFilter && { status: statusFilter }),
    ...(typeFilter && { messageType: typeFilter }),
    ...(priorityFilter && { priority: priorityFilter }),
    ...(masterCatFilter && { masterCategoryId: masterCatFilter }),
    ...(catFilter && { categoryId: catFilter }),
    ...(subCatFilter && { subCategoryId: subCatFilter }),
    ...(levelFilter && { currentLevel: levelFilter }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };
  const { data: allTicketsData, isLoading: ticketsLoading } = useAllTickets(tab ===
   'tickets' ? ticketParams : undefined);

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#011f4b] to-[#005b96] rounded-2xl shadow-lg shadow-[#005b96]/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#011f4b] tracking-tight">TMS Admin Dashboard</h1>
            <p className="text-sm text-[#6497b1] mt-0.5">Comprehensive analytics and ticket management</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-[#b3cde0]/30 overflow-x-auto">
          {tabOptions.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  tab ===
   t.key
                    ? 'border-[#005b96] text-[#005b96]'
                    : 'border-transparent text-[#6497b1] hover:text-[#005b96] hover:border-[#b3cde0]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ==========
   OVERVIEW TAB ==========
   */}
        {tab ===
   'overview' && (
          <div className="space-y-6">
            {overviewLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-[#b3cde0] border-t-[#005b96]" />
              </div>
            ) : overview ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Requests" value={overview.totalRequests} icon={Ticket} color="bg-blue-500" />
                  <StatCard label="Resolved" value={overview.resolution.totalResolved} icon={CheckCircle} color="bg-green-500" />
                  <StatCard label="Total Escalations" value={overview.escalations} icon={ArrowUpCircle} color="bg-orange-500" />
                  <StatCard label="Avg Rating" value={overview.ratings.average ?? 'N/A'} icon={Star} color="bg-yellow-500" />
                </div>

                {/* Row 2: Status + Resolution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* By Status */}
                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                      <h3 className="text-sm font-bold text-[#011f4b]">Tickets by Status</h3>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <ProgressBar
                          key={key}
                          label={cfg.label}
                          value={overview.byStatus[key] || 0}
                          total={overview.totalRequests}
                          color={
                            key ===
   'open' ? 'bg-blue-500'
                            : key ===
   'in_progress' ? 'bg-orange-500'
                            : key ===
   'escalated' ? 'bg-red-500'
                            : key ===
   'resolved' ? 'bg-emerald-500'
                            : 'bg-green-600'
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Resolution Metrics */}
                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                      <h3 className="text-sm font-bold text-[#011f4b]">Resolution Metrics</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#f8fafc] rounded-xl border border-[#b3cde0]/20 p-4 text-center">
                        <p className="text-3xl font-bold text-[#005b96]">{overview.resolution.avgResolutionHours}h</p>
                        <p className="text-[11px] font-semibold text-[#6497b1] mt-1 uppercase tracking-wider">Avg Resolution Time</p>
                      </div>
                      <div className="bg-[#f8fafc] rounded-xl border border-[#b3cde0]/20 p-4 text-center">
                        <p className="text-3xl font-bold text-[#005b96]">{overview.resolution.totalResolved}</p>
                        <p className="text-[11px] font-semibold text-[#6497b1] mt-1 uppercase tracking-wider">Total Resolved</p>
                      </div>
                      <div className="bg-[#f8fafc] rounded-xl border border-[#b3cde0]/20 p-4 text-center">
                        <p className="text-3xl font-bold text-[#005b96]">{overview.ratings.totalRatings}</p>
                        <p className="text-[11px] font-semibold text-[#6497b1] mt-1 uppercase tracking-wider">Total Ratings</p>
                      </div>
                      <div className="bg-[#f8fafc] rounded-xl border border-[#b3cde0]/20 p-4 text-center">
                        <p className="text-3xl font-bold text-[#005b96]">{overview.ratings.average ?? '-'}/5</p>
                        <p className="text-[11px] font-semibold text-[#6497b1] mt-1 uppercase tracking-wider">Average Rating</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 3: Message Type + Priority */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* By Message Type */}
                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                      <h3 className="text-sm font-bold text-[#011f4b]">By Message Type</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.entries(MESSAGE_TYPE_CONFIG) as [string, { label: string; color: string; bgColor: string }][]).map(([key, cfg]) => (
                        <div key={key} className={`p-4 rounded-xl ${cfg.bgColor} border`}>
                          <p className="text-2xl font-bold text-[#011f4b]">
                            {overview.byMessageType[key] || 0}
                          </p>
                          <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Priority */}
                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                      <h3 className="text-sm font-bold text-[#011f4b]">By Priority</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.entries(PRIORITY_CONFIG) as [string, { label: string; color: string; bgColor: string }][]).map(([key, cfg]) => (
                        <div key={key} className={`p-4 rounded-xl ${cfg.bgColor} border`}>
                          <p className="text-2xl font-bold text-[#011f4b]">
                            {overview.byPriority[key] || 0}
                          </p>
                          <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 4: Escalation Level Distribution */}
                <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                    <Layers className="w-4 h-4 text-[#005b96]" />
                    <h3 className="text-sm font-bold text-[#011f4b]">Current Escalation Level Distribution</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {(Object.entries(ESCALATION_LEVEL_LABELS) as [TmsEscalationLevel, string][]).map(([key, label]) => {
                      const count = overview.byEscalationLevel?.[key] || 0;
                      const colors: Record<string, string> = {
                        sub_category: 'bg-[#005b96]/[0.06] border-[#005b96]/15 text-[#005b96]',
                        category: 'bg-indigo-50 border-indigo-200/50 text-indigo-700',
                        master_category: 'bg-purple-50 border-purple-200/50 text-purple-700',
                        registrar: 'bg-orange-50 border-orange-200/50 text-orange-700',
                        dean_academics: 'bg-amber-50 border-amber-200/50 text-amber-700',
                        vice_chancellor: 'bg-red-50 border-red-200/50 text-red-700',
                      };
                      return (
                        <div key={key} className={`p-4 rounded-xl border text-center ${colors[key] || 'bg-[#f8fafc] border-[#b3cde0]/20'}`}>
                          <p className="text-2xl font-bold">{count}</p>
                          <p className="text-[11px] font-semibold mt-0.5 uppercase tracking-wider">{label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ==========
   ALL TICKETS TAB ==========
   */}
        {tab ===
   'tickets' && (
          <div>
            {/* Filter Panel */}
            <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-5 mb-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                  <Filter className="w-4 h-4 text-[#005b96]" />
                  <span className="text-sm font-bold text-[#011f4b]">Filters</span>
                  {hasActiveTicketFilters && (
                    <span className="ml-2 px-2 py-0.5 bg-[#005b96]/10 text-[#005b96] text-[10px] font-semibold rounded-lg uppercase">Active</span>
                  )}
                </div>
                {hasActiveTicketFilters && (
                  <button onClick={clearTicketFilters} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#005b96] hover:bg-[#005b96]/5 border border-[#b3cde0]/40 rounded-lg transition-colors">
                    <X className="w-3 h-3" /> Clear All
                  </button>
                )}
              </div>

              {/* Row 1: Search + Status + Type + Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6497b1]" />
                  <input
                    type="text"
                    placeholder="Search Request ID or Subject"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    className="w-full pl-9 pr-4 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/50 focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                  />
                </div>
                {/* Status */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as TmsTicketStatus | ''); setPage(1); }}
                  className="px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                >
                  <option value="">All Statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                {/* Type */}
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value as TmsMessageType | ''); setPage(1); }}
                  className="px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                >
                  <option value="">All Types</option>
                  {Object.entries(MESSAGE_TYPE_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
                {/* Priority */}
                <select
                  value={priorityFilter}
                  onChange={(e) => { setPriorityFilter(e.target.value as TmsPriority | ''); setPage(1); }}
                  className="px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                >
                  <option value="">All Priorities</option>
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              {/* Row 2: Master Category + Category + Sub-Category + Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                {/* Master Category */}
                <select
                  value={masterCatFilter}
                  onChange={(e) => { setMasterCatFilter(e.target.value); setCatFilter(''); setSubCatFilter(''); setPage(1); }}
                  className="px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                >
                  <option value="">All Master Categories</option>
                  {activeCats?.map((mc) => (
                    <option key={mc.id} value={mc.id}>{mc.name}</option>
                  ))}
                </select>
                {/* Category */}
                <select
                  value={catFilter}
                  onChange={(e) => { setCatFilter(e.target.value); setSubCatFilter(''); setPage(1); }}
                  className="px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                >
                  <option value="">All Categories</option>
                  {filteredCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {/* Sub-Category */}
                <select
                  value={subCatFilter}
                  onChange={(e) => { setSubCatFilter(e.target.value); setPage(1); }}
                  className="px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                >
                  <option value="">All Sub-Categories</option>
                  {filteredSubCats.map((sc: any) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
                {/* Level */}
                <select
                  value={levelFilter}
                  onChange={(e) => { setLevelFilter(e.target.value as TmsEscalationLevel | ''); setPage(1); }}
                  className="px-3.5 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                >
                  <option value="">All Levels</option>
                  {Object.entries(ESCALATION_LEVEL_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Row 3: Date Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6497b1]" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                    className="w-full pl-9 pr-4 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                    placeholder="Start Date"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6497b1]" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                    className="w-full pl-9 pr-4 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
                    placeholder="End Date"
                  />
                </div>
                <div className="lg:col-span-2 flex items-center">
                  <p className="text-xs text-[#6497b1]">
                    {allTicketsData ? (
                      <><span className="font-bold text-[#011f4b]">{allTicketsData.pagination.total}</span> ticket{allTicketsData.pagination.total !== 1 ? 's' : ''} found</>
                    ) : 'Loading...'}
                  </p>
                </div>
              </div>
            </div>

            {ticketsLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-[#b3cde0] border-t-[#005b96]" />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #011f4b 0%, #03396c 100%)' }}>
                        <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Request ID</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Subject</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Priority</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Category</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Level</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Created</th>
                        <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTicketsData?.tickets.map((t, idx) => {
                        const mc = MESSAGE_TYPE_CONFIG[t.messageType];
                        const pc = PRIORITY_CONFIG[t.priority];
                        return (
                          <tr
                            key={t.id}
                            className={`border-b border-[#b3cde0]/15 hover:bg-[#005b96]/[0.03] transition-colors ${idx % 2 ===
   0 ? 'bg-white' : 'bg-[#f8fafc]'}`}
                          >
                            <td className="px-4 py-3.5 font-semibold text-[#005b96]">{t.requestId}</td>
                            <td className="px-4 py-3.5 text-[#011f4b] max-w-[200px] truncate">{t.subject || t.description?.slice(0, 40)}</td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${mc?.bgColor} ${mc?.color}`}>{mc?.label}</span>
                            </td>
                            <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${pc?.bgColor} ${pc?.color}`}>{pc?.label}</span>
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              <span className="text-[#011f4b]">{t.masterCategory?.name}</span>
                              {t.subCategory?.name && <><br /><span className="text-[#6497b1]">{t.subCategory.name}</span></>}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[#6497b1]">
                              {ESCALATION_LEVEL_LABELS[t.currentLevel as TmsEscalationLevel] || t.currentLevel}
                            </td>
                            <td className="px-4 py-3.5 text-[#011f4b] text-xs">{new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => router.push(`/tms/${t.id}`)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm text-[#005b96] hover:text-white hover:bg-[#005b96] border border-[#005b96]/25 hover:border-[#005b96] rounded-lg font-medium transition-all"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!allTicketsData?.tickets || allTicketsData.tickets.length ===
   0) && (
                        <tr><td colSpan={9} className="px-4 py-16 text-center text-[#6497b1]">No tickets found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {allTicketsData && allTicketsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#6497b1]">
                  Showing {(allTicketsData.pagination.page - 1) * allTicketsData.pagination.limit + 1}–
                  {Math.min(allTicketsData.pagination.page * allTicketsData.pagination.limit, allTicketsData.pagination.total)} of {allTicketsData.pagination.total}
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page ===
   1} className="p-2 border border-[#b3cde0]/40 rounded-xl text-[#005b96] hover:bg-[#005b96]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 bg-[#005b96]/[0.06] text-[#005b96] text-sm font-semibold rounded-lg">
                    {allTicketsData.pagination.page} / {allTicketsData.pagination.totalPages}
                  </span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= allTicketsData.pagination.totalPages} className="p-2 border border-[#b3cde0]/40 rounded-xl text-[#005b96] hover:bg-[#005b96]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==========
   EMPLOYEE PERFORMANCE TAB ==========
   */}
        {tab ===
   'employees' && (
          <div className="space-y-6">
            {/* Summary row */}
            {employees && employees.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Active Employees" value={employees.length} icon={Users} color="bg-indigo-500" />
                <StatCard
                  label="Total Assigned"
                  value={employees.reduce((s, e) => s + e.totalAssigned, 0)}
                  icon={Ticket} color="bg-[#005b96]"
                />
                <StatCard
                  label="Avg Employee Rating"
                  value={
                    (() => {
                      const rated = employees.filter((e) => e.avgRating !== null && e.avgRating !== undefined);
                      if (rated.length ===
   0) return 'N/A';
                      return (rated.reduce((s, e) => s + (e.avgRating || 0), 0) / rated.length).toFixed(1);
                    })()
                  }
                  icon={Star} color="bg-amber-500"
                />
              </div>
            )}

            {/* Employee Table */}
            <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #011f4b 0%, #03396c 100%)' }}>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Employee</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">UID</th>
                      <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Designation</th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Open</th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Resolved</th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Closed</th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Escalated</th>
                      <th className="px-4 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Avg Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees?.map((emp, idx) => (
                      <tr key={emp.employee?.id || idx} className={`border-b border-[#b3cde0]/15 hover:bg-[#005b96]/[0.03] transition-colors ${idx % 2 ===
   0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                        <td className="px-4 py-3.5 font-semibold text-[#011f4b]">
                          {emp.employee?.employeeDetails?.displayName || 'Unknown'}
                        </td>
                        <td className="px-4 py-3.5 text-[#6497b1] font-mono text-xs">
                          {emp.employee?.uid || '-'}
                        </td>
                        <td className="px-4 py-3.5 text-[#6497b1] text-xs">
                          {emp.employee?.employeeDetails?.designation || '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-[#011f4b]">{emp.totalAssigned}</td>
                        <td className="px-4 py-3.5 text-center text-[#005b96] font-semibold">{(emp.byStatus.open || 0) + (emp.byStatus.in_progress || 0)}</td>
                        <td className="px-4 py-3.5 text-center text-emerald-600 font-semibold">{emp.byStatus.resolved || 0}</td>
                        <td className="px-4 py-3.5 text-center text-[#03396c] font-semibold">{emp.byStatus.closed || 0}</td>
                        <td className="px-4 py-3.5 text-center text-orange-600 font-semibold">{emp.byStatus.escalated || 0}</td>
                        <td className="px-4 py-3.5 text-center">
                          {emp.avgRating !== null && emp.avgRating !== undefined ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-bold">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              {emp.avgRating}
                            </span>
                          ) : (
                            <span className="text-[#b3cde0] text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!employees || employees.length ===
   0) && (
                      <tr><td colSpan={9} className="px-4 py-16 text-center text-[#6497b1]">No employee data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========
   CATEGORY ANALYTICS TAB ==========
   */}
        {tab ===
   'categories' && (
          <div className="space-y-6">

            {/* Summary Stats Row */}
            {categories?.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Total Tickets" value={categories.summary.totalTickets} icon={Ticket} color="bg-[#005b96]" />
                <StatCard label="Master Categories" value={categories.summary.totalMasterCategories} icon={FolderTree} color="bg-indigo-500" />
                <StatCard label="Total Resolved" value={categories.summary.totalResolved} icon={CheckCircle} color="bg-emerald-500" />
                <StatCard label="Total Escalations" value={categories.summary.totalEscalations} icon={AlertTriangle} color="bg-orange-500" />
              </div>
            )}

            {/* Academic vs Non-Academic Split */}
            {categories?.summary && categories.summary.totalTickets > 0 && (
              <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                  <Layers className="w-4 h-4 text-[#005b96]" />
                  <h3 className="text-sm font-bold text-[#011f4b]">Academic vs Non-Academic Distribution</h3>
                </div>
                <div className="flex gap-6 items-center">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-[#005b96]">Academic</span>
                      <span className="text-sm font-bold text-[#011f4b]">
                        {categories.summary.academicCount} ({Math.round((categories.summary.academicCount / categories.summary.totalTickets) * 100)}%)
                      </span>
                    </div>
                    <div className="h-4 bg-[#b3cde0]/20 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#005b96] to-[#6497b1] rounded-full transition-all duration-500"
                        style={{ width: `${(categories.summary.academicCount / categories.summary.totalTickets) * 100}%` }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-[#03396c]">Non-Academic</span>
                      <span className="text-sm font-bold text-[#011f4b]">
                        {categories.summary.nonAcademicCount} ({Math.round((categories.summary.nonAcademicCount / categories.summary.totalTickets) * 100)}%)
                      </span>
                    </div>
                    <div className="h-4 bg-[#b3cde0]/20 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#03396c] to-[#011f4b] rounded-full transition-all duration-500"
                        style={{ width: `${(categories.summary.nonAcademicCount / categories.summary.totalTickets) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Master Category Detailed Cards */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                <h3 className="text-sm font-bold text-[#011f4b]">Master Category Breakdown</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {categories?.byMasterCategory.map((mc) => {
                  const resolvedPct = mc.count > 0 && mc.resolved ? Math.round((mc.resolved / mc.count) * 100) : 0;
                  return (
                    <div key={mc.id} className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden hover:shadow-lg transition-all" style={{ boxShadow: '0 2px 8px 0 rgba(0, 91, 150, 0.05)' }}>
                      {/* Card Header */}
                      <div className="px-5 py-4 border-b border-[#b3cde0]/20" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e8f0fe 100%)' }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#005b96] to-[#03396c] flex items-center justify-center shadow-sm">
                              <FolderTree className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h4 className="text-base font-bold text-[#011f4b]">{mc.name}</h4>
                              <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider ${mc.isAcademic ? 'bg-[#005b96]/10 text-[#005b96]' : 'bg-[#6497b1]/10 text-[#6497b1]'}`}>
                                {mc.isAcademic ? 'Academic' : 'Non-Academic'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-extrabold text-[#005b96]">{mc.count}</p>
                            <p className="text-[10px] font-semibold text-[#6497b1] uppercase tracking-wider">Total Tickets</p>
                          </div>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="px-5 py-4 space-y-4">
                        {/* Status distribution mini-bars */}
                        {mc.byStatus && Object.keys(mc.byStatus).length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-[#6497b1] uppercase tracking-wider mb-2">Status Distribution</p>
                            <div className="flex h-2.5 rounded-full overflow-hidden bg-[#b3cde0]/15">
                              {Object.entries(mc.byStatus).map(([status, count]) => {
                                const pct = (count as number / mc.count) * 100;
                                const barColors: Record<string, string> = {
                                  open: 'bg-[#005b96]', in_progress: 'bg-amber-500', escalated: 'bg-red-500',
                                  resolved: 'bg-emerald-500', closed: 'bg-[#03396c]',
                                };
                                return <div key={status} className={`${barColors[status] || 'bg-gray-400'} transition-all`} style={{ width: `${pct}%` }} title={`${STATUS_CONFIG[status as TmsTicketStatus]?.label}: ${count}`} />;
                              })}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                              {Object.entries(mc.byStatus).map(([status, count]) => {
                                const cfg = STATUS_CONFIG[status as TmsTicketStatus];
                                return cfg ? (
                                  <span key={status} className="text-[11px] text-[#03396c]">
                                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                                      status ===
   'open' ? 'bg-[#005b96]' : status ===
   'in_progress' ? 'bg-amber-500' :
                                      status ===
   'escalated' ? 'bg-red-500' : status ===
   'resolved' ? 'bg-emerald-500' : 'bg-[#03396c]'
                                    }`} />
                                    {cfg.label}: <span className="font-bold">{count as number}</span>
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}

                        {/* Metrics Row */}
                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-[#f8fafc] rounded-xl border border-[#b3cde0]/20 p-3 text-center">
                            <p className="text-lg font-bold text-emerald-600">{resolvedPct}%</p>
                            <p className="text-[10px] text-[#6497b1] font-semibold uppercase">Resolved</p>
                          </div>
                          <div className="bg-[#f8fafc] rounded-xl border border-[#b3cde0]/20 p-3 text-center">
                            <p className="text-lg font-bold text-[#005b96]">{mc.avgResolutionHours || 0}h</p>
                            <p className="text-[10px] text-[#6497b1] font-semibold uppercase">Avg Time</p>
                          </div>
                          <div className="bg-[#f8fafc] rounded-xl border border-[#b3cde0]/20 p-3 text-center">
                            <p className="text-lg font-bold text-orange-600">{mc.escalations || 0}</p>
                            <p className="text-[10px] text-[#6497b1] font-semibold uppercase">Escalated</p>
                          </div>
                          <div className="bg-[#f8fafc] rounded-xl border border-[#b3cde0]/20 p-3 text-center">
                            <p className="text-lg font-bold text-amber-600">{mc.avgRating ?? '—'}</p>
                            <p className="text-[10px] text-[#6497b1] font-semibold uppercase">Avg Rating</p>
                          </div>
                        </div>

                        {/* Priority breakdown pills */}
                        {mc.byPriority && Object.keys(mc.byPriority).length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-[#6497b1] uppercase tracking-wider mb-2">Priority Breakdown</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(mc.byPriority).map(([prio, cnt]) => {
                                const pc = PRIORITY_CONFIG[prio as keyof typeof PRIORITY_CONFIG];
                                return (
                                  <span key={prio} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${pc?.bgColor || 'bg-gray-100'} ${pc?.color || 'text-gray-600'}`}>
                                    {pc?.label || prio}: {cnt as number}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!categories?.byMasterCategory || categories.byMasterCategory.length ===
   0) && (
                  <div className="col-span-2 bg-white rounded-2xl border border-[#b3cde0]/40 p-12 text-center">
                    <FolderTree className="w-10 h-10 text-[#b3cde0] mx-auto mb-3" />
                    <p className="text-sm text-[#6497b1]">No ticket data for master categories</p>
                  </div>
                )}
              </div>
            </div>

            {/* Category Table with Status Columns */}
            <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
              <div className="p-5 border-b border-[#b3cde0]/20">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                  <h3 className="text-sm font-bold text-[#011f4b]">Category Breakdown</h3>
                  <span className="ml-auto text-[11px] text-[#6497b1] font-medium">{categories?.byCategory?.length || 0} categories</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #011f4b 0%, #03396c 100%)' }}>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Category</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Master Category</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Total</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Open</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Resolved</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Escalated</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Avg Time</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Resolution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories?.byCategory.map((c, idx) => {
                      const resolvedPct = c.count > 0 && c.resolved ? Math.round((c.resolved / c.count) * 100) : 0;
                      return (
                        <tr key={c.id} className={`border-b border-[#b3cde0]/15 hover:bg-[#005b96]/[0.03] transition-colors ${idx % 2 ===
   0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                          <td className="px-5 py-3.5 font-semibold text-[#011f4b]">{c.name}</td>
                          <td className="px-5 py-3.5">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-[#005b96]/[0.06] text-[#005b96] text-xs font-medium">{c.masterCategory}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-[#011f4b]">{c.count}</td>
                          <td className="px-5 py-3.5 text-center text-[#005b96] font-semibold">{(c.byStatus?.open || 0) + (c.byStatus?.in_progress || 0)}</td>
                          <td className="px-5 py-3.5 text-center text-emerald-600 font-semibold">{c.byStatus?.resolved || 0}</td>
                          <td className="px-5 py-3.5 text-center text-orange-600 font-semibold">{c.byStatus?.escalated || 0}</td>
                          <td className="px-5 py-3.5 text-center text-[#6497b1] font-medium">{c.avgResolutionHours || 0}h</td>
                          <td className="px-5 py-3.5 text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-16 h-2 bg-[#b3cde0]/20 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${resolvedPct}%` }} />
                              </div>
                              <span className="text-xs font-bold text-emerald-600">{resolvedPct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(!categories?.byCategory || categories.byCategory.length ===
   0) && (
                      <tr><td colSpan={8} className="px-5 py-12 text-center text-[#6497b1]">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-Category Table with Status Columns */}
            <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
              <div className="p-5 border-b border-[#b3cde0]/20">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                  <h3 className="text-sm font-bold text-[#011f4b]">Sub-Category Breakdown</h3>
                  <span className="ml-auto text-[11px] text-[#6497b1] font-medium">{categories?.bySubCategory?.length || 0} sub-categories</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #011f4b 0%, #03396c 100%)' }}>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Sub-Category</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Category</th>
                      <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-white/90 uppercase tracking-wider">Master Category</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Total</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Open</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Resolved</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Escalated</th>
                      <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-white/90 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories?.bySubCategory?.map((s, idx) => {
                      const open = (s.byStatus?.open || 0) + (s.byStatus?.in_progress || 0);
                      const resolved = s.byStatus?.resolved || 0;
                      const escalated = s.byStatus?.escalated || 0;
                      return (
                        <tr key={s.id} className={`border-b border-[#b3cde0]/15 hover:bg-[#005b96]/[0.03] transition-colors ${idx % 2 ===
   0 ? 'bg-white' : 'bg-[#f8fafc]'}`}>
                          <td className="px-5 py-3.5 font-semibold text-[#011f4b]">{s.name}</td>
                          <td className="px-5 py-3.5">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-[#005b96]/[0.06] text-[#005b96] text-xs font-medium">{s.category || '-'}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-[#6497b1]/10 text-[#6497b1] text-xs font-medium">{s.masterCategory || '-'}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-[#011f4b]">{s.count}</td>
                          <td className="px-5 py-3.5 text-center text-[#005b96] font-semibold">{open}</td>
                          <td className="px-5 py-3.5 text-center text-emerald-600 font-semibold">{resolved}</td>
                          <td className="px-5 py-3.5 text-center text-orange-600 font-semibold">{escalated}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex h-2 rounded-full overflow-hidden bg-[#b3cde0]/15 w-24 mx-auto">
                              {s.byStatus && Object.entries(s.byStatus).map(([status, count]) => {
                                const pct = (count as number / s.count) * 100;
                                const barColors: Record<string, string> = {
                                  open: 'bg-[#005b96]', in_progress: 'bg-amber-500', escalated: 'bg-red-500',
                                  resolved: 'bg-emerald-500', closed: 'bg-[#03396c]',
                                };
                                return <div key={status} className={`${barColors[status] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} title={`${STATUS_CONFIG[status as TmsTicketStatus]?.label}: ${count}`} />;
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(!categories?.bySubCategory || categories.bySubCategory.length ===
   0) && (
                      <tr><td colSpan={8} className="px-5 py-12 text-center text-[#6497b1]">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
