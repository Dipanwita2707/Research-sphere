'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsResponse,
  type ProgressTrackerAnalyticsData,
  type TrackerStatus,
  type CategoryBreakdownResponse,
} from '@/features/ipr-management/services/drdAnalytics.service';
import {
  AnalyticsHero,
  AnalyticsShell,
  KpiCardGrid,
  AnalyticsFilterBar,
  SchoolDepartmentBreakdown,
  TrendChartPanel,
  AnalyticsPieChart,
  AnalyticsPipelineChart,
  ExportActions,
  AnalyticsPapersTable,
} from '@/components/analytics';
import { seriesColors, ui } from '@/components/analytics/theme';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Layers3,
  RefreshCw,
  Sparkles,
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

function is403(err: unknown): boolean {
  if (err && typeof err ===
   'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status ===
   403;
  }
  return false;
}

const LEADERBOARD_PAGE_SIZE = 10;

function LeaderboardTable({ people, router }: { people: any[]; router: ReturnType<typeof useRouter> }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(people.length / LEADERBOARD_PAGE_SIZE);
  const start = page * LEADERBOARD_PAGE_SIZE;
  const slice = people.slice(start, start + LEADERBOARD_PAGE_SIZE);

  return (
    <section className={`overflow-hidden ${ui.card}`}>
      <div className={ui.cardHeader}>
        <div>
          <h3 className={ui.title}>Applicant leaderboard</h3>
          <p className={ui.subtitle}>
            <span className="tabular-nums">{people.length.toLocaleString('en-IN')}</span> applicants ranked by applications filed
          </p>
        </div>
        <ExportActions
          data={people}
          filename="applicant-leaderboard"
          columns={[
            { key: 'applicantName', label: 'Name' },
            { key: 'schoolName', label: 'School' },
            { key: 'departmentName', label: 'Department' },
            { key: 'totalApplications', label: 'Applications' },
            { key: 'approvedCount', label: 'Approved' },
            { key: 'totalIncentive', label: 'Approved Amount' },
          ]}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 dark:bg-gray-900/40">
              <th className={`${ui.th} w-12`}>#</th>
              <th className={ui.th}>Name</th>
              <th className={`${ui.th} hidden md:table-cell`}>School</th>
              <th className={`${ui.th} hidden lg:table-cell`}>Department</th>
              <th className={`${ui.th} text-right`}>Applications</th>
              <th className={`${ui.th} text-right`}>Approved</th>
              <th className={`${ui.th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
            {slice.map((p: any, i: number) => (
              <tr key={p.personId} className="transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40">
                <td className="px-4 py-3 text-sm tabular-nums text-stone-400 dark:text-gray-500">{start + i + 1}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => router.push(`/drd/analytics/applicant/people/${p.personId}`)}
                    className="text-left text-sm font-medium text-stone-900 hover:text-wine hover:underline dark:text-gray-100 dark:hover:text-amber"
                  >
                    {p.applicantName}
                  </button>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-gray-400 md:hidden">{p.schoolName}</p>
                </td>
                <td className="hidden px-4 py-3 text-sm text-stone-600 dark:text-gray-300 md:table-cell">{p.schoolName}</td>
                <td className="hidden px-4 py-3 text-sm text-stone-600 dark:text-gray-300 lg:table-cell">{p.departmentName}</td>
                <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-stone-900 dark:text-gray-100">{p.totalApplications}</td>
                <td className={`px-4 py-3 text-right text-sm tabular-nums ${p.approvedCount ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>{p.approvedCount}</td>
                <td className={`px-4 py-3 text-right text-sm tabular-nums ${p.totalIncentive ? 'text-stone-700 dark:text-gray-200' : 'text-stone-300 dark:text-gray-600'}`}>
                  ₹{(p.totalIncentive || 0).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3 dark:border-gray-700">
          <span className="text-xs tabular-nums text-stone-500 dark:text-gray-400">
            Showing {start + 1}–{Math.min(start + LEADERBOARD_PAGE_SIZE, people.length)} of {people.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg p-1.5 text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-medium tabular-nums text-stone-600 dark:text-gray-300">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg p-1.5 text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ApplicantAnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams()!;

  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DrdAnalyticsResponse | null>(null);
  const [trackerData, setTrackerData] = useState<ProgressTrackerAnalyticsData | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownResponse | null>(null);
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [category, setCategory] = useState(searchParams?.get('category') || 'all');
  const [schoolId, setSchoolId] = useState(searchParams?.get('schoolId') || '');
  const [departmentId, setDepartmentId] = useState(searchParams?.get('departmentId') || '');
  const [viewMode, setViewMode] = useState<'overview' | 'papers'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        from: fromDate,
        to: toDate,
        category,
        schoolId: schoolId || undefined,
        departmentId: departmentId || undefined,
      };
      const [applicantRes, trackerRes, breakdownRes] = await Promise.allSettled([
        drdAnalyticsService.getApplicantAnalytics(filters),
        drdAnalyticsService.getProgressTrackerAnalytics({
          from: fromDate,
          to: toDate,
          schoolId: schoolId || undefined,
          departmentId: departmentId || undefined,
        }),
        drdAnalyticsService.getCategoryBreakdown(filters),
      ]);

      if (applicantRes.status === 'fulfilled' && applicantRes.value?.data) {
        setData(applicantRes.value.data);
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
      if (is403(err)) {
        setAccessDenied(true);
      }
      logger.error('Failed to load applicant analytics', err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, category, schoolId, departmentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpis = data?.kpis;
  const schoolOptions = (data?.schoolWise || []).map((s: any) => ({
    value: s.schoolId,
    label: s.schoolName,
  }));
  const departmentOptions = (data?.departmentWise || [])
    .filter((d: any) => !schoolId || d.schoolId ===
   schoolId)
    .map((d: any) => ({ value: d.departmentId, label: d.departmentName }));

  return (
    <ProtectedRoute>
      {accessDenied ? (
        <div className="flex min-h-screen items-center justify-center bg-[#faf8f6] p-6 dark:bg-gray-900">
          <div className={`w-full max-w-md p-8 text-center ${ui.card}`}>
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-stone-900 dark:text-white">Access denied</h2>
            <p className="mb-6 text-sm text-stone-500 dark:text-gray-400">
              You do not have the <strong className="font-medium text-stone-700 dark:text-gray-200">Applicant Analytics</strong> permission required to view this page.
            </p>
            <button onClick={() => router.push('/dashboard')} className={ui.btnPrimary}>
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : (
      <AnalyticsShell>
          <AnalyticsHero
            title="Applicant analytics"
            description="Submission volume, approval momentum, school and department concentration, and the most active applicants in one place."
            eyebrow="Submission intelligence"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            onBack={() => router.push('/drd/analytics/overview')}
            actions={(
              <div className="flex items-center gap-2">
                <ExportActions data={data?.people || []} filename="applicant-analytics" />
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
              { label: 'Applications', value: (kpis?.totalApplications || 0).toLocaleString('en-IN') },
              { label: 'Approved', value: (kpis?.approvedCount || 0).toLocaleString('en-IN') },
              { label: 'Schools', value: (data?.schoolWise || []).length.toLocaleString('en-IN') },
              { label: 'Applicants', value: (data?.people || []).length.toLocaleString('en-IN') },
            ]}
          />

          {/* Filters */}
          <AnalyticsFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            category={category}
            onCategoryChange={(v) => { setCategory(v); setSchoolId(''); setDepartmentId(''); }}
            categoryOptions={CATEGORY_OPTIONS}
            schoolId={schoolId}
            onSchoolChange={(v) => { setSchoolId(v); setDepartmentId(''); }}
            schoolOptions={schoolOptions}
            departmentId={departmentId}
            onDepartmentChange={setDepartmentId}
            departmentOptions={departmentOptions}
            onApply={fetchData}
            onReset={() => {
              setFromDate(isoDate(new Date(Date.now() - 365 * 86400e3)));
              setToDate(isoDate(new Date()));
              setCategory('all');
              setSchoolId('');
              setDepartmentId('');
            }}
          />

          {/* View mode tabs */}
          <div className="border-b border-stone-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6 lg:px-8">
            <div className="-mb-px flex gap-1 overflow-x-auto" role="tablist" aria-label="View">
              {([
                { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                { key: 'papers', label: 'Papers & Trackers', icon: <LayoutList className="w-3.5 h-3.5" /> },
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
              scope={
                departmentId ? { type: 'department', id: departmentId } :
                schoolId ? { type: 'school', id: schoolId } :
                null
              }
              fromDate={fromDate}
              toDate={toDate}
            />
          ) : loading ? (
            <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={`${ui.card} p-4`}>
                    <div className="mb-3 h-3 w-20 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                    <div className="h-6 w-14 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="h-[380px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
                <div className="h-[380px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
              </div>
              <div className="h-72 animate-pulse rounded-xl bg-stone-100 dark:bg-gray-800" />
            </div>
          ) : (
            <>
              {/* KPIs */}
              {kpis && (
                <KpiCardGrid
                  cols={8}
                  cards={[
                    { label: 'Total applications', value: kpis.totalApplications || 0, icon: <BarChart3 className="w-4 h-4" /> },
                    { label: 'Research', value: kpis.totalResearchSubmissions || 0 },
                    { label: 'Book / Chapter', value: kpis.totalBookSubmissions || 0 },
                    { label: 'Conference', value: kpis.totalConferenceSubmissions || 0 },
                    { label: 'IPR / Patent', value: kpis.totalPatentSubmissions || 0 },
                    { label: 'Grants', value: kpis.totalGrantSubmissions || 0 },
                    { label: 'Approved', value: kpis.approvedCount || 0, icon: <CheckCircle2 className="w-4 h-4" /> },
                    {
                      label: 'Approved amount',
                      value: kpis.totalIncentive || 0,
                      format: 'currency',
                    },
                  ]}
                />
              )}

              {/* Monthly Trend + Category Breakdown — side by side */}
              <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                {/* LEFT: Line chart */}
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
                    height={320}
                  />
                ) : <div />}

                {/* RIGHT: Category breakdown pie charts */}
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
                        <p className={ui.subtitle}>
                          Distribution of submissions by publication type, indexing and classification
                        </p>
                      </div>
                    </div>

                    {/* ALL — Research Papers + Books in right column */}
                    {category === 'all' && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <AnalyticsPieChart title="Research Papers" subtitle="By indexing category" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                        <AnalyticsPieChart title="Books" subtitle="Authored & Edited" data={categoryBreakdown.book.filter((b: any) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                      </div>
                    )}

                    {/* RESEARCH */}
                    {category === 'research' && (
                      <div className="grid grid-cols-1 gap-4">
                        <AnalyticsPieChart title="Research Papers" subtitle="By indexing category (11 types)" data={categoryBreakdown.research} emptyMessage="No research submissions" colorScheme="blue" />
                      </div>
                    )}

                    {/* BOOK — split into 2 */}
                    {category === 'book' && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <AnalyticsPieChart title="Books" subtitle="Authored & Edited" data={categoryBreakdown.book.filter((b: any) => b.key !== 'chapter')} emptyMessage="No book submissions" colorScheme="green" />
                        <AnalyticsPieChart title="Book Chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b: any) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
                      </div>
                    )}

                    {/* CONFERENCE — type + subtype */}
                    {category === 'conference' && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <AnalyticsPieChart title="Conference Type" subtitle="National vs International" data={categoryBreakdown.conference} emptyMessage="No conference submissions" colorScheme="purple" />
                        {categoryBreakdown.conferenceSubtype.length > 0 && (
                          <AnalyticsPieChart title="Conference Sub-Type" subtitle="Paper category breakdown" data={categoryBreakdown.conferenceSubtype} emptyMessage="No subtype data" colorScheme="amber" />
                        )}
                      </div>
                    )}

                    {/* IPR */}
                    {category === 'ipr' && (
                      <div className="grid grid-cols-1 gap-4">
                        <AnalyticsPieChart title="IPR by Type" subtitle="Patent, Copyright, Trademark, Design" data={categoryBreakdown.ipr} emptyMessage="No IPR submissions" colorScheme="amber" />
                      </div>
                    )}

                    {/* GRANTS */}
                    {category === 'grants' && (
                      <div className="grid grid-cols-1 gap-4">
                        <AnalyticsPieChart title="Grants by Funding Agency" subtitle="Top agencies ranked by submission count" data={categoryBreakdown.grant} emptyMessage="No grant submissions" colorScheme="green" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ALL — bottom 4 pies, full width */}
              {category === 'all' && categoryBreakdown && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <AnalyticsPieChart title="Book Chapters" subtitle="Chapter contributions" data={categoryBreakdown.book.filter((b: any) => b.key === 'chapter')} emptyMessage="No chapter submissions" colorScheme="purple" />
                  <AnalyticsPieChart title="Conference Papers" subtitle="National vs International" data={categoryBreakdown.conference} emptyMessage="No conference submissions" colorScheme="amber" />
                  <AnalyticsPieChart title="IPR / Patent" subtitle="Patent, Copyright, Trademark, Design" data={categoryBreakdown.ipr} emptyMessage="No IPR submissions" colorScheme="blue" />
                  <AnalyticsPieChart title="Grants" subtitle="By funding agency" data={categoryBreakdown.grant} emptyMessage="No grant submissions" colorScheme="green" />
                </div>
              )}

              {/* Research Pipeline — only for research category */}
              {category === 'research' && trackerData && (
                <AnalyticsPipelineChart
                  title="Research pipeline"
                  subtitle="Where tracked papers currently sit, from writing through to publication or rejection"
                  stages={(
                    [
                      { key: 'writing', label: 'Writing' },
                      { key: 'communicated', label: 'Communicated' },
                      { key: 'submitted', label: 'Submitted' },
                      { key: 'accepted', label: 'Accepted' },
                      { key: 'published', label: 'Published' },
                      { key: 'rejected', label: 'Rejected' },
                    ] as { key: TrackerStatus; label: string }[]
                  ).map((stage, _i, all) => ({
                    key: stage.key,
                    label: stage.label,
                    count: trackerData.statusFunnel?.find((item) => item.status === stage.key)?.count
                      ?? (stage.key === 'rejected' ? (trackerData.kpis?.rejectedCount ?? 0) : 0),
                    color: seriesColors(all.map((st) => st.key))[stage.key],
                    textColor: '',
                  }))}
                />
              )}

              {/* School & Dept Breakdown */}
              {data && (
                <SchoolDepartmentBreakdown
                  schoolWise={data.schoolWise || []}
                  departmentWise={data.departmentWise || []}
                  onSchoolClick={(id) => router.push(`/drd/analytics/applicant/schools/${id}?from=${fromDate}&to=${toDate}&category=${category}`)}
                  onDepartmentClick={(deptId) => {
                    router.push(`/drd/analytics/applicant/departments/${deptId}?from=${fromDate}&to=${toDate}&category=${category}`);
                  }}
                />
              )}

              {/* Applicant Leaderboard */}
              {data?.people && data.people.length > 0 && (
                <LeaderboardTable people={data.people} router={router} />
              )}
            </>
          )}
        </div>
      </AnalyticsShell>
      )}
    </ProtectedRoute>
  );
}

