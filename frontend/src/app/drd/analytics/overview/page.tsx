'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsResponse,
  type DrdMemberPerformanceResponse,
} from '@/features/ipr-management/services/drdAnalytics.service';
import { AnalyticsHero, AnalyticsShell, KpiCardGrid, AnalyticsFilterBar, TrendChartPanel, AnalyticsBarChart } from '@/components/analytics';
import {
  AlertCircle,
  BarChart3,
  Users,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Layers3,
  ArrowRight,
  RefreshCw,
  GraduationCap,
  Sparkles,
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

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = { from: fromDate, to: toDate, category };
      const [appRes, drdRes] = await Promise.allSettled([
        drdAnalyticsService.getApplicantAnalytics(filters),
        drdAnalyticsService.getDrdMemberPerformance(filters),
      ]);

      // If both fail with 403, user has no analytics permission
      const app403 = appRes.status ===
   'rejected' && is403(appRes.reason);
      const drd403 = drdRes.status ===
   'rejected' && is403(drdRes.reason);
      if (app403 && drd403) {
        setAccessDenied(true);
        return;
      }

      if (appRes.status ===
   'fulfilled' && appRes.value?.data) {
        setApplicantData(appRes.value.data);
      }
      if (drdRes.status ===
   'fulfilled' && drdRes.value?.data) {
        setDrdData(drdRes.value.data);
      }
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
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">
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

        <div className="px-6 py-6 sm:px-8 lg:px-12 xl:px-16 space-y-6">

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse">
                  <div className="h-3 bg-slate-100 rounded w-20 mb-3" />
                  <div className="h-7 bg-slate-100 rounded w-16" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Applicant KPIs */}
              {appKpis && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Layers3 className="w-4 h-4" />
                      Applicant Submissions
                    </h2>
                    <button
                      onClick={() => router.push('/drd/analytics/applicant')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      View Details <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <KpiCardGrid
                    cards={[
                      { label: 'Total Applications', value: appKpis.totalApplications || 0, icon: <BarChart3 className="w-4 h-4" /> },
                      { label: 'Research', value: appKpis.totalResearchSubmissions || 0 },
                      { label: 'IPR / Patent', value: appKpis.totalPatentSubmissions || 0 },
                      { label: 'Grants', value: appKpis.totalGrantSubmissions || 0 },
                      { label: 'Approved', value: appKpis.approvedCount || 0, icon: <CheckCircle2 className="w-4 h-4" /> },
                      { label: 'Approved Amount', value: appKpis.totalIncentive || 0, format: 'currency' },
                    ]}
                  />
                </section>
              )}

              {/* DRD Member KPIs */}
              {drdKpis && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Users className="w-4 h-4" />
                      DRD Review Performance
                    </h2>
                    <button
                      onClick={() => router.push('/drd/analytics/drd-member')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      View Details <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <KpiCardGrid
                    cards={[
                      { label: 'Reviewers', value: drdKpis.totalReviewers || 0, icon: <Users className="w-4 h-4" /> },
                      { label: 'Total Assigned', value: drdKpis.totalAssigned || 0 },
                      { label: 'Reviewed', value: drdKpis.totalReviewed || 0, icon: <CheckCircle2 className="w-4 h-4" /> },
                      { label: 'Pending', value: drdKpis.totalPending || 0 },
                      { label: 'Avg Turnaround', value: drdKpis.avgTurnaroundHours || 0, format: 'hours', icon: <Clock3 className="w-4 h-4" /> },
                      { label: 'Median', value: drdKpis.medianTurnaroundHours || 0, format: 'hours' },
                    ]}
                  />
                </section>
              )}

              {/* School Comparison — category-level bar chart + table */}
              {applicantData && schoolRows.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <GraduationCap className="w-4 h-4" />
                      School Comparison — Category Breakdown
                      <span className="text-xs font-normal text-slate-400">
                        ({schoolRows.length} school{schoolRows.length !== 1 ? 's' : ''} in scope)
                      </span>
                    </h2>
                  </div>

                  {/* Bar chart — each school shows Research / Book / Conference / IPR / Grants */}
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
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">School-wise Research Output</h3>
                        <p className="mt-0.5 text-xs text-slate-400">Click any row to open that school&apos;s department comparison &amp; contributor details.</p>
                      </div>
                      <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500">{schoolRows.length} school{schoolRows.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-left">
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
                        <tbody className="divide-y divide-slate-50">
                          {schoolRows.map((school: any) => {
                            const fc = school.filingCounts || {};
                            return (
                              <tr
                                key={school.schoolId}
                                onClick={() => router.push(`/drd/analytics/applicant/schools/${school.schoolId}`)}
                                className="cursor-pointer transition-colors hover:bg-slate-50"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shrink-0">
                                      <GraduationCap className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-slate-900">{school.schoolName}</p>
                                      <p className="text-xs text-slate-400">View departments →</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-blue-600">{fc.research || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-violet-600">{fc.book || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-amber-600">{fc.conference || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-red-600">{fc.ipr || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-600">{fc.grants || 0}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900">{school.totalApplications || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-emerald-700">{school.totalApproved || 0}</td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900">₹{(school.totalIncentive || 0).toLocaleString('en-IN')}</td>
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
                    { key: 'approved', label: 'Approved', color: '#10b981' },
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
                      <h3 className="font-semibold text-slate-900">Applicant Analytics</h3>
                      <p className="mt-1 text-sm text-slate-500">Submission trends, school/department breakdowns, applicant leaderboard</p>
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
                      <h3 className="font-semibold text-slate-900">DRD Member Analytics</h3>
                      <p className="mt-1 text-sm text-slate-500">Reviewer performance, turnaround times, decision distribution</p>
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
                      <h3 className="font-semibold text-slate-900">Progress Tracker Analytics</h3>
                      <p className="mt-1 text-sm text-slate-500">Research pipeline stages, active researchers &amp; category breakdown</p>
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
