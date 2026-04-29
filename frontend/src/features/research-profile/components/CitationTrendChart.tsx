import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { YearlyCitations } from '@/shared/types/research-profile.types';

interface CitationTrendChartProps {
  data: YearlyCitations[];
  variant?: 'line' | 'bar'; // Google Scholar uses bar chart style
}

export default function CitationTrendChart({ data, variant = 'bar' }: CitationTrendChartProps) {
  // Sort data by year
  const sortedData = [...data].sort((a, b) => a.year - b.year);

  // Custom tooltip matching Google Scholar style
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg px-3 py-2">
          <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            {payload[0].payload.year}
          </p>
          <p className="text-[13px] text-gray-600 dark:text-gray-400">
            <span className="font-semibold text-blue-600 dark:text-blue-400">{payload[0].value}</span> citations
          </p>
        </div>
      );
    }
    return null;
  };

  if (sortedData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400 text-[13px]">
        No citation data available
      </div>
    );
  }

  // Common chart props matching Google Scholar's minimalist style
  const commonProps = {
    data: sortedData,
    margin: { top: 5, right: 5, left: 0, bottom: 5 },
  };

  const xAxisProps = {
    dataKey: 'year',
    tick: { fill: '#666', fontSize: 10 },
    tickLine: false,
    axisLine: { stroke: '#ddd' },
    height: 20,
  };

  const yAxisProps = {
    tick: { fill: '#666', fontSize: 10 },
    tickLine: false,
    axisLine: false,
    width: 35,
  };

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        {variant === 'bar' ? (
          <BarChart {...commonProps}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e8e8e8" 
              vertical={false}
            />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(66, 133, 244, 0.1)' }} />
            <Bar
              dataKey="count"
              fill="#4285f4"
              radius={[2, 2, 0, 0]}
              maxBarSize={30}
            />
          </BarChart>
        ) : (
          <LineChart {...commonProps}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e8e8e8" 
              vertical={false}
            />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#4285f4"
              strokeWidth={2}
              dot={{ fill: '#4285f4', r: 3 }}
              activeDot={{ r: 5, fill: '#4285f4' }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
