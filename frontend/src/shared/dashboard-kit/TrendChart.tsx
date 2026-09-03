'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface TrendChartProps {
  data: Array<Record<string, string | number>>;
  /** dataKey -> { label, color } */
  series: Array<{ key: string; label: string; color: string }>;
  xKey: string;
  height?: number;
}

export default function TrendChart({ data, series, xKey, height = 220 }: TrendChartProps) {
  const config: ChartConfig = series.reduce((acc, s) => {
    acc[s.key] = { label: s.label, color: s.color };
    return acc;
  }, {} as ChartConfig);

  return (
    <ChartContainer config={config} className="w-full aspect-auto" style={{ height }}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" className="text-gray-100 dark:text-gray-700" />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
        />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#trend-${s.key})`}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
