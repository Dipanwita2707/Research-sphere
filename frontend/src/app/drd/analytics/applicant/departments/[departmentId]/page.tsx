'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsResponse,
  type CategoryBreakdownResponse,
  type ProgressTrackerAnalyticsData,
  type TrackerStatus,
} from '@/features/ipr-management/services/drdAnalytics.service';
import {
  AnalyticsFilterBar,
  AnalyticsHero,
  AnalyticsShell,
  ExportActions,
  TrendChartPanel,
  AnalyticsPieChart,
  AnalyticsPipelineChart,
} from '@/components/analytics';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  Layers3,
  Printer,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { logger } from '@/shared/utils/logger';

const CATEGORY_OPTIONS = [
  { value: 'research', label: 'Research' },
  { value: 'book', label: 'Book / Chapter' },
  { value: 'conference', label: 'Conference' },
  { value: 'ipr', label: 'IPR / Patent' },
  { value: 'grants', label: 'Grants' },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function is403(err: unknown): boolean {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status === 403;
  }
  return false;
}

export default function DepartmentAnalyticsPage() {
  const router = useRouter();
  const params = useParams<{ departmentId: string }>();
  const departmentId = params?.departmentId ?? null;
  const searchParams = useSearchParams()!;

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [data, setData] = useState<DrdAnalyticsResponse | null>(null);
  const [trackerData, setTrackerData] = useState<ProgressTrackerAnalyticsData | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownResponse | null>(null);
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [category, setCategory] = useState(searchParams?.get('category') || 'all');

  const fetchData = useCallback(async () => {
    if (!departmentId) return;
    setLoading(true);
    try {
      const [deptRes, trackerRes, breakdownRes] = await Promise.allSettled([
        drdAnalyticsService.getApplicantDepartmentAnalytics(departmentId, {
          from: fromDate,
          to: toDate,
          category: category !== 'all' ? category : undefined,
        }),
        drdAnalyticsService.getProgressTrackerAnalytics({
          from: fromDate,
          to: toDate,
          departmentId,
        }),
        drdAnalyticsService.getCategoryBreakdown({
          from: fromDate,
          to: toDate,
          departmentId,
        }),
      ]);

      if (deptRes.status === 'fulfilled' && deptRes.value?.data) {
        setData(deptRes.value.data);
      }
      if (trackerRes.status === 'fulfilled' && trackerRes.value?.data) {
        setTrackerData(trackerRes.value.data);
      } else {
        setTrackerData(null);
      }
      if (breakdownRes.status === 'fulfilled' && breakdownRes.value?.data) {
        setCategoryBreakdown(breakdownRes.value.data);
      } else {
        setCategoryBreakdown(null);
      }
    } catch (err) {
      if (is403(err)) setAccessDenied(true);
      logger.error('Failed to load department analytics', err);
    } finally {
      setLoading(false);
    }
  }, [departmentId, fromDate, toDate, category]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = data?.kpis;

  const deptInfo = useMemo(
    () => data?.departmentWise?.[0] as any | null,
    [data?.departmentWise],
  );
  const schoolInfo = useMemo(
    () => data?.schoolWise?.[0] as any | null,
    [data?.schoolWise],
  );

  const deptName = deptInfo?.departmentName ?? 'Department Overview';
  const schoolId = schoolInfo?.schoolId ?? searchParams?.get('schoolId') ?? '';
  const schoolName = schoolInfo?.schoolName ?? 'School';

  const people = useMemo(
    () => ((data?.people ?? []) as any[]).slice().sort((a, b) => b.totalApplications - a.totalApplications),
    [data?.people],
  );

  const handleGenerateReport = React.useCallback(() => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    const buildPieChart = (title: string, slices: { label: string; count: number }[], colors: string[]) => {
      const filled = slices.filter((s) => s.count > 0);
      const total = filled.reduce((s, d) => s + d.count, 0);
      if (total === 0) return `<div class="pie-card"><div class="pie-title">${title}</div><div class="pie-empty">No data</div></div>`;
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
        return `<div class="legend-row"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span><span class="legend-label">${d.label}</span><span class="legend-count">${d.count} <span style="color:#94a3b8">(${pct}%)</span></span></div>`;
      }).join('');
      return `<div class="pie-card"><div class="pie-title">${title}</div><div class="pie-body"><svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">${paths}<text x="90" y="86" text-anchor="middle" font-size="22" font-weight="700" fill="#0f172a">${total}</text><text x="90" y="102" text-anchor="middle" font-size="10" fill="#94a3b8">total</text></svg><div class="legend">${legend}</div></div></div>`;
    };

    const BLUE  = ['#3b82f6','#60a5fa','#93c5fd','#1d4ed8','#2563eb','#0ea5e9','#38bdf8','#7dd3fc','#0369a1','#0284c7','#06b6d4'];
    const GREEN  = ['#22c55e','#4ade80','#86efac','#15803d','#16a34a','#10b981','#34d399','#6ee7b7','#065f46','#047857','#059669'];
    const PURPLE = ['#a855f7','#c084fc','#d8b4fe','#7c3aed','#8b5cf6','#6366f1','#818cf8','#a5b4fc','#4338ca','#4f46e5'];
    const AMBER  = ['#f59e0b','#fbbf24','#fcd34d','#b45309','#d97706','#f97316','#fb923c','#fdba74','#c2410c','#ea580c'];

    const cb = categoryBreakdown;
    const chartsHtml = cb ? [
      buildPieChart('Research Papers', (cb.research ?? []).map((x: any) => ({ label: x.label, count: x.count })), BLUE),
      buildPieChart('Books', (cb.book ?? []).filter((b: any) => b.key !== 'chapter').map((x: any) => ({ label: x.label, count: x.count })), GREEN),
      buildPieChart('Book Chapters', (cb.book ?? []).filter((b: any) => b.key === 'chapter').map((x: any) => ({ label: x.label, count: x.count })), PURPLE),
      buildPieChart('Conference', (cb.conference ?? []).map((x: any) => ({ label: x.label, count: x.count })), PURPLE),
      buildPieChart('IPR / Patent', (cb.ipr ?? []).map((x: any) => ({ label: x.label, count: x.count })), AMBER),
      buildPieChart('Grants', (cb.grant ?? []).map((x: any) => ({ label: x.label, count: x.count })), GREEN),
    ].join('') : '<p style="color:#94a3b8;font-size:12px;">No breakdown data available.</p>';

    const kd = data;
    const reportTitle = `${deptName} — Analytics Report`;
    const generatedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    printWindow.document.write(`<!DOCTYPE html>
<html><head>
  <title>${reportTitle}</title>
  <meta charset="utf-8" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; font-family:Inter,sans-serif; }
    body { background:#fff; color:#0f172a; padding:32px; font-size:13px; }
    h1 { font-size:22px; font-weight:700; margin-bottom:4px; }
    .subtitle { font-size:12px; color:#64748b; margin-bottom:24px; }
    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:28px; }
    .kpi-card { border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; background:#f8fafc; }
    .kpi-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#94a3b8; margin-bottom:4px; }
    .kpi-value { font-size:24px; font-weight:700; color:#0f172a; }
    .section { margin-bottom:28px; }
    .section-title { font-size:14px; font-weight:600; color:#1e293b; border-bottom:1.5px solid #e2e8f0; padding-bottom:6px; margin-bottom:12px; }
    .pie-grid { display:flex; flex-wrap:wrap; gap:16px; }
    .pie-card { border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; background:#fff; min-width:240px; flex:1; }
    .pie-title { font-size:13px; font-weight:600; color:#1e293b; margin-bottom:10px; }
    .pie-empty { font-size:12px; color:#94a3b8; padding:20px 0; }
    .pie-body { display:flex; gap:12px; align-items:flex-start; }
    .legend { display:flex; flex-direction:column; gap:5px; justify-content:center; }
    .legend-row { display:flex; align-items:center; gap:6px; font-size:11px; }
    .legend-dot { display:inline-block; width:9px; height:9px; border-radius:50%; flex-shrink:0; }
    .legend-label { flex:1; color:#475569; }
    .legend-count { font-weight:600; color:#0f172a; white-space:nowrap; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    th { background:#f1f5f9; color:#64748b; font-size:10px; font-weight:600; text-transform:uppercase; padding:8px 10px; text-align:left; border-bottom:1px solid #e2e8f0; }
    th.right, td.right { text-align:right; }
    td { padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#334155; }
    tr:last-child td { border-bottom:none; }
    @media print { body { padding:16px; } .page-break { page-break-before:always; } }
  </style>
</head><body>
  <h1>${reportTitle}</h1>
  <p class="subtitle">School: ${schoolName} &nbsp;·&nbsp; Generated: ${generatedOn} &nbsp;·&nbsp; Period: ${fromDate} to ${toDate}</p>

  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">Total Applications</div><div class="kpi-value">${kd?.kpis?.totalApplications ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Approved</div><div class="kpi-value">${kd?.kpis?.approvedCount ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Contributors</div><div class="kpi-value">${kd?.kpis?.totalPeople ?? people.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Incentive</div><div class="kpi-value">&#x20B9;${Number(kd?.kpis?.totalIncentive ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div></div>
    <div class="kpi-card"><div class="kpi-label">Research</div><div class="kpi-value">${kd?.kpis?.totalResearchSubmissions ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Books</div><div class="kpi-value">${kd?.kpis?.totalBookSubmissions ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Conference</div><div class="kpi-value">${kd?.kpis?.totalConferenceSubmissions ?? 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">IPR / Patent</div><div class="kpi-value">${kd?.kpis?.totalPatentSubmissions ?? 0}</div></div>
  </div>

  <div class="section">
    <div class="section-title">Category Breakdown</div>
    <div class="pie-grid">${chartsHtml}</div>
  </div>

  ${people.length > 0 ? `
  <div class="section page-break">
    <div class="section-title">Contributors (${people.length})</div>
    <table>
      <thead><tr>
        <th>#</th><th>Name</th>
        <th class="right">Research</th><th class="right">Book</th><th class="right">Conference</th><th class="right">IPR</th><th class="right">Grants</th>
        <th class="right">Total</th><th class="right">Approved</th><th class="right">Approval %</th><th class="right">Incentive</th>
      </tr></thead>
      <tbody>${people.map((p: any, i: number) => {
        const fc = p.filingCounts || {};
        const rate = p.totalApplications > 0 ? ((p.approvedCount / p.totalApplications) * 100).toFixed(0) : '0';
        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${p.applicantName}</strong></td>
          <td class="right">${fc.research || 0}</td>
          <td class="right">${fc.book || 0}</td>
          <td class="right">${fc.conference || 0}</td>
          <td class="right">${fc.ipr || 0}</td>
          <td class="right">${fc.grants || 0}</td>
          <td class="right"><strong>${p.totalApplications}</strong></td>
          <td class="right">${p.approvedCount}</td>
          <td class="right">${rate}%</td>
          <td class="right">&#x20B9;${Number(p.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>` : ''}

</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
  }, [data, deptName, schoolName, fromDate, toDate, categoryBreakdown, people]);

  return (
    <ProtectedRoute>
      {accessDenied ? (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500 mb-6 text-sm">You don&apos;t have permission to view this department&apos;s analytics.</p>
            <button onClick={() => router.back()} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              Go Back
            </button>
          </div>
        </div>
      ) : (
        <AnalyticsShell>
          <AnalyticsHero
            title={deptName}
            description={`Department-level analytics — submission trends, category breakdown, and contributor details${schoolName ? ` for ${schoolName}` : ''}.`}
            eyebrow="Department Analytics"
            icon={<Building2 className="h-3.5 w-3.5" />}
            onBack={() => schoolId
              ? router.push(`/drd/analytics/applicant/schools/${schoolId}`)
              : router.push('/drd/analytics/applicant')}
            actions={(
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateReport}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20"
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
              { label: 'School', value: schoolName },
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
                {/* KPIs */}
                {kpis && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {[
                      { label: 'Total Applications', value: String(kpis.totalApplications || 0), icon: <BarChart3 className="w-3.5 h-3.5" />, accent: 'from-slate-900 to-sky-700' },
                      { label: 'Research', value: String(kpis.totalResearchSubmissions || 0), icon: null, accent: 'from-blue-600 to-blue-400' },
                      { label: 'Book / Chapter', value: String(kpis.totalBookSubmissions || 0), icon: null, accent: 'from-violet-600 to-violet-400' },
                      { label: 'Conference', value: String(kpis.totalConferenceSubmissions || 0), icon: null, accent: 'from-amber-600 to-amber-400' },
                      { label: 'Approved', value: String(kpis.approvedCount || 0), icon: <CheckCircle2 className="w-3.5 h-3.5" />, accent: 'from-emerald-600 to-green-400' },
                      {
                        label: 'Approved Amount',
                        value: '₹' + (kpis.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }),
                        icon: <Wallet className="w-3.5 h-3.5" />,
                        accent: 'from-teal-600 to-cyan-400',
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${card.accent}`} />
                        <div className="mt-0.5 flex items-start justify-between gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 leading-tight">{card.label}</span>
                          {card.icon && (
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white ${card.accent}`}>{card.icon}</span>
                          )}
                        </div>
                        <div className="mt-2 text-2xl font-bold leading-none tracking-tight text-slate-900">{card.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* All Categories: full-width layout — line chart on top, pies below in 3-col rows */}
                {category === 'all' && (
                  <div className="space-y-6">
                    {data?.extensions?.monthlyTrend && (
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
                        height={280}
                      />
                    )}
                    {categoryBreakdown && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Layers3 className="h-4 w-4 text-blue-500 shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-slate-900 leading-tight">All Categories — Breakdown</h2>
                            <p className="text-xs text-slate-400">Distribution of submissions by publication type and indexing</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <AnalyticsPieChart title="Research Papers" subtitle="By indexing category" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                          <AnalyticsPieChart title="Books" subtitle="Authored & Edited" data={categoryBreakdown.book.filter((b) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                          <AnalyticsPieChart title="Book Chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <AnalyticsPieChart title="Conference Papers" subtitle="National vs International" data={categoryBreakdown.conference} emptyMessage="No conference submissions" colorScheme="amber" />
                          <AnalyticsPieChart title="IPR / Patent" subtitle="Patent, Copyright, Trademark, Design" data={categoryBreakdown.ipr} emptyMessage="No IPR submissions" colorScheme="blue" />
                          <AnalyticsPieChart title="Grants" subtitle="By funding agency" data={categoryBreakdown.grant} emptyMessage="No grant submissions" colorScheme="green" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Other categories: side-by-side — line chart left, breakdown right */}
                {category !== 'all' && (
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

                    {/* RIGHT: Category breakdown */}
                    {categoryBreakdown && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Layers3 className="h-4 w-4 text-blue-500 shrink-0" />
                          <div>
                            <h2 className="text-base font-semibold text-slate-900 leading-tight">
                              {category === 'research' ? 'Research — Indexing Breakdown' :
                               category === 'book' ? 'Books & Chapters — Type Breakdown' :
                               category === 'conference' ? 'Conference — Type Breakdown' :
                               category === 'ipr' ? 'IPR — Type Breakdown' :
                               'Grants — Funding Agency Breakdown'}
                            </h2>
                            <p className="text-xs text-slate-400">Distribution of submissions by publication type and indexing</p>
                          </div>
                        </div>
                        {category === 'research' && (
                          <AnalyticsPieChart title="Research Papers" subtitle="By indexing category" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                        )}
                        {category === 'book' && (
                          <div className="grid grid-cols-2 gap-4">
                            <AnalyticsPieChart title="Books" subtitle="Authored & Edited" data={categoryBreakdown.book.filter((b) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                            <AnalyticsPieChart title="Book Chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
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
                          <AnalyticsPieChart title="IPR by Type" subtitle="Patent, Copyright, Trademark, Design" data={categoryBreakdown.ipr} emptyMessage="No IPR submissions" colorScheme="amber" />
                        )}
                        {category === 'grants' && (
                          <AnalyticsPieChart title="Grants by Funding Agency" subtitle="Top agencies ranked by submission count" data={categoryBreakdown.grant} emptyMessage="No grant submissions" colorScheme="green" />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Research Pipeline */}
                {category === 'research' && trackerData && (
                  <AnalyticsPipelineChart
                    title="Research Pipeline — Current Stage Distribution"
                    subtitle="How many research works from this department are in each stage."
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
                      count: trackerData.statusFunnel?.find((s) => s.status === stage.key)?.count
                        ?? (stage.key === 'rejected' ? (trackerData.kpis?.rejectedCount ?? 0) : 0),
                      color: stage.color,
                      textColor: '',
                    }))}
                  />
                )}

                {/* Contributors */}
                {people.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Users className="w-4 h-4" />
                        Contributors
                        <span className="text-slate-400 font-normal">({people.length})</span>
                      </h3>
                      <ExportActions
                        data={people}
                        filename={`dept-${departmentId}-contributors`}
                        columns={[
                          { key: 'applicantName', label: 'Name' },
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
                          {people.slice(0, 100).map((p: any, i: number) => {
                            const fc = p.filingCounts || {};
                            const rate = p.totalApplications > 0
                              ? ((p.approvedCount / p.totalApplications) * 100).toFixed(0)
                              : '0';
                            return (
                              <tr
                                key={p.personId}
                                onClick={() => router.push(`/drd/analytics/applicant/people/${p.personId}`)}
                                className="cursor-pointer hover:bg-slate-50 transition-colors"
                              >
                                <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-medium text-slate-900 hover:text-sky-700">{p.applicantName}</p>
                                    <p className="text-xs text-slate-400">{rate}% approval</p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-blue-600">{fc.research || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-violet-600">{fc.book || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-amber-600">{fc.conference || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-red-600">{fc.ipr || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600">{fc.grants || 0}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900">{p.totalApplications}</td>
                                <td className="px-4 py-3 text-right text-emerald-600 font-medium">{p.approvedCount}</td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900">
                                  ₹{Number(p.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {!kpis && !loading && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                    <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No data found for the selected filters.</p>
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
