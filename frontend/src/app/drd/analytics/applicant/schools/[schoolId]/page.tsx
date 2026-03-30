'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsResponse,
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
  AnalyticsPipelineChart,
} from '@/components/analytics';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers3,
  Loader2,
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
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status === 403;
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
              if (!existing.contributors.some((c) => c.personId === contributor.personId)) {
                existing.contributors.push(contributor);
              }
              (sub.authors || []).forEach((author) => {
                if (!existing.authors.some((item) => item.id === author.id || item.name === author.name)) {
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
              ) : submissionRows.length === 0 ? (
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
          {rows.length === 0 ? (
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
                        ₹{(p.totalIncentive || 0).toLocaleString('en-IN')}
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
  const { schoolId } = useParams<{ schoolId: string }>();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [data, setData] = useState<DrdAnalyticsResponse | null>(null);
  const [trackerData, setTrackerData] = useState<ProgressTrackerAnalyticsData | null>(null);
  const [allSchools, setAllSchools] = useState<{ value: string; label: string }[]>([]);
  const [kpiDrawer, setKpiDrawer] = useState<KpiDrilldownType | null>(null);
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [departmentId, setDepartmentId] = useState(searchParams.get('departmentId') || '');
  const [selectedDeptId, setSelectedDeptId] = useState('');

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
      const [applicantRes, trackerRes] = await Promise.allSettled([
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
      ]);
      if (applicantRes.status === 'fulfilled' && applicantRes.value?.data)
        setData(applicantRes.value.data);
      if (trackerRes.status === 'fulfilled' && trackerRes.value?.data)
        setTrackerData(trackerRes.value.data);
    } catch (err) {
      if (is403(err)) setAccessDenied(true);
      logger.error('Failed to load school analytics', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, fromDate, toDate, category, departmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      ? people.filter((p: any) => p.departmentId === selectedDeptId)
      : people),
    [people, selectedDeptId],
  );

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
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
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
              schoolId={schoolId}
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

          <div className="px-6 py-6 sm:px-8 lg:px-12 xl:px-16 space-y-6">

            {loading ? (
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
                                  onClick={() => router.push(`/drd/analytics/applicant?departmentId=${dept.departmentId}`)}
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
                                  <td className="px-4 py-3 text-right font-medium text-slate-900">₹{(dept.totalIncentive || 0).toLocaleString('en-IN')}</td>
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
                          const isSelected = selectedDeptId === dept.departmentId;
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

                {/* Charts — Filed vs Approved (monthly) + Progress Tracker stage pipeline */}
                {data?.extensions?.monthlyTrend && (
                  <div className="grid gap-6 xl:grid-cols-2">
                    {/* Chart 1: Filed vs Approved per month */}
                    <AnalyticsBarChart
                      title="Filed vs Approved — Monthly"
                      subtitle="Total submissions filed each month versus those approved."
                      data={(data.extensions.monthlyTrend as any[]).map((m) => ({
                        label: m.label || m.month,
                        values: {
                          filed: m.totalApplications || 0,
                          approved: m.approvedCount || 0,
                        },
                      }))}
                      keys={[
                        { key: 'filed', label: 'Filed', color: '#6366f1' },
                        { key: 'approved', label: 'Approved', color: '#10b981' },
                      ]}
                      height={320}
                    />

                    {/* Chart 2: Progress Tracker — stage pipeline for this school */}
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
                  </div>
                )}

                {/* Applicant Leaderboard */}
                {visiblePeople.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Users className="w-4 h-4" />
                        Contributors
                        {selectedDeptId && (
                          <span className="text-xs font-normal text-slate-400 ml-1">
                            — {departments.find((d: any) => d.departmentId === selectedDeptId)?.departmentName}
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
                          {visiblePeople.slice(0, 100).map((p: any, i: number) => {
                            const rate =
                              p.totalApplications > 0
                                ? ((p.approvedCount / p.totalApplications) * 100).toFixed(0)
                                : '0';
                            return (
                              <tr key={p.personId} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
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
                                  ₹{(p.totalIncentive || 0).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
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
