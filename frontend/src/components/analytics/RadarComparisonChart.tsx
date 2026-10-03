'use client';

import React, { useMemo, useState } from 'react';
import { seriesColors, ui } from './theme';

export interface RadarAxis {
  key: string;
  label: string;
}

export interface RadarDataSet {
  label: string;
  /** Ignored — colours come from the shared palette. Kept for backwards compatibility. */
  color: string;
  values: Record<string, number>;
}

interface Props {
  axes: RadarAxis[];
  datasets: RadarDataSet[];
  title?: string;
  subtitle?: string;
  size?: number;
  className?: string;
}

const RINGS = 4;

export default function RadarComparisonChart({
  axes, datasets, title, subtitle, size = 280, className = '',
}: Props) {
  const [hoverAxis, setHoverAxis] = useState<number | null>(null);
  const center = size / 2;
  const radius = size / 2 - 40;

  // Datasets are ordered comparisons (e.g. person vs average), so colour by position.
  const colorKeys = datasets.map((_, i) => `series-${i}`);
  const palette = seriesColors(colorKeys);
  const colorAt = (i: number) => palette[colorKeys[i]];

  // Normalize all values to 0..1 based on max across all datasets
  const maxByAxis = useMemo(() => {
    const m: Record<string, number> = {};
    axes.forEach((a) => {
      m[a.key] = Math.max(1, ...datasets.map((ds) => ds.values[a.key] || 0));
    });
    return m;
  }, [axes, datasets]);

  function polarToXY(axisIdx: number, fraction: number) {
    const angle = (Math.PI * 2 * axisIdx) / axes.length - Math.PI / 2;
    return {
      x: center + radius * fraction * Math.cos(angle),
      y: center + radius * fraction * Math.sin(angle),
    };
  }

  function buildPolygonPath(ds: RadarDataSet) {
    return axes
      .map((a, i) => {
        const val = (ds.values[a.key] || 0) / maxByAxis[a.key];
        const { x, y } = polarToXY(i, val);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join('') + 'Z';
  }

  const hoveredAxis = hoverAxis !== null ? axes[hoverAxis] : null;
  const tipPos = hoverAxis !== null ? polarToXY(hoverAxis, 1.05) : null;

  if (!axes.length || !datasets.length) {
    return (
      <div className={`${ui.card} ${className}`}>
        {(title || subtitle) && (
          <div className={ui.cardHeader}>
            <div>
              {title && <h3 className={ui.title}>{title}</h3>}
              {subtitle && <p className={ui.subtitle}>{subtitle}</p>}
            </div>
          </div>
        )}
        <div className="flex h-40 items-center justify-center text-sm text-stone-400 dark:text-gray-500">No data for this period.</div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${ui.card} ${className}`}>
      {(title || subtitle || datasets.length > 1) && (
        <div className={ui.cardHeader}>
          <div className="min-w-0">
            {title && <h3 className={ui.title}>{title}</h3>}
            {subtitle && <p className={ui.subtitle}>{subtitle}</p>}
          </div>
          {datasets.length > 1 && (
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Legend">
              {datasets.map((ds, i) => (
                <li key={ds.label} className="inline-flex items-center gap-1.5 text-xs text-stone-600 dark:text-gray-300">
                  <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: colorAt(i) }} />
                  {ds.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid items-center gap-6 p-5 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)] lg:gap-8">
        <div className="relative mx-auto" style={{ width: size, maxWidth: '100%' }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title || 'Radar comparison'} className="block max-w-full overflow-visible">
            {Array.from({ length: RINGS }).map((_, ri) => {
              const frac = (ri + 1) / RINGS;
              const path = axes.map((__, ai) => {
                const p = polarToXY(ai, frac);
                return `${ai === 0 ? 'M' : 'L'}${p.x},${p.y}`;
              }).join('') + 'Z';
              return (
                <path key={ri} d={path} fill="none" strokeWidth={1}
                  style={{ stroke: ri === RINGS - 1 ? 'var(--viz-axis)' : 'var(--viz-grid)' }} />
              );
            })}

            {axes.map((_, ai) => {
              const outer = polarToXY(ai, 1);
              return (
                <line key={ai} x1={center} y1={center} x2={outer.x} y2={outer.y} strokeWidth={1}
                  style={{ stroke: hoverAxis === ai ? 'var(--viz-axis)' : 'var(--viz-grid)' }} />
              );
            })}

            {datasets.map((ds, di) => (
              <path
                key={di}
                d={buildPolygonPath(ds)}
                strokeWidth={2}
                strokeLinejoin="round"
                style={{ fill: colorAt(di), fillOpacity: 0.1, stroke: colorAt(di) }}
              />
            ))}

            {hoverAxis !== null && datasets.map((ds, di) => {
              const a = axes[hoverAxis];
              const { x, y } = polarToXY(hoverAxis, (ds.values[a.key] || 0) / maxByAxis[a.key]);
              return (
                <circle key={di} cx={x} cy={y} r={4.5} strokeWidth={2}
                  style={{ fill: colorAt(di), stroke: 'var(--viz-surface)' }} />
              );
            })}

            {axes.map((a, ai) => {
              const { x, y } = polarToXY(ai, 1.2);
              return (
                <text key={ai} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11}
                  fontWeight={hoverAxis === ai ? 600 : 400}
                  style={{ fill: hoverAxis === ai ? 'currentColor' : 'var(--viz-ink-muted)' }}
                  className="text-stone-900 dark:text-white">
                  {a.label}
                </text>
              );
            })}

            {/* Hit targets: a wide invisible band along each axis */}
            {axes.map((_, ai) => {
              const outer = polarToXY(ai, 1.25);
              return (
                <line key={ai} x1={center} y1={center} x2={outer.x} y2={outer.y} strokeWidth={28} strokeLinecap="round"
                  stroke="transparent" pointerEvents="stroke"
                  onMouseEnter={() => setHoverAxis(ai)} onMouseLeave={() => setHoverAxis(null)} />
              );
            })}
          </svg>

          {hoveredAxis && tipPos && (
            <div
              className="pointer-events-none absolute z-10 min-w-[150px] -translate-x-1/2 -translate-y-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-900"
              style={{ left: Math.min(Math.max(tipPos.x, 80), size - 80), top: Math.max(tipPos.y - 6, 60) }}
            >
              <p className="mb-1.5 font-semibold text-stone-900 dark:text-white">{hoveredAxis.label}</p>
              <ul className="space-y-1">
                {datasets.map((ds, di) => (
                  <li key={ds.label} className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-gray-300">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorAt(di) }} />
                      {ds.label}
                    </span>
                    <span className="font-semibold tabular-nums text-stone-900 dark:text-white">
                      {(ds.values[hoveredAxis.key] || 0).toLocaleString('en-IN')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="w-full overflow-x-auto rounded-lg border border-stone-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 dark:bg-gray-900/40">
              <tr>
                <th className={ui.th}>Category</th>
                {datasets.map((ds, di) => (
                  <th key={ds.label} className={`${ui.th} text-right`}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorAt(di) }} />
                      {ds.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-gray-700">
              {axes.map((a, ai) => (
                <tr
                  key={a.key}
                  className={`transition-colors ${hoverAxis === ai ? 'bg-stone-50 dark:bg-gray-700/40' : ''}`}
                  onMouseEnter={() => setHoverAxis(ai)}
                  onMouseLeave={() => setHoverAxis(null)}
                >
                  <td className={`${ui.td} font-medium`}>{a.label}</td>
                  {datasets.map((ds) => {
                    const v = ds.values[a.key] || 0;
                    return (
                      <td key={ds.label} className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${v === 0 ? 'text-stone-300 dark:text-gray-600' : 'text-stone-900 dark:text-white'}`}>
                        {v.toLocaleString('en-IN')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
