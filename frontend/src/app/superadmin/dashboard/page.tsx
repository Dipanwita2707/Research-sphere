'use client';

import React, { useEffect, useState } from 'react';
import { superadminService, SaaSGlobalStats, University } from '@/shared/services/superadmin.service';
import { 
  Building2, 
  Users2, 
  CreditCard, 
  Activity, 
  AlertTriangle, 
  ArrowUpRight, 
  Loader2, 
  RefreshCw,
  ChevronRight,
  TrendingUp,
  Server,
  Shield
} from 'lucide-react';
import Link from 'next/link';

export default function SuperadminDashboard() {
  const [stats, setStats] = useState<SaaSGlobalStats | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const [statsData, uniData] = await Promise.all([
        superadminService.getGlobalStats(),
        superadminService.getAllUniversities()
      ]);
      setStats(statsData);
      setUniversities(uniData);
    } catch (err) {
      setError('Failed to load dashboard metrics. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl bg-wine/30 animate-pulse" />
          <Loader2 className="relative h-12 w-12 text-wine animate-spin" />
        </div>
        <p className="text-gray-600 font-medium tracking-wide">Loading SaaS insights...</p>
      </div>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const formatApiCount = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'K';
    }
    return num.toString();
  };

  const alerts = universities
    .filter(u => {
      if (!u.subscription || u.subscription.maxApiCalls === -1) return false;
      const mtd = u.apiUsageMtd || 0;
      const limit = u.subscription.maxApiCalls;
      return mtd >= limit * 0.8; 
    })
    .map(u => {
      const mtd = u.apiUsageMtd || 0;
      const limit = u.subscription?.maxApiCalls || 1;
      const pct = Math.round((mtd / limit) * 100);
      const isExceeded = mtd >= limit;
      return {
        id: u.id,
        name: u.name,
        code: u.code,
        type: isExceeded ? 'danger' : 'warning',
        message: isExceeded 
          ? `${u.name} (${u.code}) has exceeded their API quota (${pct}% used).`
          : `${u.name} (${u.code}) is approaching their API quota limit (${pct}% used).`
      };
    });

  return (
    <div className="space-y-10 min-h-screen bg-ivory pb-12">
      {/* Hero Banner Section */}
      <div className="relative bg-gradient-to-br from-wine-dark to-wine overflow-hidden rounded-3xl p-8 md:p-12 shadow-2xl shadow-wine/20 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-amber-500/20 transition-all duration-700" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Global <span className="text-amber">SaaS Network</span>
          </h1>
          <p className="text-wine-50 text-lg md:text-xl font-medium opacity-90 leading-relaxed">
            Real-time telemetry, tenant orchestration, and usage analytics across all UMS enterprise instances.
          </p>
        </div>
        <div className="relative z-10 flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-full text-sm font-bold hover:bg-white/20 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync Telemetry
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50/80 backdrop-blur-sm border-l-4 border-red-500 p-6 rounded-2xl text-red-800 shadow-sm flex items-start gap-4 transform transition-all animate-in fade-in slide-in-from-top-4">
          <AlertTriangle className="h-6 w-6 flex-shrink-0 mt-0.5 text-red-600" />
          <div>
            <h3 className="font-bold text-red-900 mb-1">Telemetry Sync Failed</h3>
            <p className="text-red-700/90">{error}</p>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Card 1: Universities */}
        <div className="group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-wine/5 border border-wine/5 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-wine/5 rounded-full blur-2xl group-hover:bg-wine/10 transition-colors" />
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-blush-deep text-wine rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <Building2 className="h-6 w-6" />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              <TrendingUp className="h-3 w-3" />
              Active
            </span>
          </div>
          <div>
            <h4 className="text-gray-500 font-semibold text-sm mb-1 uppercase tracking-wider">Total Tenants</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-charcoal">{stats?.totalUniversities || 0}</span>
              <span className="text-sm font-medium text-gray-400">universities</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Subscriptions */}
        <div className="group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-amber/5 border border-amber/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber/5 rounded-full blur-2xl group-hover:bg-amber/10 transition-colors" />
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-amber-50 text-amber rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h4 className="text-gray-500 font-semibold text-sm mb-1 uppercase tracking-wider">Active Licenses</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-charcoal">{stats?.activeSubscriptions || 0}</span>
              <span className="text-sm font-medium text-gray-400">plans</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Combined Users */}
        <div className="group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-wine/5 border border-wine/5 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-peach/20 rounded-full blur-2xl group-hover:bg-peach/30 transition-colors" />
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-blush-deep text-wine-dark rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <Users2 className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h4 className="text-gray-500 font-semibold text-sm mb-1 uppercase tracking-wider">Global User Pool</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-charcoal">{formatNumber(stats?.totalUsers || 0)}</span>
              <span className="text-sm font-medium text-gray-400">accounts</span>
            </div>
          </div>
        </div>

        {/* Card 4: Estimated MRR */}
        <div className="group relative bg-gradient-to-br from-wine to-wine-dark rounded-3xl p-6 shadow-lg shadow-wine/20 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-wine/30 overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="p-3 bg-white/10 backdrop-blur-md text-white rounded-2xl group-hover:scale-110 transition-transform duration-300 border border-white/10">
              <Activity className="h-6 w-6" />
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-100 bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 px-2.5 py-1 rounded-full">
              Live
            </span>
          </div>
          <div className="relative z-10">
            <h4 className="text-wine-100 font-semibold text-sm mb-1 uppercase tracking-wider">Monthly MRR</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">{formatCurrency(stats?.monthlyRecurringRevenueCents || 0)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Quick Navigation / Management Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/superadmin/licenses"
          className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-wine/10 hover:border-wine/30 shadow-sm hover:shadow-lg transition-all duration-300 group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-wine/10 text-wine group-hover:scale-110 transition-transform">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-wine transition-colors">
                Software Protection & Licenses
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Hardware node-locking, approvals & kill switch</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-wine group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href="/superadmin/universities"
          className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-wine/10 hover:border-wine/30 shadow-sm hover:shadow-lg transition-all duration-300 group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 group-hover:scale-110 transition-transform">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                Tenant Universities
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Manage institutions and admin access</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href="/superadmin/api-monitor"
          className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-wine/10 hover:border-wine/30 shadow-sm hover:shadow-lg transition-all duration-300 group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 group-hover:scale-110 transition-transform">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-amber-600 transition-colors">
                API Telemetry & Monitor
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Live request throughput and quotas</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Warnings & Alerts */}
      {alerts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-3xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-amber-900 flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            Quota Threshold Alerts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert, idx) => (
              <div key={idx} className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-md ${
                alert.type === 'danger'
                  ? 'bg-white border-red-200 shadow-sm shadow-red-100/50'
                  : 'bg-white border-amber-200 shadow-sm shadow-amber-100/50'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full ${alert.type === 'danger' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                  <p className={`text-sm font-semibold ${alert.type === 'danger' ? 'text-red-900' : 'text-amber-900'}`}>
                    {alert.message}
                  </p>
                </div>
                <Link
                  href={`/superadmin/universities/${alert.id}`}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    alert.type === 'danger' 
                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Configure Limit
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Universities Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-wine/5 overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-wine/10 text-wine rounded-xl">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-charcoal tracking-tight">Tenant Directory</h2>
              <p className="text-sm font-medium text-gray-500 mt-0.5">Manage and monitor all hosted university instances</p>
            </div>
          </div>
          <Link
            href="/superadmin/universities"
            className="hidden sm:inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blush text-wine-dark hover:bg-blush-deep hover:text-wine font-bold text-sm rounded-full transition-all"
          >
            Manage All Tenants
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-8 py-5">University</th>
                <th className="px-8 py-5">Plan / Status</th>
                <th className="px-8 py-5">Population</th>
                <th className="px-8 py-5">API Quota Usage</th>
                <th className="px-8 py-5">Instance State</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {universities.slice(0, 5).map((uni) => (
                <tr key={uni.id} className="group hover:bg-blush-light/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-charcoal font-bold shadow-inner">
                        {uni.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-charcoal group-hover:text-wine transition-colors">{uni.name}</div>
                        <div className="text-xs font-medium text-gray-400 mt-1 flex items-center gap-2">
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold">{uni.code}</span>
                          {uni.slug}.sgt-ums.com
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="font-bold text-charcoal flex items-center gap-2">
                      {uni.subscription?.tierName || 'No Active Plan'}
                      {uni.subscription?.tierName === 'Enterprise' && (
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                      )}
                    </div>
                    <div className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-wider">
                      {uni.subscription?.status || 'unsubscribed'}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-charcoal font-semibold text-sm">
                      <Users2 className="h-4 w-4 text-gray-400" />
                      {formatNumber(uni.counts?.users || 0)}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-charcoal text-sm">
                        {formatApiCount(uni.apiUsageMtd || 0)}
                      </span>
                      <span className="text-xs font-bold text-gray-400">
                        / {uni.subscription?.maxApiCalls === -1 ? '∞' : formatApiCount(uni.subscription?.maxApiCalls || 0)}
                      </span>
                    </div>
                    {/* Progress bar */}
                    {uni.subscription && uni.subscription.maxApiCalls !== -1 && (
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            ((uni.apiUsageMtd || 0) / uni.subscription.maxApiCalls) >= 1.0 
                              ? 'bg-red-500' 
                              : ((uni.apiUsageMtd || 0) / uni.subscription.maxApiCalls) >= 0.8 
                                ? 'bg-amber-500' 
                                : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.round(((uni.apiUsageMtd || 0) / uni.subscription.maxApiCalls) * 100))}%` }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                      uni.isActive 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${uni.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {uni.isActive ? 'Online' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <Link
                      href={`/superadmin/universities/${uni.id}`}
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 text-gray-400 hover:bg-wine hover:text-white hover:shadow-lg hover:shadow-wine/30 transition-all duration-300"
                    >
                      <ChevronRight className="h-5 w-5 ml-0.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 sm:hidden">
           <Link
            href="/superadmin/universities"
            className="flex items-center justify-center w-full gap-2 px-5 py-3 bg-blush text-wine-dark hover:bg-blush-deep font-bold text-sm rounded-xl transition-all"
          >
            Manage All Tenants
          </Link>
        </div>
      </div>
    </div>
  );
}
