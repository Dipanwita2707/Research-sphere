'use client';

import React from 'react';
import { FileSpreadsheet, PencilLine } from 'lucide-react';
import { AnalyticsPanel } from '@/components/analytics';
import { ui } from '@/components/analytics/theme';
import { CompletenessList, type CompletenessItem } from './CompletenessBar';

export interface IncludedSheet {
  name: string;
  detail: string;
  /** Template only: headers with no data (the system does not track it). */
  manual?: boolean;
}

export interface PreviewStat {
  label: string;
  value: string;
  hint?: string;
}

interface Props {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  sheets: IncludedSheet[];
  stats: PreviewStat[] | null;
  completeness: CompletenessItem[] | null;
  notes?: string[];
  loading: boolean;
  /** Newer numbers are on the way; dim the current ones. */
  refreshing?: boolean;
  download: React.ReactNode;
}

function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[68px] animate-pulse rounded-xl bg-stone-100 dark:bg-gray-700/60" />
      ))}
    </div>
  );
}

function CompletenessSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
          <div className="h-1.5 animate-pulse rounded bg-stone-100 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

/** One accreditation export: what is included, a live preview, data completeness and download. */
export function ReportCard({ title, subtitle, icon, sheets, stats, completeness, notes, loading, refreshing = false, download }: Props) {
  return (
    <AnalyticsPanel title={title} subtitle={subtitle} icon={icon} className="flex flex-col">
      <div className="space-y-6">
        <div className={`space-y-6 transition-opacity ${refreshing ? 'opacity-60' : ''}`} aria-busy={loading || refreshing}>
          <section aria-label={`${title} preview`}>
            <h3 className={`${ui.label} mb-2.5`}>Preview for the selected period</h3>
            {loading || !stats ? (
              <StatSkeleton />
            ) : (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-stone-100 bg-stone-50/60 px-3.5 py-3 dark:border-gray-700 dark:bg-gray-900/40">
                    <dt className="text-[11px] font-medium leading-snug text-stone-500 dark:text-gray-400">{s.label}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-stone-900 dark:text-white">{s.value}</dd>
                    {s.hint && <dd className="mt-0.5 text-[11px] text-stone-400 dark:text-gray-500">{s.hint}</dd>}
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section aria-label={`${title} data completeness`}>
            <h3 className={`${ui.label} mb-1`}>Data completeness</h3>
            {loading || !completeness ? <CompletenessSkeleton /> : <CompletenessList items={completeness} />}
            {!loading && notes && notes.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-stone-500 dark:text-gray-400">
                {notes.map((n) => <li key={n}>• {n}</li>)}
              </ul>
            )}
          </section>
        </div>

        <details className="group rounded-xl border border-stone-200 dark:border-gray-700">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium text-stone-800 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-wine/30 dark:text-gray-100 dark:hover:bg-gray-700/40">
            <span>What&apos;s in the workbook ({sheets.length} sheets)</span>
            <span className="text-xs text-stone-400 transition-transform group-open:rotate-180" aria-hidden>▾</span>
          </summary>
          <ul className="space-y-2 border-t border-stone-100 px-4 py-3 dark:border-gray-700">
            {sheets.map((s) => (
              <li key={s.name} className="flex items-start gap-2.5 text-sm">
                {s.manual ? (
                  <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Template to fill manually" />
                ) : (
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-wine dark:text-amber" aria-label="Generated from data" />
                )}
                <span>
                  <span className="font-medium text-stone-800 dark:text-gray-100">{s.name}</span>
                  <span className="block text-xs text-stone-500 dark:text-gray-400">{s.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>

        <div className="border-t border-stone-100 pt-4 dark:border-gray-700">{download}</div>
      </div>
    </AnalyticsPanel>
  );
}
