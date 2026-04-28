/**
 * Publication Output Visualization Component
 * 
 * Displays papers per year chart and publication type distribution.
 * Provides visual insights into research productivity over time.
 */

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BookOpen, FileText, Presentation, Award } from 'lucide-react';

export interface YearlyOutput {
  year: number;
  count: number;
  citations: number;
}

export interface PublicationTypeData {
  type: string;
  count: number;
  percentage: number;
  [key: string]: string | number; // Index signature for recharts compatibility
}

export interface PublicationOutputData {
  yearlyOutput: YearlyOutput[];
  typeDistribution: PublicationTypeData[];
  totalPublications: number;
  yearRange: {
    start: number;
    end: number;
  };
}

interface PublicationOutputVisualizationProps {
  data: PublicationOutputData;
  loading?: boolean;
}

// Color palette matching SGT UMS theme
const COLORS = ['#005b96', '#6497b1', '#03396c', '#b3cde0', '#011f4b'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

function getTypeIcon(type: string) {
  const iconClass = "h-4 w-4";
  const lowerType = type.toLowerCase();
  
  if (lowerType.includes('journal')) return <FileText className={iconClass} />;
  if (lowerType.includes('conference')) return <Presentation className={iconClass} />;
  if (lowerType.includes('book')) return <BookOpen className={iconClass} />;
  return <Award className={iconClass} />;
}

export default function PublicationOutputVisualization({ data, loading = false }: PublicationOutputVisualizationProps) {
  if (loading) {
    return (
      <div className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#005b96]" />
        </div>
      </div>
    );
  }

  const { yearlyOutput, typeDistribution, totalPublications, yearRange } = data;

  // Custom tooltip for yearly output chart
  const YearlyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg px-4 py-3">
          <p className="text-sm font-semibold text-[#011f4b] dark:text-white">
            {payload[0].payload.year}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Publications: <span className="font-semibold text-[#005b96]">{payload[0].value}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Citations: <span className="font-semibold text-emerald-600">{payload[0].payload.citations}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom label for pie chart
  const renderCustomLabel = (entry: any) => {
    return `${entry.percentage.toFixed(0)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Papers Per Year Chart */}
      <section className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#e3edf4] dark:border-gray-700 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#011f4b] dark:text-white">Publications Per Year</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Research output from {yearRange.start} to {yearRange.end}
            </p>
          </div>
          <div className="rounded-full border border-[#d8e6ef] dark:border-gray-600 bg-[#f7fbfe] dark:bg-gray-800 px-4 py-2">
            <span className="text-sm font-semibold text-[#005b96] dark:text-blue-400">
              Total: {formatNumber(totalPublications)} publications
            </span>
          </div>
        </div>

        <div className="p-5">
          {yearlyOutput.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              <p className="text-sm">No publication data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={yearlyOutput}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#666', fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#ddd' }}
                />
                <YAxis
                  tick={{ fill: '#666', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<YearlyTooltip />} cursor={{ fill: 'rgba(0, 91, 150, 0.1)' }} />
                <Bar
                  dataKey="count"
                  fill="#005b96"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Publication Type Distribution */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Pie Chart */}
        <div className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e3edf4] dark:border-gray-700 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-[#011f4b] dark:text-white">Publication Types</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Distribution by publication category
              </p>
            </div>
          </div>

          <div className="p-5">
            {typeDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No type distribution data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {typeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg px-4 py-3">
                            <p className="text-sm font-semibold text-[#011f4b] dark:text-white">
                              {payload[0].payload.type}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Count: <span className="font-semibold">{payload[0].value}</span>
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Percentage: <span className="font-semibold">{payload[0].payload.percentage.toFixed(1)}%</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Type Breakdown List */}
        <div className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e3edf4] dark:border-gray-700 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-[#011f4b] dark:text-white">Type Breakdown</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Detailed publication counts by type
              </p>
            </div>
          </div>

          <div className="p-5 space-y-3">
            {typeDistribution.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No type data available
              </p>
            ) : (
              typeDistribution.map((item, index) => {
                const color = COLORS[index % COLORS.length];
                const progressWidth = item.percentage;

                return (
                  <div key={item.type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: color }}
                        >
                          {getTypeIcon(item.type)}
                        </div>
                        <div>
                          <p className="font-semibold text-[#011f4b] dark:text-white text-sm">
                            {item.type}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {item.percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-[#011f4b] dark:text-white">
                          {formatNumber(item.count)}
                        </p>
                      </div>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full transition-all duration-500"
                        style={{ 
                          width: `${progressWidth}%`,
                          backgroundColor: color
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Summary Stats */}
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Publications</p>
          <p className="mt-2 text-3xl font-bold text-[#011f4b] dark:text-white">
            {formatNumber(totalPublications)}
          </p>
        </div>

        <div className="rounded-2xl border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400">Years Active</p>
          <p className="mt-2 text-3xl font-bold text-[#011f4b] dark:text-white">
            {yearRange.end - yearRange.start + 1}
          </p>
        </div>

        <div className="rounded-2xl border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400">Avg Per Year</p>
          <p className="mt-2 text-3xl font-bold text-[#011f4b] dark:text-white">
            {formatNumber(totalPublications / (yearRange.end - yearRange.start + 1))}
          </p>
        </div>

        <div className="rounded-2xl border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400">Publication Types</p>
          <p className="mt-2 text-3xl font-bold text-[#011f4b] dark:text-white">
            {typeDistribution.length}
          </p>
        </div>
      </section>
    </div>
  );
}
