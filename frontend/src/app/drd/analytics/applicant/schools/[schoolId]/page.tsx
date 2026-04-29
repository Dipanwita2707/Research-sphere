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
  Loader2,
  Printer,
  RefreshCw,
  Sparkles,
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
  { value: 'all', label: 'All Categories' },
  { value: 'research', label: 'Research' },
  { value: 'book', label: 'Book / Chapter' },
  { value: 'conference', label: 'Conference' },
  { value: 'ipr', label: 'IPR / Patent' },
  { value: 'grants', label: 'Grants' },
];

type KpiDrilldownType = 'all' | 'research' | 'book' | 'conference' | 'ipr' | 'grants' | 'approved' | 'contributors';

const KPI_META: Record<KpiDrilldownType, { label: string; personKey: string | null; approvedOnly: boolean; color: string; bg: string; border: string }> = {
  all:          { label: 'All Submissions',   personKey: null,                 approvedOnly: false, color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200' },
  research:     { label: 'Research Papers',   personKey: 'research',           approvedOnly: false, color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  book:         { label: 'Book / Chapter',    personKey: 'book',               approvedOnly: false, color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  conference:   { label: 'Conference',        personKey: 'conference',         approvedOnly: false, color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  ipr:          { label: 'IPR / Patent',      personKey: 'ipr',                approvedOnly: false, color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200' },
  grants:       { label: 'Grants',            personKey: 'grants',             approvedOnly: false, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  approved:     { label: 'Approved',          personKey: null,                 approvedOnly: true,  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  contributors: { label: 'Contributors',      personKey: null,                 approvedOnly: false, color: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200' },
};

function submissionExternalLink(sub: PersonSubmission): string | null {
  if (sub.doi) {
    return sub.doi.startsWith('http') ? sub.doi : `https://doi.org/${sub.doi}`;
  }
  return sub.weblink || null;
}

function statusBadgeStyle(status: string) {
  const key = status?.toLowerCase?.() || '';
  if (key.includes('approved') || key.includes('published') || key.includes('completed')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (key.includes('rejected')) {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  if (key.includes('review') || key.includes('submitted') || key.includes('communicated')) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  return 'bg-slate-50 text-slate-600 border-slate-200';
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
      <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className={`border-b px-6 py-4 ${meta.bg} ${meta.border} border-b`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${meta.border} bg-white/80`}>
              <FileText className={`h-4 w-4 ${meta.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={`text-base font-semibold ${meta.color}`}>{meta.label}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{fromDate} → {toDate} · {rows.length} contributor{rows.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/70 transition-colors">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {meta.personKey && (
            <div className="border-b border-slate-100 px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {loadingSubmissions ? 'Loading submissions…' : `${submissionRows.length} submission${submissionRows.length !== 1 ? 's' : ''}`}
                </h3>
                <span className="text-[11px] text-slate-400">Top 10 contributors · {fromDate} → {toDate}</span>
              </div>

              {loadingSubmissions ? (
                <div className="flex items-center justify-center py-6 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : submissionRows.length ===
   0 ? (
                <p className="py-2 text-xs text-slate-400">No research submissions found for this range.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b border-slate-200 text-left">
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Title</th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Contributors</th>
                        <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Filing Date</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">View Paper</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {submissionRows.map((s) => (
                        <tr key={s.id} className="align-top hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900 leading-snug">{s.title}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {s.contributors.map((person) => (
                                <button
                                  key={person.personId}
                                  onClick={() => onPersonClick(person.personId)}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                                >
                                  <span>{person.personName}</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500">{person.applicantUid}</span>
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
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
                                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View Paper
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-300">No link</span>
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
          {rows.length ===
   0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
              <FileText className="h-10 w-10" />
              <p className="text-sm">No data for this category.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">Contributor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400">Dept</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    {meta.approvedOnly ? 'Approved' : 'Count'}
                  </th>
                  {meta.approvedOnly && (
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Amount</th>
                  )}
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((p: any, i: number) => (
                  <tr
                    key={p.personId}
                    className="group cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => onPersonClick(p.personId)}
                  >
                    <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-slate-900 group-hover:text-sky-700 transition-colors">
                        {p.applicantName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[110px] truncate">{p.departmentName}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        meta.approvedOnly ? 'bg-emerald-50 text-emerald-700' : `${meta.bg} ${meta.color}`
                      }`}>
                        {meta.approvedOnly ? p.approvedCount : p._count}
                      </span>
                    </td>
                    {meta.approvedOnly && (
                      <td className="px-4 py-3 text-right text-xs font-medium text-slate-700">
                        ₹{Number(p.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    )}
                    <td className="px-2 py-3 text-slate-300 group-hover:text-slate-500">
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

  return (
    <ProtectedRoute>
      {accessDenied ? (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500 mb-6 text-sm">You don&apos;t have permission to view this school&apos;s analytics.</p>
            <button onClick={() => router.back()} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Go Back
            </button>
          </div>
        </div>
      ) : (
        <AnalyticsShell>
            {/* Header */}
            <AnalyticsHero
              title={schoolName}
              description="School-level applicant analytics with department comparison, contributor visibility, and trend monitoring in one view."
              eyebrow="School Analytics"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              onBack={() => router.push('/drd/analytics/applicant')}
              actions={(
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateReport}
                    disabled={loading || !data}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-40"
                  >
                    <Printer className="h-4 w-4" />
                    Generate Report
                  </button>
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              )}
              chips={[
                { label: 'Applications', value: String(kpis?.totalApplications || 0) },
                { label: 'Approved', value: String(kpis?.approvedCount || 0) },
                { label: 'Contributors', value: String(kpis?.totalPeople || people.length) },
                { label: 'Departments', value: String(departments.length) },
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
            <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 px-6 sm:px-8 lg:px-12 xl:px-16">
              <div className="flex gap-0">
                {([
                  { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                  { key: 'papers', label: 'Papers & Trackers', icon: <LayoutList className="w-3.5 h-3.5" /> },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setViewMode(tab.key)}
                    className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                      viewMode === tab.key
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

          <div id="school-analytics-content" className="px-6 py-6 sm:px-8 lg:px-12 xl:px-16 space-y-6">

            {viewMode === 'papers' ? (
              <AnalyticsPapersTable
                scope={schoolId ? { type: 'school', id: schoolId } : null}
                fromDate={fromDate}
                toDate={toDate}
              />
            ) : loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse">
                    <div className="h-3 bg-slate-100 rounded w-20 mb-3" />
                    <div className="h-7 bg-slate-100 rounded w-12" />
                  </div>
                ))}
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

                {/* KPIs — clickable */}
                {kpis && (() => {
                  const cards: { label: string; value: string; sub?: string; type: KpiDrilldownType; accent: string; icon: React.ReactNode }[] = [
                    { label: 'Total Applications', value: String(kpis.totalApplications || 0), type: 'all', accent: 'from-slate-900 to-sky-700', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                    { label: 'Research', value: String(kpis.totalResearchSubmissions || 0), type: 'research', accent: 'from-blue-600 to-blue-400', icon: <FileText className="w-3.5 h-3.5" /> },
                    { label: 'IPR / Patent', value: String(kpis.totalPatentSubmissions || 0), type: 'ipr', accent: 'from-rose-600 to-rose-400', icon: <Layers3 className="w-3.5 h-3.5" /> },
                    { label: 'Grants', value: String(kpis.totalGrantSubmissions || 0), type: 'grants', accent: 'from-emerald-600 to-teal-400', icon: <Wallet className="w-3.5 h-3.5" /> },
                    { label: 'Approved', value: String(kpis.approvedCount || 0), type: 'approved', accent: 'from-emerald-600 to-green-400', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                    {
                      label: 'Approved Amount',
                      value: '₹' + (kpis.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }),
                      type: 'approved',
                      accent: 'from-teal-600 to-cyan-400',
                      icon: <Wallet className="w-3.5 h-3.5" />,
                    },
                    { label: 'Contributors', value: String(kpis.totalPeople || people.length), type: 'contributors', accent: 'from-sky-600 to-indigo-400', icon: <Users className="w-3.5 h-3.5" /> },
                    {
                      label: 'Approval Rate',
                      value: kpis.totalApplications > 0 ? ((kpis.approvedCount / kpis.totalApplications) * 100).toFixed(1) + '%' : '0.0%',
                      sub: 'click to see approved',
                      type: 'approved',
                      accent: 'from-violet-600 to-purple-400',
                      icon: <TrendingUp className="w-3.5 h-3.5" />,
                    },
                  ];
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                      {cards.map((card) => (
                        <button
                          key={card.label}
                          onClick={() => setKpiDrawer(card.type)}
                          className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                        >
                          <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${card.accent}`} />
                          <div className="mt-0.5 flex items-start justify-between gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 leading-tight">{card.label}</span>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white ${card.accent}`}>{card.icon}</span>
                          </div>
                          <div className="mt-2 text-2xl font-bold leading-none tracking-tight text-slate-900">{card.value}</div>
                          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-sky-600 transition-colors">
                            <span>{card.sub || 'View details'}</span>
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
                    {/* Department bar chart — category-level breakdown */}
                    <AnalyticsBarChart
                      title="Department Comparison — Category Breakdown"
                      subtitle="Research output per category across every department in this school. Click a row in the table below to open department-level analytics."
                      data={departments.slice(0, 12).map((dept: any) => ({
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
                        { key: 'research',   label: 'Research',   color: '#3b82f6' },
                        { key: 'book',       label: 'Book',       color: '#8b5cf6' },
                        { key: 'conference', label: 'Conference', color: '#f59e0b' },
                        { key: 'ipr',        label: 'IPR',        color: '#ef4444' },
                        { key: 'grants',     label: 'Grants',     color: '#10b981' },
                      ]}
                      height={380}
                    />

                    {/* Department-wise category table — click navigates to applicant page */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-800">Department-wise Research Output</h3>
                          <p className="mt-0.5 text-xs text-slate-400">Click any department to open its applicant analytics page with contributor details.</p>
                        </div>
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500">{departments.length} department{departments.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-left">
                              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Department</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-blue-500">Research</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-violet-500">Book</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-amber-500">Conference</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-red-500">IPR</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-emerald-500">Grants</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Total</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Approved</th>
                              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Incentive</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {departments.map((dept: any) => {
                              const fc = dept.filingCounts || {};
                              return (
                                <tr
                                  key={dept.departmentId}
                                  onClick={() => router.push(`/drd/analytics/applicant/departments/${dept.departmentId}?from=${fromDate}&to=${toDate}&category=${category}`)}
                                  className="cursor-pointer transition-colors hover:bg-slate-50"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-white shrink-0">
                                        <Layers3 className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-slate-900">{dept.departmentName}</p>
                                        <p className="text-xs text-slate-400">View applicants →</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-blue-600">{fc.research || 0}</td>
                                  <td className="px-4 py-3 text-right font-medium text-violet-600">{fc.book || 0}</td>
                                  <td className="px-4 py-3 text-right font-medium text-amber-600">{fc.conference || 0}</td>
                                  <td className="px-4 py-3 text-right font-medium text-red-600">{fc.ipr || 0}</td>
                                  <td className="px-4 py-3 text-right font-medium text-emerald-600">{fc.grants || 0}</td>
                                  <td className="px-4 py-3 text-right font-bold text-slate-900">{dept.totalApplications || 0}</td>
                                  <td className="px-4 py-3 text-right font-medium text-emerald-700">{dept.totalApproved || 0}</td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-900">₹{Number(dept.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Department highlights — click to filter contributor list below */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Layers3 className="w-4 h-4" />
                          Department Highlights
                        </h3>
                        <button
                          onClick={() => setSelectedDeptId('')}
                          className={`text-xs px-3 py-1 rounded-full transition-colors ${!selectedDeptId ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                          All departments
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {departments.map((dept: any) => {
                          const approvalPct =
                            dept.totalApplications > 0
                              ? ((dept.totalApproved / dept.totalApplications) * 100).toFixed(1)
                              : '0.0';
                          const isSelected = selectedDeptId ===
   dept.departmentId;
                          const fc = dept.filingCounts || {};
                          return (
                            <button
                              key={dept.departmentId}
                              onClick={() => setSelectedDeptId(isSelected ? '' : dept.departmentId)}
                              className={`rounded-xl border p-3 text-left transition-all ${
                                isSelected
                                  ? 'border-slate-900 bg-slate-50'
                                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <p className="truncate text-sm font-medium text-slate-800">{dept.departmentName}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                                {fc.research > 0 && <span className="rounded-full bg-blue-50 text-blue-600 px-2 py-0.5">R: {fc.research}</span>}
                                {fc.book > 0 && <span className="rounded-full bg-violet-50 text-violet-600 px-2 py-0.5">B: {fc.book}</span>}
                                {fc.conference > 0 && <span className="rounded-full bg-amber-50 text-amber-600 px-2 py-0.5">C: {fc.conference}</span>}
                                {fc.ipr > 0 && <span className="rounded-full bg-red-50 text-red-600 px-2 py-0.5">IPR: {fc.ipr}</span>}
                                {fc.grants > 0 && <span className="rounded-full bg-emerald-50 text-emerald-600 px-2 py-0.5">G: {fc.grants}</span>}
                              </div>
                              <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                                <span>{dept.totalApplications} total</span>
                                <span className="text-emerald-600 font-medium">{approvalPct}% approved</span>
                              </div>
                              <p className="mt-1 text-[10px] text-slate-400">{isSelected ? 'Showing contributors below' : 'Click to filter contributors'}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Monthly Trend + Category Breakdown — side by side */}
                <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                  {/* LEFT: Line chart */}
                  {data?.extensions?.monthlyTrend ? (
                    <TrendChartPanel
                      title="Filed vs Approved — Monthly"
                      data={(data.extensions.monthlyTrend as any[]).map((m) => ({
                        label: m.label || m.month,
                        values: {
                          filed: m.totalApplications || 0,
                          approved: m.approvedCount || 0,
                        },
                      }))}
                      keys={[
                        { key: 'filed', label: 'Total Filed', color: '#6366f1' },
                        { key: 'approved', label: 'Approved', color: '#10b981' },
                      ]}
                      height={320}
                    />
                  ) : <div />}

                  {/* RIGHT: Category breakdown pie charts */}
                  {categoryBreakdown && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Layers3 className="h-4 w-4 text-blue-500 shrink-0" />
                        <div>
                          <h2 className="text-base font-semibold text-slate-900 leading-tight">
                            {category === 'all' ? 'All Categories — Breakdown' :
                             category === 'research' ? 'Research — Indexing Breakdown' :
                             category === 'book' ? 'Books & Chapters — Type Breakdown' :
                             category === 'conference' ? 'Conference — Type Breakdown' :
                             category === 'ipr' ? 'IPR — Type Breakdown' :
                             'Grants — Funding Agency Breakdown'}
                          </h2>
                          <p className="text-xs text-slate-400">Distribution of submissions by publication type, indexing, and classification</p>
                        </div>
                      </div>
                      {category === 'all' && (
                        <div className="grid grid-cols-2 gap-4">
                          <AnalyticsPieChart title="Research Papers" subtitle="By indexing category" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                          <AnalyticsPieChart title="Books" subtitle="Authored & Edited" data={categoryBreakdown.book.filter((b: any) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                        </div>
                      )}
                      {category === 'research' && (
                        <div className="grid grid-cols-1 gap-4">
                          <AnalyticsPieChart title="Research Papers" subtitle="By indexing category (11 types)" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                        </div>
                      )}
                      {category === 'book' && (
                        <div className="grid grid-cols-2 gap-4">
                          <AnalyticsPieChart title="Books" subtitle="Authored & Edited" data={categoryBreakdown.book.filter((b: any) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                          <AnalyticsPieChart title="Book Chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b: any) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
                        </div>
                      )}
                      {category === 'conference' && (
                        <div className="grid grid-cols-2 gap-4">
                          <AnalyticsPieChart title="Conference Type" subtitle="National vs International" data={categoryBreakdown.conference} emptyMessage="No conference submissions" colorScheme="purple" />
                          {categoryBreakdown.conferenceSubtype.length > 0 && (
                            <AnalyticsPieChart title="Conference Sub-Type" subtitle="Paper category breakdown" data={categoryBreakdown.conferenceSubtype} emptyMessage="No subtype data" colorScheme="amber" />
                          )}
                        </div>
                      )}
                      {category === 'ipr' && (
                        <div className="grid grid-cols-1 gap-4">
                          <AnalyticsPieChart title="IPR by Type" subtitle="Patent, Copyright, Trademark, Design" data={categoryBreakdown.ipr} emptyMessage="No IPR submissions" colorScheme="amber" />
                        </div>
                      )}
                      {category === 'grants' && (
                        <div className="grid grid-cols-1 gap-4">
                          <AnalyticsPieChart title="Grants by Funding Agency" subtitle="Top agencies ranked by submission count" data={categoryBreakdown.grant} emptyMessage="No grant submissions" colorScheme="green" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ALL — bottom 4 pies, full page width */}
                {category === 'all' && categoryBreakdown && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <AnalyticsPieChart title="Book Chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b: any) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
                    <AnalyticsPieChart title="Conference Papers" subtitle="National vs International" data={categoryBreakdown.conference} emptyMessage="No conference submissions" colorScheme="amber" />
                    <AnalyticsPieChart title="IPR / Patent" subtitle="Patent, Copyright, Trademark, Design" data={categoryBreakdown.ipr} emptyMessage="No IPR submissions" colorScheme="blue" />
                    <AnalyticsPieChart title="Grants" subtitle="By funding agency" data={categoryBreakdown.grant} emptyMessage="No grant submissions" colorScheme="green" />
                  </div>
                )}

                {/* Research Pipeline — only when research category is selected */}
                {category === 'research' && (
                  <AnalyticsPipelineChart
                    title="Research Pipeline — Current Stage Distribution"
                    subtitle="How many research works from this school are in each stage: Writing → Communicated → Submitted → Accepted → Published."
                    stages={(
                      [
                        { key: 'writing',      label: 'Writing',      color: '#6366f1' },
                        { key: 'communicated', label: 'Communicated', color: '#f59e0b' },
                        { key: 'submitted',    label: 'Submitted',    color: '#3b82f6' },
                        { key: 'accepted',     label: 'Accepted',     color: '#10b981' },
                        { key: 'published',    label: 'Published',    color: '#059669' },
                        { key: 'rejected',     label: 'Rejected',     color: '#ef4444' },
                      ] as { key: TrackerStatus; label: string; color: string }[]
                    ).map((stage) => ({
                      key: stage.key,
                      label: stage.label,
                      count: trackerData?.statusFunnel?.find((s) => s.status === stage.key)?.count
                        ?? (stage.key === 'rejected' ? (trackerData?.kpis?.rejectedCount ?? 0) : 0),
                      color: stage.color,
                      textColor: '',
                    }))}
                  />
                )}

                {/* Applicant Leaderboard with pagination */}
                {visiblePeople.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Users className="w-4 h-4" />
                        Contributors
                        {selectedDeptId && (
                          <span className="text-xs font-normal text-slate-400 ml-1">
                            — {departments.find((d: any) => d.departmentId ===
   selectedDeptId)?.departmentName}
                          </span>
                        )}
                        <span className="text-slate-400 font-normal">({visiblePeople.length})</span>
                      </h3>
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
                          <tr className="bg-slate-50 text-left">
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">#</th>
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Name</th>
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Department</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Applications</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Approved</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Approval %</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Incentive</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {contributorSlice.map((p: any, i: number) => {
                            const rate =
                              p.totalApplications > 0
                                ? ((p.approvedCount / p.totalApplications) * 100).toFixed(0)
                                : '0';
                            return (
                              <tr key={p.personId} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-slate-400 font-medium">{contributorPage * CONTRIBUTOR_PAGE_SIZE + i + 1}</td>
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() =>
                                      router.push(`/drd/analytics/applicant/people/${p.personId}`)
                                    }
                                    className="font-medium text-slate-900 hover:text-sky-700 hover:underline text-left"
                                  >
                                    {p.applicantName}
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{p.departmentName}</td>
                                <td className="px-4 py-3 text-right font-medium">{p.totalApplications}</td>
                                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{p.approvedCount}</td>
                                <td className="px-4 py-3 text-right text-xs text-slate-500">{rate}%</td>
                                <td className="px-4 py-3 text-right font-medium">
                                  ₹{Number(p.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                        <span className="text-xs text-slate-500">
                          Showing {Math.min(contributorPage * CONTRIBUTOR_PAGE_SIZE + 1, visiblePeople.length)}–{Math.min((contributorPage + 1) * CONTRIBUTOR_PAGE_SIZE, visiblePeople.length)} of {visiblePeople.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setContributorPage((p) => Math.max(0, p - 1))}
                            disabled={contributorPage === 0}
                            className="rounded-lg p-1.5 disabled:opacity-30 hover:bg-slate-100 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-medium text-slate-600 px-2">
                            {contributorPage + 1} / {Math.max(contributorTotalPages, 1)}
                          </span>
                          <button
                            onClick={() => setContributorPage((p) => Math.min(contributorTotalPages - 1, p + 1))}
                            disabled={contributorPage >= contributorTotalPages - 1}
                            className="rounded-lg p-1.5 disabled:opacity-30 hover:bg-slate-100 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                  </div>
                )}
              </>
            )}
          </div>
        </AnalyticsShell>
      )}
    </ProtectedRoute>
  );
}
