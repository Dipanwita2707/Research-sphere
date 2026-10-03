'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsResponse,
  type CategoryBreakdownResponse,
  type PersonSubmission,
  type ProgressTrackerAnalyticsData,
  type TrackerStatus,
} from '@/features/ipr-management/services/drdAnalytics.service';
import {
  AnalyticsFilterBar,
  AnalyticsHero,
  AnalyticsShell,
  ExportActions,
  AnalyticsBarChart,
  TrendChartPanel,
  AnalyticsPieChart,
  AnalyticsPipelineChart,
  AnalyticsPapersTable,
} from '@/components/analytics';
import { categoryColor, seriesColors, ui } from '@/components/analytics/theme';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers3,
  LayoutList,
  Printer,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function is403(err: unknown): boolean {
  if (err && typeof err ===
   'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status ===
   403;
  }
  return false;
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'research', label: 'Research' },
  { value: 'book', label: 'Book / Chapter' },
  { value: 'conference', label: 'Conference' },
  { value: 'ipr', label: 'IPR / Patent' },
  { value: 'grants', label: 'Grants' },
];

type KpiDrilldownType = 'all' | 'research' | 'book' | 'conference' | 'ipr' | 'grants' | 'approved' | 'contributors';

const KPI_META: Record<KpiDrilldownType, { label: string; personKey: string | null; approvedOnly: boolean }> = {
  all:          { label: 'All submissions', personKey: null,         approvedOnly: false },
  research:     { label: 'Research papers', personKey: 'research',   approvedOnly: false },
  book:         { label: 'Book / Chapter',  personKey: 'book',       approvedOnly: false },
  conference:   { label: 'Conference',      personKey: 'conference', approvedOnly: false },
  ipr:          { label: 'IPR / Patent',    personKey: 'ipr',        approvedOnly: false },
  grants:       { label: 'Grants',          personKey: 'grants',     approvedOnly: false },
  approved:     { label: 'Approved',        personKey: null,         approvedOnly: true },
  contributors: { label: 'Contributors',    personKey: null,         approvedOnly: false },
};

/** Category columns shared by the department table and highlight cards. */
const SCHOOL_CATEGORY_COLS = [
  { key: 'research', label: 'Research' },
  { key: 'book', label: 'Book' },
  { key: 'conference', label: 'Conference' },
  { key: 'ipr', label: 'IPR' },
  { key: 'grants', label: 'Grants' },
] as const;

function submissionExternalLink(sub: PersonSubmission): string | null {
  if (sub.doi) {
    return sub.doi.startsWith('http') ? sub.doi : `https://doi.org/${sub.doi}`;
  }
  return sub.weblink || null;
}

function KpiDrilldownDrawer({
  type, people, fromDate, toDate, onClose, onPersonClick,
}: {
  type: KpiDrilldownType;
  people: any[];
  fromDate: string;
  toDate: string;
  onClose: () => void;
  onPersonClick: (personId: string) => void;
}) {
  const meta = KPI_META[type];
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionRows, setSubmissionRows] = useState<Array<{
    id: string;
    title: string;
    link: string | null;
    submittedAt: string | null;
    authors: Array<{
      id: string;
      uid: string | null;
      name: string;
      authorType: string;
      isCorresponding: boolean;
      authorOrder: number;
    }>;
    contributors: Array<{
      personId: string;
      applicantUid: string | null;
      personName: string;
      departmentName: string;
    }>;
  }>>([]); 

  const rows = useMemo(
    () => people
      .map((p: any) => {
        const catCount = meta.personKey
          ? (p.filingCounts?.[meta.personKey] ?? p[`total${meta.personKey.charAt(0).toUpperCase() + meta.personKey.slice(1)}Submissions`] ?? 0)
          : p.totalApplications;
        return { ...p, _count: catCount };
      })
      .filter((p: any) => {
        if (meta.approvedOnly) return p.approvedCount > 0;
        if (meta.personKey) return p._count > 0;
        return true;
      })
      .sort((a: any, b: any) => {
        if (meta.approvedOnly) return b.approvedCount - a.approvedCount;
        return b._count - a._count;
      }),
    [people, meta.personKey, meta.approvedOnly],
  );

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (!meta.personKey) {
      setSubmissionRows([]);
      setLoadingSubmissions(false);
      return () => { cancelled = true; };
    }

    const loadSubmissionRows = async () => {
      setLoadingSubmissions(true);
      try {
        if (!rows.length) {
          if (!cancelled) {
            setSubmissionRows([]);
            setLoadingSubmissions(false);
          }
          return;
        }

        timeoutId = setTimeout(() => {
          if (!cancelled) {
            setLoadingSubmissions(false);
          }
        }, 8000);

        const targetPeople = rows.slice(0, 10);

        const settled = await Promise.allSettled(
          targetPeople.map((person: any) =>
            drdAnalyticsService.getApplicantPersonSubmissions(person.personId, {
              from: fromDate,
              to: toDate,
              category: meta.personKey || undefined,
            }).then((response) => ({ person, response })),
          ),
        );

        if (cancelled) return;

        const grouped = new Map<string, {
          id: string;
          title: string;
          link: string | null;
          authors: Array<{
            id: string;
            uid: string | null;
            name: string;
            authorType: string;
            isCorresponding: boolean;
            authorOrder: number;
          }>;
          contributors: Array<{ personId: string; applicantUid: string | null; personName: string; departmentName: string }>;
          submittedAt: string | null;
        }>();

        settled.forEach((result) => {
          if (result.status !== 'fulfilled' || !result.value?.response?.data?.submissions) return;
          const { person, response } = result.value;
          response.data.submissions.forEach((sub: PersonSubmission) => {
            const titleKey = `${sub.title.trim().toLowerCase()}::${sub.doi || sub.weblink || sub.applicationNumber || ''}`;
            const existing = grouped.get(titleKey);
            const contributor = {
              personId: person.personId,
              applicantUid: person.applicantUid || person.personId,
              personName: person.applicantName,
              departmentName: person.departmentName,
            };

            if (existing) {
              if (!existing.contributors.some((c) => c.personId ===
   contributor.personId)) {
                existing.contributors.push(contributor);
              }
              (sub.authors || []).forEach((author) => {
                if (!existing.authors.some((item) => item.id ===
   author.id || item.name ===
   author.name)) {
                  existing.authors.push({
                    id: author.id,
                    uid: author.uid || null,
                    name: author.name,
                    authorType: author.authorType,
                    isCorresponding: author.isCorresponding,
                    authorOrder: author.authorOrder,
                  });
                }
              });
              if (!existing.link) existing.link = submissionExternalLink(sub);
              if (!existing.submittedAt || (sub.submittedAt && new Date(sub.submittedAt).getTime() > new Date(existing.submittedAt).getTime())) {
                existing.submittedAt = sub.submittedAt;
              }
              return;
            }

            grouped.set(titleKey, {
              id: sub.id,
              title: sub.title,
              link: submissionExternalLink(sub),
              authors: (sub.authors || []).map((author) => ({
                id: author.id,
                uid: author.uid || null,
                name: author.name,
                authorType: author.authorType,
                isCorresponding: author.isCorresponding,
                authorOrder: author.authorOrder,
              })),
              contributors: [contributor],
              submittedAt: sub.submittedAt,
            });
          });
        });

        const collected = Array.from(grouped.values()).sort((a, b) => {
          const at = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const bt = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return bt - at;
        });

        setSubmissionRows(collected);
      } catch (err) {
        logger.error('Failed to load KPI submission titles', err);
        if (!cancelled) setSubmissionRows([]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) setLoadingSubmissions(false);
      }
    };

    loadSubmissionRows();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [meta.personKey, rows, fromDate, toDate]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-stone-900/30 dark:bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-stone-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        aria-label={meta.label}
      >
        {/* Header */}
        <div className="border-b border-stone-200 px-5 py-4 dark:border-gray-700 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900 dark:text-white">
                {meta.personKey && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: categoryColor(meta.personKey) }} aria-hidden="true" />
                )}
                {meta.label}
              </h2>
              <p className="mt-0.5 text-xs tabular-nums text-stone-500 dark:text-gray-400">
                {fromDate} → {toDate} · {rows.length} contributor{rows.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {meta.personKey && (
            <div className="border-b border-stone-100 px-4 pb-4 pt-4 dark:border-gray-700 sm:px-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className={ui.label}>
                  {loadingSubmissions ? 'Loading submissions…' : `${submissionRows.length} submission${submissionRows.length !== 1 ? 's' : ''}`}
                </h3>
                <span className="text-xs tabular-nums text-stone-500 dark:text-gray-400">Top 10 contributors · {fromDate} → {toDate}</span>
              </div>

              {loadingSubmissions ? (
                <div className="space-y-2" aria-busy="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-stone-100 dark:bg-gray-700" />
                  ))}
                </div>
              ) : submissionRows.length === 0 ? (
                <p className="py-2 text-sm text-stone-500 dark:text-gray-400">No submissions found for this range.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-gray-700">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="bg-stone-50 dark:bg-gray-900/40">
                        <th className={ui.th}>Title</th>
                        <th className={ui.th}>Contributors</th>
                        <th className={ui.th}>Filing date</th>
                        <th className={`${ui.th} text-right`}>Paper</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                      {submissionRows.map((s) => (
                        <tr key={s.id} className="align-top transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40">
                          <td className="px-4 py-3">
                            <p className="font-medium leading-snug text-stone-900 dark:text-gray-100">{s.title}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {s.contributors.map((person) => (
                                <button
                                  key={person.personId}
                                  onClick={() => onPersonClick(person.personId)}
                                  className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700 transition-colors hover:border-wine/30 hover:bg-wine/5 hover:text-wine dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200 dark:hover:text-amber"
                                >
                                  <span>{person.personName}</span>
                                  <span className="text-stone-400 dark:text-gray-500">·</span>
                                  <span className="text-stone-500 dark:text-gray-400">{person.applicantUid}</span>
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-stone-500 dark:text-gray-400">
                            {s.submittedAt
                              ? new Date(s.submittedAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {s.link ? (
                              <a
                                href={s.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-wine transition-colors hover:bg-wine/5 dark:border-gray-600 dark:text-amber dark:hover:bg-gray-700"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View paper
                              </a>
                            ) : (
                              <span className="text-xs text-stone-400 dark:text-gray-500">No link</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Contributors table */}
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-400 dark:text-gray-500">
              <FileText className="h-8 w-8" />
              <p className="text-sm text-stone-500 dark:text-gray-400">No data for this category.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-gray-900">
                <tr>
                  <th className={`${ui.th} w-12`}>#</th>
                  <th className={ui.th}>Contributor</th>
                  <th className={`${ui.th} hidden sm:table-cell`}>Department</th>
                  <th className={`${ui.th} text-right`}>
                    {meta.approvedOnly ? 'Approved' : 'Count'}
                  </th>
                  {meta.approvedOnly && (
                    <th className={`${ui.th} text-right`}>Amount</th>
                  )}
                  <th className="w-8" aria-hidden="true" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                {rows.map((p: any, i: number) => (
                  <tr
                    key={p.personId}
                    className="group cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40"
                    onClick={() => onPersonClick(p.personId)}
                  >
                    <td className="px-4 py-3 tabular-nums text-stone-400 dark:text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-stone-900 transition-colors group-hover:text-wine dark:text-gray-100 dark:group-hover:text-amber">
                        {p.applicantName}
                      </span>
                      <span className="block truncate text-xs text-stone-500 dark:text-gray-400 sm:hidden">{p.departmentName}</span>
                    </td>
                    <td className="hidden max-w-[180px] truncate px-4 py-3 text-xs text-stone-500 dark:text-gray-400 sm:table-cell">{p.departmentName}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-stone-900 dark:text-white">
                      {meta.approvedOnly ? p.approvedCount : p._count}
                    </td>
                    {meta.approvedOnly && (
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-stone-700 dark:text-gray-200">
                        ₹{Number(p.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    )}
                    <td className="pr-3 text-stone-300 group-hover:text-stone-500 dark:text-gray-600 dark:group-hover:text-gray-400">
                      <ChevronRight className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

export default function SchoolAnalyticsPage() {
  const router = useRouter();
  const params = useParams<{ schoolId: string }>();
  const schoolId = params?.schoolId ?? null;
  const searchParams = useSearchParams()!;

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [data, setData] = useState<DrdAnalyticsResponse | null>(null);
  const [trackerData, setTrackerData] = useState<ProgressTrackerAnalyticsData | null>(null);
  const [allSchools, setAllSchools] = useState<{ value: string; label: string }[]>([]);
  const [kpiDrawer, setKpiDrawer] = useState<KpiDrilldownType | null>(null);
  const [fromDate, setFromDate] = useState(searchParams?.get('from') || isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(searchParams?.get('to') || isoDate(new Date()));
  const [category, setCategory] = useState(searchParams?.get('category') || 'all');
  const [departmentId, setDepartmentId] = useState(searchParams?.get('departmentId') || '');
  const [selectedDeptId, setSelectedDeptId] = useState(searchParams?.get('departmentId') || '');
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownResponse | null>(null);
  const [contributorPage, setContributorPage] = useState(0);
  const CONTRIBUTOR_PAGE_SIZE = 10;
  const [viewMode, setViewMode] = useState<'overview' | 'papers'>('overview');

  // Fetch school list once on mount so the school selector is always populated
  useEffect(() => {
    drdAnalyticsService.getApplicantAnalytics({})
      .then((res) => {
        const schools = (res?.data?.schoolWise ?? []).map((s: any) => ({
          value: s.schoolId,
          label: s.schoolName,
        }));
        setAllSchools(schools);
      })
      .catch(() => {/* silently ignore */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [applicantRes, trackerRes, breakdownRes] = await Promise.allSettled([
        drdAnalyticsService.getApplicantSchoolAnalytics(schoolId, {
          from: fromDate,
          to: toDate,
          category: category !== 'all' ? category : undefined,
          departmentId: departmentId || undefined,
        }),
        drdAnalyticsService.getProgressTrackerAnalytics({
          from: fromDate,
          to: toDate,
          schoolId,
        }),
        drdAnalyticsService.getCategoryBreakdown({
          from: fromDate,
          to: toDate,
          schoolId,
          departmentId: departmentId || undefined,
        }),
      ]);
      if (applicantRes.status === 'fulfilled' && applicantRes.value?.data)
        setData(applicantRes.value.data);
      if (trackerRes.status === 'fulfilled' && trackerRes.value?.data)
        setTrackerData(trackerRes.value.data);
      if (breakdownRes.status === 'fulfilled' && breakdownRes.value?.data)
        setCategoryBreakdown(breakdownRes.value.data);
      else
        setCategoryBreakdown(null);
    } catch (err) {
      if (is403(err)) setAccessDenied(true);
      logger.error('Failed to load school analytics', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, fromDate, toDate, category, departmentId]);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [fetchData, schoolId]);

  const schoolInfo = data?.schoolWise?.[0] as any | null;
  const schoolName = schoolInfo?.schoolName ?? 'School Overview';
  const kpis = data?.kpis;

  const departments = React.useMemo(
    () => (data?.departmentWise ?? [])
      .slice()
      .sort((a: any, b: any) => b.totalApplications - a.totalApplications),
    [data?.departmentWise],
  );

  const people = React.useMemo(
    () => (data?.people ?? [])
      .slice()
      .sort((a: any, b: any) => b.totalApplications - a.totalApplications),
    [data?.people],
  );

  const visiblePeople = React.useMemo(
    () => (selectedDeptId
      ? people.filter((p: any) => p.departmentId ===
   selectedDeptId)
      : people),
    [people, selectedDeptId],
  );

  const contributorTotalPages = Math.ceil(visiblePeople.length / CONTRIBUTOR_PAGE_SIZE);
  const contributorSlice = visiblePeople.slice(
    contributorPage * CONTRIBUTOR_PAGE_SIZE,
    (contributorPage + 1) * CONTRIBUTOR_PAGE_SIZE,
  );

  // Reset to page 0 when filter changes
  React.useEffect(() => { setContributorPage(0); }, [selectedDeptId, data]);

  const handleGenerateReport = React.useCallback(() => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    // Build an inline SVG donut chart + legend from raw slice data
    const buildPieChart = (
      title: string,
      slices: { label: string; count: number }[],
      colors: string[],
    ) => {
      const filled = slices.filter((s) => s.count > 0);
      const total = filled.reduce((s, d) => s + d.count, 0);
      if (total === 0) {
        return `<div class="pie-card"><div class="pie-title">${title}</div><div class="pie-empty">No data</div></div>`;
      }
      const cx = 90; const cy = 90; const R = 72; const ri = 44;
      let angle = -Math.PI / 2;
      const paths = filled.map((d, i) => {
        const sweep = (d.count / total) * 2 * Math.PI;
        const safe = Math.min(sweep, 2 * Math.PI - 0.001);
        const x1 = cx + R * Math.cos(angle); const y1 = cy + R * Math.sin(angle);
        const x2 = cx + R * Math.cos(angle + safe); const y2 = cy + R * Math.sin(angle + safe);
        const x3 = cx + ri * Math.cos(angle + safe); const y3 = cy + ri * Math.sin(angle + safe);
        const x4 = cx + ri * Math.cos(angle); const y4 = cy + ri * Math.sin(angle);
        const lg = safe > Math.PI ? 1 : 0;
        const path = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${lg} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${ri} ${ri} 0 ${lg} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
        angle += sweep;
        return `<path d="${path}" fill="${colors[i % colors.length]}" />`;
      }).join('');
      const legend = filled.map((d, i) => {
        const pct = ((d.count / total) * 100).toFixed(0);
        return `<div class="legend-row"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span><span class="legend-label">${d.label}</span><span class="legend-count">${d.count} &nbsp;<span style="color:#94a3b8">(${pct}%)</span></span></div>`;
      }).join('');
      return `<div class="pie-card">
        <div class="pie-title">${title}</div>
        <div class="pie-body">
          <svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
            ${paths}
            <text x="90" y="86" text-anchor="middle" font-size="22" font-weight="700" fill="#0f172a">${total}</text>
            <text x="90" y="102" text-anchor="middle" font-size="10" fill="#94a3b8">total</text>
          </svg>
          <div class="legend">${legend}</div>
        </div>
      </div>`;
    };

    const BLUE = ['#3b82f6','#60a5fa','#93c5fd','#1d4ed8','#2563eb','#0ea5e9','#38bdf8','#7dd3fc','#0369a1','#0284c7','#06b6d4'];
    const GREEN = ['#22c55e','#4ade80','#86efac','#15803d','#16a34a','#10b981','#34d399','#6ee7b7','#065f46','#047857','#059669'];
    const PURPLE = ['#a855f7','#c084fc','#d8b4fe','#7c3aed','#8b5cf6','#6366f1','#818cf8','#a5b4fc','#4338ca','#4f46e5'];
    const AMBER = ['#f59e0b','#fbbf24','#fcd34d','#b45309','#d97706','#f97316','#fb923c','#fdba74','#c2410c','#ea580c'];

    const cb = categoryBreakdown;
    const schoolChartsHtml = cb ? [
      buildPieChart('Research Papers', (cb.research ?? []).map((x: any) => ({ label: x.label, count: x.count })), BLUE),
      buildPieChart('Books', (cb.book ?? []).filter((b: any) => b.key !== 'chapter').map((x: any) => ({ label: x.label, count: x.count })), GREEN),
      buildPieChart('Book Chapters', (cb.book ?? []).filter((b: any) => b.key === 'chapter').map((x: any) => ({ label: x.label, count: x.count })), PURPLE),
      buildPieChart('Conference', (cb.conference ?? []).map((x: any) => ({ label: x.label, count: x.count })), PURPLE),
      buildPieChart('IPR / Patent', (cb.ipr ?? []).map((x: any) => ({ label: x.label, count: x.count })), AMBER),
      buildPieChart('Grants', (cb.grant ?? []).map((x: any) => ({ label: x.label, count: x.count })), GREEN),
    ].join('') : '<p style="color:#94a3b8;font-size:12px;">No breakdown data available.</p>';

    const kd = data;
    const reportTitle = `${schoolName} — Analytics Report`;
    const generatedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    // Build per-department sections (departments returned by API = what this user has access to)
    const buildDeptSection = (dept: any, deptIdx: number) => {
      const fc = dept.filingCounts || {};
      const deptPeople = people
        .filter((p: any) => p.departmentId === dept.departmentId)
        .sort((a: any, b: any) => b.totalApplications - a.totalApplications);
      const deptContributors = deptPeople.length;
      const approvalPct = dept.totalApplications > 0
        ? ((dept.totalApproved / dept.totalApplications) * 100).toFixed(1)
        : '0.0';

      // Bar chart: build SVG bars for each category
      const cats = [
        { label: 'Research', val: fc.research || 0, color: '#3b82f6' },
        { label: 'Book', val: fc.book || 0, color: '#8b5cf6' },
        { label: 'Conference', val: fc.conference || 0, color: '#f59e0b' },
        { label: 'IPR', val: fc.ipr || 0, color: '#ef4444' },
        { label: 'Grants', val: fc.grants || 0, color: '#10b981' },
      ];
      const maxVal = Math.max(...cats.map(c => c.val), 1);
      const svgW = 480; const svgH = 140; const barW = 56; const gap = 24;
      const chartX = 40; const chartY = 10; const chartH = 90;
      const svgBars = cats.map((c, ci) => {
        const bh = Math.round((c.val / maxVal) * chartH);
        const bx = chartX + ci * (barW + gap);
        const by = chartY + chartH - bh;
        return `
          <rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${c.color}" rx="4" opacity="0.85"/>
          <text x="${bx + barW / 2}" y="${chartY + chartH + 14}" text-anchor="middle" font-size="10" fill="#64748b">${c.label}</text>
          <text x="${bx + barW / 2}" y="${by - 4}" text-anchor="middle" font-size="11" font-weight="600" fill="#1e293b">${c.val}</text>`;
      }).join('');

      const contributorsTable = deptPeople.length > 0 ? `
        <div style="margin-top:12px;">
          <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:6px;">Contributors (${deptContributors})</div>
          <table>
            <thead><tr>
              <th>#</th><th>Name</th>
              <th class="right">Applications</th>
              <th class="right">Approved</th>
              <th class="right">Approval %</th>
              <th class="right">Incentive</th>
            </tr></thead>
            <tbody>${deptPeople.map((p: any, pi: number) => {
              const rate = p.totalApplications > 0 ? ((p.approvedCount / p.totalApplications) * 100).toFixed(0) : '0';
              return `<tr>
                <td>${pi + 1}</td>
                <td><strong>${p.applicantName}</strong></td>
                <td class="right">${p.totalApplications}</td>
                <td class="right">${p.approvedCount}</td>
                <td class="right">${rate}%</td>
                <td class="right">&#x20B9;${Number(p.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
              </tr>`;}).join('')}
            </tbody>
          </table>
        </div>` : `<p style="font-size:12px;color:#94a3b8;margin-top:8px;">No contributors in this period.</p>`;

      return `
      <div class="dept-section${deptIdx > 0 ? ' page-break' : ''}">
        <div class="dept-section-header">
          <span class="dept-section-name">${dept.departmentName}</span>
          <span class="dept-section-meta">${dept.totalApplications} applications &nbsp;·&nbsp; ${approvalPct}% approved &nbsp;·&nbsp; ${deptContributors} contributor${deptContributors !== 1 ? 's' : ''} &nbsp;·&nbsp; &#x20B9;${Number(dept.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
        <div style="display:flex;gap:24px;align-items:flex-start;margin-top:12px;">
          <div>
            <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Category Distribution</div>
            <svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
              <line x1="${chartX}" y1="${chartY}" x2="${chartX}" y2="${chartY + chartH}" stroke="#e2e8f0" stroke-width="1"/>
              <line x1="${chartX}" y1="${chartY + chartH}" x2="${svgW - 10}" y2="${chartY + chartH}" stroke="#e2e8f0" stroke-width="1"/>
              ${svgBars}
            </svg>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:200px;">
            <div class="kpi-card" style="padding:8px 10px;"><div class="kpi-label">Total</div><div class="kpi-value" style="font-size:18px;">${dept.totalApplications || 0}</div></div>
            <div class="kpi-card" style="padding:8px 10px;"><div class="kpi-label">Approved</div><div class="kpi-value" style="font-size:18px;color:#16a34a;">${dept.totalApproved || 0}</div></div>
            <div class="kpi-card" style="padding:8px 10px;"><div class="kpi-label">Contributors</div><div class="kpi-value" style="font-size:18px;">${deptContributors}</div></div>
            <div class="kpi-card" style="padding:8px 10px;"><div class="kpi-label">Incentive</div><div class="kpi-value" style="font-size:14px;">&#x20B9;${Number(dept.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div></div>
          </div>
        </div>
        ${contributorsTable}
      </div>`;
    };

    const deptSectionsHtml = departments.map((d: any, i: number) => buildDeptSection(d, i)).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${reportTitle}</title>
  <meta charset="utf-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: Inter, sans-serif; }
    body { background: #fff; color: #0f172a; padding: 32px; font-size: 13px; }
    h1 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    h2 { font-size: 16px; font-weight: 700; color: #1e293b; margin: 28px 0 12px; border-left: 4px solid #3b82f6; padding-left: 10px; }
    .subtitle { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 14px; font-weight: 600; color: #1e293b; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; background: #f8fafc; }
    .kpi-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 4px; }
    .kpi-value { font-size: 24px; font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f1f5f9; color: #64748b; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th.right, td.right { text-align: right; }
    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge-blue { background: #eff6ff; color: #2563eb; }
    .badge-violet { background: #f5f3ff; color: #7c3aed; }
    .badge-amber { background: #fffbeb; color: #d97706; }
    .badge-red { background: #fef2f2; color: #dc2626; }
    .badge-green { background: #f0fdf4; color: #16a34a; }
    .pie-grid { display: flex; flex-wrap: wrap; gap: 16px; }
    .pie-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; background: #fff; min-width: 240px; flex: 1; }
    .pie-title { font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 10px; }
    .pie-empty { font-size: 12px; color: #94a3b8; padding: 20px 0; }
    .pie-body { display: flex; gap: 12px; align-items: flex-start; }
    .legend { display: flex; flex-direction: column; gap: 5px; justify-content: center; }
    .legend-row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
    .legend-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .legend-label { flex: 1; color: #475569; }
    .legend-count { font-weight: 600; color: #0f172a; white-space: nowrap; }
    .dept-section { margin-bottom: 36px; padding: 16px 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fafafa; }
    .dept-section-header { display: flex; align-items: baseline; gap: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 4px; }
    .dept-section-name { font-size: 15px; font-weight: 700; color: #1e293b; }
    .dept-section-meta { font-size: 11px; color: #64748b; }
    @media print {
      body { padding: 16px; }
      .page-break { page-break-before: always; }
      .dept-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${reportTitle}</h1>
  <p class="subtitle">Generated on ${generatedOn} &nbsp;·&nbsp; Period: ${fromDate} to ${toDate}</p>

  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">Total Applications</div><div class="kpi-value">${kd?.kpis?.totalApplications ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Approved</div><div class="kpi-value">${kd?.kpis?.approvedCount ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Contributors</div><div class="kpi-value">${kd?.kpis?.totalPeople ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Incentive</div><div class="kpi-value">&#x20B9;${Number(kd?.kpis?.totalIncentive ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div></div>
    <div class="kpi-card"><div class="kpi-label">Research</div><div class="kpi-value">${kd?.kpis?.totalResearchSubmissions ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Books</div><div class="kpi-value">${kd?.kpis?.totalBookSubmissions ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Conference</div><div class="kpi-value">${kd?.kpis?.totalConferenceSubmissions ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">IPR / Patent</div><div class="kpi-value">${kd?.kpis?.totalPatentSubmissions ?? 0}</div></div>
  </div>

  ${departments.length > 0 ? `
  <div class="section">
    <div class="section-title">Department-wise Summary</div>
    <table>
      <thead><tr>
        <th>Department</th>
        <th class="right">Research</th><th class="right">Book</th><th class="right">Conference</th>
        <th class="right">IPR</th><th class="right">Grants</th>
        <th class="right">Total</th><th class="right">Approved</th><th class="right">Incentive</th>
      </tr></thead>
      <tbody>${departments.map((d: any) => {
        const fc = d.filingCounts || {};
        return `<tr>
          <td><strong>${d.departmentName}</strong></td>
          <td class="right"><span class="badge badge-blue">${fc.research || 0}</span></td>
          <td class="right"><span class="badge badge-violet">${fc.book || 0}</span></td>
          <td class="right"><span class="badge badge-amber">${fc.conference || 0}</span></td>
          <td class="right"><span class="badge badge-red">${fc.ipr || 0}</span></td>
          <td class="right"><span class="badge badge-green">${fc.grants || 0}</span></td>
          <td class="right"><strong>${d.totalApplications || 0}</strong></td>
          <td class="right">${d.totalApproved || 0}</td>
          <td class="right">&#x20B9;${Number(d.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
        </tr>`;}).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div class="section page-break">
    <div class="section-title">School-level Category Breakdown Charts</div>
    <div class="pie-grid">${schoolChartsHtml}</div>
  </div>

  <h2 class="page-break">Individual Department Analytics</h2>
  ${deptSectionsHtml}

</body>
</html>`);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  }, [data, schoolName, fromDate, toDate, departments, people, categoryBreakdown]);

  const departmentOptions = React.useMemo(
    () => departments.map((dept: any) => ({ value: dept.departmentId, label: dept.departmentName })),
    [departments],
  );

  const comparisonDepartments = departments.slice(0, 12);

  return (
    <ProtectedRoute>
      {accessDenied ? (
        <div className="flex min-h-screen items-center justify-center bg-[#faf8f6] p-6 dark:bg-gray-900">
          <div className={`w-full max-w-md p-8 text-center ${ui.card}`}>
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-stone-900 dark:text-white">Access denied</h2>
            <p className="mb-6 text-sm text-stone-500 dark:text-gray-400">You don&apos;t have permission to view this school&apos;s analytics.</p>
            <button onClick={() => router.back()} className={ui.btnPrimary}>
              Go back
            </button>
          </div>
        </div>
      ) : (
        <AnalyticsShell>
            {/* Header */}
            <AnalyticsHero
              title={schoolName}
              description="Department comparison, contributor activity and filing trends for this school in one view."
              eyebrow="School analytics"
              icon={<GraduationCap className="h-3.5 w-3.5" />}
              onBack={() => router.push('/drd/analytics/applicant')}
              backLabel="Back to applicant analytics"
              actions={(
                <>
                  <button
                    onClick={handleGenerateReport}
                    disabled={loading || !data}
                    className={ui.btnSecondary}
                  >
                    <Printer className="h-4 w-4" />
                    Generate report
                  </button>
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className={ui.btnSecondary}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </>
              )}
              chips={[
                { label: 'Applications', value: (kpis?.totalApplications || 0).toLocaleString('en-IN') },
                { label: 'Approved', value: (kpis?.approvedCount || 0).toLocaleString('en-IN') },
                { label: 'Contributors', value: (kpis?.totalPeople || people.length).toLocaleString('en-IN') },
                { label: 'Departments', value: departments.length.toLocaleString('en-IN') },
              ]}
            />

            {/* Filter bar */}
            <AnalyticsFilterBar
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              category={category}
              onCategoryChange={setCategory}
              categoryOptions={CATEGORY_OPTIONS}
              schoolId={schoolId ?? undefined}
              onSchoolChange={(id) => {
                if (id && id !== schoolId) {
                  router.push(`/drd/analytics/applicant/schools/${id}`);
                }
              }}
              schoolOptions={allSchools}
              departmentId={departmentId}
              onDepartmentChange={setDepartmentId}
              departmentOptions={departmentOptions}
              onApply={fetchData}
              onReset={() => {
                setFromDate(isoDate(new Date(Date.now() - 365 * 86400e3)));
                setToDate(isoDate(new Date()));
                setCategory('all');
                setDepartmentId('');
              }}
            />

            {/* View mode tabs */}
            <div className="border-b border-stone-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6 lg:px-8">
              <div className="-mb-px flex gap-1 overflow-x-auto" role="tablist" aria-label="View">
                {([
                  { key: 'overview', label: 'Overview', icon: <BarChart3 className="h-3.5 w-3.5" /> },
                  { key: 'papers', label: 'Papers & trackers', icon: <LayoutList className="h-3.5 w-3.5" /> },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setViewMode(tab.key)}
                    role="tab"
                    aria-selected={viewMode === tab.key}
                    className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                      viewMode === tab.key
                        ? 'border-wine text-wine dark:border-amber dark:text-amber'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

          <div id="school-analytics-content" className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">

            {viewMode === 'papers' ? (
              <AnalyticsPapersTable
                scope={schoolId ? { type: 'school', id: schoolId } : null}
                fromDate={fromDate}
                toDate={toDate}
              />
            ) : loading ? (
              <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`${ui.card} p-4`}>
                      <div className="mb-3 h-3 w-20 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                      <div className="h-6 w-14 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                    </div>
                  ))}
                </div>
                <div className="h-[320px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
                <div className="h-72 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
              </div>
            ) : (
              <>
                {/* KPI Drawer */}
                {kpiDrawer && (
                  <KpiDrilldownDrawer
                    type={kpiDrawer}
                    people={people}
                    fromDate={fromDate}
                    toDate={toDate}
                    onClose={() => setKpiDrawer(null)}
                    onPersonClick={(id) => { setKpiDrawer(null); router.push(`/drd/analytics/applicant/people/${id}`); }}
                  />
                )}

                {/* KPIs — each tile opens a contributor drill-down */}
                {kpis && (() => {
                  const cards: { label: string; value: string; sub?: string; type: KpiDrilldownType; swatch?: string; icon: React.ReactNode }[] = [
                    { label: 'Total applications', value: (kpis.totalApplications || 0).toLocaleString('en-IN'), type: 'all', icon: <BarChart3 /> },
                    { label: 'Research', value: (kpis.totalResearchSubmissions || 0).toLocaleString('en-IN'), type: 'research', swatch: 'research', icon: <FileText /> },
                    { label: 'IPR / Patent', value: (kpis.totalPatentSubmissions || 0).toLocaleString('en-IN'), type: 'ipr', swatch: 'ipr', icon: <Layers3 /> },
                    { label: 'Grants', value: (kpis.totalGrantSubmissions || 0).toLocaleString('en-IN'), type: 'grants', swatch: 'grants', icon: <Wallet /> },
                    { label: 'Approved', value: (kpis.approvedCount || 0).toLocaleString('en-IN'), type: 'approved', icon: <CheckCircle2 /> },
                    {
                      label: 'Approved amount',
                      value: '₹' + (kpis.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }),
                      type: 'approved',
                      icon: <Wallet />,
                    },
                    { label: 'Contributors', value: (kpis.totalPeople || people.length).toLocaleString('en-IN'), type: 'contributors', icon: <Users /> },
                    {
                      label: 'Approval rate',
                      value: kpis.totalApplications > 0 ? ((kpis.approvedCount / kpis.totalApplications) * 100).toFixed(1) + '%' : '0.0%',
                      sub: 'View approved',
                      type: 'approved',
                      icon: <TrendingUp />,
                    },
                  ];
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
                      {cards.map((card) => (
                        <button
                          key={card.label}
                          onClick={() => setKpiDrawer(card.type)}
                          className={`group flex flex-col p-4 text-left transition-colors hover:border-stone-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 dark:hover:border-gray-500 ${ui.card}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium leading-snug text-stone-500 dark:text-gray-400">
                              {card.swatch && (
                                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: categoryColor(card.swatch) }} aria-hidden="true" />
                              )}
                              {card.label}
                            </span>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-500 dark:bg-gray-700 dark:text-gray-300 [&_svg]:h-3.5 [&_svg]:w-3.5">
                              {card.icon}
                            </span>
                          </div>
                          <div className="mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums text-stone-900 dark:text-white">{card.value}</div>
                          <div className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-stone-400 transition-colors group-hover:text-wine dark:text-gray-500 dark:group-hover:text-amber">
                            {card.sub ?? 'View contributors'}
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Department comparison */}
                {departments.length > 0 && (
                  <div className="space-y-6">
                    {/* Category composition per department */}
                    <AnalyticsBarChart
                      title="Department comparison"
                      subtitle={departments.length > 12
                        ? 'Filings per category for the 12 most active departments. Click a bar to open that department.'
                        : 'Filings per category in each department. Click a bar to open that department.'}
                      stacked
                      data={comparisonDepartments.map((dept: any) => ({
                        label: dept.departmentName,
                        values: {
                          research:   dept.filingCounts?.research   ?? 0,
                          book:       dept.filingCounts?.book       ?? 0,
                          conference: dept.filingCounts?.conference ?? 0,
                          ipr:        dept.filingCounts?.ipr        ?? 0,
                          grants:     dept.filingCounts?.grants     ?? 0,
                        },
                      }))}
                      keys={[
                        { key: 'research',   label: 'Research' },
                        { key: 'book',       label: 'Book' },
                        { key: 'conference', label: 'Conference' },
                        { key: 'ipr',        label: 'IPR' },
                        { key: 'grants',     label: 'Grants' },
                      ]}
                      onBarClick={(_point, index) => {
                        const dept: any = comparisonDepartments[index];
                        if (dept) router.push(`/drd/analytics/applicant/departments/${dept.departmentId}?from=${fromDate}&to=${toDate}&category=${category}`);
                      }}
                      height={300}
                    />

                    {/* Department-wise category table — click navigates to department page */}
                    <section className={`overflow-hidden ${ui.card}`}>
                      <div className={ui.cardHeader}>
                        <div>
                          <h3 className={ui.title}>Department-wise research output</h3>
                          <p className={ui.subtitle}>Select a department to open its analytics with contributor details.</p>
                        </div>
                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs tabular-nums text-stone-600 dark:bg-gray-700 dark:text-gray-300">
                          {departments.length} department{departments.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] text-sm">
                          <thead>
                            <tr className="bg-stone-50 dark:bg-gray-900/40">
                              <th className={ui.th}>Department</th>
                              {SCHOOL_CATEGORY_COLS.map((c) => (
                                <th key={c.key} className={`${ui.th} text-right`}>
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: categoryColor(c.key) }} aria-hidden="true" />
                                    {c.label}
                                  </span>
                                </th>
                              ))}
                              <th className={`${ui.th} text-right`}>Total</th>
                              <th className={`${ui.th} text-right`}>Approved</th>
                              <th className={`${ui.th} text-right`}>Incentive</th>
                              <th className="w-8" aria-hidden="true" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                            {departments.map((dept: any) => {
                              const fc = dept.filingCounts || {};
                              return (
                                <tr
                                  key={dept.departmentId}
                                  onClick={() => router.push(`/drd/analytics/applicant/departments/${dept.departmentId}?from=${fromDate}&to=${toDate}&category=${category}`)}
                                  className="group cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40"
                                >
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-stone-900 group-hover:text-wine dark:text-gray-100 dark:group-hover:text-amber">{dept.departmentName}</p>
                                  </td>
                                  {SCHOOL_CATEGORY_COLS.map((c) => (
                                    <td key={c.key} className={`px-4 py-3 text-right tabular-nums ${fc[c.key] ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>
                                      {fc[c.key] || 0}
                                    </td>
                                  ))}
                                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-stone-900 dark:text-white">{dept.totalApplications || 0}</td>
                                  <td className={`px-4 py-3 text-right tabular-nums ${dept.totalApproved ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>{dept.totalApproved || 0}</td>
                                  <td className={`px-4 py-3 text-right tabular-nums ${dept.totalIncentive ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>₹{Number(dept.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                  <td className="pr-3 text-stone-300 dark:text-gray-600">
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* Department highlights — select one to filter contributors */}
                    <section className={`overflow-hidden ${ui.card}`}>
                      <div className={ui.cardHeader}>
                        <div>
                          <h3 className={ui.title}>Department highlights</h3>
                          <p className={ui.subtitle}>Select a department to filter the contributor list below.</p>
                        </div>
                        {selectedDeptId && (
                          <button onClick={() => setSelectedDeptId('')} className={ui.btnSecondary}>
                            <X className="h-3.5 w-3.5" />
                            Clear filter
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {departments.map((dept: any) => {
                          const approvalPct = dept.totalApplications > 0
                            ? ((dept.totalApproved / dept.totalApplications) * 100).toFixed(0)
                            : '0';
                          const isSelected = selectedDeptId === dept.departmentId;
                          const fc = dept.filingCounts || {};
                          const mixTotal = SCHOOL_CATEGORY_COLS.reduce((sum, c) => sum + (fc[c.key] || 0), 0);
                          return (
                            <button
                              key={dept.departmentId}
                              onClick={() => setSelectedDeptId(isSelected ? '' : dept.departmentId)}
                              aria-pressed={isSelected}
                              className={`rounded-lg border p-3.5 text-left transition-colors ${
                                isSelected
                                  ? 'border-wine bg-wine/5 ring-2 ring-wine/15 dark:border-amber dark:bg-wine/20 dark:ring-amber/20'
                                  : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50 dark:border-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-700/40'
                              }`}
                            >
                              <p className="mb-2 truncate text-sm font-medium text-stone-800 dark:text-gray-100">{dept.departmentName}</p>
                              <div className="flex items-end justify-between gap-2">
                                <span className="text-xl font-semibold leading-none tabular-nums text-stone-900 dark:text-white">
                                  {dept.totalApplications}
                                  <span className="ml-1 text-xs font-normal text-stone-500 dark:text-gray-400">filed</span>
                                </span>
                                <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                                  Number(approvalPct) >= 50
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                }`}>
                                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                  {approvalPct}% approved
                                </span>
                              </div>
                              {mixTotal > 0 && (
                                <div
                                  className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full"
                                  role="img"
                                  aria-label={SCHOOL_CATEGORY_COLS.filter((c) => fc[c.key]).map((c) => `${c.label} ${fc[c.key]}`).join(', ')}
                                >
                                  {SCHOOL_CATEGORY_COLS.filter((c) => fc[c.key] > 0).map((c) => (
                                    <span
                                      key={c.key}
                                      className="h-full"
                                      style={{ width: `${(fc[c.key] / mixTotal) * 100}%`, backgroundColor: categoryColor(c.key) }}
                                      title={`${c.label}: ${fc[c.key]}`}
                                    />
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 px-5 py-3 dark:border-gray-700" aria-label="Legend">
                        {SCHOOL_CATEGORY_COLS.map((c) => (
                          <li key={c.key} className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-gray-300">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: categoryColor(c.key) }} />
                            {c.label}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                )}

                {/* Monthly trend + category breakdown — side by side */}
                <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                  {data?.extensions?.monthlyTrend ? (
                    <TrendChartPanel
                      title="Filed vs approved"
                      subtitle="Applications filed and approved each month"
                      data={(data.extensions.monthlyTrend as any[]).map((m) => ({
                        label: m.label || m.month,
                        values: {
                          filed: m.totalApplications || 0,
                          approved: m.approvedCount || 0,
                        },
                      }))}
                      keys={[
                        { key: 'filed', label: 'Filed' },
                        { key: 'approved', label: 'Approved' },
                      ]}
                      height={280}
                    />
                  ) : <div />}

                  {categoryBreakdown && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
                          <Layers3 className="h-4 w-4" />
                        </span>
                        <div>
                          <h2 className={ui.title}>
                            {category === 'all' ? 'Category mix' :
                             category === 'research' ? 'Research by indexing' :
                             category === 'book' ? 'Books and chapters by type' :
                             category === 'conference' ? 'Conference papers by type' :
                             category === 'ipr' ? 'IPR by type' :
                             'Grants by funding agency'}
                          </h2>
                          <p className={ui.subtitle}>Distribution of submissions by publication type, indexing and classification</p>
                        </div>
                      </div>
                      {category === 'all' && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <AnalyticsPieChart title="Research papers" subtitle="By indexing category" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                          <AnalyticsPieChart title="Books" subtitle="Authored and edited" data={categoryBreakdown.book.filter((b: any) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                        </div>
                      )}
                      {category === 'research' && (
                        <AnalyticsPieChart title="Research papers" subtitle="By indexing category" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                      )}
                      {category === 'book' && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <AnalyticsPieChart title="Books" subtitle="Authored and edited" data={categoryBreakdown.book.filter((b: any) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                          <AnalyticsPieChart title="Book chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b: any) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
                        </div>
                      )}
                      {category === 'conference' && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <AnalyticsPieChart title="Conference type" subtitle="National vs international" data={categoryBreakdown.conference} emptyMessage="No conference submissions" colorScheme="purple" />
                          {categoryBreakdown.conferenceSubtype.length > 0 && (
                            <AnalyticsPieChart title="Conference sub-type" subtitle="Paper category breakdown" data={categoryBreakdown.conferenceSubtype} emptyMessage="No subtype data" colorScheme="amber" />
                          )}
                        </div>
                      )}
                      {category === 'ipr' && (
                        <AnalyticsPieChart title="IPR by type" subtitle="Patent, copyright, trademark, design" data={categoryBreakdown.ipr} emptyMessage="No IPR submissions" colorScheme="amber" />
                      )}
                      {category === 'grants' && (
                        <AnalyticsPieChart title="Grants by funding agency" subtitle="Top agencies ranked by submission count" data={categoryBreakdown.grant} emptyMessage="No grant submissions" colorScheme="green" />
                      )}
                    </div>
                  )}
                </div>

                {/* ALL — remaining four breakdowns, full width */}
                {category === 'all' && categoryBreakdown && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <AnalyticsPieChart title="Book chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b: any) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
                    <AnalyticsPieChart title="Conference papers" subtitle="National vs international" data={categoryBreakdown.conference} emptyMessage="No conference submissions" colorScheme="amber" />
                    <AnalyticsPieChart title="IPR / Patent" subtitle="Patent, copyright, trademark, design" data={categoryBreakdown.ipr} emptyMessage="No IPR submissions" colorScheme="blue" />
                    <AnalyticsPieChart title="Grants" subtitle="By funding agency" data={categoryBreakdown.grant} emptyMessage="No grant submissions" colorScheme="green" />
                  </div>
                )}

                {/* Research pipeline — only when research category is selected */}
                {category === 'research' && (
                  <AnalyticsPipelineChart
                    title="Research pipeline"
                    subtitle="How many research works from this school sit in each stage, from writing through to publication"
                    stages={(
                      [
                        { key: 'writing',      label: 'Writing' },
                        { key: 'communicated', label: 'Communicated' },
                        { key: 'submitted',    label: 'Submitted' },
                        { key: 'accepted',     label: 'Accepted' },
                        { key: 'published',    label: 'Published' },
                        { key: 'rejected',     label: 'Rejected' },
                      ] as { key: TrackerStatus; label: string }[]
                    ).map((stage, _i, all) => ({
                      key: stage.key,
                      label: stage.label,
                      count: trackerData?.statusFunnel?.find((s) => s.status === stage.key)?.count
                        ?? (stage.key === 'rejected' ? (trackerData?.kpis?.rejectedCount ?? 0) : 0),
                      color: seriesColors(all.map((st) => st.key))[stage.key],
                      textColor: '',
                    }))}
                  />
                )}

                {/* Contributors with pagination */}
                {visiblePeople.length > 0 && (
                  <section className={`overflow-hidden ${ui.card}`}>
                    <div className={ui.cardHeader}>
                      <div className="min-w-0">
                        <h3 className={ui.title}>Contributors</h3>
                        <p className={ui.subtitle}>
                          <span className="tabular-nums">{visiblePeople.length.toLocaleString('en-IN')}</span> people
                          {selectedDeptId && (
                            <> in {departments.find((d: any) => d.departmentId === selectedDeptId)?.departmentName}</>
                          )}
                          , ranked by applications filed
                        </p>
                      </div>
                      <ExportActions
                        data={visiblePeople}
                        filename={`school-${schoolId}-contributors`}
                        columns={[
                          { key: 'applicantName', label: 'Name' },
                          { key: 'departmentName', label: 'Department' },
                          { key: 'totalApplications', label: 'Applications' },
                          { key: 'approvedCount', label: 'Approved' },
                          { key: 'totalIncentive', label: 'Incentive' },
                        ]}
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-stone-50 dark:bg-gray-900/40">
                            <th className={`${ui.th} w-12`}>#</th>
                            <th className={ui.th}>Name</th>
                            <th className={`${ui.th} hidden md:table-cell`}>Department</th>
                            <th className={`${ui.th} text-right`}>Applications</th>
                            <th className={`${ui.th} text-right`}>Approved</th>
                            <th className={`${ui.th} hidden text-right sm:table-cell`}>Approval %</th>
                            <th className={`${ui.th} text-right`}>Incentive</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                          {contributorSlice.map((p: any, i: number) => {
                            const rate =
                              p.totalApplications > 0
                                ? ((p.approvedCount / p.totalApplications) * 100).toFixed(0)
                                : '0';
                            return (
                              <tr key={p.personId} className="transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40">
                                <td className="px-4 py-3 tabular-nums text-stone-400 dark:text-gray-500">{contributorPage * CONTRIBUTOR_PAGE_SIZE + i + 1}</td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() =>
                                      router.push(`/drd/analytics/applicant/people/${p.personId}`)
                                    }
                                    className="text-left font-medium text-stone-900 hover:text-wine hover:underline dark:text-gray-100 dark:hover:text-amber"
                                  >
                                    {p.applicantName}
                                  </button>
                                  <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400 md:hidden">{p.departmentName}</p>
                                </td>
                                <td className="hidden px-4 py-3 text-sm text-stone-600 dark:text-gray-300 md:table-cell">{p.departmentName}</td>
                                <td className="px-4 py-3 text-right font-medium tabular-nums text-stone-900 dark:text-gray-100">{p.totalApplications}</td>
                                <td className={`px-4 py-3 text-right tabular-nums ${p.approvedCount ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>{p.approvedCount}</td>
                                <td className="hidden px-4 py-3 text-right tabular-nums text-stone-500 dark:text-gray-400 sm:table-cell">{rate}%</td>
                                <td className={`px-4 py-3 text-right tabular-nums ${p.totalIncentive ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>
                                  ₹{Number(p.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 dark:border-gray-700">
                        <span className="text-xs tabular-nums text-stone-500 dark:text-gray-400">
                          Showing {Math.min(contributorPage * CONTRIBUTOR_PAGE_SIZE + 1, visiblePeople.length)}–{Math.min((contributorPage + 1) * CONTRIBUTOR_PAGE_SIZE, visiblePeople.length)} of {visiblePeople.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setContributorPage((p) => Math.max(0, p - 1))}
                            disabled={contributorPage === 0}
                            className="rounded-lg p-1.5 text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
                            aria-label="Previous page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="px-2 text-xs font-medium tabular-nums text-stone-600 dark:text-gray-300">
                            {contributorPage + 1} / {Math.max(contributorTotalPages, 1)}
                          </span>
                          <button
                            onClick={() => setContributorPage((p) => Math.min(contributorTotalPages - 1, p + 1))}
                            disabled={contributorPage >= contributorTotalPages - 1}
                            className="rounded-lg p-1.5 text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
                            aria-label="Next page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                  </section>
                )}
              </>
            )}
          </div>
        </AnalyticsShell>
      )}
    </ProtectedRoute>
  );
}
