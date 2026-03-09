'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, Star, X, ChevronLeft, ChevronRight, FileText, Filter } from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import { useMyTickets, useAssignedTickets, useActiveCategories } from '@/features/ticket-management/hooks/useTickets';
import { STATUS_CONFIG, PRIORITY_CONFIG, PAGE_SIZE } from '@/features/ticket-management/constants';
import type { TmsTicket, TmsTicketStatus, TmsPriority, TicketListParams } from '@/features/ticket-management/types/tms.types';

function getUserDisplayName(ticket: TmsTicket, field: 'createdBy' | 'assignedTo'): string {
  const user = ticket[field];
  if (!user) return 'Unassigned';
  if (user.employeeDetails) {
    const prefix = user.employeeDetails.designation ? `${user.employeeDetails.designation} ` : '';
    return `${prefix}${user.employeeDetails.displayName}`;
  }
  if (user.studentLogin) return user.studentLogin.displayName;
  return user.uid;
}

function StatusBadge({ status }: { status: TmsTicketStatus }) {
  const config = STATUS_CONFIG[status];
  if (!config) return <span className="text-xs">{status}</span>;

  const colorMap: Record<string, string> = {
    open: 'bg-[#005b96] text-white',
    in_progress: 'bg-amber-500 text-white',
    escalated: 'bg-red-500 text-white',
    resolved: 'bg-emerald-500 text-white',
    closed: 'bg-[#03396c] text-white',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide uppercase ${colorMap[status] || 'bg-gray-200 text-gray-700'}`}>
      {config.label}
    </span>
  );
}

function RatingStars({ rating }: { rating?: number | null }) {
  if (!rating) return <span className="text-xs text-[#6497b1] italic">Not rated</span>;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-[#b3cde0]'}`}
        />
      ))}
    </div>
  );
}

function PriorityBadge({ priority }: { priority?: TmsPriority }) {
  if (!priority) return <span className="text-xs text-[#6497b1]">—</span>;
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${config?.bgColor} ${config?.color}`}>
      {config?.label || priority}
    </span>
  );
}

export default function TmsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isStudent = user?.role?.name === 'student' || user?.userType === 'student';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TmsTicketStatus | ''>('');
  const [masterCategoryFilter, setMasterCategoryFilter] = useState('');

  const { data: categories } = useActiveCategories();

  const params: TicketListParams = {
    page,
    limit: PAGE_SIZE,
    ...(statusFilter && { status: statusFilter }),
    ...(search && { search }),
    ...(masterCategoryFilter && { masterCategoryId: masterCategoryFilter } as Record<string, string>),
  };

  const myTicketsQuery = useMyTickets(isStudent ? params : undefined);
  const assignedTicketsQuery = useAssignedTickets(!isStudent ? params : undefined);

  const activeQuery = isStudent ? myTicketsQuery : assignedTicketsQuery;
  const tickets: TmsTicket[] = useMemo(() => activeQuery.data?.tickets ?? [], [activeQuery.data?.tickets]);
  const pagination = activeQuery.data?.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 };

  const filteredTickets = useMemo(() => {
    let filtered = tickets;
    if (masterCategoryFilter) {
      filtered = filtered.filter((t) => t.masterCategory?.id === masterCategoryFilter);
    }
    return filtered;
  }, [tickets, masterCategoryFilter]);

  const hasActiveFilters = statusFilter || masterCategoryFilter || search;

  const clearFilters = () => {
    setStatusFilter('');
    setMasterCategoryFilter('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#011f4b] to-[#005b96] flex items-center justify-center shadow-md">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#011f4b] tracking-tight">
                {isStudent ? 'TMS History' : 'TMS Dashboard'}
              </h1>
              <p className="text-sm text-[#6497b1] mt-0.5">
                {isStudent ? 'View and manage all your requests' : 'View and manage assigned requests'}
              </p>
            </div>
          </div>
          <div className="mt-3 h-[2px] bg-gradient-to-r from-[#005b96] via-[#b3cde0] to-transparent rounded-full" />
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-5 mb-6" style={{ boxShadow: '0 2px 12px 0 rgba(0, 91, 150, 0.06)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-[#005b96]" />
            <span className="text-sm font-semibold text-[#03396c]">Filter Requests</span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6497b1]" />
              <input
                type="text"
                placeholder="Search by Request ID"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2.5 border border-[#b3cde0]/60 rounded-xl text-sm bg-[#f8fafc] text-[#011f4b] placeholder-[#6497b1]/60 focus:ring-2 focus:ring-[#005b96]/30 focus:border-[#005b96] outline-none transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as TmsTicketStatus | ''); setPage(1); }}
              className="px-3 py-2.5 border border-[#b3cde0]/60 rounded-xl text-sm bg-[#f8fafc] text-[#03396c] focus:ring-2 focus:ring-[#005b96]/30 focus:border-[#005b96] outline-none min-w-[160px] transition-all"
            >
              <option value="">Filter by Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={masterCategoryFilter}
              onChange={(e) => { setMasterCategoryFilter(e.target.value); setPage(1); }}
              className="px-3 py-2.5 border border-[#b3cde0]/60 rounded-xl text-sm bg-[#f8fafc] text-[#03396c] focus:ring-2 focus:ring-[#005b96]/30 focus:border-[#005b96] outline-none min-w-[160px] transition-all"
            >
              <option value="">Filter by Category</option>
              {categories?.map((mc) => (
                <option key={mc.id} value={mc.id}>{mc.name}</option>
              ))}
            </select>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                hasActiveFilters
                  ? 'bg-[#005b96]/10 text-[#005b96] hover:bg-[#005b96]/20 border border-[#005b96]/20'
                  : 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed'
              }`}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden" style={{ boxShadow: '0 2px 16px 0 rgba(0, 91, 150, 0.07)' }}>
          {activeQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-[#b3cde0] border-t-[#005b96]" />
              <p className="text-sm text-[#6497b1] mt-4 font-medium">Loading requests...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#b3cde0]/20 flex items-center justify-center mb-4">
                <FileText className="w-7 h-7 text-[#6497b1]" />
              </div>
              <p className="text-[#03396c] font-semibold">No requests found</p>
              <p className="text-sm text-[#6497b1] mt-1">
                {hasActiveFilters ? 'Try adjusting your filters' : ''}
              </p>
              {isStudent && !hasActiveFilters && (
                <button
                  onClick={() => router.push('/tms/new')}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#005b96] text-white text-sm font-medium rounded-xl hover:bg-[#03396c] transition-colors shadow-md shadow-[#005b96]/20"
                >
                  Submit your first request
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-[#011f4b] to-[#03396c]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Request ID</th>
                    {isStudent ? (
                      <>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Subject</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Master Category</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Subcategory</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Assigned Employee</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Status</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Rating</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Student Name</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Category</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Priority</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Date</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Status</th>
                      </>
                    )}
                    <th className="text-center px-5 py-3.5 text-xs font-semibold text-white/90 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#b3cde0]/20">
                  {filteredTickets.map((ticket, idx) => (
                    <tr
                      key={ticket.id}
                      className={`hover:bg-[#005b96]/[0.03] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'}`}
                    >
                      <td className="px-5 py-4">
                        <span className="text-sm text-[#005b96] font-semibold">{ticket.requestId}</span>
                      </td>
                      {isStudent ? (
                        <>
                          <td className="px-5 py-4">
                            <span className="text-sm text-[#011f4b] line-clamp-1 font-medium">{ticket.subject || ticket.description?.slice(0, 40)}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm text-[#03396c]">{ticket.masterCategory?.name}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm text-[#03396c]">{ticket.subCategory?.name}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm text-[#03396c] font-medium">{getUserDisplayName(ticket, 'assignedTo')}</span>
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={ticket.status} />
                          </td>
                          <td className="px-5 py-4">
                            <RatingStars rating={ticket.rating?.rating} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-4">
                            <span className="text-sm text-[#011f4b] font-medium">{getUserDisplayName(ticket, 'createdBy')}</span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-sm text-[#03396c]">{ticket.masterCategory?.name}</div>
                            <div className="text-xs text-[#6497b1] mt-0.5">{ticket.subCategory?.name}</div>
                          </td>
                          <td className="px-5 py-4">
                            <PriorityBadge priority={ticket.priority} />
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm text-[#03396c]">{new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={ticket.status} />
                          </td>
                        </>
                      )}
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => router.push(`/tms/${ticket.id}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[#005b96] hover:text-white bg-[#005b96]/[0.08] hover:bg-[#005b96] border border-[#005b96]/20 hover:border-[#005b96] rounded-lg font-medium transition-all duration-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {isStudent ? 'View' : 'Open'}
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
          <div className="flex items-center justify-between mt-5 px-1">
            <p className="text-sm text-[#6497b1] font-medium">
              Showing <span className="text-[#03396c] font-semibold">{(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="text-[#03396c] font-semibold">{pagination.total}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#b3cde0]/50 rounded-xl text-sm font-medium text-[#03396c] bg-white hover:bg-[#f8fafc] hover:border-[#005b96]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="px-3 py-2 text-sm font-semibold text-[#005b96] bg-[#005b96]/[0.08] rounded-lg">
                {pagination.page} / {pagination.totalPages}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#b3cde0]/50 rounded-xl text-sm font-medium text-[#03396c] bg-white hover:bg-[#f8fafc] hover:border-[#005b96]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
