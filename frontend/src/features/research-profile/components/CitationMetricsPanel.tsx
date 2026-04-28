import React from 'react';
import { Quote, TrendingUp, Award } from 'lucide-react';
import type { CitationMetrics } from '@/shared/types/research-profile.types';

interface CitationMetricsPanelProps {
  metrics: CitationMetrics;
}

export default function CitationMetricsPanel({ metrics }: CitationMetricsPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Quote className="w-4 h-4" />
        Citation Metrics
      </h3>
      
      <div className="space-y-4">
        {/* Total Citations */}
        <div className="pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.totalCitations.toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total citations</p>
        </div>

        {/* h-index */}
        <div className="flex justify-between items-center py-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400">h</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">h-index</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {metrics.hIndex} papers with ≥{metrics.hIndex} citations
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.hIndex}
          </span>
        </div>

        {/* i10-index */}
        <div className="flex justify-between items-center py-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="text-xs font-bold text-green-700 dark:text-green-400">i10</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">i10-index</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Papers with ≥10 citations
              </p>
            </div>
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.i10Index}
          </span>
        </div>

        {/* Average Citations */}
        <div className="flex justify-between items-center py-2 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Avg per paper</p>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            {metrics.avgCitationsPerPaper.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
