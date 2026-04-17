'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Filter,
  FolderTree,
  Paperclip,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/shared/auth/authStore';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  useNotingAdminActivity,
  useNotingAdminOverview,
  useNotingAdminUsers,
  useNotingConfig,
  useNotingList,
} from '@/features/noting-management/hooks/useNoting';
import type {
  Note,
  NotingAdminActivityItem,
  NotingAdminNoteSummary,
  NotingAnalyticsUser,
} from '@/features/noting-management/types/noting.types';
import { PAGE_SIZE, STATUS_CONFIG } from '@/features/noting-management/constants';
import { NotingAdminShimmer, ShimmerTableRow, ShimmerStatCard, ShimmerCard } from '@/components/shimmer';

type AdminTab = 'overview' | 'notings' | 'users' | 'activity';

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof BarChart3;
  color: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-[#b3cde0]/40 p-5 transition-all hover:shadow-md"
      style={{ boxShadow: '0 2px 8px 0 rgba(0, 91, 150, 0.05)' }}
    >
      <div className="flex items-center gap-3.5">
        <div className={`p-2.5 rounded-xl ${color} shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-[#011f4b]">{value}</p>
          <p className="text-[11px] font-semibold text-[#6497b1] uppercase tracking-wider">
            {label}
          </p>
          <p className="text-xs text-[#6497b1] mt-1 truncate">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs gap-3">
        <span className="text-[#03396c] font-medium">{label}</span>
        <span className="font-bold text-[#011f4b]">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-[#b3cde0]/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-10 text-center">
      <div className="w-14 h-14 mx-auto mb-4 bg-[#b3cde0]/20 rounded-full flex items-center justify-center">
        <BarChart3 className="w-7 h-7 text-[#005b96]" />
      </div>
      <h3 className="text-base font-semibold text-[#011f4b]">{title}</h3>
      <p className="text-sm text-[#6497b1] mt-2">{description}</p>
    </div>
  );
}

function getUserName(user: NotingAnalyticsUser | null | undefined) {
  return user?.displayName || user?.uid || 'Unknown';
}

function getNoteCreatorName(note: Note) {
  const creator = note.createdBy;
  if (creator?.employeeDetails?.displayName) return creator.employeeDetails.displayName;
  if (creator?.employeeDetails?.firstName || creator?.employeeDetails?.lastName) {
    return [creator.employeeDetails.firstName, creator.employeeDetails.lastName]
      .filter(Boolean)
      .join(' ');
  }
  if (creator?.studentLogin?.displayName) return creator.studentLogin.displayName;
  return creator?.uid || 'Unknown';
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getStatusBadge(status: string) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  }

  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${config.color}`}>
      {config.label}
    </span>
  );
}

function noteMetaParts(note: NotingAdminNoteSummary) {
  return [
    note.categoryLabel,
    note.subcategoryLabel,
    note.metadata.eventName ? `Event: ${note.metadata.eventName}` : null,
    note.metadata.clubName ? `Club: ${note.metadata.clubName}` : null,
    note.metadata.amountRequired && note.metadata.amount != null
      ? `Amount: ₹${Number(note.metadata.amount).toLocaleString()}`
      : null,
  ].filter(Boolean) as string[];
}

function actionLabel(action: string) {
  return action
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function NotingAdminPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notePage, setNotePage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const debouncedSearch = useDebounce(searchInput, 350);
  const tabOptions: { key: AdminTab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { key: 'notings' as const, label: 'All Notings', icon: FileText },
    { key: 'users' as const, label: 'Per User', icon: Users },
    { key: 'activity' as const, label: 'Activity', icon: Activity },
  ];
  const rawTab = searchParams.get('tab') as AdminTab | null;
  const tab = rawTab && tabOptions.some((item) => item.key === rawTab) ? rawTab : 'overview';

  const setActiveTab = useCallback(
    (nextTab: AdminTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', nextTab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const isStudent = !!user && (user.role?.name === 'student' || user.userType === 'student');
  const roleName = user?.role?.name || user?.userType || '';
  const canViewAnalytics = roleName === 'admin' || roleName === 'superadmin';

  const handleStatusFilterChange = useCallback((v: string) => {
    setStatusFilter(v);
    setNotePage(1);
  }, []);
  const handleCategoryFilterChange = useCallback((v: string) => {
    setCategoryFilter(v);
    setNotePage(1);
  }, []);
  const handleCreatorFilterChange = useCallback((v: string) => {
    setCreatorFilter(v);
    setNotePage(1);
  }, []);
  const handleStartDateChange = useCallback((v: string) => {
    setStartDate(v);
    setNotePage(1);
    setActivityPage(1);
  }, []);
  const handleEndDateChange = useCallback((v: string) => {
    setEndDate(v);
    setNotePage(1);
    setActivityPage(1);
  }, []);
  const handleSearchInputChange = useCallback((v: string) => {
    setSearchInput(v);
    setNotePage(1);
  }, []);

  const sharedFilters = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [startDate, endDate],
  );

  const { data: config } = useNotingConfig({
    enabled: canViewAnalytics && tab === 'notings',
  });
  const { data: overview, isLoading: overviewLoading } = useNotingAdminOverview(sharedFilters, {
    enabled: canViewAnalytics && tab === 'overview',
  });
  const { data: userAnalytics, isLoading: usersLoading } = useNotingAdminUsers(sharedFilters, {
    enabled: canViewAnalytics && tab === 'users',
  });
  const { data: activityAnalytics, isLoading: activityLoading } = useNotingAdminActivity(
    { ...sharedFilters, page: activityPage, limit: PAGE_SIZE },
    { enabled: canViewAnalytics && tab === 'activity' },
  );
  const { data: notesResult, isLoading: notesLoading } = useNotingList({
    filter: 'all',
    page: notePage,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    createdById: creatorFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    includeCounts: false,
    enabled: canViewAnalytics && tab === 'notings',
  });

  const notes = notesResult?.data || [];
  const notesPagination = notesResult?.pagination;
  const categoryOptions = config?.categories || [];

  if (!canViewAnalytics) {
    return (
      <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl border border-[#b3cde0]/40 p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-[#011f4b]">Access restricted</h1>
            <p className="text-sm text-[#6497b1] mt-2">
              Only admin users can open the Noting admin dashboard.
            </p>
            <Link href="/noting" className="inline-flex items-center gap-2 mt-6 px-4 py-2.5 rounded-xl bg-[#005b96] text-white text-sm font-medium">
              <FileText className="w-4 h-4" />
              Return to Noting
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-[#011f4b] to-[#005b96] rounded-2xl shadow-lg shadow-[#005b96]/20">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#011f4b] tracking-tight">Noting Admin Dashboard</h1>
              <p className="text-sm text-[#6497b1] mt-0.5">
                Platform-wide analytics for note creation, files, statuses, and workflow activity
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 bg-white rounded-2xl border border-[#b3cde0]/40 px-3 py-2">
              <CalendarRange className="w-4 h-4 text-[#6497b1]" />
              <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="text-sm bg-transparent outline-none text-[#011f4b]" />
              <span className="text-[#b3cde0]">to</span>
              <input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} className="text-sm bg-transparent outline-none text-[#011f4b]" />
            </div>
            <Link href="/noting" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-[#b3cde0]/50 bg-white text-[#03396c] text-sm font-medium hover:bg-[#f8fbfd]">
              <FileText className="w-4 h-4" />
              Open Workflow
            </Link>
          </div>
        </div>

        <div className="flex gap-1 mb-8 border-b border-[#b3cde0]/30 overflow-x-auto">
          {tabOptions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  tab === item.key
                    ? 'border-[#005b96] text-[#005b96]'
                    : 'border-transparent text-[#6497b1] hover:text-[#005b96] hover:border-[#b3cde0]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            {overviewLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <ShimmerStatCard key={i} />
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ShimmerCard className="h-64" />
                  <ShimmerCard className="h-64" />
                </div>
              </div>
            ) : overview ? (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="Total Notings" value={overview.summary.totalNotings} helper="All notings created in the selected window" icon={FileText} color="bg-blue-500" />
                  <StatCard label="Pending Review" value={overview.summary.pendingReview} helper="Still moving through the workflow" icon={Clock3} color="bg-amber-500" />
                  <StatCard label="Notes With Files" value={overview.summary.notesWithFiles} helper="Notings that include attachments" icon={Paperclip} color="bg-violet-500" />
                  <StatCard label="Total Attachments" value={overview.summary.totalAttachments} helper="Files associated with created notings" icon={FolderTree} color="bg-emerald-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                      <h3 className="text-sm font-bold text-[#011f4b]">Status Distribution</h3>
                    </div>
                    <div className="space-y-3">
                      <ProgressRow label="Draft" value={overview.byStatus.draft || 0} total={overview.summary.totalNotings} color="bg-slate-400" />
                      <ProgressRow label="Pending" value={overview.byStatus.pending || 0} total={overview.summary.totalNotings} color="bg-amber-500" />
                      <ProgressRow label="Approved" value={overview.byStatus.approved || 0} total={overview.summary.totalNotings} color="bg-emerald-500" />
                      <ProgressRow label="Rejected" value={overview.byStatus.rejected || 0} total={overview.summary.totalNotings} color="bg-red-500" />
                      <ProgressRow label="Reverted" value={overview.byStatus.reverted || 0} total={overview.summary.totalNotings} color="bg-orange-500" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                      <h3 className="text-sm font-bold text-[#011f4b]">Creation Trend</h3>
                    </div>
                    {overview.createdTimeline.length === 0 ? (
                      <p className="text-sm text-[#6497b1]">No note creations for the selected date range.</p>
                    ) : (
                      <div className="grid grid-cols-7 gap-3">
                        {overview.createdTimeline.map((point) => {
                          const maxCount = Math.max(...overview.createdTimeline.map((item) => item.count), 1);
                          const height = `${Math.max((point.count / maxCount) * 100, 10)}%`;
                          return (
                            <div key={point.date} className="flex flex-col justify-end items-center gap-2 h-36">
                              <span className="text-xs font-semibold text-[#011f4b]">{point.count}</span>
                              <div className="w-full bg-[#eaf3f8] rounded-xl h-24 flex items-end overflow-hidden">
                                <div className="w-full bg-gradient-to-t from-[#005b96] to-[#66b3d9] rounded-xl" style={{ height }} />
                              </div>
                              <span className="text-[11px] text-[#6497b1] text-center">{formatDay(point.date)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                      <h3 className="text-sm font-bold text-[#011f4b]">Category Breakdown</h3>
                    </div>
                    <div className="space-y-3">
                      {overview.bySubcategory.slice(0, 8).map((item) => (
                        <div key={`${item.category}-${item.key}`} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold text-[#011f4b] truncate">{item.label}</p>
                            <p className="text-xs text-[#6497b1] truncate">{item.categoryLabel}</p>
                          </div>
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-[#eaf3f8] text-[#03396c] font-semibold">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-1.5 h-5 rounded-full bg-[#d1495b]" />
                      <h3 className="text-sm font-bold text-[#011f4b]">Moderation Queue</h3>
                    </div>
                    {overview.moderationQueue.length === 0 ? (
                      <p className="text-sm text-[#6497b1]">No rejected, reverted, or pending notes in the selected range.</p>
                    ) : (
                      <div className="space-y-3">
                        {overview.moderationQueue.map((note) => (
                          <div key={note.id} className="rounded-xl border border-[#e3eef5] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-[#011f4b] truncate">{note.notingId}</p>
                                <p className="text-xs text-[#6497b1] truncate">{getUserName(note.createdBy)}</p>
                              </div>
                              {getStatusBadge(note.status)}
                            </div>
                            <p className="text-xs text-[#6497b1] mt-2 truncate">{noteMetaParts(note).join(' • ')}</p>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="text-xs text-[#6497b1]">Updated {formatDateTime(note.updatedAt)}</span>
                              <Link href={`/noting/${note.id}`} className="text-sm font-semibold text-[#005b96]">Review</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-6">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-5 rounded-full bg-[#005b96]" />
                      <h3 className="text-sm font-bold text-[#011f4b]">Recent Notings</h3>
                    </div>
                    <button type="button" onClick={() => setActiveTab('notings')} className="text-sm font-semibold text-[#005b96]">
                      View all
                    </button>
                  </div>
                  {overview.recentNotes.length === 0 ? (
                    <p className="text-sm text-[#6497b1]">No notings found for the current filters.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-[#6497b1] border-b border-[#e3eef5]">
                            <th className="pb-3 font-semibold">Noting</th>
                            <th className="pb-3 font-semibold">Creator</th>
                            <th className="pb-3 font-semibold">Created</th>
                            <th className="pb-3 font-semibold">Files</th>
                            <th className="pb-3 font-semibold">Status</th>
                            <th className="pb-3 font-semibold">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.recentNotes.map((note) => (
                            <tr key={note.id} className="border-b border-[#f1f6fa] last:border-b-0">
                              <td className="py-3 pr-4">
                                <p className="font-semibold text-[#011f4b]">{note.notingId}</p>
                                <p className="text-xs text-[#6497b1]">{noteMetaParts(note).join(' • ')}</p>
                              </td>
                              <td className="py-3 pr-4">
                                <p className="font-medium text-[#03396c]">{getUserName(note.createdBy)}</p>
                                <p className="text-xs text-[#6497b1]">{note.createdBy?.department || '—'}</p>
                              </td>
                              <td className="py-3 pr-4 text-[#03396c]">{formatDateTime(note.createdAt)}</td>
                              <td className="py-3 pr-4 text-[#03396c]">{note.attachmentCount}</td>
                              <td className="py-3 pr-4">{getStatusBadge(note.status)}</td>
                              <td className="py-3">
                                <Link href={`/noting/${note.id}`} className="inline-flex items-center gap-1.5 text-[#005b96] font-semibold">
                                  <Eye className="w-4 h-4" />
                                  Open
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <EmptyState title="No overview data" description="Try adjusting the date range to inspect noting activity." />
            )}
          </div>
        )}

        {tab === 'notings' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-[#b3cde0]/40 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px_220px] gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6497b1]" />
                  <input
                    value={searchInput}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    placeholder="Search by noting ID or description"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#b3cde0]/50 text-sm text-[#011f4b] outline-none focus:border-[#005b96]"
                  />
                </div>
                <select value={statusFilter} onChange={(e) => handleStatusFilterChange(e.target.value)} className="px-3 py-2.5 rounded-xl border border-[#b3cde0]/50 text-sm text-[#011f4b] outline-none focus:border-[#005b96]">
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([value, status]) => (
                    <option key={value} value={value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <select value={categoryFilter} onChange={(e) => handleCategoryFilterChange(e.target.value)} className="px-3 py-2.5 rounded-xl border border-[#b3cde0]/50 text-sm text-[#011f4b] outline-none focus:border-[#005b96]">
                  <option value="">All categories</option>
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              {(creatorFilter || searchInput || statusFilter || categoryFilter) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {creatorFilter && (
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#eaf3f8] text-[#03396c] text-sm font-medium">
                      Creator focus applied
                      <button type="button" onClick={() => handleCreatorFilterChange('')} className="text-[#005b96]">
                        Clear
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleSearchInputChange('');
                      handleStatusFilterChange('');
                      handleCategoryFilterChange('');
                      handleCreatorFilterChange('');
                    }}
                    className="text-sm font-semibold text-[#005b96]"
                  >
                    Reset filters
                  </button>
                </div>
              )}
            </div>

            {notesLoading ? (
              <ShimmerCard className="overflow-hidden">
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <ShimmerTableRow key={i} columns={7} />
                  ))}
                </div>
              </ShimmerCard>
            ) : notes.length === 0 ? (
              <EmptyState title="No notings match these filters" description="Try a broader search or clear one of the active filters." />
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#f8fbfd] text-[#6497b1]">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Noting</th>
                          <th className="px-4 py-3 text-left font-semibold">Creator</th>
                          <th className="px-4 py-3 text-left font-semibold">Created</th>
                          <th className="px-4 py-3 text-left font-semibold">Status</th>
                          <th className="px-4 py-3 text-left font-semibold">Files</th>
                          <th className="px-4 py-3 text-left font-semibold">Metadata</th>
                          <th className="px-4 py-3 text-left font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(notes as Note[]).map((note) => (
                          <tr key={note.id} className="border-t border-[#eef5f9]">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[#011f4b]">{note.notingId}</p>
                              <p className="text-xs text-[#6497b1] truncate max-w-[260px]">{note.category} / {note.subcategory}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-[#03396c]">{getNoteCreatorName(note)}</p>
                              <p className="text-xs text-[#6497b1]">{note.createdBy?.uid || '—'}</p>
                            </td>
                            <td className="px-4 py-3 text-[#03396c]">{formatDateTime(note.createdAt)}</td>
                            <td className="px-4 py-3">{getStatusBadge(note.status)}</td>
                            <td className="px-4 py-3 text-[#03396c]">{note._count?.attachments ?? 0} files</td>
                            <td className="px-4 py-3 text-[#6497b1]">
                              <div className="flex flex-col gap-1">
                                <span>{note.approvalPeriod === 'recurring' ? 'Recurring' : 'One-time'}</span>
                                {note.amountRequired && note.amount != null && (
                                  <span className="text-[#03396c] font-medium">₹{Number(note.amount).toLocaleString()}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/noting/${note.id}`} className="inline-flex items-center gap-1.5 text-[#005b96] font-semibold">
                                <Eye className="w-4 h-4" />
                                Open
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {notesPagination && notesPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between bg-white rounded-2xl border border-[#b3cde0]/40 px-4 py-3">
                    <p className="text-sm text-[#6497b1]">
                      Page {notesPagination.page} of {notesPagination.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={notesPagination.page <= 1} onClick={() => setNotePage((current) => Math.max(current - 1, 1))} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#b3cde0]/50 text-sm text-[#03396c] disabled:opacity-50">
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                      <button type="button" disabled={notesPagination.page >= notesPagination.totalPages} onClick={() => setNotePage((current) => current + 1)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#b3cde0]/50 text-sm text-[#03396c] disabled:opacity-50">
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="space-y-6">
            {usersLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <ShimmerStatCard key={i} />
                  ))}
                </div>
                <ShimmerCard className="overflow-hidden">
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <ShimmerTableRow key={i} columns={7} />
                    ))}
                  </div>
                </ShimmerCard>
              </div>
            ) : userAnalytics ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard label="Active Creators" value={userAnalytics.summary.totalCreators} helper="Users who created notes in range" icon={Users} color="bg-blue-500" />
                  <StatCard label="Avg Notes / Creator" value={userAnalytics.summary.averageNotesPerCreator} helper="Average creation volume" icon={BarChart3} color="bg-emerald-500" />
                  <StatCard label="Most Recent Creation" value={userAnalytics.summary.mostRecentCreatedAt ? formatDay(userAnalytics.summary.mostRecentCreatedAt) : '—'} helper="Latest note creation date" icon={Clock3} color="bg-violet-500" />
                </div>

                {userAnalytics.creators.length === 0 ? (
                  <EmptyState title="No creator activity" description="No notes were created in the selected date range." />
                ) : (
                  <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[#f8fbfd] text-[#6497b1]">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold">Creator</th>
                            <th className="px-4 py-3 text-left font-semibold">Role / Department</th>
                            <th className="px-4 py-3 text-left font-semibold">Total</th>
                            <th className="px-4 py-3 text-left font-semibold">With Files</th>
                            <th className="px-4 py-3 text-left font-semibold">Status Mix</th>
                            <th className="px-4 py-3 text-left font-semibold">Latest</th>
                            <th className="px-4 py-3 text-left font-semibold">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userAnalytics.creators.map((item) => (
                            <tr key={item.user.id} className="border-t border-[#eef5f9]">
                              <td className="px-4 py-3">
                                <p className="font-semibold text-[#011f4b]">{getUserName(item.user)}</p>
                                <p className="text-xs text-[#6497b1]">{item.user.uid || item.user.employeeIdOrStudentId || '—'}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[#03396c]">{item.user.role || '—'}</p>
                                <p className="text-xs text-[#6497b1]">{item.user.department || item.user.school || '—'}</p>
                              </td>
                              <td className="px-4 py-3 font-semibold text-[#011f4b]">{item.totalNotings}</td>
                              <td className="px-4 py-3 text-[#03396c]">{item.notesWithFiles}</td>
                              <td className="px-4 py-3 text-xs text-[#6497b1]">
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(item.byStatus).map(([status, count]) => (
                                    <span key={status} className="inline-flex px-2 py-1 rounded-full bg-[#eaf3f8] text-[#03396c]">
                                      {status}: {count}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[#03396c]">{formatDateTime(item.latestCreatedAt)}</td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                    onClick={() => {
                                      handleCreatorFilterChange(item.user.id);
                                      setActiveTab('notings');
                                      setNotePage(1);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-[#005b96] font-semibold"
                                >
                                  <Filter className="w-4 h-4" />
                                  View notes
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState title="No user analytics" description="Try a broader date range." />
            )}
          </div>
        )}

        {tab === 'activity' && (
          <div className="space-y-6">
            {activityLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <ShimmerStatCard key={i} />
                  ))}
                </div>
                <ShimmerCard className="overflow-hidden">
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <ShimmerTableRow key={i} columns={7} />
                    ))}
                  </div>
                </ShimmerCard>
              </div>
            ) : activityAnalytics ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatCard label="Total Activities" value={activityAnalytics.summary.totalActivities} helper="Workflow actions captured in history" icon={Activity} color="bg-blue-500" />
                  <StatCard label="Submitted" value={activityAnalytics.summary.byAction.submitted || 0} helper="New note submissions" icon={FileText} color="bg-emerald-500" />
                  <StatCard label="Approved" value={activityAnalytics.summary.byAction.approved || 0} helper="Approvals recorded" icon={CheckCircle2} color="bg-teal-500" />
                  <StatCard label="Forwarded" value={activityAnalytics.summary.byAction.forwarded || 0} helper="Routing changes in workflow" icon={AlertTriangle} color="bg-amber-500" />
                </div>

                {activityAnalytics.items.length === 0 ? (
                  <EmptyState title="No activity history" description="No note history entries were recorded in the selected date range." />
                ) : (
                  <>
                    <div className="bg-white rounded-2xl border border-[#b3cde0]/40 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-[#f8fbfd] text-[#6497b1]">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">When</th>
                              <th className="px-4 py-3 text-left font-semibold">Action</th>
                              <th className="px-4 py-3 text-left font-semibold">Note</th>
                              <th className="px-4 py-3 text-left font-semibold">Actor</th>
                              <th className="px-4 py-3 text-left font-semibold">Next Holder</th>
                              <th className="px-4 py-3 text-left font-semibold">Remarks</th>
                              <th className="px-4 py-3 text-left font-semibold">Open</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activityAnalytics.items.map((item: NotingAdminActivityItem) => (
                              <tr key={item.id} className="border-t border-[#eef5f9]">
                                <td className="px-4 py-3 text-[#03396c]">{formatDateTime(item.createdAt)}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-[#eaf3f8] text-[#03396c] font-semibold">
                                    {actionLabel(item.action)}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-[#011f4b]">{item.note.notingId}</p>
                                  <p className="text-xs text-[#6497b1]">{item.note.categoryLabel} / {item.note.subcategoryLabel}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-[#03396c]">{getUserName(item.performedBy)}</p>
                                  <p className="text-xs text-[#6497b1]">{item.performedBy?.role || '—'}</p>
                                </td>
                                <td className="px-4 py-3 text-[#03396c]">{item.nextHolder?.displayName || '—'}</td>
                                <td className="px-4 py-3 text-[#6497b1] max-w-[280px] truncate">{item.remarks || '—'}</td>
                                <td className="px-4 py-3">
                                  <Link href={`/noting/${item.note.id}`} className="inline-flex items-center gap-1.5 text-[#005b96] font-semibold">
                                    <Eye className="w-4 h-4" />
                                    Open
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {activityAnalytics.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between bg-white rounded-2xl border border-[#b3cde0]/40 px-4 py-3">
                        <p className="text-sm text-[#6497b1]">
                          Page {activityAnalytics.pagination.page} of {activityAnalytics.pagination.totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={activityAnalytics.pagination.page <= 1} onClick={() => setActivityPage((current) => Math.max(current - 1, 1))} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#b3cde0]/50 text-sm text-[#03396c] disabled:opacity-50">
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                          </button>
                          <button type="button" disabled={activityAnalytics.pagination.page >= activityAnalytics.pagination.totalPages} onClick={() => setActivityPage((current) => current + 1)} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[#b3cde0]/50 text-sm text-[#03396c] disabled:opacity-50">
                            Next
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <EmptyState title="No activity analytics" description="Try adjusting the selected date range." />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
