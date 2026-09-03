'use client';

/**
 * Research Analytics Dashboard Page
 * 
 * Integrates research profile metrics with existing ResearchSphere UMS analytics.
 * Displays citation-based metrics, comparative analytics, and publication output visualization.
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
import { BarChart3, TrendingUp, Users, Sparkles, Layers, GitBranch } from 'lucide-react';

type AnalyticsView = 'overview' | 'comparative' | 'output';

const VIEWS: { key: AnalyticsView; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'overview',     label: 'Overview',     icon: BarChart3,   desc: 'Citations & impact metrics' },
  { key: 'comparative',  label: 'Comparative',  icon: TrendingUp,  desc: 'Dept. & faculty comparison' },
  { key: 'output',       label: 'Output',       icon: GitBranch,   desc: 'Publication volume & trends' },
];

export default function ResearchAnalyticsPage() {
  const [activeView, setActiveView] = useState<AnalyticsView>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      const mockData = generateAnalyticsDashboardData();
      setData(mockData);
      setLoading(false);
    };
    loadData();
  }, []);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

        {/* ── Page Header ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium tracking-wide uppercase">
                  <Layers className="w-3.5 h-3.5" />
                  Research Management
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Research Analytics &amp; Insights
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Citation metrics, comparative rankings, and publication output trends
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

          {/* ── View Switcher ────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 flex gap-1.5 w-fit">
            {VIEWS.map(view => {
              const Icon = view.icon;
              const isActive = activeView === view.key;
              return (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => setActiveView(view.key)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'bg-[#7d1a34] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {view.label}
                </button>
              );
            })}
          </div>

          {/* ── Content ──────────────────────────────────────────────── */}
          {loading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full border-2 border-[#7d1a34] border-t-transparent animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-700 dark:text-white">Loading research analytics…</p>
                <p className="text-xs text-slate-400 mt-1">Preparing citation metrics and insights</p>
              </div>
            </div>
          ) : !data ? (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">No data available</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Research analytics data could not be loaded. Please try again later.</p>
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

          {/* ── Integration Note ─────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-[#fdf5ec] dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-[#7d1a34] dark:text-[#c8973f]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Integration with Existing Analytics</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                  This dashboard extends the existing ResearchSphere UMS DRD analytics with citation-based metrics and
                  research impact visualization. All data integrates seamlessly with the existing Research
                  Activity Distribution and Monthly Submission Trend analytics without modifying existing functionality.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['Citation Metrics', 'Department Impact', 'Comparative Rankings', 'Publication Output'].map(tag => (
                    <span key={tag} className="inline-flex px-2.5 py-0.5 rounded text-xs font-medium bg-[#fdf5ec] dark:bg-blue-950/40 text-[#7d1a34] dark:text-[#c8973f] border border-blue-100 dark:border-blue-900">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
