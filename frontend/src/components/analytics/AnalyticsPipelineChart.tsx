'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { seriesColors, ui } from './theme';

export interface PipelineStageData {
  key: string;
  label: string;
  count: number;
  /** Ignored — colours come from the shared palette. Kept for backwards compatibility. */
  color: string;
  /** Ignored — text is always neutral ink. Kept for backwards compatibility. */
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
  const [hover, setHover] = useState<string | null>(null);
  const total = stages.reduce((s, st) => s + st.count, 0);
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const colors = seriesColors(stages.map((s) => s.key));
  const visible = stages.filter((s) => s.count > 0);
  const hovered = hover ? stages.find((s) => s.key === hover) : null;

  return (
    <div className={`flex flex-col overflow-hidden ${ui.card} ${className}`}>
      {(title || subtitle) && (
        <div className={ui.cardHeader}>
          <div className="min-w-0">
            {title && <h3 className={ui.title}>{title}</h3>}
            {subtitle && <p className={ui.subtitle}>{subtitle}</p>}
          </div>
        </div>
      )}

      {total === 0 ? (
        <div className="flex h-40 flex-1 items-center justify-center text-sm text-stone-400 dark:text-gray-500">No data for this period.</div>
      ) : (
        <>
          {/* Part-to-whole strip: one segment per stage, 2px surface gaps between fills */}
          <div className="relative px-5 pt-4">
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded" role="img" aria-label="Share of records by stage">
              {visible.map((s) => (
                <div
                  key={s.key}
                  className="h-full transition-opacity first:rounded-l last:rounded-r"
                  style={{
                    backgroundColor: colors[s.key],
                    width: `${(s.count / total) * 100}%`,
                    opacity: hover && hover !== s.key ? 0.45 : 1,
                  }}
                  onMouseEnter={() => setHover(s.key)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </div>
            {hovered && (
              <div className="pointer-events-none absolute left-1/2 top-8 z-10 min-w-[160px] -translate-x-1/2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-900">
                <p className="mb-1 inline-flex items-center gap-1.5 font-semibold text-stone-900 dark:text-white">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: colors[hovered.key] }} />
                  {hovered.label}
                </p>
                <p className="flex justify-between gap-4 tabular-nums text-stone-600 dark:text-gray-300">
                  <span className="font-semibold text-stone-900 dark:text-white">{hovered.count.toLocaleString('en-IN')}</span>
                  <span>{((hovered.count / total) * 100).toFixed(1)}%</span>
                </p>
              </div>
            )}
          </div>

          {/* Stage rows */}
          <ul className="flex-1 divide-y divide-stone-100 px-5 py-2 dark:divide-gray-700">
            {stages.map((stage) => {
              const barPct = (stage.count / maxCount) * 100;
              const sharePct = total > 0 ? (stage.count / total) * 100 : 0;
              const dim = hover !== null && hover !== stage.key;
              return (
                <li key={stage.key}>
                  <button
                    type="button"
                    onClick={() => onStageClick?.(stage.key)}
                    disabled={!onStageClick}
                    onMouseEnter={() => setHover(stage.key)}
                    onMouseLeave={() => setHover(null)}
                    className="group flex w-full items-center gap-3 rounded-md py-2.5 text-left transition-colors enabled:hover:bg-stone-50 disabled:cursor-default dark:enabled:hover:bg-gray-700/40"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colors[stage.key] }} />
                    <span className="w-28 shrink-0 truncate text-xs font-medium text-stone-700 dark:text-gray-200" title={stage.label}>
                      {stage.label}
                    </span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded bg-stone-100 dark:bg-gray-700">
                      <span
                        className="block h-full rounded transition-[width,opacity] duration-300"
                        style={{
                          backgroundColor: colors[stage.key],
                          width: `${stage.count > 0 ? Math.max(barPct, 2) : 0}%`,
                          opacity: dim ? 0.45 : 1,
                        }}
                      />
                    </span>
                    <span className={`w-10 shrink-0 text-right text-sm font-semibold tabular-nums ${stage.count > 0 ? 'text-stone-900 dark:text-white' : 'text-stone-300 dark:text-gray-600'}`}>
                      {stage.count.toLocaleString('en-IN')}
                    </span>
                    <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-stone-500 dark:text-gray-400 sm:block">
                      {sharePct.toFixed(0)}%
                    </span>
                    {onStageClick && <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 dark:text-gray-600" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3 text-xs text-stone-500 dark:border-gray-700 dark:text-gray-400">
        <span>Total records</span>
        <span className="font-semibold tabular-nums text-stone-900 dark:text-white">{total.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
}
