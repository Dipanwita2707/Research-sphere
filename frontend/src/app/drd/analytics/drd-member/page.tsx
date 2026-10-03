'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdMemberPerformanceResponse,
} from '@/features/ipr-management/services/drdAnalytics.service';
import {
  AnalyticsHero,
  AnalyticsShell,
  KpiCardGrid,
  AnalyticsFilterBar,
  ReviewerLeaderboardTable,
  TrendChartPanel,
} from '@/components/analytics';
import { seriesColors, ui } from '@/components/analytics/theme';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Printer,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
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

function fmtHours(hrs: number | null | undefined) {
  if (hrs == null) return '—';
  if (hrs < 1) return `${Math.round(hrs * 60)}m`;
  if (hrs < 24) return `${Math.round(hrs)}h`;
  return `${(hrs / 24).toFixed(1)}d`;
}

function is403(err: unknown): boolean {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status === 403;
  }
  return false;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
}

/** Decision series share one palette mapping across every chart on the page. */
const DECISION_KEYS = ['approved', 'rejected', 'revisions', 'pending'] as const;
const DECISION_COLORS = seriesColors([...DECISION_KEYS]) as Record<(typeof DECISION_KEYS)[number], string>;

/**
 * Turnaround state, same thresholds as the reviewer drill-down: under a day is
 * fast, under three days needs watching, beyond that is slow. Always rendered
 * with its text label.
 */
function turnaroundStatus(hrs: number | null | undefined) {
  if (hrs == null) return null;
  if (hrs < 24) return { label: 'Fast', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
  if (hrs < 72) return { label: 'Watch', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  return { label: 'Slow', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
}

function TurnaroundValue({ hrs }: { hrs: number | null | undefined }) {
  const s = turnaroundStatus(hrs);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm font-semibold tabular-nums text-stone-900 dark:text-white">{fmtHours(hrs)}</span>
      {s && <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>}
    </span>
  );
}

/** Thin 100% bar of a reviewer's decisions, with a labelled legend underneath. */
function DecisionSplitBar({ approved, rejected, revisions, pending }: {
  approved: number; rejected: number; revisions: number; pending: number;
}) {
  const parts = [
    { key: 'approved' as const, label: 'Approved', value: approved },
    { key: 'rejected' as const, label: 'Rejected', value: rejected },
    { key: 'revisions' as const, label: 'Revisions', value: revisions },
    { key: 'pending' as const, label: 'Pending', value: pending },
  ];
  const total = approved + rejected + revisions + pending;
  if (total === 0) {
    return <p className="text-xs text-stone-400 dark:text-gray-500">No decisions in this period.</p>;
  }
  return (
    <div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Decision split">
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.key} className="first:rounded-l-full last:rounded-r-full" style={{ flex: p.value, backgroundColor: DECISION_COLORS[p.key] }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-gray-300">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: DECISION_COLORS[p.key] }} />
            {p.label}
            <span className={`tabular-nums ${p.value ? 'font-medium text-stone-900 dark:text-white' : 'text-stone-300 dark:text-gray-600'}`}>{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DecisionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <span className="text-stone-500 dark:text-gray-400">{p.name}</span>{' '}
      <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{p.value}</span>
    </div>
  );
}

export default function DrdMemberAnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DrdMemberPerformanceResponse | null>(null);
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [category, setCategory] = useState(searchParams?.get('category') || 'all');

  const [actionsOpen, setActionsOpen] = useState(false);

  const handleExportCSV = () => {
    if (!reviewers.length) return;
    const cols = [
      { key: 'reviewerName', label: 'Reviewer' },
      { key: 'reviewed', label: 'Reviewed' },
      { key: 'pending', label: 'Pending' },
      { key: 'avgTurnaroundHours', label: 'Avg Turnaround (hrs)' },
      { key: 'medianTurnaroundHours', label: 'Median Turnaround (hrs)' },
    ];
    const header = cols.map((c) => c.label).join(',');
    const rows = (reviewers as any[]).map((row) =>
      cols.map((c) => {
        const val = row[c.key];
        if (val == null) return '';
        if (typeof val === 'object') return JSON.stringify(val).replace(/,/g, ';');
        return String(val).replace(/,/g, ';');
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'drd-member-performance.csv'; a.click();
    URL.revokeObjectURL(url);
    setActionsOpen(false);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await drdAnalyticsService.getDrdMemberPerformance({
        from: fromDate,
        to: toDate,
        category,
      });
      if (res.data) setData(res.data);
    } catch (err) {
      if (is403(err)) {
        setAccessDenied(true);
      }
      logger.error('Failed to load DRD member performance', err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, category]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = data?.kpis;
  const reviewers = data?.reviewerPerformance || data?.reviewers || [];

  // Aggregate decision totals across all reviewers
  const totalApproved   = reviewers.reduce((s: number, r: any) => s + (r.decisionDistribution?.approved || 0), 0);
  const totalRejected   = reviewers.reduce((s: number, r: any) => s + (r.decisionDistribution?.rejected || 0), 0);
  const totalRevisions  = reviewers.reduce((s: number, r: any) => s + (r.decisionDistribution?.revisionRequested || 0) + (r.decisionDistribution?.sentBack || 0), 0);
  const totalPendingAll = reviewers.reduce((s: number, r: any) => s + (r.pending || 0), 0);
  const totalReviewedAll = kpis?.totalReviewed || 0;

  // Overall decision pie chart data
  const overallPieData = [
    { name: 'Approved',  value: totalApproved,   color: DECISION_COLORS.approved },
    { name: 'Rejected',  value: totalRejected,   color: DECISION_COLORS.rejected },
    { name: 'Revisions', value: totalRevisions,  color: DECISION_COLORS.revisions },
    { name: 'Pending',   value: totalPendingAll, color: DECISION_COLORS.pending },
  ].filter((d) => d.value > 0);

  // Monthly trend data for TrendChartPanel
  const trendData = (data?.trends?.monthly || []).map((m: Record<string, any>) => ({
    label: m.label || m.month || '',
    values: {
      Research: m.research || 0,
      Book: (m.book || 0) + (m.conference || 0),
      IPR: m.ipr || 0,
      Grants: m.grants || 0,
    },
  }));
  // Colours resolve from the shared palette by key (research/book/ipr/grants).
  const trendKeys = [
    { key: 'Research', label: 'Research' },
    { key: 'Book',     label: 'Book / conference' },
    { key: 'IPR',      label: 'IPR' },
    { key: 'Grants',   label: 'Grants' },
  ];

  const handleGenerateReport = () => {
    if (!kpis) return;
    const reviewerRows = reviewers
      .map((r: any, i: number) => {
        const approved  = r.decisionDistribution?.approved || 0;
        const rejected  = r.decisionDistribution?.rejected || 0;
        const revisions = (r.decisionDistribution?.revisionRequested || 0) + (r.decisionDistribution?.sentBack || 0);
        const reviewed  = r.reviewed || 0;
        const approvalRate   = reviewed > 0 ? Math.round((approved / reviewed) * 100)  : 0;
        const completionRate = (r.assigned || 0) > 0 ? Math.round((reviewed / r.assigned) * 100) : 0;
        return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600">${r.reviewerName}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${r.assigned || 0}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${reviewed}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${r.pending || 0}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#059669;font-weight:600">${approved}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:600">${rejected}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#ea580c">${revisions}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${approvalRate}%</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${completionRate}%</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${r.avgTurnaroundHours != null ? fmtHours(r.avgTurnaroundHours) : '—'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${r.medianTurnaroundHours != null ? fmtHours(r.medianTurnaroundHours) : '—'}</td>
        </tr>`;
      })
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>DRD Member Performance Report</title>
<style>
  body{font-family:Arial,sans-serif;color:#1e293b;padding:32px;max-width:1200px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:13px;color:#64748b;font-weight:400;margin:0 0 20px}
  .kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:24px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
  .kpi-label{font-size:10px;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
  .kpi-value{font-size:18px;font-weight:700;color:#1e293b}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f1f5f9;padding:8px 12px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0}
  th.num{text-align:center} th.right{text-align:right}
  @media print{body{padding:16px}}
</style></head><body>
<h1>DRD Member Performance Report</h1>
<h2>Period: ${fromDate} → ${toDate}${category !== 'all' ? '  |  Category: ' + category : '  |  All Categories'}</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Reviewers</div><div class="kpi-value">${kpis.totalReviewers || 0}</div></div>
  <div class="kpi"><div class="kpi-label">Total Reviewed</div><div class="kpi-value">${totalReviewedAll}</div></div>
  <div class="kpi"><div class="kpi-label">Approved</div><div class="kpi-value" style="color:#059669">${totalApproved}</div></div>
  <div class="kpi"><div class="kpi-label">Rejected</div><div class="kpi-value" style="color:#dc2626">${totalRejected}</div></div>
  <div class="kpi"><div class="kpi-label">Pending</div><div class="kpi-value" style="color:#d97706">${totalPendingAll}</div></div>
  <div class="kpi"><div class="kpi-label">Avg Turnaround</div><div class="kpi-value">${fmtHours(kpis.avgTurnaroundHours)}</div></div>
</div>
<h3 style="font-size:13px;margin:0 0 10px;color:#374151">Reviewer Performance Details</h3>
<table>
  <thead><tr>
    <th>#</th><th>Reviewer</th>
    <th class="num">Assigned</th><th class="num">Reviewed</th><th class="num">Pending</th>
    <th class="num">Approved</th><th class="num">Rejected</th><th class="num">Revisions</th>
    <th class="num">Approval%</th><th class="num">Completion%</th>
    <th class="right">Avg TAT</th><th class="right">Median TAT</th>
  </tr></thead>
  <tbody>${reviewerRows}</tbody>
</table>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };


  const menuItemCls = 'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700';

  return (
    <ProtectedRoute>
      {accessDenied ? (
        <div className="flex min-h-screen items-center justify-center bg-[#faf8f6] p-6 dark:bg-gray-900">
          <div className={`${ui.card} w-full max-w-md p-8 text-center`}>
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-stone-900 dark:text-white">Access denied</h2>
            <p className="mb-6 text-sm text-stone-500 dark:text-gray-400">
              You do not have the <strong className="font-medium text-stone-700 dark:text-gray-200">DRD Member Analytics</strong> permission required to view this page.
            </p>
            <button onClick={() => router.push('/dashboard')} className={ui.btnPrimary}>
              Back to dashboard
            </button>
          </div>
        </div>
      ) : (
        <AnalyticsShell>
          <AnalyticsHero
            title="DRD member performance"
            description="Reviewer workload, turnaround speed and decision patterns across the DRD team."
            eyebrow="Reviewer analytics"
            icon={<Users className="h-3.5 w-3.5" />}
            onBack={() => router.push('/drd/analytics/overview')}
            backLabel="Back to overview"
            actions={(
              <div className="relative">
                <button
                  onClick={() => setActionsOpen((v) => !v)}
                  className={ui.btnSecondary}
                  aria-haspopup="menu"
                  aria-expanded={actionsOpen}
                >
                  Actions
                  <ChevronDown className="h-4 w-4 text-stone-400 dark:text-gray-500" />
                </button>
                {actionsOpen && (
                  <div
                    role="menu"
                    className={`absolute right-0 z-50 mt-2 w-48 overflow-hidden ${ui.card} shadow-lg`}
                    onMouseLeave={() => setActionsOpen(false)}
                  >
                    <button
                      onClick={() => { handleGenerateReport(); setActionsOpen(false); }}
                      disabled={loading || !kpis}
                      className={menuItemCls}
                    >
                      <Printer className="h-4 w-4 text-stone-400 dark:text-gray-500" />
                      Print report
                    </button>
                    <button
                      onClick={handleExportCSV}
                      disabled={!reviewers.length}
                      className={menuItemCls}
                    >
                      <Download className="h-4 w-4 text-stone-400 dark:text-gray-500" />
                      Export CSV
                    </button>
                    <div className="border-t border-stone-100 dark:border-gray-700" />
                    <button
                      onClick={() => { fetchData(); setActionsOpen(false); }}
                      disabled={loading}
                      className={menuItemCls}
                    >
                      <RefreshCw className={`h-4 w-4 text-stone-400 dark:text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                      Refresh data
                    </button>
                  </div>
                )}
              </div>
            )}
            chips={[
              { label: 'Reviewers', value: (kpis?.totalReviewers || 0).toLocaleString('en-IN') },
              { label: 'Reviewed', value: totalReviewedAll.toLocaleString('en-IN') },
              { label: 'Pending', value: totalPendingAll.toLocaleString('en-IN') },
              { label: 'Avg turnaround', value: fmtHours(kpis?.avgTurnaroundHours) },
            ]}
          />

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

          <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {loading ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`${ui.card} p-4`}>
                      <div className="mb-3 h-3 w-20 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                      <div className="h-7 w-16 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                  <div className="h-[340px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800 xl:col-span-3" />
                  <div className="h-[340px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800 xl:col-span-2" />
                </div>
              </>
            ) : (
              <>
                {/* Summary KPIs */}
                {kpis && (
                  <KpiCardGrid
                    cols={4}
                    cards={[
                      { label: 'Total reviews',    value: totalReviewedAll,       icon: <Users className="w-4 h-4" /> },
                      { label: 'Unique reviewers', value: kpis.totalReviewers || 0 },
                      {
                        label: 'Approved',
                        value: totalApproved,
                        icon: <TrendingUp className="w-4 h-4" />,
                        trend: totalReviewedAll
                          ? { value: Math.round((totalApproved / totalReviewedAll) * 100), direction: 'up' as const }
                          : undefined,
                      },
                      { label: 'Pending',   value: totalPendingAll, icon: <Clock className="w-4 h-4" /> },
                      { label: 'Rejected',  value: totalRejected,   icon: <TrendingDown className="w-4 h-4" /> },
                      { label: 'Revisions', value: totalRevisions },
                      { label: 'Avg turnaround',    value: fmtHours(kpis.avgTurnaroundHours),    format: 'text' as const },
                      { label: 'Median turnaround', value: fmtHours(kpis.medianTurnaroundHours), format: 'text' as const },
                    ]}
                  />
                )}

                {/* Monthly trends + overall decision split */}
                {(trendData.length > 0 || overallPieData.length > 0) && (
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                    <div className="min-w-0 xl:col-span-3">
                      <TrendChartPanel
                        data={trendData}
                        keys={trendKeys}
                        title="Monthly review trends"
                        subtitle="Reviews completed per month, by category"
                        height={280}
                      />
                    </div>

                    <section className={`${ui.card} overflow-hidden xl:col-span-2`}>
                      <div className={ui.cardHeader}>
                        <div>
                          <h3 className={ui.title}>Overall decision split</h3>
                          <p className={ui.subtitle}>All reviewers combined</p>
                        </div>
                      </div>
                      {overallPieData.length > 0 ? (
                        <div className="flex flex-col items-center gap-6 p-5 sm:flex-row">
                          <div className="relative h-[200px] w-[200px] shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={overallPieData} cx="50%" cy="50%" innerRadius={66} outerRadius={92}
                                  paddingAngle={1} dataKey="value" startAngle={90} endAngle={-270} isAnimationActive={false}>
                                  {overallPieData.map((entry, i) => <Cell key={i} style={{ fill: entry.color, stroke: 'var(--viz-surface)', strokeWidth: 2 }} />)}
                                </Pie>
                                <Tooltip content={<DecisionTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-3xl font-semibold leading-none tabular-nums text-stone-900 dark:text-white">{totalReviewedAll}</span>
                              <span className="mt-1 text-xs text-stone-500 dark:text-gray-400">total reviews</span>
                            </div>
                          </div>
                          <ul className="w-full flex-1 divide-y divide-stone-100 dark:divide-gray-700">
                            {overallPieData.map((d) => {
                              const sum = overallPieData.reduce((s, x) => s + x.value, 0);
                              return (
                                <li key={d.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                  <span className="inline-flex items-center gap-2 text-stone-600 dark:text-gray-300">
                                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                                    {d.name}
                                  </span>
                                  <span className="tabular-nums">
                                    <span className="font-semibold text-stone-900 dark:text-white">{d.value}</span>
                                    <span className="ml-2 text-xs text-stone-400 dark:text-gray-500">{sum ? Math.round((d.value / sum) * 100) : 0}%</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : (
                        <div className="flex h-[240px] items-center justify-center text-sm text-stone-400 dark:text-gray-500">No data for this period.</div>
                      )}
                    </section>
                  </div>
                )}

                {/* Top performers */}
                {reviewers.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="text-base font-semibold text-stone-900 dark:text-white">Top performers</h2>
                      <span className="text-xs text-stone-500 dark:text-gray-400">Ranked by reviews completed</span>
                    </div>

                    <div className={`grid gap-4 ${
                      reviewers.length >= 3 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' :
                      reviewers.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                      'grid-cols-1'
                    }`}>
                      {[...reviewers]
                        .sort((a: any, b: any) => (b.reviewed || 0) - (a.reviewed || 0))
                        .slice(0, 6)
                        .map((r: any, rank: number) => {
                          const approved  = r.decisionDistribution?.approved || 0;
                          const rejected  = r.decisionDistribution?.rejected || 0;
                          const revisions = (r.decisionDistribution?.revisionRequested || 0) + (r.decisionDistribution?.sentBack || 0);
                          const pending   = r.pending  || 0;
                          const reviewed  = r.reviewed || 0;
                          const assigned  = r.assigned || 0;
                          const approvalRate   = reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0;
                          const completionRate = assigned > 0 ? Math.round((reviewed / assigned) * 100) : 0;
                          const rejectionRate  = reviewed > 0 ? Math.round((rejected / reviewed) * 100) : 0;

                          const isSolo = reviewers.length === 1;

                          const stats: Array<{ label: string; value: React.ReactNode }> = [
                            { label: 'Reviews done', value: <><span className="font-semibold text-stone-900 dark:text-white">{reviewed}</span><span className="text-stone-400 dark:text-gray-500"> / {assigned}</span></> },
                            { label: 'Completion', value: <span className="font-semibold text-stone-900 dark:text-white">{completionRate}%</span> },
                            { label: 'Approval rate', value: <span className="font-semibold text-stone-900 dark:text-white">{approvalRate}%</span> },
                            ...(isSolo ? [
                              { label: 'Rejection rate', value: <span className="font-semibold text-stone-900 dark:text-white">{rejectionRate}%</span> },
                              { label: 'Median turnaround', value: <span className="font-semibold text-stone-900 dark:text-white">{fmtHours(r.medianTurnaroundHours)}</span> },
                            ] : []),
                          ];

                          return (
                            <article key={r.reviewerId} className={`${ui.card} flex flex-col overflow-hidden`}>
                              <button
                                onClick={() => router.push(`/drd/analytics/drd-member/${r.reviewerId}`)}
                                className="group flex w-full items-center gap-3 border-b border-stone-100 px-5 py-4 text-left transition-colors hover:bg-stone-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
                              >
                                <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-stone-400 dark:text-gray-500">{rank + 1}</span>
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wine/10 text-sm font-semibold text-wine dark:bg-wine/30 dark:text-amber">
                                  {getInitials(r.reviewerName)}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-stone-900 dark:text-white">{r.reviewerName}</span>
                                  <span className="mt-0.5 block truncate text-xs capitalize text-stone-500 dark:text-gray-400">
                                    {r.reviewerRole?.replace(/_/g, ' ') || 'DRD reviewer'}
                                  </span>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 transition-colors group-hover:text-stone-500 dark:text-gray-600 dark:group-hover:text-gray-400" />
                              </button>

                              <div className="flex flex-1 flex-col gap-4 px-5 py-4">
                                <dl className={`grid gap-x-4 gap-y-3 ${isSolo ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2'}`}>
                                  {stats.map((s) => (
                                    <div key={s.label}>
                                      <dt className="text-xs text-stone-500 dark:text-gray-400">{s.label}</dt>
                                      <dd className="mt-0.5 text-sm tabular-nums">{s.value}</dd>
                                    </div>
                                  ))}
                                  <div className={isSolo ? '' : 'col-span-2'}>
                                    <dt className="text-xs text-stone-500 dark:text-gray-400">Avg turnaround</dt>
                                    <dd className="mt-0.5"><TurnaroundValue hrs={r.avgTurnaroundHours} /></dd>
                                  </div>
                                </dl>
                                <DecisionSplitBar approved={approved} rejected={rejected} revisions={revisions} pending={pending} />
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  </section>
                )}

                {/* Full leaderboard */}
                {reviewers.length > 0 && (
                  <ReviewerLeaderboardTable
                    reviewers={reviewers}
                    onReviewerClick={(id) => router.push(`/drd/analytics/drd-member/${id}`)}
                  />
                )}

                {/* Empty state */}
                {!kpis && !loading && (
                  <div className={`${ui.card} p-12 text-center`}>
                    <Users className="mx-auto mb-3 h-8 w-8 text-stone-300 dark:text-gray-600" />
                    <p className="text-sm text-stone-500 dark:text-gray-400">No review data for the selected filters.</p>
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
