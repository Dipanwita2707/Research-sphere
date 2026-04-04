'use client';

import React, { useState } from 'react';
import { Clock3, CheckCircle2, AlertCircle, ChevronRight, Users } from 'lucide-react';
import type { ReviewerPerformanceEntry } from '@/features/ipr-management/services/drdAnalytics.service';

interface Props {
  reviewers: ReviewerPerformanceEntry[];
  onReviewerClick?: (reviewerId: string) => void;
  selfView?: boolean;
}

type SortKey = 'reviewerName' | 'assigned' | 'reviewed' | 'pending' | 'avgTurnaroundHours' | 'medianTurnaroundHours';

export default function ReviewerLeaderboardTable({ reviewers, onReviewerClick, selfView }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('reviewed');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...reviewers].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av ===
   'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey ===
   key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none text-right"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey ===
   field && <span className="text-xs">{sortAsc ? 'â†‘' : 'â†“'}</span>}
      </span>
    </th>
  );

  if (!reviewers.length) {
    return (
      <div className="rounded-[24px] border border-white/70 dark:border-slate-700 bg-white/85 dark:bg-gray-800 p-8 text-center text-slate-400 dark:text-slate-500 shadow-[0_16px_36px_-24px_rgba(15,23,42,0.22)] backdrop-blur-sm">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
        No reviewer data available for the selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/70 dark:border-slate-700 bg-white/85 dark:bg-gray-800 shadow-[0_18px_44px_-24px_rgba(15,23,42,0.24)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-5 py-4">
        <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-200">
          <Users className="w-4 h-4" />
          {selfView ? 'Your Performance' : 'Reviewer Leaderboard'}
        </h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">{reviewers.length} reviewer{reviewers.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/90 dark:bg-gray-700/80 text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Reviewer</th>
              <SortHeader label="Assigned" field="assigned" />
              <SortHeader label="Reviewed" field="reviewed" />
              <SortHeader label="Pending" field="pending" />
              <SortHeader label="Avg Turnaround" field="avgTurnaroundHours" />
              <SortHeader label="Median" field="medianTurnaroundHours" />
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Decisions</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {sorted.map((r) => {
              const total = r.decisionDistribution.approved + r.decisionDistribution.rejected +
                r.decisionDistribution.sentBack + r.decisionDistribution.revisionRequested;
              const approvedPct = total > 0 ? ((r.decisionDistribution.approved / total) * 100).toFixed(0) : '0';
              const rejectedPct = total > 0 ? ((r.decisionDistribution.rejected / total) * 100).toFixed(0) : '0';

              return (
                <tr
                  key={r.reviewerId}
                  className="cursor-pointer transition-colors hover:bg-sky-50/40 dark:hover:bg-slate-700/50"
                  onClick={() => onReviewerClick?.(r.reviewerId)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{r.reviewerName}</div>
                    {r.lastActiveAt && (
                      <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        Last active: {new Date(r.lastActiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">{r.assigned}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">{r.reviewed}</td>
                  <td className="px-4 py-3 text-right">
                    {r.pending > 0 ? (
                      <span className="text-amber-600 font-medium">{r.pending}</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${r.avgTurnaroundHours > 72 ? 'text-red-500' : r.avgTurnaroundHours > 24 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {r.avgTurnaroundHours.toFixed(1)}h
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                    {r.medianTurnaroundHours.toFixed(1)}h
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-center">
                      {total > 0 && (
                        <>
                          <div className="flex h-2 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-600">
                            <div className="bg-emerald-500 h-full" style={{ width: `${approvedPct}%` }} />
                            <div className="bg-red-400 h-full" style={{ width: `${rejectedPct}%` }} />
                          </div>
                          <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">{approvedPct}%</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

