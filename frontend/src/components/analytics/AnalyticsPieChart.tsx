'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

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
  colorScheme?: 'blue' | 'green' | 'purple' | 'amber';
}

const COLOR_SCHEMES = {
  blue: [
    '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#2563eb',
    '#0ea5e9', '#38bdf8', '#7dd3fc', '#0369a1', '#0284c7',
    '#06b6d4',
  ],
  green: [
    '#22c55e', '#4ade80', '#86efac', '#15803d', '#16a34a',
    '#10b981', '#34d399', '#6ee7b7', '#065f46', '#047857',
    '#059669',
  ],
  purple: [
    '#a855f7', '#c084fc', '#d8b4fe', '#7c3aed', '#8b5cf6',
    '#6366f1', '#818cf8', '#a5b4fc', '#4338ca', '#4f46e5',
    '#7c3aed',
  ],
  amber: [
    '#f59e0b', '#fbbf24', '#fcd34d', '#b45309', '#d97706',
    '#f97316', '#fb923c', '#fdba74', '#c2410c', '#ea580c',
    '#f59e0b',
  ],
};

export default function AnalyticsPieChart({
  data,
  title,
  subtitle,
  emptyMessage = 'No data available',
  className = '',
  colorScheme = 'blue',
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const colors = COLOR_SCHEMES[colorScheme];
  const filled = data.filter((d) => d.count > 0);
  const total = filled.reduce((s, d) => s + d.count, 0);

  const activeSlice = activeIndex !== null ? filled[activeIndex] : null;

  return (
    <div
      className={`flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex-shrink-0">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>

      {filled.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <>
          {/* Donut chart */}
          <div className="relative flex-shrink-0" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={filled as Record<string, unknown>[]}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="label"
                  isAnimationActive={false}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {filled.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={colors[index % colors.length]}
                      stroke={activeIndex === index ? '#fff' : 'transparent'}
                      strokeWidth={activeIndex === index ? 2 : 0}
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Centre — shows hovered slice info or total */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {activeSlice ? (
                <>
                  <span className="text-2xl font-bold leading-none text-gray-900 dark:text-white">
                    {activeSlice.count}
                  </span>
                  <span
                    className="mt-1 max-w-[90px] text-[10px] leading-tight text-gray-500 dark:text-gray-400"
                    style={{ wordBreak: 'break-word' }}
                  >
                    {activeSlice.label}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold leading-none text-gray-900 dark:text-white">
                    {total}
                  </span>
                  <span className="mt-0.5 text-[10px] text-gray-400">total</span>
                </>
              )}
            </div>
          </div>

          {/* Legend — highlights the hovered row */}
          <ul className="mt-3 max-h-28 overflow-y-auto space-y-1.5 pr-1">
            {filled.map((entry, index) => {
              const isActive = activeIndex === index;
              return (
                <li
                  key={entry.key}
                  className={`flex min-w-0 cursor-default items-center gap-2 rounded-md px-1 py-0.5 transition-colors ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full transition-transform"
                    style={{
                      backgroundColor: colors[index % colors.length],
                      transform: isActive ? 'scale(1.3)' : 'scale(1)',
                    }}
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-xs transition-colors ${
                      isActive
                        ? 'font-medium text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {entry.label}
                  </span>
                  <span
                    className={`flex-shrink-0 text-xs font-semibold ${
                      isActive ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    ({entry.count})
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
