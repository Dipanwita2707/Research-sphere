'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type ProgressTrackerRecord,
  type ProgressTrackerAnalyticsData,
  type ProgressTrackerFilters,
  type TrackerPubType,
  type TrackerStatus,
} from '@/features/ipr-management/services/drdAnalytics.service';
import { AnalyticsFilterBar, TrendChartPanel, AnalyticsBarChart, AnalyticsPipelineChart } from '@/components/analytics';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  GraduationCap,
  Layers3,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  User2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function is403(err: unknown): boolean {
  if (err && typeof err ===
   'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status ===
   403;
  }
  return false;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return 'â€”';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_META: Record<
  TrackerStatus,
  { label: string; color: string; bg: string; border: string; textColor: string }
> = {
  writing: { label: 'Writing', color: '#6366f1', bg: 'bg-indigo-50', border: 'border-indigo-200', textColor: 'text-indigo-700' },
  communicated: { label: 'Communicated', color: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-200', textColor: 'text-amber-700' },
  submitted: { label: 'Submitted', color: '#3b82f6', bg: 'bg-blue-50', border: 'border-blue-200', textColor: 'text-blue-700' },
  accepted: { label: 'Accepted', color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', textColor: 'text-emerald-700' },
  published: { label: 'Published', color: '#059669', bg: 'bg-green-50', border: 'border-green-200', textColor: 'text-green-700' },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'bg-red-50', border: 'border-red-200', textColor: 'text-red-700' },
};

const PUB_TYPE_META: Record<TrackerPubType, { label: string; icon: React.ReactNode; chipClass: string }> = {
  research_paper: { label: 'Research Paper', icon: <FileText className="h-4 w-4" />, chipClass: 'border-blue-200 bg-blue-50 text-blue-700' },
  book: { label: 'Book', icon: <BookOpen className="h-4 w-4" />, chipClass: 'border-violet-200 bg-violet-50 text-violet-700' },
  book_chapter: { label: 'Book Chapter', icon: <BookOpen className="h-4 w-4" />, chipClass: 'border-purple-200 bg-purple-50 text-purple-700' },
  conference_paper: { label: 'Conference Paper', icon: <Layers3 className="h-4 w-4" />, chipClass: 'border-teal-200 bg-teal-50 text-teal-700' },
  grant_proposal: { label: 'Grant Proposal', icon: <Target className="h-4 w-4" />, chipClass: 'border-orange-200 bg-orange-50 text-orange-700' },
  ipr: { label: 'IPR / Patent', icon: <Layers3 className="h-4 w-4" />, chipClass: 'border-rose-200 bg-rose-50 text-rose-700' },
};

const PUB_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'research_paper', label: 'Research Paper' },
  { value: 'book', label: 'Book' },
  { value: 'book_chapter', label: 'Book Chapter' },
  { value: 'conference_paper', label: 'Conference Paper' },
  { value: 'grant_proposal', label: 'Grant Proposal' },
];

const FUNNEL_PIPELINE: TrackerStatus[] = ['writing', 'communicated', 'submitted', 'accepted', 'published'];

function pubTypeLabel(type: string) {
  return PUB_TYPE_META[type as TrackerPubType]?.label || type.replace(/_/g, ' ');
}

function Panel({ title, subtitle, icon, actions, children }: { title: string; subtitle?: string; icon?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; }) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 shadow-sm">
      <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {icon && <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">{icon}</div>}
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, hint, icon, accent }: { label: string; value: string | number; hint: string; icon: React.ReactNode; accent: string; }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-[3px] ${accent}`} />
      <div className="mt-1 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}


function StatusPipelineFunnel({ statusFunnel, rejectedCount, onStatusClick }: { statusFunnel: ProgressTrackerAnalyticsData['statusFunnel']; rejectedCount: number; onStatusClick: (status: TrackerStatus) => void; }) {
  const countMap = Object.fromEntries(statusFunnel.map((entry) => [entry.status, entry.count]));
  const maxCount = Math.max(...statusFunnel.map((entry) => entry.count), 1);

  return (
    <Panel title="Research Pipeline" subtitle="Current distribution across each stage so bottlenecks are easy to detect." icon={<BarChart2 className="h-4 w-4" />}>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {FUNNEL_PIPELINE.map((status, index) => {
          const meta = STATUS_META[status];
          const count = countMap[status] ?? 0;
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <React.Fragment key={status}>
              <button onClick={() => onStatusClick(status)} className="min-w-[140px] flex-1 rounded-[24px] border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-b from-white to-slate-50/80 dark:from-gray-800 dark:to-gray-800/80 p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_40px_-24px_rgba(15,23,42,0.35)]">
                <div className="mx-auto mb-3 h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                  <div className="h-2.5 rounded-full transition-all duration-500" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}CC)`, width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }} />
                </div>
                <div className={`text-3xl font-semibold tracking-tight ${meta.textColor}`}>{count}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{meta.label}</div>
                <div className="mt-3 inline-flex rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-700 px-2.5 py-1 text-[11px] text-slate-500 dark:text-slate-400">{pct.toFixed(0)}% of peak load</div>
              </button>
              {index < FUNNEL_PIPELINE.length - 1 && <div className="flex w-10 shrink-0 items-center justify-center"><ArrowRight className="h-4 w-4 text-slate-300" /></div>}
            </React.Fragment>
          );
        })}
        <button onClick={() => onStatusClick('rejected')} className="min-w-[140px] rounded-[24px] border border-red-200 bg-gradient-to-b from-red-50 to-white p-4 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-24px_rgba(239,68,68,0.35)]">
          <div className="mx-auto mb-3 h-2.5 w-full rounded-full bg-red-100">
            <div className="h-2.5 rounded-full bg-gradient-to-r from-red-400 to-rose-500" style={{ width: `${Math.max((rejectedCount / maxCount) * 100, rejectedCount > 0 ? 8 : 0)}%` }} />
          </div>
          <div className="text-3xl font-semibold tracking-tight text-red-600">{rejectedCount}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-400">Rejected</div>
          <div className="mt-3 inline-flex rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] text-red-500">Exit branch</div>
        </button>
      </div>
    </Panel>
  );
}

function CategoryBreakdownGrid({ categoryBreakdown, activeFilter, onFilterChange, onDrilldown }: { categoryBreakdown: ProgressTrackerAnalyticsData['categoryBreakdown']; activeFilter: string; onFilterChange: (value: string) => void; onDrilldown: (value: TrackerPubType) => void; }) {
  return (
    <Panel
      title="Category Breakdown"
      subtitle="Compare contribution volume, active records, and publication conversion across publication types."
      icon={<Layers3 className="h-4 w-4" />}
      actions={<div className="flex flex-wrap gap-1.5">{PUB_TYPE_OPTIONS.map((option) => <button key={option.value} onClick={() => onFilterChange(option.value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${activeFilter ===
   option.value ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{option.label}</button>)}</div>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {categoryBreakdown.map((category) => {
          const meta = PUB_TYPE_META[category.publicationType as TrackerPubType];
          if (!meta) return null;
          const completionRate = category.total > 0 ? (category.published / category.total) * 100 : 0;
          const isActive = activeFilter ===
   category.publicationType;
          return (
            <button key={category.publicationType} onClick={() => { onFilterChange(category.publicationType); onDrilldown(category.publicationType as TrackerPubType); }} className={`group relative overflow-hidden rounded-[24px] border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_44px_-22px_rgba(15,23,42,0.35)] ${isActive ? 'border-slate-300 bg-slate-50 dark:bg-gray-700 shadow-[0_18px_40px_-22px_rgba(59,130,246,0.25)]' : 'border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-gray-800/80 hover:border-slate-300'}`}>
              <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-slate-100/60 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.chipClass}`}>{meta.icon}<span>{meta.label}</span></div>
                {isActive && <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">filtered</span>}
              </div>
              <div className="relative mt-5 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{category.total}</div>
              <p className="relative mt-1 text-xs text-slate-500 dark:text-slate-400">Total tracked records</p>
              <div className="relative mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-900/20 px-3 py-2 text-emerald-700 dark:text-emerald-400"><p className="font-semibold">{category.published}</p><p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">Published</p></div>
                <div className="rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/80 dark:bg-blue-900/20 px-3 py-2 text-blue-700 dark:text-blue-400"><p className="font-semibold">{category.active}</p><p className="mt-0.5 text-[11px] text-blue-600 dark:text-blue-400">Active</p></div>
                <div className="rounded-2xl border border-red-100 dark:border-red-900/50 bg-red-50/80 dark:bg-red-900/20 px-3 py-2 text-red-700 dark:text-red-400"><p className="font-semibold">{category.rejected}</p><p className="mt-0.5 text-[11px] text-red-500 dark:text-red-400">Rejected</p></div>
              </div>
              <div className="relative mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${completionRate}%` }} /></div>
              <p className="relative mt-2 text-xs text-slate-400 dark:text-slate-500">{completionRate.toFixed(0)}% published conversion</p>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function TrackerStatusBadge({ status }: { status: TrackerStatus }) {
  const meta = STATUS_META[status] || STATUS_META.writing;
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${meta.bg} ${meta.border} ${meta.textColor}`}>{meta.label}</span>;
}

function TrackerRecordsDrawer({
  drilldown,
  fromDate,
  toDate,
  onClose,
}: {
  drilldown: { title: string; subtitle: string; status?: TrackerStatus; publicationType?: string };
  fromDate: string;
  toDate: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<ProgressTrackerRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    drdAnalyticsService.getProgressTrackerRecords({
      from: fromDate,
      to: toDate,
      publicationType: drilldown.publicationType,
      status: drilldown.status,
    })
      .then((response) => {
        if (cancelled || !response?.data) return;
        setRecords(response.data.records || []);
        setTotalCount(response.data.totalCount || 0);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('Failed to load progress tracker drilldown records', err);
        setError('Unable to load tracker records right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [drilldown, fromDate, toDate]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(248,250,252,0.98)_100%)] dark:bg-gray-800 shadow-2xl">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.96)_42%,rgba(3,105,161,0.86)_100%)] px-6 py-5 text-white">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white backdrop-blur-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">{drilldown.title}</h2>
              <p className="mt-1 text-sm text-slate-200">{drilldown.subtitle}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
                {drilldown.status && <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Stage: {STATUS_META[drilldown.status].label}</span>}
                {drilldown.publicationType && <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Type: {pubTypeLabel(drilldown.publicationType)}</span>}
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Window: {fromDate} â†’ {toDate}</span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/10 p-2 text-white transition-colors hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 dark:border-slate-700 px-6 py-3 text-sm text-slate-500 dark:text-slate-400">
          {loading ? 'Loading recordsâ€¦' : `${totalCount} tracker record${totalCount !== 1 ? 's' : ''} found`}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
          ) : error ? (
            <div className="rounded-[24px] border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>
          ) : records.length ===
   0 ? (
            <div className="rounded-[24px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-8 text-center text-sm text-slate-400 dark:text-slate-500">No tracker records found for this drill-down.</div>
          ) : (
            records.map((record) => (
              <div key={record.id} className="rounded-[24px] border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-gray-800/90 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${PUB_TYPE_META[record.publicationType]?.chipClass || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                        {PUB_TYPE_META[record.publicationType]?.icon}
                        <span>{pubTypeLabel(record.publicationType)}</span>
                      </span>
                      <TrackerStatusBadge status={record.currentStatus} />
                    </div>
                    <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">{record.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>{record.trackingNumber}</span>
                      <span>{record.userName}</span>
                      <span>{record.schoolName}</span>
                      <span>{record.departmentName}</span>
                    </div>
                  </div>
                  {record.researchContribution?.applicationNumber && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-right text-xs text-emerald-700">
                      <p className="font-semibold">{record.researchContribution.applicationNumber}</p>
                      <p className="mt-0.5 text-emerald-600">Linked submission</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-400"><p className="font-medium text-slate-700 dark:text-slate-300">Created</p><p className="mt-1">{formatDate(record.createdAt)}</p></div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-400"><p className="font-medium text-slate-700 dark:text-slate-300">Last Updated</p><p className="mt-1">{formatDate(record.latestStatusChangedAt || record.updatedAt)}</p></div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-700 px-3 py-2 text-xs text-slate-500 dark:text-slate-400"><p className="font-medium text-slate-700 dark:text-slate-300">Completion</p><p className="mt-1">{formatDate(record.actualCompletionDate || record.expectedCompletionDate)}</p></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function AvgDaysTable({ avgDaysPerStatus }: { avgDaysPerStatus: ProgressTrackerAnalyticsData['avgDaysPerStatus'] }) {
  const entries = FUNNEL_PIPELINE.map((status) => ({ status, days: avgDaysPerStatus[status] })).filter((entry) => entry.days !== null && entry.days !== undefined);
  if (!entries.length) return null;
  return (
    <Panel title="Stage Velocity" subtitle="Average time trackers spend in each stage to highlight slow-moving sections of the pipeline." icon={<Clock3 className="h-4 w-4" />}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {entries.map(({ status, days }) => {
          const meta = STATUS_META[status];
          return <div key={status} className={`rounded-[22px] border px-4 py-4 shadow-sm ${meta.bg} ${meta.border}`}><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{meta.label}</p><p className={`mt-3 text-3xl font-semibold tracking-tight ${meta.textColor}`}>{days}d</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Average stage duration</p></div>;
        })}
      </div>
    </Panel>
  );
}

function ActiveUsersLeaderboard({ users }: { users: ProgressTrackerAnalyticsData['activeUsers'] }) {
  const topThree = users.slice(0, 3);
  return (
    <Panel title="Most Active Researchers" subtitle="A leaderboard of people driving the most tracker activity and publications." icon={<Users className="h-4 w-4" />}>
      {topThree.length > 0 && (
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {topThree.map((user, index) => (
            <div key={user.userId} className="rounded-[24px] border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-5 text-white shadow-[0_20px_50px_-24px_rgba(2,6,23,0.75)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">Top Performer #{index + 1}</p>
                  <h4 className="mt-2 text-lg font-semibold tracking-tight">{user.name}</h4>
                  <p className="mt-1 text-xs text-slate-300">{user.schoolName} Â· {user.departmentName}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm">{user.totalTrackers}</div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur-sm"><p className="text-lg font-semibold">{user.activeTrackers}</p><p className="mt-1 text-slate-300">Active</p></div>
                <div className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur-sm"><p className="text-lg font-semibold">{user.publishedCount}</p><p className="mt-1 text-slate-300">Published</p></div>
                <div className="rounded-2xl bg-white/10 px-3 py-3 backdrop-blur-sm"><p className="text-lg font-semibold">{user.statusTransitions}</p><p className="mt-1 text-slate-300">Updates</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
      {users.length ===
   0 ? <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No data available.</p> : (
        <div className="overflow-x-auto rounded-[24px] border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-gray-800/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-gray-700/80">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Rank</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Researcher</th>
                <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:table-cell">School</th>
                <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:table-cell">Department</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Published</th>
                <th className="hidden px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:table-cell">Transitions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr key={user.userId} className="border-b border-slate-50 dark:border-slate-700 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3">{index < 3 ? <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${index ===
   0 ? 'bg-yellow-100 text-yellow-700' : index ===
   1 ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600'}`}>{index + 1}</span> : <span className="text-xs text-slate-400 dark:text-slate-500">{index + 1}</span>}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><User2 className="h-4 w-4" /></div><div><span className="block max-w-[180px] truncate font-medium text-slate-800 dark:text-slate-200">{user.name}</span><span className="block text-xs text-slate-400 sm:hidden">{user.schoolName}</span></div></div></td>
                  <td className="hidden px-4 py-3 sm:table-cell"><span className="block max-w-[110px] truncate text-xs text-slate-500 dark:text-slate-400">{user.schoolName}</span></td>
                  <td className="hidden px-4 py-3 md:table-cell"><span className="block max-w-[130px] truncate text-xs text-slate-500 dark:text-slate-400">{user.departmentName}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">{user.totalTrackers}</td>
                  <td className="px-4 py-3 text-right"><span className="inline-flex rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">{user.activeTrackers}</span></td>
                  <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />{user.publishedCount}</span></td>
                  <td className="hidden px-4 py-3 text-right sm:table-cell"><span className="text-xs text-slate-400">{user.statusTransitions}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function SchoolDeptTable({ schoolWise, departmentWise }: { schoolWise: ProgressTrackerAnalyticsData['schoolWise']; departmentWise: ProgressTrackerAnalyticsData['departmentWise']; }) {
  const [view, setView] = useState<'school' | 'dept'>('school');
  const rows = view ===
   'school' ? schoolWise : departmentWise;
  const maxTotal = Math.max(...rows.map((row) => row.totalTrackers), 1);
  return (
    <Panel
      title={view ===
   'school' ? 'School Distribution' : 'Department Distribution'}
      subtitle="See where research tracking volume is concentrated and how much of it is still active."
      icon={<GraduationCap className="h-4 w-4" />}
      actions={<div className="flex gap-1.5">{(['school', 'dept'] as const).map((mode) => <button key={mode} onClick={() => setView(mode)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${view ===
   mode ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{mode ===
   'school' ? 'By School' : 'By Department'}</button>)}</div>}
    >
      {rows.length ===
   0 ? <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No data available.</p> : (
        <div className="space-y-3">
          {rows.slice(0, 15).map((row) => {
            const pct = (row.totalTrackers / maxTotal) * 100;
            const publishRate = row.totalTrackers > 0 ? (row.publishedCount / row.totalTrackers) * 100 : 0;
            const name = view ===
   'school' ? row.schoolName : (row as { departmentName: string }).departmentName;
            const subLabel = view ===
   'dept' ? row.schoolName : null;
            return (
              <div key={view ===
   'school' ? row.schoolId : (row as { departmentId: string }).departmentId} className="rounded-[22px] border border-slate-200/70 dark:border-slate-700/70 bg-white/75 dark:bg-gray-800/75 p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg"><GraduationCap className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5"><span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{name}</span>{subLabel && <span className="truncate text-xs text-slate-400 dark:text-slate-500">Â· {subLabel}</span>}</div>
                      <div className="mt-2 flex items-center gap-3"><div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-2 rounded-full bg-gradient-to-r from-slate-900 via-sky-700 to-cyan-500" style={{ width: `${Math.max(pct, row.totalTrackers > 0 ? 2 : 0)}%` }} /></div><span className="w-14 text-right text-xs font-medium text-slate-400">{pct.toFixed(0)}%</span></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs md:w-[270px]">
                    <div className="rounded-2xl bg-slate-50 dark:bg-gray-700 px-3 py-2 text-center"><span className="block text-lg font-semibold text-slate-800 dark:text-slate-200">{row.totalTrackers}</span><span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">Total</span></div>
                    <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-center"><span className="block text-lg font-semibold text-blue-700">{row.activeTrackers}</span><span className="mt-0.5 block text-[11px] text-blue-500">Active</span></div>
                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-center"><span className="block text-lg font-semibold text-emerald-700">{publishRate.toFixed(0)}%</span><span className="mt-0.5 block text-[11px] text-emerald-500">Published</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export default function ProgressTrackerAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<ProgressTrackerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [pubTypeFilter, setPubTypeFilter] = useState('all');
  const [drilldown, setDrilldown] = useState<{ title: string; subtitle: string; status?: TrackerStatus; publicationType?: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: ProgressTrackerFilters = { from: fromDate, to: toDate, publicationType: pubTypeFilter !== 'all' ? pubTypeFilter : undefined };
      const response = await drdAnalyticsService.getProgressTrackerAnalytics(filters);
      if (response?.data) setData(response.data);
    } catch (err: unknown) {
      if (is403(err)) setAccessDenied(true);
      else {
        logger.error('Progress tracker analytics fetch failed', err);
        setError('Failed to load analytics. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, pubTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = data?.kpis;

  const openStatusDrilldown = useCallback((status: TrackerStatus) => {
    setDrilldown({
      title: `${STATUS_META[status].label} Records`,
      subtitle: `Actual tracker records currently sitting in the ${STATUS_META[status].label.toLowerCase()} stage${pubTypeFilter !== 'all' ? ` for ${pubTypeLabel(pubTypeFilter)}` : ''}.`,
      status,
      publicationType: pubTypeFilter !== 'all' ? pubTypeFilter : undefined,
    });
  }, [pubTypeFilter]);

  const openCategoryDrilldown = useCallback((publicationType: TrackerPubType) => {
    setDrilldown({
      title: `${pubTypeLabel(publicationType)} Records`,
      subtitle: `Trackers inside ${pubTypeLabel(publicationType)}${pubTypeFilter !== publicationType ? ' across the selected time window' : ' for the active filter'}.`,
      publicationType,
    });
  }, [pubTypeFilter]);

  if (accessDenied) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
          <div className="w-full max-w-md rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center shadow-lg">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100"><AlertCircle className="h-8 w-8 text-red-600" /></div>
            <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
            <p className="mb-6 text-gray-600 dark:text-gray-400">You need <strong>Applicant Analytics</strong> permission to view Progress Tracker Analytics.</p>
            <button onClick={() => router.push('/drd/analytics/overview')} className="rounded-lg bg-blue-600 px-6 py-2.5 text-white transition-colors hover:bg-blue-700">Back to Analytics</button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      {drilldown && <TrackerRecordsDrawer drilldown={drilldown} fromDate={fromDate} toDate={toDate} onClose={() => setDrilldown(null)} />}
      <div className="min-h-screen bg-[#f2f4f8] dark:bg-gray-900">
        {/* Full-bleed header */}
        <header className="relative overflow-hidden bg-[linear-gradient(135deg,#050c1b_0%,#0f1f3d_42%,#0c3461_100%)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_-10%_-10%,rgba(56,189,248,0.2),transparent),radial-gradient(ellipse_50%_60%_at_110%_110%,rgba(99,102,241,0.18),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
          <div className="relative px-6 py-8 sm:px-8 lg:px-12 xl:px-16 lg:py-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={() => router.push('/drd/analytics/overview')} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Research Intelligence
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[2.25rem]">Progress Tracker Analytics</h1>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-300">Pipeline health, publication momentum, and who is driving research activity â€” all in one view.</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
            {/* Stat chips */}
            <div className="mt-7 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <div className="flex min-w-[120px] flex-col rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Total Tracked</span>
                <span className="mt-1.5 text-2xl font-bold leading-tight text-white">{kpis?.totalTrackers ?? 0}</span>
              </div>
              <div className="flex min-w-[120px] flex-col rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Active</span>
                <span className="mt-1.5 text-2xl font-bold leading-tight text-white">{kpis?.activeTrackers ?? 0}</span>
              </div>
              <div className="flex min-w-[120px] flex-col rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Published</span>
                <span className="mt-1.5 text-2xl font-bold leading-tight text-white">{kpis?.publishedCount ?? 0}</span>
              </div>
              <div className="flex min-w-[120px] flex-col rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Completion Rate</span>
                <span className="mt-1.5 text-2xl font-bold leading-tight text-white">{formatPercent(kpis?.completionRate ?? 0)}</span>
              </div>
              <div className="flex min-w-[120px] flex-col rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Researchers</span>
                <span className="mt-1.5 text-2xl font-bold leading-tight text-white">{kpis?.uniqueUsers ?? 0}</span>
              </div>
              <div className="flex min-w-[120px] flex-col rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Rejected</span>
                <span className="mt-1.5 text-2xl font-bold leading-tight text-white">{kpis?.rejectedCount ?? 0}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Filter bar */}
        <AnalyticsFilterBar fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} category={pubTypeFilter} onCategoryChange={setPubTypeFilter} categoryOptions={PUB_TYPE_OPTIONS} onApply={fetchData} onReset={() => { setFromDate(isoDate(new Date(Date.now() - 365 * 86400e3))); setToDate(isoDate(new Date())); setPubTypeFilter('all'); }} />

        {/* Content */}
        <div className="px-6 py-6 space-y-6 sm:px-8 lg:px-12 xl:px-16">
          {error && <div className="flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400"><AlertCircle className="h-5 w-5 flex-shrink-0" /><span className="text-sm">{error}</span></div>}

          {loading && !data ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="animate-pulse rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-5"><div className="mb-3 h-3 w-24 rounded bg-slate-100 dark:bg-slate-700" /><div className="h-8 w-20 rounded bg-slate-100 dark:bg-slate-700" /></div>)}</div>
              <div className="h-40 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-5" />
              <div className="h-56 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-5" />
            </div>
          ) : data ? (
            <>
              <StatusPipelineFunnel statusFunnel={data.statusFunnel} rejectedCount={kpis?.rejectedCount ?? 0} onStatusClick={openStatusDrilldown} />
              <CategoryBreakdownGrid categoryBreakdown={data.categoryBreakdown} activeFilter={pubTypeFilter} onFilterChange={setPubTypeFilter} onDrilldown={openCategoryDrilldown} />
              {/* Charts: Filed vs Published (monthly) + Pipeline stage breakdown */}
              <div className="grid gap-6 lg:grid-cols-5">
                {/* Bar chart: Filed vs Published per month */}
                <div className="lg:col-span-3">
                  <AnalyticsBarChart
                    title="Filed vs Published â€” Monthly"
                    subtitle="New trackers filed each month compared to those that reached publication."
                    data={(data.monthlyTrend || []).map((month) => ({
                      label: month.label,
                      values: {
                        filed: month.total,
                        published: month.published,
                      },
                    }))}
                    keys={[
                      { key: 'filed', label: 'Filed', color: '#6366f1' },
                      { key: 'published', label: 'Published', color: '#10b981' },
                    ]}
                    height={340}
                  />
                </div>

                {/* Pipeline stage chart */}
                <div className="lg:col-span-2">
                  <AnalyticsPipelineChart
                    title="Under-Process by Stage"
                    subtitle="Current count of trackers in each pipeline stage."
                    stages={[
                      ...FUNNEL_PIPELINE.map((status) => {
                        const meta = STATUS_META[status];
                        const entry = data.statusFunnel.find((s) => s.status ===
   status);
                        return {
                          key: status,
                          label: meta.label,
                          count: entry?.count ?? 0,
                          color: meta.color,
                          textColor: meta.textColor,
                        };
                      }),
                      {
                        key: 'rejected',
                        label: STATUS_META.rejected.label,
                        count: kpis?.rejectedCount ?? 0,
                        color: STATUS_META.rejected.color,
                        textColor: STATUS_META.rejected.textColor,
                      },
                    ]}
                    onStageClick={(key) => openStatusDrilldown(key as TrackerStatus)}
                    className="h-full"
                  />
                </div>
              </div>
              {data.avgDaysPerStatus && <AvgDaysTable avgDaysPerStatus={data.avgDaysPerStatus} />}
              <ActiveUsersLeaderboard users={data.activeUsers} />
              <SchoolDeptTable schoolWise={data.schoolWise} departmentWise={data.departmentWise} />
              <div className="pb-4 text-center text-xs text-slate-400 dark:text-slate-500">Analytics scope: <span className="font-medium capitalize text-slate-600 dark:text-slate-400">{data.meta.scopeApplied.scopeLevel}</span> Â· {data.meta.timeRange.from} â†’ {data.meta.timeRange.to}</div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400"><Loader2 className="h-8 w-8 animate-spin" /><p className="text-sm">Loading analyticsâ€¦</p></div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

