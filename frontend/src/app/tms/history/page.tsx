'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, ArrowLeft, Clock, CheckCircle2, XCircle, ArrowUpRight, MessageSquare, ChevronLeft, ChevronRight, FileText, Filter } from 'lucide-react';
import { useMyHistory } from '@/features/ticket-management/hooks/useTickets';
import { STATUS_CONFIG, PRIORITY_CONFIG, PAGE_SIZE } from '@/features/ticket-management/constants';
import type { TmsTicket, TmsTicketStatus, TmsPriority, TmsTimelineAction, TicketListParams } from '@/features/ticket-management/types/tms.types';

// ============================================
// Helper functions
// ============================================

function getStudentName(ticket: TmsTicket): string {
  const u = ticket.createdBy;
  if (!u) return '—';
  if (u.studentLogin) return u.studentLogin.displayName;
  if (u.employeeDetails) return u.employeeDetails.displayName;
  return u.uid;
}

function getStudentId(ticket: TmsTicket): string {
  const u = ticket.createdBy;
  if (!u) return '';
  if (u.studentLogin) return u.studentLogin.registrationNo || u.studentLogin.studentId || '';
  if (u.employeeDetails) return u.employeeDetails.empId || '';
  return u.uid;
}

// ============================================
// Badges
// ============================================

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
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${colorMap[status] || 'bg-gray-200 text-gray-700'}`}>
      {config.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: TmsPriority }) {
  if (!priority) return <span className="text-xs text-gray-400">—</span>;
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${config?.bgColor} ${config?.color}`}>
      {config?.label || priority}
    </span>
  );
}

const ACTION_LABELS: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  resolved: { label: 'Resolved', icon: CheckCircle2, color: 'text-emerald-600' },
  closed: { label: 'Closed', icon: XCircle, color: 'text-green-700' },
  escalated: { label: 'Escalated', icon: ArrowUpRight, color: 'text-red-600' },
  remarked: { label: 'Remarked', icon: MessageSquare, color: 'text-blue-600' },
  assigned: { label: 'Assigned', icon: CheckCircle2, color: 'text-indigo-600' },
  status_changed: { label: 'Status Changed', icon: Clock, color: 'text-orange-600' },
  auto_escalated: { label: 'Auto-Escalated', icon: ArrowUpRight, color: 'text-amber-600' },
  forwarded: { label: 'Forwarded', icon: ArrowUpRight, color: 'text-purple-600' },
  created: { label: 'Created', icon: Clock, color: 'text-gray-500' },
  rated: { label: 'Rated', icon: CheckCircle2, color: 'text-amber-500' },
};

function ActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-xs text-gray-400">—</span>;
  const cfg = ACTION_LABELS[action];
  if (!cfg) return <span className="text-xs text-gray-600 capitalize">{action}</span>;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

// ============================================
// Page Component
// ============================================

export default function RequestHistoryPage() {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TmsTicketStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TmsPriority | ''>('');
  const [actionFilter, setActionFilter] = useState('');

  const params: TicketListParams = {
    page,
    limit: PAGE_SIZE,
    ...(statusFilter && { status: statusFilter }),
    ...(priorityFilter && { priority: priorityFilter }),
    ...(search && { search }),
    ...(actionFilter && { action: actionFilter } as Record<string, string>),
  };

  const { data, isLoading, isError } = useMyHistory(params);
  const tickets = useMemo(() => data?.tickets ?? [], [data?.tickets]);
  const pagination = data?.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 };

  const hasActiveFilters = statusFilter || priorityFilter || search || actionFilter;

  const clearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setActionFilter('');
    setSearch('');
    setPage(1);
  };

  // Summary stats from current data
  const stats = useMemo(() => {
    const all = tickets as (TmsTicket & { myLastAction?: string; myActionCount?: number })[];
    return {
      total: pagination.total,
      resolved: all.filter((t) => t.myLastAction === 'resolved').length,
      closed: all.filter((t) => t.myLastAction === 'closed').length,
      escalated: all.filter((t) => t.myLastAction === 'escalated').length,
      remarked: all.filter((t) => t.myLastAction === 'remarked').length,
    };
  }, [tickets, pagination.total]);

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.push('/tms')}
            className="p-2.5 bg-white hover:bg-[#005b96]/5 border border-[#b3cde0]/40 rounded-xl transition-all shadow-sm"
            title="Back to Assigned Tickets"
          >
            <ArrowLeft className="w-5 h-5 text-[#005b96]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#011f4b] tracking-tight">Request History</h1>
            <p className="text-sm text-[#6497b1] mt-0.5">All tickets you have acted on — resolved, closed, escalated, or remarked</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Total Acted', value: stats.total, iconBg: 'bg-[#005b96]/10', numColor: 'text-[#005b96]', border: 'border-[#005b96]/15' },
            { label: 'Resolved', value: stats.resolved, iconBg: 'bg-emerald-50', numColor: 'text-emerald-600', border: 'border-emerald-200/50' },
            { label: 'Closed', value: stats.closed, iconBg: 'bg-[#03396c]/10', numColor: 'text-[#03396c]', border: 'border-[#03396c]/15' },
            { label: 'Escalated', value: stats.escalated, iconBg: 'bg-red-50', numColor: 'text-red-600', border: 'border-red-200/50' },
            { label: 'Remarked', value: stats.remarked, iconBg: 'bg-[#6497b1]/10', numColor: 'text-[#6497b1]', border: 'border-[#6497b1]/20' },
          ].map((s) => (
            <div key={s.label} className={`bg-white rounded-2xl border ${s.border} p-4 text-center transition-all hover:shadow-md`} style={{ boxShadow: '0 2px 8px 0 rgba(0, 91, 150, 0.05)' }}>
              <div className={`text-3xl font-bold ${s.numColor}`}>{s.value}</div>
              <div className="text-[11px] font-semibold text-[#6497b1] mt-1 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-5 mb-8" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
            <Filter className="w-4 h-4 text-[#005b96]" />
            <span className="text-sm font-semibold text-[#011f4b]">Filters</span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6497b1]" />
              <input
                type="text"
                placeholder="Search by Request ID or Subject"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/50 focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none transition-colors"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as TmsTicketStatus | ''); setPage(1); }}
              className="px-3 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none min-w-[150px] transition-colors"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value as TmsPriority | ''); setPage(1); }}
              className="px-3 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none min-w-[140px] transition-colors"
            >
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="px-3 py-2.5 border border-[#b3cde0]/50 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] focus:ring-2 focus:ring-[#005b96]/20 focus:border-[#005b96] outline-none min-w-[150px] transition-colors"
            >
              <option value="">All Actions</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="escalated">Escalated</option>
              <option value="remarked">Remarked</option>
              <option value="assigned">Assigned</option>
            </select>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className={`px-4 py-2.5 border rounded-xl text-sm font-medium transition-all ${
                hasActiveFilters
                  ? 'border-[#005b96]/30 text-[#005b96] hover:bg-[#005b96]/5'
                  : 'border-[#b3cde0]/30 text-[#b3cde0] cursor-not-allowed'
              }`}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-[#b3cde0] border-t-[#005b96]" />
            </div>
          ) : isError ? (
            <div className="text-center py-20">
              <p className="text-red-500 text-sm font-medium">Failed to load history. Please try again.</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-[#005b96]/[0.06] rounded-2xl mb-4">
                <FileText className="w-7 h-7 text-[#b3cde0]" />
              </div>
              <p className="text-[#011f4b] text-sm font-semibold">No request history found</p>
              <p className="text-xs text-[#6497b1] mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Your history will appear here once you take action on assigned tickets'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #011f4b 0%, #03396c 100%)' }}>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-white/90 uppercase tracking-wider">Request ID</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-white/90 uppercase tracking-wider">Student</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-white/90 uppercase tracking-wider">Subject</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-white/90 uppercase tracking-wider">Category</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-white/90 uppercase tracking-wider">Priority</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-white/90 uppercase tracking-wider">Last Action</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-white/90 uppercase tracking-wider">Action Date</th>
                    <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-white/90 uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3.5 text-[11px] font-semibold text-white/90 uppercase tracking-wider">View</th>
                  </tr>
                </thead>
                <tbody>
                  {(tickets as (TmsTicket & { myLastAction?: string; myLastActionAt?: string; myActionCount?: number })[]).map((ticket, idx) => (
                    <tr
                      key={ticket.id}
                      className={`border-b border-[#b3cde0]/15 hover:bg-[#005b96]/[0.03] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}
                    >
                      {/* Request ID */}
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-[#005b96] font-semibold">{ticket.requestId}</span>
                      </td>

                      {/* Student */}
                      <td className="px-4 py-3.5">
                        <div className="text-sm font-medium text-[#011f4b]">{getStudentName(ticket)}</div>
                        <div className="text-[11px] text-[#6497b1]">{getStudentId(ticket)}</div>
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <span className="text-sm text-[#03396c] line-clamp-1">{ticket.subject}</span>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <div className="text-sm text-[#011f4b]">{ticket.masterCategory?.name}</div>
                        <div className="text-[11px] text-[#6497b1]">{ticket.subCategory?.name}</div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={ticket.priority} />
                      </td>

                      {/* Last Action */}
                      <td className="px-4 py-3.5">
                        <ActionBadge action={ticket.myLastAction ?? null} />
                        {(ticket.myActionCount ?? 0) > 1 && (
                          <div className="text-[10px] text-[#6497b1] mt-0.5">{ticket.myActionCount} actions total</div>
                        )}
                      </td>

                      {/* Action Date */}
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-[#011f4b]">
                          {ticket.myLastActionAt
                            ? new Date(ticket.myLastActionAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                        {ticket.myLastActionAt && (
                          <div className="text-[10px] text-[#6497b1]">
                            {new Date(ticket.myLastActionAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={ticket.status} />
                      </td>

                      {/* View */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => router.push(`/tms/${ticket.id}`)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm text-[#005b96] hover:text-white hover:bg-[#005b96] border border-[#005b96]/25 hover:border-[#005b96] rounded-lg font-medium transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 px-1">
            <p className="text-sm text-[#6497b1]">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-[#b3cde0]/40 rounded-xl text-[#005b96] hover:bg-[#005b96]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 bg-[#005b96]/[0.06] text-[#005b96] text-sm font-semibold rounded-lg">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="p-2 border border-[#b3cde0]/40 rounded-xl text-[#005b96] hover:bg-[#005b96]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
