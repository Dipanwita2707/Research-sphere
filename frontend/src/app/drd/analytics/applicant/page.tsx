'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type DrdAnalyticsResponse,
  type ProgressTrackerAnalyticsData,
  type TrackerStatus,
} from '@/features/ipr-management/services/drdAnalytics.service';
import {
  AnalyticsHero,
  AnalyticsShell,
  KpiCardGrid,
  AnalyticsFilterBar,
  SchoolDepartmentBreakdown,
  AnalyticsBarChart,
  AnalyticsPipelineChart,
  ExportActions,
} from '@/components/analytics';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Layers3,
  RefreshCw,
  Sparkles,
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

function is403(err: unknown): boolean {
  if (err && typeof err ===
   'object' && 'response' in err) {
    return (err as { response?: { status?: number } }).response?.status ===
   403;
  }
  return false;
}

export default function ApplicantAnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DrdAnalyticsResponse | null>(null);
  const [trackerData, setTrackerData] = useState<ProgressTrackerAnalyticsData | null>(null);
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [schoolId, setSchoolId] = useState(searchParams.get('schoolId') || '');
  const [departmentId, setDepartmentId] = useState(searchParams.get('departmentId') || '');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [applicantRes, trackerRes] = await Promise.allSettled([
        drdAnalyticsService.getApplicantAnalytics({
          from: fromDate,
          to: toDate,
          category,
          schoolId: schoolId || undefined,
          departmentId: departmentId || undefined,
        }),
        drdAnalyticsService.getProgressTrackerAnalytics({
          from: fromDate,
          to: toDate,
          schoolId: schoolId || undefined,
          departmentId: departmentId || undefined,
        }),
      ]);

      if (applicantRes.status ===
   'fulfilled' && applicantRes.value?.data) {
        setData(applicantRes.value.data);
      }

      if (trackerRes.status ===
   'fulfilled' && trackerRes.value?.data) {
        setTrackerData(trackerRes.value.data);
      } else {
        setTrackerData(null);
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
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-6">
              You do not have the <strong>Applicant Analytics</strong> permission required to view this page.
            </p>
            <button onClick={() => router.push('/dashboard')} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : (
      <AnalyticsShell>
          <AnalyticsHero
            title="Applicant Analytics"
            description="Track submission volume, approval momentum, school and department concentration, and the most active applicants in one place."
            eyebrow="Submission Intelligence"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            onBack={() => router.push('/drd/analytics/overview')}
            actions={(
              <div className="flex items-center gap-2">
                <ExportActions data={data?.people || []} filename="applicant-analytics" />
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
              { label: 'Schools', value: String((data?.schoolWise || []).length) },
              { label: 'Applicants', value: String((data?.people || []).length) },
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

        <div className="px-6 py-6 sm:px-8 lg:px-12 xl:px-16 space-y-6">

          {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 animate-pulse">
                  <div className="h-2.5 bg-slate-100 rounded w-20 mb-3" />
                  <div className="h-6 bg-slate-100 rounded w-16" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* KPIs */}
              {kpis && (
                <KpiCardGrid
                  cards={[
                    { label: 'Total Applications', value: kpis.totalApplications || 0, icon: <BarChart3 className="w-4 h-4" /> },
                    { label: 'Research', value: kpis.totalResearchSubmissions || 0 },
                    { label: 'Book / Chapter', value: kpis.totalBookSubmissions || 0 },
                    { label: 'Conference', value: kpis.totalConferenceSubmissions || 0 },
                    { label: 'IPR / Patent', value: kpis.totalPatentSubmissions || 0 },
                    { label: 'Grants', value: kpis.totalGrantSubmissions || 0 },
                    { label: 'Approved', value: kpis.approvedCount || 0, icon: <CheckCircle2 className="w-4 h-4" /> },
                    {
                      label: 'Approved Amount',
                      value: kpis.totalIncentive || 0,
                      format: 'currency',
                    },
                  ]}
                />
              )}

              {/* Charts — monthly submissions + progress tracker pipeline */}
              {(data?.extensions?.monthlyTrend || trackerData) && (
                <div className="grid gap-6 xl:grid-cols-2">
                  {data?.extensions?.monthlyTrend && (
                    <AnalyticsBarChart
                      title="Filed vs Approved — Monthly"
                      subtitle="Total submissions filed each month versus those that received approval."
                      data={(data.extensions.monthlyTrend as any[]).map((m) => ({
                        label: m.label || m.month,
                        values: {
                          filed: m.totalApplications || 0,
                          research: m.research || 0,
                          ipr: m.ipr || 0,
                          grants: m.grants || 0,
                          approved: m.approvedCount || 0,
                        },
                      }))}
                      keys={[
                        { key: 'filed', label: 'Total Filed', color: '#6366f1' },
                        { key: 'research', label: 'Research', color: '#3b82f6' },
                        { key: 'ipr', label: 'IPR', color: '#f59e0b' },
                        { key: 'grants', label: 'Grants', color: '#8b5cf6' },
                        { key: 'approved', label: 'Approved', color: '#10b981' },
                      ]}
                      height={320}
                    />
                  )}

                  {trackerData && (
                    <AnalyticsPipelineChart
                      title="Research Pipeline — Current Stage Distribution"
                      subtitle="Monthly progress tracker view across writing, communication, submission, acceptance, publishing, and rejection stages."
                      stages={(
                        [
                          { key: 'writing', label: 'Writing', color: '#6366f1' },
                          { key: 'communicated', label: 'Communicated', color: '#f59e0b' },
                          { key: 'submitted', label: 'Submitted', color: '#3b82f6' },
                          { key: 'accepted', label: 'Accepted', color: '#10b981' },
                          { key: 'published', label: 'Published', color: '#059669' },
                          { key: 'rejected', label: 'Rejected', color: '#ef4444' },
                        ] as { key: TrackerStatus; label: string; color: string }[]
                      ).map((stage) => ({
                        key: stage.key,
                        label: stage.label,
                        count: trackerData.statusFunnel?.find((item) => item.status ===
   stage.key)?.count
                          ?? (stage.key ===
   'rejected' ? (trackerData.kpis?.rejectedCount ?? 0) : 0),
                        color: stage.color,
                        textColor: '',
                      }))}
                    />
                  )}
                </div>
              )}

              {/* School & Dept Breakdown */}
              {data && (
                <SchoolDepartmentBreakdown
                  schoolWise={data.schoolWise || []}
                  departmentWise={data.departmentWise || []}
                  onSchoolClick={(id) => router.push(`/drd/analytics/applicant/schools/${id}`)}
                  onDepartmentClick={(id) => setDepartmentId(id)}
                />
              )}

              {/* Applicant Leaderboard */}
              {data?.people && data.people.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Applicant Leaderboard ({data.people.length})
                    </h3>
                    <ExportActions
                      data={data.people}
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
                        <tr className="bg-slate-50 text-left">
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">#</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Name</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">School</th>
                          <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Department</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Applications</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Approved</th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-400">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {data.people.slice(0, 50).map((p: any, i: number) => (
                          <tr key={p.personId} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 text-slate-400 font-medium">{i + 1}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => router.push(`/drd/analytics/applicant/people/${p.personId}`)}
                                className="font-medium text-slate-900 hover:text-sky-700 hover:underline text-left"
                              >
                                {p.applicantName}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-sm">{p.schoolName}</td>
                            <td className="px-4 py-3 text-slate-600 text-sm">{p.departmentName}</td>
                            <td className="px-4 py-3 text-right font-medium">{p.totalApplications}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">{p.approvedCount}</td>
                            <td className="px-4 py-3 text-right font-medium">
                              ₹{(p.totalIncentive || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
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
