'use client';

import React, { useEffect, useRef, useState } from 'react';
import { countAxisMax, formatTick, seriesColors, ui } from './theme';

export interface BarChartDataPoint {
  label: string;
  values: Record<string, number>;
}

export interface BarChartSeries {
  key: string;
  label: string;
  /** Ignored — colours come from the shared palette so entities match across charts. */
  color?: string;
}

interface Props {
  data: BarChartDataPoint[];
  keys: BarChartSeries[];
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
  /** Stack series inside one bar per group (part-to-whole) instead of side by side. */
  stacked?: boolean;
  /** Optional click handler per group, e.g. to drill into a school. */
  onBarClick?: (point: BarChartDataPoint, index: number) => void;
}

const MARGIN = { top: 12, right: 8, bottom: 36, left: 40 };
const TICKS = 4;
const GAP = 2; // surface gap between adjacent fills

/** Bar with 4px rounded data-end and a square baseline end. */
function barPath(x: number, y: number, w: number, h: number, roundTop: boolean) {
  if (h <= 0 || w <= 0) return '';
  const r = roundTop ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export default function AnalyticsBarChart({
  data, keys, title, subtitle, height = 320, className = '', stacked = false, onBarClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    obs.observe(el);
    setWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  const colors = seriesColors(keys.map((k) => k.key));

  const header = (title || subtitle || keys.length > 1) && (
    <div className={ui.cardHeader}>
      <div className="min-w-0">
        {title && <h3 className={ui.title}>{title}</h3>}
        {subtitle && <p className={ui.subtitle}>{subtitle}</p>}
      </div>
      {keys.length > 1 && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
          {keys.map((k) => (
            <li key={k.key} className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-gray-300">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[k.key] }} />
              {k.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!data.length) {
    return (
      <div className={`${ui.card} ${className}`}>
        {header}
        <div className="flex h-40 items-center justify-center text-sm text-stone-400 dark:text-gray-500">No data for this period.</div>
      </div>
    );
  }

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const groupTotal = (d: BarChartDataPoint) => keys.reduce((s, k) => s + (d.values[k.key] || 0), 0);
  const maxVal = Math.max(
    1,
    ...data.map((d) => (stacked ? groupTotal(d) : Math.max(...keys.map((k) => d.values[k.key] || 0)))),
  );
  const yMax = countAxisMax(maxVal, TICKS);
  const y = (v: number) => plotH - (v / yMax) * plotH;
  const groupW = plotW / data.length;
  const innerW = Math.min(groupW * (stacked ? 0.56 : 0.72), stacked ? 48 : 22 * keys.length);
  const barW = stacked ? innerW : Math.max((innerW - GAP * (keys.length - 1)) / keys.length, 2);
  const maxChars = Math.max(4, Math.floor(groupW / 6.2));

  const hovered = hover !== null ? data[hover] : null;
  const tipLeft = hover !== null ? MARGIN.left + hover * groupW + groupW / 2 : 0;

  return (
    <div className={`${ui.card} ${className}`}>
      {header}
      <div className="relative px-3 pb-3 pt-2" ref={containerRef}>
        <svg width="100%" height={height} role="img" aria-label={title || 'Bar chart'} style={{ display: 'block', overflow: 'visible' }}>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {Array.from({ length: TICKS + 1 }).map((_, i) => {
              const v = (yMax / TICKS) * i;
              return (
                <g key={i}>
                  <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} style={{ stroke: i === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)' }} />
                  <text x={-8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} style={{ fill: 'var(--viz-ink-muted)' }}>
                    {formatTick(Math.round(v))}
                  </text>
                </g>
              );
            })}

            {data.map((d, di) => {
              const gx = di * groupW;
              const x0 = gx + (groupW - innerW) / 2;
              const dim = hover !== null && hover !== di;
              let acc = 0;
              const visibleStack = keys.filter((k) => (d.values[k.key] || 0) > 0);
              const topKey = visibleStack[visibleStack.length - 1]?.key;
              return (
                <g key={di} style={{ opacity: dim ? 0.45 : 1, transition: 'opacity 120ms' }}>
                  {keys.map((k, ki) => {
                    const v = d.values[k.key] || 0;
                    if (v <= 0) return null;
                    if (stacked) {
                      const yTop = y(acc + v);
                      const h = y(acc) - yTop - (acc > 0 ? GAP : 0);
                      acc += v;
                      return <path key={k.key} d={barPath(x0, yTop, barW, Math.max(h, 1), k.key === topKey)} style={{ fill: colors[k.key] }} />;
                    }
                    const h = plotH - y(v);
                    return <path key={k.key} d={barPath(x0 + ki * (barW + GAP), y(v), barW, Math.max(h, 1), true)} style={{ fill: colors[k.key] }} />;
                  })}
                  <text x={gx + groupW / 2} y={plotH + 18} textAnchor="middle" fontSize={11} style={{ fill: 'var(--viz-ink-muted)' }}>
                    <title>{d.label}</title>
                    {d.label.length > maxChars ? `${d.label.slice(0, maxChars - 1)}…` : d.label}
                  </text>
                  {/* Hit target: the whole column, larger than the marks */}
                  <rect
                    x={gx} y={0} width={groupW} height={plotH + 24} fill="transparent"
                    style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                    onMouseEnter={() => setHover(di)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onBarClick?.(d, di)}
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[170px] -translate-x-1/2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-900"
            style={{ left: Math.min(Math.max(tipLeft, 95), width - 95) }}
          >
            <p className="mb-1.5 font-semibold text-stone-900 dark:text-white">{hovered.label}</p>
            <ul className="space-y-1">
              {keys.map((k) => (
                <li key={k.key} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-gray-300">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colors[k.key] }} />
                    {k.label}
                  </span>
                  <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{(hovered.values[k.key] || 0).toLocaleString('en-IN')}</span>
                </li>
              ))}
              {stacked && keys.length > 1 && (
                <li className="mt-1 flex justify-between border-t border-stone-100 pt-1 dark:border-gray-700">
                  <span className="text-stone-500 dark:text-gray-400">Total</span>
                  <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{groupTotal(hovered).toLocaleString('en-IN')}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
