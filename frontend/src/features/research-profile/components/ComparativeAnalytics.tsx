/**
 * Comparative Analytics Component
 * 
 * Displays percentile rankings within department or field and comparative metrics visualization.
 * Shows how a researcher's metrics compare to peers in their department or field.
 */

import React from 'react';
import { TrendingUp, Award, BookOpen, Target } from 'lucide-react';

export interface PercentileData {
  metric: string;
  value: number;
  percentile: number; // 0-100
  departmentAvg: number;
  fieldAvg?: number;
}

export interface ComparativeMetrics {
  researcherName: string;
  department: string;
  field?: string;
  percentiles: PercentileData[];
  rank: {
    inDepartment: number;
    totalInDepartment: number;
    inField?: number;
    totalInField?: number;
  };
}

interface ComparativeAnalyticsProps {
  data: ComparativeMetrics;
  loading?: boolean;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
}

function getPercentileColor(percentile: number): string {
  if (percentile >= 90) return 'bg-emerald-500';
  if (percentile >= 75) return 'bg-blue-500';
  if (percentile >= 50) return 'bg-amber-500';
  return 'bg-gray-400';
}

function getPercentileLabel(percentile: number): string {
  if (percentile >= 90) return 'Top 10%';
  if (percentile >= 75) return 'Top 25%';
  if (percentile >= 50) return 'Above Average';
  return 'Below Average';
}

function PercentileBar({ percentile }: { percentile: number }) {
  const color = getPercentileColor(percentile);
  
  return (
    <div className="relative h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
      <div
        className={`absolute left-0 top-0 h-full ${color} transition-all duration-500`}
        style={{ width: `${percentile}%` }}
      />
    </div>
  );
}

function MetricIcon({ metric }: { metric: string }) {
  const iconClass = "h-5 w-5";
  
  if (metric.toLowerCase().includes('h-index')) {
    return <Award className={iconClass} />;
  }
  if (metric.toLowerCase().includes('citation')) {
    return <TrendingUp className={iconClass} />;
  }
  if (metric.toLowerCase().includes('publication')) {
    return <BookOpen className={iconClass} />;
  }
  return <Target className={iconClass} />;
}

export default function ComparativeAnalytics({ data, loading = false }: ComparativeAnalyticsProps) {
  if (loading) {
    return (
      <div className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#005b96]" />
        </div>
      </div>
    );
  }

  const { researcherName, department, field, percentiles, rank } = data;

  return (
    <div className="space-y-6">
      {/* Header with Ranking */}
      <section className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-gradient-to-r from-[#005b96] to-[#004a80] text-white shadow-lg">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#b3cde0]">Comparative Analytics</p>
              <h2 className="mt-2 text-2xl font-bold">{researcherName}</h2>
              <p className="mt-1 text-sm text-[#d8e6ef]">{department}</p>
              {field && <p className="text-sm text-[#d8e6ef]">Field: {field}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm text-[#b3cde0]">Department Rank</p>
              <p className="mt-1 text-3xl font-bold">
                #{rank.inDepartment}
                <span className="text-lg text-[#d8e6ef]"> / {rank.totalInDepartment}</span>
              </p>
              {rank.inField && rank.totalInField && (
                <>
                  <p className="mt-3 text-sm text-[#b3cde0]">Field Rank</p>
                  <p className="mt-1 text-2xl font-bold">
                    #{rank.inField}
                    <span className="text-base text-[#d8e6ef]"> / {rank.totalInField}</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Percentile Rankings */}
      <section className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#e3edf4] dark:border-gray-700 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#011f4b] dark:text-white">Percentile Rankings</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              How you compare to peers in your department and field
            </p>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {percentiles.map((item, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7fbfe] dark:bg-gray-700 text-[#005b96] dark:text-blue-400">
                    <MetricIcon metric={item.metric} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#011f4b] dark:text-white">{item.metric}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {getPercentileLabel(item.percentile)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#011f4b] dark:text-white">
                    {formatNumber(item.value)}
                  </p>
                  <p className="text-xs text-[#6497b1] dark:text-gray-400">
                    {item.percentile.toFixed(0)}th percentile
                  </p>
                </div>
              </div>

              <PercentileBar percentile={item.percentile} />

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Dept Avg: </span>
                    <span className="font-semibold text-[#011f4b] dark:text-white">
                      {formatNumber(item.departmentAvg)}
                    </span>
                  </div>
                  {item.fieldAvg !== undefined && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Field Avg: </span>
                      <span className="font-semibold text-[#011f4b] dark:text-white">
                        {formatNumber(item.fieldAvg)}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  {item.value > item.departmentAvg ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      +{formatNumber(((item.value - item.departmentAvg) / item.departmentAvg) * 100)}% above avg
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      {formatNumber(((item.value - item.departmentAvg) / item.departmentAvg) * 100)}% below avg
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparative Visualization Summary */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Top 10%</p>
          </div>
          <p className="text-2xl font-bold text-[#011f4b] dark:text-white">
            {percentiles.filter(p => p.percentile >= 90).length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">metrics in top tier</p>
        </div>

        <div className="rounded-2xl border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Top 25%</p>
          </div>
          <p className="text-2xl font-bold text-[#011f4b] dark:text-white">
            {percentiles.filter(p => p.percentile >= 75 && p.percentile < 90).length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">metrics above average</p>
        </div>

        <div className="rounded-2xl border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average</p>
          </div>
          <p className="text-2xl font-bold text-[#011f4b] dark:text-white">
            {percentiles.filter(p => p.percentile >= 50 && p.percentile < 75).length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">metrics at average</p>
        </div>
      </section>
    </div>
  );
}
