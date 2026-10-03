'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsResponse,
  type DrdMemberPerformanceResponse,
  type CollaborationNetwork as Network,
} from '@/features/ipr-management/services/drdAnalytics.service';
import { AnalyticsHero, AnalyticsShell, AnalyticsFilterBar, TrendChartPanel, AnalyticsBarChart } from '@/components/analytics';
import { categoryColor, ui } from '@/components/analytics/theme';
import CollaborationNetwork from '@/components/analytics/CollaborationNetwork';
import {
  AlertCircle,
  BarChart3,
  Users,
  CheckCircle2,
  Clock3,
  ArrowRight,
  RefreshCw,
  GraduationCap,
  Sparkles,
  FileText,
  Activity,
  Layers3,
  Timer,
  XCircle,
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';
import { useAuthStore } from '@/shared/auth/authStore';

const CATEGORY_OPTIONS = [
  { value: 'research', label: 'Research' },
  { value: 'book', label: 'Book / Chapter' },
  { value: 'conference', label: 'Conference' },
  { value: 'ipr', label: 'IPR / Patent' },
  { value: 'grants', label: 'Grants' },
];

/** One colour per category, shared by the mix bars, the school chart and the table. */
const CATEGORY_SERIES = [
  { key: 'research',   label: 'Research',       kpi: 'totalResearchSubmissions',   color: categoryColor('research') },
  { key: 'book',       label: 'Book / Chapter', kpi: 'totalBookSubmissions',       color: categoryColor('book') },
  { key: 'conference', label: 'Conference',     kpi: 'totalConferenceSubmissions', color: categoryColor('conference') },
  { key: 'ipr',        label: 'IPR / Patent',   kpi: 'totalPatentSubmissions',     color: categoryColor('ipr') },
  { key: 'grants',     label: 'Grants',         kpi: 'totalGrantSubmissions',      color: categoryColor('grants') },
] as const;

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

const CACHE_KEY = 'drd_overview_cache';
const CACHE_TTL = 90_000; // 90 s

function readCache(key: string) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function writeCache(key: string, data: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function is403(err: unknown): boolean {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status === 403;
  }
  return false;
}

function PanelHeader({
  icon, title, subtitle, onViewDetails,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onViewDetails?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-6 py-4 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber`}>
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-gray-100">{title}</h2>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          View details <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function StatTile({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/60 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-stone-900 dark:text-white">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-stone-400 dark:text-gray-500">{hint}</div>}
    </div>
  );
}

export default function DrdAnalyticsOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [applicantData, setApplicantData] = useState<DrdAnalyticsResponse | null>(null);
  const [drdData, setDrdData] = useState<DrdMemberPerformanceResponse | null>(null);
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [category, setCategory] = useState('all');
  const [network, setNetwork] = useState<Network | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);

  const fetchNetwork = useCallback(async () => {
    setNetworkLoading(true);
    try {
      const res = await drdAnalyticsService.getAffiliations({ from: fromDate, to: toDate, category });
      if (res?.data && Array.isArray(res.data.partners)) setNetwork(res.data);
    } catch (err) {
      logger.warn('Failed to load collaboration network', err);
    } finally {
      setNetworkLoading(false);
    }
  }, [fromDate, toDate, category]);

  // Keep the network live: refetch every 5 minutes (matches the server cache window).
  useEffect(() => {
    fetchNetwork();
    const id = window.setInterval(fetchNetwork, 5 * 60_000);
    return () => window.clearInterval(id);
  }, [fetchNetwork]);

  const fetchData = useCallback(async () => {
    // Scope the cache to the viewer and (for superadmins) the impersonated university,
    // so switching user or tenant in the same tab never shows the previous one's numbers.
    let tenantScope = '';
    try { tenantScope = localStorage.getItem('superadmin-impersonate-university-id') || ''; } catch {}
    const cacheKey = `${CACHE_KEY}_${useAuthStore.getState().user?.id || 'anon'}_${tenantScope}_${fromDate}_${toDate}_${category}`;

    // --- Show cached data immediately, no spinner ---
    const cached = readCache(cacheKey);
    if (cached) {
      setApplicantData(cached.app);
      setDrdData(cached.drd);
      setLoading(false);
      // still refresh in background silently
    } else {
      setLoading(true);
    }
    setLoadFailed(false);

    try {
      const filters = { from: fromDate, to: toDate, category };

      // Fire main 2 calls first for fast visible paint
      const [appRes, drdRes] = await Promise.allSettled([
        drdAnalyticsService.getApplicantAnalytics(filters),
        drdAnalyticsService.getDrdMemberPerformance(filters),
      ]);

      const app403 = appRes.status === 'rejected' && is403(appRes.reason);
      const drd403 = drdRes.status === 'rejected' && is403(drdRes.reason);
      if (app403 && drd403) { setAccessDenied(true); return; }

      let newApp = cached?.app ?? null;
      let newDrd = cached?.drd ?? null;

      if (appRes.status === 'fulfilled' && appRes.value?.data) {
        newApp = appRes.value.data;
        setApplicantData(newApp);
      }
      if (drdRes.status === 'fulfilled' && drdRes.value?.data) {
        newDrd = drdRes.value.data;
        setDrdData(newDrd);
      }

      if (!newApp && !newDrd) setLoadFailed(true);
      else setUpdatedAt(new Date());

      writeCache(cacheKey, { app: newApp, drd: newDrd });

    } catch (err) {
      logger.error('Failed to load overview analytics', err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, category]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const appKpis = applicantData?.kpis;
  const drdKpis = drdData?.kpis;
  const schoolRows = React.useMemo(
    () => ((applicantData?.schoolWise || []) as any[])
      .slice()
      .sort((left, right) => right.totalApplications - left.totalApplications),
    [applicantData?.schoolWise],
  );

  const totalApps = appKpis?.totalApplications || 0;
  const approved = appKpis?.approvedCount || 0;
  const approvalRate = pct(approved, totalApps);
  const assigned = drdKpis?.totalAssigned || 0;
  const reviewed = drdKpis?.totalReviewed || 0;
  const pending = drdKpis?.totalPending || 0;
  const reviewProgress = pct(reviewed, reviewed + pending);
  const decided = (drdKpis?.approvedCount || 0) + (drdKpis?.rejectedCount || 0);
  const maxSchoolTotal = schoolRows[0]?.totalApplications || 0;

  return (
    <ProtectedRoute>
      {accessDenied ? (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#faf8f6] dark:bg-gray-900">
          <div className={`max-w-md w-full p-8 text-center ${ui.card}`}>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-stone-900 dark:text-white mb-3">Access denied</h2>
            <p className="text-sm text-stone-600 dark:text-gray-400 mb-6">
              You do not have permission to view DRD Analytics. Contact your administrator to request
              <strong> Applicant Analytics</strong> or <strong>DRD Member Analytics</strong> access.
            </p>
            <button onClick={() => router.push('/dashboard')} className={ui.btnPrimary}>
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : (
      <AnalyticsShell>
          <AnalyticsHero
            title="DRD Analytics Overview"
            description="Unified command center for applicant submissions, DRD review performance, and research progress tracking across the university."
            eyebrow="Cross-Module Intelligence"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            actions={(
              <div className="flex items-center gap-3">
                {updatedAt && (
                  <span className="hidden text-xs text-white/75 sm:inline">
                    Updated {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className={ui.btnSecondary}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            )}
            chips={[
              { label: 'Applications', value: totalApps.toLocaleString('en-IN') },
              { label: 'Approval Rate', value: totalApps ? `${approvalRate.toFixed(0)}%` : '—' },
              { label: 'Approved Amount', value: inr(appKpis?.totalIncentive || 0) },
              { label: 'Pending Reviews', value: pending.toLocaleString('en-IN') },
            ]}
          />

          {/* Filters */}
          <AnalyticsFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            category={category}
            onCategoryChange={setCategory}
            categoryOptions={CATEGORY_OPTIONS}
            onApply={fetchData}
            onReset={() => {
              setFromDate(isoDate(new Date(Date.now() - 365 * 86400e3)));
              setToDate(isoDate(new Date()));
              setCategory('all');
            }}
          />

        <div className="px-4 py-5 sm:px-6 lg:px-8 space-y-6">

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[0, 1].map((i) => (
                  <div key={i} className="rounded-xl border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse h-[260px]">
                    <div className="h-4 bg-stone-100 dark:bg-gray-700 rounded w-40 mb-6" />
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="h-3 bg-stone-100 dark:bg-gray-700 rounded mb-5" style={{ width: `${90 - j * 15}%` }} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-stone-200 dark:bg-gray-800 animate-pulse h-[460px]" />
            </div>
          ) : loadFailed ? (
            <div className="rounded-xl border border-stone-200 bg-white p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
              <h2 className="mt-4 text-base font-semibold text-stone-900 dark:text-white">Couldn&apos;t load analytics</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">The analytics service didn&apos;t respond. Check your connection and try again.</p>
              <button
                onClick={fetchData}
                className={`mt-5 ${ui.btnPrimary}`}
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                  {/* Submission mix */}
                  {appKpis && (
                    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                      <PanelHeader
                        icon={<FileText className="h-4 w-4" />}
                        title="Applicant Submissions"
                        subtitle="Share of all applications filed in the selected period"
                        onViewDetails={() => router.push('/drd/analytics/applicant')}
                      />
                      <div className="grid gap-6 p-6 md:grid-cols-[1fr_200px]">
                        <div className="space-y-4">
                          {/* Stacked share bar */}
                          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                            {totalApps > 0 && CATEGORY_SERIES.map((c) => {
                              const v = appKpis[c.kpi] || 0;
                              return v > 0 ? (
                                <div key={c.key} style={{ width: `${pct(v, totalApps)}%`, backgroundColor: c.color }} title={`${c.label}: ${v}`} />
                              ) : null;
                            })}
                          </div>
                          <ul className="space-y-3">
                            {CATEGORY_SERIES.map((c) => {
                              const v = appKpis[c.kpi] || 0;
                              const share = pct(v, totalApps);
                              return (
                                <li key={c.key} className="grid grid-cols-[120px_1fr_64px] items-center gap-3 text-sm">
                                  <span className="flex items-center gap-2 text-stone-600 dark:text-gray-300">
                                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                                    {c.label}
                                  </span>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${share}%`, backgroundColor: c.color }} />
                                  </div>
                                  <span className={`text-right tabular-nums ${v ? 'font-semibold text-stone-900 dark:text-white' : 'text-stone-400 dark:text-gray-500'}`}>
                                    {v}
                                    <span className="ml-1 text-[11px] font-normal text-stone-400">{totalApps ? `${share.toFixed(0)}%` : ''}</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                          <StatTile
                            icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                            label="Approved"
                            value={approved.toLocaleString('en-IN')}
                            hint={totalApps ? `${approvalRate.toFixed(0)}% of ${totalApps} applications` : 'No applications yet'}
                          />
                          <StatTile
                            icon={<Users className="h-3.5 w-3.5 text-stone-500" />}
                            label="Applicants"
                            value={(appKpis.totalPeople || 0).toLocaleString('en-IN')}
                            hint={`${inr(appKpis.totalIncentive || 0)} approved`}
                          />
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Review pipeline */}
                  {drdKpis && (
                    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                      <PanelHeader
                        icon={<Activity className="h-4 w-4" />}
                        title="DRD Review Pipeline"
                        subtitle={`${drdKpis.totalReviewers || 0} reviewer${drdKpis.totalReviewers === 1 ? '' : 's'} · ${assigned} assignment${assigned === 1 ? '' : 's'}`}
                        onViewDetails={() => router.push('/drd/analytics/drd-member')}
                      />
                      <div className="space-y-5 p-6">
                        {reviewed + pending > 0 ? (
                          <div>
                            <div className="mb-2 flex items-baseline justify-between text-sm">
                              <span className="font-medium text-stone-700 dark:text-gray-200">
                                {reviewProgress.toFixed(0)}% of assigned reviews completed
                              </span>
                              <span className="text-xs text-stone-500 dark:text-gray-400 tabular-nums">{reviewed} done · {pending} pending</span>
                            </div>
                            <div className="flex h-2.5 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/30">
                              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${reviewProgress}%` }} />
                            </div>
                          </div>
                        ) : (
                          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-3 text-sm text-stone-500 dark:border-gray-700 dark:text-gray-400">
                            No reviews have been assigned in this period.
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <StatTile icon={<Clock3 className="h-3.5 w-3.5 text-amber-500" />} label="Pending" value={String(pending)} hint={pending ? 'Awaiting a reviewer' : 'Queue is clear'} />
                          <StatTile icon={<Timer className="h-3.5 w-3.5 text-stone-500" />} label="Avg turnaround" value={reviewed ? `${(drdKpis.avgTurnaroundHours || 0).toFixed(1)}h` : '—'} hint={reviewed ? `Median ${(drdKpis.medianTurnaroundHours || 0).toFixed(1)}h` : 'No completed reviews'} />
                          <StatTile icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />} label="Approved" value={String(drdKpis.approvedCount || 0)} hint={decided ? `${pct(drdKpis.approvedCount || 0, decided).toFixed(0)}% of decisions` : undefined} />
                          <StatTile icon={<XCircle className="h-3.5 w-3.5 text-rose-500" />} label="Rejected" value={String(drdKpis.rejectedCount || 0)} hint={decided ? `${pct(drdKpis.rejectedCount || 0, decided).toFixed(0)}% of decisions` : undefined} />
                        </div>
                      </div>
                    </section>
                  )}
              </div>

              <CollaborationNetwork network={network} loading={networkLoading} onRefresh={fetchNetwork} />

              {/* School comparison: category-level bar chart + table */}
              {applicantData && schoolRows.length > 0 && (
                <section className="space-y-6">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-700 dark:text-gray-300">
                    <GraduationCap className="w-4 h-4" />
                    School Comparison
                    <span className="text-xs font-normal text-stone-400">
                      ({schoolRows.length} school{schoolRows.length !== 1 ? 's' : ''} in scope)
                    </span>
                  </h2>

                  <AnalyticsBarChart
                    title="School-wise Category Comparison"
                    subtitle={schoolRows.length > 12
                      ? 'Top 12 schools by applications. The table below lists every school; click a bar or row to drill in.'
                      : 'Applications per school, split by category. Click a bar or a table row to see that school’s departments.'}
                    data={schoolRows.slice(0, 12).map((s: any) => ({
                      label: s.schoolName,
                      values: Object.fromEntries(CATEGORY_SERIES.map((c) => [c.key, s.filingCounts?.[c.key] ?? 0])),
                    }))}
                    keys={CATEGORY_SERIES.map((c) => ({ key: c.key, label: c.label, color: c.color }))}
                    height={360}
                    stacked
                    onBarClick={(_, i) => {
                      const school = schoolRows[i];
                      if (school) router.push(`/drd/analytics/applicant/schools/${school.schoolId}?from=${fromDate}&to=${toDate}&category=${category}`);
                    }}
                  />

                  <div className="rounded-xl border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-stone-100 dark:border-gray-700 px-5 py-4">
                      <div>
                        <h3 className="text-sm font-semibold text-stone-800 dark:text-gray-200">School-wise Research Output</h3>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">Click a row to open that school&apos;s department comparison and contributors.</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-stone-50 dark:bg-gray-700/60 text-left">
                            <th className="sticky left-0 bg-stone-50 dark:bg-gray-700 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500">School</th>
                            {CATEGORY_SERIES.map((c) => (
                              <th key={c.key} className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: c.color }} />
                                  {c.key === 'ipr' ? 'IPR' : c.key === 'book' ? 'Book' : c.label}
                                </span>
                              </th>
                            ))}
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500 min-w-[160px]">Total</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-stone-500">Approved</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-stone-500">Incentive</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                          {schoolRows.map((school: any) => {
                            const fc = school.filingCounts || {};
                            const total = school.totalApplications || 0;
                            return (
                              <tr
                                key={school.schoolId}
                                onClick={() => router.push(`/drd/analytics/applicant/schools/${school.schoolId}?from=${fromDate}&to=${toDate}&category=${category}`)}
                                className="group cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/50"
                              >
                                <td className="sticky left-0 bg-white px-4 py-3 group-hover:bg-stone-50 dark:bg-gray-800 dark:group-hover:bg-gray-700">
                                  <p className="font-medium text-stone-900 dark:text-gray-100">{school.schoolName}</p>
                                </td>
                                {CATEGORY_SERIES.map((c) => (
                                  <td key={c.key} className={`px-4 py-3 text-right tabular-nums ${fc[c.key] ? 'font-medium text-stone-800 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>
                                    {fc[c.key] || 0}
                                  </td>
                                ))}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="w-8 text-right font-bold tabular-nums text-stone-900 dark:text-gray-100">{total}</span>
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                                      <div className="h-full rounded-full bg-stone-400 dark:bg-gray-500" style={{ width: `${pct(total, maxSchoolTotal)}%` }} />
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">{school.totalApproved || 0}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-stone-900 dark:text-gray-100">{inr(school.totalIncentive || 0)}</td>
                                <td className="pr-4 text-stone-300 group-hover:text-stone-600 dark:text-gray-600 dark:group-hover:text-gray-300">
                                  <ArrowRight className="h-4 w-4" />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {/* Monthly Trend */}
              {applicantData?.extensions?.monthlyTrend && (
                <TrendChartPanel
                  title="Monthly Submission Trend"
                  data={(applicantData.extensions.monthlyTrend as any[]).map((m) => ({
                    label: m.label || m.month,
                    values: {
                      total: m.totalApplications || 0,
                      approved: m.approvedCount || 0,
                    },
                  }))}
                  keys={[
                    { key: 'total', label: 'Submissions' },
                    { key: 'approved', label: 'Approved' },
                  ]}
                />
              )}

              {/* Quick Nav Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { href: '/drd/analytics/applicant', title: 'Applicant Analytics', body: 'Submission trends, school and department breakdowns, applicant leaderboard', icon: <BarChart3 className="h-5 w-5" />, tint: 'bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber' },
                  { href: '/drd/analytics/drd-member', title: 'DRD Member Analytics', body: 'Reviewer performance, turnaround times, decision distribution', icon: <Users className="h-5 w-5" />, tint: 'bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber' },
                  { href: '/drd/analytics/progress-tracker', title: 'Progress Tracker Analytics', body: 'Research pipeline stages, active researchers and category breakdown', icon: <Layers3 className="h-5 w-5" />, tint: 'bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber' },
                ].map((card) => (
                  <button
                    key={card.href}
                    onClick={() => router.push(card.href)}
                    className="group flex items-start gap-4 rounded-xl border border-stone-200 bg-white p-5 text-left shadow-sm transition-all hover:-transtone-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.tint}`}>{card.icon}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-stone-900 dark:text-gray-100">{card.title}</h3>
                      <p className="mt-1 text-sm text-stone-500 dark:text-gray-400">{card.body}</p>
                    </div>
                    <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-stone-300 transition-all group-hover:transtone-x-0.5 group-hover:text-stone-700 dark:group-hover:text-gray-200" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </AnalyticsShell>
      )}
    </ProtectedRoute>
  );
}
