'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsFilters,
  type DrdAnalyticsResponse,
} from '@/features/ipr-management/services/drdAnalytics.service';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Filter,
  GraduationCap,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';

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
  return `${formatDateLabel(filters.from)} - ${formatDateLabel(filters.to)}`;
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
  if (value ===
   null || value ===
   undefined) return '';
  const text = String(value).replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length || typeof window ===
   'undefined') return;

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

function DashboardCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-[#d8e6ef] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#6497b1]">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[#011f4b]">{value}</p>
          <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${accent}`}>
          {icon}
        </div>
      </div>
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
    <div className="flex flex-col gap-3 border-b border-[#e3edf4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-[#011f4b]">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MetricPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[#b3cde0]">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function QuickFilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-[#005b96] bg-[#005b96] text-white'
          : 'border-[#b3cde0] bg-white text-[#005b96] hover:border-[#005b96]'
      }`}
    >
      {label}
    </button>
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
    <div className="rounded-full border border-[#d8e6ef] bg-[#f7fbfe] px-3 py-1.5 text-xs font-medium text-[#005b96]">
      <span className="text-[#6497b1]">{label}:</span> {value}
    </div>
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
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#b3cde0] bg-[#f7fbfe] px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#005b96] shadow-sm">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[#011f4b]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-gray-500">{description}</p>
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
  series: Array<{ key: keyof MonthlyTrendPoint; label: string; color: string; text: string }>;
}) {
  const visiblePoints = points.slice(-6);
  const maxValue = Math.max(
    1,
    ...visiblePoints.flatMap((point) => series.map((item) => Number(point[item.key] || 0)))
  );

  return (
    <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
      <SectionHeader title={title} description={description} />
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap gap-2">
          {series.map((item) => (
            <span
              key={item.label}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${item.text} ${item.color}`}
            >
              {item.label}
            </span>
          ))}
        </div>

        {visiblePoints.length ===
   0 ? (
          <p className="text-sm text-gray-500">No trend points available for the selected period.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-6">
            {visiblePoints.map((point) => (
              <div key={point.month} className="space-y-3">
                <div className="flex h-40 items-end justify-center gap-2 rounded-2xl bg-[#f7fbfe] px-3 pb-3 pt-5">
                  {series.map((item) => {
                    const height = Math.max(10, Math.round((Number(point[item.key] || 0) / maxValue) * 120));
                    return (
                      <div key={`${point.month}-${String(item.key)}`} className="flex flex-col items-center gap-2">
                        <div
                          className={`w-5 rounded-full ${item.color}`}
                          style={{ height }}
                          title={`${item.label}: ${formatNumber(Number(point[item.key] || 0))}`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-[#011f4b]">{point.label}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {series
                      .map((item) => `${item.label.split(' ')[0]} ${formatNumber(Number(point[item.key] || 0))}`)
                      .join(' • ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
    <div className="rounded-2xl border border-[#d8e6ef] bg-[#f7fbfe] p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[#6497b1]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#011f4b]">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{helper}</p>
    </div>
  );
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
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/40 backdrop-blur-sm">
      <button type="button" className="flex-1" onClick={onClose} aria-label="Close drilldown" />
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-[#d8e6ef] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-[#e3edf4] bg-white px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6497b1]">Drilldown View</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#011f4b]">{panel.title}</h2>
              <p className="mt-2 text-sm text-gray-500">{panel.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[#d8e6ef] p-2 text-[#005b96] transition-colors hover:border-[#005b96]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {panel.loading || !panel.data ? (
            <div className="flex min-h-[260px] items-center justify-center text-gray-500">
              <div className="text-center">
                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#005b96]" />
                <p className="mt-3 text-sm">Loading detail analytics...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <InsightCard
                  title="Scope Level"
                  value={panel.data.meta.scopeApplied.scopeLevel}
                  helper="Resolved from the narrowed analytics context."
                />
                <InsightCard
                  title="Range"
                  value={`${formatDateLabel(panel.data.meta.timeRange.from)} - ${formatDateLabel(panel.data.meta.timeRange.to)}`}
                  helper="Same time filter used for the parent dashboard."
                />
                <InsightCard
                  title="Records"
                  value={formatNumber(people.length || reviewers.length || departments.length || schools.length)}
                  helper="Entities included in this focused view."
                />
              </div>

              <MonthlyBarChart
                title="Monthly Focus Trend"
                description="Trend view for just the selected entity."
                points={trend}
                series={
                  panel.kind ===
   'reviewer'
                    ? [
                        { key: 'assigned', label: 'Assigned', color: 'bg-[#005b96]', text: 'bg-[#edf5fa] text-[#005b96]' },
                        { key: 'completed', label: 'Completed', color: 'bg-emerald-500', text: 'bg-[#edf8f4] text-emerald-700' },
                      ]
                    : [
                        { key: 'totalApplications', label: 'Applications', color: 'bg-[#005b96]', text: 'bg-[#edf5fa] text-[#005b96]' },
                        { key: 'approvedCount', label: 'Approved', color: 'bg-emerald-500', text: 'bg-[#edf8f4] text-emerald-700' },
                      ]
                }
              />

              {people.length > 0 ? (
                <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                  <SectionHeader
                    title="Applicants in Focus"
                    description="People-level records inside the selected school, department, or applicant view."
                  />
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#f7fbfe] text-left text-[#6497b1]">
                        <tr>
                          {['Applicant', 'Department', 'Applications', 'Approved', 'Incentive'].map((label) => (
                            <th key={label} className="px-5 py-3 font-semibold">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {people.map((person) => (
                          <tr key={person.personId} className="border-t border-[#eef5f9]">
                            <td className="px-5 py-4 font-semibold text-[#011f4b]">{person.applicantName}</td>
                            <td className="px-5 py-4 text-gray-600">{person.departmentName}</td>
                            <td className="px-5 py-4 text-gray-600">{formatNumber(person.totalApplications)}</td>
                            <td className="px-5 py-4 text-gray-600">{formatNumber(person.approvedCount)}</td>
                            <td className="px-5 py-4 font-semibold text-[#011f4b]">
                              {formatNumber(person.totalIncentive)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {reviewers.length > 0 ? (
                <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                  <SectionHeader
                    title="Reviewer in Focus"
                    description="Detailed reviewer performance for the selected DRD member."
                  />
                  <div className="space-y-4 p-5">
                    {reviewers.map((reviewer) => (
                      <div key={reviewer.reviewerId} className="rounded-2xl border border-[#e3edf4] p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-lg font-semibold text-[#011f4b]">{reviewer.reviewerName}</p>
                            <p className="mt-1 text-sm text-gray-500">
                              Completion {formatPercent(reviewer.completionRate)} • First response{' '}
                              {formatHours(reviewer.avgFirstResponseHours)}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-xl bg-[#f7fbfe] px-3 py-2">
                              <p className="text-xs text-[#6497b1]">Assigned</p>
                              <p className="mt-1 font-semibold text-[#011f4b]">
                                {formatNumber(reviewer.assignedCount)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-[#f7fbfe] px-3 py-2">
                              <p className="text-xs text-[#6497b1]">Pending</p>
                              <p className="mt-1 font-semibold text-[#011f4b]">
                                {formatNumber(reviewer.pendingCount)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
        const appOk = app.status ===
   'fulfilled';
        const memOk = mem.status ===
   'fulfilled';
        setPermStatus(appOk || memOk ? 'granted' : 'denied');
      } catch {
        setPermStatus('denied');
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (permStatus ===
   'granted') void loadAnalytics(activeTab, filters);
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
        reviewerId: tab ===
   'drd_member' ? currentFilters.reviewerId || undefined : undefined,
      };

      const response =
        tab ===
   'applicant'
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
    return departmentRows.filter((department) => department.schoolId ===
   draftFilters.schoolId);
  }, [departmentRows, draftFilters.schoolId]);

  const quickRangeLabel = useMemo(() => {
    const defaults = getDefaultFilters();
    if (filters.from ===
   defaults.from && filters.to ===
   defaults.to) return 'Last 90 days';
    return buildRangeLabel(filters);
  }, [filters]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const scopeLevel = data?.meta.scopeApplied.scopeLevel || 'n/a';
  const scopeSchools = data?.meta.scopeApplied.schoolIds.length || 0;
  const scopeDepartments = data?.meta.scopeApplied.departmentIds.length || 0;
  const isSelfView = Boolean(data?.extensions?.selfView);

  const applicantCards = [
    {
      title: 'Total Applications',
      value: formatNumber(data?.kpis.totalApplications),
      subtitle: `${formatNumber(data?.kpis.approvedCount)} approved in selected period`,
      icon: <BarChart3 className="h-6 w-6" />,
      accent: 'bg-gradient-to-br from-[#005b96] to-[#03396c]',
    },
    {
      title: 'Research Outputs',
      value: formatNumber(
        (data?.kpis.totalResearchSubmissions || 0) +
          (data?.kpis.totalBookSubmissions || 0) +
          (data?.kpis.totalConferenceSubmissions || 0)
      ),
      subtitle: `${formatNumber(data?.kpis.totalResearchSubmissions)} papers, ${formatNumber(
        data?.kpis.totalBookSubmissions
      )} books, ${formatNumber(data?.kpis.totalConferenceSubmissions)} conferences`,
      icon: <GraduationCap className="h-6 w-6" />,
      accent: 'bg-gradient-to-br from-[#6497b1] to-[#005b96]',
    },
    {
      title: 'IPR + Grants',
      value: formatNumber((data?.kpis.totalPatentSubmissions || 0) + (data?.kpis.totalGrantSubmissions || 0)),
      subtitle: `${formatNumber(data?.kpis.totalPatentSubmissions)} IPR, ${formatNumber(
        data?.kpis.totalGrantSubmissions
      )} grants`,
      icon: <Layers3 className="h-6 w-6" />,
      accent: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    },
    {
      title: 'Approved Incentive',
      value: formatNumber(data?.kpis.totalIncentive),
      subtitle: 'Approved or credited incentive only',
      icon: <CheckCircle2 className="h-6 w-6" />,
      accent: 'bg-gradient-to-br from-amber-500 to-orange-600',
    },
  ];

  const reviewerCards = [
    {
      title: 'Assigned Workload',
      value: formatNumber(data?.kpis.assignedCount),
      subtitle: `${formatNumber(data?.kpis.pendingCount)} still pending`,
      icon: <Briefcase className="h-6 w-6" />,
      accent: 'bg-gradient-to-br from-[#005b96] to-[#03396c]',
    },
    {
      title: 'First Response',
      value: formatHours(data?.kpis.avgFirstResponseHours),
      subtitle: `${formatNumber(data?.kpis.respondedCount)} cases received a first response`,
      icon: <Clock3 className="h-6 w-6" />,
      accent: 'bg-gradient-to-br from-[#6497b1] to-[#005b96]',
    },
    {
      title: 'Completed Reviews',
      value: formatNumber(data?.kpis.completedCount),
      subtitle: `${formatNumber(data?.kpis.totalReviewers)} reviewers in current view`,
      icon: <UserCheck className="h-6 w-6" />,
      accent: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
    },
    {
      title: 'Avg Completion',
      value: formatHours(data?.kpis.avgCompletionHours),
      subtitle: 'Across all completed review cycles',
      icon: <Target className="h-6 w-6" />,
      accent: 'bg-gradient-to-br from-amber-500 to-orange-600',
    },
  ];

  const applyFilters = () => {
    setFilters({
      ...draftFilters,
      reviewerId: activeTab ===
   'drd_member' ? draftFilters.reviewerId : '',
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
      reviewerId: activeTab ===
   'drd_member' ? next.reviewerId : '',
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
      reviewerId: activeTab ===
   'drd_member' ? next.reviewerId : '',
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
      reviewerId: activeTab ===
   'drd_member' ? next.reviewerId : '',
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
      reviewerId: activeTab ===
   'drd_member' ? next.reviewerId : '',
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
      if (kind ===
   'school') {
        response = await drdAnalyticsService.getApplicantSchoolAnalytics(id, requestFilters);
      } else if (kind ===
   'department') {
        response = await drdAnalyticsService.getApplicantDepartmentAnalytics(id, requestFilters);
      } else if (kind ===
   'person') {
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

    if (activeTab ===
   'applicant') {
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

  if (permStatus ===
   'checking') {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </ProtectedRoute>
    );
  }

  if (permStatus ===
   'denied') {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">
              You do not have the required analytics permissions to view this page. Contact your administrator.
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#005b96] via-[#004a80] to-[#003d6b] text-white shadow-[0_16px_48px_rgba(0,91,150,0.24)]">
          <div className="absolute -right-14 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[#6497b1]/25 blur-3xl" />
          <div className="relative px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#d8e6ef]">
                  <Sparkles className="h-3.5 w-3.5" />
                  DRD University Analytics
                </div>
                <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
                  A clearer view of applicant activity and DRD performance
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d8e6ef] sm:text-base">
                  Built around your assigned schools and departments. Review trends, reviewer workload,
                  approvals, and incentive impact without leaving the DRD workflow.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="inline-flex w-full flex-col gap-2 rounded-2xl bg-white/10 p-1 backdrop-blur-sm sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setActiveTab('applicant')}
                    className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      activeTab ===
   'applicant' ? 'bg-white text-[#011f4b] shadow-lg' : 'text-white/85 hover:bg-white/10'
                    }`}
                  >
                    Applicant Analytics
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('drd_member')}
                    className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      activeTab ===
   'drd_member' ? 'bg-white text-[#011f4b] shadow-lg' : 'text-white/85 hover:bg-white/10'
                    }`}
                  >
                    DRD Member Analytics
                  </button>
                </div>

                <button
                  type="button"
                  onClick={exportCurrentView}
                  disabled={!data}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export Current View
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <MetricPill icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Scope Level" value={scopeLevel} />
              <MetricPill
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Schools in Scope"
                value={formatNumber(scopeSchools)}
              />
              <MetricPill
                icon={<Layers3 className="h-3.5 w-3.5" />}
                label="Departments in Scope"
                value={formatNumber(scopeDepartments)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
          <SectionHeader
            title="Filters and View Control"
            description="Apply focused filters without losing the scope restrictions already assigned to you."
            action={
              <button
                type="button"
                onClick={() => void loadAnalytics(activeTab, filters)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#b3cde0] bg-white px-4 py-2 text-sm font-semibold text-[#005b96] transition-colors hover:border-[#005b96]"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            }
          />

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <QuickFilterButton
                label="Last 30 Days"
                active={filters.from ===
   toDateInputValue(new Date(new Date().setDate(new Date().getDate() - 30)))}
                onClick={() => setQuickRange(30)}
              />
              <QuickFilterButton
                label="Last 90 Days"
                active={quickRangeLabel ===
   'Last 90 days'}
                onClick={() => setQuickRange(90)}
              />
              <QuickFilterButton
                label="Year to Date"
                active={filters.from ===
   `${new Date().getFullYear()}-01-01`}
                onClick={setYearToDate}
              />
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <ScopeBadge label="Range" value={quickRangeLabel} />
                <ScopeBadge label="Active Filters" value={formatNumber(activeFilterCount)} />
                {isSelfView ? <ScopeBadge label="Reviewer Mode" value="Self View" /> : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-1">
                <label className="mb-2 block text-sm font-medium text-[#011f4b]">From</label>
                <input
                  type="date"
                  value={draftFilters.from}
                  onChange={(e) => setDraftFilters((current) => ({ ...current, from: e.target.value }))}
                  className="w-full rounded-xl border border-[#b3cde0] bg-white px-3 py-2.5 text-sm text-[#011f4b] outline-none transition-colors focus:border-[#005b96]"
                />
              </div>

              <div className="xl:col-span-1">
                <label className="mb-2 block text-sm font-medium text-[#011f4b]">To</label>
                <input
                  type="date"
                  value={draftFilters.to}
                  onChange={(e) => setDraftFilters((current) => ({ ...current, to: e.target.value }))}
                  className="w-full rounded-xl border border-[#b3cde0] bg-white px-3 py-2.5 text-sm text-[#011f4b] outline-none transition-colors focus:border-[#005b96]"
                />
              </div>

              <div className="xl:col-span-1">
                <label className="mb-2 block text-sm font-medium text-[#011f4b]">Category</label>
                <select
                  value={draftFilters.category}
                  onChange={(e) => setDraftFilters((current) => ({ ...current, category: e.target.value }))}
                  className="w-full rounded-xl border border-[#b3cde0] bg-white px-3 py-2.5 text-sm text-[#011f4b] outline-none transition-colors focus:border-[#005b96]"
                >
                  <option value="all">All Categories</option>
                  <option value="research">Research</option>
                  <option value="book">Book / Chapter</option>
                  <option value="conference">Conference</option>
                  <option value="ipr">Patent / IPR</option>
                  <option value="grants">Grants</option>
                </select>
              </div>

              <div className="xl:col-span-1">
                <label className="mb-2 block text-sm font-medium text-[#011f4b]">School</label>
                <select
                  value={draftFilters.schoolId}
                  onChange={(e) =>
                    setDraftFilters((current) => ({
                      ...current,
                      schoolId: e.target.value,
                      departmentId: '',
                    }))
                  }
                  className="w-full rounded-xl border border-[#b3cde0] bg-white px-3 py-2.5 text-sm text-[#011f4b] outline-none transition-colors focus:border-[#005b96]"
                >
                  <option value="">All Schools</option>
                  {schoolRows.map((school) => (
                    <option key={school.schoolId} value={school.schoolId}>
                      {school.schoolName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="xl:col-span-1">
                <label className="mb-2 block text-sm font-medium text-[#011f4b]">Department</label>
                <select
                  value={draftFilters.departmentId}
                  onChange={(e) => setDraftFilters((current) => ({ ...current, departmentId: e.target.value }))}
                  className="w-full rounded-xl border border-[#b3cde0] bg-white px-3 py-2.5 text-sm text-[#011f4b] outline-none transition-colors focus:border-[#005b96]"
                >
                  <option value="">All Departments</option>
                  {departmentOptions.map((department) => (
                    <option key={department.departmentId} value={department.departmentId}>
                      {department.departmentName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="xl:col-span-1">
                <label className="mb-2 block text-sm font-medium text-[#011f4b]">
                  {activeTab ===
   'drd_member' ? 'Reviewer' : 'Scope Hint'}
                </label>
                {activeTab ===
   'drd_member' ? (
                  <select
                    value={draftFilters.reviewerId}
                    onChange={(e) => setDraftFilters((current) => ({ ...current, reviewerId: e.target.value }))}
                    className="w-full rounded-xl border border-[#b3cde0] bg-white px-3 py-2.5 text-sm text-[#011f4b] outline-none transition-colors focus:border-[#005b96]"
                  >
                    <option value="">{isSelfView ? 'My Analytics' : 'All Reviewers'}</option>
                    {reviewerRows.map((reviewer) => (
                      <option key={reviewer.reviewerId} value={reviewer.reviewerId}>
                        {reviewer.reviewerName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex h-[42px] items-center rounded-xl border border-dashed border-[#b3cde0] bg-[#f7fbfe] px-3 text-sm text-[#6497b1]">
                    Department-only users stay within their assigned department
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-[#e3edf4] bg-[#f7fbfe] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-white p-2 text-[#005b96] shadow-sm">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#011f4b]">Current view</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {activeTab ===
   'applicant'
                      ? 'Monitor applicant submissions, approvals, and incentive impact in the chosen scope.'
                      : 'Track reviewer workload, response speed, completion efficiency, and pending load.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl border border-[#b3cde0] bg-white px-4 py-2 text-sm font-semibold text-[#005b96] transition-colors hover:border-[#005b96]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#005b96] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#005b96]/20 transition-colors hover:bg-[#004a80]"
                >
                  Apply Filters
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-[28px] border border-[#d8e6ef] bg-white">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f7fb] text-[#005b96]">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
              <p className="mt-4 text-sm font-medium text-[#011f4b]">Loading DRD analytics</p>
              <p className="mt-1 text-sm text-gray-500">Preparing the latest scoped view for you.</p>
            </div>
          </div>
        ) : !data ? (
          <EmptyPanel
            title="Analytics could not be loaded"
            description="The current user may not have the required analytics permission or scoped assignment yet."
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(activeTab ===
   'applicant' ? applicantCards : reviewerCards).map((card) => (
                <DashboardCard key={card.title} {...card} />
              ))}
            </section>

            <section className="flex flex-wrap gap-2">
              <ScopeBadge label="Scope Level" value={scopeLevel} />
              <ScopeBadge label="Resolution" value={data.meta.scopeApplied.resolution} />
              <ScopeBadge
                label="Time Range"
                value={`${formatDateLabel(data.meta.timeRange.from)} to ${formatDateLabel(data.meta.timeRange.to)}`}
              />
              <ScopeBadge label="Category" value={filters.category ===
   'all' ? 'All' : filters.category} />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <MonthlyBarChart
                title={activeTab ===
   'applicant' ? 'Monthly Filing Trend' : 'Monthly Review Trend'}
                description={
                  activeTab ===
   'applicant'
                    ? 'Applications and approvals over the selected months.'
                    : 'Assigned and completed work across the selected months.'
                }
                points={monthlyTrend}
                series={
                  activeTab ===
   'applicant'
                    ? [
                        { key: 'totalApplications', label: 'Applications', color: 'bg-[#005b96]', text: 'bg-[#edf5fa] text-[#005b96]' },
                        { key: 'approvedCount', label: 'Approved', color: 'bg-emerald-500', text: 'bg-[#edf8f4] text-emerald-700' },
                      ]
                    : [
                        { key: 'assigned', label: 'Assigned', color: 'bg-[#005b96]', text: 'bg-[#edf5fa] text-[#005b96]' },
                        { key: 'completed', label: 'Completed', color: 'bg-emerald-500', text: 'bg-[#edf8f4] text-emerald-700' },
                      ]
                }
              />

              <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                <SectionHeader
                  title="Highlights"
                  description="The most important signals from the current scoped view."
                />
                <div className="grid gap-4 p-5">
                  {activeTab ===
   'applicant' ? (
                    <>
                      <InsightCard
                        title="Top School"
                        value={applicantTopSchool?.schoolName || 'No data'}
                        helper={
                          applicantTopSchool
                            ? `${formatNumber(applicantTopSchool.totalApplications)} applications`
                            : 'No school activity found in this range.'
                        }
                      />
                      <InsightCard
                        title="Top Department"
                        value={applicantTopDepartment?.departmentName || 'No data'}
                        helper={
                          applicantTopDepartment
                            ? `${formatNumber(applicantTopDepartment.totalIncentive)} incentive`
                            : 'No department activity found in this range.'
                        }
                      />
                      <InsightCard
                        title="Top Applicant"
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
                        title="Top Reviewer"
                        value={topReviewer?.reviewerName || 'No data'}
                        helper={
                          topReviewer
                            ? `${formatNumber(topReviewer.completedCount)} completed reviews`
                            : 'No reviewer activity found in this range.'
                        }
                      />
                      <InsightCard
                        title="Team Completion"
                        value={formatPercent(
                          data.kpis.assignedCount
                            ? ((data.kpis.completedCount || 0) / data.kpis.assignedCount) * 100
                            : 0
                        )}
                        helper="Based on assigned items in the current DRD view."
                      />
                      <InsightCard
                        title="Response Speed"
                        value={formatHours(data.kpis.avgFirstResponseHours)}
                        helper={isSelfView ? 'Your current review response speed.' : 'Average across visible reviewers.'}
                      />
                    </>
                  )}
                </div>
              </div>
            </section>

            {activeTab ===
   'applicant' ? (
              <>
                <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                    <SectionHeader
                      title="School Performance"
                      description="See where filing volume and incentive impact are concentrated."
                    />
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[#f7fbfe] text-left text-[#6497b1]">
                          <tr>
                            {['School', 'Applications', 'Approved', 'Incentive', 'Actions'].map((label) => (
                              <th key={label} className="px-5 py-3 font-semibold">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {schoolRows.length ===
   0 ? (
                            <tr>
                              <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                                No school analytics available for the selected scope.
                              </td>
                            </tr>
                          ) : (
                            schoolRows.map((school) => (
                              <tr key={school.schoolId} className="border-t border-[#eef5f9]">
                                <td className="px-5 py-4">
                                  <p className="font-semibold text-[#011f4b]">{school.schoolName}</p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {school.totalApplications > 0
                                      ? `${formatPercent((school.totalApproved / school.totalApplications) * 100)} approval rate`
                                      : 'No completed filings yet'}
                                  </p>
                                </td>
                                <td className="px-5 py-4 text-gray-600">{formatNumber(school.totalApplications)}</td>
                                <td className="px-5 py-4 text-gray-600">{formatNumber(school.totalApproved)}</td>
                                <td className="px-5 py-4 text-gray-600">{formatNumber(school.totalIncentive)}</td>
                                <td className="px-5 py-4">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => focusSchool(school.schoolId)}
                                      className="rounded-full border border-[#b3cde0] px-3 py-1.5 text-xs font-semibold text-[#005b96] transition-colors hover:border-[#005b96]"
                                    >
                                      Focus
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openDrilldown(
                                          'school',
                                          school.schoolId,
                                          school.schoolName,
                                          'Focused school analytics including people, departments, and month trend.'
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-full border border-[#d8e6ef] px-3 py-1.5 text-xs font-semibold text-[#011f4b] transition-colors hover:border-[#005b96]"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Details
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                    <SectionHeader
                      title="Department Momentum"
                      description="Quickly spot active departments and incentive-heavy pockets."
                    />
                    <div className="space-y-4 p-5">
                      {departmentRows.length ===
   0 ? (
                        <p className="text-sm text-gray-500">No department analytics are available for this view.</p>
                      ) : (
                        departmentRows.slice(0, 7).map((department) => {
                          const progressBase = departmentRows[0]?.totalApplications || 1;
                          const progress = Math.min(
                            100,
                            Math.round((department.totalApplications / progressBase) * 100)
                          );
                          return (
                            <div
                              key={department.departmentId}
                              className="rounded-2xl border border-[#e3edf4] p-4 transition-all hover:border-[#b3cde0] hover:shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-[#011f4b]">{department.departmentName}</p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {department.schoolName} • {formatNumber(department.totalApplicants)} applicants
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-[#011f4b]">
                                    {formatNumber(department.totalApplications)}
                                  </p>
                                  <p className="text-xs text-gray-500">applications</p>
                                </div>
                              </div>
                              <div className="mt-3 h-2 rounded-full bg-[#e8f1f7]">
                                <div
                                  className="h-2 rounded-full bg-gradient-to-r from-[#005b96] to-[#6497b1]"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs text-gray-500">
                                  {formatNumber(department.totalApproved)} approved • Incentive{' '}
                                  {formatNumber(department.totalIncentive)}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => focusDepartment(department.departmentId, department.schoolId)}
                                    className="rounded-full border border-[#b3cde0] px-3 py-1.5 text-xs font-semibold text-[#005b96]"
                                  >
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
                                    className="inline-flex items-center gap-1 rounded-full border border-[#d8e6ef] px-3 py-1.5 text-xs font-semibold text-[#011f4b]"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Details
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                  <SectionHeader
                    title="Applicant Leaderboard"
                    description="People-level view for the currently visible scope. Use it to spot high-volume contributors and incentive distribution."
                  />
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#f7fbfe] text-left text-[#6497b1]">
                        <tr>
                          {['Applicant', 'Department', 'Category Split', 'Approved', 'Incentive', 'Actions'].map((label) => (
                            <th key={label} className="px-5 py-3 font-semibold">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {peopleRows.length ===
   0 ? (
                          <tr>
                            <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                              No applicant records were found for the selected view.
                            </td>
                          </tr>
                        ) : (
                          peopleRows.map((person) => (
                            <tr key={person.personId} className="border-t border-[#eef5f9]">
                              <td className="px-5 py-4">
                                <p className="font-semibold text-[#011f4b]">{person.applicantName}</p>
                                <p className="mt-1 text-xs text-gray-500">{person.schoolName}</p>
                              </td>
                              <td className="px-5 py-4 text-gray-600">{person.departmentName}</td>
                              <td className="px-5 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-full bg-[#edf5fa] px-2.5 py-1 text-xs font-medium text-[#005b96]">
                                    Research {formatNumber(person.filingCounts.research)}
                                  </span>
                                  <span className="rounded-full bg-[#f3e8ff] px-2.5 py-1 text-xs font-medium text-violet-700">
                                    Book {formatNumber(person.filingCounts.book)}
                                  </span>
                                  <span className="rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-medium text-orange-700">
                                    Conference {formatNumber(person.filingCounts.conference)}
                                  </span>
                                  <span className="rounded-full bg-[#edf8f4] px-2.5 py-1 text-xs font-medium text-emerald-700">
                                    IPR {formatNumber(person.filingCounts.ipr)}
                                  </span>
                                  <span className="rounded-full bg-[#fff7eb] px-2.5 py-1 text-xs font-medium text-amber-700">
                                    Grants {formatNumber(person.filingCounts.grants)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-gray-600">{formatNumber(person.approvedCount)}</td>
                              <td className="px-5 py-4 font-semibold text-[#011f4b]">
                                {formatNumber(person.totalIncentive)}
                              </td>
                              <td className="px-5 py-4">
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
                                  className="inline-flex items-center gap-1 rounded-full border border-[#d8e6ef] px-3 py-1.5 text-xs font-semibold text-[#011f4b]"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Details
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
                  <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                    <SectionHeader
                      title="Reviewer Performance"
                      description="Compare assignment load, response speed, and closure rate across the visible DRD team."
                    />
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[#f7fbfe] text-left text-[#6497b1]">
                          <tr>
                            {['Reviewer', 'Assigned', 'Pending', 'Completion', 'Actions'].map((label) => (
                              <th key={label} className="px-5 py-3 font-semibold">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reviewerRows.length ===
   0 ? (
                            <tr>
                              <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                                No reviewer activity is available for this period.
                              </td>
                            </tr>
                          ) : (
                            reviewerRows.map((reviewer) => (
                              <tr key={reviewer.reviewerId} className="border-t border-[#eef5f9]">
                                <td className="px-5 py-4">
                                  <p className="font-semibold text-[#011f4b]">{reviewer.reviewerName}</p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    Response {formatHours(reviewer.avgFirstResponseHours)} • Completion{' '}
                                    {formatHours(reviewer.avgCompletionHours)}
                                  </p>
                                </td>
                                <td className="px-5 py-4 text-gray-600">{formatNumber(reviewer.assignedCount)}</td>
                                <td className="px-5 py-4 text-gray-600">{formatNumber(reviewer.pendingCount)}</td>
                                <td className="px-5 py-4 font-semibold text-[#011f4b]">
                                  {formatPercent(reviewer.completionRate)}
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => focusReviewer(reviewer.reviewerId)}
                                      className="rounded-full border border-[#b3cde0] px-3 py-1.5 text-xs font-semibold text-[#005b96]"
                                    >
                                      Focus
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openDrilldown(
                                          'reviewer',
                                          reviewer.reviewerId,
                                          reviewer.reviewerName,
                                          'Focused reviewer analytics including response, completion, and monthly trend.'
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-full border border-[#d8e6ef] px-3 py-1.5 text-xs font-semibold text-[#011f4b]"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Details
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                      <SectionHeader
                        title="Service Standards"
                        description="A compact status panel for speed, closure quality, and reviewer mode."
                      />
                      <div className="grid gap-4 p-5 sm:grid-cols-2">
                        <InsightCard
                          title="Mode"
                          value={isSelfView ? 'Self View' : 'Supervisor View'}
                          helper="Determined by analytics permission and DRD approval scope."
                        />
                        <InsightCard
                          title="Visible Reviewers"
                          value={formatNumber(data.kpis.totalReviewers)}
                          helper="Reviewers inside the current filter and scope window."
                        />
                        <InsightCard
                          title="Avg First Response"
                          value={formatHours(data.kpis.avgFirstResponseHours)}
                          helper="Time to first reviewer action."
                        />
                        <InsightCard
                          title="Avg Completion"
                          value={formatHours(data.kpis.avgCompletionHours)}
                          helper="Time to final decision for completed review cycles."
                        />
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                      <SectionHeader
                        title="Top Reviewers"
                        description="Ordered by completed work, with response speed as the tie-breaker."
                      />
                      <div className="space-y-4 p-5">
                        {reviewerRows.slice(0, 5).map((reviewer, index) => (
                          <div
                            key={reviewer.reviewerId}
                            className="flex items-center justify-between rounded-2xl border border-[#e3edf4] p-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#005b96] to-[#6497b1] text-sm font-bold text-white">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-semibold text-[#011f4b]">{reviewer.reviewerName}</p>
                                <p className="mt-1 text-xs text-gray-500">
                                  Research {formatNumber(reviewer.categoryBreakdown.research)} • Book{' '}
                                  {formatNumber(reviewer.categoryBreakdown.book)} • Conference{' '}
                                  {formatNumber(reviewer.categoryBreakdown.conference)} • IPR{' '}
                                  {formatNumber(reviewer.categoryBreakdown.ipr)} • Grants{' '}
                                  {formatNumber(reviewer.categoryBreakdown.grants)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-[#011f4b]">
                                {formatNumber(reviewer.completedCount)} completed
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {formatHours(reviewer.avgCompletionHours)} avg completion
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-[#d8e6ef] bg-white shadow-sm">
                  <SectionHeader
                    title="Reviewer Workload Board"
                    description="Use the workload bars to see pending pressure and overall handling capacity."
                  />
                  <div className="space-y-4 p-5">
                    {reviewerRows.length ===
   0 ? (
                      <p className="text-sm text-gray-500">No workload data is available for the selected range.</p>
                    ) : (
                      reviewerRows.map((reviewer) => {
                        const progress = reviewer.assignedCount
                          ? Math.round((reviewer.completedCount / reviewer.assignedCount) * 100)
                          : 0;
                        return (
                          <div
                            key={reviewer.reviewerId}
                            className="rounded-2xl border border-[#e3edf4] p-4 transition-all hover:border-[#b3cde0] hover:shadow-sm"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="font-semibold text-[#011f4b]">{reviewer.reviewerName}</p>
                                <p className="mt-1 text-sm text-gray-500">
                                  {formatNumber(reviewer.assignedCount)} assigned • {formatNumber(reviewer.pendingCount)} pending •{' '}
                                  {formatHours(reviewer.avgFirstResponseHours)} first response
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => focusReviewer(reviewer.reviewerId)}
                                  className="rounded-full border border-[#b3cde0] px-3 py-1.5 text-xs font-semibold text-[#005b96]"
                                >
                                  Focus
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDrilldown(
                                      'reviewer',
                                      reviewer.reviewerId,
                                      reviewer.reviewerName,
                                      'Focused reviewer analytics including response, completion, and monthly trend.'
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-full border border-[#d8e6ef] px-3 py-1.5 text-xs font-semibold text-[#011f4b]"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Details
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 h-2.5 rounded-full bg-[#e8f1f7]">
                              <div
                                className="h-2.5 rounded-full bg-gradient-to-r from-[#005b96] to-emerald-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                              <span>{formatPercent(reviewer.completionRate)} completion</span>
                              <span>{formatHours(reviewer.avgCompletionHours)} average completion</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>

      <DrilldownDrawer panel={drilldown} onClose={() => setDrilldown(null)} />
    </ProtectedRoute>
  );
}
