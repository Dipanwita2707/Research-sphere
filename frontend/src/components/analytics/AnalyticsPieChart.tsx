'use client';

import React, { useState } from 'react';
import { seriesColors, ui } from './theme';

export interface PieChartSlice {
  key: string;
  label: string;
  count: number;
  [key: string]: string | number;
}

interface Props {
  data: PieChartSlice[];
  title: string;
  subtitle?: string;
  emptyMessage?: string;
  className?: string;
  /** Ignored — colours come from the shared palette. Kept for backwards compatibility. */
  colorScheme?: 'blue' | 'green' | 'purple' | 'amber';
}

const MAX_SLICES = 5;
const SIZE = 160;
const OUTER = SIZE / 2;
const INNER = OUTER - 22;
const OTHER_KEY = '__other__';
const OTHER_COLOR = 'var(--viz-ink-muted)';

interface Slice {
  key: string;
  label: string;
  count: number;
  folded?: number;
}

function arcPath(start: number, end: number) {
  // Full circle needs two arcs; SVG cannot draw a single 360° arc.
  if (end - start >= Math.PI * 2 - 1e-6) {
    return `M${OUTER},0A${OUTER},${OUTER} 0 1 1 ${OUTER},${SIZE}A${OUTER},${OUTER} 0 1 1 ${OUTER},0Z`
      + `M${OUTER},${OUTER - INNER}A${INNER},${INNER} 0 1 0 ${OUTER},${OUTER + INNER}A${INNER},${INNER} 0 1 0 ${OUTER},${OUTER - INNER}Z`;
  }
  const p = (r: number, a: number) => `${OUTER + r * Math.sin(a)},${OUTER - r * Math.cos(a)}`;
  const large = end - start > Math.PI ? 1 : 0;
  return `M${p(OUTER, start)}A${OUTER},${OUTER} 0 ${large} 1 ${p(OUTER, end)}L${p(INNER, end)}A${INNER},${INNER} 0 ${large} 0 ${p(INNER, start)}Z`;
}

export default function AnalyticsPieChart({
  data,
  title,
  subtitle,
  emptyMessage = 'No data for this period.',
  className = '',
}: Props) {
  const [active, setActive] = useState<number | null>(null);

  const filled = data.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  const total = filled.reduce((s, d) => s + d.count, 0);

  // At most five named slices; everything smaller folds into "Other".
  const slices: Slice[] = filled.length > MAX_SLICES + 1
    ? [
        ...filled.slice(0, MAX_SLICES).map((d) => ({ key: d.key, label: d.label, count: d.count })),
        {
          key: OTHER_KEY,
          label: 'Other',
          count: filled.slice(MAX_SLICES).reduce((s, d) => s + d.count, 0),
          folded: filled.length - MAX_SLICES,
        },
      ]
    : filled.map((d) => ({ key: d.key, label: d.label, count: d.count }));

  const palette = seriesColors(slices.filter((s) => s.key !== OTHER_KEY).map((s) => s.key));
  const colorOf = (s: Slice) => (s.key === OTHER_KEY ? OTHER_COLOR : palette[s.key]);
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  const arcs = slices.reduce<Array<{ start: number; end: number; mid: number }>>((acc, s) => {
    const start = acc.length ? acc[acc.length - 1].end : 0;
    const end = start + (s.count / Math.max(total, 1)) * Math.PI * 2;
    acc.push({ start, end, mid: (start + end) / 2 });
    return acc;
  }, []);

  const activeSlice = active !== null ? slices[active] : null;
  const activeArc = active !== null ? arcs[active] : null;
  const tipX = activeArc ? OUTER + (OUTER + 6) * Math.sin(activeArc.mid) : 0;
  const tipY = activeArc ? OUTER - (OUTER + 6) * Math.cos(activeArc.mid) : 0;

  return (
    <div className={`flex flex-col ${ui.card} ${className}`}>
      <div className={ui.cardHeader}>
        <div className="min-w-0">
          <h3 className={ui.title}>{title}</h3>
          {subtitle && <p className={ui.subtitle}>{subtitle}</p>}
        </div>
      </div>

      {slices.length === 0 ? (
        <div className="flex h-48 items-center justify-center px-5 text-sm text-stone-400 dark:text-gray-500">{emptyMessage}</div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-5 p-5">
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={title} style={{ display: 'block', overflow: 'visible' }}>
              {slices.map((s, i) => (
                <path
                  key={s.key}
                  d={arcPath(arcs[i].start, arcs[i].end)}
                  fillRule="evenodd"
                  strokeWidth={slices.length > 1 ? 2 : 0}
                  strokeLinejoin="round"
                  style={{
                    fill: colorOf(s),
                    stroke: 'var(--viz-surface)',
                    opacity: active === null || active === i ? 1 : 0.45,
                    transition: 'opacity 120ms',
                    cursor: 'default',
                  }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                />
              ))}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-semibold leading-none tabular-nums text-stone-900 dark:text-white">
                {total.toLocaleString('en-IN')}
              </span>
              <span className="mt-1 text-[11px] text-stone-500 dark:text-gray-400">Total</span>
            </div>

            {activeSlice && (
              <div
                className="pointer-events-none absolute z-10 min-w-[140px] -translate-x-1/2 -translate-y-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-900"
                style={{ left: tipX, top: Math.min(tipY, OUTER) - 4 }}
              >
                <p className="mb-1 inline-flex items-center gap-1.5 font-semibold text-stone-900 dark:text-white">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(activeSlice) }} />
                  {activeSlice.label}
                </p>
                <p className="flex justify-between gap-4 tabular-nums text-stone-600 dark:text-gray-300">
                  <span className="font-semibold text-stone-900 dark:text-white">{activeSlice.count.toLocaleString('en-IN')}</span>
                  <span>{pct(activeSlice.count).toFixed(1)}%</span>
                </p>
                {activeSlice.folded && (
                  <p className="mt-1 text-[11px] text-stone-500 dark:text-gray-400">{activeSlice.folded} smaller categories</p>
                )}
              </div>
            )}
          </div>

          <ul className="min-w-[160px] flex-1 space-y-0.5" aria-label="Legend">
            {slices.map((s, i) => (
              <li
                key={s.key}
                className={`flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors ${active === i ? 'bg-stone-100 dark:bg-gray-700' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(s) }} />
                <span className="min-w-0 flex-1 truncate text-stone-600 dark:text-gray-300" title={s.label}>{s.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-stone-900 dark:text-white">{s.count.toLocaleString('en-IN')}</span>
                <span className="w-10 shrink-0 text-right tabular-nums text-stone-400 dark:text-gray-500">{pct(s.count).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
