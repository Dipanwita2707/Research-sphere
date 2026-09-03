'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsResponse,
  type DrdMemberPerformanceResponse,
} from '@/features/ipr-management/services/drdAnalytics.service';
import { AnalyticsHero, AnalyticsShell, AnalyticsFilterBar, TrendChartPanel, AnalyticsBarChart } from '@/components/analytics';
import ResearchGlobe from '@/components/ResearchGlobe';
import {
  AlertCircle,
  BarChart3,
  Users,
  CheckCircle2,
  Clock3,
  Layers3,
  ArrowRight,
  RefreshCw,
  GraduationCap,
  Sparkles,
  Globe2,
  FileText,
  Award,
  Timer,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';

const CATEGORY_OPTIONS = [
  { value: 'research', label: 'Research' },
  { value: 'book', label: 'Book / Chapter' },
  { value: 'conference', label: 'Conference' },
  { value: 'ipr', label: 'IPR / Patent' },
  { value: 'grants', label: 'Grants' },
];

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

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
  if (err && typeof err ===
   'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status ===
   403;
  }
  return false;
}

export default function DrdAnalyticsOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [applicantData, setApplicantData] = useState<DrdAnalyticsResponse | null>(null);
  const [drdData, setDrdData] = useState<DrdMemberPerformanceResponse | null>(null);
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [category, setCategory] = useState('all');
  const [affiliations, setAffiliations] = useState<{ name: string; count: number }[]>([]);

  const fetchData = useCallback(async () => {
    const cacheKey = `${CACHE_KEY}_${fromDate}_${toDate}_${category}`;

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

      writeCache(cacheKey, { app: newApp, drd: newDrd });

      // Lazy-load affiliations after main paint
      drdAnalyticsService.getAffiliations(filters)
        .then((res) => { if (Array.isArray(res?.data)) setAffiliations(res.data); })
        .catch(() => {});

    } catch (err) {
      logger.error('Failed to load overview analytics', err);
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

  return (
    <ProtectedRoute>
      {accessDenied ? (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center border dark:border-gray-700">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You do not have permission to view DRD Analytics. Contact your administrator to request
              <strong> Applicant Analytics</strong> or <strong>DRD Member Analytics</strong> access.
            </p>
            <button onClick={() => router.push('/dashboard')} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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
              { label: 'Applications', value: String(appKpis?.totalApplications || 0) },
              { label: 'Approved', value: String(appKpis?.approvedCount || 0) },
              { label: 'Reviewers', value: String(drdKpis?.totalReviewers || 0) },
              { label: 'Pending Reviews', value: String(drdKpis?.totalPending || 0) },
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-6 animate-pulse h-[420px]">
                  <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-40 mb-6" />
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} className="flex justify-between mb-4">
                      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-28" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-12" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* ── NEW 2-COLUMN OVERVIEW ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* LEFT: light intelligence panel */}
                <div className="relative rounded-3xl overflow-hidden flex flex-col bg-white border border-slate-200/80 shadow-sm">
                  {/* subtle gradient accent */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl"
                    style={{ background: 'radial-gradient(ellipse 80% 40% at 0% 0%, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />

                  {/* header */}
                  <div className="relative z-10 px-7 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                        <Activity className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide">Research Intelligence</h2>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Live university metrics</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-700/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                      LIVE
                    </span>
                  </div>

                  <div className="relative z-10 flex-1 px-7 py-5 space-y-5">
                    {/* Applicant Submissions block */}
                    {appKpis && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Applicant Submissions</span>
                          <button
                            onClick={() => router.push('/drd/analytics/applicant')}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            View Details <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {[
                            { label: 'Total Applications', value: appKpis.totalApplications || 0, accent: '#818cf8' },
                            { label: 'Research', value: appKpis.totalResearchSubmissions || 0, accent: '#38bdf8' },
                            { label: 'IPR / Patent', value: appKpis.totalPatentSubmissions || 0, accent: '#f87171' },
                            { label: 'Grants', value: appKpis.totalGrantSubmissions || 0, accent: '#34d399' },
                            { label: 'Approved', value: appKpis.approvedCount || 0, accent: '#4ade80' },
                            { label: 'Approved Amount', value: `₹${(appKpis.totalIncentive || 0).toLocaleString('en-IN')}`, accent: '#fbbf24' },
                          ].map((item) => (
                            <div key={item.label} className="flex items-center justify-between py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg px-1 transition-colors">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.accent, boxShadow: `0 0 8px ${item.accent}70` }} />
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{item.label}</span>
                              </div>
                              <span className="text-[15px] font-bold tabular-nums" style={{ color: item.accent }}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Divider */}
                    {appKpis && drdKpis && (
                      <div className="border-t border-slate-100 dark:border-slate-700" />
                    )}

                    {/* DRD Review Performance block */}
                    {drdKpis && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">DRD Review Performance</span>
                          <button
                            onClick={() => router.push('/drd/analytics/drd-member')}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                          >
                            View Details <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                          {[
                            { label: 'Reviewers', value: drdKpis.totalReviewers || 0, accent: '#a78bfa' },
                            { label: 'Total Assigned', value: drdKpis.totalAssigned || 0, accent: '#38bdf8' },
                            { label: 'Reviewed', value: drdKpis.totalReviewed || 0, accent: '#4ade80' },
                            { label: 'Pending', value: drdKpis.totalPending || 0, accent: '#fb923c' },
                            { label: 'Avg Turnaround', value: `${(drdKpis.avgTurnaroundHours || 0).toFixed(1)}h`, accent: '#fbbf24' },
                            { label: 'Median', value: `${(drdKpis.medianTurnaroundHours || 0).toFixed(1)}h`, accent: '#94a3b8' },
                          ].map((item) => (
                            <div key={item.label} className="flex items-center justify-between py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded-lg px-1 transition-colors">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.accent, boxShadow: `0 0 8px ${item.accent}70` }} />
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{item.label}</span>
                              </div>
                              <span className="text-[15px] font-bold tabular-nums" style={{ color: item.accent }}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: 3D Globe */}
                <div className="relative rounded-3xl overflow-hidden flex flex-col border border-slate-700/60 shadow-2xl" style={{ background: '#020d1e' }}>
                  {/* Starfield SVG */}
                  <svg className="pointer-events-none absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    {([[5,8,0.9,0.8],[12,3,0.6,0.6],[22,15,1.1,0.9],[34,7,0.7,0.7],[46,12,0.9,0.8],[59,3,0.6,0.6],[71,10,1.0,0.5],[83,6,0.8,0.9],[92,18,0.7,0.7],[97,8,0.9,0.8],[4,27,0.6,0.6],[16,33,0.9,0.7],[28,21,0.7,0.9],[40,30,1.1,0.5],[53,24,0.8,0.8],[66,37,0.6,0.6],[78,26,0.9,0.9],[89,34,0.7,0.7],[95,30,1.0,0.8],[9,46,0.6,0.6],[20,54,0.8,0.9],[32,43,0.9,0.7],[44,60,0.6,0.8],[57,49,1.1,0.6],[69,57,0.7,0.9],[81,45,0.9,0.7],[91,53,0.6,0.8],[3,65,1.0,0.6],[15,74,0.7,0.9],[26,70,0.9,0.7],[38,77,0.6,0.8],[50,64,0.8,0.6],[62,80,1.1,0.9],[74,67,0.7,0.7],[86,76,0.9,0.8],[94,64,0.6,0.6],[8,87,0.8,0.9],[19,93,1.0,0.7],[31,85,0.6,0.8],[43,90,0.9,0.6],[55,84,0.7,0.9],[67,94,1.1,0.7],[79,88,0.8,0.8],[88,96,0.6,0.6],[97,91,0.9,0.9],[11,19,0.7,0.5],[24,40,1.0,0.7],[36,57,0.6,0.6],[48,35,0.8,0.8],[60,69,0.9,0.9],[72,50,0.6,0.7],[84,61,0.7,0.8],[5,80,1.0,0.6],[17,57,0.6,0.9],[29,49,0.8,0.7],[41,23,0.9,0.8],[54,86,0.7,0.6],[64,15,0.6,0.9],[76,79,1.0,0.7],[87,20,0.8,0.8],[96,75,0.6,0.6],[13,99,0.9,0.9],[25,5,0.7,0.7],[37,95,1.0,0.5],[49,18,0.6,0.8],[61,91,0.8,0.9],[73,32,0.9,0.6],[85,99,0.6,0.7],[93,46,0.7,0.8]] as [number,number,number,number][]).map(([cx,cy,r,o],i) => (
                      <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r={r} fill="white" opacity={o} />
                    ))}
                  </svg>
                  {/* Nebula glow */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl"
                    style={{ background: 'radial-gradient(ellipse 65% 55% at 65% 55%, rgba(56,189,248,0.07) 0%, transparent 60%), radial-gradient(ellipse 50% 45% at 25% 25%, rgba(99,102,241,0.09) 0%, transparent 60%)' }} />

                  {/* header */}
                  <div className="relative z-10 px-7 pt-6 pb-4 border-b border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
                        style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
                        <Globe2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white tracking-wide">Global Research Network</h2>
                        <p className="text-[10px] text-slate-400 mt-0.5">{affiliations.length > 0 ? `${affiliations.length} real co-author affiliations` : 'Live arc connections to partner institutions'}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-[9px] font-semibold">
                      <span className="flex items-center gap-1 text-orange-400 bg-orange-500/15 px-2 py-1 rounded-full border border-orange-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />ResearchSphere Univ.
                      </span>
                      <span className="flex items-center gap-1 text-indigo-400 bg-indigo-500/15 px-2 py-1 rounded-full border border-indigo-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />Partners
                      </span>
                    </div>
                  </div>

                  {/* globe */}
                  <div className="relative z-10 flex-1 flex items-center justify-center min-h-[640px]">
                    <ResearchGlobe width={800} height={680} affiliations={affiliations} />
                  </div>

                  {/* region breakdown */}
                  <div className="relative z-10 px-7 pb-5 pt-3 border-t border-slate-700/50">
                    <div className="grid grid-cols-4 gap-3 text-center">
                      {[
                        { label: 'USA/Canada', count: 4, color: '#60a5fa', bg: 'bg-blue-500/10 border-blue-500/25' },
                        { label: 'Europe', count: 6, color: '#a78bfa', bg: 'bg-violet-500/10 border-violet-500/25' },
                        { label: 'Asia-Pacific', count: 6, color: '#34d399', bg: 'bg-emerald-500/10 border-emerald-500/25' },
                        { label: 'Others', count: 4, color: '#fbbf24', bg: 'bg-amber-500/10 border-amber-500/25' },
                      ].map((r) => (
                        <div key={r.label} className={`rounded-xl py-2 border ${r.bg}`}>
                          <p className="text-lg font-bold" style={{ color: r.color }}>{r.count}</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">{r.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* END PREMIUM 2-COLUMN OVERVIEW */}

              {/* School Comparison â€” category-level bar chart + table */}
              {applicantData && schoolRows.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <GraduationCap className="w-4 h-4" />
                      School Comparison â€” Category Breakdown
                      <span className="text-xs font-normal text-slate-400">
                        ({schoolRows.length} school{schoolRows.length !== 1 ? 's' : ''} in scope)
                      </span>
                    </h2>
                  </div>

                  {/* Bar chart â€” each school shows Research / Book / Conference / IPR / Grants */}
                  <AnalyticsBarChart
                    title="School-wise Category Comparison"
                    subtitle="Publications filed per category across every assigned school. Click a row in the table below to drill into departments."
                    data={schoolRows.slice(0, 12).map((s: any) => ({
                      label: s.schoolName,
                      values: {
                        research:   s.filingCounts?.research   ?? 0,
                        book:       s.filingCounts?.book       ?? 0,
                        conference: s.filingCounts?.conference ?? 0,
                        ipr:        s.filingCounts?.ipr        ?? 0,
                        grants:     s.filingCounts?.grants     ?? 0,
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

                  {/* School-wise category table */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">School-wise Research Output</h3>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Click any row to open that school&apos;s department comparison &amp; contributor details.</p>
                      </div>
                      <span className="rounded-full bg-slate-50 dark:bg-slate-700 px-3 py-1 text-xs text-slate-500 dark:text-slate-400">{schoolRows.length} school{schoolRows.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-gray-700 text-left">
                            <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">School</th>
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
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {schoolRows.map((school: any) => {
                            const fc = school.filingCounts || {};
                            return (
                              <tr
                                key={school.schoolId}
                                onClick={() => router.push(`/drd/analytics/applicant/schools/${school.schoolId}?from=${fromDate}&to=${toDate}&category=${category}`)}
                                className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shrink-0">
                                      <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-slate-900 dark:text-slate-100">{school.schoolName}</p>
                                      <p className="text-xs text-slate-400 dark:text-slate-500">View departments â†’</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-blue-600">{fc.research || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-violet-600">{fc.book || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-amber-600">{fc.conference || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-red-600">{fc.ipr || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600">{fc.grants || 0}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">{school.totalApplications || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-700">{school.totalApproved || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">₹{(school.totalIncentive || 0).toLocaleString('en-IN')}</td>
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
                    { key: 'total', label: 'Submissions', color: '#6366f1' },
                    { key: 'approved', label: 'Approved', color: '#f59e0b' },
                  ]}
                />
              )}

              {/* Quick Nav Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => router.push('/drd/analytics/applicant')}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Applicant Analytics</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Submission trends, school/department breakdowns, applicant leaderboard</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-slate-700 transition-colors" />
                  </div>
                </button>
                <button
                  onClick={() => router.push('/drd/analytics/drd-member')}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">DRD Member Analytics</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Reviewer performance, turnaround times, decision distribution</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-slate-700 transition-colors" />
                  </div>
                </button>
                <button
                  onClick={() => router.push('/drd/analytics/progress-tracker')}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">Progress Tracker Analytics</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Research pipeline stages, active researchers &amp; category breakdown</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-slate-700 transition-colors" />
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </AnalyticsShell>
      )}
    </ProtectedRoute>
  );
}

