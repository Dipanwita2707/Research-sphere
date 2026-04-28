'use client';

/**
 * Research Analytics Dashboard Page
 * 
 * Integrates research profile metrics with existing SGT UMS analytics.
 * Displays citation-based metrics, comparative analytics, and publication output visualization.
 * 
 * This page extends the existing DRD analytics with research profile insights.
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/shared/providers/ProtectedRoute';
import {
  ProfileMetricsAnalytics,
  ComparativeAnalytics,
  PublicationOutputVisualization,
} from '@/features/research-profile/components';
import {
  generateAnalyticsDashboardData,
  type AnalyticsDashboardData,
} from '@/mocks/research-analytics-mocks';
import { BarChart3, TrendingUp, Users, Sparkles } from 'lucide-react';

type AnalyticsView = 'overview' | 'comparative' | 'output';

export default function ResearchAnalyticsPage() {
  const [activeView, setActiveView] = useState<AnalyticsView>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);

  useEffect(() => {
    // Simulate API call with mock data
    const loadData = async () => {
      setLoading(true);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockData = generateAnalyticsDashboardData();
      setData(mockData);
      setLoading(false);
    };

    loadData();
  }, []);

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header Section */}
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#005b96] via-[#004a80] to-[#003d6b] text-white shadow-[0_16px_48px_rgba(0,91,150,0.24)]">
          <div className="absolute -right-14 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[#6497b1]/25 blur-3xl" />
          
          <div className="relative px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#d8e6ef]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Research Analytics Dashboard
                </div>
                <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
                  Research Profile Analytics & Insights
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d8e6ef] sm:text-base">
                  Comprehensive view of research impact, citation metrics, and publication output
                  across departments and individual researchers. Integrated with existing SGT UMS analytics.
                </p>
              </div>

              <div className="inline-flex w-full flex-col gap-2 rounded-2xl bg-white/10 p-1 backdrop-blur-sm sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => setActiveView('overview')}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    activeView === 'overview'
                      ? 'bg-white text-[#011f4b] shadow-lg'
                      : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Overview
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('comparative')}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    activeView === 'comparative'
                      ? 'bg-white text-[#011f4b] shadow-lg'
                      : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Comparative
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('output')}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    activeView === 'output'
                      ? 'bg-white text-[#011f4b] shadow-lg'
                      : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Output
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0f7fb] dark:bg-gray-700 text-[#005b96]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#005b96] border-t-transparent" />
              </div>
              <p className="mt-4 text-sm font-medium text-[#011f4b] dark:text-white">
                Loading research analytics
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Preparing citation metrics and insights
              </p>
            </div>
          </div>
        ) : !data ? (
          <div className="flex min-h-[400px] items-center justify-center rounded-[28px] border border-dashed border-[#b3cde0] dark:border-gray-600 bg-[#f7fbfe] dark:bg-gray-800">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-gray-700 text-[#005b96] dark:text-blue-400 shadow-sm">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#011f4b] dark:text-white">
                No data available
              </h3>
              <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
                Research analytics data could not be loaded. Please try again later.
              </p>
            </div>
          </div>
        ) : (
          <>
            {activeView === 'overview' && (
              <ProfileMetricsAnalytics data={data.profileMetrics} loading={false} />
            )}
            
            {activeView === 'comparative' && (
              <ComparativeAnalytics data={data.comparativeMetrics} loading={false} />
            )}
            
            {activeView === 'output' && (
              <PublicationOutputVisualization data={data.publicationOutput} loading={false} />
            )}
          </>
        )}

        {/* Integration Note */}
        <section className="rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#005b96] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#011f4b] dark:text-white">
                Integration with Existing Analytics
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                This research analytics dashboard extends the existing SGT UMS DRD analytics with citation-based
                metrics and research impact visualization. All data integrates seamlessly with the existing
                Research Activity Distribution and Monthly Submission Trend analytics without modifying
                existing functionality.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white dark:bg-gray-700 border border-[#d8e6ef] dark:border-gray-600 px-3 py-1 text-xs font-medium text-[#005b96] dark:text-blue-400">
                  Citation Metrics
                </span>
                <span className="rounded-full bg-white dark:bg-gray-700 border border-[#d8e6ef] dark:border-gray-600 px-3 py-1 text-xs font-medium text-[#005b96] dark:text-blue-400">
                  Department Impact
                </span>
                <span className="rounded-full bg-white dark:bg-gray-700 border border-[#d8e6ef] dark:border-gray-600 px-3 py-1 text-xs font-medium text-[#005b96] dark:text-blue-400">
                  Comparative Rankings
                </span>
                <span className="rounded-full bg-white dark:bg-gray-700 border border-[#d8e6ef] dark:border-gray-600 px-3 py-1 text-xs font-medium text-[#005b96] dark:text-blue-400">
                  Publication Output
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}
