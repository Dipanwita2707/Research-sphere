'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Ratio } from '../types';

export interface CompletenessItem {
  key: string;
  label: string;
  ratio: Ratio;
  /** Actionable hint shown when something is missing; receives the missing count. */
  hint: (missing: number) => string;
}

function tone(percent: number) {
  if (percent >= 90) return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' };
  if (percent >= 60) return { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' };
  return { bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' };
}

/** One data-completeness meter with an actionable hint for what is missing. */
export function CompletenessBar({ item }: { item: CompletenessItem }) {
  const { known, total, percent } = item.ratio;
  const missing = total - known;
  const id = `completeness-${item.key}`;

  if (percent === null) {
    return (
      <li className="py-2.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span id={id} className="text-stone-700 dark:text-gray-200">{item.label}</span>
          <span className="text-xs text-stone-400 dark:text-gray-500">No records in range</span>
        </div>
      </li>
    );
  }

  const t = tone(percent);
  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span id={id} className="text-stone-700 dark:text-gray-200">{item.label}</span>
        <span className={`shrink-0 text-xs font-semibold tabular-nums ${t.text}`}>
          {percent.toFixed(percent % 1 === 0 ? 0 : 1)}%
          <span className="ml-1 font-normal text-stone-400 dark:text-gray-500">({known.toLocaleString('en-IN')}/{total.toLocaleString('en-IN')})</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700"
        role="progressbar"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div className={`h-full rounded-full ${t.bar} transition-[width] duration-500`} style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      {missing > 0 ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-stone-500 dark:text-gray-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
          {item.hint(missing)}
        </p>
      ) : (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Complete
        </p>
      )}
    </li>
  );
}

export function CompletenessList({ items }: { items: CompletenessItem[] }) {
  return <ul className="divide-y divide-stone-100 dark:divide-gray-700">{items.map((item) => <CompletenessBar key={item.key} item={item} />)}</ul>;
}
