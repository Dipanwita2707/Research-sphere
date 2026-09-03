/**
 * Profile Metrics Analytics Component
 * 
 * Extends the existing ResearchSphere UMS analytics dashboard with research profile metrics.
 * Displays citation-based metrics and department-wide research impact visualization.
 * Integrates with existing Research Activity Distribution and Monthly Submission Trend.
 */

import React from 'react';
import { TrendingUp, Award, BookOpen, Users, Quote } from 'lucide-react';

export interface DepartmentMetrics {
  departmentId: string;
  departmentName: string;
  totalCitations: number;
  avgHIndex: number;
  totalPublications: number;
  activeResearchers: number;
  citationGrowth: number; // Percentage growth
}

export interface ProfileMetricsData {
  departmentMetrics: DepartmentMetrics[];
  institutionTotals: {
    totalCitations: number;
    avgHIndex: number;
    totalPublications: number;
    totalResearchers: number;
  };
  topResearchers: Array<{
    name: string;
    department: string;
    hIndex: number;
    totalCitations: number;
  }>;
}

interface ProfileMetricsAnalyticsProps {
  data: ProfileMetricsData;
  loading?: boolean;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#6497b1] dark:text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[#011f4b] dark:text-white">{value}</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${accent}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function ProfileMetricsAnalytics({ data, loading = false }: ProfileMetricsAnalyticsProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#005b96]" />
          </div>
        </div>
      </div>
    );
  }

  const { institutionTotals, departmentMetrics, topResearchers } = data;

  return (
    <div className="space-y-6">
      {/* Institution-wide Citation Metrics */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Citations"
          value={formatNumber(institutionTotals.totalCitations)}
          subtitle="Across all researcher profiles"
          icon={<Quote className="h-6 w-6" />}
          accent="bg-gradient-to-br from-[#005b96] to-[#03396c]"
        />
        <MetricCard
          title="Average h-index"
          value={formatNumber(institutionTotals.avgHIndex)}
          subtitle="Institution-wide average"
          icon={<Award className="h-6 w-6" />}
          accent="bg-gradient-to-br from-[#6497b1] to-[#005b96]"
        />
        <MetricCard
          title="Total Publications"
          value={formatNumber(institutionTotals.totalPublications)}
          subtitle="Indexed publications"
          icon={<BookOpen className="h-6 w-6" />}
          accent="bg-gradient-to-br from-emerald-500 to-emerald-700"
        />
        <MetricCard
          title="Active Researchers"
          value={formatNumber(institutionTotals.totalResearchers)}
          subtitle="With research profiles"
          icon={<Users className="h-6 w-6" />}
          accent="bg-gradient-to-br from-amber-500 to-orange-600"
        />
      </section>

      {/* Department-wide Research Impact */}
      <section className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#e3edf4] dark:border-gray-700 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#011f4b] dark:text-white">Department Research Impact</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Citation metrics and publication output by department
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f7fbfe] dark:bg-gray-700 text-left text-[#6497b1] dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Department</th>
                <th className="px-5 py-3 font-semibold">Citations</th>
                <th className="px-5 py-3 font-semibold">Avg h-index</th>
                <th className="px-5 py-3 font-semibold">Publications</th>
                <th className="px-5 py-3 font-semibold">Researchers</th>
                <th className="px-5 py-3 font-semibold">Growth</th>
              </tr>
            </thead>
            <tbody>
              {departmentMetrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                    No department metrics available
                  </td>
                </tr>
              ) : (
                departmentMetrics.map((dept) => (
                  <tr key={dept.departmentId} className="border-t border-[#eef5f9] dark:border-gray-700">
                    <td className="px-5 py-4 font-semibold text-[#011f4b] dark:text-white">
                      {dept.departmentName}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {formatNumber(dept.totalCitations)}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {formatNumber(dept.avgHIndex)}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {formatNumber(dept.totalPublications)}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {formatNumber(dept.activeResearchers)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                          dept.citationGrowth >= 0
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        <TrendingUp className="h-3 w-3" />
                        {dept.citationGrowth >= 0 ? '+' : ''}
                        {formatNumber(dept.citationGrowth)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top Researchers */}
      <section className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#e3edf4] dark:border-gray-700 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#011f4b] dark:text-white">Top Researchers</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Highest impact researchers by h-index
            </p>
          </div>
        </div>

        <div className="space-y-3 p-5">
          {topResearchers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No researcher data available
            </p>
          ) : (
            topResearchers.map((researcher, index) => (
              <div
                key={`${researcher.name}-${index}`}
                className="flex items-center justify-between rounded-2xl border border-[#e3edf4] dark:border-gray-700 p-4 hover:bg-[#f7fbfe] dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#005b96] text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-[#011f4b] dark:text-white">{researcher.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{researcher.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-[#6497b1] dark:text-gray-400">h-index</p>
                    <p className="text-lg font-bold text-[#011f4b] dark:text-white">{researcher.hIndex}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#6497b1] dark:text-gray-400">Citations</p>
                    <p className="text-lg font-bold text-[#011f4b] dark:text-white">
                      {formatNumber(researcher.totalCitations)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
