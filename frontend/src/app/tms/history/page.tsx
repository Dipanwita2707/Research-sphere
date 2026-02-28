'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, ArrowLeft, Clock, CheckCircle2, XCircle, ArrowUpRight, MessageSquare } from 'lucide-react';
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
    open: 'bg-blue-600 text-white',
    in_progress: 'bg-orange-500 text-white',
    escalated: 'bg-red-500 text-white',
    resolved: 'bg-emerald-600 text-white',
    closed: 'bg-green-600 text-white',
  };
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${colorMap[status] || 'bg-gray-200 text-gray-700'}`}>
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
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => router.push('/tms')}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
            title="Back to Assigned Tickets"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Request History</h1>
            <p className="text-sm text-gray-500 mt-0.5">All tickets you have acted on — resolved, closed, escalated, or remarked</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Acted', value: stats.total, color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Resolved', value: stats.resolved, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'Closed', value: stats.closed, color: 'bg-green-50 text-green-700 border-green-200' },
            { label: 'Escalated', value: stats.escalated, color: 'bg-red-50 text-red-700 border-red-200' },
            { label: 'Remarked', value: stats.remarked, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs font-medium mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Request ID or Subject"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as TmsTicketStatus | ''); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none min-w-[150px]"
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
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none min-w-[140px]"
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
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none min-w-[150px]"
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
              className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                hasActiveFilters
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : isError ? (
            <div className="text-center py-16">
              <p className="text-red-500 text-sm">Failed to load history. Please try again.</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm font-medium">No request history found</p>
              <p className="text-xs text-gray-400 mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Your history will appear here once you take action on assigned tickets'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/60">
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Request ID</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Student</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Subject</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Last Action</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Action Date</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-600 uppercase tracking-wider">View</th>
                  </tr>
                </thead>
                <tbody>
                  {(tickets as (TmsTicket & { myLastAction?: string; myLastActionAt?: string; myActionCount?: number })[]).map((ticket, idx) => (
                    <tr
                      key={ticket.id}
                      className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      {/* Request ID */}
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-blue-600 font-medium">{ticket.requestId}</span>
                      </td>

                      {/* Student */}
                      <td className="px-4 py-3.5">
                        <div className="text-sm font-medium text-gray-800">{getStudentName(ticket)}</div>
                        <div className="text-xs text-gray-400">{getStudentId(ticket)}</div>
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <span className="text-sm text-gray-800 line-clamp-1">{ticket.subject}</span>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <div className="text-sm text-gray-700">{ticket.masterCategory?.name}</div>
                        <div className="text-xs text-gray-400">{ticket.subCategory?.name}</div>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={ticket.priority} />
                      </td>

                      {/* Last Action */}
                      <td className="px-4 py-3.5">
                        <ActionBadge action={ticket.myLastAction ?? null} />
                        {(ticket.myActionCount ?? 0) > 1 && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{ticket.myActionCount} actions total</div>
                        )}
                      </td>

                      {/* Action Date */}
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-gray-700">
                          {ticket.myLastActionAt
                            ? new Date(ticket.myLastActionAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                        </span>
                        {ticket.myLastActionAt && (
                          <div className="text-[10px] text-gray-400">
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
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 hover:border-blue-600 rounded-lg font-medium transition-all"
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
          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
