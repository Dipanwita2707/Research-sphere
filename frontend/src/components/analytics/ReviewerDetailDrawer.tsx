'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Clock3, CheckCircle2, XCircle, RotateCcw, X } from 'lucide-react';
import type { ReviewerDetailResponse } from '@/features/ipr-management/services/drdAnalytics.service';
import KpiCardGrid from './KpiCardGrid';
import { categoryColor, ui } from './theme';

interface Props {
  data: ReviewerDetailResponse;
  /** Closes the sheet (overlay click, Escape, or the close button). */
  onBack?: () => void;
  /** Controlled visibility. Defaults to open while mounted. */
  open?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  research: 'Research',
  book: 'Book/Chapter',
  conference: 'Conference',
  ipr: 'IPR/Patent',
  grants: 'Grants',
};

const DECISION_BADGE: Record<string, { color: string; icon: React.ReactNode }> = {
  approved: { color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" /> },
  recommended: { color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" /> },
  recommend: { color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: <XCircle className="h-3 w-3" /> },
  changes_required: { color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <RotateCcw className="h-3 w-3" /> },
  sent_back: { color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <RotateCcw className="h-3 w-3" /> },
  pending: { color: 'bg-stone-100 text-stone-600 dark:bg-gray-700 dark:text-gray-300', icon: <Clock3 className="h-3 w-3" /> },
};

const DECISION_STATS = [
  { key: 'approved', label: 'Approved', bar: 'bg-emerald-500', Icon: CheckCircle2, icon: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'rejected', label: 'Rejected', bar: 'bg-red-500', Icon: XCircle, icon: 'text-red-600 dark:text-red-400' },
  { key: 'sentBack', label: 'Sent back', bar: 'bg-amber-500', Icon: RotateCcw, icon: 'text-amber-600 dark:text-amber-400' },
  { key: 'revisionRequested', label: 'Revision requested', bar: 'bg-amber-400', Icon: RotateCcw, icon: 'text-amber-600 dark:text-amber-400' },
] as const;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

const decisionLabel = (d: string) => {
  const s = (d || 'pending').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function ReviewerDetailDrawer({ data, onBack, open = true }: Props) {
  const [filterCat, setFilterCat] = useState('all');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onBack]);

  if (!open) return null;

  const filteredTimeline = filterCat === 'all'
    ? data.timeline
    : data.timeline.filter((t) => t.category === filterCat);

  const categories = Array.from(new Set(data.timeline.map((t) => t.category)));

  const kpiCards = [
    { label: 'Assigned', value: data.kpis.assigned, format: 'number' as const },
    { label: 'Reviewed', value: data.kpis.reviewed, format: 'number' as const },
    { label: 'Pending', value: data.kpis.pending, format: 'number' as const },
    { label: 'Avg turnaround', value: data.kpis.avgTurnaroundHours, format: 'hours' as const },
    { label: 'Median', value: data.kpis.medianTurnaroundHours, format: 'hours' as const },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="reviewer-drawer-title">
      <div className="absolute inset-0 bg-stone-900/40 dark:bg-black/60" onClick={() => onBack?.()} aria-hidden="true" />

      <aside className="relative flex h-full w-full max-w-4xl flex-col border-l border-stone-200 bg-[#faf8f6] shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-wine dark:text-amber">Reviewer performance</p>
            <h2 id="reviewer-drawer-title" className="truncate text-xl font-semibold tracking-tight text-stone-900 dark:text-white">
              {data.reviewer.name}
            </h2>
            {data.reviewer.email && <p className="mt-0.5 truncate text-sm text-stone-500 dark:text-gray-400">{data.reviewer.email}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onBack?.()}
            aria-label="Close reviewer details"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-wine/15 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-6">
          <KpiCardGrid cards={kpiCards} />

          {/* Decision distribution */}
          <section className={ui.card}>
            <div className={ui.cardHeader}>
              <h3 className={ui.title}>Decision distribution</h3>
            </div>
            <dl className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
              {DECISION_STATS.map((d) => {
                const count = data.kpis.decisionDistribution[d.key];
                const pct = Math.min(100, (count / Math.max(data.kpis.assigned, 1)) * 100);
                return (
                  <div key={d.key}>
                    <dt className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-400">
                      <d.Icon className={`h-3.5 w-3.5 ${d.icon}`} aria-hidden="true" />
                      {d.label}
                    </dt>
                    <dd className={`mt-1 text-2xl ${ui.value} ${count === 0 ? '!text-stone-300 dark:!text-gray-600' : ''}`}>{count}</dd>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700">
                      <div className={`h-full rounded-full ${d.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </dl>
          </section>

          {/* Timeline */}
          <section className={`overflow-hidden ${ui.card}`}>
            <div className={ui.cardHeader}>
              <h3 className={ui.title}>
                Application timeline <span className="ml-1 font-normal tabular-nums text-stone-500 dark:text-gray-400">({filteredTimeline.length})</span>
              </h3>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
                aria-label="Filter by category"
                className={`${ui.input} h-8 text-xs`}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                ))}
              </select>
            </div>

            {filteredTimeline.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-stone-400 dark:text-gray-500">No data for this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 dark:bg-gray-900/40">
                    <tr>
                      <th className={ui.th}>Application</th>
                      <th className={ui.th}>Category</th>
                      <th className={ui.th}>School / dept</th>
                      <th className={ui.th}>Submitted</th>
                      <th className={ui.th}>Assigned</th>
                      <th className={ui.th}>Responded</th>
                      <th className={`${ui.th} text-right`}>Turnaround</th>
                      <th className={ui.th}>Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
                    {filteredTimeline.map((t, i) => {
                      const badge = DECISION_BADGE[t.decision?.toLowerCase()] || DECISION_BADGE.pending;
                      return (
                        <tr key={`${t.applicationId}-${i}`} className="transition-colors hover:bg-stone-50 dark:hover:bg-gray-700/40">
                          <td className="px-4 py-3">
                            <div className="max-w-[220px] truncate font-medium text-stone-900 dark:text-gray-100" title={t.title}>{t.title}</div>
                            <div className="mt-0.5 font-mono text-[11px] text-stone-400 dark:text-gray-500">{t.applicationId.slice(0, 8)}…</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-stone-700 dark:text-gray-200">
                              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: categoryColor(t.category) }} />
                              {CATEGORY_LABELS[t.category] || t.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-600 dark:text-gray-300">
                            <div>{t.school}</div>
                            {t.department && <div className="text-stone-400 dark:text-gray-500">{t.department}</div>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-stone-500 dark:text-gray-400">{fmtDate(t.submittedAt)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-stone-500 dark:text-gray-400">{fmtDate(t.assignedAt)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-stone-500 dark:text-gray-400">{fmtDate(t.firstResponseAt)}</td>
                          <td className="px-4 py-3 text-right">
                            {t.turnaroundHours !== null ? (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${t.turnaroundHours > 72 ? 'text-red-700 dark:text-red-300' : t.turnaroundHours > 24 ? 'text-amber-700 dark:text-amber-300' : 'text-stone-900 dark:text-white'}`}
                                title={t.turnaroundHours > 72 ? 'Slow (over 72h)' : t.turnaroundHours > 24 ? 'Moderate (24–72h)' : 'Fast (under 24h)'}
                              >
                                {t.turnaroundHours > 24 && <Clock3 className="h-3 w-3" aria-hidden="true" />}
                                {t.turnaroundHours.toFixed(1)}h
                              </span>
                            ) : (
                              <span className="text-xs text-stone-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                              {badge.icon}
                              {decisionLabel(t.decision)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
