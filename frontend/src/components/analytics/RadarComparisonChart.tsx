'use client';

import React, { useMemo } from 'react';

export interface RadarAxis {
  key: string;
  label: string;
}

export interface RadarDataSet {
  label: string;
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

export default function RadarComparisonChart({
  axes, datasets, title, subtitle, size = 280, className = '',
}: Props) {
  const center = size / 2;
  const radius = size / 2 - 40;
  const rings = 5;

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

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_30%,rgba(99,102,241,0.03),transparent)]" />

      {(title || subtitle) && (
        <div className="relative border-b border-slate-100/80 px-6 py-4">
          {title && <h3 className="text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">{subtitle}</p>}
        </div>
      )}

      <div className="relative px-6 py-6">
        <div className="flex flex-wrap justify-center gap-5 border-b border-slate-100/80 pb-4 md:justify-start">
          {datasets.map((ds) => (
            <span key={ds.label} className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ds.color, boxShadow: `0 0 8px ${ds.color}40` }} />
              {ds.label}
            </span>
          ))}
        </div>

        <div className="mt-6 grid items-center gap-8 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:gap-10">
          <div className="flex justify-center lg:justify-start">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible max-w-full">
              <defs>
                {datasets.map((ds, i) => (
                  <linearGradient key={i} id={`radar-fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ds.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={ds.color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>

              {Array.from({ length: rings }).map((_, ri) => {
                const frac = (ri + 1) / rings;
                const pts = axes.map((_, ai) => polarToXY(ai, frac));
                const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join('') + 'Z';
                return <path key={ri} d={path} fill="none" stroke="#e2e8f0" strokeWidth={ri === rings - 1 ? 1.5 : 0.8} strokeDasharray={ri < rings - 1 ? '3 3' : undefined} opacity={0.7} />;
              })}

              {axes.map((_, ai) => {
                const outer = polarToXY(ai, 1);
                return <line key={ai} x1={center} y1={center} x2={outer.x} y2={outer.y} stroke="#e2e8f0" strokeWidth={0.8} opacity={0.5} />;
              })}

              {datasets.map((ds, di) => (
                <g key={di}>
                  <path d={buildPolygonPath(ds)} fill={`url(#radar-fill-${di})`} stroke={ds.color} strokeWidth={2.5} strokeLinejoin="round" opacity={0.85} />
                  {axes.map((a, ai) => {
                    const val = (ds.values[a.key] || 0) / maxByAxis[a.key];
                    const { x, y } = polarToXY(ai, val);
                    return (
                      <g key={ai}>
                        <circle cx={x} cy={y} r={4} fill="white" stroke={ds.color} strokeWidth={2} />
                      </g>
                    );
                  })}
                </g>
              ))}

              {axes.map((a, ai) => {
                const { x, y } = polarToXY(ai, 1.22);
                return (
                  <text key={ai} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={600} fill="#475569">
                    {a.label}
                  </text>
                );
              })}
            </svg>
          </div>

          <div className="w-full rounded-3xl border border-slate-200/70 bg-slate-50/60 p-4 sm:p-5">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200/80">
                  <th className="pb-3 text-left font-semibold text-slate-400 uppercase tracking-widest text-[10px]">Category</th>
                  {datasets.map((ds) => (
                    <th key={ds.label} className="pb-3 text-right font-semibold uppercase tracking-widest text-[10px]" style={{ color: ds.color }}>{ds.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/80">
                {axes.map((a) => (
                  <tr key={a.key}>
                    <td className="py-3 text-slate-700 font-medium">{a.label}</td>
                    {datasets.map((ds) => (
                      <td key={ds.label} className="py-3 text-right font-bold tabular-nums" style={{ color: ds.color }}>
                        {(ds.values[a.key] || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
