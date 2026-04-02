'use client';

import React, { useRef, useEffect, useState } from 'react';

interface BarData { label: string; values: Record<string, number> }

interface Props {
  data: BarData[];
  keys: { key: string; label: string; color: string }[];
  title?: string;
  height?: number;
}

const MARGIN = { top: 20, right: 16, bottom: 40, left: 48 };
const YTICK_COUNT = 5;

function niceMax(val: number): number {
  if (val <= 0) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  for (const n of [1, 2, 2.5, 5, 10]) { if (n * mag >= val) return n * mag; }
  return Math.ceil(val / mag) * mag;
}

function formatTick(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 ===
   0 ? 0 : 1)}k`;
  return String(val);
}

export default function TrendChartPanel({ data, keys, title, height = 280 }: Props) {
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
      <div className="flex h-40 items-center justify-center rounded-3xl border border-slate-200/50 bg-white text-sm text-slate-400">
        No trend data available.
      </div>
    );
  }

  const plotW = Math.max(svgWidth - MARGIN.left - MARGIN.right, 1);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const maxVal = Math.max(1, ...data.flatMap((d) => keys.map((k) => d.values[k.key] || 0)));
  const yMax = niceMax(maxVal);
  const stepX = plotW / Math.max(data.length - 1, 1);

  // Build smooth SVG path (monotone cubic) + area path per key
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

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_-20%,rgba(99,102,241,0.03),transparent)]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 px-6 py-4">
        {title && <h3 className="text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>}
        <div className="flex flex-wrap gap-4 ml-auto">
          {keys.map((k) => (
            <span key={k.key} className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: k.color, boxShadow: `0 0 6px ${k.color}40` }} />
              {k.label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative px-3 pb-4 pt-3" ref={containerRef}>
        <svg width="100%" height={height} style={{ overflow: 'visible', display: 'block' }}>
          <defs>
            {keys.map((k) => (
              <linearGradient key={k.key} id={`area-${k.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={k.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={k.color} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Y gridlines */}
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
            {/* Area fills + lines */}
            {keys.map((k) => {
              const { line, area } = buildPaths(k.key);
              return (
                <g key={k.key}>
                  <path d={area} fill={`url(#area-${k.key})`} />
                  <path d={line} fill="none" stroke={k.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
                </g>
              );
            })}
            {/* Hover crosshair + dots */}
            {hoverIdx !== null && (
              <g>
                <line x1={hoverIdx * stepX} y1={0} x2={hoverIdx * stepX} y2={plotH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
                {keys.map((k) => {
                  const val = data[hoverIdx]?.values[k.key] || 0;
                  const cy = plotH - (val / yMax) * plotH;
                  return (
                    <g key={k.key}>
                      <circle cx={hoverIdx * stepX} cy={cy} r={5} fill="white" stroke={k.color} strokeWidth={2.5} />
                      <circle cx={hoverIdx * stepX} cy={cy} r={8} fill={k.color} opacity={0.1} />
                    </g>
                  );
                })}
              </g>
            )}
            {/* Invisible hover zones */}
            {data.map((_, i) => (
              <rect key={i} x={i * stepX - stepX / 2} y={0} width={stepX} height={plotH} fill="transparent"
                onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: 'crosshair' }}
              />
            ))}
            {/* X-axis labels */}
            {data.map((d, i) => (
              <text key={i} x={i * stepX} y={plotH + 22} textAnchor="middle" fontSize={10} fill="#94a3b8" fontWeight={500}>
                {d.label.length > 7 ? d.label.slice(0, 6) + '…' : d.label}
              </text>
            ))}
            {/* Floating tooltip */}
            {hoverIdx !== null && data[hoverIdx] && (() => {
              const d = data[hoverIdx];
              const TW = 160; const TH = 32 + keys.length * 20;
              const tx = Math.min(Math.max(hoverIdx * stepX - TW / 2, 0), plotW - TW);
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={tx} y={-8} width={TW} height={TH} rx={12} fill="rgba(255,255,255,0.95)" stroke="rgba(148,163,184,0.15)" filter="drop-shadow(0 6px 20px rgba(0,0,0,0.1))" />
                  <text x={tx + 12} y={12} fontSize={10.5} fontWeight={700} fill="#0f172a">{d.label}</text>
                  {keys.map((k, ki) => (
                    <g key={k.key}>
                      <circle cx={tx + 16} cy={29 + ki * 18} r={3.5} fill={k.color} />
                      <text x={tx + 26} y={32 + ki * 18} fontSize={10} fill="#64748b" fontWeight={500}>{k.label}</text>
                      <text x={tx + TW - 12} y={32 + ki * 18} textAnchor="end" fontSize={10.5} fontWeight={700} fill="#0f172a">{(d.values[k.key] || 0).toLocaleString()}</text>
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
