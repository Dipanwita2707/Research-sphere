'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  drdAnalyticsService,
  type ReviewerDetailResponse,
} from '@/features/ipr-management/services/drdAnalytics.service';
import { KpiCardGrid, ExportActions } from '@/components/analytics';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  TrendingDown,
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
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
    case 'rejected':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600 rounded-full"><XCircle className="w-3 h-3" /> Rejected</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-full"><Clock className="w-3 h-3" /> {status}</span>;
  }
}

export default function ReviewerDetailPage() {
  const router = useRouter();
  const params = useParams();
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/drd/analytics/drd-member')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {data?.reviewer?.name || 'Reviewer Detail'}
              </h1>
              {data?.reviewer?.email && (
                <p className="text-sm text-gray-500 mt-1">{data.reviewer.email}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
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
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
                  <div className="h-6 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* KPIs */}
              {kpis && (
                <KpiCardGrid
                  cards={[
                    { label: 'Total Reviews', value: kpis.totalReviews || 0, icon: <FileText className="w-4 h-4" /> },
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
                      label: 'Avg Turnaround',
                      value: fmtHours(kpis.avgTurnaroundHours),
                      format: 'text',
                      icon: <Clock className="w-4 h-4" />,
                    },
                    {
                      label: 'Median Turnaround',
                      value: fmtHours(kpis.medianTurnaroundHours),
                      format: 'text',
                    },
                    {
                      label: 'Fastest Review',
                      value: fmtHours(kpis.fastestTurnaroundHours),
                      format: 'text',
                    },
                  ]}
                />
              )}

              {/* Decision Distribution */}
              {kpis && kpis.totalReviews > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Decision Distribution</h3>
                  <div className="flex items-center gap-1 h-8 rounded-full overflow-hidden bg-gray-100">
                    <div
                      className="h-full bg-emerald-500 rounded-l-full transition-all flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${((kpis.approvedCount || 0) / kpis.totalReviews) * 100}%`, minWidth: kpis.approvedCount ? '30px' : 0 }}
                    >
                      {kpis.approvedCount || ''}
                    </div>
                    <div
                      className="h-full bg-red-400 transition-all flex items-center justify-center text-white text-xs font-medium"
                      style={{ width: `${((kpis.rejectedCount || 0) / kpis.totalReviews) * 100}%`, minWidth: kpis.rejectedCount ? '30px' : 0 }}
                    >
                      {kpis.rejectedCount || ''}
                    </div>
                    <div
                      className="h-full bg-amber-400 rounded-r-full transition-all flex items-center justify-center text-white text-xs font-medium"
                      style={{
                        width: `${((kpis.totalReviews - (kpis.approvedCount || 0) - (kpis.rejectedCount || 0)) / kpis.totalReviews) * 100}%`,
                        minWidth: (kpis.totalReviews - (kpis.approvedCount || 0) - (kpis.rejectedCount || 0)) > 0 ? '30px' : 0,
                      }}
                    >
                      {(kpis.totalReviews - (kpis.approvedCount || 0) - (kpis.rejectedCount || 0)) || ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Approved</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Rejected</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Other</span>
                  </div>
                </div>
              )}

              {/* Review Timeline Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Review Timeline ({filteredTimeline.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {['all', 'approved', 'rejected'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          statusFilter === s
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-3 font-medium text-gray-500">#</th>
                        <th className="px-4 py-3 font-medium text-gray-500">Application</th>
                        <th className="px-4 py-3 font-medium text-gray-500">Category</th>
                        <th className="px-4 py-3 font-medium text-gray-500">Decision</th>
                        <th
                          className="px-4 py-3 font-medium text-gray-500 cursor-pointer select-none"
                          onClick={() => toggleSort('date')}
                        >
                          Date {sortBy === 'date' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                        </th>
                        <th
                          className="px-4 py-3 font-medium text-gray-500 text-right cursor-pointer select-none"
                          onClick={() => toggleSort('turnaround')}
                        >
                          Turnaround {sortBy === 'turnaround' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredTimeline.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                            No reviews found
                          </td>
                        </tr>
                      ) : (
                        filteredTimeline.slice(0, 100).map((entry, i) => {
                          const turnaroundColor =
                            (entry.turnaroundHours || 0) < 24
                              ? 'text-emerald-600'
                              : (entry.turnaroundHours || 0) < 72
                              ? 'text-amber-600'
                              : 'text-red-600';
                          return (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                              <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                                {entry.applicationTitle || 'Untitled'}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-sm capitalize">
                                {entry.category}
                              </td>
                              <td className="px-4 py-3">{statusBadge(entry.decision)}</td>
                              <td className="px-4 py-3 text-gray-500 text-sm">
                                {entry.reviewedAt
                                  ? new Date(entry.reviewedAt).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })
                                  : '—'}
                              </td>
                              <td className={`px-4 py-3 text-right font-medium ${turnaroundColor}`}>
                                {fmtHours(entry.turnaroundHours)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </ProtectedRoute>
  );
}
