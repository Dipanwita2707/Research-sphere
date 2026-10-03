'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type ReviewerDetailResponse,
} from '@/features/ipr-management/services/drdAnalytics.service';
import {
  AnalyticsHero,
  AnalyticsShell,
  ExportActions,
  KpiCardGrid,
  TrendChartPanel,
} from '@/components/analytics';
import { categoryColor, seriesColors, ui } from '@/components/analytics/theme';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  FileText,
  Printer,
  RefreshCw,
  TrendingDown,
  UserRound,
  XCircle,
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';

function is403(err: unknown): boolean {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status === 403;
  }
  return false;
}

function fmtHours(hrs: number | null | undefined) {
  if (hrs == null) return '—';
  if (hrs < 1) return `${Math.round(hrs * 60)}m`;
  if (hrs < 24) return `${Math.round(hrs)}h`;
  return `${(hrs / 24).toFixed(1)}d`;
}

function statusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case 'approved':
      return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Approved</span>;
    case 'rejected':
      return <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"><XCircle className="h-3 w-3" /> Rejected</span>;
    default:
      return <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium capitalize text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"><Clock className="h-3 w-3" /> {status?.replace(/_/g, ' ') || 'Pending'}</span>;
  }
}

/** Turnaround state: under a day is fast, under three days needs watching, beyond that is slow. */
function turnaroundStatus(hrs: number | null | undefined) {
  if (hrs == null) return null;
  if (hrs < 24) return { label: 'Fast', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
  if (hrs < 72) return { label: 'Watch', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  return { label: 'Slow', cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
}

const DECISION_SPLIT_COLORS = seriesColors(['Approved', 'Rejected', 'Other']);

export default function ReviewerDetailPage() {
  const router = useRouter();
  const params = useParams() as Record<string, string>;
  const reviewerId = params?.reviewerId as string;

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [data, setData] = useState<ReviewerDetailResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'turnaround'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    if (!reviewerId) return;
    setLoading(true);
    try {
      const res = await drdAnalyticsService.getReviewerPerformanceDetail(reviewerId, {});
      if (res.data) setData(res.data);
    } catch (err) {
      if (is403(err)) { setAccessDenied(true); }
      logger.error('Failed to load reviewer detail', err);
    } finally {
      setLoading(false);
    }
  }, [reviewerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = data?.kpis;
  const timeline = data?.timeline || [];

  const filteredTimeline = timeline
    .filter((t) => statusFilter === 'all' || t.decision?.toLowerCase() === statusFilter)
    .sort((a, b) => {
      if (sortBy === 'date') {
        const da = new Date(a.reviewedAt || a.assignedAt || 0).getTime();
        const db = new Date(b.reviewedAt || b.assignedAt || 0).getTime();
        return sortDir === 'desc' ? db - da : da - db;
      }
      return sortDir === 'desc'
        ? (b.turnaroundHours || 0) - (a.turnaroundHours || 0)
        : (a.turnaroundHours || 0) - (b.turnaroundHours || 0);
    });

  const toggleSort = (col: 'date' | 'turnaround') => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  // Category breakdown from full timeline
  const allTimeline = data?.timeline || [];
  const categoryStats = {
    research: allTimeline.filter((t) => t.category === 'research').length,
    book: allTimeline.filter((t) => t.category === 'book').length,
    conference: allTimeline.filter((t) => t.category === 'conference').length,
    ipr: allTimeline.filter((t) => t.category === 'ipr').length,
    grants: allTimeline.filter((t) => t.category === 'grants').length,
  };

  const categoryBarData = [
    { label: 'Research', values: { Reviewed: categoryStats.research } },
    { label: 'Book', values: { Reviewed: categoryStats.book } },
    { label: 'Conference', values: { Reviewed: categoryStats.conference } },
    { label: 'IPR', values: { Reviewed: categoryStats.ipr } },
    { label: 'Grants', values: { Reviewed: categoryStats.grants } },
  ].filter((d) => d.values.Reviewed > 0);

  // Monthly decision trend from timeline
  const monthlyMap = new Map<string, { label: string; approved: number; rejected: number; other: number }>();
  allTimeline.forEach((t) => {
    const date = t.firstResponseAt || t.assignedAt;
    if (!date) return;
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const lbl = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    if (!monthlyMap.has(key)) monthlyMap.set(key, { label: lbl, approved: 0, rejected: 0, other: 0 });
    const dec = (t.decision || '').toLowerCase();
    const bucket = monthlyMap.get(key)!;
    if (['approved', 'recommended'].includes(dec)) bucket.approved++;
    else if (dec === 'rejected') bucket.rejected++;
    else bucket.other++;
  });
  const monthlyTrend = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({ label: v.label, values: { Approved: v.approved, Rejected: v.rejected, Other: v.other } }));
  const monthlyTrendKeys = [
    { key: 'Approved', label: 'Approved' },
    { key: 'Rejected', label: 'Rejected' },
    { key: 'Other', label: 'Other' },
  ];

  const handleGenerateReport = () => {
    if (!data) return;
    const revName = data.reviewer?.name || 'Reviewer';
    const rows = allTimeline
      .map(
        (t, i) =>
          `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
            <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0">${i + 1}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;max-width:260px">${t.applicationTitle || t.title || 'Untitled'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-transform:capitalize">${t.category}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0">${t.decision || '\u2014'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0">${t.reviewedAt ? new Date(t.reviewedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014'}</td>
            <td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${t.turnaroundHours != null ? t.turnaroundHours.toFixed(1) + 'h' : '\u2014'}</td>
          </tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Reviewer Report - ${revName}</title>
<style>
  body{font-family:Arial,sans-serif;color:#1e293b;padding:28px;max-width:1000px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px}  h2{font-size:13px;color:#64748b;margin:0 0 22px}
  .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:22px}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
  .kpi-label{font-size:11px;color:#64748b;margin-bottom:3px}
  .kpi-value{font-size:18px;font-weight:700;color:#1e293b}
  .cat-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:22px}
  .cat{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center}
  .cat-label{font-size:11px;color:#3b82f6;margin-bottom:2px}
  .cat-value{font-size:16px;font-weight:700;color:#1e40af}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f1f5f9;padding:8px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0}
  @media print{body{padding:14px}}
</style></head><body>
<h1>Reviewer Performance Report \u2014 ${revName}</h1>
<h2>All-time review history</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Reviews</div><div class="kpi-value">${allTimeline.length}</div></div>
  <div class="kpi"><div class="kpi-label">Approved</div><div class="kpi-value" style="color:#059669">${kpis?.decisionDistribution?.approved || 0}</div></div>
  <div class="kpi"><div class="kpi-label">Rejected</div><div class="kpi-value" style="color:#dc2626">${kpis?.decisionDistribution?.rejected || 0}</div></div>
  <div class="kpi"><div class="kpi-label">Avg Turnaround</div><div class="kpi-value">${fmtHours(kpis?.avgTurnaroundHours)}</div></div>
  <div class="kpi"><div class="kpi-label">Median Turnaround</div><div class="kpi-value">${fmtHours(kpis?.medianTurnaroundHours)}</div></div>
</div>
<div class="cat-grid">
  <div class="cat"><div class="cat-label">Research</div><div class="cat-value">${categoryStats.research}</div></div>
  <div class="cat"><div class="cat-label">Book</div><div class="cat-value">${categoryStats.book}</div></div>
  <div class="cat"><div class="cat-label">Conference</div><div class="cat-value">${categoryStats.conference}</div></div>
  <div class="cat"><div class="cat-label">IPR</div><div class="cat-value">${categoryStats.ipr}</div></div>
  <div class="cat"><div class="cat-label">Grants</div><div class="cat-value">${categoryStats.grants}</div></div>
</div>
<table>
  <thead><tr><th>#</th><th>Application</th><th>Category</th><th>Decision</th><th>Date</th><th>Turnaround</th></tr></thead>
  <tbody>${rows}</tbody>
</table></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };


  const otherCount = kpis ? kpis.totalReviews - (kpis.approvedCount || 0) - (kpis.rejectedCount || 0) : 0;
  const decisionSplit = kpis
    ? [
        { key: 'Approved', value: kpis.approvedCount || 0 },
        { key: 'Rejected', value: kpis.rejectedCount || 0 },
        { key: 'Other', value: otherCount },
      ]
    : [];
  const categoryMax = Math.max(1, ...categoryBarData.map((d) => d.values.Reviewed));
  const SortIcon = sortDir === 'desc' ? ArrowDown : ArrowUp;

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
            title={data?.reviewer?.name || 'Reviewer detail'}
            description={data?.reviewer?.email || 'All-time review history, turnaround and decisions for this reviewer.'}
            eyebrow="Reviewer profile"
            icon={<UserRound className="h-3.5 w-3.5" />}
            onBack={() => router.push('/drd/analytics/drd-member')}
            backLabel="Back to DRD members"
            actions={(
              <>
                <button
                  onClick={handleGenerateReport}
                  disabled={loading || !data}
                  className={ui.btnSecondary}
                >
                  <Printer className="h-4 w-4" />
                  Print report
                </button>
                <ExportActions
                  data={filteredTimeline}
                  filename={`reviewer-${reviewerId}-detail`}
                  columns={[
                    { key: 'applicationTitle', label: 'Application' },
                    { key: 'category', label: 'Category' },
                    { key: 'decision', label: 'Decision' },
                    { key: 'assignedAt', label: 'Assigned At' },
                    { key: 'reviewedAt', label: 'Reviewed At' },
                    { key: 'turnaroundHours', label: 'Turnaround (hrs)' },
                  ]}
                />
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className={`${ui.btnSecondary} w-9 justify-center px-0`}
                  aria-label="Refresh data"
                  title="Refresh data"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </>
            )}
            chips={[
              { label: 'Total reviews', value: (kpis?.totalReviews || 0).toLocaleString('en-IN') },
              { label: 'Approval rate', value: kpis?.totalReviews ? `${Math.round(((kpis.approvedCount || 0) / kpis.totalReviews) * 100)}%` : '—' },
              { label: 'Avg turnaround', value: fmtHours(kpis?.avgTurnaroundHours) },
              { label: 'Pending', value: (kpis?.pending || 0).toLocaleString('en-IN') },
            ]}
          />

          <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {loading ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`${ui.card} p-4`}>
                      <div className="mb-3 h-3 w-20 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                      <div className="h-6 w-16 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                    </div>
                  ))}
                </div>
                <div className="h-[300px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
                <div className="h-[360px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
              </>
            ) : (
              <>
                {/* KPIs */}
                {kpis && (
                  <KpiCardGrid
                    cards={[
                      { label: 'Total reviews', value: kpis.totalReviews || 0, icon: <FileText className="w-4 h-4" /> },
                      {
                        label: 'Approved',
                        value: kpis.approvedCount || 0,
                        icon: <CheckCircle2 className="w-4 h-4" />,
                        trend: kpis.totalReviews
                          ? { value: Math.round(((kpis.approvedCount || 0) / kpis.totalReviews) * 100), direction: 'up' as const }
                          : undefined,
                      },
                      {
                        label: 'Rejected',
                        value: kpis.rejectedCount || 0,
                        icon: <TrendingDown className="w-4 h-4" />,
                      },
                      {
                        label: 'Avg turnaround',
                        value: fmtHours(kpis.avgTurnaroundHours),
                        format: 'text',
                        icon: <Clock className="w-4 h-4" />,
                      },
                      {
                        label: 'Median turnaround',
                        value: fmtHours(kpis.medianTurnaroundHours),
                        format: 'text',
                      },
                      {
                        label: 'Fastest review',
                        value: fmtHours(kpis.fastestTurnaroundHours),
                        format: 'text',
                      },
                    ]}
                  />
                )}

                {/* Primary chart: monthly decisions; side: decision split + category mix */}
                {(monthlyTrend.length > 1 || (kpis && kpis.totalReviews > 0) || categoryBarData.length > 0) && (
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                    {monthlyTrend.length > 1 && (
                      <div className="min-w-0 xl:col-span-3">
                        <TrendChartPanel
                          data={monthlyTrend}
                          keys={monthlyTrendKeys}
                          title="Monthly review trend"
                          subtitle="Decisions recorded per month"
                          height={260}
                        />
                      </div>
                    )}

                    <div className={`grid grid-cols-1 gap-6 ${monthlyTrend.length > 1 ? 'xl:col-span-2' : 'md:grid-cols-2 xl:col-span-5'}`}>
                      {kpis && kpis.totalReviews > 0 && (
                        <section className={`${ui.card} overflow-hidden`}>
                          <div className={ui.cardHeader}>
                            <div>
                              <h3 className={ui.title}>Decision distribution</h3>
                              <p className={ui.subtitle}>Share of all reviews by outcome</p>
                            </div>
                          </div>
                          <div className="p-5">
                            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Decision distribution">
                              {decisionSplit.filter((d) => d.value > 0).map((d) => (
                                <div
                                  key={d.key}
                                  className="first:rounded-l-full last:rounded-r-full"
                                  style={{ flex: d.value, backgroundColor: DECISION_SPLIT_COLORS[d.key] }}
                                  title={`${d.key}: ${d.value}`}
                                />
                              ))}
                            </div>
                            <ul className="mt-4 divide-y divide-stone-100 dark:divide-gray-700">
                              {decisionSplit.map((d) => (
                                <li key={d.key} className="flex items-center justify-between py-2 text-sm">
                                  <span className="inline-flex items-center gap-2 text-stone-600 dark:text-gray-300">
                                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DECISION_SPLIT_COLORS[d.key] }} />
                                    {d.key}
                                  </span>
                                  <span className="tabular-nums">
                                    <span className={d.value ? 'font-semibold text-stone-900 dark:text-white' : 'text-stone-300 dark:text-gray-600'}>{d.value}</span>
                                    <span className="ml-2 text-xs text-stone-400 dark:text-gray-500">{Math.round((d.value / kpis.totalReviews) * 100)}%</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </section>
                      )}

                      {allTimeline.length > 0 && categoryBarData.length > 0 && (
                        <section className={`${ui.card} overflow-hidden`}>
                          <div className={ui.cardHeader}>
                            <div>
                              <h3 className={ui.title}>Category breakdown</h3>
                              <p className={ui.subtitle}>Reviews handled per category</p>
                            </div>
                          </div>
                          <ul className="space-y-3 p-5">
                            {categoryBarData.map((d) => (
                              <li key={d.label}>
                                <div className="mb-1 flex items-center justify-between text-sm">
                                  <span className="inline-flex items-center gap-2 text-stone-600 dark:text-gray-300">
                                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: categoryColor(d.label) }} />
                                    {d.label}
                                  </span>
                                  <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{d.values.Reviewed}</span>
                                </div>
                                <div className="h-2 rounded-full bg-stone-100 dark:bg-gray-700">
                                  <div
                                    className="h-2 rounded-full"
                                    style={{ width: `${(d.values.Reviewed / categoryMax) * 100}%`, backgroundColor: categoryColor(d.label) }}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                    </div>
                  </div>
                )}

                {/* Review timeline */}
                <section className={`${ui.card} overflow-hidden`}>
                  <div className={ui.cardHeader}>
                    <div>
                      <h3 className={ui.title}>Review timeline</h3>
                      <p className={ui.subtitle}>
                        <span className="tabular-nums">{filteredTimeline.length}</span> review{filteredTimeline.length === 1 ? '' : 's'}
                        {filteredTimeline.length > 100 ? ' · showing the first 100' : ''}
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 dark:border-gray-600 dark:bg-gray-900/50" role="group" aria-label="Filter by decision">
                      {['all', 'approved', 'rejected'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatusFilter(s)}
                          aria-pressed={statusFilter === s}
                          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                            statusFilter === s
                              ? 'bg-white text-wine shadow-sm dark:bg-gray-700 dark:text-amber'
                              : 'text-stone-500 hover:text-stone-800 dark:text-gray-400 dark:hover:text-gray-200'
                          }`}
                        >
                          {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-stone-50 dark:bg-gray-900/40">
                        <tr>
                          <th className={`${ui.th} w-12`}>#</th>
                          <th className={ui.th}>Application</th>
                          <th className={ui.th}>Category</th>
                          <th className={ui.th}>Decision</th>
                          <th className={ui.th} aria-sort={sortBy === 'date' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}>
                            <button onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 uppercase hover:text-stone-800 dark:hover:text-gray-200">
                              Date
                              {sortBy === 'date' && <SortIcon className="h-3 w-3" />}
                            </button>
                          </th>
                          <th className={`${ui.th} text-right`} aria-sort={sortBy === 'turnaround' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}>
                            <button onClick={() => toggleSort('turnaround')} className="inline-flex items-center gap-1 uppercase hover:text-stone-800 dark:hover:text-gray-200">
                              Turnaround
                              {sortBy === 'turnaround' && <SortIcon className="h-3 w-3" />}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                        {filteredTimeline.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-400 dark:text-gray-500">
                              No reviews for this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredTimeline.slice(0, 100).map((entry, i) => {
                            const tat = turnaroundStatus(entry.turnaroundHours);
                            return (
                              <tr key={i} className="hover:bg-stone-50 dark:hover:bg-gray-700/40">
                                <td className={`${ui.td} tabular-nums text-stone-400 dark:text-gray-500`}>{i + 1}</td>
                                <td className={`${ui.td} max-w-xs truncate font-medium text-stone-900 dark:text-white`} title={entry.applicationTitle || 'Untitled'}>
                                  {entry.applicationTitle || 'Untitled'}
                                </td>
                                <td className={ui.td}>
                                  <span className="inline-flex items-center gap-2 capitalize">
                                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: categoryColor(entry.category || '') }} />
                                    {entry.category}
                                  </span>
                                </td>
                                <td className={ui.td}>{statusBadge(entry.decision)}</td>
                                <td className={`${ui.td} whitespace-nowrap tabular-nums text-stone-500 dark:text-gray-400`}>
                                  {entry.reviewedAt
                                    ? new Date(entry.reviewedAt).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })
                                    : '—'}
                                </td>
                                <td className={`${ui.td} text-right`}>
                                  <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                                    <span className="font-medium tabular-nums text-stone-900 dark:text-white">{fmtHours(entry.turnaroundHours)}</span>
                                    {tat && <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tat.cls}`}>{tat.label}</span>}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        </AnalyticsShell>
      )}
    </ProtectedRoute>
  );
}
