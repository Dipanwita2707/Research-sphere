'use client';

import React, { useState } from 'react';
import { Clock3, CheckCircle2, AlertCircle, ChevronRight, Users, ArrowUp, ArrowDown } from 'lucide-react';
import type { ReviewerPerformanceEntry } from '@/features/ipr-management/services/drdAnalytics.service';
import { ui } from './theme';

interface Props {
  reviewers: ReviewerPerformanceEntry[];
  onReviewerClick?: (reviewerId: string) => void;
  selfView?: boolean;
}

type SortKey = 'reviewerName' | 'assigned' | 'reviewed' | 'pending' | 'avgTurnaroundHours' | 'medianTurnaroundHours';

/** Turnaround status: colour always paired with an icon and the number itself. */
function turnaroundStatus(hours: number) {
  if (hours > 72) return { Icon: AlertCircle, cls: 'text-red-700 dark:text-red-300', label: 'Slow (over 72h)' };
  if (hours > 24) return { Icon: Clock3, cls: 'text-amber-700 dark:text-amber-300', label: 'Moderate (24–72h)' };
  return { Icon: CheckCircle2, cls: 'text-emerald-700 dark:text-emerald-300', label: 'Fast (under 24h)' };
}

function SortHeader({ label, field, sortKey, sortAsc, onSort }: {
  label: string;
  field: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === field;
  return (
    <th className={`${ui.th} text-right`} aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-stone-900 dark:hover:text-white ${active ? 'text-stone-900 dark:text-white' : ''}`}
      >
        {label}
        {active && (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

export default function ReviewerLeaderboardTable({ reviewers, onReviewerClick, selfView }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('reviewed');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...reviewers].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortProps = { sortKey, sortAsc, onSort: handleSort };

  if (!reviewers.length) {
    return (
      <div className={`${ui.card} flex flex-col items-center gap-2 p-10 text-center text-sm text-stone-400 dark:text-gray-500`}>
        <Users className="h-6 w-6" />
        No reviewer data for this period.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${ui.card}`}>
      <div className={ui.cardHeader}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wine/10 text-wine dark:bg-wine/30 dark:text-amber">
            <Users className="h-4 w-4" />
          </div>
          <h3 className={ui.title}>{selfView ? 'Your performance' : 'Reviewer leaderboard'}</h3>
        </div>
        <span className="text-xs tabular-nums text-stone-500 dark:text-gray-400">
          {reviewers.length} reviewer{reviewers.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 dark:bg-gray-900/40">
            <tr>
              <th className={ui.th}>Reviewer</th>
              <SortHeader label="Assigned" field="assigned" {...sortProps} />
              <SortHeader label="Reviewed" field="reviewed" {...sortProps} />
              <SortHeader label="Pending" field="pending" {...sortProps} />
              <SortHeader label="Avg turnaround" field="avgTurnaroundHours" {...sortProps} />
              <SortHeader label="Median" field="medianTurnaroundHours" {...sortProps} />
              <th className={ui.th}>Decisions</th>
              <th className="w-10 px-4 py-2.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
            {sorted.map((r) => {
              const total = r.decisionDistribution.approved + r.decisionDistribution.rejected +
                r.decisionDistribution.sentBack + r.decisionDistribution.revisionRequested;
              const approvedPct = total > 0 ? ((r.decisionDistribution.approved / total) * 100).toFixed(0) : '0';
              const rejectedPct = total > 0 ? ((r.decisionDistribution.rejected / total) * 100).toFixed(0) : '0';
              const ta = turnaroundStatus(r.avgTurnaroundHours);

              return (
                <tr
                  key={r.reviewerId}
                  className="cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40"
                  onClick={() => onReviewerClick?.(r.reviewerId)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-900 dark:text-gray-100">{r.reviewerName}</div>
                    {r.lastActiveAt && (
                      <div className="mt-0.5 text-xs text-stone-500 dark:text-gray-400">
                        Last active {new Date(r.lastActiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-stone-900 dark:text-white">{r.assigned}</td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${r.reviewed > 0 ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-gray-600'}`}>{r.reviewed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.pending > 0 ? (
                      <span className="font-medium text-amber-700 dark:text-amber-300">{r.pending}</span>
                    ) : (
                      <span className="text-stone-300 dark:text-gray-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${ta.cls}`} title={ta.label}>
                      <ta.Icon className="h-3.5 w-3.5" aria-label={ta.label} />
                      {r.avgTurnaroundHours.toFixed(1)}h
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-stone-600 dark:text-gray-300">
                    {r.medianTurnaroundHours.toFixed(1)}h
                  </td>
                  <td className="px-4 py-3">
                    {total > 0 ? (
                      <div className="flex items-center gap-2" title={`${approvedPct}% approved, ${rejectedPct}% rejected`}>
                        <div className="flex h-1.5 w-20 gap-px overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                          <div className="h-full bg-emerald-500" style={{ width: `${approvedPct}%` }} />
                          <div className="h-full bg-red-500" style={{ width: `${rejectedPct}%` }} />
                        </div>
                        <span className="whitespace-nowrap text-xs tabular-nums text-stone-500 dark:text-gray-400">{approvedPct}% approved</span>
                      </div>
                    ) : (
                      <span className="text-xs text-stone-300 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="h-4 w-4 text-stone-300 dark:text-gray-600" />
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
