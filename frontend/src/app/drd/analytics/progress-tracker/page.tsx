'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
import {
  AnalyticsBarChart,
  AnalyticsFilterBar,
  AnalyticsHero,
  AnalyticsPanel,
  AnalyticsShell,
  KpiCardGrid,
} from '@/components/analytics';
import { VIZ, ui } from '@/components/analytics/theme';
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Clock3,
  GitBranch,
  GraduationCap,
  Layers3,
  RefreshCw,
  Repeat2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function is403(err: unknown): boolean {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status === 403;
  }
  return false;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Stage state pills: in-flight stages read neutral/amber, outcomes read green or red — always with the label. */
const STATUS_META: Record<TrackerStatus, { label: string; badge: string }> = {
  writing: { label: 'Writing', badge: 'bg-stone-100 text-stone-700 dark:bg-gray-700 dark:text-gray-200' },
  communicated: { label: 'Communicated', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  submitted: { label: 'Submitted', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  accepted: { label: 'Accepted', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  published: { label: 'Published', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Rejected', badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

/** Publication types keep one palette slot each (research blue, book orange, conference aqua, IPR yellow, grants magenta). */
const PUB_TYPE_META: Record<TrackerPubType, { label: string; color: string }> = {
  research_paper: { label: 'Research Paper', color: VIZ[0] },
  book: { label: 'Book', color: VIZ[1] },
  book_chapter: { label: 'Book Chapter', color: VIZ[6] },
  conference_paper: { label: 'Conference Paper', color: VIZ[2] },
  grant_proposal: { label: 'Grant Proposal', color: VIZ[4] },
  ipr: { label: 'IPR / Patent', color: VIZ[3] },
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

function PubTypeTag({ type }: { type: string }) {
  const color = PUB_TYPE_META[type as TrackerPubType]?.color;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700 dark:border-gray-600 dark:text-gray-200">
      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color || 'var(--viz-axis)' }} />
      {pubTypeLabel(type)}
    </span>
  );
}

const zeroCls = 'text-stone-300 dark:text-gray-600';
const numCls = (n: number) => (n ? 'text-stone-900 dark:text-white' : zeroCls);

/**
 * Ordered pipeline: one row per stage, bar length relative to the busiest
 * stage, with the count and its share of the first stage. Rejected sits
 * below as an exit branch in status red.
 */
function StatusPipelineFunnel({ statusFunnel, rejectedCount, onStatusClick }: { statusFunnel: ProgressTrackerAnalyticsData['statusFunnel']; rejectedCount: number; onStatusClick: (status: TrackerStatus) => void; }) {
  const countMap = Object.fromEntries(statusFunnel.map((entry) => [entry.status, entry.count]));
  const maxCount = Math.max(...statusFunnel.map((entry) => entry.count), rejectedCount, 1);
  const firstCount = countMap[FUNNEL_PIPELINE[0]] ?? 0;

  const row = (status: TrackerStatus, count: number, index: number | null) => {
    const isExit = index === null;
    const ofFirst = firstCount > 0 ? `${Math.round((count / firstCount) * 100)}%` : '—';
    return (
      <li key={status}>
        <button
          onClick={() => onStatusClick(status)}
          className="group grid w-full grid-cols-[1.5rem_minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40 sm:grid-cols-[1.5rem_8rem_minmax(0,1fr)_7.5rem_1rem]"
          aria-label={`${STATUS_META[status].label}: ${count} trackers. View records`}
        >
          <span className="text-xs font-medium tabular-nums text-stone-400 dark:text-gray-500">
            {isExit ? <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" /> : index + 1}
          </span>
          <span className={`truncate text-sm ${isExit ? 'text-red-700 dark:text-red-300' : 'text-stone-700 dark:text-gray-200'}`}>{STATUS_META[status].label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${count > 0 ? Math.max((count / maxCount) * 100, 2) : 0}%`,
                backgroundColor: isExit ? 'var(--viz-critical)' : VIZ[0],
              }}
            />
          </span>
          <span className="flex items-baseline justify-end gap-2 tabular-nums">
            <span className={`text-sm font-semibold ${numCls(count)}`}>{count}</span>
            <span className="w-11 text-right text-xs text-stone-400 dark:text-gray-500">{isExit ? 'exit' : ofFirst}</span>
          </span>
          <ChevronRight className="hidden h-4 w-4 text-stone-300 transition-colors group-hover:text-stone-500 dark:text-gray-600 dark:group-hover:text-gray-400 sm:block" />
        </button>
      </li>
    );
  };

  return (
    <AnalyticsPanel
      title="Research pipeline"
      subtitle={`Trackers currently in each stage, in order. Percentages are relative to ${STATUS_META[FUNNEL_PIPELINE[0]].label}.`}
      icon={<GitBranch />}
      className="h-full"
    >
      <div className="-mx-2">
        <div className="hidden grid-cols-[1.5rem_8rem_minmax(0,1fr)_7.5rem_1rem] gap-3 px-2 pb-2 sm:grid">
          <span />
          <span className={ui.label}>Stage</span>
          <span />
          <span className={`${ui.label} text-right`}>Count · of first</span>
          <span />
        </div>
        <ol>
          {FUNNEL_PIPELINE.map((status, index) => row(status, countMap[status] ?? 0, index))}
        </ol>
        <ul className="mt-2 border-t border-dashed border-stone-200 pt-2 dark:border-gray-700">
          {row('rejected', rejectedCount, null)}
        </ul>
      </div>
    </AnalyticsPanel>
  );
}

function CategoryBreakdownGrid({ categoryBreakdown, activeFilter, onFilterChange, onDrilldown }: { categoryBreakdown: ProgressTrackerAnalyticsData['categoryBreakdown']; activeFilter: string; onFilterChange: (value: string) => void; onDrilldown: (value: TrackerPubType) => void; }) {
  return (
    <AnalyticsPanel
      title="Category breakdown"
      subtitle="Volume, active records and publication conversion by publication type."
      icon={<Layers3 />}
      actions={(
        <div className="flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/50" role="group" aria-label="Publication type">
          {PUB_TYPE_OPTIONS.map((option) => {
            const active = activeFilter === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onFilterChange(option.value)}
                aria-pressed={active}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${active ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber' : 'text-stone-500 hover:text-stone-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {categoryBreakdown.map((category) => {
          const meta = PUB_TYPE_META[category.publicationType as TrackerPubType];
          if (!meta) return null;
          const completionRate = category.total > 0 ? (category.published / category.total) * 100 : 0;
          const isActive = activeFilter === category.publicationType;
          return (
            <button
              key={category.publicationType}
              onClick={() => { onFilterChange(category.publicationType); onDrilldown(category.publicationType as TrackerPubType); }}
              className={`group flex flex-col rounded-lg border p-4 text-left transition-colors ${isActive ? 'border-wine/40 bg-wine/5 dark:border-amber/40 dark:bg-gray-700/40' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-700/40'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-stone-700 dark:text-gray-200">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: meta.color }} />
                  <span className="truncate">{meta.label}</span>
                </span>
                {isActive
                  ? <span className="rounded-md bg-wine/10 px-1.5 py-0.5 text-[11px] font-medium text-wine dark:bg-wine/30 dark:text-amber">Filtered</span>
                  : <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 group-hover:text-stone-500 dark:text-gray-600 dark:group-hover:text-gray-400" />}
              </span>
              <span className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-stone-900 dark:text-white">{category.total}</span>
              <span className="text-xs text-stone-500 dark:text-gray-400">tracked records</span>
              <span className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'Active', value: category.active },
                  { label: 'Published', value: category.published },
                  { label: 'Rejected', value: category.rejected },
                ].map((s) => (
                  <span key={s.label}>
                    <span className={`block text-sm font-semibold tabular-nums ${numCls(s.value)}`}>{s.value}</span>
                    <span className="block text-stone-500 dark:text-gray-400">{s.label}</span>
                  </span>
                ))}
              </span>
              <span className="mt-4 block h-1.5 rounded-full bg-stone-100 dark:bg-gray-700">
                <span className="block h-1.5 rounded-full" style={{ width: `${completionRate}%`, backgroundColor: meta.color }} />
              </span>
              <span className="mt-1.5 text-xs tabular-nums text-stone-500 dark:text-gray-400">{completionRate.toFixed(0)}% published</span>
            </button>
          );
        })}
      </div>
    </AnalyticsPanel>
  );
}

function TrackerStatusBadge({ status }: { status: TrackerStatus }) {
  const meta = STATUS_META[status] || STATUS_META.writing;
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${meta.badge}`}>{meta.label}</span>;
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

  const metaPill = 'rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-gray-700 dark:text-gray-300';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-stone-900/40 dark:bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-stone-200 bg-[#faf8f6] shadow-xl dark:border-gray-700 dark:bg-gray-900" role="dialog" aria-modal="true" aria-labelledby="tracker-drawer-title">
        <div className="border-b border-stone-200 bg-white px-5 py-5 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="tracker-drawer-title" className="text-lg font-semibold tracking-tight text-stone-900 dark:text-white">{drilldown.title}</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">{drilldown.subtitle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {drilldown.status && <span className={metaPill}>Stage: {STATUS_META[drilldown.status].label}</span>}
                {drilldown.publicationType && <span className={metaPill}>Type: {pubTypeLabel(drilldown.publicationType)}</span>}
                <span className={`${metaPill} tabular-nums`}>Window: {fromDate} → {toDate}</span>
              </div>
            </div>
            <button onClick={onClose} className={`${ui.btnSecondary} w-9 justify-center px-0`} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-stone-200 bg-white px-5 py-2.5 text-sm text-stone-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:px-6">
          {loading ? 'Loading records…' : <><span className="tabular-nums">{totalCount}</span> tracker record{totalCount !== 1 ? 's' : ''} found</>}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${ui.card} space-y-3 p-4`}>
                <div className="h-4 w-40 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
              </div>
            ))
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : records.length === 0 ? (
            <div className={`${ui.card} p-8 text-center text-sm text-stone-500 dark:text-gray-400`}>No tracker records for this drill-down.</div>
          ) : (
            records.map((record) => (
              <article key={record.id} className={`${ui.card} p-4`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PubTypeTag type={record.publicationType} />
                      <TrackerStatusBadge status={record.currentStatus} />
                    </div>
                    <h3 className="mt-2.5 text-sm font-semibold text-stone-900 dark:text-white">{record.title}</h3>
                    <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">
                      {[record.trackingNumber, record.userName, record.schoolName, record.departmentName].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {record.researchContribution?.applicationNumber && (
                    <div className="shrink-0 rounded-lg border border-stone-200 px-3 py-2 text-xs dark:border-gray-600 sm:text-right">
                      <p className="font-semibold tabular-nums text-stone-900 dark:text-white">{record.researchContribution.applicationNumber}</p>
                      <p className="mt-0.5 text-stone-500 dark:text-gray-400">Linked submission</p>
                    </div>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-stone-100 pt-3 text-xs dark:border-gray-700 sm:grid-cols-3">
                  {[
                    { label: 'Created', value: formatDate(record.createdAt) },
                    { label: 'Last updated', value: formatDate(record.latestStatusChangedAt || record.updatedAt) },
                    { label: 'Completion', value: formatDate(record.actualCompletionDate || record.expectedCompletionDate) },
                  ].map((d) => (
                    <div key={d.label} className="flex justify-between gap-2 sm:block">
                      <dt className="text-stone-500 dark:text-gray-400">{d.label}</dt>
                      <dd className="font-medium tabular-nums text-stone-800 dark:text-gray-200 sm:mt-0.5">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
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
  const slowest = Math.max(...entries.map((e) => e.days as number));
  return (
    <AnalyticsPanel title="Stage velocity" subtitle="Average days a tracker spends in each stage. The slowest stage is flagged." icon={<Clock3 />}>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {entries.map(({ status, days }, i) => {
          const isSlowest = entries.length > 1 && days === slowest && slowest > 0;
          return (
            <li key={status} className={`rounded-lg border p-4 ${isSlowest ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-900/10' : 'border-stone-200 dark:border-gray-700'}`}>
              <p className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-gray-400">
                <span className="truncate"><span className="tabular-nums">{i + 1}.</span> {STATUS_META[status].label}</span>
                {isSlowest && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Slowest</span>}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-stone-900 dark:text-white">
                {days}<span className="ml-0.5 text-sm font-medium text-stone-500 dark:text-gray-400">d</span>
              </p>
            </li>
          );
        })}
      </ol>
    </AnalyticsPanel>
  );
}

function ActiveUsersLeaderboard({ users }: { users: ProgressTrackerAnalyticsData['activeUsers'] }) {
  return (
    <section className={`${ui.card} overflow-hidden`}>
      <div className={ui.cardHeader}>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className={ui.title}>Most active researchers</h2>
            <p className={ui.subtitle}>People driving the most tracker activity and publications.</p>
          </div>
        </div>
      </div>
      {users.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500 dark:text-gray-400">No data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-stone-50 dark:bg-gray-900/40">
              <tr>
                <th className={`${ui.th} w-14`}>Rank</th>
                <th className={ui.th}>Researcher</th>
                <th className={`${ui.th} hidden md:table-cell`}>Department</th>
                <th className={`${ui.th} text-right`}>Total</th>
                <th className={`${ui.th} text-right`}>Active</th>
                <th className={`${ui.th} text-right`}>Published</th>
                <th className={`${ui.th} text-right`}>Updates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
              {users.map((user, index) => (
                <tr key={user.userId} className="hover:bg-stone-50 dark:hover:bg-gray-700/40">
                  <td className={`${ui.td} tabular-nums ${index < 3 ? 'font-semibold text-stone-900 dark:text-white' : 'text-stone-400 dark:text-gray-500'}`}>{index + 1}</td>
                  <td className={ui.td}>
                    <span className="block max-w-[220px] truncate font-medium text-stone-900 dark:text-white">{user.name}</span>
                    <span className="block max-w-[220px] truncate text-xs text-stone-500 dark:text-gray-400">{user.schoolName}</span>
                  </td>
                  <td className={`${ui.td} hidden md:table-cell`}>
                    <span className="block max-w-[180px] truncate text-stone-500 dark:text-gray-400">{user.departmentName}</span>
                  </td>
                  <td className={`${ui.td} text-right font-semibold tabular-nums ${numCls(user.totalTrackers)}`}>{user.totalTrackers}</td>
                  <td className={`${ui.td} text-right tabular-nums ${user.activeTrackers ? '' : zeroCls}`}>{user.activeTrackers}</td>
                  <td className={`${ui.td} text-right tabular-nums ${user.publishedCount ? '' : zeroCls}`}>{user.publishedCount}</td>
                  <td className={`${ui.td} text-right tabular-nums ${user.statusTransitions ? 'text-stone-500 dark:text-gray-400' : zeroCls}`}>{user.statusTransitions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SchoolDeptTable({ schoolWise, departmentWise }: { schoolWise: ProgressTrackerAnalyticsData['schoolWise']; departmentWise: ProgressTrackerAnalyticsData['departmentWise']; }) {
  const [view, setView] = useState<'school' | 'dept'>('school');
  const rows = view === 'school' ? schoolWise : departmentWise;
  const maxTotal = Math.max(...rows.map((row) => row.totalTrackers), 1);
  return (
    <section className={`${ui.card} overflow-hidden`}>
      <div className={ui.cardHeader}>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div>
            <h2 className={ui.title}>{view === 'school' ? 'School distribution' : 'Department distribution'}</h2>
            <p className={ui.subtitle}>Where tracking volume is concentrated and how much is still active.</p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/50" role="group" aria-label="Group by">
          {(['school', 'dept'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${view === mode ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber' : 'text-stone-500 hover:text-stone-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              {mode === 'school' ? 'By school' : 'By department'}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500 dark:text-gray-400">No data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-stone-50 dark:bg-gray-900/40">
              <tr>
                <th className={ui.th}>{view === 'school' ? 'School' : 'Department'}</th>
                <th className={`${ui.th} w-[30%]`}>Share of busiest</th>
                <th className={`${ui.th} text-right`}>Total</th>
                <th className={`${ui.th} text-right`}>Active</th>
                <th className={`${ui.th} text-right`}>Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
              {rows.slice(0, 15).map((row) => {
                const pct = (row.totalTrackers / maxTotal) * 100;
                const publishRate = row.totalTrackers > 0 ? (row.publishedCount / row.totalTrackers) * 100 : 0;
                const name = view === 'school' ? row.schoolName : (row as { departmentName: string }).departmentName;
                const subLabel = view === 'dept' ? row.schoolName : null;
                return (
                  <tr key={view === 'school' ? row.schoolId : (row as { departmentId: string }).departmentId} className="hover:bg-stone-50 dark:hover:bg-gray-700/40">
                    <td className={ui.td}>
                      <span className="block max-w-[260px] truncate font-medium text-stone-900 dark:text-white">{name}</span>
                      {subLabel && <span className="block max-w-[260px] truncate text-xs text-stone-500 dark:text-gray-400">{subLabel}</span>}
                    </td>
                    <td className={ui.td}>
                      <span className="flex items-center gap-3">
                        <span className="h-2 flex-1 rounded-full bg-stone-100 dark:bg-gray-700">
                          <span className="block h-2 rounded-full" style={{ width: `${Math.max(pct, row.totalTrackers > 0 ? 2 : 0)}%`, backgroundColor: VIZ[0] }} />
                        </span>
                        <span className="w-10 text-right text-xs tabular-nums text-stone-500 dark:text-gray-400">{pct.toFixed(0)}%</span>
                      </span>
                    </td>
                    <td className={`${ui.td} text-right font-semibold tabular-nums ${numCls(row.totalTrackers)}`}>{row.totalTrackers}</td>
                    <td className={`${ui.td} text-right tabular-nums ${row.activeTrackers ? '' : zeroCls}`}>{row.activeTrackers}</td>
                    <td className={`${ui.td} text-right tabular-nums ${publishRate ? '' : zeroCls}`}>{publishRate.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
        <div className="flex min-h-screen items-center justify-center bg-[#faf8f6] p-6 dark:bg-gray-900">
          <div className={`${ui.card} w-full max-w-md p-8 text-center`}>
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30"><AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" /></div>
            <h2 className="mb-2 text-xl font-semibold text-stone-900 dark:text-white">Access denied</h2>
            <p className="mb-6 text-sm text-stone-500 dark:text-gray-400">You need <strong className="font-medium text-stone-700 dark:text-gray-200">Applicant Analytics</strong> permission to view Progress Tracker Analytics.</p>
            <button onClick={() => router.push('/drd/analytics/overview')} className={ui.btnPrimary}>Back to analytics</button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const total = kpis?.totalTrackers ?? 0;

  return (
    <ProtectedRoute>
      {drilldown && <TrackerRecordsDrawer drilldown={drilldown} fromDate={fromDate} toDate={toDate} onClose={() => setDrilldown(null)} />}
      <AnalyticsShell>
        <AnalyticsHero
          eyebrow="Progress tracker"
          icon={<Activity className="h-3.5 w-3.5" />}
          title="Progress tracker analytics"
          description="Pipeline health, publication momentum and who is driving research activity."
          onBack={() => router.push('/drd/analytics/overview')}
          backLabel="Back to overview"
          actions={(
            <button onClick={fetchData} disabled={loading} className={ui.btnSecondary}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          chips={[
            { label: 'Total tracked', value: total.toLocaleString('en-IN') },
            { label: 'Active', value: (kpis?.activeTrackers ?? 0).toLocaleString('en-IN') },
            { label: 'Published', value: (kpis?.publishedCount ?? 0).toLocaleString('en-IN') },
            { label: 'Completion rate', value: formatPercent(kpis?.completionRate ?? 0) },
          ]}
        />

        <AnalyticsFilterBar fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} category={pubTypeFilter} onCategoryChange={setPubTypeFilter} categoryOptions={PUB_TYPE_OPTIONS} onApply={fetchData} onReset={() => { setFromDate(isoDate(new Date(Date.now() - 365 * 86400e3))); setToDate(isoDate(new Date())); setPubTypeFilter('all'); }} />

        <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {loading && !data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className={`${ui.card} p-4`}>
                    <div className="mb-3 h-3 w-24 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                    <div className="h-7 w-16 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
              <div className="grid gap-6 lg:grid-cols-5">
                <div className="h-[340px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800 lg:col-span-2" />
                <div className="h-[340px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800 lg:col-span-3" />
              </div>
              <div className="h-56 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
            </div>
          ) : data ? (
            <>
              <KpiCardGrid
                cols={4}
                cards={[
                  { label: 'Researchers', value: kpis?.uniqueUsers ?? 0, icon: <Users /> },
                  { label: 'Rejected', value: kpis?.rejectedCount ?? 0, icon: <XCircle /> },
                  { label: 'Rejection rate', value: total > 0 ? ((kpis?.rejectedCount ?? 0) / total) * 100 : 0, format: 'percent' },
                  { label: 'Status updates', value: kpis?.totalStatusTransitions ?? 0, icon: <Repeat2 /> },
                ]}
              />

              {/* Pipeline + filed vs published */}
              <div className="grid gap-6 lg:grid-cols-5">
                <div className="min-w-0 lg:col-span-2">
                  <StatusPipelineFunnel statusFunnel={data.statusFunnel} rejectedCount={kpis?.rejectedCount ?? 0} onStatusClick={openStatusDrilldown} />
                </div>
                <div className="min-w-0 lg:col-span-3">
                  <AnalyticsBarChart
                    title="Filed vs published by month"
                    subtitle="New trackers filed each month against those that reached publication."
                    data={(data.monthlyTrend || []).map((month) => ({
                      label: month.label,
                      values: {
                        filed: month.total,
                        published: month.published,
                      },
                    }))}
                    keys={[
                      { key: 'filed', label: 'Filed' },
                      { key: 'published', label: 'Published' },
                    ]}
                    height={300}
                    className="h-full"
                  />
                </div>
              </div>

              <CategoryBreakdownGrid categoryBreakdown={data.categoryBreakdown} activeFilter={pubTypeFilter} onFilterChange={setPubTypeFilter} onDrilldown={openCategoryDrilldown} />
              {data.avgDaysPerStatus && <AvgDaysTable avgDaysPerStatus={data.avgDaysPerStatus} />}
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="min-w-0"><ActiveUsersLeaderboard users={data.activeUsers} /></div>
                <div className="min-w-0"><SchoolDeptTable schoolWise={data.schoolWise} departmentWise={data.departmentWise} /></div>
              </div>
              <p className="pb-4 text-center text-xs text-stone-500 dark:text-gray-400">
                Analytics scope: <span className="font-medium capitalize text-stone-700 dark:text-gray-300">{data.meta.scopeApplied.scopeLevel}</span> · <span className="tabular-nums">{data.meta.timeRange.from} → {data.meta.timeRange.to}</span>
              </p>
            </>
          ) : (
            <div className={`${ui.card} p-12 text-center text-sm text-stone-500 dark:text-gray-400`}>No data for this period.</div>
          )}
        </div>
      </AnalyticsShell>
    </ProtectedRoute>
  );
}
