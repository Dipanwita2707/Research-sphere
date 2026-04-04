'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KpiCard {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'flat' | { value: number; direction: 'up' | 'down' | 'flat' };
  trendValue?: string;
  format?: 'number' | 'currency' | 'percent' | 'hours' | 'text';
  color?: string;
}

function formatValue(value: number | string, format?: string): string {
  if (typeof value ===
   'string') return value;
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

const TREND_ICON = {
  up: <TrendingUp className="w-3 h-3" />,
  down: <TrendingDown className="w-3 h-3" />,
  flat: <Minus className="w-3 h-3" />,
};

const TREND_COLOR = {
  up: 'text-emerald-500',
  down: 'text-red-400',
  flat: 'text-slate-400',
};

const ACCENT_GRADIENTS = [
  'from-indigo-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-violet-500 to-purple-500',
  'from-sky-500 to-cyan-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-blue-500 to-indigo-500',
  'from-teal-500 to-emerald-500',
];

export default function KpiCardGrid({ cards, cols }: { cards: KpiCard[]; cols?: 4 | 6 | 8 }) {
  const colClass = cols === 4
    ? 'grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4'
    : cols === 8
    ? 'grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8'
    : 'grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8';
  return (
    <div className={`grid ${colClass}`}>
      {cards.map((card, i) => {
        const gradient = ACCENT_GRADIENTS[i % ACCENT_GRADIENTS.length];
        return (
          <div
            key={i}
            className="group relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white dark:bg-gray-800 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] hover:-translate-y-0.5"
          >
            {/* Accent gradient bar */}
            <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${gradient} opacity-80 group-hover:opacity-100 transition-opacity`} />
            {/* Subtle ambient glow */}
            <div className={`pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full bg-gradient-to-br ${gradient} opacity-[0.04] blur-2xl group-hover:opacity-[0.08] transition-opacity`} />

            <div className="relative flex items-start justify-between gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 leading-tight">
                {card.label}
              </span>
              {card.icon && (
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm`}>
                  {card.icon}
                </span>
              )}
            </div>
            <div className="mt-3 text-[1.6rem] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
              {formatValue(card.value, card.format)}
            </div>
            {card.trend && (() => {
              const dir = typeof card.trend ===
   'object' ? card.trend.direction : card.trend;
              const trendLabel = typeof card.trend ===
   'object' ? `${card.trend.value}%` : card.trendValue;
              return (
                <div className={`mt-2.5 inline-flex items-center gap-1 rounded-full border border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium ${TREND_COLOR[dir]}`}>
                  {TREND_ICON[dir]}
                  {trendLabel && <span>{trendLabel}</span>}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
