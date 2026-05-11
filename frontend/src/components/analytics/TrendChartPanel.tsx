'use client';

import React, { useRef, useEffect, useState } from 'react';

interface BarData { label: string; values: Record<string, number> }

interface Props {
  data: BarData[];
  keys: { key: string; label: string; color: string }[];
  title?: string;
  height?: number;
}

const MARGIN = { top: 28, right: 24, bottom: 44, left: 52 };
const YTICK_COUNT = 5;

function niceMax(val: number): number {
  if (val <= 0) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  for (const n of [1, 2, 2.5, 5, 10]) { if (n * mag >= val) return n * mag; }
  return Math.ceil(val / mag) * mag;
}

function formatTick(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
  return String(val);
}

export default function TrendChartPanel({ data, keys, title, height = 290 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(600);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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
      <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800 text-sm text-slate-400">
        No trend data available.
      </div>
    );
  }

  const plotW = Math.max(svgWidth - MARGIN.left - MARGIN.right, 1);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const maxVal = Math.max(1, ...data.flatMap((d) => keys.map((k) => d.values[k.key] || 0)));
  const yMax = niceMax(maxVal);
  const stepX = plotW / Math.max(data.length - 1, 1);

  function buildPaths(key: string) {
    const pts = data.map((d, i) => ({
      x: i * stepX,
      y: plotH - ((d.values[key] || 0) / yMax) * plotH,
    }));
    if (pts.length < 2) {
      const p = pts[0] || { x: 0, y: plotH };
      return { line: `M${p.x},${p.y}`, area: `M${p.x},${plotH}L${p.x},${p.y}L${p.x},${plotH}Z` };
    }
    let line = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      line += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`;
    }
    const area = `${line}L${pts[pts.length - 1].x},${plotH}L${pts[0].x},${plotH}Z`;
    return { line, area };
  }

  // Professional color pairs: stroke + area fill + glow
  const COLOR_PAIRS: Record<string, { stroke: string; area: string; glow: string }> = {
    '#6366f1': { stroke: '#818cf8', area: '#a5b4fc', glow: '#4f46e5' },
    '#f59e0b': { stroke: '#f59e0b', area: '#fcd34d', glow: '#d97706' },
    '#10b981': { stroke: '#34d399', area: '#6ee7b7', glow: '#059669' },
    '#3b82f6': { stroke: '#60a5fa', area: '#93c5fd', glow: '#2563eb' },
    '#ec4899': { stroke: '#f472b6', area: '#fbcfe8', glow: '#db2777' },
    '#8b5cf6': { stroke: '#a78bfa', area: '#c4b5fd', glow: '#7c3aed' },
    '#ef4444': { stroke: '#f87171', area: '#fca5a5', glow: '#dc2626' },
    '#14b8a6': { stroke: '#2dd4bf', area: '#99f6e4', glow: '#0d9488' },
    '#00d4ff': { stroke: '#00d4ff', area: '#67e8ff', glow: '#0ea5e9' },
    '#00ff8c': { stroke: '#00ff8c', area: '#6effc3', glow: '#10b981' },
  };
  const getPair = (color: string) => COLOR_PAIRS[color] ?? { stroke: color, area: color, glow: color };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-700/50 bg-white dark:bg-slate-800/90 shadow-sm">
      {/* subtle mesh bg */}
      <div className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 100% 0%, rgba(99,102,241,0.06) 0%, transparent 60%)' }} />

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/60 px-6 py-4">
        {title && <h3 className="text-[13px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">{title}</h3>}
        <div className="flex flex-wrap gap-5 ml-auto">
          {keys.map((k) => {
            const { stroke } = getPair(k.color);
            return (
              <span key={k.key} className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <svg width="24" height="10" viewBox="0 0 24 10">
                  <line x1="0" y1="5" x2="24" y2="5" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="12" cy="5" r="3" fill="white" stroke={stroke} strokeWidth="2" />
                </svg>
                {k.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="relative px-4 pb-4 pt-3" ref={containerRef}>
        <svg width="100%" height={height} style={{ overflow: 'visible', display: 'block' }}>
          <defs>
            {keys.map((k) => {
              const { stroke, area, glow } = getPair(k.color);
              return (
                <React.Fragment key={k.key}>
                  {/* 3D: three stacked fills for depth illusion */}
                  <linearGradient id={`area-deep-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={glow} stopOpacity={0.55} />
                    <stop offset="35%" stopColor={glow} stopOpacity={0.28} />
                    <stop offset="80%" stopColor={glow} stopOpacity={0.07} />
                    <stop offset="100%" stopColor={glow} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id={`area-mid-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={area} stopOpacity={0.38} />
                    <stop offset="60%" stopColor={area} stopOpacity={0.10} />
                    <stop offset="100%" stopColor={area} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id={`area-top-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity={0.18} />
                    <stop offset="30%" stopColor="white" stopOpacity={0.0} />
                  </linearGradient>
                  {/* Neon line glow */}
                  <filter id={`line-glow-${k.key}`} x="-10%" y="-200%" width="120%" height="500%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <clipPath id={`clip-${k.key}`}>
                    <rect x="0" y="0" width={plotW} height={plotH} />
                  </clipPath>
                </React.Fragment>
              );
            })}
          </defs>

          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Y gridlines + ticks */}
            {Array.from({ length: YTICK_COUNT + 1 }).map((_, i) => {
              const frac = i / YTICK_COUNT;
              const y = plotH * (1 - frac);
              const isBaseline = i === 0;
              return (
                <g key={i}>
                  <line x1={0} y1={y} x2={plotW} y2={y}
                    stroke={isBaseline ? '#cbd5e1' : '#e2e8f0'}
                    strokeWidth={isBaseline ? 1.5 : 1}
                    strokeDasharray={isBaseline ? undefined : '5 5'}
                    className="dark:[stroke:#334155]"
                  />
                  <text x={-14} y={y} textAnchor="end" dominantBaseline="middle"
                    fontSize={10} fill="#94a3b8" fontWeight={600}>
                    {formatTick(Math.round(yMax * frac))}
                  </text>
                </g>
              );
            })}

            {keys.map((k) => {
              const { stroke, glow } = getPair(k.key in COLOR_PAIRS ? k.key : k.color);
              const s = getPair(k.color);
              const { line, area } = buildPaths(k.key);
              return (
                <g key={k.key}>
                  {/* 3D layered fills — deepest first */}
                  <path d={area} fill={`url(#area-deep-${k.key})`} clipPath={`url(#clip-${k.key})`} />
                  <path d={area} fill={`url(#area-mid-${k.key})`}  clipPath={`url(#clip-${k.key})`} />
                  <path d={area} fill={`url(#area-top-${k.key})`}  clipPath={`url(#clip-${k.key})`} />
                  {/* neon glow underlay */}
                  <path d={line} fill="none" stroke={s.glow} strokeWidth={6}
                    strokeLinecap="round" strokeLinejoin="round" opacity={0.22} />
                  {/* crisp neon line */}
                  <path d={line} fill="none" stroke={s.stroke} strokeWidth={2.5}
                    strokeLinecap="round" strokeLinejoin="round"
                    shapeRendering="geometricPrecision"
                  />
                  {/* data point dots */}
                  {data.map((d, i) => {
                    const val = d.values[k.key] || 0;
                    const cx = i * stepX;
                    const cy = plotH - (val / yMax) * plotH;
                    const isHov = hoverIdx === i;
                    return (
                      <g key={i}>
                        {isHov && <circle cx={cx} cy={cy} r={11} fill={s.stroke} opacity={0.15} />}
                        {isHov && <circle cx={cx} cy={cy} r={7}  fill={s.glow}   opacity={0.25} />}
                        <circle cx={cx} cy={cy} r={isHov ? 5 : 3}
                          fill={isHov ? s.stroke : 'white'}
                          stroke={s.stroke} strokeWidth={isHov ? 0 : 2}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Hover crosshair */}
            {hoverIdx !== null && (
              <line x1={hoverIdx * stepX} y1={0} x2={hoverIdx * stepX} y2={plotH}
                stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.6} />
            )}

            {/* Invisible hover zones */}
            {data.map((_, i) => (
              <rect key={i} x={i * stepX - stepX / 2} y={0} width={stepX} height={plotH}
                fill="transparent" onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: 'crosshair' }}
              />
            ))}

            {/* X-axis labels */}
            {data.map((d, i) => (
              <text key={i} x={i * stepX} y={plotH + 24} textAnchor="middle"
                fontSize={10} fill="#94a3b8" fontWeight={600}>
                {d.label.length > 8 ? d.label.slice(0, 7) + '…' : d.label}
              </text>
            ))}

            {/* Tooltip */}
            {hoverIdx !== null && data[hoverIdx] && (() => {
              const d = data[hoverIdx];
              const TW = 168; const TH = 36 + keys.length * 22;
              const tx = Math.min(Math.max(hoverIdx * stepX - TW / 2, 0), plotW - TW);
              const ty = -TH - 8;
              return (
                <g style={{ pointerEvents: 'none' }}>
                  {/* shadow */}
                  <rect x={tx + 2} y={ty + 4} width={TW} height={TH} rx={10}
                    fill="rgba(0,0,0,0.08)" />
                  <rect x={tx} y={ty} width={TW} height={TH} rx={10}
                    fill="white" stroke="rgba(148,163,184,0.2)" />
                  {/* color top bar */}
                  {keys.map((k, ki) => (
                    <rect key={k.key}
                      x={tx + ki * (TW / keys.length)} y={ty}
                      width={TW / keys.length} height={3.5}
                      fill={getPair(k.color).stroke} rx={ki === 0 ? 10 : ki === keys.length - 1 ? 10 : 0}
                    />
                  ))}
                  <text x={tx + 12} y={ty + 18} fontSize={11} fontWeight={700} fill="#0f172a">{d.label}</text>
                  {keys.map((k, ki) => (
                    <g key={k.key}>
                      <circle cx={tx + 17} cy={ty + 32 + ki * 20} r={4} fill={getPair(k.color).stroke} />
                      <text x={tx + 28} y={ty + 36 + ki * 20} fontSize={10.5} fill="#64748b" fontWeight={500}>{k.label}</text>
                      <text x={tx + TW - 12} y={ty + 36 + ki * 20} textAnchor="end" fontSize={11} fontWeight={700}
                        fill={getPair(k.color).stroke}>{(d.values[k.key] || 0).toLocaleString()}</text>
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

