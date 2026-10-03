'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ui } from './theme';

export interface KpiCard {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'flat' | { value: number; direction: 'up' | 'down' | 'flat' };
  trendValue?: string;
  format?: 'number' | 'currency' | 'percent' | 'hours' | 'text';
  /** Kept for backwards compatibility; tiles are intentionally monochrome. */
  color?: string;
}

function formatValue(value: number | string, format?: string): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'hours':
      return `${value.toFixed(1)}h`;
    default:
      return value.toLocaleString('en-IN');
  }
}

const TREND = {
  up:   { Icon: TrendingUp,   cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', label: 'Up' },
  down: { Icon: TrendingDown, cls: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', label: 'Down' },
  flat: { Icon: Minus,        cls: 'bg-stone-100 text-stone-600 dark:bg-gray-700 dark:text-gray-300', label: 'Flat' },
};

// Soft tinted chips give each metric its own identity without colouring the numbers.
const TINTS = [
  { chip: 'bg-rose-50 text-wine dark:bg-wine/30 dark:text-rose-200', rule: 'bg-wine' },
  { chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', rule: 'bg-amber-500' },
  { chip: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', rule: 'bg-sky-500' },
  { chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', rule: 'bg-emerald-500' },
  { chip: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', rule: 'bg-violet-500' },
  { chip: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', rule: 'bg-teal-500' },
];

export default function KpiCardGrid({ cards, cols }: { cards: KpiCard[]; cols?: 4 | 6 | 8 }) {
  const colClass = cols === 4
    ? 'grid-cols-2 md:grid-cols-4'
    : cols === 8
    ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8'
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
  return (
    <div className={`grid gap-3 ${colClass}`}>
      {cards.map((card, i) => {
        const dir = card.trend ? (typeof card.trend === 'object' ? card.trend.direction : card.trend) : null;
        const trendLabel = card.trend && typeof card.trend === 'object' ? `${card.trend.value}%` : card.trendValue;
        const t = dir ? TREND[dir] : null;
        return (
          <div key={i} className={`relative overflow-hidden ${ui.card} p-4`}>
            <span className={`absolute inset-x-0 top-0 h-1 ${TINTS[i % TINTS.length].rule}`} />
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium leading-snug text-stone-500 dark:text-gray-400">{card.label}</span>
              {card.icon && (
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TINTS[i % TINTS.length].chip} [&_svg]:h-4 [&_svg]:w-4`}>
                  {card.icon}
                </span>
              )}
            </div>
            <div className="mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums text-stone-900 dark:text-white">
              {formatValue(card.value, card.format)}
            </div>
            {t && (
              <div className={`mt-2.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${t.cls}`}>
                <t.Icon className="h-3 w-3" aria-label={t.label} />
                {trendLabel && <span>{trendLabel}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
