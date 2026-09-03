'use client';

import { PieChart, Pie, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

interface DonutBreakdownProps {
  data: DonutSlice[];
  height?: number;
  centerLabel?: string;
}

export default function DonutBreakdown({ data, height = 200, centerLabel }: DonutBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const config: ChartConfig = data.reduce((acc, d) => {
    acc[d.key] = { label: d.label, color: d.color };
    return acc;
  }, {} as ChartConfig);

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: height, height }}>
        <ChartContainer config={config} className="w-full h-full aspect-auto">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="65%"
              outerRadius="95%"
              strokeWidth={2}
              stroke="#fff"
            >
              {data.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-gray-900 dark:text-white">{total}</span>
          {centerLabel && <span className="text-[10px] text-gray-500 dark:text-gray-400">{centerLabel}</span>}
        </div>
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        {data.map((slice) => (
          <div key={slice.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300 truncate">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="font-semibold text-gray-900 dark:text-white flex-shrink-0">{slice.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
