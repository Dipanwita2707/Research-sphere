'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface BarChartDataPoint {
  label: string;
  values: Record<string, number>;
}

export interface BarChartSeries {
  key: string;
  label: string;
  color: string;
}

interface Props {
  data: BarChartDataPoint[];
  keys: BarChartSeries[];
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
}

const MARGIN = { top: 20, right: 28, bottom: 44, left: 48 };
const YTICK_COUNT = 5;

function niceMax(val: number): number {
  if (val <= 0) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  for (const n of [1, 2, 2.5, 5, 10]) {
    if (n * mag >= val) return n * mag;
  }
  return Math.ceil(val / mag) * mag;
}

function formatTick(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 ===
   0 ? 0 : 1)}k`;
  return String(val);
}

export default function AnalyticsBarChart({
  data, keys, title, subtitle, height = 320, className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(600);
  const [tooltip, setTooltip] = useState<{ gxCenter: number; d: BarChartDataPoint } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => setSvgWidth(entries[0].contentRect.width));
    obs.observe(el);
    setSvgWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  if (!data.length) {
    return (
      <div className={`flex h-40 items-center justify-center rounded-3xl border border-slate-200/50 bg-gradient-to-br from-slate-50 to-white text-sm text-slate-400 ${className}`}>
        No data available.
      </div>
    );
  }

  const plotW = Math.max(svgWidth - MARGIN.left - MARGIN.right, 1);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const maxVal = Math.max(1, ...data.flatMap((d) => keys.map((k) => d.values[k.key] || 0)));
  const yMax = niceMax(maxVal);
  const groupW = plotW / Math.max(data.length, 1);
  const barsW = groupW * 0.68;
  const barW = Math.max(barsW / keys.length - 2, 3);

  return (
    <div className={`group/chart relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-700/50 bg-white dark:bg-slate-800/90 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_0%_-20%,rgba(99,102,241,0.03),transparent),radial-gradient(ellipse_60%_50%_at_100%_120%,rgba(16,185,129,0.03),transparent)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 dark:border-slate-700/50 px-6 py-4">
        <div>
          {title && <h3 className="text-[13px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {keys.map((k) => (
            <span key={k.key} className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: k.color, boxShadow: `0 0 6px ${k.color}40` }} />
              {k.label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative px-3 pb-4 pt-3" ref={containerRef}>
        <svg width="100%" height={height} style={{ overflow: 'visible', display: 'block' }}>
          <defs>
            {keys.map((k) => (
              <linearGradient key={k.key} id={`bg-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={k.color} stopOpacity={1} />
                <stop offset="55%" stopColor={k.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={k.color} stopOpacity={0.65} />
              </linearGradient>
            ))}
            <linearGradient id="tt-accent" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            {/* Isometric side-face: darken by 52% */}
            <filter id="face-darken" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="0.48 0 0 0 0  0 0.48 0 0 0  0 0 0.48 0 0  0 0 0 1 0" />
            </filter>
            {/* Isometric top-face: brighten + add white */}
            <filter id="face-lighten" colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values="1.12 0 0 0 0.22  0 1.12 0 0 0.22  0 0 1.12 0 0.30  0 0 0 1 0" />
            </filter>
            <filter id="bar-shadow" x="-15%" y="-15%" width="145%" height="145%">
              <feDropShadow dx="3" dy="5" stdDeviation="4" floodOpacity="0.18" />
            </filter>
          </defs>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {Array.from({ length: YTICK_COUNT + 1 }).map((_, i) => {
              const frac = i / YTICK_COUNT;
              const y = plotH * (1 - frac);
              return (
                <g key={i}>
                  <line x1={0} y1={y} x2={plotW} y2={y} stroke={i ===
   0 ? '#e2e8f0' : '#f1f5f9'} strokeDasharray={i > 0 ? '4 4' : undefined} />
                  <text x={-12} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#94a3b8" fontWeight={500}>{formatTick(Math.round(yMax * frac))}</text>
                </g>
              );
            })}
            {data.map((d, di) => {
              const gx = di * groupW;
              const barsOffset = (groupW - barsW) / 2;
              const isHovered = tooltip?.d ===
   d;
              return (
                <g key={di}>
                  {isHovered && <rect x={gx + 1} y={-4} width={groupW - 2} height={plotH + 8} fill="#f8fafc" rx={8} opacity={0.7} />}
                  {keys.map((k, ki) => {
                    const val = d.values[k.key] || 0;
                    const targetH = Math.max((val / yMax) * plotH, val > 0 ? 3 : 0);
                    const bh = targetH;
                    const bx = gx + barsOffset + ki * (barW + 2);
                    const by = plotH - bh;
                    return (
                      <g key={k.key}>
                        {(() => {
                          const D  = Math.max(Math.min(barW * 0.32, 12), 4);
                          const DX = D; const DY = -(D * 0.52);
                          const frontPts = `${bx},${by} ${bx+barW},${by} ${bx+barW},${by+bh} ${bx},${by+bh}`;
                          const sidePts  = `${bx+barW},${by} ${bx+barW+DX},${by+DY} ${bx+barW+DX},${by+bh+DY} ${bx+barW},${by+bh}`;
                          const topPts   = `${bx},${by} ${bx+barW},${by} ${bx+barW+DX},${by+DY} ${bx+DX},${by+DY}`;
                          return (
                            <g filter="url(#bar-shadow)">
                              {bh > 2 && <polygon points={sidePts}  fill={`url(#bg-${k.key})`} filter="url(#face-darken)"  style={{ pointerEvents: 'none' }} />}
                              {bh > 2 && <polygon points={topPts}   fill={`url(#bg-${k.key})`} filter="url(#face-lighten)" style={{ pointerEvents: 'none' }} />}
                              <polygon points={frontPts} fill={`url(#bg-${k.key})`}
                                fillOpacity={isHovered ? 1 : 0.93}
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={() => setTooltip({ gxCenter: gx + groupW / 2, d })}
                                onMouseLeave={() => setTooltip(null)}
                              />
                              {isHovered && val > 0 && (
                                <text x={bx + barW / 2} y={by + DY - 5} textAnchor="middle" fontSize={9} fontWeight={700} fill={k.color}>{val.toLocaleString()}</text>
                              )}
                            </g>
                          );
                        })()}
                      </g>
                    );
                  })}
                  <text x={gx + groupW / 2} y={plotH + 20} textAnchor="middle" fontSize={10} fill="#94a3b8" fontWeight={500}>
                    {d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
                  </text>
                </g>
              );
            })}
            {tooltip && (() => {
              const TW = 180; const TH = 38 + keys.length * 24;
              const tx = Math.min(Math.max(tooltip.gxCenter - TW / 2, 0), plotW - TW);
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={tx} y={0} width={TW} height={TH} rx={14} fill="rgba(255,255,255,0.95)" stroke="rgba(148,163,184,0.15)" filter="drop-shadow(0 8px 24px rgba(0,0,0,0.1))" />
                  <rect x={tx} y={0} width={TW} height={3} rx={1} fill="url(#tt-accent)" />
                  <text x={tx + 14} y={22} fontSize={11} fontWeight={700} fill="#0f172a">{tooltip.d.label}</text>
                  {keys.map((k, ki) => (
                    <g key={k.key}>
                      <circle cx={tx + 18} cy={41 + ki * 22} r={4} fill={k.color} />
                      <text x={tx + 30} y={44 + ki * 22} fontSize={10.5} fill="#64748b" fontWeight={500}>{k.label}</text>
                      <text x={tx + TW - 14} y={44 + ki * 22} textAnchor="end" fontSize={11} fontWeight={700} fill="#0f172a">{(tooltip.d.values[k.key] || 0).toLocaleString()}</text>
                    </g>
                  ))}
                </g>
              );
            })()}
          </g>
        </svg>
      </div>
    </div>
  );
}
