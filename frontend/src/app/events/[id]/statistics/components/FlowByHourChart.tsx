'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EventStatisticsHourlyScan } from '@/features/event-management/types/event.types';

interface FlowByHourChartProps {
  data: EventStatisticsHourlyScan[];
}

export default function FlowByHourChart({ data }: FlowByHourChartProps) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#b3cde0] bg-[#f8fbff] p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
        No gate scan activity available.
      </div>
    );
  }

  const chartData = data
    .filter((item) => item.total > 0)
    .map((item) => ({
      ...item,
      label: `${String(item.hour).padStart(2, '0')}:00`,
    }));

  if (!chartData.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#b3cde0] bg-[#f8fbff] p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
        No gate scan activity available.
      </div>
    );
  }

  return (
    <div className="h-72 w-full rounded-xl border border-[#b3cde0]/60 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/20">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe8f3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#7a8797" />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#7a8797" />
          <Tooltip />
          <Bar dataKey="entries" fill="#0f2573" radius={[4, 4, 0, 0]} name="Entries" />
          <Bar dataKey="exits" fill="#4b6fb5" radius={[4, 4, 0, 0]} name="Exits" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
