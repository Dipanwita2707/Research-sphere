'use client';

import React, { useState } from 'react';
import { Clock3, CheckCircle2, XCircle, RotateCcw, ArrowLeft, ChevronDown } from 'lucide-react';
import type { ReviewerDetailResponse, ReviewerTimelineEntry } from '@/features/ipr-management/services/drdAnalytics.service';
import KpiCardGrid from './KpiCardGrid';

interface Props {
  data: ReviewerDetailResponse;
  onBack?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  research: 'Research',
  book: 'Book/Chapter',
  conference: 'Conference',
  ipr: 'IPR/Patent',
  grants: 'Grants',
};

const DECISION_BADGE: Record<string, { color: string; icon: React.ReactNode }> = {
  approved: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  recommended: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  recommend: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
  changes_required: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <RotateCcw className="w-3 h-3" /> },
  sent_back: { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: <RotateCcw className="w-3 h-3" /> },
  pending: { color: 'bg-gray-50 text-gray-500 border-gray-200', icon: <Clock3 className="w-3 h-3" /> },
};

export default function ReviewerDetailDrawer({ data, onBack }: Props) {
  const [filterCat, setFilterCat] = useState('all');

  const filteredTimeline = filterCat ===
   'all'
    ? data.timeline
    : data.timeline.filter((t) => t.category ===
   filterCat);

  const categories = Array.from(new Set(data.timeline.map((t) => t.category)));

  const kpiCards = [
    { label: 'Assigned', value: data.kpis.assigned, format: 'number' as const },
    { label: 'Reviewed', value: data.kpis.reviewed, format: 'number' as const },
    { label: 'Pending', value: data.kpis.pending, format: 'number' as const },
    { label: 'Avg Turnaround', value: data.kpis.avgTurnaroundHours, format: 'hours' as const },
    { label: 'Median', value: data.kpis.medianTurnaroundHours, format: 'hours' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {onBack && (
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
        )}
        <div>
          <h2 className="text-xl font-bold text-gray-900">{data.reviewer.name}</h2>
          <p className="text-sm text-gray-500">Reviewer Performance Detail</p>
        </div>
      </div>

      {/* KPIs */}
      <KpiCardGrid cards={kpiCards} />

      {/* Decision Distribution */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Decision Distribution</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Approved', count: data.kpis.decisionDistribution.approved, color: 'bg-emerald-500' },
            { label: 'Rejected', count: data.kpis.decisionDistribution.rejected, color: 'bg-red-400' },
            { label: 'Sent Back', count: data.kpis.decisionDistribution.sentBack, color: 'bg-orange-400' },
            { label: 'Revision Req.', count: data.kpis.decisionDistribution.revisionRequested, color: 'bg-amber-400' },
          ].map((d) => (
            <div key={d.label} className="text-center">
              <div className="text-2xl font-bold text-gray-900">{d.count}</div>
              <div className="text-xs text-gray-500 mt-1">{d.label}</div>
              <div className={`h-1 ${d.color} rounded-full mt-2`} style={{ width: `${Math.max(10, (d.count / Math.max(data.kpis.assigned, 1)) * 100)}%`, margin: '0 auto' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Application Timeline ({filteredTimeline.length})
          </h3>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">Application</th>
                <th className="px-4 py-3 font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 font-medium text-gray-500">School / Dept</th>
                <th className="px-4 py-3 font-medium text-gray-500">Submitted</th>
                <th className="px-4 py-3 font-medium text-gray-500">Assigned</th>
                <th className="px-4 py-3 font-medium text-gray-500">Responded</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">Turnaround</th>
                <th className="px-4 py-3 font-medium text-gray-500">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTimeline.map((t, i) => {
                const badge = DECISION_BADGE[t.decision?.toLowerCase()] || DECISION_BADGE.pending;
                return (
                  <tr key={`${t.applicationId}-${i}`} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 max-w-[200px] truncate">{t.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{t.applicationId.slice(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                        {CATEGORY_LABELS[t.category] || t.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="text-xs">{t.school}</div>
                      {t.department && <div className="text-xs text-gray-400">{t.department}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {t.submittedAt ? new Date(t.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '–'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {t.assignedAt ? new Date(t.assignedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '–'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {t.firstResponseAt ? new Date(t.firstResponseAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '–'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.turnaroundHours !== null ? (
                        <span className={`font-medium text-xs ${t.turnaroundHours > 72 ? 'text-red-500' : t.turnaroundHours > 24 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {t.turnaroundHours.toFixed(1)}h
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${badge.color}`}>
                        {badge.icon}
                        {t.decision || 'pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
