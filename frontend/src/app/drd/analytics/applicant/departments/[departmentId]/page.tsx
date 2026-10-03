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
  AnalyticsPapersTable,
  KpiCardGrid,
} from '@/components/analytics';
import { categoryColor, seriesColors, ui } from '@/components/analytics/theme';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Layers3,
  LayoutList,
  Printer,
  RefreshCw,
  TrendingUp,
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
  const [fromDate, setFromDate] = useState(searchParams?.get('from') || isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(searchParams?.get('to') || isoDate(new Date()));
  const [category, setCategory] = useState(searchParams?.get('category') || 'all');
  const [viewMode, setViewMode] = useState<'overview' | 'papers'>('overview');

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

  const trendData = (data?.extensions?.monthlyTrend as any[] | undefined)?.map((m) => ({
    label: m.label || m.month,
    values: {
      filed: m.totalApplications || 0,
      approved: m.approvedCount || 0,
    },
  }));
  const trendKeys = [
    { key: 'filed', label: 'Filed' },
    { key: 'approved', label: 'Approved' },
  ];

  const breakdownHeading = (heading: string) => (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
        <Layers3 className="h-4 w-4" />
      </span>
      <div>
        <h2 className={ui.title}>{heading}</h2>
        <p className={ui.subtitle}>Distribution of submissions by publication type and indexing</p>
      </div>
    </div>
  );

  const CONTRIB_COLS = [
    { key: 'research', label: 'Research' },
    { key: 'book', label: 'Book' },
    { key: 'conference', label: 'Conference' },
    { key: 'ipr', label: 'IPR' },
    { key: 'grants', label: 'Grants' },
  ] as const;

  return (
    <ProtectedRoute>
      {accessDenied ? (
        <div className="flex min-h-screen items-center justify-center bg-[#faf8f6] p-6 dark:bg-gray-900">
          <div className={`w-full max-w-md p-8 text-center ${ui.card}`}>
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-stone-900 dark:text-white">Access denied</h2>
            <p className="mb-6 text-sm text-stone-500 dark:text-gray-400">You don&apos;t have permission to view this department&apos;s analytics.</p>
            <button onClick={() => router.back()} className={ui.btnPrimary}>
              Go back
            </button>
          </div>
        </div>
      ) : (
        <AnalyticsShell>
          <AnalyticsHero
            title={deptName}
            description={`Submission trends, category mix and contributor details${schoolName ? ` for this department of ${schoolName}` : ''}.`}
            eyebrow="Department analytics"
            icon={<Building2 className="h-3.5 w-3.5" />}
            onBack={() => schoolId
              ? router.push(`/drd/analytics/applicant/schools/${schoolId}`)
              : router.push('/drd/analytics/applicant')}
            backLabel={schoolId ? `Back to ${schoolName}` : 'Back to applicant analytics'}
            actions={(
              <>
                <button onClick={handleGenerateReport} className={ui.btnSecondary}>
                  <Printer className="h-4 w-4" />
                  Generate report
                </button>
                <button onClick={fetchData} disabled={loading} className={ui.btnSecondary}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </>
            )}
            chips={[
              { label: 'Applications', value: (kpis?.totalApplications || 0).toLocaleString('en-IN') },
              { label: 'Approved', value: (kpis?.approvedCount || 0).toLocaleString('en-IN') },
              { label: 'Contributors', value: (kpis?.totalPeople || people.length).toLocaleString('en-IN') },
              { label: 'Approved amount', value: '₹' + (kpis?.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) },
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

          <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            {viewMode === 'papers' ? (
              <AnalyticsPapersTable
                scope={departmentId ? { type: 'department', id: departmentId } : null}
                fromDate={fromDate}
                toDate={toDate}
              />
            ) : loading ? (
              <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`${ui.card} p-4`}>
                      <div className="mb-3 h-3 w-20 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                      <div className="h-6 w-14 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                    </div>
                  ))}
                </div>
                <div className="h-[340px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
                <div className="h-72 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
              </div>
            ) : (
              <>
                {/* KPIs */}
                {kpis && (
                  <KpiCardGrid
                    cols={6}
                    cards={[
                      { label: 'Total applications', value: kpis.totalApplications || 0, icon: <BarChart3 /> },
                      { label: 'Research', value: kpis.totalResearchSubmissions || 0 },
                      { label: 'Book / Chapter', value: kpis.totalBookSubmissions || 0 },
                      { label: 'Conference', value: kpis.totalConferenceSubmissions || 0 },
                      { label: 'Approved', value: kpis.approvedCount || 0, icon: <CheckCircle2 /> },
                      { label: 'Approved amount', value: kpis.totalIncentive || 0, format: 'currency', icon: <Wallet /> },
                    ]}
                  />
                )}

                {/* All categories: trend on top, six breakdown donuts below */}
                {category === 'all' && (
                  <div className="space-y-6">
                    {trendData && (
                      <TrendChartPanel
                        title="Filed vs approved"
                        subtitle="Applications filed and approved each month"
                        data={trendData}
                        keys={trendKeys}
                        height={280}
                      />
                    )}
                    {categoryBreakdown && (
                      <div className="space-y-4">
                        {breakdownHeading('Category mix')}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <AnalyticsPieChart title="Research papers" subtitle="By indexing category" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                          <AnalyticsPieChart title="Books" subtitle="Authored and edited" data={categoryBreakdown.book.filter((b) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                          <AnalyticsPieChart title="Book chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
                          <AnalyticsPieChart title="Conference papers" subtitle="National vs international" data={categoryBreakdown.conference} emptyMessage="No conference submissions" colorScheme="amber" />
                          <AnalyticsPieChart title="IPR / Patent" subtitle="Patent, copyright, trademark, design" data={categoryBreakdown.ipr} emptyMessage="No IPR submissions" colorScheme="blue" />
                          <AnalyticsPieChart title="Grants" subtitle="By funding agency" data={categoryBreakdown.grant} emptyMessage="No grant submissions" colorScheme="green" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Single category: trend left, breakdown right */}
                {category !== 'all' && (
                  <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                    {trendData ? (
                      <TrendChartPanel
                        title="Filed vs approved"
                        subtitle="Applications filed and approved each month"
                        data={trendData}
                        keys={trendKeys}
                        height={320}
                      />
                    ) : <div />}

                    {categoryBreakdown && (
                      <div className="space-y-4">
                        {breakdownHeading(
                          category === 'research' ? 'Research by indexing' :
                          category === 'book' ? 'Books and chapters by type' :
                          category === 'conference' ? 'Conference papers by type' :
                          category === 'ipr' ? 'IPR by type' :
                          'Grants by funding agency',
                        )}
                        {category === 'research' && (
                          <AnalyticsPieChart title="Research papers" subtitle="By indexing category" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                        )}
                        {category === 'book' && (
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <AnalyticsPieChart title="Books" subtitle="Authored and edited" data={categoryBreakdown.book.filter((b) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                            <AnalyticsPieChart title="Book chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
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
                )}

                {/* Research pipeline */}
                {category === 'research' && trackerData && (
                  <AnalyticsPipelineChart
                    title="Research pipeline"
                    subtitle="How many research works from this department sit in each stage"
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
                      count: trackerData.statusFunnel?.find((s) => s.status === stage.key)?.count
                        ?? (stage.key === 'rejected' ? (trackerData.kpis?.rejectedCount ?? 0) : 0),
                      color: seriesColors(all.map((st) => st.key))[stage.key],
                      textColor: '',
                    }))}
                  />
                )}

                {/* Contributors */}
                {people.length > 0 && (
                  <section className={`overflow-hidden ${ui.card}`}>
                    <div className={ui.cardHeader}>
                      <div>
                        <h3 className={ui.title}>Contributors</h3>
                        <p className={ui.subtitle}>
                          <span className="tabular-nums">{people.length.toLocaleString('en-IN')}</span> people, ranked by applications filed
                        </p>
                      </div>
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
                      <table className="w-full min-w-[820px] text-sm">
                        <thead>
                          <tr className="bg-stone-50 dark:bg-gray-900/40">
                            <th className={`${ui.th} w-12`}>#</th>
                            <th className={ui.th}>Name</th>
                            {CONTRIB_COLS.map((c) => (
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
                          {people.slice(0, 100).map((p: any, i: number) => {
                            const fc = p.filingCounts || {};
                            const rate = p.totalApplications > 0
                              ? ((p.approvedCount / p.totalApplications) * 100).toFixed(0)
                              : '0';
                            return (
                              <tr
                                key={p.personId}
                                onClick={() => router.push(`/drd/analytics/applicant/people/${p.personId}`)}
                                className="group cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40"
                              >
                                <td className="px-4 py-3 tabular-nums text-stone-400 dark:text-gray-500">{i + 1}</td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-stone-900 group-hover:text-wine dark:text-gray-100 dark:group-hover:text-amber">{p.applicantName}</p>
                                  <p className="text-xs tabular-nums text-stone-500 dark:text-gray-400">{rate}% approval</p>
                                </td>
                                {CONTRIB_COLS.map((c) => (
                                  <td key={c.key} className={`px-4 py-3 text-right tabular-nums ${fc[c.key] ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>
                                    {fc[c.key] || 0}
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-stone-900 dark:text-white">{p.totalApplications}</td>
                                <td className={`px-4 py-3 text-right tabular-nums ${p.approvedCount ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>{p.approvedCount}</td>
                                <td className={`px-4 py-3 text-right tabular-nums ${p.totalIncentive ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>
                                  ₹{Number(p.totalIncentive || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </td>
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
                )}

                {!kpis && !loading && (
                  <div className={`${ui.card} p-12 text-center`}>
                    <TrendingUp className="mx-auto mb-3 h-8 w-8 text-stone-300 dark:text-gray-600" aria-hidden="true" />
                    <p className="text-sm text-stone-500 dark:text-gray-400">No data for this period.</p>
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
