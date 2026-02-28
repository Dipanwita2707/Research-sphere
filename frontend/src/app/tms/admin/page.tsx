'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, Users, FolderTree, Ticket, TrendingUp, Clock, Star, Eye,
  AlertTriangle, CheckCircle, XCircle, ArrowUpCircle, Layers,
} from 'lucide-react';
import {
  useOverviewAnalytics,
  useEmployeeAnalytics,
  useCategoryAnalytics,
  useAllTickets,
} from '@/features/ticket-management/hooks/useTickets';
import { STATUS_CONFIG, PRIORITY_CONFIG, MESSAGE_TYPE_CONFIG, ESCALATION_LEVEL_LABELS, PAGE_SIZE } from '@/features/ticket-management/constants';
import type { TmsTicketStatus, TmsEscalationLevel, AdminTicketListParams } from '@/features/ticket-management/types/tms.types';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof BarChart3; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
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
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-white">{value} ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TmsTicketStatus }) {
  const config = STATUS_CONFIG[status];
  if (!config) return <span className="text-xs">{status}</span>;
  const colorMap: Record<string, string> = {
    open: 'bg-blue-600 text-white',
    in_progress: 'bg-orange-500 text-white',
    escalated: 'bg-red-500 text-white',
    resolved: 'bg-emerald-600 text-white',
    closed: 'bg-green-600 text-white',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${colorMap[status] || 'bg-gray-200 text-gray-700'}`}>
      {config.label}
    </span>
  );
}

export default function TmsAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'tickets' | 'employees' | 'categories'>('overview');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<TmsTicketStatus | ''>('');

  const { data: overview, isLoading: overviewLoading } = useOverviewAnalytics();
  const { data: employees } = useEmployeeAnalytics();
  const { data: categories } = useCategoryAnalytics();

  const ticketParams: AdminTicketListParams = {
    page,
    limit: PAGE_SIZE,
    ...(statusFilter && { status: statusFilter }),
  };
  const { data: allTicketsData, isLoading: ticketsLoading } = useAllTickets(tab === 'tickets' ? ticketParams : undefined);

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { key: 'tickets' as const, label: 'All Tickets', icon: Ticket },
    { key: 'employees' as const, label: 'Employee Performance', icon: Users },
    { key: 'categories' as const, label: 'Category Analytics', icon: FolderTree },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">TMS Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Comprehensive analytics and ticket management</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ========== OVERVIEW TAB ========== */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {overviewLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Tickets by Status</h3>
                    <div className="space-y-3">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <ProgressBar
                          key={key}
                          label={cfg.label}
                          value={overview.byStatus[key] || 0}
                          total={overview.totalRequests}
                          color={
                            key === 'open' ? 'bg-blue-500'
                            : key === 'in_progress' ? 'bg-orange-500'
                            : key === 'escalated' ? 'bg-red-500'
                            : key === 'resolved' ? 'bg-emerald-500'
                            : 'bg-green-600'
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Resolution Metrics */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Resolution Metrics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 text-center">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{overview.resolution.avgResolutionHours}h</p>
                        <p className="text-xs text-gray-500 mt-1">Avg Resolution Time</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 text-center">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{overview.resolution.totalResolved}</p>
                        <p className="text-xs text-gray-500 mt-1">Total Resolved</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 text-center">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{overview.ratings.totalRatings}</p>
                        <p className="text-xs text-gray-500 mt-1">Total Ratings</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-4 text-center">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{overview.ratings.average ?? '-'}/5</p>
                        <p className="text-xs text-gray-500 mt-1">Average Rating</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 3: Message Type + Priority */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* By Message Type */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">By Message Type</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.entries(MESSAGE_TYPE_CONFIG) as [string, { label: string; color: string; bgColor: string }][]).map(([key, cfg]) => (
                        <div key={key} className={`p-3 rounded-lg ${cfg.bgColor} border`}>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {overview.byMessageType[key] || 0}
                          </p>
                          <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By Priority */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">By Priority</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.entries(PRIORITY_CONFIG) as [string, { label: string; color: string; bgColor: string }][]).map(([key, cfg]) => (
                        <div key={key} className={`p-3 rounded-lg ${cfg.bgColor} border`}>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">
                            {overview.byPriority[key] || 0}
                          </p>
                          <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 4: Escalation Level Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                    <Layers className="w-4 h-4 inline mr-1.5" />
                    Current Escalation Level Distribution
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {(Object.entries(ESCALATION_LEVEL_LABELS) as [TmsEscalationLevel, string][]).map(([key, label]) => {
                      const count = overview.byEscalationLevel?.[key] || 0;
                      const colors: Record<string, string> = {
                        sub_category: 'bg-blue-50 border-blue-200 text-blue-700',
                        category: 'bg-indigo-50 border-indigo-200 text-indigo-700',
                        master_category: 'bg-purple-50 border-purple-200 text-purple-700',
                        registrar: 'bg-orange-50 border-orange-200 text-orange-700',
                        dean_academics: 'bg-amber-50 border-amber-200 text-amber-700',
                        vice_chancellor: 'bg-red-50 border-red-200 text-red-700',
                      };
                      return (
                        <div key={key} className={`p-3 rounded-lg border text-center ${colors[key] || 'bg-gray-50 border-gray-200'}`}>
                          <p className="text-2xl font-bold">{count}</p>
                          <p className="text-xs font-medium mt-0.5">{label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ========== ALL TICKETS TAB ========== */}
        {tab === 'tickets' && (
          <div>
            <div className="flex gap-3 mb-4">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as TmsTicketStatus | ''); setPage(1); }}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            {ticketsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Request ID</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Subject</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Level</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Created</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-gray-300">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {allTicketsData?.tickets.map((t, idx) => {
                        const sc = STATUS_CONFIG[t.status];
                        const mc = MESSAGE_TYPE_CONFIG[t.messageType];
                        const pc = PRIORITY_CONFIG[t.priority];
                        return (
                          <tr
                            key={t.id}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}
                          >
                            <td className="px-4 py-3 font-medium text-blue-600">{t.requestId}</td>
                            <td className="px-4 py-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">{t.subject || t.description?.slice(0, 40)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${mc?.bgColor} ${mc?.color}`}>{mc?.label}</span>
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                            <td className="px-4 py-3">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${pc?.bgColor} ${pc?.color}`}>{pc?.label}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                              {t.masterCategory?.name}
                              {t.subCategory?.name && <><br /><span className="text-gray-400">{t.subCategory.name}</span></>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {ESCALATION_LEVEL_LABELS[t.currentLevel as TmsEscalationLevel] || t.currentLevel}
                            </td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => router.push(`/tms/${t.id}`)}
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!allTicketsData?.tickets || allTicketsData.tickets.length === 0) && (
                        <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">No tickets found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {allTicketsData && allTicketsData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Showing {(allTicketsData.pagination.page - 1) * allTicketsData.pagination.limit + 1}–
                  {Math.min(allTicketsData.pagination.page * allTicketsData.pagination.limit, allTicketsData.pagination.total)} of {allTicketsData.pagination.total}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50">Previous</button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= allTicketsData.pagination.totalPages} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== EMPLOYEE PERFORMANCE TAB ========== */}
        {tab === 'employees' && (
          <div className="space-y-4">
            {/* Summary row */}
            {employees && employees.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Active Employees" value={employees.length} icon={Users} color="bg-indigo-500" />
                <StatCard
                  label="Total Assigned"
                  value={employees.reduce((s, e) => s + e.totalAssigned, 0)}
                  icon={Ticket} color="bg-blue-500"
                />
                <StatCard
                  label="Avg Employee Rating"
                  value={
                    (() => {
                      const rated = employees.filter((e) => e.avgRating !== null && e.avgRating !== undefined);
                      if (rated.length === 0) return 'N/A';
                      return (rated.reduce((s, e) => s + (e.avgRating || 0), 0) / rated.length).toFixed(1);
                    })()
                  }
                  icon={Star} color="bg-yellow-500"
                />
              </div>
            )}

            {/* Employee Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Employee</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">UID</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Designation</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-gray-300">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-gray-300">Open</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-gray-300">Resolved</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-gray-300">Closed</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-gray-300">Escalated</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-gray-300">Avg Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {employees?.map((emp, idx) => (
                      <tr key={emp.employee?.id || idx} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {emp.employee?.employeeDetails?.displayName || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                          {emp.employee?.uid || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {emp.employee?.employeeDetails?.designation || '-'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold">{emp.totalAssigned}</td>
                        <td className="px-4 py-3 text-center text-blue-600">{(emp.byStatus.open || 0) + (emp.byStatus.in_progress || 0)}</td>
                        <td className="px-4 py-3 text-center text-emerald-600">{emp.byStatus.resolved || 0}</td>
                        <td className="px-4 py-3 text-center text-green-600">{emp.byStatus.closed || 0}</td>
                        <td className="px-4 py-3 text-center text-orange-600">{emp.byStatus.escalated || 0}</td>
                        <td className="px-4 py-3 text-center">
                          {emp.avgRating !== null && emp.avgRating !== undefined ? (
                            <span className="inline-flex items-center gap-1 text-yellow-600 font-semibold">
                              <Star className="w-3.5 h-3.5 fill-current" />
                              {emp.avgRating}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!employees || employees.length === 0) && (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">No employee data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========== CATEGORY ANALYTICS TAB ========== */}
        {tab === 'categories' && (
          <div className="space-y-6">
            {/* Master Category Cards with status breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Master Category Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories?.byMasterCategory.map((mc) => (
                  <div key={mc.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{mc.name}</h4>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${mc.isAcademic ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {mc.isAcademic ? 'Academic' : 'Non-Academic'}
                        </span>
                      </div>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{mc.count}</span>
                    </div>
                    {mc.byStatus && Object.keys(mc.byStatus).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(mc.byStatus).map(([status, count]) => {
                          const cfg = STATUS_CONFIG[status as TmsTicketStatus];
                          return cfg ? (
                            <span key={status} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${cfg.bgColor} ${cfg.color}`}>
                              {cfg.label}: {count as number}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {(!categories?.byMasterCategory || categories.byMasterCategory.length === 0) && (
                  <p className="text-sm text-gray-500 col-span-3">No ticket data for master categories</p>
                )}
              </div>
            </div>

            {/* Category Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Category Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Master Category</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-gray-300">Ticket Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {categories?.byCategory.map((c, idx) => (
                      <tr key={c.id} className={idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/50'}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{c.masterCategory}</td>
                        <td className="px-4 py-3 text-center font-semibold">{c.count}</td>
                      </tr>
                    ))}
                    {(!categories?.byCategory || categories.byCategory.length === 0) && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-Category Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sub-Category Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Sub-Category</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-300">Master Category</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-gray-300">Ticket Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {categories?.bySubCategory?.map((s, idx) => (
                      <tr key={s.id} className={idx % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/50'}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.category || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.masterCategory || '-'}</td>
                        <td className="px-4 py-3 text-center font-semibold">{s.count}</td>
                      </tr>
                    ))}
                    {(!categories?.bySubCategory || categories.bySubCategory.length === 0) && (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No data</td></tr>
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