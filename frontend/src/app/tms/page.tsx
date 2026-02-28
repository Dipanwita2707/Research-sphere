'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Eye, Star, X } from 'lucide-react';
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

function RatingStars({ rating }: { rating?: number | null }) {
  if (!rating) return <span className="text-sm text-gray-400">Not rated</span>;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
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
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{isStudent ? 'TMS History' : 'TMS Dashboard'}</h1>
          <p className="text-sm text-gray-500 mt-1">{isStudent ? 'View and manage all your requests' : 'View and manage assigned requests'}</p>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Request ID"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as TmsTicketStatus | ''); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px]"
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
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px]"
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
              className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                hasActiveFilters
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {activeQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">No requests found</p>
              {isStudent && (
                <button
                  onClick={() => router.push('/tms/new')}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Submit your first request
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Request ID</th>
                    {isStudent ? (
                      <>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Subject</th>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Master Category</th>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Subcategory</th>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Assigned Employee</th>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Status</th>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Rating</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Student Name</th>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Category</th>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Priority</th>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Date</th>
                        <th className="text-left px-4 py-3 text-sm font-bold text-gray-800">Status</th>
                      </>
                    )}
                    <th className="text-center px-4 py-3 text-sm font-bold text-gray-800">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket, idx) => (
                    <tr
                      key={ticket.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-blue-600 font-medium">{ticket.requestId}</span>
                      </td>
                      {isStudent ? (
                        <>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-800 line-clamp-1">{ticket.subject || ticket.description?.slice(0, 40)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-700">{ticket.masterCategory?.name}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-700">{ticket.subCategory?.name}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-700">{getUserDisplayName(ticket, 'assignedTo')}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={ticket.status} />
                          </td>
                          <td className="px-4 py-3.5">
                            <RatingStars rating={ticket.rating?.rating} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-800">{getUserDisplayName(ticket, 'createdBy')}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="text-sm text-gray-700">{ticket.masterCategory?.name}</div>
                            <div className="text-xs text-gray-400">{ticket.subCategory?.name}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <PriorityBadge priority={ticket.priority} />
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-700">{new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={ticket.status} />
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => router.push(`/tms/${ticket.id}`)}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Eye className="w-4 h-4" />
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
