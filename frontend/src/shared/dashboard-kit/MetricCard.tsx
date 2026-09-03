'use client';

import { ReactNode } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  delta?: string;
  deltaType?: 'increase' | 'decrease' | 'neutral';
  sparkline?: number[];
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function MetricCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaType = 'neutral',
  sparkline,
  footer,
  onClick,
  className,
}: MetricCardProps) {
  const sparkData = sparkline?.map((v, i) => ({ i, v }));

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800',
        'shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]',
        'hover:shadow-[0_4px_24px_rgba(132,28,67,0.10)] hover:border-wine/20',
        'transition-all duration-300 min-h-[128px] flex flex-col overflow-hidden',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Top accent on hover */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-wine via-amber to-wine opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex flex-col h-full p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-tight">{label}</p>
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-peach to-peach/30 dark:from-wine/25 dark:to-wine/5 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Icon className="w-4 h-4 text-wine dark:text-amber-400" />
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-2 mt-auto">
          <div className="min-w-0">
            <div className="text-3xl font-bold text-gray-900 dark:text-white leading-none tabular-nums tracking-tight">{value}</div>
            {delta && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[11px] font-semibold mt-2 px-1.5 py-0.5 rounded-full',
                  deltaType === 'increase' && 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40',
                  deltaType === 'decrease' && 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/40',
                  deltaType === 'neutral' && 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800'
                )}
              >
                {deltaType === 'increase' && <TrendingUp className="w-3 h-3" />}
                {deltaType === 'decrease' && <TrendingDown className="w-3 h-3" />}
                {delta}
              </span>
            )}
          </div>

          {sparkData && sparkData.length > 1 && (
            <div className="w-20 h-12 flex-shrink-0 opacity-60 group-hover:opacity-80 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData}>
                  <defs>
                    <linearGradient id={`spark-${label.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#841C43" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#841C43" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#841C43"
                    strokeWidth={2}
                    fill={`url(#spark-${label.replace(/\s+/g, '')})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {footer && <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">{footer}</div>}
      </div>
    </div>
  );
}