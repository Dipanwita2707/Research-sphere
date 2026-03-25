'use client';

import React from 'react';

export interface PipelineStageData {
  key: string;
  label: string;
  count: number;
  color: string;
  textColor: string;
}

interface Props {
  stages: PipelineStageData[];
  title?: string;
  subtitle?: string;
  onStageClick?: (key: string) => void;
  className?: string;
}

export default function AnalyticsPipelineChart({ stages, title, subtitle, onStageClick, className = '' }: Props) {
  const total = stages.reduce((s, st) => s + st.count, 0);
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className={`flex flex-col rounded-3xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.07)] overflow-hidden ${className}`}>
      {(title || subtitle) && (
        <div className="border-b border-slate-100/80 px-6 py-4">
          {title && <h3 className="text-[13px] font-semibold tracking-tight text-slate-800">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">{subtitle}</p>}
        </div>
      )}

      {/* Gradient segment bar */}
      {total > 0 && (
        <div className="flex h-2 overflow-hidden">
          {stages.filter((s) => s.count > 0).map((s) => (
            <div key={s.key} className="transition-all duration-500 hover:brightness-110" style={{ backgroundColor: s.color, width: `${(s.count / total) * 100}%` }} title={`${s.label}: ${s.count}`} />
          ))}
        </div>
      )}

      {/* Stage rows */}
      <div className="flex-1 divide-y divide-slate-50/80 px-5 py-2">
        {stages.map((stage) => {
          const barPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const sharePct = total > 0 ? (stage.count / total) * 100 : 0;
          return (
            <button key={stage.key} onClick={() => onStageClick?.(stage.key)} disabled={!onStageClick}
              className="group flex w-full items-center gap-3 py-3 text-left transition-all hover:pl-0.5 disabled:cursor-default"
            >
              <div className="h-3 w-3 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: stage.color, boxShadow: `0 0 8px ${stage.color}30` }} />
              <span className="w-[108px] shrink-0 text-[11px] font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{stage.label}</span>
              <div className="min-w-0 flex-1 rounded-full bg-slate-50 h-[18px] overflow-hidden">
                <div className="h-[18px] rounded-full flex items-center justify-end pr-2 transition-all duration-700 ease-out"
                  style={{ backgroundColor: stage.color, width: `${Math.max(barPct, stage.count > 0 ? 4 : 0)}%`, opacity: 0.8 }}
                >
                  {barPct > 15 && <span className="text-[9px] font-bold text-white/90">{stage.count}</span>}
                </div>
              </div>
              <span className="w-9 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color: stage.color }}>{stage.count}</span>
              <span className="hidden w-10 shrink-0 text-right text-[10px] font-medium tabular-nums text-slate-400 sm:block">{sharePct.toFixed(0)}%</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100/80 px-6 py-3 text-xs text-slate-400">
        <span>Total records</span>
        <span className="font-bold tabular-nums text-slate-700">{total.toLocaleString()}</span>
      </div>
    </div>
  );
}
