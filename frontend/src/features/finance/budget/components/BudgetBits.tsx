'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, OctagonAlert } from 'lucide-react';
import { seriesColors } from '@/components/analytics/theme';
import { formatINR, formatINRCompact } from '../../utils/format';
import { statusMeta, utilisationSplit } from '../budgetTree';
import type { BudgetFigures, BudgetStatus } from '../types';

/** Utilised and committed keep one colour everywhere on the budget screens. */
export const BURN_COLORS = seriesColors(['utilised', 'committed']);

const ICONS = { healthy: CheckCircle2, warning: AlertTriangle, over: OctagonAlert, none: CircleDashed } as const;

/** Status: icon + label + colour, never colour alone. */
export function BudgetStatusBadge({ status, warnPct = 80, compact = false }: { status: BudgetStatus; warnPct?: number; compact?: boolean }) {
  const meta = statusMeta(status, warnPct);
  const Icon = ICONS[meta.icon];
  return (
    <span
      title={meta.description}
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-700 dark:border-gray-600 dark:bg-gray-900/60 dark:text-gray-200"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} aria-hidden="true" />
      <span className={compact ? 'truncate' : ''}>{meta.label}</span>
    </span>
  );
}

/** Allocation used: utilised (paid) then committed, on a neutral track; overflow marked. */
export function UtilisationBar({ figures, className = '', showLabel = true }: { figures: Pick<BudgetFigures, 'allocated' | 'utilised' | 'committed' | 'utilisationPct'>; className?: string; showLabel?: boolean }) {
  const split = utilisationSplit(figures);
  const pct = figures.utilisationPct;
  const label = pct == null ? (split.overflow ? 'Spending with no allocation' : 'Nothing allocated') : `${pct.toLocaleString('en-IN')}% used`;
  return (
    <div className={className}>
      <div
        className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-stone-100 dark:bg-gray-700"
        role="img"
        aria-label={`${label}: ${formatINR(figures.utilised)} paid, ${formatINR(figures.committed)} committed of ${formatINR(figures.allocated)}`}
      >
        {split.utilised > 0 && <div className="h-full" style={{ width: `${split.utilised}%`, backgroundColor: BURN_COLORS.utilised }} />}
        {split.committed > 0 && <div className="h-full" style={{ width: `${split.committed}%`, backgroundColor: BURN_COLORS.committed }} />}
      </div>
      {showLabel && (
        <p className="mt-1 text-[11px] tabular-nums text-stone-500 dark:text-gray-400">
          {label}{split.overflow && pct != null ? ' · over allocation' : ''}
        </p>
      )}
    </div>
  );
}

export function BurnLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600 dark:text-gray-300" aria-label="Legend">
      <li className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BURN_COLORS.utilised }} aria-hidden="true" />Utilised (paid)</li>
      <li className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BURN_COLORS.committed }} aria-hidden="true" />Committed (recommended, on hold, approved)</li>
    </ul>
  );
}

export function Money({ value, compact }: { value: number; compact?: boolean }) {
  return <span className="tabular-nums">{compact ? formatINRCompact(value) : formatINR(value)}</span>;
}

/** Label/value pair used in cards and the side panel. */
export function Figure({ label, value, tone, compact = true }: { label: string; value: number; tone?: 'negative'; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:text-gray-400">{label}</dt>
      <dd className={`truncate text-sm font-semibold tabular-nums ${tone === 'negative' ? 'text-red-700 dark:text-red-300' : 'text-stone-900 dark:text-white'}`}>
        {compact ? formatINRCompact(value) : formatINR(value)}
      </dd>
    </div>
  );
}
