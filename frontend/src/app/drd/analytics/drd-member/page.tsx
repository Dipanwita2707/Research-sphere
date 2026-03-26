'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  ExportActions,
} from '@/components/analytics';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  RefreshCw,
  Sparkles,
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

export default function DrdMemberAnalyticsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DrdMemberPerformanceResponse | null>(null);
  const [fromDate, setFromDate] = useState(isoDate(new Date(Date.now() - 365 * 86400e3)));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [category, setCategory] = useState(searchParams.get('category') || 'all');

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
  const reviewers = data?.reviewers || [];

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
              <div className="flex items-center gap-2">
                <ExportActions
                  data={reviewers}
                  filename="drd-member-performance"
                  columns={[
                    { key: 'reviewerName', label: 'Reviewer' },
                    { key: 'totalReviews', label: 'Total Reviews' },
                    { key: 'approvedCount', label: 'Approved' },
                    { key: 'rejectedCount', label: 'Rejected' },
                    { key: 'avgTurnaroundHours', label: 'Avg Turnaround (hrs)' },
                    { key: 'medianTurnaroundHours', label: 'Median Turnaround (hrs)' },
                  ]}
                />
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
              { label: 'Reviewers', value: String(kpis?.totalReviewers || 0) },
              { label: 'Reviewed', value: String(kpis?.totalReviewed || 0) },
              { label: 'Pending', value: String(kpis?.totalPending || 0) },
              { label: 'Avg Turnaround', value: fmtHours(kpis?.avgTurnaroundHours) },
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
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 animate-pulse">
                  <div className="h-3 bg-slate-100 rounded w-20 mb-3" />
                  <div className="h-7 bg-slate-100 rounded w-16" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* KPIs */}
              {kpis && (
                <KpiCardGrid
                  cards={[
                    {
                      label: 'Total Reviews',
                      value: kpis.totalReviews || 0,
                      icon: <Users className="w-4 h-4" />,
                    },
                    {
                      label: 'Unique Reviewers',
                      value: kpis.uniqueReviewers || 0,
                    },
                    {
                      label: 'Approved',
                      value: kpis.approvedCount || 0,
                      icon: <TrendingUp className="w-4 h-4" />,
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
                      label: 'Avg Turnaround',
                      value: fmtHours(kpis.avgTurnaroundHours),
                      icon: <Clock className="w-4 h-4" />,
                      format: 'text',
                    },
                    {
                      label: 'Median Turnaround',
                      value: fmtHours(kpis.medianTurnaroundHours),
                      format: 'text',
                    },
                  ]}
                />
              )}

              {/* Decision Distribution */}
              {kpis && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-sm font-semibold text-slate-700">Decision Distribution</h3>
                  <div className="flex items-center gap-2 h-6 rounded-full overflow-hidden bg-gray-100">
                    {kpis.totalReviews ? (
                      <>
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${((kpis.approvedCount || 0) / kpis.totalReviews) * 100}%` }}
                          title={`Approved: ${kpis.approvedCount}`}
                        />
                        <div
                          className="h-full bg-red-400 transition-all"
                          style={{ width: `${((kpis.rejectedCount || 0) / kpis.totalReviews) * 100}%` }}
                          title={`Rejected: ${kpis.rejectedCount}`}
                        />
                        <div
                          className="h-full bg-amber-400 transition-all"
                          style={{
                            width: `${(((kpis.totalReviews - (kpis.approvedCount || 0) - (kpis.rejectedCount || 0))) / kpis.totalReviews) * 100}%`,
                          }}
                          title="Other"
                        />
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 text-center w-full py-1">No reviews</div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Approved ({kpis.approvedCount || 0})</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Rejected ({kpis.rejectedCount || 0})</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Other ({(kpis.totalReviews || 0) - (kpis.approvedCount || 0) - (kpis.rejectedCount || 0)})</span>
                  </div>
                </div>
              )}

              {/* Reviewer Leaderboard */}
              {reviewers.length > 0 && (
                <ReviewerLeaderboardTable
                  reviewers={reviewers}
                  onReviewerClick={(id) => router.push(`/drd/analytics/drd-member/${id}`)}
                />
              )}

              {/* Empty state */}
              {!kpis && !loading && (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No review data found for the selected filters.</p>
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
