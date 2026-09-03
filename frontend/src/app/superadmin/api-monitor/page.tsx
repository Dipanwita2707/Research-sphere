'use client';

import React, { useEffect, useState } from 'react';
import { superadminService, ApiMonitorStats } from '@/shared/services/superadmin.service';
import { 
  Activity, 
  Clock, 
  AlertOctagon, 
  CheckCircle2, 
  RefreshCw, 
  Loader2, 
  Building2, 
  BarChart, 
  ShieldAlert
} from 'lucide-react';

export default function ApiUsageMonitor() {
  const [stats, setStats] = useState<ApiMonitorStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      const data = await superadminService.getApiMonitorStats();
      setStats(data);
    } catch (err) {
      setError('Failed to fetch real-time API monitor stats.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Auto-refresh stats every 30 seconds
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStats();
  };

  if (isLoading && stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 text-red-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400">Connecting to API usage monitor streams...</p>
      </div>
    );
  }

  // Calculate global totals
  const totalRequests = stats.reduce((acc, curr) => acc + curr.requests, 0);
  const totalErrors = stats.reduce((acc, curr) => acc + curr.errorRequests, 0);
  const globalErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  const globalAvgLatency = stats.length > 0 
    ? Math.round(stats.reduce((acc, curr) => acc + curr.avgDurationMs, 0) / stats.length) 
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">API Usage & Health</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time HTTP request traffic monitoring across all university nodes.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Stats (Auto 30s)
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-red-700 dark:text-red-400 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Global Realtime KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-brand-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase">Requests Today</span>
            <div className="text-2xl font-black text-gray-950 dark:text-white mt-1">
              {new Intl.NumberFormat('en-IN').format(totalRequests)}
            </div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-xl">
            <Activity className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-brand-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase">Average Latency</span>
            <div className="text-2xl font-black text-gray-950 dark:text-white mt-1">
              {globalAvgLatency}ms
            </div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-brand-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase">System Error Rate</span>
            <div className="text-2xl font-black text-gray-950 dark:text-white mt-1">
              {globalErrorRate.toFixed(2)}%
            </div>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-xl">
            <AlertOctagon className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-brand-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase">Gateway Health</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-450 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-5 w-5" /> Normal
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 rounded-xl">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Grid: Universities Details */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Building2 className="h-5 w-5 text-red-600" />
          Individual Tenant Metrics (Today)
        </h2>

        {stats.length === 0 ? (
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-8 rounded-2xl text-center text-gray-400 italic">
            No API request activity tracked for today yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {stats.map((stat) => (
              <div 
                key={stat.universityId} 
                className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-6"
              >
                {/* Header */}
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-850 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-gray-950 dark:text-white">{stat.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{stat.code} Tenant Node</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-1 rounded-lg">
                    {new Intl.NumberFormat('en-IN').format(stat.requests)} requests
                  </span>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 dark:bg-gray-900 py-3 rounded-xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Avg latency</span>
                    <div className="text-lg font-bold text-gray-950 dark:text-white mt-0.5">
                      {stat.avgDurationMs}ms
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 py-3 rounded-xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">P95 Latency</span>
                    <div className="text-lg font-bold text-gray-950 dark:text-white mt-0.5">
                      {stat.p95DurationMs}ms
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 py-3 rounded-xl">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Error Rate</span>
                    <div className={`text-lg font-bold mt-0.5 ${
                      stat.requests > 0 && (stat.errorRequests / stat.requests) >= 0.05 
                        ? 'text-red-500' 
                        : 'text-gray-950 dark:text-white'
                    }`}>
                      {stat.requests > 0 ? ((stat.errorRequests / stat.requests) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>

                {/* Popular Endpoints */}
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5 mb-3">
                    <BarChart className="h-4 w-4" /> Top endpoints (Today)
                  </span>
                  <div className="space-y-2.5">
                    {Object.keys(stat.endpointBreakdown).length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No endpoint breakdown available.</p>
                    ) : (
                      Object.entries(stat.endpointBreakdown).slice(0, 5).map(([endpoint, count]) => {
                        const pct = Math.round((count / stat.requests) * 100);
                        return (
                          <div key={endpoint} className="text-xs space-y-1.5">
                            <div className="flex justify-between font-medium text-gray-700 dark:text-gray-300">
                              <span className="font-mono truncate max-w-[70%]">{endpoint}</span>
                              <span>{count} calls ({pct}%)</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 h-1 rounded-full overflow-hidden">
                              <div className="bg-red-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
