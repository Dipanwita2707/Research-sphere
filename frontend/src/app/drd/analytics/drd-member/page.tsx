'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
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
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  MoreHorizontal,
  Printer,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
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
  if (hrs == null) return 'â€”';
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

const DECISION_COLORS = {
  approved: '#10b981',
  rejected: '#f87171',
  revisions: '#f97316',
  pending: '#94a3b8',
};

function ReviewerPieChart({ approved, rejected, revisions, pending, height = 130, innerRadius = 38, outerRadius = 54 }: {
  approved: number; rejected: number; revisions: number; pending: number;
  height?: number; innerRadius?: number; outerRadius?: number;
}) {
  const slices = [
    { name: 'Approved', value: approved, color: DECISION_COLORS.approved },
    { name: 'Rejected', value: rejected, color: DECISION_COLORS.rejected },
    { name: 'Revisions', value: revisions, color: DECISION_COLORS.revisions },
    { name: 'Pending', value: pending, color: DECISION_COLORS.pending },
  ].filter((d) => d.value > 0);

  const total = approved + rejected + revisions + pending;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  if (total === 0) {
    return <div className="flex items-center justify-center text-xs text-slate-400" style={{ height }}>No data</div>;
  }

  return (
    <div className="relative" style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={slices} cx="50%" cy="50%" innerRadius={innerRadius} outerRadius={outerRadius}
            paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270} isAnimationActive={false}>
            {slices.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
            formatter={(v?: number, name?: string) => [v ?? 0, name ?? '']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-slate-800 dark:text-slate-100 leading-none" style={{ fontSize: height < 150 ? 16 : 24 }}>{approvalRate}%</span>
        <span className="text-[9px] text-slate-400 mt-0.5">approval</span>
      </div>
    </div>
  );
}

function ReviewerBarChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DrdMemberAnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DrdMemberPerformanceResponse | null>(null);
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [category, setCategory] = useState(searchParams.get('category') || 'all');

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
  const trendKeys = [
    { key: 'Research', label: 'Research',   color: '#6366f1' },
    { key: 'Book',     label: 'Book/Conf',  color: '#0ea5e9' },
    { key: 'IPR',      label: 'IPR',        color: '#f59e0b' },
    { key: 'Grants',   label: 'Grants',     color: '#10b981' },
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
              You do not have the <strong>DRD Member Analytics</strong> permission required to view this page.
            </p>
            <button onClick={() => router.push('/dashboard')} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <AnalyticsShell>
          <AnalyticsHero
            title="DRD Member Performance"
            description="Measure reviewer workload, turnaround speed, and decision patterns with a cleaner performance view for the DRD team."
            eyebrow="Reviewer Intelligence"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            onBack={() => router.push('/drd/analytics/overview')}
            actions={(
              <div className="relative">
                <button
                  onClick={() => setActionsOpen((v) => !v)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                  title="Actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {actionsOpen && (
                  <div
                    className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden"
                    onMouseLeave={() => setActionsOpen(false)}
                  >
                    <button
                      onClick={() => { handleGenerateReport(); setActionsOpen(false); }}
                      disabled={loading || !kpis}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Printer className="h-4 w-4 text-slate-400" />
                      Print Report
                    </button>
                    <button
                      onClick={handleExportCSV}
                      disabled={!reviewers.length}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Download className="h-4 w-4 text-slate-400" />
                      Export CSV
                    </button>
                    <div className="border-t border-slate-100" />
                    <button
                      onClick={() => { fetchData(); setActionsOpen(false); }}
                      disabled={loading}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                    >
                      <RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                      Refresh Data
                    </button>
                  </div>
                )}
              </div>
            )}
            chips={[
              { label: 'Reviewers', value: String(kpis?.totalReviewers || 0) },
              { label: 'Reviewed',  value: String(totalReviewedAll) },
              { label: 'Pending',   value: String(totalPendingAll) },
              { label: 'Approved',  value: String(totalApproved) },
              { label: 'Avg TAT',   value: fmtHours(kpis?.avgTurnaroundHours) },
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

          <div className="px-6 py-6 sm:px-8 lg:px-12 xl:px-16 space-y-8">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-4 animate-pulse">
                    <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-20 mb-3" />
                    <div className="h-7 bg-slate-100 dark:bg-slate-700 rounded w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* ── Section 1: Summary KPIs ──────────────────────────────────── */}
                {kpis && (
                  <KpiCardGrid
                    cols={4}
                    cards={[
                      { label: 'Total Reviews',    value: totalReviewedAll,       icon: <Users className="w-4 h-4" /> },
                      { label: 'Unique Reviewers', value: kpis.totalReviewers || 0 },
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
                      { label: 'Avg Turnaround',    value: fmtHours(kpis.avgTurnaroundHours),    format: 'text' as const },
                      { label: 'Median Turnaround', value: fmtHours(kpis.medianTurnaroundHours), format: 'text' as const },
                    ]}
                  />
                )}

                {/* ── Section 2: Monthly Trends + Overall Decision (same height) ── */}
                {(trendData.length > 0 || overallPieData.length > 0) && (
                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                    {/* Monthly Review Trends */}
                    <div className="xl:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <BarChart3 className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Monthly Review Trends</h3>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Review activity by category over time</p>
                      {trendData.length > 0
                        ? <TrendChartPanel data={trendData} keys={trendKeys} height={280} />
                        : <div className="flex h-[280px] items-center justify-center text-xs text-slate-400">No trend data yet</div>
                      }
                    </div>

                    {/* Overall Decision Split */}
                    <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Overall Decision Split</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">All reviewers combined</p>
                      {overallPieData.length > 0 ? (
                        <div className="relative" style={{ height: 296 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={overallPieData} cx="50%" cy="50%" innerRadius={72} outerRadius={106}
                                paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270} isAnimationActive={false}>
                                {overallPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <Tooltip contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
                                formatter={(v?: number, name?: string) => [v ?? 0, name ?? '']} />
                              <Legend iconType="circle" iconSize={8}
                                formatter={(value) => <span style={{ fontSize: 11, color: '#64748b' }}>{value}</span>} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: 48 }}>
                            <span className="text-3xl font-bold text-slate-800 dark:text-slate-100 leading-none">{totalReviewedAll}</span>
                            <span className="text-[11px] text-slate-400 mt-0.5">total reviews</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-[296px] items-center justify-center text-xs text-slate-400">No data yet</div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Section 3: Top Performers Grid ───────────────────────────── */}
                {reviewers.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Top Performers</h2>
                      <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
                        by reviews completed
                      </span>
                    </div>

                    <div className={`grid gap-5 ${
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
                          const total = approved + rejected + revisions + pending;

                          const rankColors = ['#f59e0b', '#94a3b8', '#b45309', '#6366f1', '#10b981', '#0ea5e9'];
                          const rankLabel  = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

                          const isSolo = reviewers.length === 1;

                          return (
                            <div key={r.reviewerId}
                              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">

                              {/* Card header */}
                              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60">
                                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                                  style={{ backgroundColor: rankColors[rank] }}>
                                  {rank + 1}
                                </div>
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                  {getInitials(r.reviewerName)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate leading-tight">{r.reviewerName}</h3>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 capitalize truncate mt-0.5">
                                    {r.reviewerRole?.replace(/_/g, ' ') || 'DRD Reviewer'} · {rankLabel[rank]}
                                  </p>
                                </div>
                                <button onClick={() => router.push(`/drd/analytics/drd-member/${r.reviewerId}`)}
                                  className="flex-shrink-0 p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Card body — horizontal when solo, compact when grid */}
                              <div className={`flex flex-1 ${isSolo ? 'flex-row divide-x divide-slate-100 dark:divide-slate-700/60' : 'items-center gap-4 px-5 py-4'}`}>

                                {/* Donut section */}
                                <div className={`flex flex-col items-center justify-center ${isSolo ? 'w-56 flex-shrink-0 py-5' : 'flex-shrink-0 w-[120px]'}`}>
                                  <ReviewerPieChart
                                    approved={approved} rejected={rejected}
                                    revisions={revisions} pending={pending}
                                    height={isSolo ? 150 : 120}
                                    innerRadius={isSolo ? 46 : 36}
                                    outerRadius={isSolo ? 66 : 52}
                                  />
                                  <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 mt-1.5">
                                    {[
                                      { label: 'Appr', color: DECISION_COLORS.approved, val: approved },
                                      { label: 'Rej', color: DECISION_COLORS.rejected, val: rejected },
                                      { label: 'Rev', color: DECISION_COLORS.revisions, val: revisions },
                                      { label: 'Pend', color: DECISION_COLORS.pending, val: pending },
                                    ].filter(s => s.val > 0).map((s) => (
                                      <span key={s.label} className="flex items-center gap-0.5 text-[9px] text-slate-500 dark:text-slate-400">
                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                        {s.val}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {/* Primary stats */}
                                <div className={`divide-y divide-slate-100 dark:divide-slate-700/60 ${isSolo ? 'flex-1 px-6 py-5 self-stretch flex flex-col justify-center' : 'flex-1'}`}>
                                  {[
                                    { label: 'Reviews Done', value: `${reviewed}`, sub: `/ ${assigned}`, color: 'text-indigo-600 dark:text-indigo-400' },
                                    { label: 'Completion', value: `${completionRate}%`, sub: '', color: 'text-slate-700 dark:text-slate-300' },
                                    { label: 'Approval Rate', value: `${approvalRate}%`, sub: '', color: 'text-emerald-600 dark:text-emerald-400' },
                                    { label: 'Avg Turnaround', value: fmtHours(r.avgTurnaroundHours), sub: '', color: 'text-slate-700 dark:text-slate-300' },
                                  ].map((s) => (
                                    <div key={s.label} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
                                      <span className="text-[11px] text-slate-400 dark:text-slate-500">{s.label}</span>
                                      <span className={`text-sm font-semibold ${s.color}`}>
                                        {s.value}<span className="text-[10px] font-normal text-slate-400 ml-0.5">{s.sub}</span>
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Extra stats panel — only when solo */}
                                {isSolo && (
                                  <div className="flex-1 px-6 py-5 self-stretch flex flex-col justify-center divide-y divide-slate-100 dark:divide-slate-700/60">
                                    {[
                                      { label: 'Rejection Rate', value: `${rejectionRate}%`, color: 'text-red-500 dark:text-red-400' },
                                      { label: 'Median Turnaround', value: fmtHours(r.medianTurnaroundHours), color: 'text-slate-700 dark:text-slate-300' },
                                      { label: 'Pending', value: `${pending}`, color: 'text-amber-600 dark:text-amber-400' },
                                      { label: 'Revisions', value: `${revisions}`, color: 'text-orange-500 dark:text-orange-400' },
                                    ].map((s) => (
                                      <div key={s.label} className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0">
                                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{s.label}</span>
                                        <span className={`text-sm font-semibold ${s.color}`}>{s.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Decision colour bar (bottom edge) */}
                              {total > 0 && (
                                <div className="flex h-1.5 rounded-b-2xl overflow-hidden">
                                  {approved  > 0 && <div style={{ flex: approved,  backgroundColor: DECISION_COLORS.approved }} />}
                                  {rejected  > 0 && <div style={{ flex: rejected,  backgroundColor: DECISION_COLORS.rejected }} />}
                                  {revisions > 0 && <div style={{ flex: revisions, backgroundColor: DECISION_COLORS.revisions }} />}
                                  {pending   > 0 && <div style={{ flex: pending,   backgroundColor: DECISION_COLORS.pending }} />}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* ── Section 4: Full Leaderboard ──────────────────────────────── */}
                {reviewers.length > 0 && (
                  <ReviewerLeaderboardTable
                    reviewers={reviewers}
                    onReviewerClick={(id) => router.push(`/drd/analytics/drd-member/${id}`)}
                  />
                )}

                {/* Empty state */}
                {!kpis && !loading && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-800 p-12 text-center shadow-sm">
                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No review data found for the selected filters.</p>
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

