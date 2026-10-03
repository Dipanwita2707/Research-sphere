'use client';

import React, { useRef, useEffect, useState } from 'react';
import { countAxisMax, formatTick, seriesColors, ui } from './theme';

interface BarData { label: string; values: Record<string, number> }

interface Props {
  data: BarData[];
  /** `color` is ignored — colours come from the shared palette. */
  keys: { key: string; label: string; color?: string }[];
  title?: string;
  subtitle?: string;
  height?: number;
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 40 };
const TICKS = 4;

export default function TrendChartPanel({ data, keys, title, subtitle, height = 280 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    obs.observe(el);
    setWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  const colors = seriesColors(keys.map((k) => k.key));

  const header = (
    <div className={ui.cardHeader}>
      <div>
        {title && <h3 className={ui.title}>{title}</h3>}
        {subtitle && <p className={ui.subtitle}>{subtitle}</p>}
      </div>
      {keys.length > 1 && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
          {keys.map((k) => (
            <li key={k.key} className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-gray-300">
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: colors[k.key] }} />
              {k.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (!data.length) {
    return (
      <div className={ui.card}>
        {header}
        <div className="flex h-40 items-center justify-center text-sm text-stone-400 dark:text-gray-500">No trend data for this period.</div>
      </div>
    );
  }

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 1);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const maxVal = Math.max(1, ...data.flatMap((d) => keys.map((k) => d.values[k.key] || 0)));
  const yMax = countAxisMax(maxVal, TICKS);
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const xAt = (i: number) => (data.length > 1 ? i * stepX : plotW / 2);
  const yAt = (v: number) => plotH - (v / yMax) * plotH;
  // Show every nth x label so they never collide (~56px per label).
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 56))));
  const single = keys.length === 1;

  const linePath = (key: string) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(d.values[key] || 0)}`).join('');

  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  const tipLeft = hoverIdx !== null ? MARGIN.left + xAt(hoverIdx) : 0;

  return (
    <div className={ui.card}>
      {header}
      <div className="relative px-3 pb-3 pt-2" ref={containerRef}>
        <svg width="100%" height={height} role="img" aria-label={title || 'Trend chart'} style={{ display: 'block', overflow: 'visible' }}>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {Array.from({ length: TICKS + 1 }).map((_, i) => {
              const v = (yMax / TICKS) * i;
              return (
                <g key={i}>
                  <line x1={0} x2={plotW} y1={yAt(v)} y2={yAt(v)} style={{ stroke: i === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)' }} />
                  <text x={-8} y={yAt(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} style={{ fill: 'var(--viz-ink-muted)' }}>
                    {formatTick(Math.round(v))}
                  </text>
                </g>
              );
            })}

            {/* A soft area only when there is one series — stacked translucent areas muddy each other. */}
            {single && data.length > 1 && (
              <path
                d={`${linePath(keys[0].key)}L${xAt(data.length - 1)},${plotH}L${xAt(0)},${plotH}Z`}
                style={{ fill: colors[keys[0].key], opacity: 0.1 }}
              />
            )}

            {keys.map((k) => (
              <path key={k.key} d={linePath(k.key)} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: colors[k.key] }} />
            ))}

            {hoverIdx !== null && (
              <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={0} y2={plotH} style={{ stroke: 'var(--viz-axis)' }} strokeDasharray="3 3" />
            )}

            {keys.map((k) =>
              data.map((d, i) => {
                const show = hoverIdx === i || data.length === 1;
                if (!show) return null;
                return (
                  <circle
                    key={`${k.key}-${i}`}
                    cx={xAt(i)} cy={yAt(d.values[k.key] || 0)} r={4.5}
                    strokeWidth={2}
                    style={{ fill: colors[k.key], stroke: 'var(--viz-surface)' }}
                  />
                );
              }),
            )}

            {data.map((d, i) => (
              i % labelEvery === 0 || i === data.length - 1 ? (
                <text key={i} x={xAt(i)} y={plotH + 20} textAnchor="middle" fontSize={11} style={{ fill: 'var(--viz-ink-muted)' }}>
                  {d.label}
                </text>
              ) : null
            ))}

            {data.map((_, i) => (
              <rect
                key={i}
                x={data.length > 1 ? xAt(i) - stepX / 2 : 0}
                y={0}
                width={data.length > 1 ? stepX : plotW}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              />
            ))}
          </g>
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[160px] -translate-x-1/2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-900"
            style={{ left: Math.min(Math.max(tipLeft, 90), width - 90) }}
          >
            <p className="mb-1.5 font-semibold text-stone-900 dark:text-white">{hovered.label}</p>
            <ul className="space-y-1">
              {keys.map((k) => (
                <li key={k.key} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-gray-300">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[k.key] }} />
                    {k.label}
                  </span>
                  <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{(hovered.values[k.key] || 0).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
