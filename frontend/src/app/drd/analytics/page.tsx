'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsFilters,
  type DrdAnalyticsResponse,
} from '@/features/ipr-management/services/drdAnalytics.service';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crosshair,
  Download,
  GraduationCap,
  Inbox,
  Layers3,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  UserCheck,
  X,
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';
import { AnalyticsBarChart, AnalyticsHero, AnalyticsShell } from '@/components/analytics';
import { VIZ, categoryColor, ui } from '@/components/analytics/theme';

type AnalyticsTab = 'applicant' | 'drd_member';

type AnalyticsFiltersState = {
  from: string;
  to: string;
  category: string;
  schoolId: string;
  departmentId: string;
  reviewerId: string;
};

type ApplicantSchoolRow = {
  schoolId: string;
  schoolName: string;
  totalApplications: number;
  totalApproved: number;
  totalIncentive: number;
};

type ApplicantDepartmentRow = {
  departmentId: string;
  departmentName: string;
  schoolId: string | null;
  schoolName: string;
  totalApplicants: number;
  totalApplications: number;
  totalApproved: number;
  totalIncentive: number;
};

type ApplicantPersonRow = {
  personId: string;
  applicantName: string;
  schoolName: string;
  departmentName: string;
  totalApplications: number;
  approvedCount: number;
  totalIncentive: number;
  filingCounts: {
    research: number;
    book: number;
    conference: number;
    ipr: number;
    grants: number;
  };
};

type ReviewerRow = {
  reviewerId: string;
  reviewerName: string;
  assignedCount: number;
  respondedCount: number;
  completedCount: number;
  pendingCount: number;
  completionRate: number;
  avgFirstResponseHours: number;
  avgCompletionHours: number;
  categoryBreakdown: {
    research: number;
    book: number;
    conference: number;
    ipr: number;
    grants: number;
  };
};

type MonthlyTrendPoint = {
  month: string;
  label: string;
  totalApplications?: number;
  approvedCount?: number;
  totalIncentive?: number;
  assigned?: number;
  responded?: number;
  completed?: number;
  research?: number;
  book?: number;
  conference?: number;
  ipr?: number;
  grants?: number;
};

type DrilldownKind = 'school' | 'department' | 'person' | 'reviewer';

type DrilldownState = {
  kind: DrilldownKind;
  title: string;
  subtitle: string;
  loading: boolean;
  data: DrdAnalyticsResponse | null;
} | null;

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultFilters(): AnalyticsFiltersState {
  const today = new Date();
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);

  return {
    from: toDateInputValue(ninetyDaysAgo),
    to: toDateInputValue(today),
    category: 'all',
    schoolId: '',
    departmentId: '',
    reviewerId: '',
  };
}

function formatNumber(value: number | undefined) {
  return Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value || 0);
}

function formatHours(value: number | undefined) {
  return `${formatNumber(value)} hrs`;
}

function formatPercent(value: number | undefined) {
  return `${formatNumber(value)}%`;
}

function formatDateLabel(value: string) {
  if (!value) return 'Open';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildRangeLabel(filters: AnalyticsFiltersState) {
  return `${formatDateLabel(filters.from)} – ${formatDateLabel(filters.to)}`;
}

function countActiveFilters(filters: AnalyticsFiltersState) {
  let count = 0;
  if (filters.category !== 'all') count += 1;
  if (filters.schoolId) count += 1;
  if (filters.departmentId) count += 1;
  if (filters.reviewerId) count += 1;
  return count;
}

function serializeCsvValue(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length || typeof window === 'undefined') return;

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => serializeCsvValue(row[header])).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Presentational pieces                                               */
/* ------------------------------------------------------------------ */

const rowActionCls =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 hover:text-stone-900 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700';
const selectCls = `${ui.input} w-full min-w-0 sm:w-auto`;
const theadCls = 'bg-stone-50 dark:bg-gray-900/40';
const tbodyCls = 'divide-y divide-stone-100 dark:divide-gray-700';
const trCls = 'transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40';
const numCls = 'px-4 py-3 text-right text-sm tabular-nums text-stone-700 dark:text-gray-200';

/** Numbers right-aligned; zeros recede so the eye lands on real activity. */
function Num({ value, format = formatNumber, strong = false }: { value: number | undefined; format?: (v: number | undefined) => string; strong?: boolean }) {
  if (!value) return <span className="text-stone-300 dark:text-gray-600">{format(0)}</span>;
  return <span className={strong ? 'font-semibold text-stone-900 dark:text-white' : undefined}>{format(value)}</span>;
}

function DashboardCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <div className={`${ui.card} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-stone-500 dark:text-gray-400">{title}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500 dark:bg-gray-700 dark:text-gray-300 [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
      </div>
      <p className={`mt-2 text-2xl leading-none tracking-tight ${ui.value}`}>{value}</p>
      <p className="mt-2.5 text-xs leading-relaxed text-stone-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={ui.cardHeader}>
      <div className="min-w-0">
        <h2 className={ui.title}>{title}</h2>
        <p className={ui.subtitle}>{description}</p>
      </div>
      {action}
    </div>
  );
}

function ScopeBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-800">
      <span className="text-stone-500 dark:text-gray-400">{label}</span>
      <span className="font-medium capitalize text-stone-800 dark:text-gray-100">{value}</span>
    </span>
  );
}

function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={`${ui.card} flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-500 dark:bg-gray-700 dark:text-gray-300">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-stone-900 dark:text-white">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-stone-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

function MonthlyBarChart({
  title,
  description,
  points,
  series,
}: {
  title: string;
  description: string;
  points: MonthlyTrendPoint[];
  series: Array<{ key: keyof MonthlyTrendPoint; label: string }>;
}) {
  const visiblePoints = points.slice(-6);
  const chartData = visiblePoints.map((point) => ({
    label: point.label,
    values: Object.fromEntries(series.map((item) => [String(item.key), Number(point[item.key] || 0)])),
  }));

  return (
    <AnalyticsBarChart
      title={title}
      subtitle={description}
      data={chartData}
      keys={series.map((item) => ({ key: String(item.key), label: item.label }))}
      height={260}
    />
  );
}

function InsightCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/60 p-4 dark:border-gray-700 dark:bg-gray-900/40">
      <p className={ui.label}>{title}</p>
      <p className="mt-1.5 truncate text-lg font-semibold capitalize tabular-nums text-stone-900 dark:text-white" title={value}>{value}</p>
      <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helper}</p>
    </div>
  );
}

/** Thin progress meter — the fill is data, so it takes a palette slot. */
function Meter({ percent, color = VIZ[0], label }: { percent: number; color?: string; label: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700"
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, backgroundColor: color }} />
    </div>
  );
}

const CATEGORY_KEYS = [
  { key: 'research', label: 'Research' },
  { key: 'book', label: 'Book' },
  { key: 'conference', label: 'Conference' },
  { key: 'ipr', label: 'IPR' },
  { key: 'grants', label: 'Grants' },
] as const;

/** Category counts as swatch + label + number; the swatch carries identity, the text stays ink. */
function CategorySplit({ counts }: { counts: Record<(typeof CATEGORY_KEYS)[number]['key'], number> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {CATEGORY_KEYS.map(({ key, label }) => {
        const v = counts[key] || 0;
        return (
          <span key={key} className={`inline-flex items-center gap-1.5 text-xs ${v ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: categoryColor(key), opacity: v ? 1 : 0.35 }} />
            {label}
            <span className="tabular-nums font-medium">{formatNumber(v)}</span>
          </span>
        );
      })}
    </div>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800 ${className}`} />;
}

function DrilldownDrawer({
  panel,
  onClose,
}: {
  panel: DrilldownState;
  onClose: () => void;
}) {
  if (!panel) return null;

  const schools = (panel.data?.schoolWise || []) as ApplicantSchoolRow[];
  const departments = (panel.data?.departmentWise || []) as ApplicantDepartmentRow[];
  const people = (panel.data?.people || []) as ApplicantPersonRow[];
  const reviewers = (panel.data?.reviewers || []) as ReviewerRow[];
  const trend = (panel.data?.extensions?.monthlyTrend || []) as MonthlyTrendPoint[];

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-stone-900/40 dark:bg-black/60">
      <button type="button" className="flex-1" onClick={onClose} aria-label="Close drilldown" />
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-stone-200 bg-[#faf8f6] shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="sticky top-0 z-10 border-b border-stone-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-wine dark:text-amber">Drill-down</p>
              <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-stone-900 dark:text-white">{panel.title}</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">{panel.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {panel.loading || !panel.data ? (
            panel.loading ? (
              <div className="space-y-5" aria-busy="true" aria-label="Loading detail analytics">
                <div className="grid gap-3 sm:grid-cols-3">
                  <SkeletonBlock className="h-24" />
                  <SkeletonBlock className="h-24" />
                  <SkeletonBlock className="h-24" />
                </div>
                <SkeletonBlock className="h-72" />
                <SkeletonBlock className="h-48" />
              </div>
            ) : (
              <EmptyPanel title="Detail could not be loaded" description="No data for this period." />
            )
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <InsightCard
                  title="Scope level"
                  value={panel.data.meta.scopeApplied.scopeLevel}
                  helper="Resolved from the narrowed analytics context."
                />
                <InsightCard
                  title="Range"
                  value={`${formatDateLabel(panel.data.meta.timeRange.from)} – ${formatDateLabel(panel.data.meta.timeRange.to)}`}
                  helper="Same time filter as the parent dashboard."
                />
                <InsightCard
                  title="Records"
                  value={formatNumber(people.length || reviewers.length || departments.length || schools.length)}
                  helper="Entities included in this focused view."
                />
              </div>

              <MonthlyBarChart
                title="Monthly focus trend"
                description="Trend for just the selected entity, last six months."
                points={trend}
                series={
                  panel.kind === 'reviewer'
                    ? [
                        { key: 'assigned', label: 'Assigned' },
                        { key: 'completed', label: 'Completed' },
                      ]
                    : [
                        { key: 'totalApplications', label: 'Applications' },
                        { key: 'approvedCount', label: 'Approved' },
                      ]
                }
              />

              {people.length > 0 ? (
                <section className={`overflow-hidden ${ui.card}`}>
                  <SectionHeader
                    title="Applicants in focus"
                    description="People-level records inside the selected school, department or applicant view."
                  />
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className={theadCls}>
                        <tr>
                          <th className={ui.th}>Applicant</th>
                          <th className={ui.th}>Department</th>
                          <th className={`${ui.th} text-right`}>Applications</th>
                          <th className={`${ui.th} text-right`}>Approved</th>
                          <th className={`${ui.th} text-right`}>Incentive</th>
                        </tr>
                      </thead>
                      <tbody className={tbodyCls}>
                        {people.map((person) => (
                          <tr key={person.personId} className={trCls}>
                            <td className={`${ui.td} font-medium text-stone-900 dark:text-white`}>{person.applicantName}</td>
                            <td className={`${ui.td} text-stone-500 dark:text-gray-400`}>{person.departmentName}</td>
                            <td className={numCls}><Num value={person.totalApplications} /></td>
                            <td className={numCls}><Num value={person.approvedCount} /></td>
                            <td className={numCls}><Num value={person.totalIncentive} strong /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {reviewers.length > 0 ? (
                <section className={`overflow-hidden ${ui.card}`}>
                  <SectionHeader
                    title="Reviewer in focus"
                    description="Detailed reviewer performance for the selected DRD member."
                  />
                  <ul className={tbodyCls}>
                    {reviewers.map((reviewer) => (
                      <li key={reviewer.reviewerId} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-stone-900 dark:text-white">{reviewer.reviewerName}</p>
                          <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">
                            Completion <span className="tabular-nums">{formatPercent(reviewer.completionRate)}</span> · First response{' '}
                            <span className="tabular-nums">{formatHours(reviewer.avgFirstResponseHours)}</span>
                          </p>
                        </div>
                        <dl className="grid grid-cols-2 gap-6 text-right">
                          <div>
                            <dt className={ui.label}>Assigned</dt>
                            <dd className={`mt-0.5 text-base ${ui.value}`}>{formatNumber(reviewer.assignedCount)}</dd>
                          </div>
                          <div>
                            <dt className={ui.label}>Pending</dt>
                            <dd className={`mt-0.5 text-base ${ui.value}`}>{formatNumber(reviewer.pendingCount)}</dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function DrdAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('applicant');
  const [loading, setLoading] = useState(true);
  const [permStatus, setPermStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [data, setData] = useState<DrdAnalyticsResponse | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownState>(null);
  const [filters, setFilters] = useState<AnalyticsFiltersState>(() => getDefaultFilters());
  const [draftFilters, setDraftFilters] = useState<AnalyticsFiltersState>(() => getDefaultFilters());

  // Permission check — need at least one analytics permission
  useEffect(() => {
    const check = async () => {
      try {
        const [app, mem] = await Promise.allSettled([
          drdAnalyticsService.getApplicantAnalytics({ category: 'all' }),
          drdAnalyticsService.getDrdMemberAnalytics({ category: 'all' }),
        ]);
        // If either succeeds (not 403), user has permission
        const appOk = app.status === 'fulfilled';
        const memOk = mem.status === 'fulfilled';
        setPermStatus(appOk || memOk ? 'granted' : 'denied');
      } catch {
        setPermStatus('denied');
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (permStatus === 'granted') void loadAnalytics(activeTab, filters);
  }, [activeTab, filters, permStatus]);

  const loadAnalytics = async (
    tab: AnalyticsTab = activeTab,
    currentFilters: AnalyticsFiltersState = filters
  ) => {
    try {
      setLoading(true);
      const requestFilters: DrdAnalyticsFilters = {
        from: currentFilters.from,
        to: currentFilters.to,
        category: currentFilters.category,
        schoolId: currentFilters.schoolId || undefined,
        departmentId: currentFilters.departmentId || undefined,
        reviewerId: tab === 'drd_member' ? currentFilters.reviewerId || undefined : undefined,
      };

      const response =
        tab === 'applicant'
          ? await drdAnalyticsService.getApplicantAnalytics(requestFilters)
          : await drdAnalyticsService.getDrdMemberAnalytics(requestFilters);

      setData(response.data);
    } catch (error) {
      logger.error('Failed to load DRD analytics', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const schoolRows = useMemo(() => (data?.schoolWise || []) as ApplicantSchoolRow[], [data]);
  const departmentRows = useMemo(() => (data?.departmentWise || []) as ApplicantDepartmentRow[], [data]);
  const peopleRows = useMemo(() => (data?.people || []) as ApplicantPersonRow[], [data]);
  const reviewerRows = useMemo(() => (data?.reviewers || []) as ReviewerRow[], [data]);
  const monthlyTrend = useMemo(() => (data?.extensions?.monthlyTrend || []) as MonthlyTrendPoint[], [data]);

  const departmentOptions = useMemo(() => {
    if (!draftFilters.schoolId) return departmentRows;
    return departmentRows.filter((department) => department.schoolId === draftFilters.schoolId);
  }, [departmentRows, draftFilters.schoolId]);

  const quickRangeLabel = useMemo(() => {
    const defaults = getDefaultFilters();
    if (filters.from === defaults.from && filters.to === defaults.to) return 'Last 90 days';
    return buildRangeLabel(filters);
  }, [filters]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const scopeLevel = data?.meta.scopeApplied.scopeLevel || 'n/a';
  const scopeSchools = data?.meta.scopeApplied.schoolIds.length || 0;
  const scopeDepartments = data?.meta.scopeApplied.departmentIds.length || 0;
  const isSelfView = Boolean(data?.extensions?.selfView);

  const applicantCards = [
    {
      title: 'Total applications',
      value: formatNumber(data?.kpis.totalApplications),
      subtitle: `${formatNumber(data?.kpis.approvedCount)} approved in selected period`,
      icon: <BarChart3 />,
    },
    {
      title: 'Research outputs',
      value: formatNumber(
        (data?.kpis.totalResearchSubmissions || 0) +
          (data?.kpis.totalBookSubmissions || 0) +
          (data?.kpis.totalConferenceSubmissions || 0)
      ),
      subtitle: `${formatNumber(data?.kpis.totalResearchSubmissions)} papers, ${formatNumber(
        data?.kpis.totalBookSubmissions
      )} books, ${formatNumber(data?.kpis.totalConferenceSubmissions)} conferences`,
      icon: <GraduationCap />,
    },
    {
      title: 'IPR + grants',
      value: formatNumber((data?.kpis.totalPatentSubmissions || 0) + (data?.kpis.totalGrantSubmissions || 0)),
      subtitle: `${formatNumber(data?.kpis.totalPatentSubmissions)} IPR, ${formatNumber(
        data?.kpis.totalGrantSubmissions
      )} grants`,
      icon: <Layers3 />,
    },
    {
      title: 'Approved incentive',
      value: formatNumber(data?.kpis.totalIncentive),
      subtitle: 'Approved or credited incentive only',
      icon: <CheckCircle2 />,
    },
  ];

  const reviewerCards = [
    {
      title: 'Assigned workload',
      value: formatNumber(data?.kpis.assignedCount),
      subtitle: `${formatNumber(data?.kpis.pendingCount)} still pending`,
      icon: <Briefcase />,
    },
    {
      title: 'First response',
      value: formatHours(data?.kpis.avgFirstResponseHours),
      subtitle: `${formatNumber(data?.kpis.respondedCount)} cases received a first response`,
      icon: <Clock3 />,
    },
    {
      title: 'Completed reviews',
      value: formatNumber(data?.kpis.completedCount),
      subtitle: `${formatNumber(data?.kpis.totalReviewers)} reviewers in current view`,
      icon: <UserCheck />,
    },
    {
      title: 'Avg completion',
      value: formatHours(data?.kpis.avgCompletionHours),
      subtitle: 'Across all completed review cycles',
      icon: <Target />,
    },
  ];

  const applyFilters = () => {
    setFilters({
      ...draftFilters,
      reviewerId: activeTab === 'drd_member' ? draftFilters.reviewerId : '',
    });
  };

  const resetFilters = () => {
    const next = getDefaultFilters();
    setDraftFilters(next);
    setFilters(next);
  };

  const setQuickRange = (days: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - days);
    const next = {
      ...draftFilters,
      from: toDateInputValue(start),
      to: toDateInputValue(today),
    };
    setDraftFilters(next);
    setFilters({
      ...next,
      reviewerId: activeTab === 'drd_member' ? next.reviewerId : '',
    });
  };

  const setYearToDate = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 1);
    const next = {
      ...draftFilters,
      from: toDateInputValue(start),
      to: toDateInputValue(today),
    };
    setDraftFilters(next);
    setFilters({
      ...next,
      reviewerId: activeTab === 'drd_member' ? next.reviewerId : '',
    });
  };

  const focusSchool = (schoolId: string) => {
    const next = {
      ...draftFilters,
      schoolId,
      departmentId: '',
    };
    setDraftFilters(next);
    setFilters({
      ...next,
      reviewerId: activeTab === 'drd_member' ? next.reviewerId : '',
    });
  };

  const focusDepartment = (departmentId: string, schoolId?: string | null) => {
    const next = {
      ...draftFilters,
      schoolId: schoolId || draftFilters.schoolId,
      departmentId,
    };
    setDraftFilters(next);
    setFilters({
      ...next,
      reviewerId: activeTab === 'drd_member' ? next.reviewerId : '',
    });
  };

  const focusReviewer = (reviewerId: string) => {
    const next = {
      ...draftFilters,
      reviewerId,
    };
    setDraftFilters(next);
    setFilters(next);
  };

  const openDrilldown = async (kind: DrilldownKind, id: string, title: string, subtitle: string) => {
    setDrilldown({
      kind,
      title,
      subtitle,
      loading: true,
      data: null,
    });

    try {
      const requestFilters: DrdAnalyticsFilters = {
        from: filters.from,
        to: filters.to,
        category: filters.category,
        schoolId: filters.schoolId || undefined,
        departmentId: filters.departmentId || undefined,
      };

      let response;
      if (kind === 'school') {
        response = await drdAnalyticsService.getApplicantSchoolAnalytics(id, requestFilters);
      } else if (kind === 'department') {
        response = await drdAnalyticsService.getApplicantDepartmentAnalytics(id, requestFilters);
      } else if (kind === 'person') {
        response = await drdAnalyticsService.getApplicantPersonAnalytics(id, requestFilters);
      } else {
        response = await drdAnalyticsService.getReviewerAnalytics(id, {
          ...requestFilters,
          reviewerId: id,
        });
      }

      setDrilldown({
        kind,
        title,
        subtitle,
        loading: false,
        data: response.data,
      });
    } catch (error) {
      logger.error('Failed to load drilldown analytics', error);
      setDrilldown({
        kind,
        title,
        subtitle,
        loading: false,
        data: null,
      });
    }
  };

  const exportCurrentView = () => {
    if (!data) return;

    if (activeTab === 'applicant') {
      const rows = [
        ...schoolRows.map((school) => ({
          rowType: 'school',
          name: school.schoolName,
          applications: school.totalApplications,
          approved: school.totalApproved,
          incentive: school.totalIncentive,
        })),
        ...departmentRows.map((department) => ({
          rowType: 'department',
          name: department.departmentName,
          school: department.schoolName,
          applicants: department.totalApplicants,
          applications: department.totalApplications,
          approved: department.totalApproved,
          incentive: department.totalIncentive,
        })),
        ...peopleRows.map((person) => ({
          rowType: 'applicant',
          name: person.applicantName,
          school: person.schoolName,
          department: person.departmentName,
          applications: person.totalApplications,
          approved: person.approvedCount,
          incentive: person.totalIncentive,
          research: person.filingCounts.research,
          book: person.filingCounts.book,
          conference: person.filingCounts.conference,
          ipr: person.filingCounts.ipr,
          grants: person.filingCounts.grants,
        })),
      ];
      downloadCsv(`drd-applicant-analytics-${filters.from}-to-${filters.to}.csv`, rows);
      return;
    }

    const rows = reviewerRows.map((reviewer) => ({
      reviewer: reviewer.reviewerName,
      assigned: reviewer.assignedCount,
      responded: reviewer.respondedCount,
      completed: reviewer.completedCount,
      pending: reviewer.pendingCount,
      completionRate: reviewer.completionRate,
      avgFirstResponseHours: reviewer.avgFirstResponseHours,
      avgCompletionHours: reviewer.avgCompletionHours,
      research: reviewer.categoryBreakdown.research,
      book: reviewer.categoryBreakdown.book,
      conference: reviewer.categoryBreakdown.conference,
      ipr: reviewer.categoryBreakdown.ipr,
      grants: reviewer.categoryBreakdown.grants,
    }));

    downloadCsv(`drd-member-analytics-${filters.from}-to-${filters.to}.csv`, rows);
  };

  const applicantTopSchool = schoolRows[0];
  const applicantTopDepartment = departmentRows[0];
  const applicantTopPerson = peopleRows[0];
  const topReviewer = reviewerRows[0];

  if (permStatus === 'checking') {
    return (
      <ProtectedRoute>
        <AnalyticsShell>
          <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8" aria-busy="true" aria-label="Checking access">
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-14" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-28" />)}
            </div>
            <SkeletonBlock className="h-80" />
          </div>
        </AnalyticsShell>
      </ProtectedRoute>
    );
  }

  if (permStatus === 'denied') {
    return (
      <ProtectedRoute>
        <AnalyticsShell className="flex items-center justify-center p-6">
          <div className={`${ui.card} w-full max-w-md p-8 text-center`}>
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-white">Access denied</h2>
            <p className="mt-2 text-sm text-stone-500 dark:text-gray-400">
              You do not have the required analytics permissions to view this page. Contact your administrator.
            </p>
          </div>
        </AnalyticsShell>
      </ProtectedRoute>
    );
  }

  const kpis = data?.kpis;
  const heroChips = activeTab === 'applicant'
    ? [
        { label: 'Applications', value: data ? formatNumber(kpis?.totalApplications) : '—' },
        { label: 'Approved', value: data ? formatNumber(kpis?.approvedCount) : '—' },
        {
          label: 'Approval rate',
          value: data && kpis?.totalApplications
            ? formatPercent(Math.round(((kpis.approvedCount || 0) / kpis.totalApplications) * 1000) / 10)
            : '—',
        },
        { label: 'Approved incentive', value: data ? formatNumber(kpis?.totalIncentive) : '—' },
      ]
    : [
        { label: 'Assigned', value: data ? formatNumber(kpis?.assignedCount) : '—' },
        { label: 'Completed', value: data ? formatNumber(kpis?.completedCount) : '—' },
        { label: 'Pending', value: data ? formatNumber(kpis?.pendingCount) : '—' },
        { label: 'First response', value: data ? formatHours(kpis?.avgFirstResponseHours) : '—' },
      ];

  const quick30Active = filters.from === toDateInputValue(new Date(new Date().setDate(new Date().getDate() - 30)));
  const quick90Active = quickRangeLabel === 'Last 90 days';
  const quickYtdActive = filters.from === `${new Date().getFullYear()}-01-01`;
  const quickRanges = [
    { label: '30 days', active: quick30Active, onClick: () => setQuickRange(30) },
    { label: '90 days', active: quick90Active, onClick: () => setQuickRange(90) },
    { label: 'YTD', active: quickYtdActive, onClick: setYearToDate },
  ];

  const tabs: Array<{ id: AnalyticsTab; label: string }> = [
    { id: 'applicant', label: 'Applicants' },
    { id: 'drd_member', label: 'DRD members' },
  ];

  return (
    <ProtectedRoute>
      <AnalyticsShell>
        <AnalyticsHero
          eyebrow="DRD analytics"
          title="Applicant activity and DRD performance"
          description="Built around your assigned schools and departments. Review trends, reviewer workload, approvals and incentive impact without leaving the DRD workflow."
          actions={
            <>
              <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/50" role="tablist" aria-label="Analytics view">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber'
                          : 'text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => void loadAnalytics(activeTab, filters)}
                className={ui.btnSecondary}
                aria-label="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                type="button"
                onClick={exportCurrentView}
                disabled={!data}
                className={`${ui.btnPrimary} disabled:cursor-not-allowed`}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </>
          }
          chips={heroChips}
        />

        {/* Filters */}
        <div className="sticky top-20 z-30 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:border-gray-700 dark:bg-gray-800/90 sm:top-[5.5rem] sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-gray-400">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Period
            </span>
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/50" role="group" aria-label="Quick date ranges">
              {quickRanges.map((qr) => (
                <button
                  key={qr.label}
                  type="button"
                  aria-pressed={qr.active}
                  onClick={qr.onClick}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    qr.active
                      ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber'
                      : 'text-stone-600 hover:text-stone-900 dark:text-gray-300 dark:hover:text-white'
                  }`}
                >
                  {qr.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-stone-400 dark:text-gray-500" />
              <input
                type="date"
                aria-label="From date"
                value={draftFilters.from}
                onChange={(e) => setDraftFilters((current) => ({ ...current, from: e.target.value }))}
                className={ui.input}
              />
              <span className="text-xs text-stone-400 dark:text-gray-500">to</span>
              <input
                type="date"
                aria-label="To date"
                value={draftFilters.to}
                onChange={(e) => setDraftFilters((current) => ({ ...current, to: e.target.value }))}
                className={ui.input}
              />
            </div>

            <select
              aria-label="Category"
              value={draftFilters.category}
              onChange={(e) => setDraftFilters((current) => ({ ...current, category: e.target.value }))}
              className={selectCls}
            >
              <option value="all">All categories</option>
              <option value="research">Research</option>
              <option value="book">Book / chapter</option>
              <option value="conference">Conference</option>
              <option value="ipr">Patent / IPR</option>
              <option value="grants">Grants</option>
            </select>

            <select
              aria-label="School"
              value={draftFilters.schoolId}
              onChange={(e) =>
                setDraftFilters((current) => ({
                  ...current,
                  schoolId: e.target.value,
                  departmentId: '',
                }))
              }
              className={`${selectCls} sm:max-w-[14rem]`}
            >
              <option value="">All schools</option>
              {schoolRows.map((school) => (
                <option key={school.schoolId} value={school.schoolId}>
                  {school.schoolName}
                </option>
              ))}
            </select>

            <select
              aria-label="Department"
              value={draftFilters.departmentId}
              onChange={(e) => setDraftFilters((current) => ({ ...current, departmentId: e.target.value }))}
              className={`${selectCls} sm:max-w-[14rem]`}
            >
              <option value="">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department.departmentId} value={department.departmentId}>
                  {department.departmentName}
                </option>
              ))}
            </select>

            {activeTab === 'drd_member' ? (
              <select
                aria-label="Reviewer"
                value={draftFilters.reviewerId}
                onChange={(e) => setDraftFilters((current) => ({ ...current, reviewerId: e.target.value }))}
                className={`${selectCls} sm:max-w-[14rem]`}
              >
                <option value="">{isSelfView ? 'My analytics' : 'All reviewers'}</option>
                {reviewerRows.map((reviewer) => (
                  <option key={reviewer.reviewerId} value={reviewer.reviewerId}>
                    {reviewer.reviewerName}
                  </option>
                ))}
              </select>
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={resetFilters} className={ui.btnSecondary}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <button type="button" onClick={applyFilters} className={ui.btnPrimary}>
                Apply
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {/* Scope summary */}
          <div className="flex flex-wrap items-center gap-2">
            <ScopeBadge label="Range" value={quickRangeLabel} />
            <ScopeBadge label="Scope" value={scopeLevel} />
            <ScopeBadge label="Schools" value={formatNumber(scopeSchools)} />
            <ScopeBadge label="Departments" value={formatNumber(scopeDepartments)} />
            <ScopeBadge label="Active filters" value={formatNumber(activeFilterCount)} />
            {isSelfView ? <ScopeBadge label="Reviewer mode" value="Self view" /> : null}
            {data ? <ScopeBadge label="Resolution" value={data.meta.scopeApplied.resolution} /> : null}
            {activeTab === 'applicant' ? (
              <span className="text-xs text-stone-500 dark:text-gray-400">Department-only users stay within their assigned department.</span>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-6" aria-busy="true" aria-label="Loading DRD analytics">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-32" />)}
              </div>
              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <SkeletonBlock className="h-80" />
                <SkeletonBlock className="h-80" />
              </div>
              <SkeletonBlock className="h-72" />
            </div>
          ) : !data ? (
            <EmptyPanel
              title="Analytics could not be loaded"
              description="The current user may not have the required analytics permission or scoped assignment yet."
            />
          ) : (
            <>
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(activeTab === 'applicant' ? applicantCards : reviewerCards).map((card) => (
                  <DashboardCard key={card.title} {...card} />
                ))}
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <MonthlyBarChart
                  title={activeTab === 'applicant' ? 'Monthly filing trend' : 'Monthly review trend'}
                  description={
                    activeTab === 'applicant'
                      ? 'Applications and approvals, last six months of the period.'
                      : 'Assigned and completed work, last six months of the period.'
                  }
                  points={monthlyTrend}
                  series={
                    activeTab === 'applicant'
                      ? [
                          { key: 'totalApplications', label: 'Applications' },
                          { key: 'approvedCount', label: 'Approved' },
                        ]
                      : [
                          { key: 'assigned', label: 'Assigned' },
                          { key: 'completed', label: 'Completed' },
                        ]
                  }
                />

                <section className={`overflow-hidden ${ui.card}`}>
                  <SectionHeader
                    title="Highlights"
                    description="The most important signals from the current scoped view."
                  />
                  <div className="grid gap-3 p-5">
                    {activeTab === 'applicant' ? (
                      <>
                        <InsightCard
                          title="Top school"
                          value={applicantTopSchool?.schoolName || 'No data'}
                          helper={
                            applicantTopSchool
                              ? `${formatNumber(applicantTopSchool.totalApplications)} applications`
                              : 'No school activity found in this range.'
                          }
                        />
                        <InsightCard
                          title="Top department"
                          value={applicantTopDepartment?.departmentName || 'No data'}
                          helper={
                            applicantTopDepartment
                              ? `${formatNumber(applicantTopDepartment.totalIncentive)} incentive`
                              : 'No department activity found in this range.'
                          }
                        />
                        <InsightCard
                          title="Top applicant"
                          value={applicantTopPerson?.applicantName || 'No data'}
                          helper={
                            applicantTopPerson
                              ? `${formatNumber(applicantTopPerson.totalApplications)} applications filed`
                              : 'No applicant records found in this range.'
                          }
                        />
                      </>
                    ) : (
                      <>
                        <InsightCard
                          title="Top reviewer"
                          value={topReviewer?.reviewerName || 'No data'}
                          helper={
                            topReviewer
                              ? `${formatNumber(topReviewer.completedCount)} completed reviews`
                              : 'No reviewer activity found in this range.'
                          }
                        />
                        <InsightCard
                          title="Team completion"
                          value={formatPercent(
                            data.kpis.assignedCount
                              ? ((data.kpis.completedCount || 0) / data.kpis.assignedCount) * 100
                              : 0
                          )}
                          helper="Based on assigned items in the current DRD view."
                        />
                        <InsightCard
                          title="Response speed"
                          value={formatHours(data.kpis.avgFirstResponseHours)}
                          helper={isSelfView ? 'Your current review response speed.' : 'Average across visible reviewers.'}
                        />
                      </>
                    )}
                  </div>
                </section>
              </section>

              {activeTab === 'applicant' ? (
                <>
                  <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <section className={`overflow-hidden ${ui.card}`}>
                      <SectionHeader
                        title="School performance"
                        description="Where filing volume and incentive impact are concentrated."
                      />
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className={theadCls}>
                            <tr>
                              <th className={ui.th}>School</th>
                              <th className={`${ui.th} text-right`}>Applications</th>
                              <th className={`${ui.th} text-right`}>Approved</th>
                              <th className={`${ui.th} text-right`}>Incentive</th>
                              <th className={`${ui.th} text-right`}><span className="sr-only">Actions</span></th>
                            </tr>
                          </thead>
                          <tbody className={tbodyCls}>
                            {schoolRows.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500 dark:text-gray-400">
                                  No school analytics available for the selected scope.
                                </td>
                              </tr>
                            ) : (
                              schoolRows.map((school) => (
                                <tr key={school.schoolId} className={trCls}>
                                  <td className={ui.td}>
                                    <p className="font-medium text-stone-900 dark:text-white">{school.schoolName}</p>
                                    <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">
                                      {school.totalApplications > 0
                                        ? `${formatPercent((school.totalApproved / school.totalApplications) * 100)} approval rate`
                                        : 'No completed filings yet'}
                                    </p>
                                  </td>
                                  <td className={numCls}><Num value={school.totalApplications} /></td>
                                  <td className={numCls}><Num value={school.totalApproved} /></td>
                                  <td className={numCls}><Num value={school.totalIncentive} strong /></td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                      <button type="button" onClick={() => focusSchool(school.schoolId)} className={rowActionCls}>
                                        <Crosshair className="h-3.5 w-3.5" />
                                        Focus
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDrilldown(
                                            'school',
                                            school.schoolId,
                                            school.schoolName,
                                            'Focused school analytics including people, departments and month trend.'
                                          )
                                        }
                                        className={rowActionCls}
                                      >
                                        Details
                                        <ChevronRight className="h-3.5 w-3.5 text-stone-400 dark:text-gray-500" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className={`overflow-hidden ${ui.card}`}>
                      <SectionHeader
                        title="Department momentum"
                        description="Active departments, bar relative to the busiest one."
                      />
                      {departmentRows.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-stone-500 dark:text-gray-400">No data for this period.</p>
                      ) : (
                        <ul className={tbodyCls}>
                          {departmentRows.slice(0, 7).map((department) => {
                            const progressBase = departmentRows[0]?.totalApplications || 1;
                            const progress = Math.min(
                              100,
                              Math.round((department.totalApplications / progressBase) * 100)
                            );
                            return (
                              <li key={department.departmentId} className="px-5 py-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-stone-900 dark:text-white">{department.departmentName}</p>
                                    <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-gray-400">
                                      {department.schoolName} · <span className="tabular-nums">{formatNumber(department.totalApplicants)}</span> applicants
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className={`text-sm ${ui.value}`}>{formatNumber(department.totalApplications)}</p>
                                    <p className="text-xs text-stone-500 dark:text-gray-400">applications</p>
                                  </div>
                                </div>
                                <div className="mt-2.5">
                                  <Meter percent={progress} label={`${department.departmentName} relative volume`} />
                                </div>
                                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs text-stone-500 dark:text-gray-400">
                                    <span className="tabular-nums">{formatNumber(department.totalApproved)}</span> approved · Incentive{' '}
                                    <span className="tabular-nums">{formatNumber(department.totalIncentive)}</span>
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => focusDepartment(department.departmentId, department.schoolId)}
                                      className={rowActionCls}
                                    >
                                      <Crosshair className="h-3.5 w-3.5" />
                                      Focus
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openDrilldown(
                                          'department',
                                          department.departmentId,
                                          department.departmentName,
                                          'Focused department analytics including people and month trend.'
                                        )
                                      }
                                      className={rowActionCls}
                                    >
                                      Details
                                      <ChevronRight className="h-3.5 w-3.5 text-stone-400 dark:text-gray-500" />
                                    </button>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  </section>

                  <section className={`overflow-hidden ${ui.card}`}>
                    <SectionHeader
                      title="Applicant leaderboard"
                      description="People-level view for the visible scope. Spot high-volume contributors and how incentive is distributed."
                    />
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className={theadCls}>
                          <tr>
                            <th className={ui.th}>Applicant</th>
                            <th className={ui.th}>Department</th>
                            <th className={ui.th}>Category split</th>
                            <th className={`${ui.th} text-right`}>Approved</th>
                            <th className={`${ui.th} text-right`}>Incentive</th>
                            <th className={`${ui.th} text-right`}><span className="sr-only">Actions</span></th>
                          </tr>
                        </thead>
                        <tbody className={tbodyCls}>
                          {peopleRows.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500 dark:text-gray-400">
                                No applicant records were found for the selected view.
                              </td>
                            </tr>
                          ) : (
                            peopleRows.map((person) => (
                              <tr key={person.personId} className={trCls}>
                                <td className={ui.td}>
                                  <p className="font-medium text-stone-900 dark:text-white">{person.applicantName}</p>
                                  <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">{person.schoolName}</p>
                                </td>
                                <td className={`${ui.td} text-stone-500 dark:text-gray-400`}>{person.departmentName}</td>
                                <td className="min-w-[16rem] px-4 py-3">
                                  <CategorySplit counts={person.filingCounts} />
                                </td>
                                <td className={numCls}><Num value={person.approvedCount} /></td>
                                <td className={numCls}><Num value={person.totalIncentive} strong /></td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDrilldown(
                                        'person',
                                        person.personId,
                                        person.applicantName,
                                        'Focused applicant analytics including month trend and scoped submission summary.'
                                      )
                                    }
                                    className={rowActionCls}
                                  >
                                    Details
                                    <ChevronRight className="h-3.5 w-3.5 text-stone-400 dark:text-gray-500" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <section className={`overflow-hidden ${ui.card}`}>
                      <SectionHeader
                        title="Reviewer performance"
                        description="Assignment load, response speed and closure rate across the visible DRD team."
                      />
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className={theadCls}>
                            <tr>
                              <th className={ui.th}>Reviewer</th>
                              <th className={`${ui.th} text-right`}>Assigned</th>
                              <th className={`${ui.th} text-right`}>Pending</th>
                              <th className={`${ui.th} text-right`}>Completion</th>
                              <th className={`${ui.th} text-right`}><span className="sr-only">Actions</span></th>
                            </tr>
                          </thead>
                          <tbody className={tbodyCls}>
                            {reviewerRows.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500 dark:text-gray-400">
                                  No reviewer activity is available for this period.
                                </td>
                              </tr>
                            ) : (
                              reviewerRows.map((reviewer) => (
                                <tr key={reviewer.reviewerId} className={trCls}>
                                  <td className={ui.td}>
                                    <p className="font-medium text-stone-900 dark:text-white">{reviewer.reviewerName}</p>
                                    <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">
                                      Response <span className="tabular-nums">{formatHours(reviewer.avgFirstResponseHours)}</span> · Completion{' '}
                                      <span className="tabular-nums">{formatHours(reviewer.avgCompletionHours)}</span>
                                    </p>
                                  </td>
                                  <td className={numCls}><Num value={reviewer.assignedCount} /></td>
                                  <td className={numCls}><Num value={reviewer.pendingCount} /></td>
                                  <td className={numCls}><Num value={reviewer.completionRate} format={formatPercent} strong /></td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                      <button type="button" onClick={() => focusReviewer(reviewer.reviewerId)} className={rowActionCls}>
                                        <Crosshair className="h-3.5 w-3.5" />
                                        Focus
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDrilldown(
                                            'reviewer',
                                            reviewer.reviewerId,
                                            reviewer.reviewerName,
                                            'Focused reviewer analytics including response, completion and monthly trend.'
                                          )
                                        }
                                        className={rowActionCls}
                                      >
                                        Details
                                        <ChevronRight className="h-3.5 w-3.5 text-stone-400 dark:text-gray-500" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <div className="space-y-6">
                      <section className={`overflow-hidden ${ui.card}`}>
                        <SectionHeader
                          title="Service standards"
                          description="Speed, closure quality and reviewer mode at a glance."
                        />
                        <div className="grid gap-3 p-5 sm:grid-cols-2">
                          <InsightCard
                            title="Mode"
                            value={isSelfView ? 'Self view' : 'Supervisor view'}
                            helper="Determined by analytics permission and DRD approval scope."
                          />
                          <InsightCard
                            title="Visible reviewers"
                            value={formatNumber(data.kpis.totalReviewers)}
                            helper="Reviewers inside the current filter and scope window."
                          />
                          <InsightCard
                            title="Avg first response"
                            value={formatHours(data.kpis.avgFirstResponseHours)}
                            helper="Time to first reviewer action."
                          />
                          <InsightCard
                            title="Avg completion"
                            value={formatHours(data.kpis.avgCompletionHours)}
                            helper="Time to final decision for completed review cycles."
                          />
                        </div>
                      </section>

                      <section className={`overflow-hidden ${ui.card}`}>
                        <SectionHeader
                          title="Top reviewers"
                          description="Ordered by completed work, with response speed as the tie-breaker."
                        />
                        {reviewerRows.length === 0 ? (
                          <p className="px-5 py-10 text-center text-sm text-stone-500 dark:text-gray-400">No data for this period.</p>
                        ) : (
                          <ol className={tbodyCls}>
                            {reviewerRows.slice(0, 5).map((reviewer, index) => (
                              <li key={reviewer.reviewerId} className="flex items-center justify-between gap-4 px-5 py-3.5">
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-xs font-semibold tabular-nums text-stone-600 dark:bg-gray-700 dark:text-gray-300">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-stone-900 dark:text-white">{reviewer.reviewerName}</p>
                                    <div className="mt-1">
                                      <CategorySplit counts={reviewer.categoryBreakdown} />
                                    </div>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className={`text-sm ${ui.value}`}>{formatNumber(reviewer.completedCount)} completed</p>
                                  <p className="mt-0.5 text-xs tabular-nums text-stone-500 dark:text-gray-400">
                                    {formatHours(reviewer.avgCompletionHours)} avg
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        )}
                      </section>
                    </div>
                  </section>

                  <section className={`overflow-hidden ${ui.card}`}>
                    <SectionHeader
                      title="Reviewer workload"
                      description="Share of assigned work completed per reviewer, with pending load and response speed."
                    />
                    {reviewerRows.length === 0 ? (
                      <p className="px-5 py-10 text-center text-sm text-stone-500 dark:text-gray-400">No data for this period.</p>
                    ) : (
                      <ul className={tbodyCls}>
                        {reviewerRows.map((reviewer) => {
                          const progress = reviewer.assignedCount
                            ? Math.round((reviewer.completedCount / reviewer.assignedCount) * 100)
                            : 0;
                          return (
                            <li key={reviewer.reviewerId} className="px-5 py-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-stone-900 dark:text-white">{reviewer.reviewerName}</p>
                                  <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">
                                    <span className="tabular-nums">{formatNumber(reviewer.assignedCount)}</span> assigned ·{' '}
                                    <span className="tabular-nums">{formatNumber(reviewer.pendingCount)}</span> pending ·{' '}
                                    <span className="tabular-nums">{formatHours(reviewer.avgFirstResponseHours)}</span> first response
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button type="button" onClick={() => focusReviewer(reviewer.reviewerId)} className={rowActionCls}>
                                    <Crosshair className="h-3.5 w-3.5" />
                                    Focus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDrilldown(
                                        'reviewer',
                                        reviewer.reviewerId,
                                        reviewer.reviewerName,
                                        'Focused reviewer analytics including response, completion and monthly trend.'
                                      )
                                    }
                                    className={rowActionCls}
                                  >
                                    Details
                                    <ChevronRight className="h-3.5 w-3.5 text-stone-400 dark:text-gray-500" />
                                  </button>
                                </div>
                              </div>
                              <div className="mt-3">
                                <Meter percent={progress} color={VIZ[2]} label={`${reviewer.reviewerName} completion`} />
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-stone-500 dark:text-gray-400">
                                <span className="tabular-nums">{formatPercent(reviewer.completionRate)} completion</span>
                                <span className="tabular-nums">{formatHours(reviewer.avgCompletionHours)} avg completion</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </AnalyticsShell>

      <DrilldownDrawer panel={drilldown} onClose={() => setDrilldown(null)} />
    </ProtectedRoute>
  );
}
